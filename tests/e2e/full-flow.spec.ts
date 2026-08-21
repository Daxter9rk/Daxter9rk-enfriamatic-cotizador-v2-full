import {readFile} from 'node:fs/promises';
import {expect, test, type Page} from '@playwright/test';

const admin = {email: 'admin@enfriamatic.local', password: 'DevOnly!Enfriamatic2026'};

async function login(page: Page, credentials = admin) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: /acceso al sistema/i})).toBeVisible();
  await page.getByTestId('login-email').fill(credentials.email);
  await page.getByTestId('login-password').fill(credentials.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByText(/centro comercial/i)).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole('button', {name: 'Cerrar sesión'}).click();
  await expect(page.getByTestId('login-submit')).toBeVisible();
}

async function createCatalogItem(
  page: Page,
  input: {code: string; type: 'product' | 'service'; name: string; price: string},
) {
  await page.getByRole('button', {name: 'Nuevo artículo'}).click();
  const dialog = page.getByRole('dialog', {name: 'Nuevo artículo comercial'});
  await dialog.getByLabel('Código').fill(input.code);
  await dialog.getByLabel('Tipo').selectOption(input.type);
  await dialog.getByLabel('Nombre').fill(input.name);
  await dialog.getByLabel('Descripción').fill(`${input.name} para validación integral.`);
  await dialog.getByLabel('Categoría').fill(input.type === 'product' ? 'Repuestos' : 'Servicios');
  await dialog.getByLabel('Unidad').fill(input.type === 'product' ? 'pieza' : 'servicio');
  await dialog.getByLabel('Precio base (MXN)').fill(input.price);
  await dialog.getByRole('button', {name: 'Guardar artículo'}).click();
  await expect(page.getByRole('heading', {name: input.name})).toBeVisible();
}

test('flujo integral catálogo → cotización → PDF → sent → accepted → corrección', async ({
  page,
}) => {
  const suffix = String(Date.now()).slice(-7);
  const productName = `Producto E2E ${suffix}`;
  const serviceName = `Servicio E2E ${suffix}`;
  const clientName = 'Procesos Fríos del Bajío';

  await login(page);
  await page
    .getByRole('navigation', {name: 'Operación'})
    .getByRole('link', {name: 'Catálogo comercial', exact: true})
    .click();
  await createCatalogItem(page, {
    code: `PROD-E2E-${suffix}`,
    type: 'product',
    name: productName,
    price: '10000',
  });
  await createCatalogItem(page, {
    code: `SERV-E2E-${suffix}`,
    type: 'service',
    name: serviceName,
    price: '2000',
  });

  await page.goto('/quotes', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'Cotizaciones'})).toBeVisible();
  await page
    .getByRole('navigation', {name: 'Operación'})
    .getByRole('link', {name: 'Cotizaciones', exact: true})
    .click();
  await page.getByTestId('new-quote').click();
  await page.getByPlaceholder('Buscar por código o nombre...').click();
  await page.locator('button[role="option"]', {hasText: clientName}).click();
  await page.getByRole('button', {name: 'Crear cotización'}).click();

  await page.getByRole('button', {name: 'Agregar Compresor emulador'}).click();
  await page.getByRole('button', {name: 'Agregar Servicio emulador'}).click();
  await page.getByRole('button', {name: 'Editar'}).first().click();
  await page.getByTestId('quote-item-description').fill(`${productName} ajustado en partida`);
  await page.getByRole('button', {name: 'Guardar cambios'}).click();
  await expect(page.getByRole('button', {name: 'Agregar partida manual'})).toBeVisible();

  await page.getByRole('button', {name: 'Agregar partida'}).click();
  await page.getByTestId('quote-item-description').fill('Diagnóstico técnico manual');
  await page.getByTestId('quote-item-price').fill('2500');
  await page.getByRole('combobox', {name: 'Descuento', exact: true}).selectOption('percentage');
  await page.getByLabel('Valor descuento').fill('10');
  await page.getByRole('button', {name: 'Agregar partida'}).click();
  await expect(page.getByText(/\$16,530\.00/)).toBeVisible();
  await page.getByRole('button', {name: 'Vista previa'}).click();
  await expect(page.getByText(/BORRADOR/)).toBeVisible();
  await page.getByRole('button', {name: 'Cerrar vista previa'}).click();
  await page.getByTestId('issue-quote').click();
  await expect(page.getByText(/emitida correctamente/i)).toBeVisible({timeout: 30_000});
  await expect(page.getByRole('button', {name: 'Agregar partida manual'})).toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Descargar PDF'}).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('Playwright no proporcionó la ruta de descarga.');
  const bytes = await readFile(downloadPath);
  expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  const issuedFolio =
    (await page
      .getByRole('dialog')
      .getByRole('heading', {name: /^COT-\d{4}-\d{6}$/})
      .textContent()) ?? '';
  expect(issuedFolio).toMatch(/^COT-\d{4}-\d{6}$/);

  await page.getByRole('button', {name: 'Marcar enviada'}).click();
  await page.getByRole('button', {name: 'Confirmar'}).click();
  await expect(page.getByText(/estado actualizado a enviada/i)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', {name: 'Cerrar', exact: true}).click();
  await logout(page);

  await login(page);
  await page
    .getByRole('navigation', {name: 'Operación'})
    .getByRole('link', {name: 'Cotizaciones', exact: true})
    .click();
  await page.getByRole('heading', {name: issuedFolio}).click();
  await page.getByRole('button', {name: 'Marcar aceptada'}).click();
  await page.getByRole('button', {name: 'Confirmar'}).click();
  await expect(page.getByText(/estado actualizado a aceptada/i)).toBeVisible();
  await page.getByRole('button', {name: 'Crear corrección'}).click();
  await expect(page.getByRole('dialog').getByText('Borrador', {exact: true})).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('dialog').getByRole('button', {name: 'Cerrar', exact: true}).click();
  await expect(page.getByRole('link', {name: 'Actividad', exact: true})).toHaveCount(0);
});
