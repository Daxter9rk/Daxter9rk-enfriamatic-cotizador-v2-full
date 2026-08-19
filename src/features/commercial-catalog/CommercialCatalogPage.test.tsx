import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CommercialCatalogPage} from './CommercialCatalogPage';

const state = vi.hoisted(() => ({role: 'operator'}));
const catalogItems = vi.hoisted(() => [
  {
    id: 'PROD-001',
    code: 'PROD-001',
    type: 'product',
    name: 'Compresor de prueba',
    description: 'Compresor ficticio',
    category: 'Compresores',
    unit: 'pieza',
    brand: 'Marca Demo',
    model: 'M1',
    basePrice: 100,
    taxable: true,
    status: 'active',
    searchTokens: ['compresor'],
  },
  {
    id: 'PROD-IMAGE',
    code: 'PROD-IMAGE',
    type: 'product',
    name: 'Producto con imagen',
    description: 'Imagen privada',
    category: 'Pruebas',
    unit: 'pieza',
    basePrice: 200,
    taxable: true,
    status: 'active',
    searchTokens: ['imagen'],
    imageStoragePath: 'catalog-items/PROD-IMAGE/images/existing.png',
    imageStatus: 'ready',
  },
]);
vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: {uid: 'actor', role: state.role}}),
}));
vi.mock('../../services/firebase/catalogImages', () => ({
  getCatalogImageBlob: vi.fn().mockRejectedValue({code: 'functions/not-found'}),
  upsertCatalogImage: vi.fn(),
  deleteCatalogImage: vi.fn(),
  catalogImageErrorMessage: () => 'Imagen no disponible.',
  catalogImageTechnicalCode: () => 'functions/not-found',
}));
vi.mock('../../hooks/usePaginatedCollection', () => ({
  usePaginatedCollection: () => ({
    data: catalogItems,
    loading: false,
    error: null,
    reload: vi.fn(),
    hasMore: false,
    page: 1,
    nextPage: vi.fn(),
    previousPage: vi.fn(),
  }),
}));

describe('CommercialCatalogPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    state.role = 'operator';
    localStorage.removeItem('enfriamatic-catalog-view');
  });
  it('muestra búsqueda, filtros y artículos activos al operador', () => {
    render(<CommercialCatalogPage />);
    expect(screen.getByRole('heading', {name: /catálogo de productos y servicios/i})).toBeVisible();
    expect(screen.getByRole('heading', {name: 'Compresor de prueba'})).toBeVisible();
    expect(screen.queryByRole('button', {name: /nuevo artículo/i})).not.toBeInTheDocument();
  });
  it('habilita administración para admin dentro del editor', async () => {
    state.role = 'admin';
    render(<CommercialCatalogPage />);
    expect(screen.getByRole('button', {name: /nuevo artículo/i})).toBeVisible();
    expect(screen.queryByRole('button', {name: /imagen/i})).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getAllByRole('button', {name: 'Editar'})[0]!);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', {name: /agregar imagen/i})).toBeVisible();
    expect(within(dialog).getByRole('checkbox', {name: /artículo activo/i})).toBeChecked();
  });

  it('mantiene al operador en lectura sin controles de imagen', () => {
    render(<CommercialCatalogPage />);
    expect(screen.queryByRole('button', {name: /agregar imagen/i})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /cambiar imagen/i})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /eliminar imagen/i})).not.toBeInTheDocument();
  });

  it('filtra por unidad y distingue una búsqueda sin coincidencias', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    render(<CommercialCatalogPage />);
    await user.selectOptions(screen.getByRole('combobox', {name: 'Unidad'}), 'pieza');
    expect(screen.getByRole('heading', {name: 'Compresor de prueba'})).toBeVisible();
    await user.type(screen.getByRole('searchbox'), 'no-existe');
    expect(screen.getByText(/no se encontraron coincidencias/i)).toBeVisible();
  });

  it('switches between cards and table without losing filters', async () => {
    const user = userEvent.setup();
    render(<CommercialCatalogPage />);
    await user.type(screen.getByRole('searchbox'), 'compresor');
    await user.click(screen.getByRole('button', {name: 'Tabla'}));
    expect(screen.getByRole('table')).toBeVisible();
    expect(screen.getByRole('row', {name: /Compresor de prueba/})).toBeVisible();
    await user.click(screen.getByRole('button', {name: 'Tarjetas'}));
    expect(screen.getByRole('heading', {name: 'Compresor de prueba'})).toBeVisible();
  });
});
