import {describe, expect, it} from 'vitest';
import type {QuoteItem} from '../../models/domain';
import {chunkQuoteItems} from './QuoteEditor';

describe('quote preview pagination', () => {
  it('distribuye una cotización larga sin perder ni duplicar partidas', () => {
    const items = Array.from({length: 23}, (_, index) => ({
      id: `item-${index + 1}`,
      position: index + 1,
    })) as QuoteItem[];

    const pages = chunkQuoteItems(items, 10);

    expect(pages.map((page) => page.length)).toEqual([10, 10, 3]);
    expect(pages.flat().map((item) => item.id)).toEqual(items.map((item) => item.id));
  });

  it('conserva una página vacía para el borrador sin partidas', () => {
    expect(chunkQuoteItems([], 10)).toEqual([[]]);
  });
});
