import {describe, expect, it} from 'vitest';
import {calculateItem, calculateQuoteTotals, roundMoney} from './calculations';

describe('quote calculations', () => {
  it('rounds monetary values consistently', () => {
    expect(roundMoney(10.005)).toBe(10.01);
  });

  it('calculates percentage and fixed discounts with tax', () => {
    const totals = calculateQuoteTotals(
      [
        {
          quantity: 2,
          originalUnitPrice: 1000,
          discountType: 'percentage',
          discountValue: 10,
          taxable: true,
        },
        {
          quantity: 1,
          originalUnitPrice: 500,
          discountType: 'fixed',
          discountValue: 100,
          taxable: false,
        },
      ],
      0.16,
    );
    expect(totals).toEqual({
      subtotalOriginal: 2500,
      discountTotal: 300,
      subtotalFinal: 2200,
      globalDiscountAmount: 0,
      taxableBase: 2200,
      taxTotal: 352,
      grandTotal: 2552,
    });
  });

  it('never allows a discount greater than the line amount', () => {
    expect(() =>
      calculateItem({
        quantity: 1,
        originalUnitPrice: 100,
        discountType: 'fixed',
        discountValue: 101,
        taxable: true,
      }),
    ).toThrow('descuento fijo');
  });

  it('applies a global percentage discount before global IVA', () => {
    const totals = calculateQuoteTotals(
      [
        {
          quantity: 1,
          originalUnitPrice: 10000,
          discountType: 'none',
          discountValue: 0,
          taxable: true,
        },
      ],
      0.16,
      {type: 'percentage', value: 10},
      true,
    );
    expect(totals).toMatchObject({
      subtotalOriginal: 10000,
      discountTotal: 0,
      subtotalFinal: 10000,
      globalDiscountAmount: 1000,
      taxableBase: 9000,
      taxTotal: 1440,
      grandTotal: 10440,
    });
  });

  it('supports a fixed global discount and disabling IVA', () => {
    const totals = calculateQuoteTotals(
      [
        {
          quantity: 1,
          originalUnitPrice: 10000,
          discountType: 'none',
          discountValue: 0,
          taxable: false,
        },
      ],
      0.16,
      {type: 'fixed', value: 2500},
      false,
    );
    expect(totals.globalDiscountAmount).toBe(2500);
    expect(totals.taxableBase).toBe(7500);
    expect(totals.taxTotal).toBe(0);
    expect(totals.grandTotal).toBe(7500);
  });

  it('rejects invalid global discounts', () => {
    expect(() => calculateQuoteTotals([], 0.16, {type: 'percentage', value: 101}, true)).toThrow(
      'invalid-global-discount',
    );
    expect(() => calculateQuoteTotals([], 0.16, {type: 'fixed', value: 1}, true)).toThrow(
      'invalid-global-discount',
    );
  });
});
