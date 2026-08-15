import type {Quote} from '../../../models/domain';
import {createDocument, getDocument, updateDocument} from '../../../services/firebase/data';
import type {CreateQuoteDraftInput} from '../application/quoteDrafts';
import {createQuoteDraft, updateQuoteDraft} from '../application/quoteDrafts';
import {normalizeQuoteRecord} from '../domain/normalizeQuoteRecord';

export async function getQuoteRecord(quoteId: string): Promise<Quote | null> {
  const record = await getDocument<Quote>('quotes', quoteId);
  return record ? normalizeQuoteRecord(record) : null;
}

export function createQuoteRecord(input: CreateQuoteDraftInput): Promise<string> {
  return createDocument('quotes', createQuoteDraft(input), input.actorId);
}

export function updateQuoteRecord(
  quote: Quote,
  patch: Pick<Quote, 'notes' | 'serviceReference' | 'technicalContext'>,
  actor: {id: string; role: CreateQuoteDraftInput['actorRole']},
): Promise<void> {
  return updateDocument('quotes', quote.id, updateQuoteDraft(quote, patch, actor), actor.id);
}
