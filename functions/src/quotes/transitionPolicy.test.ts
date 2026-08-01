import {describe, expect, it} from 'vitest';
import {transitionQuoteSchema} from '../shared/schemas';
import {canApplyCommercialTransition, requiresCommercialReason} from './transitionPolicy';

describe('commercial quote transitions', () => {
  it('allows an assigned operator or admin to mark an issued quote sent', () => {
    expect(canApplyCommercialTransition('issued', 'sent', 'operator', true)).toBe(true);
    expect(canApplyCommercialTransition('issued', 'sent', 'operator', false)).toBe(false);
    expect(canApplyCommercialTransition('issued', 'sent', 'admin', false)).toBe(true);
  });

  it('reserves decisions and cancellation for administrators', () => {
    expect(canApplyCommercialTransition('sent', 'accepted', 'admin', false)).toBe(true);
    expect(canApplyCommercialTransition('sent', 'rejected', 'operator', true)).toBe(false);
    expect(canApplyCommercialTransition('issued', 'cancelled', 'admin', false)).toBe(true);
    expect(canApplyCommercialTransition('accepted', 'cancelled', 'admin', false)).toBe(false);
  });

  it('requires reasons for rejection and cancellation', () => {
    expect(requiresCommercialReason('rejected')).toBe(true);
    expect(requiresCommercialReason('cancelled')).toBe(true);
    expect(requiresCommercialReason('sent')).toBe(false);
    expect(
      transitionQuoteSchema.safeParse({quoteId: 'quote', to: 'rejected', reason: null}).success,
    ).toBe(false);
    expect(
      transitionQuoteSchema.safeParse({
        quoteId: 'quote',
        to: 'cancelled',
        reason: 'Cliente canceló',
      }).success,
    ).toBe(true);
  });
});
