import {describe, expect, it} from 'vitest';
import {
  DEV_PROJECT_ID,
  classifySeedDocument,
  isSeedOwned,
  parseDevCommandOptions,
  seedMarker,
} from './dev-seed-core';

describe('protecciones de semilla DEV', () => {
  it('rechaza un Project ID incorrecto o con apariencia PROD', () => {
    expect(() => parseDevCommandOptions(['--project', 'otro-proyecto', '--dry-run'], {})).toThrow(
      /bloqueado/i,
    );
    expect(() =>
      parseDevCommandOptions(['--project', 'enfriamatic-prod', '--dry-run'], {}),
    ).toThrow(/bloqueado/i);
  });

  it('requiere dry-run o confirmación exacta y rechaza emuladores', () => {
    expect(() => parseDevCommandOptions(['--project', DEV_PROJECT_ID], {})).toThrow(/confirm/i);
    expect(parseDevCommandOptions(['--project', DEV_PROJECT_ID, '--dry-run'], {})).toMatchObject({
      dryRun: true,
    });
    expect(() =>
      parseDevCommandOptions(['--project', DEV_PROJECT_ID, '--dry-run'], {
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      }),
    ).toThrow(/emulador/i);
  });

  it('clasifica documentos propios de forma idempotente', () => {
    expect(classifySeedDocument(null, seedMarker)).toBe('create');
    expect(classifySeedDocument({...seedMarker}, seedMarker)).toBe('unchanged');
    expect(classifySeedDocument({...seedMarker, seedVersion: 'old'}, seedMarker)).toBe('update');
    expect(classifySeedDocument({owner: 'real'}, seedMarker)).toBe('conflict');
    expect(classifySeedDocument({owner: 'real'}, seedMarker, true)).toBe('preserve');
  });

  it('el rollback exige simultáneamente origen y etiqueta', () => {
    expect(isSeedOwned(seedMarker)).toBe(true);
    expect(isSeedOwned({dataOrigin: 'dev-seed'})).toBe(false);
    expect(isSeedOwned({seedTag: seedMarker.seedTag})).toBe(false);
    expect(isSeedOwned({...seedMarker, dataOrigin: 'manual'})).toBe(false);
  });
});
