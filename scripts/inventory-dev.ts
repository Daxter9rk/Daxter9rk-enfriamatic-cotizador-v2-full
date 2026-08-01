import {execFileSync} from 'node:child_process';
import {applicationDefault, getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {DEV_PROJECT_ID} from './dev-seed-core';
import {runProcess} from './portable-process';

const projectIndex = process.argv.indexOf('--project');
const projectId = projectIndex >= 0 ? (process.argv[projectIndex + 1] ?? '') : '';
if (projectId !== DEV_PROJECT_ID)
  throw new Error(`Inventario bloqueado fuera de ${DEV_PROJECT_ID}.`);
const localEnv = await readFile('.env.local', 'utf8');
const storageBucket = localEnv.match(/^VITE_FIREBASE_STORAGE_BUCKET=(.+)$/m)?.[1]?.trim();
if (!storageBucket) throw new Error('Falta VITE_FIREBASE_STORAGE_BUCKET para inventariar Storage.');
if (getApps().length === 0) {
  initializeApp({projectId, storageBucket, credential: applicationDefault()});
}
const db = getFirestore();
const auth = getAuth();
const storage = getStorage();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDirectory = path.resolve('.artifacts', 'predeploy', timestamp);
await mkdir(outputDirectory, {recursive: true});

const users: Array<Record<string, unknown>> = [];
let pageToken: string | undefined;
do {
  const page = await auth.listUsers(1000, pageToken);
  users.push(
    ...page.users.map((user) => ({
      uid: user.uid,
      email: user.email ?? null,
      disabled: user.disabled,
      createdAt: user.metadata.creationTime,
      lastSignInAt: user.metadata.lastSignInTime ?? null,
    })),
  );
  pageToken = page.pageToken;
} while (pageToken);

const profiles = await db.collection('users').get();
const profileInventory = profiles.docs.map((item) => {
  const data = item.data() as Record<string, unknown>;
  return {
    uid: item.id,
    email: data.email ?? null,
    role: data.role ?? null,
    status: data.status ?? null,
  };
});
const collections = await db.listCollections();
const collectionCounts: Record<string, number> = {};
for (const collection of collections) {
  const count = await collection.count().get();
  collectionCounts[collection.id] = count.data().count;
}
const settings = await db.collection('settings').get();
const catalogItems = await db.collection('catalogItems').get();
const [pdfFiles] = await storage.bucket().getFiles({prefix: 'quotes/'});
const git = (args: string[]) => execFileSync('git', args, {encoding: 'utf8'}).trim();
const baselineFile = (file: string) => git(['show', `HEAD:${file}`]);

const inventory = {
  generatedAt: new Date().toISOString(),
  projectId,
  git: {
    branch: git(['branch', '--show-current']),
    commit: git(['rev-parse', 'HEAD']),
    remote: git(['remote', 'get-url', 'origin']),
  },
  authentication: users,
  profiles: profileInventory,
  collectionCounts,
  settings: Object.fromEntries(settings.docs.map((item) => [item.id, serialize(item.data())])),
  catalogItems: catalogItems.docs.map((item) => ({
    id: item.id,
    ...(serialize(item.data()) as Record<string, unknown>),
  })),
  functions: safeFirebaseJson(['functions:list', '--project', projectId, '--json']),
  hosting: safeFirebaseJson(['hosting:channel:list', '--project', projectId, '--json']),
  pdfs: pdfFiles.map((file) => ({
    name: file.name,
    size: file.metadata.size ?? null,
    updated: file.metadata.updated ?? null,
    contentType: file.metadata.contentType ?? null,
  })),
};

await Promise.all([
  writeFile(
    path.join(outputDirectory, 'inventory.json'),
    JSON.stringify(inventory, null, 2),
    'utf8',
  ),
  writeFile(path.join(outputDirectory, 'firestore.rules'), baselineFile('firestore.rules'), 'utf8'),
  writeFile(
    path.join(outputDirectory, 'firestore.indexes.json'),
    baselineFile('firestore.indexes.json'),
    'utf8',
  ),
  writeFile(path.join(outputDirectory, 'storage.rules'), baselineFile('storage.rules'), 'utf8'),
  writeFile(path.join(outputDirectory, 'firebase.json'), baselineFile('firebase.json'), 'utf8'),
]);
console.log(`Inventario previo guardado localmente en ${outputDirectory}`);

function safeFirebaseJson(args: string[]): unknown {
  try {
    const output = runProcess('npx', ['-y', 'firebase-tools@latest', ...args]);
    return JSON.parse(output);
  } catch (error) {
    return {error: error instanceof Error ? error.message.slice(0, 500) : 'unknown'};
  }
}

function serialize(value: unknown): unknown {
  if (value && typeof value === 'object') {
    if ('toDate' in value && typeof (value as {toDate?: unknown}).toDate === 'function') {
      return (value as {toDate(): Date}).toDate().toISOString();
    }
    if (Array.isArray(value)) return value.map(serialize);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serialize(item)]),
    );
  }
  return value;
}
