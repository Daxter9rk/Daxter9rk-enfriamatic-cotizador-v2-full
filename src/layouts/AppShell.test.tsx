import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {AppShell} from './AppShell';

vi.mock('../app/providers/AuthProvider', () => ({
  useAuth: () => ({
    profile: {uid: 'admin', displayName: 'Admin', role: 'admin', isPrimaryAdmin: true},
    logout: vi.fn(),
  }),
}));
vi.mock('../components/NotificationCenter', () => ({NotificationCenter: () => null}));

describe('AppShell navigation', () => {
  it('does not expose the generic internal catalogs screen', () => {
    render(<AppShell>Contenido</AppShell>);
    expect(screen.queryByRole('link', {name: 'Catálogos internos'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Catálogo comercial'})).toBeVisible();
  });
});
