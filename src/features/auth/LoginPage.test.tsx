import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {LoginPage} from './LoginPage';

const login = vi.fn();

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({
    login,
    message: null,
    state: 'anonymous',
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => login.mockReset());

  it('renders the real login form and submits credentials', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    expect(screen.getByRole('heading', {name: /cotizaciones técnicas/i})).toBeVisible();
    await user.type(screen.getByLabelText(/correo electrónico/i), 'admin@example.test');
    await user.type(screen.getByLabelText(/contraseña/i), 'DevOnly!Password2026');
    await user.click(screen.getByRole('button', {name: /iniciar sesión/i}));
    expect(login).toHaveBeenCalledWith('admin@example.test', 'DevOnly!Password2026');
  });
});
