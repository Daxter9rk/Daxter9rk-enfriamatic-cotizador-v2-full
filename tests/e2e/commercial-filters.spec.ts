import {expect, test} from '@playwright/test';

const admin = {email: 'admin@enfriamatic.local', password: 'DevOnly!Enfriamatic2026'};

async function login(page: import('@playwright/test').Page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await page.getByTestId('login-email').fill(admin.email);
  await page.getByTestId('login-password').fill(admin.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByText(/centro comercial/i)).toBeVisible();
}

test('admin can locate clients, quotes and commercial concepts with bounded filters', async ({
  page,
}) => {
  await login(page);

  await page.goto('/clients', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'Clientes'})).toBeVisible();
  await page.getByRole('searchbox').fill('Procesos');
  await expect(page.getByText('Procesos Fríos del Bajío')).toBeVisible();
  await page.getByRole('combobox', {name: 'Estado'}).selectOption('active');
  await page.getByRole('button', {name: 'Limpiar filtros'}).click();

  await page.goto('/quotes', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'Cotizaciones'})).toBeVisible();
  await page.getByRole('combobox', {name: 'Estado'}).selectOption('draft');
  await page.getByRole('searchbox').fill('COT-');
  await page.getByRole('button', {name: 'Limpiar filtros'}).click();

  await page.goto('/commercial-catalog', {waitUntil: 'domcontentloaded'});
  await expect(
    page.getByRole('heading', {name: 'Catálogo de productos y servicios'}),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('Compresor');
  await expect(page.getByRole('heading', {name: 'Compresor emulador'})).toBeVisible();
  await page.getByRole('combobox', {name: 'Unidad'}).selectOption('pieza');
  await page.getByRole('button', {name: 'Limpiar filtros'}).click();
});
