import {expect, test, type Page} from '@playwright/test';

const password = 'DevOnly!Enfriamatic2026';

async function submitLogin(page: Page, email: string) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByTestId('login-submit')).toBeVisible();
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
}

async function logout(page: Page) {
  const button = page.getByRole('button', {name: 'Cerrar sesión'});
  const navigationButton = page.getByRole('button', {name: 'Abrir navegación'});
  if ((page.viewportSize()?.width ?? 1024) <= 720 && (await navigationButton.isVisible())) {
    await navigationButton.click();
  }
  await button.click();
  await expect(page.getByTestId('login-submit')).toBeVisible();
}

test('operator cannot access user administration', async ({page}) => {
  await submitLogin(page, 'operador@enfriamatic.local');
  await expect(page.getByRole('heading', {name: /buen día/i})).toBeVisible();
  await page.goto('/users', {waitUntil: 'domcontentloaded'});
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', {name: /buen día/i})).toBeVisible();
});

test('inactive account receives a specific block and can sign out', async ({page}) => {
  await submitLogin(page, 'inactivo@enfriamatic.local');
  await expect(page.getByRole('heading', {name: 'Cuenta inactiva'})).toBeVisible();
  await logout(page);
  await expect(page.getByTestId('login-submit')).toBeVisible();
});

test('authentication without profile is blocked', async ({page}) => {
  await submitLogin(page, 'sinperfil@enfriamatic.local');
  await expect(page.getByRole('heading', {name: 'Perfil no configurado'})).toBeVisible();
});

test('unsupported reader role is blocked', async ({page}) => {
  await submitLogin(page, 'rolinvalido@enfriamatic.local');
  await expect(page.getByRole('heading', {name: 'Rol no válido'})).toBeVisible();
});

test('logout and browser back do not restore private content', async ({page}) => {
  await submitLogin(page, 'admin@enfriamatic.local');
  await expect(page.getByText(/centro de operación/i)).toBeVisible();
  await logout(page);
  await page.goBack();
  await expect(page.getByText(/centro de operación/i)).toHaveCount(0);
});

test('unknown authenticated route renders a safe 404', async ({page}) => {
  await submitLogin(page, 'admin@enfriamatic.local');
  await page.goto('/ruta-inexistente', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'Ruta no encontrada'})).toBeVisible();
});
