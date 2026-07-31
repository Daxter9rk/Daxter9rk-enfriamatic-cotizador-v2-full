import {getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue, Timestamp, getFirestore} from 'firebase-admin/firestore';

const requiredHosts = [
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
  'STORAGE_EMULATOR_HOST',
];
const missingHosts = requiredHosts.filter((key) => !process.env[key]);
if (missingHosts.length > 0) {
  throw new Error(`Semilla bloqueada fuera de emuladores. Faltan: ${missingHosts.join(', ')}`);
}

const projectId = process.env.GCLOUD_PROJECT ?? 'demo-enfriamatic';
if (getApps().length === 0) initializeApp({projectId});
const auth = getAuth();
const db = getFirestore();
const now = Timestamp.now();
const password = 'DevOnly!Enfriamatic2026';

const accounts = [
  {
    uid: 'seed-admin-active',
    email: 'admin@enfriamatic.local',
    displayName: 'Admin Emulador',
    role: 'admin',
    status: 'active',
    profile: true,
  },
  {
    uid: 'seed-operator-active',
    email: 'operador@enfriamatic.local',
    displayName: 'Operador Emulador',
    role: 'operator',
    status: 'active',
    profile: true,
  },
  {
    uid: 'seed-operator-inactive',
    email: 'inactivo@enfriamatic.local',
    displayName: 'Operador Inactivo',
    role: 'operator',
    status: 'inactive',
    profile: true,
  },
  {
    uid: 'seed-auth-no-profile',
    email: 'sinperfil@enfriamatic.local',
    displayName: 'Sin Perfil',
    role: 'operator',
    status: 'active',
    profile: false,
  },
  {
    uid: 'seed-invalid-role',
    email: 'rolinvalido@enfriamatic.local',
    displayName: 'Rol Inválido',
    role: 'reader',
    status: 'active',
    profile: true,
  },
] as const;

for (const account of accounts) {
  try {
    await auth.getUser(account.uid);
    await auth.updateUser(account.uid, {
      email: account.email,
      password,
      displayName: account.displayName,
      disabled: false,
    });
  } catch {
    await auth.createUser({
      uid: account.uid,
      email: account.email,
      password,
      displayName: account.displayName,
      disabled: false,
    });
  }
  if (account.profile) {
    await db.doc(`users/${account.uid}`).set({
      uid: account.uid,
      email: account.email,
      displayName: account.displayName,
      role: account.role,
      status: account.status,
      createdAt: now,
      createdBy: 'seed-admin-active',
      updatedAt: now,
      updatedBy: 'seed-admin-active',
      lastLoginAt: null,
      schemaVersion: 1,
    });
  }
}

const audit = {
  createdAt: now,
  createdBy: 'seed-admin-active',
  updatedAt: now,
  updatedBy: 'seed-admin-active',
  schemaVersion: 1,
};

await db.doc('clients/seed-client').set({
  name: 'Procesos Fríos del Bajío',
  legalName: '',
  rfc: '',
  contactName: 'Contacto de prueba',
  email: 'contacto@example.test',
  phone: '0000000000',
  status: 'active',
  notes: 'Datos ficticios exclusivos del emulador.',
  operatorIds: ['seed-operator-active'],
  ...audit,
});
await db.doc('sites/seed-site').set({
  clientId: 'seed-client',
  name: 'Planta Piloto',
  type: 'plant',
  address: {
    street: 'Avenida de Prueba',
    exteriorNumber: '100',
    city: 'Querétaro',
    state: 'Querétaro',
    postalCode: '76000',
    country: 'México',
  },
  contactName: 'Contacto de prueba',
  contactPhone: '0000000000',
  status: 'active',
  operatorIds: ['seed-operator-active'],
  ...audit,
});
await db.doc('equipment/seed-equipment').set({
  clientId: 'seed-client',
  siteId: 'seed-site',
  name: 'Chiller de proceso',
  category: 'Chiller',
  brand: 'Marca ficticia',
  model: 'DEV-100',
  serialNumber: 'SEED-001',
  capacity: '100 TR',
  refrigerant: 'R-134a',
  technicalNotes: 'Equipo ficticio para pruebas.',
  status: 'active',
  operatorIds: ['seed-operator-active'],
  ...audit,
});
await db.doc('requests/seed-request').set({
  clientId: 'seed-client',
  siteId: 'seed-site',
  equipmentId: 'seed-equipment',
  title: 'Diagnóstico del chiller',
  description: 'Solicitud ficticia para validar el flujo integral.',
  priority: 'high',
  status: 'assigned',
  assignedTo: 'seed-operator-active',
  assignedAt: now,
  completedAt: null,
  correctionOfRequestId: null,
  correctionOfQuoteId: null,
  ...audit,
});
await db.doc('quotes/seed-quote').set({
  folio: '',
  requestId: 'seed-request',
  assignedTo: 'seed-operator-active',
  clientId: 'seed-client',
  siteId: 'seed-site',
  equipmentId: 'seed-equipment',
  status: 'draft',
  documentStatus: 'not_generated',
  currency: 'MXN',
  taxRate: 0.16,
  discountDisplayMode: 'detailed',
  subtotalOriginal: 5000,
  discountTotal: 500,
  subtotalFinal: 4500,
  taxTotal: 720,
  grandTotal: 5220,
  notes: 'Borrador de prueba.',
  validityDays: 15,
  validUntil: null,
  issuedAt: null,
  issuedBy: null,
  originalQuoteId: null,
  revisionNumber: 1,
  locked: false,
  ...audit,
});
await db.doc('quotes/seed-quote/items/seed-item').set({
  position: 0,
  quantity: 1,
  unit: 'servicio',
  equipmentOrService: 'Diagnóstico industrial',
  brand: '',
  model: '',
  description: 'Diagnóstico técnico integral',
  originalUnitPrice: 5000,
  discountType: 'percentage',
  discountValue: 10,
  discountAmount: 500,
  finalUnitPrice: 4500,
  lineSubtotal: 4500,
  taxable: true,
  createdAt: now,
  updatedAt: now,
});

const catalogValues = [
  ['unit-service', 'unit', 'Servicio', 'servicio'],
  ['unit-piece', 'unit', 'Pieza', 'pieza'],
  ['equipment-chiller', 'equipment_category', 'Chiller', 'chiller'],
  ['service-diagnostic', 'concept', 'Diagnóstico industrial', 'diagnostico-industrial'],
  ['service-maintenance', 'concept', 'Mantenimiento preventivo', 'mantenimiento-preventivo'],
] as const;
for (const [id, type, name, value] of catalogValues) {
  await db.doc(`catalogs/${id}`).set({
    type,
    name,
    value,
    status: 'active',
    ...audit,
  });
}

await db.doc('settings/companyProfile').set({
  companyName: 'Enfriamatic',
  rfc: '',
  address: '',
  phone: '',
  email: '',
  legalText: '',
  ...audit,
});
await db.doc('settings/quoteDefaults').set({
  taxRate: 0.16,
  validityDays: 15,
  currency: 'MXN',
  folioPrefix: 'COT',
  paymentMethod: '',
  advance: '',
  estimatedTerm: '',
  warranty: '',
  exclusions: '',
  observations: '',
  devWatermark: 'DOCUMENTO DE PRUEBA - DEV',
  ...audit,
});
await db.doc('notifications/seed-notification').set({
  userId: 'seed-operator-active',
  type: 'request_assigned',
  title: 'Solicitud asignada',
  message: 'Tienes una solicitud ficticia para pruebas.',
  resourceType: 'request',
  resourceId: 'seed-request',
  read: false,
  readAt: null,
  createdAt: FieldValue.serverTimestamp(),
});

console.log('Semilla idempotente aplicada exclusivamente a Emulator Suite.');
console.log('Admin: admin@enfriamatic.local');
console.log('Operador: operador@enfriamatic.local');
console.log(`Contraseña local ficticia: ${password}`);
