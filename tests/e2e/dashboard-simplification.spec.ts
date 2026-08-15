import {expect, test, type Page} from '@playwright/test';

const password = 'DevOnly!Enfriamatic2026';

async function login(page: Page, email: string) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByText(/centro comercial/i)).toBeVisible();
}

async function expectNoRetiredDashboardLinks(page: Page) {
  for (const path of ['/requests', '/sites', '/equipment', '/activity', '/catalogs']) {
    await expect(page.locator(`a[href^="${path}"]`)).toHaveCount(0);
  }
  for (const label of [
    'Solicitudes recientes',
    'Nueva instalación',
    'Registrar equipo',
    'Actividad',
  ]) {
    await expect(page.getByText(label, {exact: true})).toHaveCount(0);
  }
}

test('admin dashboard is focused on commercial MVP actions', async ({page}) => {
  await login(page, 'admin@enfriamatic.local');
  await expect(page.getByRole('heading', {name: 'Cotizaciones recientes'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Nueva cotización'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Clientes'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Catálogo comercial'})).toBeVisible();
  await expectNoRetiredDashboardLinks(page);

  await page.getByRole('link', {name: 'Nueva cotización'}).click();
  await expect(page).toHaveURL(/\/quotes\?new=1$/);
  await page.goBack();
  await expect(page.getByRole('heading', {name: 'Cotizaciones recientes'})).toBeVisible();
});

test('operator dashboard keeps commercial actions and no reassignment destination', async ({
  page,
}) => {
  await login(page, 'operador@enfriamatic.local');
  await expect(page.getByRole('link', {name: 'Nueva cotización'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Cotizaciones', exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Catálogo comercial', exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Usuarios y permisos'})).toHaveCount(0);
  await expectNoRetiredDashboardLinks(page);
});
