import {describe, expect, it} from 'vitest';
import {getNextRevision, getRootQuoteId, isIndependentQuote} from './correctionPolicy';

describe('independent correction policy', () => {
  it('distinguishes independent and historical quotes by requestId', () => {
    expect(isIndependentQuote({requestId: null})).toBe(true);
    expect(isIndependentQuote({requestId: 'request-1'})).toBe(false);
    expect(isIndependentQuote({})).toBe(true);
  });

  it('keeps all corrections attached to the root quote', () => {
    expect(getRootQuoteId('q0', {})).toBe('q0');
    expect(getRootQuoteId('q1', {originalQuoteId: 'q0'})).toBe('q0');
  });

  it('increments a valid revision and rejects invalid state', () => {
    expect(getNextRevision(1)).toBe(2);
    expect(getNextRevision(1, 3)).toBe(4);
    expect(() => getNextRevision(0)).toThrow('invalid-revision');
    expect(() => getNextRevision(3, 2)).toThrow('invalid-revision');
  });
});
