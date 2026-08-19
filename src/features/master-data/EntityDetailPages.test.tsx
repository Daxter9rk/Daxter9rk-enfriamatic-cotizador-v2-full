import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ClientDetailPage} from './EntityDetailPages';

const state = vi.hoisted(() => ({role: 'admin' as 'admin' | 'operator'}));
const deleteClientMock = vi.hoisted(() => vi.fn());
const updateDocumentMock = vi.hoisted(() => vi.fn());

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: {uid: 'admin', role: state.role}}),
}));
vi.mock('../../components/Icon', () => ({Icon: () => null}));
vi.mock('wouter', () => ({Link: ({children}: {children: ReactNode}) => <span>{children}</span>}));
vi.mock('../../hooks/useCollection', () => ({
  useCollection: () => ({data: [], loading: false, error: null, reload: vi.fn()}),
}));
vi.mock('../../services/firebase/data', () => ({
  constraints: {byClient: vi.fn(() => ({}))},
  createDocument: vi.fn(),
  getDocument: vi.fn(() =>
    Promise.resolve({id: 'client-1', name: 'Cliente eliminable', status: 'active'}),
  ),
  listDocuments: vi.fn(() => Promise.resolve([])),
  deleteClient: deleteClientMock,
  updateDocument: updateDocumentMock,
}));

describe('ClientDetailPage deletion controls', () => {
  afterEach(() => {
    cleanup();
    state.role = 'admin';
    deleteClientMock.mockReset();
    updateDocumentMock.mockReset();
  });

  it('shows the destructive action only to administrators and requires confirmation', async () => {
    const user = userEvent.setup();
    render(<ClientDetailPage clientId="client-1" />);
    expect(await screen.findByRole('button', {name: 'Eliminar cliente'})).toBeVisible();
    await user.click(screen.getByRole('button', {name: 'Eliminar cliente'}));
    expect(screen.getByRole('dialog')).toHaveTextContent('no puede deshacerse');
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Cancelar'}),
    ).toHaveFocus();
  });

  it('does not render deletion controls for operators', async () => {
    state.role = 'operator';
    render(<ClientDetailPage clientId="client-1" />);
    await waitFor(() => {
      expect(screen.queryAllByRole('button', {name: 'Eliminar cliente'})).toHaveLength(0);
    });
  });

  it('offers deactivation when the backend reports dependencies', async () => {
    const user = userEvent.setup();
    deleteClientMock.mockResolvedValue({
      outcome: 'has_dependencies',
      dependencySummary: {quotes: 1},
    });
    render(<ClientDetailPage clientId="client-1" />);
    await user.click(await screen.findByRole('button', {name: 'Eliminar cliente'}));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Eliminar cliente'}),
    );
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText('Cliente con historial')).toBeVisible();
    expect(within(dialog).queryByRole('button', {name: 'Eliminar cliente'})).toBeNull();
    expect(deleteClientMock).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole('button', {name: 'Desactivar cliente'}));
    await waitFor(() => {
      expect(updateDocumentMock).toHaveBeenCalledWith(
        'clients',
        'client-1',
        {status: 'inactive'},
        'admin',
      );
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
