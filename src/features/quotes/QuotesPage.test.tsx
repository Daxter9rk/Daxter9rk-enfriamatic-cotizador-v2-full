import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {QuotesPage} from './QuotesPage';

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({profile: {uid: 'admin', role: 'admin'}}),
}));
vi.mock('../../hooks/useCollection', () => ({
  useCollection: (collection: string) => ({
    data:
      collection === 'clients' ? [{id: 'client-1', name: 'Cliente demo', status: 'active'}] : [],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

describe('QuotesPage independent creation', () => {
  it('allows a draft without a request while keeping client required', async () => {
    const user = userEvent.setup();
    render(<QuotesPage />);
    await user.click(screen.getByRole('button', {name: 'Nueva cotización'}));
    expect(screen.getByTestId('quote-client')).toBeRequired();
    expect(screen.getByTestId('quote-request')).not.toBeRequired();
    expect(screen.getByRole('combobox', {name: /Instalaci/})).not.toBeRequired();
    expect(screen.getByRole('combobox', {name: /Equipo/})).not.toBeRequired();
    expect(screen.getByLabelText(/Referencia de servicio/)).toBeVisible();
  });
});
