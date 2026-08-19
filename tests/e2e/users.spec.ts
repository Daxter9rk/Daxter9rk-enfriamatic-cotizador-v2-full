import {expect, test} from '@playwright/test';

const password = 'DevOnly!Enfriamatic2026';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.GCLOUD_PROJECT ??= 'demo-enfriamatic';

async function completeOptionalReauthentication(page: import('@playwright/test').Page) {
  const reauthentication = page.getByRole('dialog').filter({hasText: 'Confirma tu identidad'});
  if ((await reauthentication.count()) > 0) {
    await reauthentication.getByLabel('Contraseña actual').fill(password);
    await reauthentication.getByRole('button', {name: 'Confirmar identidad'}).click();
    await expect(reauthentication).toBeHidden({timeout: 30_000});
  }
}

test('primary administrator is visibly protected and secondary admin state persists', async ({
  page,
}) => {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await page.getByTestId('login-email').fill('admin@enfriamatic.local');
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByText(/centro comercial/i)).toBeVisible();

  await page.goto('/users');
  const primaryRow = page.locator('tbody tr').filter({hasText: 'Admin Emulador'});
  await expect(primaryRow).toContainText('ADMINISTRADOR PRINCIPAL');
  await primaryRow.getByRole('button', {name: 'Administrar'}).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Su rol y estado están protegidos');
  await expect(dialog.getByRole('combobox', {name: 'Rol'})).toBeDisabled();
  await expect(dialog.getByRole('combobox', {name: 'Estado'})).toBeDisabled();
  await expect(dialog.getByRole('button', {name: /eliminar/i})).toHaveCount(0);
  await dialog.getByRole('button', {name: 'Cerrar', exact: true}).click();

  const secondaryRow = page.locator('tbody tr').filter({hasText: 'Admin Promovido Emulador'});
  await secondaryRow.getByRole('button', {name: 'Administrar'}).click();
  dialog = page.getByRole('dialog');
  const status = dialog.getByRole('combobox', {name: 'Estado'});
  await expect(status.locator('option')).toHaveCount(2);
  await expect(status.locator('option', {hasText: 'Pendiente'})).toHaveCount(0);
  await expect(status.locator('option', {hasText: 'Suspendido'})).toHaveCount(0);
  await status.selectOption('inactive');
  await dialog.getByRole('button', {name: 'Guardar cambios'}).click();
  await completeOptionalReauthentication(page);
  await page.reload();
  await expect(secondaryRow).toContainText('Inactivo');

  await secondaryRow.getByRole('button', {name: 'Administrar'}).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', {name: 'Estado'}).selectOption('active');
  await dialog.getByRole('button', {name: 'Guardar cambios'}).click();
  await completeOptionalReauthentication(page);
  await page.reload();
  await expect(secondaryRow).toContainText('Activo');
});
