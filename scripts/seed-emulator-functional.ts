import {getApps, initializeApp} from 'firebase-admin/app';
import {Timestamp, getFirestore} from 'firebase-admin/firestore';

const requiredHosts = ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST'];
const missing = requiredHosts.filter((name) => !process.env[name]);
if (missing.length > 0)
  throw new Error(`Semilla funcional bloqueada fuera de emuladores: ${missing.join(', ')}`);
const projectId = process.env.GCLOUD_PROJECT ?? 'demo-enfriamatic';
if (getApps().length === 0) initializeApp({projectId});
const db = getFirestore();
const now = Timestamp.now();
const audit = {
  createdAt: now,
  createdBy: 'seed-admin-active',
  updatedAt: now,
  updatedBy: 'seed-admin-active',
  schemaVersion: 1,
};
const items = [
  {
    code: 'PROD-EMU-001',
    type: 'product',
    name: 'Compresor emulador',
    description: 'Producto ficticio para pruebas integrales.',
    category: 'Compresores',
    unit: 'pieza',
    brand: 'Marca Emulador',
    model: 'EMU-P1',
    basePrice: 10000,
    taxable: true,
    status: 'active',
    searchTokens: ['compresor', 'emulador'],
  },
  {
    code: 'SERV-EMU-001',
    type: 'service',
    name: 'Servicio emulador',
    description: 'Servicio ficticio para pruebas integrales.',
    category: 'Mantenimiento',
    unit: 'servicio',
    brand: null,
    model: null,
    basePrice: 2000,
    taxable: true,
    status: 'active',
    searchTokens: ['servicio', 'emulador'],
  },
  {
    code: 'PROD-EMU-OFF',
    type: 'product',
    name: 'Producto inactivo emulador',
    description: 'No debe seleccionarse.',
    category: 'Pruebas',
    unit: 'pieza',
    brand: null,
    model: null,
    basePrice: 1,
    taxable: true,
    status: 'inactive',
    searchTokens: ['inactivo'],
  },
] as const;
await Promise.all(
  items.map((item) => db.doc(`catalogItems/${item.code}`).set({...item, ...audit})),
);
console.log('Catálogo funcional ficticio aplicado exclusivamente a Emulator Suite.');
