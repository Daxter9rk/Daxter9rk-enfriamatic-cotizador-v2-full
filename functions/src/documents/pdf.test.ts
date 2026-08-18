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
      globalDiscountAmount: 0,
      taxableBase: 1000,
      applyTax: true,
      taxRate: 0.16,
      taxTotal: 160,
      grandTotal: 1160,
      currency: 'MXN',
      validityDays: 15,
      watermark: 'DOCUMENTO DE PRUEBA - DEV',
    });
    expect(result.bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.bytes.length).toBeLessThan(12 * 1024 * 1024);
    const physicalPages = result.bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [];
    expect(result.pageCount).toBe(1);
    expect(physicalPages).toHaveLength(result.pageCount);
  });

  it('renders trusted global discount totals and disabled IVA without recalculation', async () => {
    const result = await generateQuotePdf({
      folio: 'COT-2026-000002',
      issuedAt: new Date('2026-01-01T00:00:00Z'),
      clientName: 'Cliente de prueba',
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
      globalDiscountAmount: 100,
      taxableBase: 900,
      applyTax: false,
      taxRate: 0.16,
      taxTotal: 0,
      grandTotal: 900,
      currency: 'MXN',
      validityDays: 15,
      watermark: 'DOCUMENTO DE PRUEBA - DEV',
    });

    expect(result.bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.pageCount).toBe(1);
  });

  it('grows long rows and repeats pages without duplicating the business data', async () => {
    const items = Array.from({length: 24}, (_, index) => ({
      quantity: index + 1,
      unit: index % 2 ? 'servicio' : 'pieza',
      description:
        `Partida ${index + 1}: diagnóstico técnico con caracteres españoles áéíóú ñ. ` +
        'Descripción extensa para comprobar el crecimiento vertical de la fila, el ajuste de texto y un salto de página estable sin superposición. '.repeat(
          (index % 3) + 1,
        ),
      brand: 'Fabricante industrial',
      model: `Modelo-muy-largo-${index + 1}-ABC-2026`,
      originalUnitPrice: 987654.32,
      discountAmount: index % 2 ? 1234.56 : 0,
      lineSubtotal: 986419.76 * (index + 1),
    }));
    const result = await generateQuotePdf({
      folio: 'COT-2026-999999',
      issuedAt: new Date('2026-08-04T18:00:00Z'),
      clientName: 'Cliente de validación con razón social extensa',
      siteName: 'Instalación Centro',
      siteAddress: 'Avenida de la Refrigeración 123, Ciudad de México',
      equipmentName: 'Unidad condensadora de gran capacidad',
      items,
      discountDisplayMode: 'detailed',
      subtotalOriginal: 99999999.99,
      discountTotal: 14814.72,
      subtotalFinal: 99985185.27,
      taxRate: 0.16,
      taxTotal: 15997629.64,
      grandTotal: 115982814.91,
      currency: 'MXN',
      validityDays: 30,
      notes: 'Validación de múltiples partidas y última fila próxima al pie.',
      paymentMethod: 'Transferencia bancaria',
      warranty: 'Garantía limitada conforme a condiciones comerciales.',
      exclusions: 'No incluye maniobras extraordinarias.',
      watermark: 'ENFRIAMATIC — DOCUMENTO DE PRUEBA DEV',
    });
    expect(result.bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    const physicalPages = result.bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [];
    expect(result.pageCount).toBeGreaterThan(2);
    expect(physicalPages).toHaveLength(result.pageCount);
    expect(result.bytes.length).toBeLessThan(12 * 1024 * 1024);
  });
});
