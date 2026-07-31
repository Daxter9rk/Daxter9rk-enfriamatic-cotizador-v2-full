import type {AuthState} from '../../models/domain';
import {useAuth} from '../../app/providers/AuthProvider';
import {StatePanel} from '../../components/StatePanel';

const content: Partial<Record<AuthState, [string, string]>> = {
  'missing-profile': [
    'Perfil no configurado',
    'Tu cuenta existe, pero aún no tiene un perfil operativo. Contacta a un administrador.',
  ],
  inactive: ['Cuenta inactiva', 'Tu acceso fue desactivado. Contacta a un administrador.'],
  pending: ['Cuenta pendiente', 'Tu perfil está pendiente de activación administrativa.'],
  suspended: ['Cuenta suspendida', 'Tu acceso está suspendido. Contacta a un administrador.'],
  'invalid-role': ['Rol no válido', 'El perfil no tiene un rol autorizado para esta aplicación.'],
  error: ['No fue posible validar el acceso', 'Revisa tu conexión y vuelve a intentarlo.'],
};

export function BlockedPage() {
  const {state, logout, refreshProfile} = useAuth();
  const [title, description] = content[state] ?? [
    'Acceso bloqueado',
    'No puedes entrar a la aplicación.',
  ];
  return (
    <main className="centered-page">
      <StatePanel kind={state === 'error' ? 'error' : 'permission'} title={title}>
        <p>{description}</p>
        <div className="button-row">
          <button className="button button--secondary" onClick={() => void refreshProfile()}>
            Reintentar
          </button>
          <button className="button button--ghost" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </StatePanel>
    </main>
  );
}
