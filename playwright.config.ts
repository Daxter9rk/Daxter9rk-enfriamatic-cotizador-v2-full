import {defineConfig, devices} from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  globalTimeout: isCI ? 10 * 60_000 : undefined,
  expect: {timeout: 10_000},
  retries: 0,
  reporter: [['list'], ['html', {open: 'never'}]],
  use: {
    baseURL: 'http://127.0.0.1:5000',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: '**/mobile.spec.ts',
      use: {...devices['Desktop Chrome']},
    },
    {
      name: 'mobile-360',
      testMatch: '**/mobile.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: {width: 360, height: 800},
      },
    },
  ],
});
