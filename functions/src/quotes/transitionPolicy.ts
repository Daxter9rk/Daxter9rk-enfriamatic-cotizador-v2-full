import type {UserRole} from '../shared/schemas';

export type CommercialQuoteStatus =
  | 'draft'
  | 'issued'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'expired';
export type CommercialTransitionTarget = 'sent' | 'accepted' | 'rejected' | 'cancelled';

export function requiresCommercialReason(target: CommercialTransitionTarget): boolean {
  return target === 'rejected' || target === 'cancelled';
}

export function canApplyCommercialTransition(
  from: CommercialQuoteStatus,
  to: CommercialTransitionTarget,
  role: UserRole,
  isAssignedOperator: boolean,
): boolean {
  if (to === 'sent') {
    return from === 'issued' && (role === 'admin' || isAssignedOperator);
  }
  if (role !== 'admin') return false;
  if (to === 'accepted' || to === 'rejected') return from === 'sent';
  return to === 'cancelled' && (from === 'issued' || from === 'sent');
}
