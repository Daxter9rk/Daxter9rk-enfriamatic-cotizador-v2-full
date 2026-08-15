import type {UserRole} from '../shared/schemas';

export interface UserPolicyActor {
  uid: string;
  role: UserRole;
  isPrimaryAdmin: boolean;
}

export interface UserPolicyProfile {
  uid: string;
  role: UserRole;
  status: string;
  isPrimaryAdmin: boolean;
}

export type UserPolicyFailure =
  | 'primary-protected'
  | 'self-role-status'
  | 'primary-required'
  | 'admin-target-protected'
  | 'last-active-admin';

export function evaluateUserMutation(
  actor: UserPolicyActor,
  target: UserPolicyProfile,
  next: Pick<UserPolicyProfile, 'role' | 'status'>,
  activeAdminCount: number,
): UserPolicyFailure | null {
  const roleChanged = target.role !== next.role;
  const statusChanged = target.status !== next.status;
  const sensitiveChange = roleChanged || statusChanged;

  if (target.isPrimaryAdmin && actor.uid !== target.uid) return 'primary-protected';
  if (target.isPrimaryAdmin && sensitiveChange) return 'primary-protected';
  if (actor.uid === target.uid && sensitiveChange) return 'self-role-status';
  if (roleChanged && !actor.isPrimaryAdmin) return 'primary-required';
  if (target.role === 'admin' && !actor.isPrimaryAdmin) return 'admin-target-protected';
  if (
    target.role === 'admin' &&
    target.status === 'active' &&
    (next.role !== 'admin' || next.status !== 'active') &&
    activeAdminCount <= 1
  ) {
    return 'last-active-admin';
  }
  return null;
}

export function userPolicyMessage(failure: UserPolicyFailure): string {
  return (
    {
      'primary-protected': 'The primary administrator is protected.',
      'self-role-status': 'Users cannot change their own role or status.',
      'primary-required': 'Only the primary administrator can change roles.',
      'admin-target-protected': 'Only the primary administrator can manage administrators.',
      'last-active-admin': 'The system must keep at least one active administrator.',
    } as const
  )[failure];
}
