import {describe, expect, it} from 'vitest';
import {canTransitionRequest} from './requestPolicy';

describe('request transition policy', () => {
  it('allows assigned work to advance for its operator', () => {
    expect(canTransitionRequest('assigned', 'in_progress', 'operator', true, false)).toBe(true);
    expect(canTransitionRequest('in_progress', 'completed', 'operator', true, false)).toBe(true);
    expect(canTransitionRequest('assigned', 'in_progress', 'operator', false, false)).toBe(false);
  });

  it('reserves cancellation and reopen for admins with a reason', () => {
    expect(canTransitionRequest('completed', 'in_progress', 'admin', false, true)).toBe(true);
    expect(canTransitionRequest('completed', 'in_progress', 'admin', false, false)).toBe(false);
    expect(canTransitionRequest('assigned', 'cancelled', 'admin', false, true)).toBe(true);
    expect(canTransitionRequest('assigned', 'cancelled', 'operator', true, true)).toBe(false);
  });
});
