import type {QuoteStatus, RequestStatus} from '../models/domain';

const requestTransitions: Record<RequestStatus, RequestStatus[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const quoteTransitions: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['issued'],
  issued: ['sent', 'cancelled'],
  sent: ['accepted', 'rejected', 'cancelled'],
  accepted: [],
  rejected: [],
  cancelled: [],
  expired: [],
};

export const canTransitionRequest = (from: RequestStatus, to: RequestStatus): boolean =>
  requestTransitions[from].includes(to);

export const canTransitionQuote = (from: QuoteStatus, to: QuoteStatus): boolean =>
  quoteTransitions[from].includes(to);
