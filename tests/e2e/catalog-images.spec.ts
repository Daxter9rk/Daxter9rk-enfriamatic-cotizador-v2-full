import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {deleteApp as deleteAdminApp, initializeApp as initializeAdminApp} from 'firebase-admin/app';
import {Timestamp, getFirestore as getAdminFirestore} from 'firebase-admin/firestore';
import {deleteApp, initializeApp, type FirebaseApp} from 'firebase/app';
import {connectAuthEmulator, getAuth, signInWithEmailAndPassword} from 'firebase/auth';
import {connectFunctionsEmulator, getFunctions, httpsCallable} from 'firebase/functions';
import {expect, test, type Page} from '@playwright/test';

const projectId = 'demo-enfriamatic';
const password = 'DevOnly!Enfriamatic2026';
const requireFromFunctions = createRequire(resolve('functions/package.json'));

interface SharpPipeline {
  jpeg(): SharpPipeline;
  png(): SharpPipeline;
  webp(): SharpPipeline;
  toBuffer(): Promise<Buffer>;
}
type SharpFactory = (input: {
  create: {width: number; height: number; channels: 4; background: string};
}) => SharpPipeline;
const sharp = requireFromFunctions('sharp') as SharpFactory;

async function listEmulatorObjects(prefix: string): Promise<string[]> {
  const bucket = `${projectId}.appspot.com`;
  const url = new URL(`http://127.0.0.1:9199/v0/b/${bucket}/o`);
  url.searchParams.set('prefix', prefix);
  const response = await fetch(url, {headers: {Authorization: 'Bearer owner'}});
  if (!response.ok) throw new Error(`Storage Emulator list failed with HTTP ${response.status}.`);
  const body = (await response.json()) as {items?: Array<{name?: unknown}>};
  return (body.items ?? [])
    .map((item) => item.name)
    .filter((name): name is string => typeof name === 'string');
}

async function login(page: Page, email: string) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByText(/centro comercial/i)).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole('button', {name: 'Cerrar sesión'}).click();
  await expect(page.getByTestId('login-submit')).toBeVisible();
}

test('catalog images use protected callables with persistence, authorization and idempotency', async ({
  browserName,
}, testInfo) => {
  const suffix = `${browserName}-${testInfo.project.name}-${Date.now()}`;
  const itemId = `CAT-IMG-${String(Date.now()).slice(-8)}`;
  const adminApp = initializeAdminApp(
    {projectId, storageBucket: `${projectId}.appspot.com`},
    `catalog-image-admin-${suffix}`,
  );
  const db = getAdminFirestore(adminApp);
  const now = Timestamp.now();
  await db.doc(`catalogItems/${itemId}`).set({
    code: itemId,
    type: 'product',
    name: 'Artículo con imagen E2E',
    description: 'Prueba integral de imagen privada.',
    category: 'Pruebas',
    unit: 'pieza',
    brand: null,
    model: null,
    basePrice: 10,
    taxable: true,
    status: 'active',
    searchTokens: ['imagen', 'e2e'],
    createdAt: now,
    createdBy: 'seed-admin-active',
    updatedAt: now,
    updatedBy: 'seed-admin-active',
    schemaVersion: 1,
  });

  const clients: FirebaseApp[] = [];
  const callAs = async (email: string | null, name: string, data: unknown) => {
    const app = initializeApp(
      {
        apiKey: 'demo-api-key',
        authDomain: `${projectId}.firebaseapp.com`,
        projectId,
        appId: `1:000000000000:web:${clients.length}`,
      },
      `catalog-image-client-${suffix}-${clients.length}`,
    );
    clients.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
    if (email) await signInWithEmailAndPassword(auth, email, password);
    const functions = getFunctions(app, 'us-central1');
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    return httpsCallable(functions, name)(data);
  };

  const source = {create: {width: 4, height: 3, channels: 4 as const, background: '#1261d8'}};
  const jpeg = await sharp(source).jpeg().toBuffer();
  const png = await sharp(source).png().toBuffer();
  const webp = await sharp(source).webp().toBuffer();
  const firstOperation = `add-${String(Date.now())}`;
  const secondOperation = `change-png-${String(Date.now())}`;
  const thirdOperation = `change-webp-${String(Date.now())}`;

  try {
    const firstPayload = {
      catalogItemId: itemId,
      operationId: firstOperation,
      base64: jpeg.toString('base64'),
      originalFileName: 'primera.jpg',
      declaredMimeType: 'image/jpeg',
    };
    await callAs('admin@enfriamatic.local', 'upsertCatalogImage', firstPayload);
    const repeated = await callAs('admin@enfriamatic.local', 'upsertCatalogImage', firstPayload);
    expect(repeated.data).toMatchObject({idempotent: true, status: 'ready'});

    await callAs('admin.promovido@enfriamatic.local', 'upsertCatalogImage', {
      catalogItemId: itemId,
      operationId: secondOperation,
      base64: png.toString('base64'),
      originalFileName: 'segunda.png',
      declaredMimeType: 'image/png',
    });
    await callAs('admin.promovido@enfriamatic.local', 'upsertCatalogImage', {
      catalogItemId: itemId,
      operationId: thirdOperation,
      base64: webp.toString('base64'),
      originalFileName: 'tercera.webp',
      declaredMimeType: 'image/webp',
    });

    const operatorRead = await callAs('operador@enfriamatic.local', 'getCatalogImageContent', {
      catalogItemId: itemId,
    });
    expect(operatorRead.data).toMatchObject({mimeType: 'image/webp', width: 4, height: 3});

    await expect(
      callAs('operador@enfriamatic.local', 'upsertCatalogImage', firstPayload),
    ).rejects.toMatchObject({code: 'functions/permission-denied'});
    await expect(
      callAs('inactivo@enfriamatic.local', 'upsertCatalogImage', firstPayload),
    ).rejects.toMatchObject({code: 'functions/permission-denied'});
    await expect(
      callAs('sinperfil@enfriamatic.local', 'upsertCatalogImage', firstPayload),
    ).rejects.toMatchObject({code: 'functions/permission-denied'});
    await expect(callAs(null, 'upsertCatalogImage', firstPayload)).rejects.toMatchObject({
      code: 'functions/unauthenticated',
    });
    await expect(
      callAs('admin@enfriamatic.local', 'upsertCatalogImage', {
        ...firstPayload,
        catalogItemId: 'CAT-NOT-FOUND',
        operationId: `missing-${String(Date.now())}`,
      }),
    ).rejects.toMatchObject({code: 'functions/not-found'});
    await expect(
      callAs('admin@enfriamatic.local', 'upsertCatalogImage', {
        ...firstPayload,
        operationId: `invalid-${String(Date.now())}`,
        declaredMimeType: 'image/png',
      }),
    ).rejects.toMatchObject({code: 'functions/invalid-argument'});
    await expect(
      callAs('admin@enfriamatic.local', 'upsertCatalogImage', {
        ...firstPayload,
        operationId: `path-${String(Date.now())}`,
        storagePath: 'arbitrary/path.jpg',
      }),
    ).rejects.toMatchObject({code: 'functions/invalid-argument'});

    const filesBeforeDelete = await listEmulatorObjects(`catalog-items/${itemId}/images/`);
    expect(filesBeforeDelete).toHaveLength(1);
    const deleteOperation = `delete-${String(Date.now())}`;
    await callAs('admin@enfriamatic.local', 'deleteCatalogImage', {
      catalogItemId: itemId,
      operationId: deleteOperation,
    });
    const repeatedDelete = await callAs('admin@enfriamatic.local', 'deleteCatalogImage', {
      catalogItemId: itemId,
      operationId: deleteOperation,
    });
    expect(repeatedDelete.data).toMatchObject({idempotent: true, status: 'deleted'});
    const emptyDelete = await callAs('admin@enfriamatic.local', 'deleteCatalogImage', {
      catalogItemId: itemId,
      operationId: `delete-empty-${String(Date.now())}`,
    });
    expect(emptyDelete.data).toMatchObject({deleted: false, status: 'deleted'});

    const item = (await db.doc(`catalogItems/${itemId}`).get()).data() ?? {};
    expect(item.imageStoragePath).toBeNull();
    const filesAfterDelete = await listEmulatorObjects(`catalog-items/${itemId}/images/`);
    expect(filesAfterDelete).toHaveLength(0);
    const audit = await db.collection('auditLogs').where('resourceId', '==', itemId).get();
    const actions = audit.docs.map((document) => {
      const data = document.data() as {action?: unknown};
      return typeof data.action === 'string' ? data.action : '';
    });
    expect(actions).toEqual(
      expect.arrayContaining([
        'catalog.image_added',
        'catalog.image_changed',
        'catalog.image_deleted',
      ]),
    );
  } finally {
    await Promise.all(clients.map((app) => deleteApp(app)));
    await deleteAdminApp(adminApp);
  }
});

test('commercial catalog UI persists a private image and keeps operator read-only', async ({
  page,
  browserName,
}, testInfo) => {
  const suffix = `${browserName}-${testInfo.project.name}-${Date.now()}`;
  const shortSuffix = String(Date.now()).slice(-8);
  const itemId = `CAT-UI-${shortSuffix}`;
  const itemName = `Artículo imagen UI ${shortSuffix}`;
  const adminApp = initializeAdminApp(
    {projectId, storageBucket: `${projectId}.appspot.com`},
    `catalog-ui-admin-${suffix}`,
  );
  const db = getAdminFirestore(adminApp);
  const now = Timestamp.now();
  await db.doc(`catalogItems/${itemId}`).set({
    code: itemId,
    type: 'product',
    name: itemName,
    description: 'Validación de persistencia visual.',
    category: 'Pruebas',
    unit: 'pieza',
    brand: null,
    model: null,
    basePrice: 15,
    taxable: true,
    status: 'active',
    searchTokens: ['artículo', 'imagen', 'ui', shortSuffix],
    createdAt: now,
    createdBy: 'seed-admin-active',
    updatedAt: now,
    updatedBy: 'seed-admin-active',
    schemaVersion: 1,
  });
  const image = await sharp({
    create: {width: 6, height: 4, channels: 4, background: '#0b3b8f'},
  })
    .png()
    .toBuffer();

  try {
    await login(page, 'admin@enfriamatic.local');
    await page
      .getByRole('navigation', {name: 'Operación'})
      .getByRole('link', {name: 'Catálogo comercial', exact: true})
      .click();
    await page.getByPlaceholder('Código, nombre, marca o modelo…').fill(shortSuffix);
    let card = page.locator('article.catalog-card').filter({
      has: page.getByRole('heading', {name: itemName}),
    });
    await expect(card.getByRole('button', {name: 'Agregar imagen'})).toBeVisible();
    await card.locator('input[type="file"]').setInputFiles({
      name: 'catalogo.png',
      mimeType: 'image/png',
      buffer: image,
    });
    await expect(card.getByRole('img', {name: `Imagen de ${itemName}`})).toBeVisible();
    await expect(card.getByRole('button', {name: 'Cambiar imagen'})).toBeVisible();

    await page.reload({waitUntil: 'domcontentloaded'});
    card = page.locator('article.catalog-card').filter({
      has: page.getByRole('heading', {name: itemName}),
    });
    await expect(card.getByRole('img', {name: `Imagen de ${itemName}`})).toBeVisible();
    await logout(page);

    await login(page, 'operador@enfriamatic.local');
    await page
      .getByRole('navigation', {name: 'Operación'})
      .getByRole('link', {name: 'Catálogo comercial', exact: true})
      .click();
    await page.getByPlaceholder('Código, nombre, marca o modelo…').fill(shortSuffix);
    card = page.locator('article.catalog-card').filter({
      has: page.getByRole('heading', {name: itemName}),
    });
    await expect(card.getByRole('img', {name: `Imagen de ${itemName}`})).toBeVisible();
    await expect(card.getByRole('button', {name: /imagen/i})).toHaveCount(0);
    await logout(page);

    await login(page, 'admin@enfriamatic.local');
    await page
      .getByRole('navigation', {name: 'Operación'})
      .getByRole('link', {name: 'Catálogo comercial', exact: true})
      .click();
    await page.getByPlaceholder('Código, nombre, marca o modelo…').fill(shortSuffix);
    card = page.locator('article.catalog-card').filter({
      has: page.getByRole('heading', {name: itemName}),
    });
    page.once('dialog', (dialog) => dialog.accept());
    await card.getByRole('button', {name: 'Eliminar imagen'}).click();
    await expect(card.getByRole('button', {name: 'Agregar imagen'})).toBeVisible();
    await page.reload({waitUntil: 'domcontentloaded'});
    card = page.locator('article.catalog-card').filter({
      has: page.getByRole('heading', {name: itemName}),
    });
    await expect(card.getByRole('img', {name: `Imagen de ${itemName}`})).toHaveCount(0);
    await expect(page.getByRole('link', {name: 'Actividad', exact: true})).toHaveCount(0);
  } finally {
    await deleteAdminApp(adminApp);
  }
});
