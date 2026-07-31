import {describe, expect, it} from 'vitest';
import {clientInputSchema, createUserInputSchema, quoteItemInputSchema} from './schemas';

describe('runtime schemas', () => {
  it('normalizes email and rejects a weak password', () => {
    const result = createUserInputSchema.safeParse({
      email: ' ADMIN@Example.COM ',
      password: 'short',
      displayName: 'Administrador',
      role: 'admin',
      status: 'active',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unsupported roles', () => {
    const result = createUserInputSchema.safeParse({
      email: 'admin@example.test',
      password: 'DevOnly!Password2026',
      displayName: 'Administrador',
      role: 'reader',
      status: 'active',
    });
    expect(result.success).toBe(false);
  });

  it('enforces quote item limits and valid client status', () => {
    expect(
      quoteItemInputSchema.safeParse({
        position: 0,
        quantity: 0,
        unit: 'pieza',
        description: 'Sensor',
        originalUnitPrice: 100,
        discountType: 'none',
        discountValue: 0,
        taxable: true,
      }).success,
    ).toBe(false);
    expect(clientInputSchema.safeParse({name: 'Cliente', status: 'deleted'}).success).toBe(false);
  });
});
