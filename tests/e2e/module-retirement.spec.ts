import {expect, test, type Page} from '@playwright/test';

const password = 'DevOnly!Enfriamatic2026';

async function login(page: Page, email: string) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', {name: /buen día/i})).toBeVisible();
}

const retiredPaths = [
  '/requests',
  '/requests/legacy-request',
  '/sites',
  '/sites/legacy-site',
  '/equipment',
  '/equipment/legacy-equipment',
  '/activity',
];

test('admin sees the reduced MVP navigation and safe guards for retired routes', async ({page}) => {
  await login(page, 'admin@enfriamatic.local');

  for (const label of [
    'Inicio',
    'Clientes',
    'Cotizaciones',
    'Catálogo comercial',
    'Configuración',
  ]) {
    await expect(
      page
        .getByRole('navigation', {name: 'Operación'})
        .getByRole('link', {name: label, exact: true}),
    ).toBeVisible();
  }
  for (const label of ['Solicitudes', 'Instalaciones', 'Equipos', 'Actividad']) {
    await expect(page.getByRole('link', {name: label, exact: true})).toHaveCount(0);
  }

  for (const path of retiredPaths) {
    await page.goto(path, {waitUntil: 'domcontentloaded'});
    await expect(page).toHaveURL(/\/quotes$/);
    await expect(page.getByRole('heading', {name: 'Cotizaciones'})).toBeVisible();
    await expect(page.getByText(/ruta no encontrada|error inesperado/i)).toHaveCount(0);
  }
});

test('operator receives the same route guard without admin links', async ({page}) => {
  await login(page, 'operador@enfriamatic.local');
  await expect(page.getByRole('link', {name: 'Usuarios y permisos'})).toHaveCount(0);
  await expect(
    page
      .getByRole('navigation', {name: 'Operación'})
      .getByRole('link', {name: 'Cotizaciones', exact: true}),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation', {name: 'Operación'})
      .getByRole('link', {name: 'Catálogo comercial', exact: true}),
  ).toBeVisible();

  await page.goto('/requests', {waitUntil: 'domcontentloaded'});
  await expect(page).toHaveURL(/\/quotes$/);
  await expect(page.getByRole('heading', {name: 'Cotizaciones'})).toBeVisible();
});

test('commercial catalog remains an active destination', async ({page}) => {
  await login(page, 'admin@enfriamatic.local');
  await page
    .getByRole('navigation', {name: 'Operación'})
    .getByRole('link', {name: 'Catálogo comercial', exact: true})
    .click();
  await expect(page).toHaveURL(/\/commercial-catalog$/);
  await expect(
    page.getByRole('heading', {name: 'Catálogo de productos y servicios'}),
  ).toBeVisible();
});
