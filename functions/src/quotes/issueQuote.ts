import {createHash} from 'node:crypto';
import {FieldValue, Timestamp} from 'firebase-admin/firestore';
import {logger} from 'firebase-functions';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {buildQuoteDocumentModel, type QuoteDocumentItem} from '../documents/quoteDocumentModel';
import {generateQuotePdf} from '../documents/pdf';
import {firestore, storage} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';
import {calculateItem, calculateQuoteTotals} from '../shared/calculations';
import {invalidArgument, safeErrorCode} from '../shared/errors';
import {formatFolio} from '../shared/folio';
import {issueQuoteSchema, quoteItemSchema} from '../shared/schemas';

interface Reservation {
  kind: 'reserved' | 'ready';
  folio: string;
  documentId: string;
  requestId: string | null;
  generationAttempt: number;
}

interface PreparedQuote {
  quote: Record<string, unknown>;
  client: Record<string, unknown>;
  company: Record<string, unknown>;
  defaults: Record<string, unknown>;
  request: Record<string, unknown> | null;
  site: Record<string, unknown> | null;
  equipment: Record<string, unknown> | null;
  items: QuoteDocumentItem[];
  totals: ReturnType<typeof calculateQuoteTotals>;
  admins: FirebaseFirestore.QuerySnapshot;
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
    let stage = 'validate';
    let storagePath: string | null = null;

    try {
      const prepared = await prepareQuote(quoteId, actor.uid, actor.role);
      stage = 'reserve';
      const reservation = await firestore.runTransaction<Reservation>(async (transaction) => {
        const [quoteSnapshot, attemptSnapshot, documentSnapshot] = await Promise.all([
          transaction.get(quoteRef),
          transaction.get(attemptRef),
          transaction.get(documentRef),
        ]);
        if (!quoteSnapshot.exists) throw new HttpsError('not-found', 'The quote does not exist.');
        const quote = quoteSnapshot.data() ?? {};
        const attempt = attemptSnapshot.data() ?? {};
        if (attempt.status === 'ready' && quote.status === 'issued') {
          return {
            kind: 'ready',
            folio: String(attempt.folio ?? quote.folio),
            documentId: documentRef.id,
            requestId: asNullableString(quote.requestId),
            generationAttempt: Number(documentSnapshot.data()?.generationAttempt ?? 1),
          };
        }
        if (quote.status === 'issued' && quote.documentStatus === 'ready') {
          return {
            kind: 'ready',
            folio: String(quote.folio),
            documentId: documentRef.id,
            requestId: asNullableString(quote.requestId),
            generationAttempt: Number(documentSnapshot.data()?.generationAttempt ?? 1),
          };
        }
        if (quote.status !== 'draft' || quote.locked === true) {
          throw new HttpsError('failed-precondition', 'Only unlocked drafts can be issued.');
        }
        if (quote.documentStatus === 'generating' || attempt.status === 'processing') {
          throw new HttpsError('already-exists', 'A generation attempt is already in progress.');
        }

        const year = new Date().getUTCFullYear();
        const prefixValue = prepared.defaults.folioPrefix;
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
            {value: next, year, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid},
            {merge: true},
          );
          folio = formatFolio(prefix, year, next);
        }
        const generationAttempt = Number(documentSnapshot.data()?.generationAttempt ?? 0) + 1;
        transaction.set(
          attemptRef,
          {
            idempotencyKey,
            status: 'processing',
            actorId: actor.uid,
            folio,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          {merge: true},
        );
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
            generationAttempt,
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
          requestId: asNullableString(quote.requestId),
          generationAttempt,
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
      stage = 'document-model';
      const issuedAt = new Date();
      const model = buildQuoteDocumentModel({
        quoteId,
        folio: reservation.folio,
        issuedAt,
        issuedBy: actor.uid,
        actorRole: actor.role,
        generationAttempt: reservation.generationAttempt,
        quote: prepared.quote,
        client: prepared.client,
        company: prepared.company,
        defaults: prepared.defaults,
        items: prepared.items,
        totals: prepared.totals,
        request: prepared.request,
        site: prepared.site
          ? {...prepared.site, address: formatAddress(prepared.site.address)}
          : null,
        equipment: prepared.equipment,
      });

      stage = 'generate-pdf';
      const generated = await generateQuotePdf(model);
      assertPdf(generated.bytes);
      const hash = createHash('sha256').update(generated.bytes).digest('hex');
      storagePath = `quotes/${quoteId}/documents/${documentRef.id}.pdf`;
      stage = 'save-storage';
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
        const validUntil = new Date(
          issuedAt.getTime() + model.identity.validityDays * 24 * 60 * 60 * 1000,
        );
        transaction.update(quoteRef, {
          ...prepared.totals,
          status: 'issued',
          documentStatus: 'ready',
          locked: true,
          issuedAt: FieldValue.serverTimestamp(),
          issuedBy: actor.uid,
          validUntil: Timestamp.fromDate(validUntil),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actor.uid,
        });
        transaction.set(
          documentRef,
          {
            quoteId,
            type: 'quote_pdf',
            status: 'ready',
            modality: model.mode,
            storagePath,
            fileName: `${reservation.folio}.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: generated.bytes.length,
            sha256: hash,
            pageCount: generated.pageCount,
            generationAttempt: reservation.generationAttempt,
            generatedAt: FieldValue.serverTimestamp(),
            generatedBy: actor.uid,
            clientSnapshot: model.client,
            companySnapshot: model.company,
            operationalContext: model.operationalContext,
            identitySnapshot: model.identity,
            itemsSnapshot: model.items,
            totalsSnapshot: model.totals,
            termsSnapshot: model.terms,
            documentModelVersion: 1,
            errorCode: null,
            errorMessageSafe: null,
            updatedAt: FieldValue.serverTimestamp(),
            schemaVersion: 1,
          },
          {merge: true},
        );
        transaction.set(
          attemptRef,
          {status: 'ready', updatedAt: FieldValue.serverTimestamp(), documentId: documentRef.id},
          {merge: true},
        );
        transaction.set(firestore.collection('auditLogs').doc(), {
          actorId: actor.uid,
          actorRole: actor.role,
          action: 'quote.issued',
          resourceType: 'quote',
          resourceId: quoteId,
          requestId: model.operationalContext.requestId,
          quoteId,
          before: {status: 'draft', documentStatus: 'generating'},
          after: {
            status: 'issued',
            documentStatus: 'ready',
            folio: reservation.folio,
            grandTotal: prepared.totals.grandTotal,
          },
          metadata: {
            modality: model.mode,
            documentId: documentRef.id,
            generationAttempt: reservation.generationAttempt,
            durationMs: Date.now() - startedAt,
            sizeBytes: generated.bytes.length,
            sha256: hash,
          },
          createdAt: FieldValue.serverTimestamp(),
        });
        for (const admin of prepared.admins.docs) {
          transaction.set(firestore.collection('notifications').doc(), {
            userId: admin.id,
            type: 'quote_issued',
            title: `Cotización ${reservation.folio} emitida`,
            message: `${actor.displayName} emitió una cotización por ${prepared.totals.grandTotal.toFixed(2)} MXN.`,
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
        requestId: reservation.requestId,
        modality: model.mode,
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
      logger.error('Quote issuance failed', {
        actorId: actor.uid,
        quoteId,
        code,
        stage,
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
      if (reserved) {
        const cleanup = storagePath
          ? storage.bucket().file(storagePath).delete({ignoreNotFound: true})
          : Promise.resolve();
        await Promise.allSettled([
          cleanup,
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
            {status: 'failed', errorCode: code, updatedAt: FieldValue.serverTimestamp()},
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
            metadata: {code, stage, durationMs: Date.now() - startedAt},
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

async function prepareQuote(
  quoteId: string,
  actorId: string,
  role: 'admin' | 'operator',
): Promise<PreparedQuote> {
  const quoteSnapshot = await firestore.doc(`quotes/${quoteId}`).get();
  if (!quoteSnapshot.exists) throw new HttpsError('not-found', 'The quote does not exist.');
  const quote = quoteSnapshot.data() ?? {};
  if (quote.status !== 'draft' || quote.locked === true) {
    throw new HttpsError('failed-precondition', 'Only unlocked drafts can be issued.');
  }
  const requestId = asNullableString(quote.requestId);
  if (role === 'operator' && requestId && quote.assignedTo !== actorId) {
    throw new HttpsError('permission-denied', 'The quote is not assigned to this operator.');
  }
  if (!requestId && (quote.siteId != null || quote.equipmentId != null)) {
    throw new HttpsError(
      'failed-precondition',
      'Independent quotes cannot contain operational references.',
    );
  }
  const [clientSnapshot, defaultsSnapshot, companySnapshot, itemSnapshots, admins] =
    await Promise.all([
      firestore.doc(`clients/${String(quote.clientId)}`).get(),
      firestore.doc('settings/quoteDefaults').get(),
      firestore.doc('settings/companyProfile').get(),
      firestore.collection(`quotes/${quoteId}/items`).orderBy('position').limit(100).get(),
      firestore
        .collection('users')
        .where('role', '==', 'admin')
        .where('status', '==', 'active')
        .limit(50)
        .get(),
    ]);
  if (!clientSnapshot.exists)
    throw new HttpsError('failed-precondition', 'The client does not exist.');
  const client = clientSnapshot.data() ?? {};
  if (role === 'operator' && !Array.isArray(client.operatorIds)) {
    throw new HttpsError('permission-denied', 'The operator is not authorized for this client.');
  }
  if (role === 'operator' && !(client.operatorIds as unknown[]).includes(actorId)) {
    throw new HttpsError('permission-denied', 'The operator is not authorized for this client.');
  }
  if (!companySnapshot.exists)
    throw new HttpsError('failed-precondition', 'Company settings are incomplete.');
  const defaults = defaultsSnapshot.data() ?? {};
  const company = companySnapshot.data() ?? {};
  if (!company.companyName)
    throw new HttpsError('failed-precondition', 'Company settings are incomplete.');
  if (itemSnapshots.empty)
    throw new HttpsError('failed-precondition', 'At least one quote item is required.');
  const items = itemSnapshots.docs.map((snapshot) => {
    const parsed = quoteItemSchema.safeParse(snapshot.data());
    if (!parsed.success)
      throw new HttpsError('failed-precondition', 'The quote contains an invalid item.');
    const calculated = calculateItem(parsed.data);
    return {
      position: parsed.data.position,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      description: parsed.data.description,
      brand: parsed.data.brand ?? null,
      model: parsed.data.model ?? null,
      originalUnitPrice: parsed.data.originalUnitPrice,
      discountAmount: calculated.discountAmount,
      lineSubtotal: calculated.lineSubtotal,
      taxable: parsed.data.taxable,
    };
  });
  const taxRate = Number(quote.taxRate ?? defaults.taxRate ?? 0.16);
  const globalDiscountType =
    quote.globalDiscountType === 'percentage' || quote.globalDiscountType === 'fixed'
      ? quote.globalDiscountType
      : 'none';
  const globalDiscountValue = Number(quote.globalDiscountValue ?? 0);
  const applyTax = typeof quote.applyTax === 'boolean' ? quote.applyTax : true;
  const totals = calculateQuoteTotals(
    items.map((item) => {
      const original = item.originalUnitPrice;
      return {
        quantity: item.quantity,
        originalUnitPrice: original,
        discountType: 'fixed' as const,
        discountValue: item.discountAmount,
        taxable: item.taxable,
      };
    }),
    taxRate,
    {type: globalDiscountType, value: globalDiscountValue},
    applyTax,
  );
  const request = requestId ? await firestore.doc(`requests/${requestId}`).get() : null;
  const requestData = request?.exists ? (request.data() ?? {}) : null;
  if (requestId && !requestData)
    throw new HttpsError('failed-precondition', 'The related request does not exist.');
  let siteData: Record<string, unknown> | null = null;
  let equipmentData: Record<string, unknown> | null = null;
  if (requestId) {
    if (
      quote.clientId !== requestData?.clientId ||
      quote.siteId !== requestData?.siteId ||
      (quote.equipmentId ?? null) !== (requestData?.equipmentId ?? null)
    )
      throw new HttpsError('failed-precondition', 'The quote does not match its related request.');
    if (
      role === 'operator' &&
      (quote.assignedTo !== actorId || requestData?.assignedTo !== actorId)
    ) {
      throw new HttpsError('permission-denied', 'The quote is not assigned to this operator.');
    }
    const site = await firestore.doc(`sites/${String(quote.siteId)}`).get();
    if (!site.exists)
      throw new HttpsError('failed-precondition', 'The related site does not exist.');
    siteData = site.data() ?? {};
    if (quote.equipmentId) {
      const equipment = await firestore.doc(`equipment/${String(quote.equipmentId)}`).get();
      if (!equipment.exists)
        throw new HttpsError('failed-precondition', 'The related equipment does not exist.');
      equipmentData = equipment.data() ?? {};
    }
  } else if (role === 'operator' && quote.assignedTo != null && quote.assignedTo !== actorId) {
    throw new HttpsError('permission-denied', 'The quote is not assigned to this operator.');
  }
  return {
    quote,
    client,
    company,
    defaults,
    request: requestData,
    site: siteData,
    equipment: equipmentData,
    items,
    totals,
    admins,
  };
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function formatAddress(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const address = value as Record<string, unknown>;
  return [address.street, address.exteriorNumber, address.city, address.state, address.postalCode]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(', ');
}

function assertPdf(bytes: Buffer): void {
  if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('invalid-pdf-signature');
  }
  if (bytes.length > 12 * 1024 * 1024) throw new Error('pdf-too-large');
}
