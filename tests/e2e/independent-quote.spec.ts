import {expect, test, type Page} from '@playwright/test';

const credentials = {
  admin: {email: 'admin@enfriamatic.local', password: 'DevOnly!Enfriamatic2026'},
  operator: {email: 'operador@enfriamatic.local', password: 'DevOnly!Enfriamatic2026'},
};

async function login(page: Page, user: {email: string; password: string}) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await page.getByTestId('login-email').fill(user.email);
  await page.getByTestId('login-password').fill(user.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByText(/centro de operación/i)).toBeVisible();
}

async function openIndependentQuote(page: Page) {
  await page.getByRole('link', {name: 'Cotizaciones', exact: true}).click();
  await page.getByTestId('new-quote').click();
  await page.getByTestId('quote-client').selectOption({label: 'Procesos Fríos del Bajío'});
  await expect(page.locator('select[name="siteId"]')).toHaveCount(0);
  await expect(page.locator('select[name="equipmentId"]')).toHaveCount(0);
}

test('admin creates, edits, previews and reloads an independent quote', async ({page}) => {
  await login(page, credentials.admin);
  await openIndependentQuote(page);
  await page.locator('input[name="serviceReference"]').fill('Servicio preventivo independiente');
  await page
    .locator('textarea[name="technicalContext"]')
    .fill('Contexto técnico capturado como texto.');
  await page.locator('select[name="assignedTo"]').selectOption('seed-operator-active');
  await page.getByRole('button', {name: 'Crear cotización'}).click();

  await page.getByRole('button', {name: 'Agregar Compresor emulador'}).click();
  await page.locator('form.quote-context-form button').click();
  await page.getByRole('button', {name: 'Vista previa'}).click();
  await expect(page.getByRole('dialog')).toContainText('Procesos Fríos del Bajío');
  await page.getByRole('button', {name: 'Cerrar vista previa'}).click();
  await expect(page.getByTestId('issue-quote')).toBeEnabled();
  await page.getByTestId('issue-quote').click();
  await expect(page.getByRole('dialog').getByText('Emitida', {exact: true}).first()).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Descargar PDF'}).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);

  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('dialog').getByText('Emitida', {exact: true}).first()).toBeVisible();
  await expect(page.locator('form.quote-context-form')).toHaveCount(0);
  await page.getByRole('button', {name: 'Vista previa'}).click();
  await expect(page.getByRole('dialog')).toContainText('Servicio preventivo independiente');
  await expect(page.getByRole('dialog')).toContainText('Contexto técnico capturado como texto.');
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
  await expect(page.getByRole('dialog')).toContainText('Procesos Fríos del Bajío');
});
