import {FieldValue} from 'firebase-admin/firestore';
import {logger} from 'firebase-functions';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {adminAuth, firestore} from '../shared/admin';
import {requireActiveActor, requireRecentAuthentication} from '../shared/auth';
import {invalidArgument} from '../shared/errors';
import {updateUserSchema} from '../shared/schemas';
import {evaluateUserMutation, userPolicyMessage} from './userPolicy';

export const updateUser = onCall(
  {
    region: 'us-central1',
    maxInstances: 5,
    enforceAppCheck: false,
  },
  async (request) => {
    const actor = await requireActiveActor(request, ['admin']);
    const parsed = updateUserSchema.safeParse(request.data);
    if (!parsed.success) throw invalidArgument(parsed.error);
    const input = parsed.data;

    const profileRef = firestore.doc(`users/${input.uid}`);
    const activeAdminsQuery = firestore
      .collection('users')
      .where('role', '==', 'admin')
      .where('status', '==', 'active')
      .limit(100);
    const result = await firestore.runTransaction(async (transaction) => {
      const [snapshot, activeAdmins] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(activeAdminsQuery),
      ]);
      if (!snapshot.exists) {
        throw new HttpsError('not-found', 'The user profile does not exist.');
      }
      const before = snapshot.data() ?? {};
      const failure = evaluateUserMutation(
        actor,
        {
          uid: input.uid,
          role: before.role,
          status: String(before.status ?? ''),
          isPrimaryAdmin: before.isPrimaryAdmin === true,
        },
        {role: input.role, status: input.status},
        activeAdmins.size,
      );
      if (failure) {
        throw new HttpsError('failed-precondition', userPolicyMessage(failure), {reason: failure});
      }
      const sensitiveChange = before.role !== input.role || before.status !== input.status;
      if (sensitiveChange) requireRecentAuthentication(request);

      const now = FieldValue.serverTimestamp();
      transaction.update(profileRef, {
        displayName: input.displayName,
        role: input.role,
        status: input.status,
        updatedAt: now,
        updatedBy: actor.uid,
      });
      transaction.set(firestore.collection('auditLogs').doc(), {
        actorId: actor.uid,
        actorRole: actor.role,
        action: before.role !== input.role ? 'user.role_changed' : 'user.updated',
        resourceType: 'user',
        resourceId: input.uid,
        requestId: null,
        quoteId: null,
        before: {
          displayName: before.displayName,
          role: before.role,
          status: before.status,
        },
        after: {
          displayName: input.displayName,
          role: input.role,
          status: input.status,
        },
        metadata: {sensitiveChange},
        createdAt: now,
      });
      return {before, sensitiveChange};
    });

    try {
      await adminAuth.updateUser(input.uid, {
        displayName: input.displayName,
        // Firestore profile status remains the authorization source so blocked
        // accounts receive an explicit explanation in the application.
        disabled: false,
      });
    } catch (error) {
      logger.warn('Auth display name synchronization failed', {uid: input.uid, error});
    }

    return {uid: input.uid, sensitiveChange: result.sensitiveChange};
  },
);
