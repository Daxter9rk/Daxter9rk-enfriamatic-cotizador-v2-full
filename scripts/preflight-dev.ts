import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {DEV_PROJECT_ID} from './dev-seed-core';

const expectedRoot = 'enfriamatic-cotizador-v2-full';
const expectedRemote = 'https://github.com/Daxter9rk/Daxter9rk-enfriamatic-cotizador-v2-full.git';
const requiredEnv = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command: string, args: string[]): string {
  return execFileSync(command, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
}

const root = process.cwd();
if (
  path.basename(root) !== expectedRoot ||
  root.toLowerCase().endsWith('enfriamatic-cotizador-v2')
) {
  throw new Error(`Ruta no autorizada: ${root}`);
}
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  name?: string;
};
if (packageJson.name !== expectedRoot)
  throw new Error('El package name no corresponde al proyecto autorizado.');
if (run('git', ['remote', 'get-url', 'origin']) !== expectedRemote)
  throw new Error('Remoto Git no autorizado.');
if (run('git', ['status', '--porcelain']))
  throw new Error('El árbol Git contiene cambios previos o no confirmados.');
const firebaseProject = run(npx, ['-y', 'firebase-tools@latest', 'use']);
if (firebaseProject !== DEV_PROJECT_ID || firebaseProject.toLowerCase().includes('prod'))
  throw new Error('Firebase activo no autorizado.');
if (!run(npx, ['-y', 'firebase-tools@latest', 'login:list']).includes('Logged in as'))
  throw new Error('Firebase CLI no está autenticado.');
if (!run('gcloud', ['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)']))
  throw new Error('gcloud no está autenticado.');
run('gh', ['auth', 'status']);

const envPath = path.join(root, '.env.local');
const envText = readFileSync(envPath, 'utf8');
const envEntries: Record<string, string> = {};
for (const line of envText.split(/\r?\n/).filter((item) => item.includes('='))) {
  const [key, value = ''] = line.split(/=(.*)/s).slice(0, 2);
  if (key) envEntries[key] = value;
}
const missing = requiredEnv.filter((key) => !envEntries[key]);
if (missing.length > 0) throw new Error(`Faltan variables Firebase: ${missing.join(', ')}.`);
if (envEntries.VITE_FIREBASE_PROJECT_ID !== DEV_PROJECT_ID)
  throw new Error('VITE_FIREBASE_PROJECT_ID no coincide con DEV autorizado.');

console.log(
  `Preflight DEV correcto: ${expectedRoot} · ${DEV_PROJECT_ID} · ${run('git', ['branch', '--show-current'])}`,
);
