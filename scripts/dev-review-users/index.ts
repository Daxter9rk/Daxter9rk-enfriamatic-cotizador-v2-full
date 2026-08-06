import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {applicationDefault, getApps, initializeApp} from 'firebase-admin/app';
import {getAuth, type UserRecord} from 'firebase-admin/auth';
import {FieldValue, getFirestore} from 'firebase-admin/firestore';
import {parseReviewUserOptions, requiredReviewEnvironment} from './config';

const options = parseReviewUserOptions(process.argv.slice(2));
if (options.target === 'emulator') {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
}
if (getApps().length === 0) {
  initializeApp({
    projectId: options.projectId,
    ...(options.target === 'remote' ? {credential: applicationDefault()} : {}),
  });
}

const auth = getAuth();
const database = getFirestore();
const registryPath = resolve('scripts/dev-review-users/.review-users.local.json');
const registry = readRegistry();

if (options.action === 'cleanup') {
  let removed = 0;
  for (const uid of registry.uids) {
    let user: UserRecord;
    try {
      user = await auth.getUser(uid);
    } catch (error) {
      if (isAuthCode(error, 'auth/user-not-found')) continue;
      throw error;
    }
    if (user.customClaims?.devReviewUser !== true) {
      throw new Error('Limpieza detenida: el registro contiene una cuenta sin la marca segura.');
    }
    const profile = await database.doc(`users/${uid}`).get();
    if (profile.exists && profile.data()?.reviewProvisioned !== true) {
      throw new Error('Limpieza detenida: existe un perfil que no pertenece al script.');
    }
    if (profile.exists) await profile.ref.delete();
    await auth.deleteUser(uid);
    removed += 1;
  }
  writeRegistry([]);
  console.info(`Limpieza segura completada. Cuentas eliminadas: ${removed}.`);
  process.exit(0);
}

const definitions = requiredReviewEnvironment(process.env);
let changed = 0;
for (const definition of definitions) {
  const user = await findOrCreateMarkedUser(definition.email, definition.password);
  if (!registry.uids.includes(user.uid)) registry.uids.push(user.uid);
  if (options.action === 'disable') {
    await auth.updateUser(user.uid, {disabled: true});
  } else {
    await auth.updateUser(user.uid, {disabled: false, password: definition.password});
  }
  if (definition.profile) {
    await database.doc(`users/${user.uid}`).set(
      {
        uid: user.uid,
        email: definition.email,
        displayName: reviewDisplayName(definition.key),
        role: definition.role,
        status: options.action === 'disable' ? 'inactive' : definition.status,
        isPrimaryAdmin: false,
        reviewProvisioned: true,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'dev-review-users-script',
        schemaVersion: 1,
      },
      {merge: true},
    );
  } else {
    const profile = database.doc(`users/${user.uid}`);
    const snapshot = await profile.get();
    if (snapshot.exists && snapshot.data()?.reviewProvisioned === true) await profile.delete();
    else if (snapshot.exists)
      throw new Error('La cuenta sin perfil ya tiene un perfil ajeno al script.');
  }
  changed += 1;
}
writeRegistry(registry.uids);
console.info(
  `Operación ${options.action} completada en ${options.target}. Cuentas procesadas: ${changed}.`,
);

async function findOrCreateMarkedUser(email: string, password: string): Promise<UserRecord> {
  try {
    const existing = await auth.getUserByEmail(email);
    if (existing.customClaims?.devReviewUser !== true || !registry.uids.includes(existing.uid)) {
      throw new Error('La dirección corresponde a una cuenta que no fue creada por este script.');
    }
    return existing;
  } catch (error) {
    if (!isAuthCode(error, 'auth/user-not-found')) throw error;
  }
  const created = await auth.createUser({email, password, emailVerified: true, disabled: false});
  await auth.setCustomUserClaims(created.uid, {devReviewUser: true});
  return auth.getUser(created.uid);
}

function readRegistry(): {uids: string[]} {
  if (!existsSync(registryPath)) return {uids: []};
  const parsed = JSON.parse(readFileSync(registryPath, 'utf8')) as {
    projectId?: string;
    uids?: unknown;
  };
  if (parsed.projectId !== options.projectId || !Array.isArray(parsed.uids)) {
    throw new Error('El registro local no corresponde al proyecto DEV esperado.');
  }
  return {uids: parsed.uids.filter((uid): uid is string => typeof uid === 'string')};
}

function writeRegistry(uids: string[]): void {
  writeFileSync(
    registryPath,
    `${JSON.stringify({projectId: options.projectId, uids}, null, 2)}\n`,
    {mode: 0o600},
  );
}

function isAuthCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as {code?: unknown}).code) === code
  );
}

function reviewDisplayName(key: string): string {
  return (
    {
      promotedAdmin: 'Administrador promovido DEV',
      activeOperator: 'Operador DEV',
      inactiveUser: 'Usuario inactivo DEV',
    }[key] ?? 'Usuario DEV'
  );
}
