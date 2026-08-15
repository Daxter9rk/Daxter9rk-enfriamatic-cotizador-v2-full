import type {CatalogItem} from '../models/domain';

export {
  createQuoteItemFromCatalog,
  createQuoteItemFromCatalog as catalogItemToQuoteInput,
  snapshotCatalogItem,
} from '../modules/quotes/application/quoteItems';

export function normalizeCatalogCode(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildSearchTokens(...values: Array<string | null | undefined>): string[] {
  const tokens = values
    .filter((value): value is string => Boolean(value))
    .flatMap((value) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    );
  return [...new Set(tokens)].slice(0, 50);
}

export function matchesCatalogSearch(item: CatalogItem, search: string): boolean {
  const terms = buildSearchTokens(search);
  if (terms.length === 0) return true;
  const haystack = new Set(
    buildSearchTokens(
      item.code,
      item.name,
      item.description,
      item.category,
      item.brand,
      item.model,
      ...item.searchTokens,
    ),
  );
  return terms.every((term) => haystack.has(term));
}
