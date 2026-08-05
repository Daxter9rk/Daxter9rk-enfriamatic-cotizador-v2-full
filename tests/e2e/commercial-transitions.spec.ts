import {deleteApp as deleteAdminApp, initializeApp as initializeAdminApp} from 'firebase-admin/app';
import {Timestamp, getFirestore as getAdminFirestore} from 'firebase-admin/firestore';
import {deleteApp, initializeApp} from 'firebase/app';
import {connectAuthEmulator, getAuth, signInWithEmailAndPassword} from 'firebase/auth';
import {connectFunctionsEmulator, getFunctions, httpsCallable} from 'firebase/functions';
import {expect, test} from '@playwright/test';

const projectId = 'demo-enfriamatic';

test('admin rechaza y cancela cotizaciones con motivo, auditoría y notificación', async ({
  browserName,
}, testInfo) => {
  const suffix = `${browserName}-${testInfo.project.name}-${Date.now()}`;
  const adminApp = initializeAdminApp({projectId}, `commercial-admin-${suffix}`);
  const db = getAdminFirestore(adminApp);
  const now = Timestamp.now();
  const quoteIds = [`commercial-reject-${suffix}`, `commercial-cancel-${suffix}`];

  await Promise.all([
    db.doc(`quotes/${quoteIds[0]}`).set({
      requestId: 'seed-request',
      assignedTo: 'seed-operator-active',
      folio: `COT-E2E-REJECT-${suffix}`,
      status: 'sent',
      locked: true,
      documentStatus: 'ready',
      updatedAt: now,
      updatedBy: 'seed-admin-active',
    }),
    db.doc(`quotes/${quoteIds[1]}`).set({
      requestId: 'seed-request',
      assignedTo: 'seed-operator-active',
      folio: `COT-E2E-CANCEL-${suffix}`,
      status: 'issued',
      locked: true,
      documentStatus: 'ready',
      updatedAt: now,
      updatedBy: 'seed-admin-active',
    }),
  ]);

  const clientApp = initializeApp(
    {
      apiKey: 'demo-api-key',
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      appId: '1:000000000000:web:commercial-transitions',
    },
    `commercial-client-${suffix}`,
  );
  const auth = getAuth(clientApp);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
  await signInWithEmailAndPassword(auth, 'admin@enfriamatic.local', 'DevOnly!Enfriamatic2026');
  const functions = getFunctions(clientApp, 'us-central1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const transition = httpsCallable(functions, 'transitionQuote');

  try {
    await transition({quoteId: quoteIds[0], to: 'rejected', reason: 'Cliente pospuso el proyecto'});
    await transition({
      quoteId: quoteIds[1],
      to: 'cancelled',
      reason: 'Alcance retirado por cliente',
    });

    const [rejected, cancelled, audit, notifications] = await Promise.all([
      db.doc(`quotes/${quoteIds[0]}`).get(),
      db.doc(`quotes/${quoteIds[1]}`).get(),
      db.collection('auditLogs').where('resourceId', 'in', quoteIds).get(),
      db.collection('notifications').where('resourceId', 'in', quoteIds).get(),
    ]);

    expect(rejected.get('status')).toBe('rejected');
    expect(rejected.get('commercialTransition.reason')).toBe('Cliente pospuso el proyecto');
    expect(rejected.get('lastRejectionReason')).toBe('Cliente pospuso el proyecto');
    expect(rejected.get('lastRejectedByName')).toBe('Admin Emulador');
    expect(rejected.get('commercialHistory')).toHaveLength(1);
    expect(cancelled.get('status')).toBe('cancelled');
    expect(cancelled.get('commercialTransition.reason')).toBe('Alcance retirado por cliente');
    expect(
      audit.docs
        .map((item) => String(item.get('action')))
        .filter((action) => action === 'quote.cancelled' || action === 'quote.rejected')
        .sort(),
    ).toEqual(['quote.cancelled', 'quote.rejected']);
    expect(notifications.docs.map((item) => String(item.get('type'))).sort()).toEqual([
      'quote_cancelled',
      'quote_rejected',
    ]);
    expect(
      notifications.docs.some((item) =>
        String(item.get('message')).includes('Cliente pospuso el proyecto'),
      ),
    ).toBe(true);
  } finally {
    await auth.signOut();
    await deleteApp(clientApp);
    await deleteAdminApp(adminApp);
  }
});
