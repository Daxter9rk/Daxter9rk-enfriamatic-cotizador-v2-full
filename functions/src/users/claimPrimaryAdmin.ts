import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {firestore} from '../shared/admin';
import {requireActiveActor, requireRecentAuthentication} from '../shared/auth';

export const claimPrimaryAdmin = onCall(
  {region: 'us-central1', maxInstances: 1, enforceAppCheck: false},
  async (request) => {
    const actor = await requireActiveActor(request, ['admin']);
    requireRecentAuthentication(request);
    const adminsQuery = firestore.collection('users').where('role', '==', 'admin').limit(100);
    const profileRef = firestore.doc(`users/${actor.uid}`);
    const claimed = await firestore.runTransaction(async (transaction) => {
      const [profile, admins] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(adminsQuery),
      ]);
      if (
        !profile.exists ||
        profile.data()?.role !== 'admin' ||
        profile.data()?.status !== 'active'
      ) {
        throw new HttpsError('failed-precondition', 'The administrator profile changed.');
      }
      const primary = admins.docs.filter((item) => item.data().isPrimaryAdmin === true);
      if (primary.length === 1 && primary[0]?.id === actor.uid) return false;
      if (primary.length > 0) {
        throw new HttpsError('already-exists', 'A primary administrator already exists.');
      }
      const activeAdmins = admins.docs.filter((item) => item.data().status === 'active');
      if (activeAdmins.length !== 1 || activeAdmins[0]?.id !== actor.uid) {
        throw new HttpsError(
          'failed-precondition',
          'Primary administrator bootstrap requires exactly one active administrator.',
        );
      }
      const now = FieldValue.serverTimestamp();
      transaction.update(profileRef, {
        isPrimaryAdmin: true,
        updatedAt: now,
        updatedBy: actor.uid,
      });
      transaction.set(firestore.collection('auditLogs').doc(), {
        actorId: actor.uid,
        actorRole: actor.role,
        action: 'user.primary_admin_claimed',
        resourceType: 'user',
        resourceId: actor.uid,
        requestId: null,
        quoteId: null,
        before: {isPrimaryAdmin: false},
        after: {isPrimaryAdmin: true},
        metadata: {bootstrap: true},
        createdAt: now,
      });
      return true;
    });
    return {uid: actor.uid, claimed};
  },
);
