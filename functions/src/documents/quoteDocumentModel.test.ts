import {describe, expect, it} from 'vitest';
import {buildQuoteDocumentModel} from './quoteDocumentModel';

const base = {
  quoteId: 'quote-1',
  folio: 'COT-2026-000001',
  issuedAt: new Date('2026-08-14T12:00:00Z'),
  issuedBy: 'admin',
  actorRole: 'admin' as const,
  generationAttempt: 1,
  quote: {
    clientId: 'client-1',
    taxRate: 0.16,
    validityDays: 15,
    discountDisplayMode: 'detailed',
    serviceReference: 'SRV-1',
    technicalContext: 'Contexto de prueba',
    notes: 'Notas',
  },
  client: {
    name: 'Cliente',
    legalName: 'Cliente Legal',
    rfc: 'RFC123',
    billingAddress: {city: 'Querétaro'},
  },
  company: {companyName: 'Enfriamatic', legalText: 'Legal'},
  defaults: {validityDays: 15, devWatermark: 'DEV'},
  items: [],
  totals: {
    subtotalOriginal: 100,
    discountTotal: 0,
    subtotalFinal: 100,
    taxTotal: 16,
    grandTotal: 116,
  },
};

describe('QuoteDocumentModel', () => {
  it('builds an independent model without operational entities', () => {
    const model = buildQuoteDocumentModel({...base, quote: {...base.quote, requestId: null}});
    expect(model.mode).toBe('independent');
    expect(model.operationalContext.requestId).toBeNull();
    expect(model.operationalContext.siteName).toBeNull();
    expect(model.operationalContext.equipmentName).toBeNull();
    expect(model.client.billingAddress).toEqual({city: 'Querétaro'});
  });

  it('preserves historical references and context', () => {
    const model = buildQuoteDocumentModel({
      ...base,
      quote: {...base.quote, requestId: 'request-1', siteId: 'site-1', equipmentId: 'equipment-1'},
      request: {id: 'request-1'},
      site: {name: 'Planta', address: 'Dirección'},
      equipment: {name: 'Equipo'},
    });
    expect(model.mode).toBe('historical');
    expect(model.operationalContext).toMatchObject({
      requestId: 'request-1',
      siteName: 'Planta',
      siteAddress: 'Dirección',
      equipmentName: 'Equipo',
    });
  });

  it('rejects incomplete company settings', () => {
    expect(() => buildQuoteDocumentModel({...base, company: {companyName: '  '}})).toThrow(
      'missing-company-settings',
    );
  });
});
