import PDFDocument from 'pdfkit';

interface PdfItem {
  quantity: number;
  unit: string;
  description: string;
  brand?: string;
  model?: string;
  originalUnitPrice: number;
  discountAmount: number;
  lineSubtotal: number;
}

export interface QuotePdfInput {
  folio: string;
  issuedAt: Date;
  clientName: string;
  clientLegalName?: string;
  clientRfc?: string;
  siteName: string;
  siteAddress: string;
  equipmentName?: string;
  items: PdfItem[];
  discountDisplayMode: 'detailed' | 'summary' | 'incorporated';
  subtotalOriginal: number;
  discountTotal: number;
  subtotalFinal: number;
  taxRate: number;
  taxTotal: number;
  grandTotal: number;
  currency: 'MXN';
  validityDays: number;
  notes?: string;
  paymentMethod?: string;
  warranty?: string;
  exclusions?: string;
  legalText?: string;
  watermark: string;
  logoPath?: string;
}

export interface GeneratedPdf {
  bytes: Buffer;
  pageCount: number;
}

const money = (value: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value);

function ensureSpace(document: PDFKit.PDFDocument, needed: number): boolean {
  if (document.y + needed > document.page.height - 90) {
    document.addPage();
    return true;
  }
  return false;
}

function drawTableHeader(document: PDFKit.PDFDocument, y: number): void {
  document.y = y;
  document
    .fillColor('#02557B')
    .fontSize(8)
    .text('CANT.', 44, y, {width: 42})
    .text('UNIDAD', 88, y, {width: 50})
    .text('DESCRIPCIÓN', 142, y, {width: 245})
    .text('P. UNITARIO', 390, y, {width: 82, align: 'right'})
    .text('IMPORTE', 476, y, {width: 92, align: 'right'});
  document.y = y + 15;
  document.moveTo(44, document.y).lineTo(568, document.y).stroke('#02557B');
  document.y += 9;
}

export async function generateQuotePdf(input: QuotePdfInput): Promise<GeneratedPdf> {
  const document = new PDFDocument({
    size: 'LETTER',
    margins: {top: 44, right: 44, bottom: 52, left: 44},
    bufferPages: true,
    info: {
      Title: `Cotización ${input.folio}`,
      Author: 'Enfriamatic',
      Subject: 'Cotización de servicios de refrigeración industrial',
    },
  });
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));

  if (input.logoPath) {
    try {
      document.image(input.logoPath, 44, 38, {fit: [180, 64]});
    } catch {
      document.fontSize(18).fillColor('#02557B').text('ENFRIAMATIC', 44, 50);
    }
  } else {
    document.fontSize(18).fillColor('#02557B').text('ENFRIAMATIC', 44, 50);
  }

  document
    .fontSize(9)
    .fillColor('#4D4E4E')
    .text('COTIZACIÓN TÉCNICA', 350, 42, {align: 'right'})
    .fontSize(16)
    .fillColor('#17242B')
    .text(input.folio, 320, 58, {align: 'right'})
    .fontSize(9)
    .fillColor('#647680')
    .text(new Intl.DateTimeFormat('es-MX', {dateStyle: 'long'}).format(input.issuedAt), 320, 80, {
      align: 'right',
    });

  document.moveDown(5);
  document.roundedRect(44, 118, 524, 82, 6).fillAndStroke('#F4F7F9', '#D9E2E7');
  document
    .fillColor('#02557B')
    .fontSize(8)
    .text('CLIENTE', 58, 132)
    .fillColor('#17242B')
    .fontSize(12)
    .text(input.clientName, 58, 146)
    .fontSize(8)
    .fillColor('#647680')
    .text([input.clientLegalName, input.clientRfc].filter(Boolean).join(' · '), 58, 164)
    .fillColor('#02557B')
    .text('INSTALACIÓN / EQUIPO', 310, 132)
    .fillColor('#17242B')
    .fontSize(10)
    .text(input.siteName, 310, 146)
    .fontSize(8)
    .fillColor('#647680')
    .text([input.siteAddress, input.equipmentName].filter(Boolean).join(' · '), 310, 163, {
      width: 240,
    });

  drawTableHeader(document, 220);
  let tableY = document.y;

  for (const item of input.items) {
    const descriptor = [item.description, [item.brand, item.model].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join('\n');
    document.fontSize(8.5);
    const descriptorHeight = document.heightOfString(descriptor, {width: 245});
    const discountHeight =
      input.discountDisplayMode === 'detailed' && item.discountAmount > 0 ? 13 : 0;
    const rowHeight = Math.max(40, descriptorHeight + discountHeight + 20);
    if (tableY + rowHeight + 30 > document.page.height - 90) {
      document.addPage();
      document
        .fillColor('#647680')
        .fontSize(8)
        .text(`Cotización ${input.folio} · Continuación`, 44, 44, {width: 524});
      drawTableHeader(document, 66);
      tableY = document.y;
    }
    const startY = tableY;
    document
      .fillColor('#17242B')
      .fontSize(8.5)
      .text(String(item.quantity), 44, startY, {width: 42, height: rowHeight});
    document.text(item.unit, 88, startY, {width: 50, height: rowHeight});
    document.text(descriptor, 142, startY, {width: 245, height: descriptorHeight + 2});
    document.text(
      money(
        input.discountDisplayMode === 'incorporated'
          ? item.lineSubtotal / item.quantity
          : item.originalUnitPrice,
      ),
      390,
      startY,
      {width: 82, height: rowHeight, align: 'right'},
    );
    document.text(money(item.lineSubtotal), 476, startY, {
      width: 92,
      height: rowHeight,
      align: 'right',
    });
    if (input.discountDisplayMode === 'detailed' && item.discountAmount > 0) {
      document
        .fillColor('#CB171D')
        .fontSize(7.5)
        .text(`Descuento: -${money(item.discountAmount)}`, 142, startY + descriptorHeight + 2, {
          width: 245,
        });
    }
    tableY = startY + rowHeight;
    document.y = tableY;
    document.moveTo(44, document.y).lineTo(568, document.y).stroke('#E7EDF0');
    tableY += 6;
    document.y = tableY;
  }

  ensureSpace(document, 150);
  const totalsX = 345;
  const totals = [
    [
      'Subtotal',
      input.discountDisplayMode === 'incorporated' ? input.subtotalFinal : input.subtotalOriginal,
    ],
    ...(input.discountDisplayMode === 'summary' && input.discountTotal > 0
      ? [['Descuento', -input.discountTotal] as [string, number]]
      : []),
    [`IVA ${input.taxRate * 100}%`, input.taxTotal],
  ] as Array<[string, number]>;
  for (const [label, value] of totals) {
    document
      .fillColor('#647680')
      .fontSize(9)
      .text(label, totalsX, document.y, {width: 100})
      .fillColor('#17242B')
      .text(money(value), 455, document.y - 10, {
        width: 113,
        align: 'right',
      });
    document.moveDown(0.35);
  }
  document
    .moveTo(totalsX, document.y)
    .lineTo(568, document.y)
    .lineWidth(1.5)
    .stroke('#17242B')
    .moveDown(0.5)
    .fillColor('#17242B')
    .fontSize(11)
    .text('TOTAL', totalsX, document.y, {width: 100})
    .fontSize(13)
    .fillColor('#02557B')
    .text(`${money(input.grandTotal)} ${input.currency}`, 445, document.y - 13, {
      width: 123,
      align: 'right',
    });

  ensureSpace(document, 150);
  document.moveDown(2);
  document
    .fillColor('#02557B')
    .fontSize(8)
    .text('CONDICIONES COMERCIALES')
    .moveDown(0.4)
    .fillColor('#4D4E4E')
    .fontSize(8)
    .text(`Vigencia: ${input.validityDays} días`)
    .text(input.paymentMethod ? `Método de pago: ${input.paymentMethod}` : '')
    .text(input.warranty ? `Garantía: ${input.warranty}` : '')
    .text(input.exclusions ? `Exclusiones: ${input.exclusions}` : '')
    .text(input.notes ? `Observaciones: ${input.notes}` : '')
    .moveDown(0.6)
    .fontSize(7)
    .fillColor('#647680')
    .text(input.legalText ?? '');

  const range = document.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    document.switchToPage(pageIndex);
    document.save();
    document
      .fillOpacity(0.08)
      .fillColor('#CB171D')
      .fontSize(34)
      .rotate(-35, {origin: [306, 396]})
      .text(input.watermark, 65, 370, {width: 480, align: 'center'});
    document.restore();
    document
      .fillOpacity(1)
      .fillColor('#647680')
      .fontSize(7)
      .text(
        `Página ${pageIndex + 1} de ${range.count}`,
        44,
        document.page.height - document.page.margins.bottom - 10,
        {
          width: 524,
          align: 'right',
        },
      );
  }

  const completion = new Promise<Buffer>((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });
  document.end();
  return {bytes: await completion, pageCount: range.count};
}
