import type {UserRole} from '../shared/schemas';

export type RequestStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type RequestTransitionTarget = 'in_progress' | 'completed' | 'cancelled';

export function canTransitionRequest(
  from: RequestStatus,
  to: RequestTransitionTarget,
  role: UserRole,
  assignedToActor: boolean,
  hasReason: boolean,
): boolean {
  if (from === 'completed' && to === 'in_progress') return role === 'admin' && hasReason;
  if (to === 'cancelled') {
    return role === 'admin' && hasReason && ['pending', 'assigned', 'in_progress'].includes(from);
  }
  if (to === 'in_progress') {
    return from === 'assigned' && (role === 'admin' || assignedToActor);
  }
  return from === 'in_progress' && (role === 'admin' || assignedToActor);
}

export function hasValidReassignmentReason(
  previousAssignee: unknown,
  nextAssignee: string,
  note: string | null | undefined,
): boolean {
  if (typeof previousAssignee !== 'string' || previousAssignee === nextAssignee) return true;
  return Boolean(note && note.trim().length >= 5);
}
