import {readFile} from 'node:fs/promises';
import {expect, test, type Page} from '@playwright/test';

const admin = {
  email: 'admin@enfriamatic.local',
  password: 'DevOnly!Enfriamatic2026',
};
const operator = {
  email: 'operador@enfriamatic.local',
  password: 'DevOnly!Enfriamatic2026',
};

async function login(page: Page, credentials = admin) {
  await page.goto('/');
  await expect(page.getByRole('heading', {name: /cotizaciones técnicas/i})).toBeVisible();
  await page.getByTestId('login-email').fill(credentials.email);
  await page.getByTestId('login-password').fill(credentials.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByText(/centro de operación/i)).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole('button', {name: 'Cerrar sesión'}).click();
  await expect(page.getByTestId('login-submit')).toBeVisible();
}

test('flujo integral admin → operador → PDF → auditoría → corrección', async ({page}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'El flujo mutante se ejecuta una sola vez.',
  );
  const suffix = String(Date.now()).slice(-7);
  const clientName = `Cliente E2E ${suffix}`;
  const siteName = `Planta E2E ${suffix}`;
  const equipmentName = `Chiller E2E ${suffix}`;
  const requestTitle = `Diagnóstico E2E ${suffix}`;

  await login(page);

  await page.getByRole('link', {name: 'Clientes'}).click();
  await page.getByTestId('new-clients').click();
  await page.getByTestId('clients-name').fill(clientName);
  await page.getByRole('button', {name: 'Guardar'}).click();
  await expect(page.getByRole('heading', {name: clientName})).toBeVisible();

  await page.getByRole('link', {name: 'Instalaciones'}).click();
  await page.getByTestId('new-sites').click();
  await page.getByLabel('Cliente').selectOption({label: clientName});
  await page.getByTestId('sites-name').fill(siteName);
  await page.getByLabel('Calle').fill('Avenida Industrial');
  await page.getByLabel('Ciudad').fill('Querétaro');
  await page.getByRole('textbox', {name: 'Estado', exact: true}).fill('Querétaro');
  await page.getByLabel('Código postal').fill('76000');
  await page.getByRole('button', {name: 'Guardar'}).click();
  await expect(page.getByRole('heading', {name: siteName})).toBeVisible();

  await page.getByRole('link', {name: 'Equipos'}).click();
  await page.getByTestId('new-equipment').click();
  await page.getByLabel('Cliente').selectOption({label: clientName});
  await page.getByLabel('Instalación').selectOption({label: siteName});
  await page.getByTestId('equipment-name').fill(equipmentName);
  await page.getByLabel('Categoría').fill('Chiller');
  await page.getByRole('button', {name: 'Guardar'}).click();
  await expect(page.getByRole('heading', {name: equipmentName})).toBeVisible();

  await page.getByRole('link', {name: 'Solicitudes'}).click();
  await page.getByTestId('new-request').click();
  await page.getByLabel('Cliente').selectOption({label: clientName});
  await page.getByLabel('Instalación').selectOption({label: siteName});
  await page.getByLabel('Equipo').selectOption({label: equipmentName});
  await page.getByTestId('request-title').fill(requestTitle);
  await page.getByLabel('Descripción').fill('Validación integral con emuladores.');
  await page.getByLabel('Asignar a').selectOption({label: 'Operador Emulador'});
  await page.getByRole('button', {name: 'Crear solicitud'}).click();
  await expect(page.getByText(requestTitle)).toBeVisible();
  await logout(page);

  await login(page, operator);
  await page.getByRole('link', {name: 'Mis solicitudes'}).click();
  await page.getByText(requestTitle).click();
  await page.getByRole('button', {name: 'Iniciar solicitud'}).click();

  await page.getByRole('link', {name: 'Cotizaciones'}).click();
  await page.getByTestId('new-quote').click();
  await page.getByTestId('quote-request').selectOption({label: requestTitle});
  await page.getByRole('button', {name: 'Crear borrador'}).click();
  await page.getByTestId('quote-item-description').fill('Diagnóstico técnico y pruebas');
  await page.getByTestId('quote-item-price').fill('2500');
  await page.getByRole('combobox', {name: 'Descuento', exact: true}).selectOption('percentage');
  await page.getByLabel('Valor descuento').fill('10');
  await page.getByRole('button', {name: 'Agregar partida'}).click();
  await expect(page.getByText('$2,610.00')).toBeVisible();
  await page.getByRole('button', {name: 'Vista previa'}).click();
  await expect(page.getByText(/BORRADOR/)).toBeVisible();
  await page.getByRole('button', {name: 'Cerrar vista previa'}).click();
  await page.getByTestId('issue-quote').click();
  await expect(page.getByText(/emitida correctamente/i)).toBeVisible({timeout: 30_000});
  await expect(page.getByRole('button', {name: 'Agregar partida'})).toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Descargar PDF'}).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('Playwright no proporcionó la ruta de descarga.');
  const bytes = await readFile(downloadPath);
  expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  const issuedFolio = (await page.getByRole('dialog').getByRole('heading').textContent()) ?? '';
  expect(issuedFolio).toMatch(/^COT-\d{4}-\d{6}$/);
  await page.getByRole('dialog').getByRole('button', {name: 'Cerrar', exact: true}).click();
  await logout(page);

  await login(page);
  await page.getByRole('link', {name: 'Actividad'}).click();
  await expect(page.getByText(new RegExp(`${issuedFolio} emitida`, 'i'))).toBeVisible();
  await expect(page.getByText('quote.issued')).toBeVisible();
  await page.getByRole('link', {name: 'Cotizaciones'}).click();
  await page.getByRole('heading', {name: issuedFolio}).click();
  await page.getByRole('button', {name: 'Crear corrección'}).click();
  await expect(page.getByText(/corrección creada/i)).toBeVisible({timeout: 15_000});
});
