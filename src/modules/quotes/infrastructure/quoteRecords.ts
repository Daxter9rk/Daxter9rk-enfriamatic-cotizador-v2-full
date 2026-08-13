import type {Quote} from '../../../models/domain';
import {getDocument} from '../../../services/firebase/data';

export function getQuoteRecord(quoteId: string): Promise<Quote | null> {
  return getDocument<Quote>('quotes', quoteId);
}
