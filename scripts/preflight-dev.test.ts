import {describe, expect, it, vi} from 'vitest';

vi.mock('vite', () => ({
  loadEnv: () => ({
    VITE_FIREBASE_API_KEY: 'from-file',
    VITE_FIREBASE_PROJECT_ID: 'enfriamatic-cotizador-de-420e5',
  }),
}));

import {loadPreflightEnv, missingEnvironmentVariables} from './preflight-dev-env';

describe('preflight DEV environment', () => {
  it('combines Vite environment with process.env, giving process.env priority', () => {
    expect(
      loadPreflightEnv('unused-test-root', {
        VITE_FIREBASE_API_KEY: 'from-process',
        VITE_FIREBASE_AUTH_DOMAIN: '   ',
      }),
    ).toMatchObject({
      VITE_FIREBASE_API_KEY: 'from-process',
      VITE_FIREBASE_PROJECT_ID: 'enfriamatic-cotizador-de-420e5',
      VITE_FIREBASE_AUTH_DOMAIN: '   ',
    });
  });

  it('treats empty and whitespace-only values as missing', () => {
    expect(
      missingEnvironmentVariables({present: ' configured ', empty: '', spaces: '   '}, [
        'present',
        'empty',
        'spaces',
        'absent',
      ]),
    ).toEqual(['empty', 'spaces', 'absent']);
  });
});
