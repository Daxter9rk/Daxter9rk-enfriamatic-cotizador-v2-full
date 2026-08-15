import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ManualPage} from './ManualPage';

const auth = vi.hoisted(() => ({profile: {role: 'admin'}}));
vi.mock('../../app/providers/AuthProvider', () => ({useAuth: () => auth}));

describe('ManualPage', () => {
  beforeEach(() => {
    auth.profile.role = 'admin';
  });
  it('muestra el manual completo del administrador', () => {
    render(<ManualPage />);
    expect(screen.getByRole('heading', {name: /manual de administrador/i})).toBeInTheDocument();
    expect(screen.getByText('Catálogo comercial')).toBeInTheDocument();
    expect(screen.getByText('Configuración')).toBeInTheDocument();
  });
  it('cambia al contenido y restricciones del operador', () => {
    auth.profile.role = 'operator';
    render(<ManualPage />);
    expect(screen.getByRole('heading', {name: /manual de operador/i})).toBeInTheDocument();
    expect(screen.getByText('Restricciones del rol')).toBeInTheDocument();
  });
});
