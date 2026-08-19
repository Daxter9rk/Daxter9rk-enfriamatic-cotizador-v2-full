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

  it('exposes only active and inactive as administrative creation states', () => {
    const base = {
      email: 'operator@example.test',
      password: 'DevOnly!Password2026',
      displayName: 'Operador',
      role: 'operator' as const,
    };
    expect(createUserInputSchema.safeParse({...base, status: 'active'}).success).toBe(true);
    expect(createUserInputSchema.safeParse({...base, status: 'inactive'}).success).toBe(true);
    expect(createUserInputSchema.safeParse({...base, status: 'pending'}).success).toBe(false);
    expect(createUserInputSchema.safeParse({...base, status: 'suspended'}).success).toBe(false);
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
