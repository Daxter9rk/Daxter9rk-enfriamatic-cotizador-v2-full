import {deleteApp, initializeApp} from 'firebase/app';
import {connectAuthEmulator, getAuth, signInWithEmailAndPassword} from 'firebase/auth';
import {connectFunctionsEmulator, getFunctions, httpsCallable} from 'firebase/functions';
import {expect, test, type Page} from '@playwright/test';

const credentials = {
  admin: {
    email: 'admin@enfriamatic.local',
    password: 'DevOnly!Enfriamatic2026',
  },
  operator: {
    email: 'operador@enfriamatic.local',
    password: 'DevOnly!Enfriamatic2026',
  },
};

async function login(
  page: Page,
  user: {
    email: string;
    password: string;
  },
) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await page.getByTestId('login-email').fill(user.email);
  await page.getByTestId('login-password').fill(user.password);
  await page.getByTestId('login-submit').click();

  await expect(page.getByText(/centro comercial/i)).toBeVisible();
}

async function openIndependentQuote(page: Page) {
  await page
    .getByRole('navigation', {name: 'Operación'})
    .getByRole('link', {name: 'Cotizaciones', exact: true})
    .click();

  await page.getByTestId('new-quote').click();

  await page.getByTestId('quote-client').selectOption({label: 'Procesos Fríos del Bajío'});

  await expect(page.locator('select[name="siteId"]')).toHaveCount(0);
  await expect(page.locator('select[name="equipmentId"]')).toHaveCount(0);
}

function getPreviewDialog(page: Page) {
  return page.getByRole('dialog', {
    name: 'Vista previa',
  });
}

test('admin creates, edits, previews and reloads an independent quote', async ({page}) => {
  await login(page, credentials.admin);
  await openIndependentQuote(page);

  await page.locator('select[name="assignedTo"]').selectOption('seed-operator-active');

  await page.getByRole('button', {name: 'Crear cotización'}).click();

  await page.locator('input[name="serviceReference"]').fill('Servicio preventivo independiente');

  await page
    .locator('textarea[name="technicalContext"]')
    .fill('Contexto técnico capturado como texto.');

  await page.getByRole('button', {name: 'Agregar Compresor emulador'}).click();

  await page.locator('form.quote-context-form button').click();

  await page.getByRole('button', {name: 'Vista previa'}).click();

  const initialPreviewDialog = getPreviewDialog(page);

  await expect(initialPreviewDialog).toContainText('Procesos Fríos del Bajío');

  await page.getByRole('button', {name: 'Cerrar vista previa'}).click();

  await expect(page.getByTestId('issue-quote')).toBeEnabled();
  await page.getByTestId('issue-quote').click();

  await expect(page.getByRole('dialog').getByText('Emitida', {exact: true}).first()).toBeVisible();

  const originalFolio =
    (await page
      .getByRole('dialog')
      .getByRole('heading', {name: /^COT-\d{4}-\d{6}$/})
      .textContent()) ?? '';

  const originalQuoteId = new URL(page.url()).searchParams.get('quote');

  expect(originalQuoteId).toBeTruthy();

  const clientApp = initializeApp(
    {
      apiKey: 'demo-api-key',
      authDomain: 'demo-enfriamatic.firebaseapp.com',
      projectId: 'demo-enfriamatic',
      appId: `1:000000000000:web:correction-${Date.now()}`,
    },
    `correction-idempotency-${Date.now()}`,
  );

  const clientAuth = getAuth(clientApp);

  connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });

  const clientFunctions = getFunctions(clientApp, 'us-central1');

  connectFunctionsEmulator(clientFunctions, '127.0.0.1', 5001);

  await signInWithEmailAndPassword(clientAuth, credentials.admin.email, credentials.admin.password);

  const correctionKey = crypto.randomUUID();

  const createCorrection = httpsCallable<
    {
      quoteId: string;
      idempotencyKey: string;
    },
    {
      quoteId: string;
      idempotent: boolean;
      revisionNumber: number;
    }
  >(clientFunctions, 'createCorrection');

  const [firstCorrection, repeatedCorrection] = await Promise.all([
    createCorrection({
      quoteId: originalQuoteId!,
      idempotencyKey: correctionKey,
    }),
    createCorrection({
      quoteId: originalQuoteId!,
      idempotencyKey: correctionKey,
    }),
  ]);

  expect(firstCorrection.data.quoteId).toBe(repeatedCorrection.data.quoteId);

  expect([firstCorrection.data.idempotent, repeatedCorrection.data.idempotent].sort()).toEqual([
    false,
    true,
  ]);

  const [parallelA, parallelB] = await Promise.all([
    createCorrection({
      quoteId: originalQuoteId!,
      idempotencyKey: crypto.randomUUID(),
    }),
    createCorrection({
      quoteId: originalQuoteId!,
      idempotencyKey: crypto.randomUUID(),
    }),
  ]);

  expect(new Set([parallelA.data.revisionNumber, parallelB.data.revisionNumber]).size).toBe(2);

  await clientAuth.signOut();
  await deleteApp(clientApp);

  const originalDownload = page.waitForEvent('download');

  await page.getByRole('button', {name: 'Descargar PDF'}).click();

  expect((await originalDownload).suggestedFilename()).toMatch(/\.pdf$/);

  await page.reload({waitUntil: 'domcontentloaded'});

  await expect(page.getByRole('dialog').getByText('Emitida', {exact: true}).first()).toBeVisible();

  await expect(page.locator('form.quote-context-form')).toHaveCount(0);

  await page.getByRole('button', {name: 'Vista previa'}).click();

  const reloadedPreviewDialog = getPreviewDialog(page);

  await expect(reloadedPreviewDialog).toContainText('Servicio preventivo independiente');

  await expect(reloadedPreviewDialog).toContainText('Contexto técnico capturado como texto.');

  await page.getByRole('button', {name: 'Cerrar vista previa'}).click();

  await page.getByRole('button', {name: 'Crear corrección'}).click();

  await expect(page.getByRole('dialog').getByText('Borrador', {exact: true})).toBeVisible();

  await expect(page.locator('input[name="serviceReference"]')).toHaveValue(
    'Servicio preventivo independiente',
  );

  await expect(page.locator('textarea[name="technicalContext"]')).toHaveValue(
    'Contexto técnico capturado como texto.',
  );

  await expect(
    page.getByRole('dialog').getByRole('heading', {name: 'Editor de cotización'}),
  ).toBeVisible();

  await page.getByRole('button', {name: 'Editar'}).first().click();

  await page.getByTestId('quote-item-price').fill('11000');

  await page
    .getByRole('button', {
      name: 'Guardar cambios de partida',
    })
    .click();

  await page.getByTestId('issue-quote').click();

  await expect(page.getByRole('dialog').getByText('Emitida', {exact: true}).first()).toBeVisible();

  const correctedFolio =
    (await page
      .getByRole('dialog')
      .getByRole('heading', {name: /^COT-\d{4}-\d{6}$/})
      .textContent()) ?? '';

  expect(correctedFolio).toMatch(/^COT-\d{4}-\d{6}$/);
  expect(correctedFolio).not.toBe(originalFolio);

  const correctedDownload = page.waitForEvent('download');

  await page.getByRole('button', {name: 'Descargar PDF'}).click();

  expect((await correctedDownload).suggestedFilename()).toBe(`${correctedFolio}.pdf`);

  await page.getByRole('dialog').getByRole('button', {name: 'Cerrar', exact: true}).click();

  await page
    .getByRole('button', {
      name: new RegExp(originalFolio),
    })
    .click();

  await expect(page.getByRole('dialog').getByText('Emitida', {exact: true}).first()).toBeVisible();

  await expect(page.getByRole('dialog').locator('form.quote-context-form')).toHaveCount(0);
});

test('operator creates an independent quote assigned to self and cannot reassign it', async ({
  page,
}) => {
  await login(page, credentials.operator);
  await openIndependentQuote(page);

  await page.getByRole('button', {name: 'Crear cotización'}).click();

  await expect(page.locator('select[name="assignedTo"]')).toHaveCount(0);

  await page.getByRole('button', {name: 'Agregar Compresor emulador'}).click();

  await expect(page.getByTestId('issue-quote')).toBeEnabled();
  await page.getByTestId('issue-quote').click();

  await expect(page.getByRole('dialog').getByText('Emitida', {exact: true}).first()).toBeVisible();

  const download = page.waitForEvent('download');

  await page.getByRole('button', {name: 'Descargar PDF'}).click();

  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);

  await page.getByRole('button', {name: 'Vista previa'}).click();

  const operatorPreviewDialog = getPreviewDialog(page);

  await expect(operatorPreviewDialog).toContainText('Procesos Fríos del Bajío');
});

test('admin validates the quote editor phase two interactions', async ({page}) => {
  await login(page, credentials.admin);
  await openIndependentQuote(page);
  await page.getByRole('button', {name: 'Crear cotización'}).click();

  const catalogAddButton = page.locator('.quote-catalog button[aria-label^="Agregar "]').first();
  await expect(catalogAddButton).toBeVisible();
  await catalogAddButton.click();

  const manualOpenButton = page.getByRole('button', {name: 'Agregar partida manual'});
  await manualOpenButton.click();
  await page.getByTestId('quote-item-description').fill('Partida cancelada');
  await page.getByRole('button', {name: 'Cancelar', exact: true}).click();
  await expect(page.getByText('Partida cancelada')).toHaveCount(0);
  await expect(manualOpenButton).toBeFocused();

  await manualOpenButton.click();
  await page.getByTestId('quote-item-description').fill('Partida manual');
  await page.getByTestId('quote-item-price').fill('1000');
  await page.getByRole('button', {name: 'Agregar partida', exact: true}).click();
  await expect(page.locator('.quote-items article').filter({hasText: 'Partida manual'})).toBeVisible();

  const manualRow = page.locator('.quote-items article').filter({hasText: 'Partida manual'});
  await manualRow.getByRole('button', {name: 'Editar'}).click();
  await page.getByTestId('quote-item-description').fill('Cambio cancelado');
  await page.getByRole('button', {name: 'Cancelar', exact: true}).click();
  await expect(page.locator('.quote-items article').filter({hasText: 'Partida manual'})).toBeVisible();
  await expect(page.getByText('Cambio cancelado')).toHaveCount(0);

  await page
    .locator('.quote-items article')
    .filter({hasText: 'Partida manual'})
    .getByRole('button', {name: 'Editar'})
    .click();
  await page.getByTestId('quote-item-description').fill('Partida guardada');
  await page.getByRole('button', {name: 'Guardar cambios', exact: true}).click();
  await expect(page.getByText('Partida guardada')).toBeVisible();

  const discountType = page.getByRole('combobox', {name: 'Tipo de descuento global'});
  const discountValue = page.getByRole('spinbutton', {name: 'Valor del descuento global'});
  await discountType.selectOption('percentage');
  await discountValue.fill('10');
  await expect(page.getByText('Descuento global', {exact: true})).toBeVisible();
  const percentageTotal = await page.locator('.totals-card__grand strong').textContent();

  await page.getByRole('button', {name: 'Guardar datos de cotización'}).click();
  await expect(page.getByText('Datos de la cotización guardados.')).toBeVisible();
  const quoteEditorId = await page
    .locator('[data-testid^="quote-editor-"]')
    .getAttribute('data-testid');
  if (!quoteEditorId) throw new Error('No se encontró el editor de la cotización.');
  const quoteId = quoteEditorId.replace('quote-editor-', '');
  await page.getByRole('dialog').getByRole('button', {name: 'Cerrar', exact: true}).click();
  await page.getByTestId(`quote-${quoteId}`).click();
  await expect(discountType).toHaveValue('percentage');
  await expect(discountValue).toHaveValue('10');
  await expect(page.locator('.totals-card__grand strong')).toHaveText(percentageTotal ?? '');

  await page.getByRole('combobox', {name: 'Tipo de descuento global'}).selectOption('fixed');
  await page.getByRole('spinbutton', {name: 'Valor del descuento global'}).fill('50');
  await page.getByRole('switch', {name: 'Aplicar IVA 16 %'}).click();
  await expect(page.getByText('IVA desactivado')).toBeVisible();
  await expect(page.locator('.totals-card__grand strong')).not.toHaveText(percentageTotal ?? '');
  await page.getByRole('switch', {name: 'Aplicar IVA 16 %'}).click();

  const previewButton = page.getByRole('button', {name: 'Vista previa'});
  await previewButton.click();
  await expect(page.getByRole('dialog', {name: 'Vista previa'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', {name: 'Vista previa'})).toHaveCount(0);
  await expect(page.getByTestId('issue-quote')).toBeVisible();
  await expect(previewButton).toBeFocused();
});
