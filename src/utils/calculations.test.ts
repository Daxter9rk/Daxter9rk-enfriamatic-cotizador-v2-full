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
      taxTotal: 288,
      grandTotal: 2488,
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
});
