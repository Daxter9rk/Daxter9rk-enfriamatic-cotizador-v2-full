import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CatalogsPage} from './CatalogsPage';

const state = vi.hoisted(() => ({role: 'admin'}));
vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: {uid: 'actor-1', role: state.role}}),
}));
vi.mock('../../hooks/useCollection', () => ({
  useCollection: () => ({
    data: [{id: 'priority-high', type: 'priority', name: 'Alta', value: 'high', status: 'active'}],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock('../../services/firebase/data', () => ({
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
}));

describe('CatalogsPage', () => {
  afterEach(cleanup);
  beforeEach(() => {
    state.role = 'admin';
  });

  it('presenta etiquetas en español y acciones administrativas', () => {
    render(<CatalogsPage />);
    expect(screen.getByRole('heading', {name: 'Catálogos internos'})).toBeVisible();
    expect(screen.getAllByText('Prioridad')).not.toHaveLength(0);
    expect(screen.getAllByText('Alta')).not.toHaveLength(0);
    expect(screen.getByText('Activo')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Editar'})).toBeVisible();
    expect(screen.getByRole('button', {name: 'Desactivar'})).toBeVisible();
  });

  it('mantiene al operador en lectura sin acciones administrativas', () => {
    state.role = 'operator';
    render(<CatalogsPage />);
    expect(screen.queryByRole('button', {name: 'Nuevo elemento'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Editar'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Desactivar'})).not.toBeInTheDocument();
  });
});
