import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {firestore} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';
import {invalidArgument} from '../shared/errors';
import {transitionRequestSchema} from '../shared/schemas';
import {canTransitionRequest, type RequestStatus} from './requestPolicy';

export const transitionRequest = onCall(
  {region: 'us-central1', maxInstances: 10, enforceAppCheck: false},
  async (request) => {
    const actor = await requireActiveActor(request);
    const parsed = transitionRequestSchema.safeParse(request.data);
    if (!parsed.success) throw invalidArgument(parsed.error);
    const {requestId, to, reason, finalNote} = parsed.data;
    const requestRef = firestore.doc(`requests/${requestId}`);
    let admins: FirebaseFirestore.QuerySnapshot | null = null;
    if (to === 'completed') {
      admins = await firestore
        .collection('users')
        .where('role', '==', 'admin')
        .where('status', '==', 'active')
        .limit(50)
        .get();
    }

    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists) throw new HttpsError('not-found', 'The request does not exist.');
      const data = snapshot.data() ?? {};
      const from = data.status as RequestStatus;
      const isReopen = from === 'completed' && to === 'in_progress';
      if (
        !canTransitionRequest(from, to, actor.role, data.assignedTo === actor.uid, Boolean(reason))
      ) {
        throw new HttpsError('failed-precondition', 'This request transition is not allowed.');
      }
      const now = FieldValue.serverTimestamp();
      transaction.update(requestRef, {
        status: to,
        completedAt: to === 'completed' ? now : null,
        finalNote: to === 'completed' ? (finalNote ?? null) : (data.finalNote ?? null),
        ...(isReopen ? {reopenedAt: now, reopenReason: reason, reopenedBy: actor.uid} : {}),
        ...(to === 'cancelled' ? {cancellationReason: reason} : {}),
        updatedAt: now,
        updatedBy: actor.uid,
      });
      const recipients = new Set<string>();
      if (to === 'completed') admins?.docs.forEach((item) => recipients.add(item.id));
      if (isReopen && typeof data.assignedTo === 'string') recipients.add(data.assignedTo);
      recipients.delete(actor.uid);
      for (const userId of recipients) {
        transaction.set(firestore.collection('notifications').doc(), {
          userId,
          type: isReopen ? 'request_reopened' : 'request_completed',
          title: isReopen ? 'Solicitud reabierta' : 'Solicitud completada',
          message: String(data.title ?? 'Consulta el detalle de la solicitud.'),
          resourceType: 'request',
          resourceId: requestId,
          read: false,
          readAt: null,
          createdAt: now,
        });
      }
      return {requestId, from, to};
    });
  },
);
