import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {QuoteItem} from '../../models/domain';
import {QuoteEditor as QuoteEditorForTest} from './QuoteEditor';
import {chunkQuoteItems} from './QuoteEditor';

const mocks = vi.hoisted(() => ({
  updateDocument: vi.fn().mockResolvedValue(undefined),
  saveQuoteItem: vi.fn().mockResolvedValue(undefined),
  listedItems: [] as QuoteItem[],
}));

vi.mock('../../services/firebase/data', () => ({
  callFunction: vi.fn(),
  deleteQuoteItem: vi.fn(),
  listQuoteItems: vi.fn(() => Promise.resolve(mocks.listedItems)),
  saveQuoteItem: mocks.saveQuoteItem,
  updateDocument: mocks.updateDocument,
}));

vi.mock('../../modules/quotes', async () => {
  const actual =
    await vi.importActual<typeof import('../../modules/quotes')>('../../modules/quotes');
  return {...actual, updateQuoteRecord: vi.fn().mockResolvedValue(undefined)};
});

const quote = {
  id: 'quote-1',
  folio: 'BORRADOR',
  clientId: 'client-1',
  status: 'draft',
  documentStatus: 'not_generated',
  currency: 'MXN',
  taxRate: 0.16,
  discountDisplayMode: 'detailed',
  subtotalOriginal: 1000,
  discountTotal: 0,
  subtotalFinal: 1000,
  taxTotal: 160,
  grandTotal: 1160,
  validityDays: 15,
  revisionNumber: 1,
  locked: false,
  requestId: null,
  applyTax: true,
  globalDiscountType: 'none',
  globalDiscountValue: 0,
  globalDiscountAmount: 0,
} as never;

function renderEditor() {
  return render(
    <QuoteEditorForTest
      quote={quote}
      profileId="admin"
      profileRole="admin"
      catalog={[]}
      client={{id: 'client-1', name: 'Cliente demo'} as never}
      site={undefined}
      equipment={undefined}
      onClose={vi.fn()}
      onChanged={vi.fn().mockResolvedValue(undefined)}
    />,
  );
}

beforeEach(() => {
  mocks.listedItems = [];
  mocks.updateDocument.mockClear();
  mocks.saveQuoteItem.mockClear();
});

afterEach(() => {
  cleanup();
});

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

describe('quote editor phase two interactions', () => {
  it('renders an accessible IVA switch and toggles it without duplicating the field', async () => {
    const user = userEvent.setup();
    renderEditor();
    const taxSwitch = await screen.findByRole('switch', {name: 'Aplicar IVA 16 %'});

    expect(taxSwitch).toBeChecked();
    await user.click(taxSwitch);
    expect(taxSwitch).not.toBeChecked();
    expect(screen.getByText('IVA desactivado')).toBeVisible();
    expect(screen.getAllByRole('switch')).toHaveLength(1);
  });

  it('locks the IVA switch for an issued quote', async () => {
    render(
      <QuoteEditorForTest
        quote={{...(quote as object), status: 'issued', locked: true} as never}
        profileId="admin"
        profileRole="admin"
        catalog={[]}
        client={{id: 'client-1', name: 'Cliente demo'} as never}
        site={undefined}
        equipment={undefined}
        onClose={vi.fn()}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(await screen.findByRole('switch', {name: 'Aplicar IVA 16 %'})).toBeDisabled();
  });

  it('cancels a new manual item, restores focus, and reopens clean', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByTestId('manual-item-trigger');
    await user.click(screen.getByTestId('manual-item-trigger'));
    await user.type(screen.getByTestId('quote-item-description'), 'No guardar');
    await user.click(screen.getByRole('button', {name: 'Cancelar'}));

    expect(screen.queryByTestId('quote-item-description')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('manual-item-trigger')).toHaveFocus());
    await user.click(screen.getByTestId('manual-item-trigger'));
    expect(screen.getByTestId('quote-item-description')).toHaveValue('');
    expect(mocks.saveQuoteItem).not.toHaveBeenCalled();
  });

  it('cancels editing without changing the item', async () => {
    mocks.listedItems = [
      {
        id: 'item-1',
        position: 0,
        quantity: 1,
        unit: 'servicio',
        description: 'Descripción original',
        originalUnitPrice: 100,
        discountType: 'none',
        discountValue: 0,
        finalUnitPrice: 100,
        lineSubtotal: 100,
      } as QuoteItem,
    ];
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('button', {name: 'Editar'}));
    await user.clear(screen.getByTestId('quote-item-description'));
    await user.type(screen.getByTestId('quote-item-description'), 'Cambio cancelado');
    await user.click(screen.getByRole('button', {name: 'Cancelar'}));

    expect(screen.getByText('Descripción original')).toBeVisible();
    expect(screen.queryByDisplayValue('Cambio cancelado')).not.toBeInTheDocument();
    expect(mocks.saveQuoteItem).not.toHaveBeenCalled();
  });

  it('keeps service reference as a compact single-line input', async () => {
    renderEditor();
    const input = await screen.findByRole('textbox', {name: 'Referencia de servicio'});
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveClass('quote-service-reference');
    expect(screen.queryByRole('textbox', {name: 'Referencia de servicio'})).not.toHaveAttribute(
      'rows',
    );
  });

  it('keeps preview totals aligned with the editor tax presentation', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('button', {name: 'Vista previa'}));

    const preview = screen.getByRole('dialog', {name: 'Vista previa'});
    const closeButton = screen.getByRole('button', {name: 'Cerrar vista previa'});
    expect(closeButton.parentElement).toHaveClass('preview-overlay__toolbar');
    expect(closeButton.closest('.quote-preview')).toBeNull();
    expect(preview).toHaveTextContent('Descuento global');
    expect(preview).toHaveTextContent('IVA global (16%)');

    await user.click(screen.getByRole('button', {name: 'Cerrar vista previa'}));
    await user.click(screen.getByRole('switch', {name: 'Aplicar IVA 16 %'}));
    await user.click(screen.getByRole('button', {name: 'Vista previa'}));
    expect(screen.getByRole('dialog', {name: 'Vista previa'})).toHaveTextContent('IVA desactivado');
  });
});
