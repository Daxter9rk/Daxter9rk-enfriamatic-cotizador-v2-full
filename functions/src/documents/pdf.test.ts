import {describe, expect, it} from 'vitest';
import {generateQuotePdf} from './pdf';

describe('quote PDF', () => {
  it('generates a bounded PDF with a valid signature', async () => {
    const result = await generateQuotePdf({
      folio: 'COT-2026-000001',
      issuedAt: new Date('2026-01-01T00:00:00Z'),
      clientName: 'Cliente de prueba',
      siteName: 'Planta',
      siteAddress: 'Querétaro',
      items: [
        {
          quantity: 1,
          unit: 'servicio',
          description: 'Diagnóstico',
          originalUnitPrice: 1000,
          discountAmount: 0,
          lineSubtotal: 1000,
        },
      ],
      discountDisplayMode: 'detailed',
      subtotalOriginal: 1000,
      discountTotal: 0,
      subtotalFinal: 1000,
      taxRate: 0.16,
      taxTotal: 160,
      grandTotal: 1160,
      currency: 'MXN',
      validityDays: 15,
      watermark: 'DOCUMENTO DE PRUEBA - DEV',
    });
    expect(result.bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.bytes.length).toBeLessThan(12 * 1024 * 1024);
    expect(result.pageCount).toBeGreaterThan(0);
  });
});
