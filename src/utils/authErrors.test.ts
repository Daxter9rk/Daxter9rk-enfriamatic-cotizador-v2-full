import {describe, expect, it} from 'vitest';
import {reauthenticationErrorMessage, supportsPasswordReauthentication} from './authErrors';

describe('reauthentication errors', () => {
  it('separates a wrong password from session and network errors', () => {
    expect(reauthenticationErrorMessage({code: 'auth/invalid-credential'})).toMatch(
      /contraseña es incorrecta/,
    );
    expect(reauthenticationErrorMessage({code: 'auth/user-token-expired'})).toMatch(
      /sesión ya no es válida/,
    );
    expect(reauthenticationErrorMessage({code: 'auth/network-request-failed'})).toMatch(/conexión/);
  });

  it('requires the password provider before constructing an email credential', () => {
    expect(supportsPasswordReauthentication(['password'])).toBe(true);
    expect(supportsPasswordReauthentication(['google.com'])).toBe(false);
  });
});
