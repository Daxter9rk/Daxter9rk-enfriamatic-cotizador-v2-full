import {cleanup, render, screen} from '@testing-library/react';
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
vi.mock('../../hooks/useCollection', () => ({
  useCollection: () => ({
    data: catalogItems,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

describe('CommercialCatalogPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    state.role = 'operator';
  });
  it('muestra búsqueda, filtros y artículos activos al operador', () => {
    render(<CommercialCatalogPage />);
    expect(screen.getByRole('heading', {name: /catálogo de productos y servicios/i})).toBeVisible();
    expect(screen.getByRole('heading', {name: 'Compresor de prueba'})).toBeVisible();
    expect(screen.queryByRole('button', {name: /nuevo artículo/i})).not.toBeInTheDocument();
  });
  it('habilita administración para admin', () => {
    state.role = 'admin';
    render(<CommercialCatalogPage />);
    expect(screen.getByRole('button', {name: /nuevo artículo/i})).toBeVisible();
    expect(screen.getAllByRole('button', {name: /desactivar/i})).toHaveLength(2);
    expect(screen.getByRole('button', {name: /agregar imagen/i})).toBeVisible();
    expect(screen.getByRole('button', {name: /cambiar imagen/i})).toBeVisible();
    expect(screen.getByRole('button', {name: /eliminar imagen/i})).toBeVisible();
  });

  it('mantiene al operador en lectura sin controles de imagen', () => {
    render(<CommercialCatalogPage />);
    expect(screen.queryByRole('button', {name: /agregar imagen/i})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /cambiar imagen/i})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /eliminar imagen/i})).not.toBeInTheDocument();
  });
});
