import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {SupportPage} from './SupportPage';

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: {uid: 'operator-1', role: 'operator'}}),
}));
vi.mock('../../hooks/useCollection', () => ({
  useCollection: () => ({data: [], loading: false, error: null, reload: vi.fn()}),
}));
vi.mock('../../services/firebase/config', () => ({storage: {}}));
vi.mock('../../services/firebase/data', () => ({
  constraints: {createdBy: vi.fn()},
  createDocument: vi.fn(),
  reserveDocumentId: vi.fn(),
  createKnownDocument: vi.fn(),
  updateDocument: vi.fn(),
}));

describe('SupportPage', () => {
  afterEach(() => cleanup());

  it('pide contexto en lenguaje común y advierte sobre datos sensibles', () => {
    render(<SupportPage />);

    expect(screen.getByRole('heading', {name: 'Centro de ayuda y soporte'})).toBeVisible();
    expect(screen.getByLabelText('¿Qué intentabas hacer?')).toBeVisible();
    expect(screen.getByLabelText('¿Qué ocurrió?')).toBeVisible();
    expect(screen.getByText(/no incluyas.*contraseñas.*datos bancarios/i)).toBeVisible();
    expect(screen.queryByText(/stack trace|payload|uid/i)).not.toBeInTheDocument();
  });

  it('valida en modo demostración sin crear solicitudes externas', async () => {
    render(<SupportPage />);
    fireEvent.change(screen.getByLabelText('¿Qué intentabas hacer?'), {
      target: {value: 'No puedo abrir una cotización'},
    });
    fireEvent.change(screen.getByLabelText('¿Qué ocurrió?'), {
      target: {value: 'La pantalla muestra un error al abrir el borrador.'},
    });
    fireEvent.submit(screen.getByRole('button', {name: 'Validar solicitud'}).closest('form')!);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/modo demostración/i));
    expect(screen.getByRole('status')).toHaveTextContent(/no se envió/i);
  });
});
