import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const envPath = resolve('.env.local');
const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

if (!existsSync(envPath)) {
  throw new Error('Falta .env.local. Copia .env.example y completa la configuración DEV.');
}

const configured = new Set(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('=', 1)[0]),
);

const missing = required.filter((key) => !configured.has(key));
if (missing.length > 0) {
  throw new Error(`Faltan variables públicas: ${missing.join(', ')}`);
}

console.log('Configuración pública Firebase DEV completa. No se imprimieron valores.');
