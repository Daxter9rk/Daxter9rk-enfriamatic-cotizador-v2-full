import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {QuotesPage} from './QuotesPage';

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: {uid: 'admin', role: 'admin'}}),
}));
vi.mock('../../hooks/useCollection', () => ({
  useCollection: () => ({data: [], loading: false, error: null, reload: vi.fn()}),
}));

describe('QuotesPage guided creation', () => {
  it('explica requisitos y bloquea cotizaciones libres', async () => {
    const user = userEvent.setup();
    render(<QuotesPage />);
    await user.click(screen.getByRole('button', {name: 'Nueva cotización'}));
    expect(screen.getByText('Cliente')).toBeVisible();
    expect(screen.getByText('Instalación')).toBeVisible();
    expect(screen.getByText(/aún no puedes crear/i)).toBeVisible();
    expect(screen.getByRole('button', {name: 'Crear cotización'})).toBeDisabled();
    expect(screen.getByRole('link', {name: 'Gestionar solicitudes'})).toHaveAttribute(
      'href',
      '/requests',
    );
  });
});
