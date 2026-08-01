import {applicationDefault, getApps, initializeApp} from 'firebase-admin/app';
import {FieldValue, getFirestore} from 'firebase-admin/firestore';
import process from 'node:process';
import {classifySeedDocument, parseDevCommandOptions, type SeedAction} from './dev-seed-core';
import {buildDevSeed, type SeedSpec} from './dev-seed-data';

const options = parseDevCommandOptions(process.argv.slice(2), process.env);
if (getApps().length === 0) {
  initializeApp({projectId: options.projectId, credential: applicationDefault()});
}
const db = getFirestore();
const activeProfiles = await db.collection('users').where('status', '==', 'active').get();
const adminIds = activeProfiles.docs
  .filter((item) => item.data().role === 'admin')
  .map((item) => item.id)
  .sort();
const operatorIds = activeProfiles.docs
  .filter((item) => item.data().role === 'operator')
  .map((item) => item.id)
  .sort();
if (adminIds.length === 0 || operatorIds.length === 0) {
  throw new Error(
    'Se requiere al menos un administrador activo y un operador activo. No se modificó users.',
  );
}
const adminId = adminIds[0];
const operatorId = operatorIds[0];
const specs = buildDevSeed(adminId, operatorId);
const planned = await Promise.all(
  specs.map(async (spec) => {
    const snapshot = await db.doc(spec.path).get();
    return {
      spec,
      action: classifySeedDocument(
        snapshot.exists ? (snapshot.data() ?? {}) : null,
        spec.data,
        spec.preserveUnmanaged,
      ),
    };
  }),
);
const summary = planned.reduce<Record<SeedAction, number>>(
  (result, item) => {
    result[item.action] += 1;
    return result;
  },
  {create: 0, update: 0, unchanged: 0, conflict: 0, preserve: 0},
);

console.log(`Proyecto: ${options.projectId}`);
console.log(`Administrador DEV seleccionado (UID ordenado): ${adminId}`);
console.log(`Operador DEV seleccionado (UID ordenado): ${operatorId}`);
console.log(`Plan: ${JSON.stringify(summary)}`);
console.log('Colección users: 0 escrituras, 0 eliminaciones.');
if (summary.conflict > 0) {
  const conflicts = planned
    .filter((item) => item.action === 'conflict')
    .map((item) => item.spec.path);
  throw new Error(
    `Semilla detenida para no sobrescribir documentos ajenos: ${conflicts.join(', ')}`,
  );
}
if (options.dryRun) {
  console.log('Dry-run completado: no se escribió ningún documento.');
  process.exit(0);
}

const batch = db.batch();
for (const {spec, action} of planned) {
  if (action !== 'create' && action !== 'update') continue;
  const data = materializeServerTimestamps(spec.data) as Record<string, unknown>;
  const audit = auditFields(spec, action, adminId);
  batch.set(db.doc(spec.path), {...data, ...audit}, {merge: action === 'update'});
}
await batch.commit();
console.log(
  `Semilla DEV aplicada: ${summary.create} creados, ${summary.update} actualizados, ${summary.unchanged} sin cambios, ${summary.preserve} preservados.`,
);

function materializeServerTimestamps(value: unknown): unknown {
  if (value === 'SERVER_TIMESTAMP') return FieldValue.serverTimestamp();
  if (Array.isArray(value)) return value.map(materializeServerTimestamps);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        materializeServerTimestamps(item),
      ]),
    );
  }
  return value;
}

function auditFields(
  spec: SeedSpec,
  action: 'create' | 'update',
  actorId: string,
): Record<string, unknown> {
  const now = FieldValue.serverTimestamp();
  if (spec.path.startsWith('notifications/')) return action === 'create' ? {createdAt: now} : {};
  if (spec.path.split('/').includes('items'))
    return action === 'create' ? {createdAt: now, updatedAt: now} : {updatedAt: now};
  return {
    ...(action === 'create' ? {createdAt: now, createdBy: actorId, schemaVersion: 1} : {}),
    updatedAt: now,
    updatedBy: actorId,
  };
}
