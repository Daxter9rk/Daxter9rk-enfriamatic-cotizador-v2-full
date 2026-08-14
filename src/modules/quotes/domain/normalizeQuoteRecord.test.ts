import {describe, expect, it} from 'vitest';
import {normalizeQuoteRecord} from './normalizeQuoteRecord';

const rawQuote = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'quote-1',
    folio: '',
    clientId: 'client-1',
    status: 'draft',
    documentStatus: 'not_generated',
    currency: 'MXN',
    taxRate: 0.16,
    discountDisplayMode: 'detailed',
    subtotalOriginal: 0,
    discountTotal: 0,
    subtotalFinal: 0,
    taxTotal: 0,
    grandTotal: 0,
    validityDays: 15,
    revisionNumber: 1,
    locked: false,
    createdAt: {toMillis: () => 1},
    createdBy: 'admin',
    updatedAt: {toMillis: () => 1},
    updatedBy: 'admin',
    schemaVersion: 1,
    ...overrides,
  }) as never;

describe('normalizeQuoteRecord', () => {
  it('preserves historical references', () => {
    const quote = normalizeQuoteRecord(
      rawQuote({requestId: 'request-1', siteId: 'site-1', equipmentId: 'equipment-1'}),
    );
    expect(quote.requestId).toBe('request-1');
    expect(quote.siteId).toBe('site-1');
    expect(quote.equipmentId).toBe('equipment-1');
  });

  it('normalizes absent, null, and blank optional values to null', () => {
    const quote = normalizeQuoteRecord(
      rawQuote({
        requestId: '',
        siteId: undefined,
        equipmentId: null,
        serviceReference: '  ',
        notes: '',
      }),
    );
    expect(quote.requestId).toBeNull();
    expect(quote.siteId).toBeNull();
    expect(quote.equipmentId).toBeNull();
    expect(quote.serviceReference).toBeNull();
    expect(quote.notes).toBeNull();
    expect(Object.values(quote)).not.toContain(undefined);
  });

  it('keeps independent references and free text', () => {
    const quote = normalizeQuoteRecord(
      rawQuote({serviceReference: ' Orden 44 ', technicalContext: '  Equipo norte  '}),
    );
    expect(quote.requestId).toBeNull();
    expect(quote.serviceReference).toBe('Orden 44');
    expect(quote.technicalContext).toBe('Equipo norte');
  });

  it('does not erase unexpected independent references during read', () => {
    const quote = normalizeQuoteRecord(
      rawQuote({requestId: null, siteId: 'site-1', equipmentId: 'equipment-1'}),
    );
    expect(quote.requestId).toBeNull();
    expect(quote.siteId).toBe('site-1');
    expect(quote.equipmentId).toBe('equipment-1');
  });
});
