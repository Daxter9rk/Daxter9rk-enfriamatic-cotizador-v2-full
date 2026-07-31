import {deleteApp as deleteAdminApp, initializeApp as initializeAdminApp} from 'firebase-admin/app';
import {Timestamp, getFirestore as getAdminFirestore} from 'firebase-admin/firestore';
import {deleteApp, initializeApp} from 'firebase/app';
import {connectAuthEmulator, getAuth, signInWithEmailAndPassword} from 'firebase/auth';
import {connectFunctionsEmulator, getFunctions, httpsCallable} from 'firebase/functions';
import {expect, test} from '@playwright/test';

const projectId = 'demo-enfriamatic';
const operatorUid = 'seed-operator-active';
const otherUid = 'known-other-operator';

test('callables reject known-ID cross-scope and mismatched relationship attacks', async ({
  browserName,
}, testInfo) => {
  const suffix = `${browserName}-${testInfo.project.name}-${Date.now()}`;
  const adminApp = initializeAdminApp(
    {projectId, storageBucket: `${projectId}.appspot.com`},
    `security-admin-${suffix}`,
  );
  const db = getAdminFirestore(adminApp);
  const now = Timestamp.now();
  const audit = {
    createdAt: now,
    createdBy: 'seed-admin-active',
    updatedAt: now,
    updatedBy: 'seed-admin-active',
    schemaVersion: 1,
  };

  await Promise.all([
    db.doc('requests/security-request').set({
      clientId: 'seed-client',
      siteId: 'seed-site',
      equipmentId: 'seed-equipment',
      title: 'Security request',
      description: 'Known-ID authorization regression',
      priority: 'normal',
      status: 'assigned',
      assignedTo: operatorUid,
      assignedAt: now,
      completedAt: null,
      correctionOfRequestId: null,
      correctionOfQuoteId: null,
      ...audit,
    }),
    db.doc('quotes/security-mismatched').set({
      requestId: 'security-request',
      assignedTo: operatorUid,
      clientId: 'another-client',
      siteId: 'another-site',
      equipmentId: null,
      status: 'draft',
      documentStatus: 'not_generated',
      locked: false,
      folio: '',
      ...audit,
    }),
    db.doc('quotes/security-stale-draft').set({
      requestId: 'security-request',
      assignedTo: otherUid,
      clientId: 'seed-client',
      siteId: 'seed-site',
      equipmentId: 'seed-equipment',
      status: 'draft',
      documentStatus: 'not_generated',
      locked: false,
      folio: '',
      ...audit,
    }),
    db.doc('quotes/security-stale-issued').set({
      requestId: 'security-request',
      assignedTo: otherUid,
      clientId: 'seed-client',
      siteId: 'seed-site',
      equipmentId: 'seed-equipment',
      status: 'issued',
      documentStatus: 'ready',
      locked: true,
      folio: 'COT-2026-999999',
      ...audit,
    }),
    db.doc('documents/security-stale-issued').set({
      quoteId: 'security-stale-issued',
      status: 'ready',
      storagePath: 'quotes/security-stale-issued/documents/security-stale-issued.pdf',
      sizeBytes: 5,
    }),
  ]);

  const clientApp = initializeApp(
    {
      apiKey: 'demo-api-key',
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      appId: '1:000000000000:web:security',
    },
    `security-client-${suffix}`,
  );
  const auth = getAuth(clientApp);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
  await signInWithEmailAndPassword(auth, 'operador@enfriamatic.local', 'DevOnly!Enfriamatic2026');
  const functions = getFunctions(clientApp, 'us-central1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);

  try {
    await expect(
      httpsCallable(
        functions,
        'issueQuote',
      )({
        quoteId: 'security-mismatched',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({code: 'functions/failed-precondition'});
    await expect(
      httpsCallable(
        functions,
        'issueQuote',
      )({
        quoteId: 'security-stale-draft',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({code: 'functions/permission-denied'});
    await expect(
      httpsCallable(
        functions,
        'createCorrection',
      )({
        quoteId: 'security-stale-issued',
      }),
    ).rejects.toMatchObject({code: 'functions/permission-denied'});
    await expect(
      httpsCallable(
        functions,
        'downloadQuotePdf',
      )({
        quoteId: 'security-stale-issued',
      }),
    ).rejects.toMatchObject({code: 'functions/permission-denied'});
  } finally {
    await auth.signOut();
    await deleteApp(clientApp);
    await deleteAdminApp(adminApp);
  }
});
