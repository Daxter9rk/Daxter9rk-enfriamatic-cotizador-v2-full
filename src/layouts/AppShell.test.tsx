import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {AppShell} from './AppShell';

vi.mock('../app/providers/AuthProvider', () => ({
  useAuth: () => ({
    profile: {
      uid: 'admin',
      displayName: 'Admin',
      role: 'admin',
      isPrimaryAdmin: true,
    },
    logout: vi.fn(),
  }),
}));
vi.mock('../components/NotificationCenter', () => ({NotificationCenter: () => null}));

describe('AppShell navigation', () => {
  it('exposes only the final admin MVP navigation', () => {
    render(<AppShell>Contenido</AppShell>);
    expect(screen.queryByRole('link', {name: 'Catálogos internos'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Catálogo comercial'})).toBeVisible();
    expect(screen.getAllByRole('link', {name: 'Inicio'})[0]).toBeVisible();
    expect(screen.getAllByRole('link', {name: 'Clientes'})[0]).toBeVisible();
    expect(screen.getAllByRole('link', {name: 'Cotizaciones'})[0]).toBeVisible();
    expect(screen.getByRole('link', {name: 'Configuración'})).toBeVisible();
    expect(screen.getByRole('link', {name: 'Usuarios y permisos'})).toBeVisible();
    for (const label of ['Solicitudes', 'Instalaciones', 'Equipos', 'Actividad']) {
      expect(screen.queryByRole('link', {name: label})).not.toBeInTheDocument();
    }
  });
});
