import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {UsersPage} from './UsersPage';

const state = vi.hoisted(() => ({
  profile: {uid: 'seed-admin-active', role: 'admin', isPrimaryAdmin: true},
}));
const callFunctionMock = vi.hoisted(() => vi.fn());
const reloadMock = vi.hoisted(() => vi.fn());
const users = vi.hoisted(() => [
  {
    uid: 'seed-admin-active',
    email: 'admin@local',
    displayName: 'Admin Principal',
    role: 'admin',
    status: 'active',
    isPrimaryAdmin: true,
  },
  {
    uid: 'pending-user',
    email: 'pending@local',
    displayName: 'Usuario Pendiente',
    role: 'operator',
    status: 'pending',
    isPrimaryAdmin: false,
  },
  {
    uid: 'suspended-user',
    email: 'suspended@local',
    displayName: 'Usuario Suspendido',
    role: 'operator',
    status: 'suspended',
    isPrimaryAdmin: false,
  },
]);

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: state.profile, refreshProfile: vi.fn()}),
}));
vi.mock('../../hooks/useCollection', () => ({
  useCollection: () => ({data: users, loading: false, error: null, reload: reloadMock}),
}));
vi.mock('../../services/firebase/data', () => ({callFunction: callFunctionMock}));
vi.mock('../../components/ReauthenticationModal', () => ({ReauthenticationModal: () => null}));

describe('UsersPage', () => {
  beforeEach(() => {
    callFunctionMock.mockResolvedValue({});
  });
  afterEach(cleanup);

  it('shows only active and inactive as administrative choices and preserves historical states', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    const pendingRow = screen.getByRole('row', {name: /Usuario Pendiente/});
    await user.click(within(pendingRow).getByRole('button', {name: 'Administrar'}));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/estado técnico histórico: pendiente/i)).toBeVisible();
    expect(within(dialog).getByRole('option', {name: 'Activo'})).toBeInTheDocument();
    expect(within(dialog).getByRole('option', {name: 'Inactivo'})).toBeInTheDocument();
    expect(within(dialog).queryByRole('option', {name: 'Pendiente'})).toBeNull();
    expect(within(dialog).queryByRole('option', {name: 'Suspendido'})).toBeNull();
  });

  it('marks and protects the primary administrator in the list and editor', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);
    expect(screen.getByText('ADMINISTRADOR PRINCIPAL')).toBeVisible();
    const primaryRow = screen.getByRole('row', {name: /Admin Principal/});
    await user.click(within(primaryRow).getByRole('button', {name: 'Administrar'}));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/rol y estado están protegidos/i)).toBeVisible();
    expect(within(dialog).getByText('ADMINISTRADOR PRINCIPAL')).toBeVisible();
    expect(within(dialog).getByRole('combobox', {name: 'Rol'})).toBeDisabled();
    expect(within(dialog).getByRole('combobox', {name: 'Estado'})).toBeDisabled();
    expect(within(dialog).queryByRole('button', {name: /eliminar/i})).toBeNull();
  });
});
