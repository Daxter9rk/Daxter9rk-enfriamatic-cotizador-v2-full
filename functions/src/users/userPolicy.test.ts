import {describe, expect, it} from 'vitest';
import {evaluateUserMutation} from './userPolicy';

const primary = {uid: 'primary', role: 'admin' as const, isPrimaryAdmin: true};
const promoted = {uid: 'promoted', role: 'admin' as const, isPrimaryAdmin: false};
const operator = {uid: 'operator', role: 'operator' as const, isPrimaryAdmin: false};

describe('administrative user policy', () => {
  it('protects the primary administrator and self role/status', () => {
    expect(
      evaluateUserMutation(
        promoted,
        {uid: 'primary', role: 'admin', status: 'active', isPrimaryAdmin: true},
        {role: 'admin', status: 'active'},
        2,
      ),
    ).toBe('primary-protected');
    expect(
      evaluateUserMutation(
        promoted,
        {uid: 'promoted', role: 'admin', status: 'active', isPrimaryAdmin: false},
        {role: 'operator', status: 'active'},
        2,
      ),
    ).toBe('self-role-status');
  });

  it('reserves role changes for the primary and keeps an active admin', () => {
    expect(
      evaluateUserMutation(
        promoted,
        {uid: 'operator', role: 'operator', status: 'active', isPrimaryAdmin: false},
        {role: 'admin', status: 'active'},
        2,
      ),
    ).toBe('primary-required');
    expect(
      evaluateUserMutation(
        primary,
        {uid: 'promoted', role: 'admin', status: 'active', isPrimaryAdmin: false},
        {role: 'operator', status: 'active'},
        1,
      ),
    ).toBe('last-active-admin');
  });

  it('allows the primary to promote an operator and promoted admins to manage operators', () => {
    expect(
      evaluateUserMutation(
        primary,
        {uid: 'operator', role: 'operator', status: 'active', isPrimaryAdmin: false},
        {role: 'admin', status: 'active'},
        1,
      ),
    ).toBeNull();
    expect(
      evaluateUserMutation(
        promoted,
        {uid: 'operator', role: 'operator', status: 'active', isPrimaryAdmin: false},
        {role: 'operator', status: 'inactive'},
        2,
      ),
    ).toBeNull();
    expect(operator.role).toBe('operator');
  });
});
