import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {MasterDataPage} from './MasterDataPage';

const records = vi.hoisted(() => [
  {
    id: 'c-active',
    name: 'Cliente Activo',
    legalName: 'Activos SA',
    rfc: 'ACT010101AA1',
    status: 'active',
  },
  {
    id: 'c-inactive',
    name: 'Cliente Inactivo',
    legalName: 'Histórico SA',
    rfc: 'HIS010101BB2',
    status: 'inactive',
  },
]);
vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: {uid: 'admin', role: 'admin'}}),
}));
vi.mock('wouter', () => ({
  useSearch: () => '',
  useLocation: () => ['', vi.fn()],
  Link: ({children}: {children: ReactNode}) => <span>{children}</span>,
}));
vi.mock('../../hooks/usePaginatedCollection', () => ({
  usePaginatedCollection: () => ({
    data: records,
    loading: false,
    error: null,
    hasMore: false,
    page: 1,
    nextPage: vi.fn(),
    previousPage: vi.fn(),
    reload: vi.fn(),
  }),
}));
vi.mock('../../hooks/useCollection', () => ({
  useCollection: () => ({data: [], loading: false, error: null, reload: vi.fn()}),
}));

describe('MasterDataPage clients filters', () => {
  afterEach(cleanup);

  it('searches commercial identifiers, filters status and distinguishes no matches', async () => {
    const user = userEvent.setup();
    render(<MasterDataPage kind="clients" />);
    await user.type(screen.getByRole('searchbox'), 'ACT010101');
    expect(screen.getByText('Cliente Activo')).toBeVisible();
    expect(screen.queryByText('Cliente Inactivo')).not.toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox'));
    await user.selectOptions(screen.getByRole('combobox', {name: 'Estado'}), 'inactive');
    expect(screen.getByText('Cliente Inactivo')).toBeVisible();
    await user.type(screen.getByRole('searchbox'), 'no-existe');
    expect(screen.getByText(/no se encontraron coincidencias/i)).toBeVisible();
  });
});
