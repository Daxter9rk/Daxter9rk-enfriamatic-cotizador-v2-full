import {deleteApp as deleteAdminApp, initializeApp as initializeAdminApp} from 'firebase-admin/app';
import {Timestamp, getFirestore as getAdminFirestore} from 'firebase-admin/firestore';
import {deleteApp, initializeApp} from 'firebase/app';
import {connectAuthEmulator, getAuth, signInWithEmailAndPassword} from 'firebase/auth';
import {connectFunctionsEmulator, getFunctions, httpsCallable} from 'firebase/functions';
import {expect, test} from '@playwright/test';

const projectId = 'demo-enfriamatic';
const credentials = {email: 'admin@enfriamatic.local', password: 'DevOnly!Enfriamatic2026'};
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.GCLOUD_PROJECT ??= projectId;

test('admin deletes dependency-free clients and deactivates historical clients', async ({page}) => {
  const suffix = String(Date.now());
  const removableId = `client-removable-${suffix}`;
  const historicalId = `client-historical-${suffix}`;
  const quoteId = `quote-historical-${suffix}`;
  const siteId = `site-historical-${suffix}`;
  const adminApp = initializeAdminApp({projectId}, `client-deletion-admin-${suffix}`);
  const db = getAdminFirestore(adminApp);
  const now = Timestamp.now();
  const audit = {
    createdAt: now,
    createdBy: 'seed-admin-active',
    updatedAt: now,
    updatedBy: 'seed-admin-active',
    schemaVersion: 1,
  };
  try {
    await Promise.all([
      db
        .doc(`clients/${removableId}`)
        .set({name: 'Cliente eliminable DEV', status: 'active', operatorIds: [], ...audit}),
      db
        .doc(`clients/${historicalId}`)
        .set({name: 'Cliente histórico DEV', status: 'active', operatorIds: [], ...audit}),
      db
        .doc(`sites/${siteId}`)
        .set({clientId: historicalId, name: 'Sitio histórico DEV', ...audit}),
      db.doc(`quotes/${quoteId}`).set({
        folio: `COT-HIST-${suffix}`,
        requestId: null,
        assignedTo: null,
        clientId: historicalId,
        siteId: null,
        equipmentId: null,
        status: 'issued',
        documentStatus: 'ready',
        currency: 'MXN',
        taxRate: 0.16,
        clientSnapshot: {clientId: historicalId, name: 'Cliente histórico DEV'},
        subtotalOriginal: 100,
        discountTotal: 0,
        subtotalFinal: 100,
        taxTotal: 16,
        grandTotal: 116,
        locked: true,
        ...audit,
      }),
    ]);

    await page.goto('/', {waitUntil: 'domcontentloaded'});
    await page.getByTestId('login-email').fill(credentials.email);
    await page.getByTestId('login-password').fill(credentials.password);
    await page.getByTestId('login-submit').click();
    await expect(page.getByText(/centro comercial/i)).toBeVisible();

    await page.goto(`/clients/${removableId}`);
    await page.getByRole('button', {name: 'Eliminar cliente'}).click();
    await page.getByRole('dialog').getByRole('button', {name: 'Cancelar'}).click();
    await expect(page.getByRole('button', {name: 'Eliminar cliente'})).toBeVisible();
    await page.getByRole('button', {name: 'Eliminar cliente'}).click();
    await page.getByRole('dialog').getByRole('button', {name: 'Eliminar cliente'}).click();
    await expect(page).toHaveURL(/\/clients$/);

    await page.goto(`/clients/${historicalId}`);
    await expect(page.getByText(`COT-HIST-${suffix}`)).toBeVisible();
    await page.getByRole('button', {name: 'Eliminar cliente'}).click();
    await page.getByRole('dialog').getByRole('button', {name: 'Eliminar cliente'}).click();
    await expect(page.getByRole('dialog')).toContainText(/historial relacionado/i);
    await page.getByRole('dialog').getByRole('button', {name: 'Desactivar cliente'}).click();
    await expect(page.getByText('Inactivo', {exact: true})).toBeVisible();

    await page.goto('/quotes');
    await page.getByTestId('new-quote').click();
    await expect(page.getByRole('dialog').locator(`option[value="${historicalId}"]`)).toHaveCount(
      0,
    );
    await page.getByRole('dialog').getByRole('button', {name: 'Cerrar', exact: true}).click();
    await page.goto(`/clients/${historicalId}`);
    await expect(
      page.getByRole('heading', {name: 'Cliente histórico DEV', exact: true}),
    ).toBeVisible();
  } finally {
    await deleteAdminApp(adminApp);
  }
});

test('deleteClient callable enforces role, dependencies and idempotence', async ({browserName}) => {
  const suffix = `${browserName}-${Date.now()}`;
  const removableId = `callable-removable-${suffix}`;
  const historicalId = `callable-historical-${suffix}`;
  const quoteId = `callable-quote-${suffix}`;
  const adminApp = initializeAdminApp({projectId}, `client-callable-admin-${suffix}`);
  const db = getAdminFirestore(adminApp);
  const now = Timestamp.now();
  const audit = {
    createdAt: now,
    createdBy: 'seed-admin-active',
    updatedAt: now,
    updatedBy: 'seed-admin-active',
    schemaVersion: 1,
  };
  const clientApp = initializeApp(
    {
      apiKey: 'demo-api-key',
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      appId: `callable-${suffix}`,
    },
    `client-callable-web-${suffix}`,
  );
  const auth = getAuth(clientApp);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
  const functions = getFunctions(clientApp, 'us-central1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  try {
    await Promise.all([
      db
        .doc(`clients/${removableId}`)
        .set({name: 'Callable eliminable', status: 'active', operatorIds: [], ...audit}),
      db
        .doc(`clients/${historicalId}`)
        .set({name: 'Callable histórico', status: 'active', operatorIds: [], ...audit}),
      db.doc(`quotes/${quoteId}`).set({
        clientId: historicalId,
        status: 'issued',
        clientSnapshot: {clientId: historicalId, name: 'Callable histórico'},
        ...audit,
      }),
    ]);
    const remove = httpsCallable<{clientId: string}, {outcome: string}>(functions, 'deleteClient');
    await signInWithEmailAndPassword(auth, 'operador@enfriamatic.local', credentials.password);
    await expect(remove({clientId: removableId})).rejects.toMatchObject({
      code: 'functions/permission-denied',
    });
    await auth.signOut();
    await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    await expect(remove({clientId: historicalId})).resolves.toMatchObject({
      data: {outcome: 'has_dependencies'},
    });
    await expect(remove({clientId: removableId})).resolves.toMatchObject({
      data: {outcome: 'deleted'},
    });
    await expect(remove({clientId: removableId})).resolves.toMatchObject({
      data: {outcome: 'already_deleted'},
    });
    expect((await db.doc(`quotes/${quoteId}`).get()).data()?.clientSnapshot).toEqual({
      clientId: historicalId,
      name: 'Callable histórico',
    });
  } finally {
    await auth.signOut();
    await deleteApp(clientApp);
    await deleteAdminApp(adminApp);
  }
});
