import {mkdir, writeFile} from 'node:fs/promises';
import process from 'node:process';
import {generateQuotePdf} from '../functions/lib/documents/pdf.js';

const items = Array.from({length: 24}, (_, index) => ({
  quantity: index + 1,
  unit: index % 2 ? 'servicio' : 'pieza',
  description:
    `Partida ${index + 1}: diagnóstico técnico con caracteres españoles áéíóú ñ. ` +
    'Descripción extensa para validar crecimiento de fila, descuentos y saltos de página sin superposición. '.repeat(
      (index % 3) + 1,
    ),
  brand: 'Enfriamatic',
  model: `MODELO-LARGO-${index + 1}-V2.1`,
  originalUnitPrice: 987654.32,
  discountAmount: index % 2 ? 1234.56 : 0,
  lineSubtotal: 986419.76 * (index + 1),
}));

const result = await generateQuotePdf({
  folio: 'COT-2026-PRUEBA',
  issuedAt: new Date('2026-08-04T18:00:00Z'),
  clientName: 'Cliente de validación',
  siteName: 'Instalación Centro',
  siteAddress: 'Ciudad de México',
  equipmentName: 'Unidad condensadora',
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
  notes: 'Documento de evidencia; no es factura ni CFDI.',
  paymentMethod: 'Transferencia bancaria',
  warranty: 'Garantía limitada.',
  exclusions: 'No incluye maniobras extraordinarias.',
  watermark: 'ENFRIAMATIC — DOCUMENTO DE PRUEBA DEV',
});

await mkdir('output/pdf', {recursive: true});
await writeFile('output/pdf/cotizacion-v2.1-prueba.pdf', result.bytes);
process.stdout.write(`PDF generado: ${result.pageCount} páginas, ${result.bytes.length} bytes\n`);
