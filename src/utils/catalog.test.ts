import {describe, expect, it} from 'vitest';
import type {CatalogItem} from '../models/domain';
import {
  buildSearchTokens,
  catalogItemToQuoteInput,
  matchesCatalogSearch,
  normalizeCatalogCode,
} from './catalog';

const item = {
  id: 'COMP-001',
  code: 'COMP-001',
  type: 'product',
  name: 'Compresor semihermético',
  description: 'Compresor industrial de cuatro cilindros',
  category: 'Compresores',
  unit: 'pieza',
  brand: 'Bitzer',
  model: '4PES-15Y',
  basePrice: 482000,
  taxable: true,
  status: 'active',
  searchTokens: ['compresor', 'bitzer'],
} as CatalogItem;

describe('catálogo comercial', () => {
  it('normaliza códigos y genera tokens sin duplicados', () => {
    expect(normalizeCatalogCode(' comp á 001 ')).toBe('COMP-A-001');
    expect(buildSearchTokens('Válvula válvula', 'Danfoss')).toEqual(['valvula', 'danfoss']);
  });

  it('busca por texto normalizado', () => {
    expect(matchesCatalogSearch(item, 'bitzer compresor')).toBe(true);
    expect(matchesCatalogSearch(item, 'evaporador')).toBe(false);
  });

  it('crea un snapshot independiente para la partida', () => {
    const quoteInput = catalogItemToQuoteInput(item, 2);
    expect(quoteInput.catalogSnapshot?.basePrice).toBe(482000);
    item.basePrice = 500000;
    expect(quoteInput.originalUnitPrice).toBe(482000);
    expect(quoteInput.catalogSnapshot?.basePrice).toBe(482000);
  });

  it('rechaza artículos inactivos', () => {
    expect(() => catalogItemToQuoteInput({...item, status: 'inactive'}, 0)).toThrow(/inactivo/i);
  });
});
