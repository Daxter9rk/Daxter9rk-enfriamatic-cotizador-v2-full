import {readFile} from 'node:fs/promises';
import {expect, test, type Page} from '@playwright/test';

const admin = {email: 'admin@enfriamatic.local', password: 'DevOnly!Enfriamatic2026'};

async function login(page: Page, credentials = admin) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: /acceso al sistema/i})).toBeVisible();
  await page.getByTestId('login-email').fill(credentials.email);
  await page.getByTestId('login-password').fill(credentials.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByText(/centro de operación/i)).toBeVisible();
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
  const clientName = `Cliente E2E ${suffix}`;
  const siteName = `Planta E2E ${suffix}`;
  const equipmentName = `Chiller E2E ${suffix}`;
  const requestTitle = `Diagnóstico E2E ${suffix}`;

  await login(page);
  await page.getByRole('link', {name: 'Catálogo comercial', exact: true}).click();
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

  await page.getByRole('link', {name: 'Clientes', exact: true}).click();
  await page.getByTestId('new-clients').click();
  await page.getByTestId('clients-name').fill(clientName);
  await page.getByRole('button', {name: 'Guardar'}).click();
  await expect(page.getByRole('heading', {name: clientName})).toBeVisible();

  await page.getByRole('link', {name: 'Instalaciones', exact: true}).click();
  await page.getByTestId('new-sites').click();
  await page.getByLabel('Cliente').selectOption({label: clientName});
  await page.getByTestId('sites-name').fill(siteName);
  await page.getByLabel('Calle').fill('Avenida Industrial');
  await page.getByLabel('Ciudad').fill('Querétaro');
  await page.getByRole('textbox', {name: 'Estado', exact: true}).fill('Querétaro');
  await page.getByLabel('Código postal').fill('76000');
  await page.getByRole('button', {name: 'Guardar'}).click();
  await expect(page.getByRole('heading', {name: siteName})).toBeVisible();

  await page.getByRole('link', {name: 'Equipos', exact: true}).click();
  await page.getByTestId('new-equipment').click();
  const equipmentDialog = page.getByRole('dialog');
  await equipmentDialog.getByLabel('Cliente').selectOption({label: clientName});
  await equipmentDialog.getByLabel('Instalación').selectOption({label: siteName});
  await equipmentDialog.getByTestId('equipment-name').fill(equipmentName);
  await equipmentDialog.getByLabel('Categoría').fill('Chiller');
  await equipmentDialog.getByRole('button', {name: 'Guardar'}).click();
  await expect(page.getByRole('heading', {name: equipmentName})).toBeVisible();

  await page.getByRole('link', {name: 'Solicitudes', exact: true}).click();
  await page.getByTestId('new-request').click();
  const requestDialog = page.getByRole('dialog');
  await requestDialog.getByLabel('Cliente').fill(clientName);
  await requestDialog.getByRole('option', {name: clientName}).click();
  await requestDialog.getByLabel('Instalación', {exact: true}).fill(siteName);
  await requestDialog.getByRole('option', {name: siteName}).click();
  await requestDialog.getByLabel('Equipo específico').check();
  await requestDialog.getByLabel('Equipo', {exact: true}).fill(equipmentName);
  await requestDialog.getByRole('option', {name: equipmentName}).click();
  await requestDialog.getByTestId('request-title').fill(requestTitle);
  await requestDialog.getByLabel('Descripción').fill('Validación integral con emuladores.');
  await requestDialog.getByLabel('Responsable (opcional)').fill('Operador Emulador');
  await requestDialog.getByRole('option', {name: /Operador Emulador/}).click();
  await requestDialog.getByRole('button', {name: 'Crear solicitud'}).click();
  await expect(page.getByText(requestTitle)).toBeVisible();
  await page.getByRole('link', {name: 'Solicitudes', exact: true}).click();
  await page.getByText(requestTitle).click();
  await page.getByRole('button', {name: 'Iniciar solicitud'}).click();
  await page.getByRole('link', {name: 'Cotizaciones', exact: true}).click();
  await page.getByTestId('new-quote').click();
  await page.getByTestId('quote-client').selectOption({label: clientName});
  await page.getByTestId('quote-request').selectOption({label: requestTitle});
  await page.getByRole('button', {name: 'Crear cotización'}).click();

  await page.getByRole('button', {name: 'Agregar Compresor emulador'}).click();
  await page.getByRole('button', {name: 'Agregar Servicio emulador'}).click();
  await page.getByRole('button', {name: 'Editar'}).first().click();
  await page.getByTestId('quote-item-description').fill(`${productName} ajustado en partida`);
  await page.getByRole('button', {name: 'Guardar cambios de partida'}).click();
  await expect(page.getByRole('button', {name: 'Agregar partida manual'})).toBeVisible();

  await page.getByTestId('quote-item-description').fill('Diagnóstico técnico manual');
  await page.getByTestId('quote-item-price').fill('2500');
  await page.getByRole('combobox', {name: 'Descuento', exact: true}).selectOption('percentage');
  await page.getByLabel('Valor descuento').fill('10');
  await page.getByRole('button', {name: 'Agregar partida manual'}).click();
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
  await page.getByRole('link', {name: 'Cotizaciones', exact: true}).click();
  await page.getByRole('heading', {name: issuedFolio}).click();
  await page.getByRole('button', {name: 'Marcar aceptada'}).click();
  await page.getByRole('button', {name: 'Confirmar'}).click();
  await expect(page.getByText(/estado actualizado a aceptada/i)).toBeVisible();
  await page.getByRole('button', {name: 'Crear corrección'}).click();
  await expect(page.getByRole('dialog').getByText('Borrador', {exact: true})).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('dialog').getByRole('button', {name: 'Cerrar', exact: true}).click();
  await page.getByRole('link', {name: 'Actividad', exact: true}).click();
  await expect(page.getByText(/marcó como enviada la cotización/i)).toBeVisible();
  await expect(page.getByText(/aceptó la cotización/i)).toBeVisible();
  await expect
    .poll(
      async () => {
        await page.getByRole('button', {name: 'Actualizar'}).click();
        return page.getByText(/creó una corrección de la cotización/i).count();
      },
      {
        timeout: 15_000,
        intervals: [250, 500, 1000],
        message:
          'El evento quote.correction_created no apareció después de refrescar la auditoría.',
      },
    )
    .toBeGreaterThan(0);
});
