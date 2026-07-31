import {expect, test} from '@playwright/test';

test('login is usable at 360 px', async ({page}) => {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByTestId('login-submit')).toBeInViewport();
  await expect(page.getByLabel(/correo electrónico/i)).toBeInViewport();
});
