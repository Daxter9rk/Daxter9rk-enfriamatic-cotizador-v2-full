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
      globalDiscountAmount: 0,
      taxableBase: 2000,
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

  it('calculates global discount before optional IVA', () => {
    expect(
      calculateQuoteTotals(
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
      ),
    ).toMatchObject({
      globalDiscountAmount: 1000,
      taxableBase: 9000,
      taxTotal: 1440,
      grandTotal: 10440,
    });
    expect(
      calculateQuoteTotals(
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
        {type: 'fixed', value: 2500},
        false,
      ),
    ).toMatchObject({globalDiscountAmount: 2500, taxTotal: 0, grandTotal: 7500});
  });
});
