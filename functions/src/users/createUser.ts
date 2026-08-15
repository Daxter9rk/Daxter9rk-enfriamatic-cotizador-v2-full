import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {logger} from 'firebase-functions';
import {writeAudit} from '../audit/writeAudit';
import {adminAuth, firestore} from '../shared/admin';
import {requireActiveActor, requireRecentAuthentication} from '../shared/auth';
import {invalidArgument} from '../shared/errors';
import {createUserSchema} from '../shared/schemas';

export const createUser = onCall(
  {
    region: 'us-central1',
    maxInstances: 5,
    enforceAppCheck: false,
  },
  async (request) => {
    const actor = await requireActiveActor(request, ['admin']);
    const parsed = createUserSchema.safeParse(request.data);
    if (!parsed.success) throw invalidArgument(parsed.error);

    const input = parsed.data;
    if (input.role === 'admin') {
      if (!actor.isPrimaryAdmin) {
        throw new HttpsError(
          'permission-denied',
          'Only the primary administrator can create an administrator.',
        );
      }
      requireRecentAuthentication(request);
    }
    let createdUid: string | null = null;
    try {
      const user = await adminAuth.createUser({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
        disabled: false,
      });
      createdUid = user.uid;

      await firestore.doc(`users/${user.uid}`).create({
        uid: user.uid,
        email: input.email,
        displayName: input.displayName,
        role: input.role,
        status: input.status,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
        lastLoginAt: null,
        lastActivityAt: null,
        isPrimaryAdmin: false,
        schemaVersion: 1,
      });

      await writeAudit(actor, {
        action: 'user.created',
        resourceType: 'user',
        resourceId: user.uid,
        after: {
          email: input.email,
          displayName: input.displayName,
          role: input.role,
          status: input.status,
        },
      });

      return {uid: user.uid};
    } catch (error) {
      if (createdUid) {
        try {
          await adminAuth.deleteUser(createdUid);
        } catch (rollbackError) {
          logger.error('User rollback failed', {
            uid: createdUid,
            code: 'user-rollback-failed',
            rollbackError,
          });
        }
      }
      logger.error('User creation failed', {
        actorId: actor.uid,
        code: 'user-create-failed',
      });
      throw new HttpsError('internal', 'The user could not be created safely.');
    }
  },
);
