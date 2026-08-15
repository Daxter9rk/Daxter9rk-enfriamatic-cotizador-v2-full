import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ReauthenticationModal} from './ReauthenticationModal';

const mocks = vi.hoisted(() => ({
  reauthenticate: vi.fn(),
  credential: vi.fn(() => ({providerId: 'password'})),
  getIdToken: vi.fn(),
  user: {
    email: 'admin@example.test',
    providerData: [{providerId: 'password'}],
    getIdToken: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: {credential: mocks.credential},
  reauthenticateWithCredential: mocks.reauthenticate,
}));
vi.mock('../app/providers/AuthProvider', () => ({useAuth: () => ({user: mocks.user})}));

describe('ReauthenticationModal', () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.reauthenticate.mockReset();
    mocks.credential.mockClear();
    mocks.user.getIdToken.mockReset();
    mocks.user.providerData = [{providerId: 'password'}];
  });

  it('reauthenticates with the current email and calls the protected mutation', async () => {
    const onConfirmed = vi.fn(() => Promise.resolve());
    render(
      <ReauthenticationModal
        description="Cambio sensible"
        onClose={vi.fn()}
        onConfirmed={onConfirmed}
      />,
    );
    await userEvent.type(screen.getByLabelText(/contraseña actual/i), 'Correcta-2026');
    await userEvent.click(screen.getByRole('button', {name: /confirmar identidad/i}));
    expect(mocks.credential).toHaveBeenCalledWith('admin@example.test', 'Correcta-2026');
    expect(mocks.reauthenticate).toHaveBeenCalledOnce();
    expect(onConfirmed).toHaveBeenCalledOnce();
  });

  it('maps an incorrect password without invoking the protected mutation', async () => {
    mocks.reauthenticate.mockRejectedValueOnce({code: 'auth/invalid-credential'});
    const onConfirmed = vi.fn(() => Promise.resolve());
    render(
      <ReauthenticationModal
        description="Cambio sensible"
        onClose={vi.fn()}
        onConfirmed={onConfirmed}
      />,
    );
    await userEvent.type(screen.getByLabelText(/contraseña actual/i), 'Incorrecta');
    await userEvent.click(screen.getByRole('button', {name: /confirmar identidad/i}));
    expect(await screen.findByText(/contraseña es incorrecta/i)).toBeVisible();
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
