import {FieldValue} from 'firebase-admin/firestore';
import {logger} from 'firebase-functions';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {firestore} from '../shared/admin';

const AUDITED_COLLECTIONS = new Set([
  'clients',
  'sites',
  'equipment',
  'requests',
  'quotes',
  'catalogs',
  'settings',
]);

const SAFE_FIELDS = [
  'name',
  'title',
  'status',
  'priority',
  'assignedTo',
  'role',
  'folio',
  'documentStatus',
  'locked',
  'grandTotal',
  'updatedBy',
];

function summary(value: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!value) return null;
  return Object.fromEntries(
    SAFE_FIELDS.filter((field) => field in value).map((field) => [field, value[field]]),
  );
}

export const auditDomainWrite = onDocumentWritten(
  {
    document: '{collectionId}/{documentId}',
    region: 'us-central1',
    maxInstances: 10,
  },
  async (event) => {
    const collectionId = String(event.params.collectionId);
    if (!AUDITED_COLLECTIONS.has(collectionId)) return;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const actorId = String(
      after?.updatedBy ?? after?.createdBy ?? before?.updatedBy ?? before?.createdBy ?? '',
    );
    if (!actorId) return;
    const actorSnapshot = await firestore.doc(`users/${actorId}`).get();
    const actorRole = actorSnapshot.data()?.role;
    if (actorRole !== 'admin' && actorRole !== 'operator') {
      logger.warn('Audit event skipped due to unknown actor', {
        collectionId,
        documentId: event.params.documentId,
      });
      return;
    }
    const action = !before
      ? `${collectionId}.created`
      : !after
        ? `${collectionId}.deleted`
        : `${collectionId}.updated`;
    await firestore.collection('auditLogs').add({
      actorId,
      actorRole,
      action,
      resourceType: collectionId,
      resourceId: event.params.documentId,
      requestId: after?.requestId ?? before?.requestId ?? null,
      quoteId:
        collectionId === 'quotes'
          ? event.params.documentId
          : (after?.quoteId ?? before?.quoteId ?? null),
      before: summary(before),
      after: summary(after),
      metadata: {source: 'firestore-trigger'},
      createdAt: FieldValue.serverTimestamp(),
    });

    if (
      collectionId === 'requests' &&
      after &&
      after.assignedTo &&
      after.assignedTo !== before?.assignedTo
    ) {
      const operatorId = String(after.assignedTo);
      const masterRefs = [
        after.clientId ? firestore.doc(`clients/${String(after.clientId)}`) : null,
        after.siteId ? firestore.doc(`sites/${String(after.siteId)}`) : null,
        after.equipmentId ? firestore.doc(`equipment/${String(after.equipmentId)}`) : null,
      ].filter((reference) => reference !== null);
      await Promise.all(
        masterRefs.map((reference) =>
          reference.set(
            {
              operatorIds: FieldValue.arrayUnion(operatorId),
            },
            {merge: true},
          ),
        ),
      );
      await firestore.collection('notifications').add({
        userId: after.assignedTo,
        type: before?.assignedTo ? 'request_reassigned' : 'request_assigned',
        title: before?.assignedTo ? 'Solicitud reasignada' : 'Nueva solicitud asignada',
        message: String(after.title ?? 'Tienes una solicitud asignada.'),
        resourceType: 'request',
        resourceId: event.params.documentId,
        read: false,
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  },
);
