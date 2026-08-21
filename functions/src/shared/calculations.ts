export interface CalculableItem {
  quantity: number;
  originalUnitPrice: number;
  discountType: 'none' | 'percentage' | 'fixed';
  discountValue: number;
  taxable: boolean;
}

export interface CalculatedItem {
  discountAmount: number;
  finalUnitPrice: number;
  lineSubtotal: number;
}

export interface QuoteTotals {
  subtotalOriginal: number;
  discountTotal: number;
  subtotalFinal: number;
  globalDiscountAmount?: number;
  taxableBase?: number;
  taxTotal: number;
  grandTotal: number;
}

export type GlobalDiscountType = 'none' | 'percentage' | 'fixed';

export interface GlobalDiscountInput {
  type: GlobalDiscountType;
  value: number;
}

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateItem(item: CalculableItem): CalculatedItem {
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw new Error('invalid-quantity');
  }
  if (!Number.isFinite(item.originalUnitPrice) || item.originalUnitPrice < 0) {
    throw new Error('invalid-price');
  }
  const originalLine = roundMoney(item.quantity * item.originalUnitPrice);
  let discountAmount = 0;
  if (item.discountType === 'percentage') {
    if (item.discountValue < 0 || item.discountValue > 100) {
      throw new Error('invalid-discount');
    }
    discountAmount = roundMoney(originalLine * (item.discountValue / 100));
  } else if (item.discountType === 'fixed') {
    if (item.discountValue < 0 || item.discountValue > originalLine) {
      throw new Error('invalid-discount');
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

export function calculateQuoteTotals(
  items: CalculableItem[],
  taxRate: number,
  globalDiscount: GlobalDiscountInput = {type: 'none', value: 0},
  applyTax = true,
): QuoteTotals {
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
    throw new Error('invalid-tax-rate');
  }
  if (!['none', 'percentage', 'fixed'].includes(globalDiscount.type)) {
    throw new Error('invalid-global-discount');
  }
  if (!Number.isFinite(globalDiscount.value) || globalDiscount.value < 0) {
    throw new Error('invalid-global-discount');
  }
  const lineTotals = items.reduce(
    (totals, item) => {
      const calculated = calculateItem(item);
      return {
        subtotalOriginal: roundMoney(
          totals.subtotalOriginal + roundMoney(item.quantity * item.originalUnitPrice),
        ),
        discountTotal: roundMoney(totals.discountTotal + calculated.discountAmount),
        subtotalFinal: roundMoney(totals.subtotalFinal + calculated.lineSubtotal),
      };
    },
    {subtotalOriginal: 0, discountTotal: 0, subtotalFinal: 0},
  );
  const globalDiscountAmount =
    globalDiscount.type === 'percentage'
      ? roundMoney(lineTotals.subtotalFinal * (globalDiscount.value / 100))
      : globalDiscount.type === 'fixed'
        ? roundMoney(globalDiscount.value)
        : 0;
  if (
    (globalDiscount.type === 'percentage' && globalDiscount.value > 100) ||
    globalDiscountAmount > lineTotals.subtotalFinal
  ) {
    throw new Error('invalid-global-discount');
  }
  const taxableBase = roundMoney(lineTotals.subtotalFinal - globalDiscountAmount);
  const taxTotal = applyTax ? roundMoney(taxableBase * taxRate) : 0;
  return {
    ...lineTotals,
    globalDiscountAmount,
    taxableBase,
    taxTotal,
    grandTotal: roundMoney(taxableBase + taxTotal),
  };
}
