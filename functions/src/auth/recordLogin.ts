import {FieldValue} from 'firebase-admin/firestore';
import {onCall} from 'firebase-functions/v2/https';
import {writeAudit} from '../audit/writeAudit';
import {firestore} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';

export const recordLogin = onCall(
  {
    region: 'us-central1',
    maxInstances: 10,
    enforceAppCheck: false,
  },
  async (request) => {
    const actor = await requireActiveActor(request);
    await firestore.doc(`users/${actor.uid}`).update({
      lastLoginAt: FieldValue.serverTimestamp(),
    });
    await writeAudit(actor, {
      action: 'auth.login',
      resourceType: 'user',
      resourceId: actor.uid,
    });
    return {ok: true};
  },
);
