import {cleanup, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ManualPage} from './ManualPage';

const auth = vi.hoisted(() => ({profile: {role: 'admin'}}));
vi.mock('../../app/providers/AuthProvider', () => ({useAuth: () => auth}));

describe('ManualPage', () => {
  beforeEach(() => {
    cleanup();
    auth.profile.role = 'admin';
  });
  it('muestra la biblioteca completa de manuales', () => {
    render(<ManualPage />);
    expect(screen.getByRole('heading', {name: /biblioteca de manuales/i})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /manual del administrador/i})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /manual del operador/i})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /manual general/i})).toBeInTheDocument();
    expect(screen.getAllByRole('link', {name: /descargar pdf/i})).toHaveLength(3);
  });
  it('identifica la sesión activa del operador', () => {
    auth.profile.role = 'operator';
    render(<ManualPage />);
    expect(screen.getAllByText(/sesión activa/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', {name: /manual del administrador/i})).toBeNull();
    expect(screen.getAllByRole('link', {name: /descargar pdf/i})).toHaveLength(2);
  });
});
