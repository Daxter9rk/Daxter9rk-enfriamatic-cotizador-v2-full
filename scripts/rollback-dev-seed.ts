import {applicationDefault, getApps, initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import process from 'node:process';
import {isSeedOwned, parseDevCommandOptions} from './dev-seed-core';
import {buildDevSeed} from './dev-seed-data';

const options = parseDevCommandOptions(process.argv.slice(2), process.env);
if (getApps().length === 0)
  initializeApp({projectId: options.projectId, credential: applicationDefault()});
const db = getFirestore();
const paths = buildDevSeed('placeholder-admin', 'placeholder-operator')
  .map((item) => item.path)
  .sort((left, right) => right.split('/').length - left.split('/').length);
const inspected = await Promise.all(
  paths.map(async (path) => {
    const snapshot = await db.doc(path).get();
    return {
      path,
      exists: snapshot.exists,
      removable: snapshot.exists && isSeedOwned(snapshot.data()),
    };
  }),
);
const removable = inspected.filter((item) => item.removable);
const protectedCount = inspected.filter((item) => item.exists && !item.removable).length;
console.log(
  `Rollback selectivo: ${removable.length} eliminables, ${protectedCount} protegidos, users fuera de alcance.`,
);
if (options.dryRun) {
  console.log('Dry-run completado: no se eliminó ningún documento.');
  process.exit(0);
}
const batch = db.batch();
for (const item of removable) batch.delete(db.doc(item.path));
await batch.commit();
console.log(
  `Rollback completado: ${removable.length} documentos propios de la semilla eliminados.`,
);
