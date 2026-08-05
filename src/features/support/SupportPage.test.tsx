import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
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
  setKnownDocument: vi.fn(),
  updateDocument: vi.fn(),
}));

describe('SupportPage', () => {
  it('pide contexto en lenguaje común y advierte sobre datos sensibles', () => {
    render(<SupportPage />);

    expect(screen.getByRole('heading', {name: 'Ayuda y reportes'})).toBeVisible();
    expect(screen.getByLabelText('¿Qué intentabas hacer?')).toBeVisible();
    expect(screen.getByLabelText('¿Qué ocurrió?')).toBeVisible();
    expect(screen.getByText(/no incluyas contraseñas ni datos bancarios/i)).toBeVisible();
    expect(screen.queryByText(/stack trace|payload|uid/i)).not.toBeInTheDocument();
  });
});
