import {describe, expect, it} from 'vitest';
import {formatFolio} from './folio';
import {issueQuoteSchema} from './schemas';

describe('folio and idempotency contracts', () => {
  it('formats an annual monotonic sequence', () => {
    expect(formatFolio('COT', 2026, 42)).toBe('COT-2026-000042');
  });

  it('rejects overflow and invalid idempotency keys', () => {
    expect(() => formatFolio('COT', 2026, 1000000)).toThrow('invalid-folio-sequence');
    expect(
      issueQuoteSchema.safeParse({
        quoteId: 'quote-1',
        idempotencyKey: 'double-click',
      }).success,
    ).toBe(false);
  });
});
