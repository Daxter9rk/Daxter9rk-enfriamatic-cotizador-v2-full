export type QuoteStatus =
  | 'draft'
  | 'issued'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export type DocumentStatus = 'not_generated' | 'generating' | 'ready' | 'failed';

export type DiscountDisplayMode = 'detailed' | 'summary' | 'incorporated';
