export function isIndependentQuote(quote: Record<string, unknown>): boolean {
  return quote.requestId == null;
}

export function getRootQuoteId(quoteId: string, quote: Record<string, unknown>): string {
  return typeof quote.originalQuoteId === 'string' && quote.originalQuoteId
    ? quote.originalQuoteId
    : quoteId;
}

export function getNextRevision(rootRevision: unknown, latestRevision?: unknown): number {
  const root = Number(rootRevision ?? 1);
  const latest = latestRevision == null ? root : Number(latestRevision);
  if (!Number.isSafeInteger(root) || root < 1 || !Number.isSafeInteger(latest) || latest < root) {
    throw new Error('invalid-revision');
  }
  return latest + 1;
}
