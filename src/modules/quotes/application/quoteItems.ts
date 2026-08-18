import type {CatalogItem, CatalogItemSnapshot} from '../../../models/domain';
import type {QuoteItemInput} from '../../../models/schemas';

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

export function createQuoteItemFromCatalog(item: CatalogItem, position: number): QuoteItemInput {
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
