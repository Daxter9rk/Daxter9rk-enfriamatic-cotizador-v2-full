import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommercialCatalogPage} from './CommercialCatalogPage';

const state = vi.hoisted(() => ({role: 'operator'}));
vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: {uid: 'actor', role: state.role}}),
}));
vi.mock('../../hooks/useCollection', () => ({
  useCollection: () => ({
    data: [
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
    ],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

describe('CommercialCatalogPage', () => {
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
    expect(screen.getByRole('button', {name: /desactivar/i})).toBeVisible();
  });
});
