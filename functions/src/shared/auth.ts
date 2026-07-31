import {HttpsError, type CallableRequest} from 'firebase-functions/v2/https';
import type {UserRole} from './schemas';
import {firestore} from './admin';

export interface ActiveActor {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export async function requireActiveActor(
  request: CallableRequest<unknown>,
  roles: UserRole[] = ['admin', 'operator'],
): Promise<ActiveActor> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const profile = await firestore.doc(`users/${uid}`).get();
  if (!profile.exists) {
    throw new HttpsError('permission-denied', 'A valid user profile is required.');
  }

  const data = profile.data() ?? {};
  if (data.status !== 'active') {
    throw new HttpsError('permission-denied', 'The user profile is not active.');
  }
  if ((data.role !== 'admin' && data.role !== 'operator') || !roles.includes(data.role)) {
    throw new HttpsError('permission-denied', 'The role is not authorized.');
  }

  return {
    uid,
    email: String(data.email ?? request.auth?.token.email ?? ''),
    displayName: String(data.displayName ?? ''),
    role: data.role,
  };
}
