import {describe, expect, it} from 'vitest';
import {
  emptyCompany,
  emptyDefaults,
  normalizeCompany,
  normalizeDefaults,
  validateSettings,
} from './settingsContract';

describe('settings contract', () => {
  it('normalizes only the supported settings fields', () => {
    expect(
      normalizeCompany({companyName: '  Enfriamatic ', email: ' INFO@EXAMPLE.COM '}),
    ).toMatchObject({
      companyName: 'Enfriamatic',
      email: 'info@example.com',
    });
    expect(normalizeDefaults({folioPrefix: ' cot- ', currency: 'USD' as 'MXN'})).toMatchObject({
      folioPrefix: 'COT-',
      currency: 'MXN',
    });
  });

  it('rejects invalid finite, range, format and required values', () => {
    expect(validateSettings({...emptyCompany, companyName: ''}, emptyDefaults)).toMatch(/nombre/i);
    expect(validateSettings(emptyCompany, {...emptyDefaults, taxRate: Number.NaN})).toMatch(
      /tasa/i,
    );
    expect(validateSettings(emptyCompany, {...emptyDefaults, validityDays: 1.5})).toMatch(
      /vigencia/i,
    );
    expect(validateSettings(emptyCompany, {...emptyDefaults, folioPrefix: 'COT 1'})).toMatch(
      /prefijo/i,
    );
    expect(validateSettings({...emptyCompany, email: 'wrong'}, emptyDefaults)).toMatch(/correo/i);
  });

  it('accepts the seeded contract', () => {
    expect(validateSettings(emptyCompany, emptyDefaults)).toBeNull();
  });
});
