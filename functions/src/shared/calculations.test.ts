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
});
