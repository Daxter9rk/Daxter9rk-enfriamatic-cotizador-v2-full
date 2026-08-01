import type {CatalogItem, CatalogItemSnapshot} from '../models/domain';
import type {QuoteItemInput} from '../models/schemas';

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

export function snapshotCatalogItem(item: CatalogItem): CatalogItemSnapshot {
  return {
    code: item.code,
    type: item.type,
    name: item.name,
    description: item.description,
    category: item.category,
    unit: item.unit,
    brand: item.brand ?? null,
    model: item.model ?? null,
    basePrice: item.basePrice,
    taxable: item.taxable,
  };
}

export function catalogItemToQuoteInput(item: CatalogItem, position: number): QuoteItemInput {
  if (item.status !== 'active') {
    throw new Error('El artículo está inactivo y no puede agregarse a una cotización nueva.');
  }
  return {
    position,
    catalogItemId: item.id,
    catalogCode: item.code,
    catalogType: item.type,
    catalogSnapshot: snapshotCatalogItem(item),
    quantity: 1,
    unit: item.unit,
    equipmentOrService: item.name,
    brand: item.brand ?? '',
    model: item.model ?? '',
    description: item.description,
    originalUnitPrice: item.basePrice,
    discountType: 'none',
    discountValue: 0,
    taxable: item.taxable,
  };
}
