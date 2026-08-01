import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {FieldValue, Timestamp} from 'firebase-admin/firestore';
import {logger} from 'firebase-functions';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {generateQuotePdf} from '../documents/pdf';
import {firestore, storage} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';
import {calculateQuoteTotals} from '../shared/calculations';
import {invalidArgument, safeErrorCode} from '../shared/errors';
import {formatFolio} from '../shared/folio';
import {issueQuoteSchema, quoteItemSchema} from '../shared/schemas';

interface Reservation {
  kind: 'reserved' | 'ready';
  folio: string;
  documentId: string;
  requestId: string;
}

export const issueQuote = onCall(
  {
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 120,
    maxInstances: 5,
    enforceAppCheck: false,
  },
  async (request) => {
    const startedAt = Date.now();
    const actor = await requireActiveActor(request);
    const parsed = issueQuoteSchema.safeParse(request.data);
    if (!parsed.success) throw invalidArgument(parsed.error);
    const {quoteId, idempotencyKey} = parsed.data;
    const quoteRef = firestore.doc(`quotes/${quoteId}`);
    const documentRef = firestore.doc(`documents/${quoteId}`);
    const attemptRef = quoteRef.collection('issuanceAttempts').doc(idempotencyKey);
    let reserved = false;
    let stage = 'reserve';

    try {
      const reservation = await firestore.runTransaction<Reservation>(async (transaction) => {
        const quoteSnapshot = await transaction.get(quoteRef);
        if (!quoteSnapshot.exists) {
          throw new HttpsError('not-found', 'The quote does not exist.');
        }
        const quote = quoteSnapshot.data() ?? {};
        const requestRef = firestore.doc(`requests/${String(quote.requestId)}`);
        const requestSnapshot = await transaction.get(requestRef);
        if (!requestSnapshot.exists) {
          throw new HttpsError('failed-precondition', 'The related request does not exist.');
        }
        const serviceRequest = requestSnapshot.data() ?? {};
        if (
          quote.clientId !== serviceRequest.clientId ||
          quote.siteId !== serviceRequest.siteId ||
          (quote.equipmentId ?? null) !== (serviceRequest.equipmentId ?? null)
        ) {
          throw new HttpsError(
            'failed-precondition',
            'The quote does not match its related request.',
          );
        }
        if (
          actor.role === 'operator' &&
          (quote.assignedTo !== actor.uid || serviceRequest.assignedTo !== actor.uid)
        ) {
          throw new HttpsError('permission-denied', 'The quote is not assigned to this operator.');
        }

        if (quote.status === 'issued' && quote.documentStatus === 'ready') {
          return {
            kind: 'ready',
            folio: String(quote.folio),
            documentId: documentRef.id,
            requestId: String(quote.requestId),
          };
        }
        if (quote.status !== 'draft' || quote.locked === true) {
          throw new HttpsError('failed-precondition', 'Only unlocked drafts can be issued.');
        }
        if (quote.documentStatus === 'generating') {
          throw new HttpsError('already-exists', 'A generation attempt is already in progress.');
        }

        const now = new Date();
        const year = now.getUTCFullYear();
        const settingsSnapshot = await transaction.get(firestore.doc('settings/quoteDefaults'));
        const prefixValue = settingsSnapshot.data()?.folioPrefix;
        const prefix =
          typeof prefixValue === 'string' && /^[A-Z0-9-]{1,12}$/.test(prefixValue)
            ? prefixValue
            : 'COT';
        let folio = typeof quote.folio === 'string' ? quote.folio : '';
        if (!folio) {
          const counterRef = firestore.doc(`counters/quotes-${year}`);
          const counterSnapshot = await transaction.get(counterRef);
          const next = Number(counterSnapshot.data()?.value ?? 0) + 1;
          if (!Number.isSafeInteger(next) || next > 999999) {
            throw new HttpsError('resource-exhausted', 'The annual folio counter is exhausted.');
          }
          transaction.set(
            counterRef,
            {
              value: next,
              year,
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: actor.uid,
            },
            {merge: true},
          );
          folio = formatFolio(prefix, year, next);
        }

        transaction.set(attemptRef, {
          idempotencyKey,
          status: 'processing',
          actorId: actor.uid,
          folio,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(quoteRef, {
          folio,
          documentStatus: 'generating',
          issuanceKey: idempotencyKey,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.uid,
        });
        transaction.set(
          documentRef,
          {
            quoteId,
            type: 'quote_pdf',
            status: 'generating',
            storagePath: null,
            fileName: null,
            mimeType: null,
            sizeBytes: null,
            sha256: null,
            pageCount: null,
            generationAttempt: FieldValue.increment(1),
            generatedAt: null,
            generatedBy: null,
            errorCode: null,
            errorMessageSafe: null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            schemaVersion: 1,
          },
          {merge: true},
        );

        return {
          kind: 'reserved',
          folio,
          documentId: documentRef.id,
          requestId: String(quote.requestId),
        };
      });

      if (reservation.kind === 'ready') {
        return {
          quoteId,
          documentId: reservation.documentId,
          folio: reservation.folio,
          status: 'issued' as const,
        };
      }
      reserved = true;
      stage = 'load-related';

      const [
        quoteSnapshot,
        requestSnapshot,
        clientSnapshot,
        siteSnapshot,
        defaultsSnapshot,
        companySnapshot,
        itemSnapshots,
        adminSnapshots,
      ] = await Promise.all([
        quoteRef.get(),
        firestore.doc(`requests/${reservation.requestId}`).get(),
        quoteRef
          .get()
          .then((snapshot) => firestore.doc(`clients/${String(snapshot.data()?.clientId)}`).get()),
        quoteRef
          .get()
          .then((snapshot) => firestore.doc(`sites/${String(snapshot.data()?.siteId)}`).get()),
        firestore.doc('settings/quoteDefaults').get(),
        firestore.doc('settings/companyProfile').get(),
        quoteRef.collection('items').orderBy('position').limit(100).get(),
        firestore
          .collection('users')
          .where('role', '==', 'admin')
          .where('status', '==', 'active')
          .limit(50)
          .get(),
      ]);
      const quote = quoteSnapshot.data() ?? {};
      const serviceRequest = requestSnapshot.data() ?? {};
      const client = clientSnapshot.data();
      const site = siteSnapshot.data();
      if (!client || !site || !requestSnapshot.exists) {
        throw new Error('missing-related-resource');
      }
      if (itemSnapshots.empty) throw new Error('missing-items');

      const items = itemSnapshots.docs.map((snapshot) => {
        const result = quoteItemSchema.safeParse(snapshot.data());
        if (!result.success) throw new Error('invalid-item');
        return result.data;
      });
      const taxRate = Number(quote.taxRate);
      const totals = calculateQuoteTotals(items, taxRate);
      const defaults = defaultsSnapshot.data() ?? {};
      const company = companySnapshot.data() ?? {};
      const equipmentSnapshot = quote.equipmentId
        ? await firestore.doc(`equipment/${String(quote.equipmentId)}`).get()
        : null;
      const logoPath = path.resolve(__dirname, '../../assets/enfriamatic-logo-transparent.png');
      stage = 'generate-pdf';
      const generated = await generateQuotePdf({
        folio: reservation.folio,
        issuedAt: new Date(),
        clientName: String(client.name),
        clientLegalName: String(client.legalName ?? ''),
        clientRfc: String(client.rfc ?? ''),
        siteName: String(site.name),
        siteAddress: formatAddress(site.address),
        equipmentName: String(equipmentSnapshot?.data()?.name ?? ''),
        items: items.map((item) => ({
          ...item,
          ...calculateItemForPdf(item),
        })),
        discountDisplayMode:
          quote.discountDisplayMode === 'summary' || quote.discountDisplayMode === 'incorporated'
            ? quote.discountDisplayMode
            : 'detailed',
        ...totals,
        taxRate,
        currency: 'MXN',
        validityDays: Number(quote.validityDays ?? defaults.validityDays ?? 15),
        notes: String(quote.notes ?? ''),
        paymentMethod: String(defaults.paymentMethod ?? ''),
        warranty: String(defaults.warranty ?? ''),
        exclusions: String(defaults.exclusions ?? ''),
        legalText: String(company.legalText ?? ''),
        watermark: String(defaults.devWatermark ?? 'DOCUMENTO DE PRUEBA - DEV'),
        logoPath: existsSync(logoPath) ? logoPath : undefined,
      });
      if (
        generated.bytes.length < 5 ||
        generated.bytes.subarray(0, 5).toString('ascii') !== '%PDF-'
      ) {
        throw new Error('invalid-pdf-signature');
      }
      if (generated.bytes.length > 12 * 1024 * 1024) {
        throw new Error('pdf-too-large');
      }

      stage = 'save-storage';
      const storagePath = `quotes/${quoteId}/documents/${documentRef.id}.pdf`;
      const fileName = `${reservation.folio}.pdf`;
      const hash = createHash('sha256').update(generated.bytes).digest('hex');
      await storage
        .bucket()
        .file(storagePath)
        .save(generated.bytes, {
          resumable: false,
          metadata: {
            contentType: 'application/pdf',
            cacheControl: 'private, max-age=0, no-store',
            metadata: {quoteId, sha256: hash},
          },
        });

      stage = 'finalize';
      await firestore.runTransaction(async (transaction) => {
        const latestQuote = await transaction.get(quoteRef);
        if (
          latestQuote.data()?.issuanceKey !== idempotencyKey ||
          latestQuote.data()?.status !== 'draft'
        ) {
          throw new HttpsError('aborted', 'The quote changed during generation.');
        }
        transaction.update(quoteRef, {
          ...totals,
          status: 'issued',
          documentStatus: 'ready',
          locked: true,
          issuedAt: FieldValue.serverTimestamp(),
          issuedBy: actor.uid,
          validUntil: Timestamp.fromDate(
            new Date(Date.now() + Number(quote.validityDays ?? 15) * 24 * 60 * 60 * 1000),
          ),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.uid,
        });
        transaction.set(
          documentRef,
          {
            quoteId,
            type: 'quote_pdf',
            status: 'ready',
            storagePath,
            fileName,
            mimeType: 'application/pdf',
            sizeBytes: generated.bytes.length,
            sha256: hash,
            pageCount: generated.pageCount,
            generatedAt: FieldValue.serverTimestamp(),
            generatedBy: actor.uid,
            errorCode: null,
            errorMessageSafe: null,
            updatedAt: FieldValue.serverTimestamp(),
            schemaVersion: 1,
          },
          {merge: true},
        );
        transaction.set(
          attemptRef,
          {
            status: 'ready',
            updatedAt: FieldValue.serverTimestamp(),
            documentId: documentRef.id,
          },
          {merge: true},
        );
        const auditRef = firestore.collection('auditLogs').doc();
        transaction.set(auditRef, {
          actorId: actor.uid,
          actorRole: actor.role,
          action: 'quote.issued',
          resourceType: 'quote',
          resourceId: quoteId,
          requestId: quote.requestId,
          quoteId,
          before: {status: 'draft', documentStatus: 'generating'},
          after: {
            status: 'issued',
            documentStatus: 'ready',
            folio: reservation.folio,
            grandTotal: totals.grandTotal,
          },
          metadata: {
            durationMs: Date.now() - startedAt,
            sizeBytes: generated.bytes.length,
            sha256: hash,
          },
          createdAt: FieldValue.serverTimestamp(),
        });
        for (const admin of adminSnapshots.docs) {
          const notificationRef = firestore.collection('notifications').doc();
          transaction.set(notificationRef, {
            userId: admin.id,
            type: 'quote_issued',
            title: `Cotización ${reservation.folio} emitida`,
            message:
              `${actor.displayName} emitió una cotización por ` +
              `${totals.grandTotal.toFixed(2)} MXN.`,
            resourceType: 'quote',
            resourceId: quoteId,
            read: false,
            readAt: null,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      });

      logger.info('Quote issued', {
        actorId: actor.uid,
        quoteId,
        requestId: serviceRequest.id ?? reservation.requestId,
        durationMs: Date.now() - startedAt,
        sizeBytes: generated.bytes.length,
      });
      return {
        quoteId,
        documentId: documentRef.id,
        folio: reservation.folio,
        status: 'issued' as const,
      };
    } catch (error) {
      const code = safeErrorCode(error);
      const rawProviderCode =
        error && typeof error === 'object' && 'code' in error ? error.code : null;
      const providerCode =
        (typeof rawProviderCode === 'string' || typeof rawProviderCode === 'number') &&
        /^[a-z0-9_-]{1,32}$/i.test(String(rawProviderCode))
          ? String(rawProviderCode)
          : null;
      logger.error('Quote issuance failed', {
        actorId: actor.uid,
        quoteId,
        code,
        stage,
        providerCode,
        durationMs: Date.now() - startedAt,
      });
      if (reserved) {
        await Promise.allSettled([
          quoteRef.update({
            status: 'draft',
            documentStatus: 'failed',
            locked: false,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: actor.uid,
          }),
          documentRef.set(
            {
              quoteId,
              type: 'quote_pdf',
              status: 'failed',
              errorCode: code,
              errorMessageSafe: 'No fue posible generar el PDF.',
              updatedAt: FieldValue.serverTimestamp(),
              schemaVersion: 1,
            },
            {merge: true},
          ),
          attemptRef.set(
            {
              status: 'failed',
              errorCode: code,
              updatedAt: FieldValue.serverTimestamp(),
            },
            {merge: true},
          ),
          firestore.collection('auditLogs').add({
            actorId: actor.uid,
            actorRole: actor.role,
            action: 'quote.issue_failed',
            resourceType: 'quote',
            resourceId: quoteId,
            requestId: null,
            quoteId,
            before: null,
            after: {status: 'draft', documentStatus: 'failed'},
            metadata: {code, durationMs: Date.now() - startedAt},
            createdAt: FieldValue.serverTimestamp(),
          }),
        ]);
      }
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        'internal',
        'The PDF could not be generated. The quote remains a draft.',
      );
    }
  },
);

function formatAddress(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const address = value as Record<string, unknown>;
  return [address.street, address.exteriorNumber, address.city, address.state, address.postalCode]
    .filter(Boolean)
    .join(', ');
}

function calculateItemForPdf(item: {
  quantity: number;
  originalUnitPrice: number;
  discountType: 'none' | 'percentage' | 'fixed';
  discountValue: number;
}): {
  discountAmount: number;
  lineSubtotal: number;
} {
  const original = item.quantity * item.originalUnitPrice;
  const discountAmount =
    item.discountType === 'percentage'
      ? (original * item.discountValue) / 100
      : item.discountType === 'fixed'
        ? item.discountValue
        : 0;
  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    lineSubtotal: Math.round((original - discountAmount) * 100) / 100,
  };
}
