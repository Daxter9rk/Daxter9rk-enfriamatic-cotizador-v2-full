import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {buildDomainAuditRecord, domainAuditId} from '../audit/domainEvent';
import {firestore} from '../shared/admin';
import {requireActiveActor, type ActiveActor} from '../shared/auth';
import {calculateItem, calculateQuoteTotals} from '../shared/calculations';
import {invalidArgument} from '../shared/errors';
import {formatFolio} from '../shared/folio';
import {quoteIdSchema, quoteItemSchema} from '../shared/schemas';
import {getNextRevision, getRootQuoteId, isIndependentQuote} from './correctionPolicy';

export const createCorrection = onCall(
  {region: 'us-central1', maxInstances: 5, enforceAppCheck: false},
  async (request) => {
    const actor = await requireActiveActor(request);
    const parsed = quoteIdSchema.safeParse(request.data);
    if (!parsed.success) throw invalidArgument(parsed.error);
    const originalQuoteId = parsed.data.quoteId;
    const idempotencyKey = parsed.data.idempotencyKey ?? firestore.collection('_eventIds').doc().id;

    return firestore.runTransaction(async (transaction) => {
      const originalQuoteRef = firestore.doc(`quotes/${originalQuoteId}`);
      const originalQuoteSnapshot = await transaction.get(originalQuoteRef);
      if (!originalQuoteSnapshot.exists) {
        throw new HttpsError('not-found', 'The original quote does not exist.');
      }
      const originalQuote = originalQuoteSnapshot.data() ?? {};
      const attemptRef = originalQuoteRef.collection('correctionAttempts').doc(idempotencyKey);
      const attemptSnapshot = await transaction.get(attemptRef);
      const previousAttempt = attemptSnapshot.data() ?? {};
      if (previousAttempt.status === 'created' && typeof previousAttempt.quoteId === 'string') {
        return {
          quoteId: previousAttempt.quoteId,
          requestId:
            typeof previousAttempt.requestId === 'string' ? previousAttempt.requestId : null,
          folio: String(previousAttempt.folio ?? ''),
          revisionNumber: Number(previousAttempt.revisionNumber),
          idempotent: true,
        };
      }

      assertCorrectableQuote(originalQuote);
      if (isIndependentQuote(originalQuote)) {
        return createIndependentCorrection(
          transaction,
          originalQuoteId,
          originalQuote,
          attemptRef,
          actor,
          idempotencyKey,
        );
      }
      return createHistoricalCorrection(
        transaction,
        originalQuoteId,
        originalQuote,
        attemptRef,
        actor,
        idempotencyKey,
      );
    });
  },
);

function assertCorrectableQuote(quote: Record<string, any>): void {
  if (!['issued', 'sent', 'accepted', 'rejected'].includes(String(quote.status))) {
    throw new HttpsError('failed-precondition', 'Only emitted commercial quotes can be corrected.');
  }
  if (quote.locked !== true || quote.documentStatus !== 'ready') {
    throw new HttpsError(
      'failed-precondition',
      'Only a locked quote with a ready PDF can be corrected.',
    );
  }
}

async function createIndependentCorrection(
  transaction: FirebaseFirestore.Transaction,
  originalQuoteId: string,
  originalQuote: Record<string, any>,
  attemptRef: FirebaseFirestore.DocumentReference,
  actor: ActiveActor,
  idempotencyKey: string,
) {
  if (originalQuote.siteId != null || originalQuote.equipmentId != null) {
    throw new HttpsError(
      'failed-precondition',
      'Independent quotes cannot contain operational references.',
    );
  }
  if (typeof originalQuote.clientId !== 'string' || !originalQuote.clientId) {
    throw new HttpsError('failed-precondition', 'The original quote has no valid client.');
  }
  if (
    actor.role === 'operator' &&
    originalQuote.assignedTo !== actor.uid &&
    originalQuote.createdBy !== actor.uid
  ) {
    throw new HttpsError(
      'permission-denied',
      'The original quote is not within this operator scope.',
    );
  }
  const clientSnapshot = await transaction.get(firestore.doc(`clients/${originalQuote.clientId}`));
  if (!clientSnapshot.exists)
    throw new HttpsError('failed-precondition', 'The client does not exist.');
  const client = clientSnapshot.data() ?? {};
  if (actor.role === 'operator' && !client.operatorIds?.includes(actor.uid)) {
    throw new HttpsError('permission-denied', 'The operator is not authorized for this client.');
  }

  const rootQuoteId = getRootQuoteId(originalQuoteId, originalQuote);
  const rootQuoteRef = firestore.doc(`quotes/${rootQuoteId}`);
  const rootSnapshot = rootQuoteId === originalQuoteId ? null : await transaction.get(rootQuoteRef);
  const rootQuote = rootSnapshot?.data() ?? originalQuote;
  if (!isIndependentQuote(rootQuote) || rootQuote.siteId != null || rootQuote.equipmentId != null) {
    throw new HttpsError('failed-precondition', 'The correction root is not independent.');
  }

  const sequenceRef = rootQuoteRef.collection('correctionState').doc('sequence');
  const sequenceSnapshot = await transaction.get(sequenceRef);
  let nextRevision = Number(sequenceSnapshot.data()?.nextRevision);
  if (!Number.isSafeInteger(nextRevision) || nextRevision < 1) {
    const existingCorrections = await transaction.get(
      firestore
        .collection('quotes')
        .where('originalQuoteId', '==', rootQuoteId)
        .orderBy('revisionNumber', 'desc')
        .limit(1),
    );
    const latestRevision = existingCorrections.empty
      ? Number(rootQuote.revisionNumber ?? 1)
      : Number(existingCorrections.docs[0]?.data().revisionNumber ?? rootQuote.revisionNumber ?? 1);
    nextRevision = getNextRevision(rootQuote.revisionNumber, latestRevision);
  }

  const itemSnapshot = await transaction.get(
    firestore.collection(`quotes/${originalQuoteId}/items`).orderBy('position').limit(100),
  );
  if (itemSnapshot.empty) {
    throw new HttpsError('failed-precondition', 'At least one quote item is required.');
  }
  const copiedItems = itemSnapshot.docs.map((item) => copyItem(item.data()));
  const taxRate = Number(originalQuote.taxRate ?? 0.16);
  const totals = calculateQuoteTotals(
    copiedItems.map((item) => ({
      quantity: item.quantity,
      originalUnitPrice: item.originalUnitPrice,
      discountType: 'fixed' as const,
      discountValue: item.discountAmount,
      taxable: item.taxable,
    })),
    taxRate,
  );
  const {folio, counterRef, counterValue} = await reserveFolio(transaction, actor.uid);
  const correctionQuoteRef = firestore.collection('quotes').doc();
  const now = FieldValue.serverTimestamp();
  transaction.set(
    counterRef,
    {value: counterValue, year: new Date().getUTCFullYear(), updatedAt: now, updatedBy: actor.uid},
    {merge: true},
  );
  transaction.set(
    sequenceRef,
    {rootQuoteId, nextRevision: nextRevision + 1, updatedAt: now, updatedBy: actor.uid},
    {merge: true},
  );
  transaction.set(correctionQuoteRef, {
    folio,
    requestId: null,
    assignedTo: originalQuote.assignedTo ?? (actor.role === 'operator' ? actor.uid : null),
    clientId: originalQuote.clientId,
    siteId: null,
    equipmentId: null,
    serviceReference: normalizeText(originalQuote.serviceReference),
    technicalContext: normalizeText(originalQuote.technicalContext),
    status: 'draft',
    documentStatus: 'not_generated',
    currency: originalQuote.currency ?? 'MXN',
    taxRate,
    discountDisplayMode: originalQuote.discountDisplayMode ?? 'detailed',
    ...totals,
    notes: normalizeText(originalQuote.notes),
    validityDays: Number(originalQuote.validityDays ?? 15),
    validUntil: null,
    issuedAt: null,
    issuedBy: null,
    originalQuoteId: rootQuoteId,
    revisionNumber: nextRevision,
    locked: false,
    createdAt: now,
    createdBy: actor.uid,
    updatedAt: now,
    updatedBy: actor.uid,
    schemaVersion: 1,
  });
  for (const item of copiedItems) {
    transaction.set(correctionQuoteRef.collection('items').doc(), {
      ...item,
      createdAt: now,
      updatedAt: now,
    });
  }
  const sourceEventId = `${originalQuoteId}:${idempotencyKey}`;
  writeIndependentAudit(
    transaction,
    sourceEventId,
    originalQuoteId,
    correctionQuoteRef.id,
    folio,
    nextRevision,
    actor,
  );
  transaction.set(attemptRef, {
    idempotencyKey,
    status: 'created',
    quoteId: correctionQuoteRef.id,
    requestId: null,
    folio,
    revisionNumber: nextRevision,
    createdAt: now,
    createdBy: actor.uid,
  });
  return {
    quoteId: correctionQuoteRef.id,
    requestId: null,
    folio,
    revisionNumber: nextRevision,
    idempotent: false,
  };
}

async function createHistoricalCorrection(
  transaction: FirebaseFirestore.Transaction,
  originalQuoteId: string,
  originalQuote: Record<string, any>,
  attemptRef: FirebaseFirestore.DocumentReference,
  actor: ActiveActor,
  idempotencyKey: string,
) {
  const originalRequestRef = firestore.doc(`requests/${String(originalQuote.requestId)}`);
  const originalRequestSnapshot = await transaction.get(originalRequestRef);
  if (!originalRequestSnapshot.exists)
    throw new HttpsError('failed-precondition', 'The original request does not exist.');
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
  const {folio, counterRef, counterValue} = await reserveFolio(transaction, actor.uid);
  const correctionRequestRef = firestore.collection('requests').doc();
  const correctionQuoteRef = firestore.collection('quotes').doc();
  const now = FieldValue.serverTimestamp();
  transaction.set(
    counterRef,
    {value: counterValue, year: new Date().getUTCFullYear(), updatedAt: now, updatedBy: actor.uid},
    {merge: true},
  );
  transaction.set(correctionRequestRef, {
    clientId: originalRequest.clientId,
    siteId: originalRequest.siteId,
    equipmentId: originalRequest.equipmentId ?? null,
    scope: originalRequest.equipmentId ? 'equipment' : 'site',
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
  transaction.set(attemptRef, {
    idempotencyKey,
    status: 'created',
    quoteId: correctionQuoteRef.id,
    requestId: correctionRequestRef.id,
    folio,
    revisionNumber: Number(originalQuote.revisionNumber ?? 1) + 1,
    createdAt: now,
    createdBy: actor.uid,
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
    metadata: {idempotencyKey},
    createdAt: now,
  });
  return {
    requestId: correctionRequestRef.id,
    quoteId: correctionQuoteRef.id,
    folio,
    revisionNumber: Number(originalQuote.revisionNumber ?? 1) + 1,
    idempotent: false,
  };
}

async function reserveFolio(transaction: FirebaseFirestore.Transaction, actorId: string) {
  const year = new Date().getUTCFullYear();
  const defaultsSnapshot = await transaction.get(firestore.doc('settings/quoteDefaults'));
  const prefixValue = defaultsSnapshot.data()?.folioPrefix;
  const prefix =
    typeof prefixValue === 'string' && /^[A-Z0-9-]{1,12}$/.test(prefixValue) ? prefixValue : 'COT';
  const counterRef = firestore.doc(`counters/quotes-${year}`);
  const counterSnapshot = await transaction.get(counterRef);
  const counterValue = Number(counterSnapshot.data()?.value ?? 0) + 1;
  if (!Number.isSafeInteger(counterValue) || counterValue > 999999)
    throw new HttpsError('resource-exhausted', 'The annual folio counter is exhausted.');
  return {folio: formatFolio(prefix, year, counterValue), counterRef, counterValue, actorId};
}

function copyItem(item: Record<string, any>) {
  const parsed = quoteItemSchema.safeParse(item);
  if (!parsed.success)
    throw new HttpsError('failed-precondition', 'The quote contains an invalid item.');
  const calculated = calculateItem(parsed.data);
  return {
    position: parsed.data.position,
    catalogItemId: item.catalogItemId ?? null,
    catalogCode: item.catalogCode ?? null,
    catalogType: item.catalogType ?? null,
    catalogSnapshot: item.catalogSnapshot ?? null,
    quantity: parsed.data.quantity,
    unit: parsed.data.unit,
    equipmentOrService: parsed.data.equipmentOrService ?? null,
    brand: parsed.data.brand ?? null,
    model: parsed.data.model ?? null,
    description: parsed.data.description,
    originalUnitPrice: parsed.data.originalUnitPrice,
    discountType: parsed.data.discountType,
    discountValue: parsed.data.discountValue,
    ...calculated,
    taxable: parsed.data.taxable,
  };
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function writeIndependentAudit(
  transaction: FirebaseFirestore.Transaction,
  sourceEventId: string,
  originalQuoteId: string,
  newQuoteId: string,
  folio: string,
  revisionNumber: number,
  actor: ActiveActor,
): void {
  const now = FieldValue.serverTimestamp();
  transaction.set(
    firestore
      .collection('auditLogs')
      .doc(domainAuditId(sourceEventId, 'quote.correction_requested')),
    buildDomainAuditRecord({
      sourceEventId,
      eventCode: 'quote.correction_requested',
      actorUid: actor.uid,
      actorDisplayNameSnapshot: actor.displayName || actor.email,
      actorRoleSnapshot: actor.role,
      resourceType: 'quote',
      resourceId: originalQuoteId,
      resourceLabelSnapshot: originalQuoteId,
      requestId: null,
      quoteId: originalQuoteId,
      result: 'success',
      after: {newQuoteId, revisionNumber},
      occurredAt: now,
    }),
  );
  transaction.set(
    firestore.collection('auditLogs').doc(domainAuditId(sourceEventId, 'quote.correction_created')),
    buildDomainAuditRecord({
      sourceEventId,
      eventCode: 'quote.correction_created',
      actorUid: actor.uid,
      actorDisplayNameSnapshot: actor.displayName || actor.email,
      actorRoleSnapshot: actor.role,
      resourceType: 'quote',
      resourceId: newQuoteId,
      resourceLabelSnapshot: folio,
      requestId: null,
      quoteId: newQuoteId,
      result: 'success',
      before: {originalQuoteId},
      after: {originalQuoteId, revisionNumber},
      occurredAt: now,
    }),
  );
}
