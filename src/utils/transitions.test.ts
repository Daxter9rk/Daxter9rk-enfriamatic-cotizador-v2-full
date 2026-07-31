import {describe, expect, it} from 'vitest';
import {canTransitionQuote, canTransitionRequest} from './transitions';

describe('workflow transitions', () => {
  it('accepts the request happy path and rejects skips', () => {
    expect(canTransitionRequest('pending', 'assigned')).toBe(true);
    expect(canTransitionRequest('assigned', 'in_progress')).toBe(true);
    expect(canTransitionRequest('in_progress', 'completed')).toBe(true);
    expect(canTransitionRequest('pending', 'completed')).toBe(false);
  });

  it('locks the issued quote workflow to explicit transitions', () => {
    expect(canTransitionQuote('draft', 'issued')).toBe(true);
    expect(canTransitionQuote('issued', 'accepted')).toBe(false);
    expect(canTransitionQuote('sent', 'accepted')).toBe(true);
  });
});
