import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {firestore} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';
import {invalidArgument} from '../shared/errors';
import {formatFolio} from '../shared/folio';
import {quoteIdSchema} from '../shared/schemas';

export const createCorrection = onCall(
  {
    region: 'us-central1',
    maxInstances: 5,
    enforceAppCheck: false,
  },
  async (request) => {
    const actor = await requireActiveActor(request);
    const parsed = quoteIdSchema.safeParse(request.data);
    if (!parsed.success) throw invalidArgument(parsed.error);
    const originalQuoteId = parsed.data.quoteId;

    return firestore.runTransaction(async (transaction) => {
      const originalQuoteRef = firestore.doc(`quotes/${originalQuoteId}`);
      const originalQuoteSnapshot = await transaction.get(originalQuoteRef);
      if (!originalQuoteSnapshot.exists) {
        throw new HttpsError('not-found', 'The original quote does not exist.');
      }
      const originalQuote = originalQuoteSnapshot.data() ?? {};
      if (!['issued', 'sent', 'accepted', 'rejected'].includes(String(originalQuote.status))) {
        throw new HttpsError(
          'failed-precondition',
          'Only emitted commercial quotes can be corrected.',
        );
      }
      const originalRequestRef = firestore.doc(`requests/${String(originalQuote.requestId)}`);
      const originalRequestSnapshot = await transaction.get(originalRequestRef);
      if (!originalRequestSnapshot.exists) {
        throw new HttpsError('failed-precondition', 'The original request does not exist.');
      }
      const originalRequest = originalRequestSnapshot.data() ?? {};
      if (
        originalQuote.clientId !== originalRequest.clientId ||
        originalQuote.siteId !== originalRequest.siteId ||
        (originalQuote.equipmentId ?? null) !== (originalRequest.equipmentId ?? null)
      ) {
        throw new HttpsError(
          'failed-precondition',
          'The original quote does not match its related request.',
        );
      }
      if (
        actor.role === 'operator' &&
        (originalQuote.assignedTo !== actor.uid || originalRequest.assignedTo !== actor.uid)
      ) {
        throw new HttpsError(
          'permission-denied',
          'The original quote is not assigned to this operator.',
        );
      }

      const year = new Date().getUTCFullYear();
      const defaultsSnapshot = await transaction.get(firestore.doc('settings/quoteDefaults'));
      const prefixValue = defaultsSnapshot.data()?.folioPrefix;
      const prefix =
        typeof prefixValue === 'string' && /^[A-Z0-9-]{1,12}$/.test(prefixValue)
          ? prefixValue
          : 'COT';
      const counterRef = firestore.doc(`counters/quotes-${year}`);
      const counterSnapshot = await transaction.get(counterRef);
      const next = Number(counterSnapshot.data()?.value ?? 0) + 1;
      if (!Number.isSafeInteger(next) || next > 999999) {
        throw new HttpsError('resource-exhausted', 'The annual folio counter is exhausted.');
      }
      const folio = formatFolio(prefix, year, next);
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

      const correctionRequestRef = firestore.collection('requests').doc();
      const correctionQuoteRef = firestore.collection('quotes').doc();
      const now = FieldValue.serverTimestamp();
      transaction.set(correctionRequestRef, {
        clientId: originalRequest.clientId,
        siteId: originalRequest.siteId,
        equipmentId: originalRequest.equipmentId ?? null,
        title: `Corrección de ${String(originalQuote.folio)}`,
        description: `Solicitud de corrección relacionada con ${String(originalQuote.folio)}.`,
        priority: originalRequest.priority ?? 'normal',
        status: originalRequest.assignedTo ? 'assigned' : 'pending',
        assignedTo: originalRequest.assignedTo ?? null,
        assignedAt: originalRequest.assignedTo ? now : null,
        completedAt: null,
        correctionOfRequestId: originalRequestRef.id,
        correctionOfQuoteId: originalQuoteId,
        createdAt: now,
        createdBy: actor.uid,
        updatedAt: now,
        updatedBy: actor.uid,
        schemaVersion: 1,
      });
      transaction.set(correctionQuoteRef, {
        folio,
        requestId: correctionRequestRef.id,
        assignedTo: originalRequest.assignedTo ?? null,
        clientId: originalQuote.clientId,
        siteId: originalQuote.siteId,
        equipmentId: originalQuote.equipmentId ?? null,
        status: 'draft',
        documentStatus: 'not_generated',
        currency: 'MXN',
        taxRate: originalQuote.taxRate ?? 0.16,
        discountDisplayMode: originalQuote.discountDisplayMode ?? 'detailed',
        subtotalOriginal: 0,
        discountTotal: 0,
        subtotalFinal: 0,
        taxTotal: 0,
        grandTotal: 0,
        notes: '',
        validityDays: originalQuote.validityDays ?? 15,
        validUntil: null,
        issuedAt: null,
        issuedBy: null,
        originalQuoteId,
        revisionNumber: Number(originalQuote.revisionNumber ?? 1) + 1,
        locked: false,
        createdAt: now,
        createdBy: actor.uid,
        updatedAt: now,
        updatedBy: actor.uid,
        schemaVersion: 1,
      });
      transaction.set(firestore.collection('auditLogs').doc(), {
        actorId: actor.uid,
        actorRole: actor.role,
        action: 'quote.correction_created',
        resourceType: 'quote',
        resourceId: correctionQuoteRef.id,
        requestId: correctionRequestRef.id,
        quoteId: correctionQuoteRef.id,
        before: {originalQuoteId},
        after: {folio, revisionNumber: Number(originalQuote.revisionNumber ?? 1) + 1},
        metadata: {},
        createdAt: now,
      });
      if (originalRequest.assignedTo) {
        transaction.set(firestore.collection('notifications').doc(), {
          userId: originalRequest.assignedTo,
          type: 'correction_created',
          title: `Corrección ${folio} creada`,
          message: `Se creó una corrección de ${String(originalQuote.folio)}.`,
          resourceType: 'quote',
          resourceId: correctionQuoteRef.id,
          read: false,
          readAt: null,
          createdAt: now,
        });
      }

      return {
        requestId: correctionRequestRef.id,
        quoteId: correctionQuoteRef.id,
        folio,
      };
    });
  },
);
