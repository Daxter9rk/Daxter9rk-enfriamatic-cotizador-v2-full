import type {DiscountDisplayMode} from './types';

export interface CalculatedItem {
  discountAmount: number;
  finalUnitPrice: number;
  lineSubtotal: number;
}

export interface QuoteTotals {
  subtotalOriginal: number;
  discountTotal: number;
  subtotalFinal: number;
  taxTotal: number;
  grandTotal: number;
}

export interface CalculableItem {
  quantity: number;
  originalUnitPrice: number;
  discountType: 'none' | 'percentage' | 'fixed';
  discountValue: number;
  taxable: boolean;
}

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateItem(item: CalculableItem): CalculatedItem {
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw new Error('La cantidad debe ser mayor que cero.');
  }
  if (!Number.isFinite(item.originalUnitPrice) || item.originalUnitPrice < 0) {
    throw new Error('El precio no puede ser negativo.');
  }

  const originalLine = roundMoney(item.quantity * item.originalUnitPrice);
  let discountAmount = 0;

  if (item.discountType === 'percentage') {
    if (item.discountValue < 0 || item.discountValue > 100) {
      throw new Error('El descuento porcentual debe estar entre 0 y 100.');
    }
    discountAmount = roundMoney(originalLine * (item.discountValue / 100));
  } else if (item.discountType === 'fixed') {
    if (item.discountValue < 0 || item.discountValue > originalLine) {
      throw new Error('El descuento fijo no puede superar el importe de la partida.');
    }
    discountAmount = roundMoney(item.discountValue);
  }

  const lineSubtotal = roundMoney(originalLine - discountAmount);
  return {
    discountAmount,
    finalUnitPrice: roundMoney(lineSubtotal / item.quantity),
    lineSubtotal,
  };
}

export function calculateQuoteTotals(items: CalculableItem[], taxRate: number): QuoteTotals {
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
    throw new Error('La tasa de impuesto debe expresarse entre 0 y 1.');
  }

  return items.reduce<QuoteTotals>(
    (totals, item) => {
      const calculated = calculateItem(item);
      const original = roundMoney(item.quantity * item.originalUnitPrice);
      // `taxable` remains for historical snapshots; new quotes use global tax.
      const tax = roundMoney(calculated.lineSubtotal * taxRate);
      return {
        subtotalOriginal: roundMoney(totals.subtotalOriginal + original),
        discountTotal: roundMoney(totals.discountTotal + calculated.discountAmount),
        subtotalFinal: roundMoney(totals.subtotalFinal + calculated.lineSubtotal),
        taxTotal: roundMoney(totals.taxTotal + tax),
        grandTotal: roundMoney(totals.grandTotal + calculated.lineSubtotal + tax),
      };
    },
    {
      subtotalOriginal: 0,
      discountTotal: 0,
      subtotalFinal: 0,
      taxTotal: 0,
      grandTotal: 0,
    },
  );
}

export const discountModeLabel: Record<DiscountDisplayMode, string> = {
  detailed: 'Descuento por partida',
  summary: 'Descuento resumido',
  incorporated: 'Descuento incorporado',
};
