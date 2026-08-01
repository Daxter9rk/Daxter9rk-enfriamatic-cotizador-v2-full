import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium, type Browser, type Page} from '@playwright/test';

const baseUrl = process.env.EVIDENCE_BASE_URL ?? 'http://127.0.0.1:5000';
const parsedUrl = new URL(baseUrl);
if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname)) {
  throw new Error('La captura de evidencia sólo puede ejecutarse contra emuladores locales.');
}

const outputDir = resolve('docs/images/manual');
const password = 'DevOnly!Enfriamatic2026';

async function login(page: Page, email: string) {
  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await page.getByText(/centro de operación/i).waitFor();
}

async function captureDesktop(browser: Browser) {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
  const page = await context.newPage();

  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  await page.screenshot({path: resolve(outputDir, '01-login.png'), fullPage: true});

  await login(page, 'admin@enfriamatic.local');
  await page.screenshot({
    path: resolve(outputDir, '02-dashboard-administrador.png'),
    fullPage: true,
  });

  await page.getByRole('link', {name: 'Catálogo comercial', exact: true}).click();
  await page.getByRole('heading', {name: 'Catálogo comercial'}).waitFor();
  await page.getByRole('button', {name: 'Nuevo artículo'}).waitFor();
  await page.screenshot({path: resolve(outputDir, '03-catalogo-comercial.png'), fullPage: true});

  await context.close();
}

async function captureOperator(browser: Browser) {
  const desktop = await browser.newContext({viewport: {width: 1440, height: 1000}});
  const page = await desktop.newPage();
  await login(page, 'operador@enfriamatic.local');
  await page.getByRole('link', {name: 'Cotizaciones', exact: true}).click();
  await page.getByTestId('new-quote').click();
  await page.getByRole('dialog', {name: 'Nueva cotización'}).waitFor();
  await page.screenshot({
    path: resolve(outputDir, '04-alta-guiada-cotizacion.png'),
    fullPage: true,
  });
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await login(mobilePage, 'operador@enfriamatic.local');
  await mobilePage.screenshot({
    path: resolve(outputDir, '05-dashboard-operador-movil.png'),
    fullPage: true,
  });
  await mobile.close();
}

await mkdir(outputDir, {recursive: true});
const browser = await chromium.launch();
try {
  await captureDesktop(browser);
  await captureOperator(browser);
  console.log(`Evidencia visual generada en ${outputDir}`);
} finally {
  await browser.close();
}
