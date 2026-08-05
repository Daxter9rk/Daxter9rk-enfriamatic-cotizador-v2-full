import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {firestore} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';
import {invalidArgument} from '../shared/errors';
import {assignRequestSchema} from '../shared/schemas';

export const assignRequest = onCall(
  {region: 'us-central1', maxInstances: 10, enforceAppCheck: false},
  async (request) => {
    const actor = await requireActiveActor(request, ['admin']);
    const parsed = assignRequestSchema.safeParse(request.data);
    if (!parsed.success) throw invalidArgument(parsed.error);
    const {requestId, assignedTo, note} = parsed.data;
    const requestRef = firestore.doc(`requests/${requestId}`);
    const assigneeRef = firestore.doc(`users/${assignedTo}`);
    return firestore.runTransaction(async (transaction) => {
      const [requestSnapshot, assignee] = await Promise.all([
        transaction.get(requestRef),
        transaction.get(assigneeRef),
      ]);
      if (!requestSnapshot.exists) throw new HttpsError('not-found', 'The request does not exist.');
      const data = requestSnapshot.data() ?? {};
      if (!['pending', 'assigned', 'in_progress'].includes(String(data.status))) {
        throw new HttpsError('failed-precondition', 'This request can no longer be assigned.');
      }
      if (
        !assignee.exists ||
        assignee.data()?.status !== 'active' ||
        !['admin', 'operator'].includes(assignee.data()?.role)
      ) {
        throw new HttpsError('failed-precondition', 'The assignee is not active or authorized.');
      }
      const now = FieldValue.serverTimestamp();
      transaction.update(requestRef, {
        assignedTo,
        assignedAt: now,
        status: data.status === 'pending' ? 'assigned' : data.status,
        assignmentHistory: FieldValue.arrayUnion({
          assignedTo,
          assignedBy: actor.uid,
          assignedAt: new Date(),
          note: note ?? null,
        }),
        updatedAt: now,
        updatedBy: actor.uid,
      });
      return {requestId, assignedTo};
    });
  },
);
