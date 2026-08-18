import {describe, expect, it} from 'vitest';
import {calculateQuoteTotals} from './calculations';

describe('server quote calculations', () => {
  it('recalculates browser-submitted totals from line inputs', () => {
    expect(
      calculateQuoteTotals(
        [
          {
            quantity: 2,
            originalUnitPrice: 1250,
            discountType: 'percentage',
            discountValue: 20,
            taxable: true,
          },
        ],
        0.16,
      ),
    ).toEqual({
      subtotalOriginal: 2500,
      discountTotal: 500,
      subtotalFinal: 2000,
      taxTotal: 320,
      grandTotal: 2320,
    });
  });

  it('applies the global tax rate even when a historical item is non-taxable', () => {
    expect(
      calculateQuoteTotals(
        [
          {
            quantity: 1,
            originalUnitPrice: 100,
            discountType: 'none',
            discountValue: 0,
            taxable: false,
          },
        ],
        0.16,
      ).taxTotal,
    ).toBe(16);
  });
});
