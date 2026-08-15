import {expect, test, type Page} from '@playwright/test';

const credentials = {
  email: 'admin@enfriamatic.local',
  password: 'DevOnly!Enfriamatic2026',
};

async function login(page: Page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await page.getByTestId('login-email').fill(credentials.email);
  await page.getByTestId('login-password').fill(credentials.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByText(/centro comercial/i)).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual(
      expect.objectContaining({
        clientWidth: expect.any(Number),
        scrollWidth: expect.any(Number),
      }),
    );

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test('shell is usable without horizontal overflow at required viewport widths', async ({page}) => {
  await login(page);

  for (const width of [360, 390, 768, 1366, 1920]) {
    await page.setViewportSize({width, height: width <= 390 ? 844 : 1000});
    await expect(page.getByRole('heading', {name: /buen día/i})).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const navigationButton = page.getByRole('button', {name: 'Abrir navegación'});
    if (width < 960) {
      await expect(navigationButton).toBeVisible();
      await navigationButton.click();
      await expect(page.getByRole('navigation', {name: 'Operación'})).toBeVisible();
      await page
        .getByRole('navigation', {name: 'Operación'})
        .getByRole('link', {name: 'Inicio'})
        .click();
      await expect(page.getByRole('button', {name: 'Cerrar navegación'})).toBeHidden();
    } else {
      await expect(navigationButton).toBeHidden();
    }
  }
});

test('dashboard remains operable at required browser zoom levels', async ({page}) => {
  await page.setViewportSize({width: 1366, height: 900});
  await login(page);

  for (const zoom of [0.67, 0.8, 0.9, 1]) {
    await page.evaluate((factor) => {
      document.documentElement.style.zoom = String(factor);
    }, zoom);
    await expect(page.getByRole('heading', {name: /buen día/i})).toBeVisible();
    await expect(page.getByRole('link', {name: 'Nueva cotización'})).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
