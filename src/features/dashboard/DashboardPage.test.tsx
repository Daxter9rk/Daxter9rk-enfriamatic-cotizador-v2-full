import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {DashboardPage} from './DashboardPage';
import {useCollection} from '../../hooks/useCollection';

const state = vi.hoisted(() => ({role: 'admin', loading: false, error: null as string | null}));
const reload = vi.hoisted(() => vi.fn());
const quote = vi.hoisted(() => ({
  id: 'quote-1',
  folio: 'COT-001',
  clientId: 'client-1',
  status: 'draft',
  documentStatus: 'not_generated',
  grandTotal: 1250,
  updatedAt: {toDate: () => new Date('2026-08-14T12:00:00Z')},
}));

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: {uid: 'operator-1', role: state.role, displayName: 'Ana Operadora'}}),
}));
vi.mock('../../hooks/useCollection', () => ({
  useCollection: vi.fn(() => ({data: [quote], loading: state.loading, error: state.error, reload})),
}));

describe('DashboardPage', () => {
  afterEach(cleanup);
  beforeEach(() => {
    state.role = 'admin';
    state.loading = false;
    state.error = null;
    reload.mockReset();
    vi.mocked(useCollection).mockClear();
  });

  it('muestra únicamente acciones comerciales y cotizaciones recientes', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('heading', {name: 'Cotizaciones recientes'})).toBeVisible();
    expect(screen.getByRole('link', {name: 'Nueva cotización'})).toHaveAttribute(
      'href',
      '/quotes?new=1',
    );
    expect(screen.getByRole('link', {name: 'Clientes'})).toHaveAttribute('href', '/clients');
    expect(screen.getByRole('link', {name: 'Catálogo comercial'})).toHaveAttribute(
      'href',
      '/commercial-catalog',
    );
    expect(screen.queryByText('Solicitudes recientes')).not.toBeInTheDocument();
    expect(screen.queryByText('Nueva instalación')).not.toBeInTheDocument();
    expect(screen.queryByText('Registrar equipo')).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: /COT-001.*client-1/i})).toBeVisible();
  });

  it('mantiene la consulta limitada a cotizaciones y no carga módulos retirados', () => {
    render(<DashboardPage />);

    const mockedUseCollection = vi.mocked(useCollection);
    expect(mockedUseCollection).toHaveBeenCalledTimes(1);
    expect(mockedUseCollection).toHaveBeenCalledWith('quotes', expect.any(Array), 20);
    expect(mockedUseCollection.mock.calls[0]?.[0]).toBe('quotes');
  });

  it('aplica la restricción de asignación para el operador', () => {
    state.role = 'operator';
    render(<DashboardPage />);

    const queryConstraints = vi.mocked(useCollection).mock.calls[0]?.[1];
    expect(queryConstraints).toBeDefined();
    expect(queryConstraints).toHaveLength(2);
  });

  it('presenta estados de carga y error sin volver a consultar solicitudes', () => {
    state.loading = true;
    const {rerender} = render(<DashboardPage />);
    expect(screen.getByText('Preparando tu panel…')).toBeVisible();
    state.loading = false;
    state.error = 'Fallo controlado';
    rerender(<DashboardPage />);
    expect(screen.getByText('Fallo controlado')).toBeVisible();
    expect(screen.queryByText('Solicitudes recientes')).not.toBeInTheDocument();
  });
});
