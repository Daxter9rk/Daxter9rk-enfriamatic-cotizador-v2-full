import {FieldValue, Timestamp} from 'firebase-admin/firestore';
import {onCall} from 'firebase-functions/v2/https';
import {firestore} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';

const THROTTLE_MILLISECONDS = 60_000;

export const recordActivity = onCall(
  {region: 'us-central1', maxInstances: 10, enforceAppCheck: false},
  async (request) => {
    const actor = await requireActiveActor(request);
    const profileRef = firestore.doc(`users/${actor.uid}`);
    const updated = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(profileRef);
      const previous = snapshot.data()?.lastActivityAt;
      if (
        previous instanceof Timestamp &&
        Date.now() - previous.toMillis() < THROTTLE_MILLISECONDS
      ) {
        return false;
      }
      transaction.update(profileRef, {lastActivityAt: FieldValue.serverTimestamp()});
      return true;
    });
    return {updated};
  },
);
