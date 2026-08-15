import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {SettingsPage} from './SettingsPage';

const getDocument = vi.hoisted(() => vi.fn());
const updateDocument = vi.hoisted(() => vi.fn());

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: {uid: 'admin-1', role: 'admin'}, user: null}),
}));
vi.mock('../../services/firebase/data', () => ({getDocument, updateDocument}));
vi.mock('../../components/ReauthenticationModal', () => ({
  ReauthenticationModal: ({onConfirmed}: {onConfirmed(): Promise<void>}) => (
    <button onClick={() => void onConfirmed()}>Confirmar identidad</button>
  ),
}));

describe('SettingsPage', () => {
  afterEach(() => cleanup());

  it('carga el contrato y rechaza valores inválidos antes de pedir confirmación', async () => {
    getDocument
      .mockResolvedValueOnce({companyName: 'Enfriamatic'})
      .mockResolvedValueOnce({taxRate: 0.16});
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('button', {name: 'Editar'})).toBeVisible());
    fireEvent.click(screen.getByRole('button', {name: 'Editar'}));
    fireEvent.change(screen.getByLabelText('Vigencia (días)'), {target: {value: '0'}});
    fireEvent.submit(screen.getByRole('button', {name: 'Guardar cambios'}).closest('form')!);
    expect(screen.getByText(/vigencia debe ser/i)).toBeVisible();
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it('omite la escritura hasta que existen cambios y confirma un guardado válido', async () => {
    getDocument
      .mockResolvedValueOnce({companyName: 'Enfriamatic'})
      .mockResolvedValueOnce({taxRate: 0.16});
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('button', {name: 'Editar'})).toBeVisible());
    fireEvent.click(screen.getByRole('button', {name: 'Editar'}));
    expect(screen.getByRole('button', {name: 'Guardar cambios'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Dirección'), {target: {value: 'México'}});
    fireEvent.click(screen.getByRole('button', {name: 'Guardar cambios'}));
    fireEvent.click(screen.getByRole('button', {name: 'Confirmar identidad'}));
    await waitFor(() => expect(updateDocument).toHaveBeenCalledTimes(2));
  });
});
