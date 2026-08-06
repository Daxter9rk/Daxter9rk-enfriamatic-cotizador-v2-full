import {describe, expect, it} from 'vitest';
import {DEV_PROJECT_ID, parseReviewUserOptions, requiredReviewEnvironment} from './config';

describe('configuración de usuarios DEV de revisión', () => {
  it('rechaza proyectos distintos y destinos implícitos', () => {
    expect(() =>
      parseReviewUserOptions([`--project=${DEV_PROJECT_ID}`, '--action=provision']),
    ).toThrow(/target/);
    expect(() =>
      parseReviewUserOptions(['--target=emulator', '--action=provision', '--project=production']),
    ).toThrow(/rechazado/);
  });

  it('exige una confirmación duplicada para DEV remoto', () => {
    expect(() => parseReviewUserOptions(['--target=remote', '--action=provision'])).toThrow(
      /confirm-project/,
    );
    expect(
      parseReviewUserOptions([
        '--target=remote',
        '--action=cleanup',
        `--confirm-project=${DEV_PROJECT_ID}`,
      ]),
    ).toMatchObject({target: 'remote', action: 'cleanup'});
  });

  it('no acepta credenciales incompletas ni contraseñas débiles', () => {
    expect(() => requiredReviewEnvironment({REVIEW_ADMIN_EMAIL: 'admin@example.test'})).toThrow(
      /REVIEW_ADMIN_PASSWORD/,
    );
  });
});
