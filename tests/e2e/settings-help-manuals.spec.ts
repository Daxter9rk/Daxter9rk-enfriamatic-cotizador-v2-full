import {expect, test, type Page} from '@playwright/test';

const password = 'DevOnly!Enfriamatic2026';

async function login(page: Page, email: string) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByText(/centro comercial/i)).toBeVisible();
}

test('admin can validate and persist authorized settings without changing document history', async ({
  page,
}) => {
  await login(page, 'admin@enfriamatic.local');
  await page.goto('/settings', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'Configuración'})).toBeVisible();
  const address = page.getByLabel('Dirección');
  const original = await address.inputValue();
  const updatedAddress = original ? `${original} · validado` : '· validado';
  await page.getByRole('button', {name: 'Editar'}).click();
  await page.getByLabel('Vigencia (días)').fill('0');
  await page.getByRole('button', {name: 'Guardar cambios'}).click();
  expect(
    await page
      .getByLabel('Vigencia (días)')
      .evaluate((element) => !(element as HTMLInputElement).checkValidity()),
  ).toBe(true);
  await page.getByLabel('Vigencia (días)').fill('15');
  await address.fill(updatedAddress);
  await page.getByRole('button', {name: 'Guardar cambios'}).click();
  await page.getByLabel('Contraseña actual').fill(password);
  await page.getByRole('button', {name: 'Confirmar identidad'}).click();
  await expect(page.getByText(/configuración guardada/i)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Dirección')).toHaveValue(updatedAddress);
  await page.getByRole('button', {name: 'Editar'}).click();
  await page.getByLabel('Dirección').fill(original);
  await page.getByRole('button', {name: 'Guardar cambios'}).click();
  await page.getByLabel('Contraseña actual').fill(password);
  await page.getByRole('button', {name: 'Confirmar identidad'}).click();
  await expect(page.getByText(/configuración guardada/i)).toBeVisible();
});

test('operator cannot open settings and receives only the operator manual', async ({page}) => {
  await login(page, 'operador@enfriamatic.local');
  await expect(page.getByRole('link', {name: 'Configuración'})).toHaveCount(0);
  await page.goto('/settings', {waitUntil: 'domcontentloaded'});
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/manual', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: /manual de operador/i})).toBeVisible();
  await expect(page.getByText('Restricciones del rol', {exact: true})).toBeVisible();
  await expect(page.getByText('Usuarios y permisos')).toHaveCount(0);
});

test('help and simulated support never claim external delivery', async ({page}) => {
  await login(page, 'admin@enfriamatic.local');
  await page.goto('/support', {waitUntil: 'domcontentloaded'});
  await expect(page.getByText(/modo demostración/i)).toBeVisible();
  await expect(page.getByText(/no envía correos ni crea tickets externos/i)).toBeVisible();
  await page.getByRole('button', {name: 'Validar solicitud'}).click();
  await expect(page.getByLabel('¿Qué intentabas hacer?')).toHaveAttribute('required', '');
  await page.getByLabel('¿Qué intentabas hacer?').fill('Revisar una cotización');
  await page.getByLabel('¿Qué ocurrió?').fill('La pantalla no muestra el resultado esperado.');
  await page.getByRole('button', {name: 'Validar solicitud'}).click();
  await expect(page.getByRole('status')).toContainText(/no se envió información/i);
});
