import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {writeAudit} from '../audit/writeAudit';
import {adminAuth, firestore} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';
import {invalidArgument} from '../shared/errors';
import {updateUserSchema} from '../shared/schemas';

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
    const snapshot = await profileRef.get();
    if (!snapshot.exists) {
      throw new HttpsError('not-found', 'The user profile does not exist.');
    }
    const before = snapshot.data() ?? {};
    if (input.uid === actor.uid && (before.role !== input.role || before.status !== input.status)) {
      throw new HttpsError(
        'failed-precondition',
        'Administrators cannot change their own role or status.',
      );
    }

    await adminAuth.updateUser(input.uid, {
      displayName: input.displayName,
      // Firestore profile status is the authorization source. Keeping Auth
      // enabled lets the app show an explicit blocked-state explanation.
      disabled: false,
    });
    await profileRef.update({
      displayName: input.displayName,
      role: input.role,
      status: input.status,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    });
    await writeAudit(actor, {
      action: 'user.updated',
      resourceType: 'user',
      resourceId: input.uid,
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
    });

    return {uid: input.uid};
  },
);
