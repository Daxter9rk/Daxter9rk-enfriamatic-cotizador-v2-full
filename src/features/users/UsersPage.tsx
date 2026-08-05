import {useMemo, useState, type FormEvent} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import {Modal} from '../../components/Modal';
import {PageHeader} from '../../components/PageHeader';
import {ReauthenticationModal} from '../../components/ReauthenticationModal';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import type {UserProfile, UserRole, UserStatus} from '../../models/domain';
import {createUserInputSchema, type CreateUserInput} from '../../models/schemas';
import {callFunction} from '../../services/firebase/data';
import {formatDate} from '../../utils/format';

interface UserUpdateInput {
  uid: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
}

interface SensitiveAction {
  description: string;
  run(): Promise<void>;
}

export function UsersPage() {
  const {profile, refreshProfile} = useAuth();
  const users = useCollection<UserProfile>('users');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sensitiveAction, setSensitiveAction] = useState<SensitiveAction | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.data.filter((user) =>
      [user.displayName, user.email, user.role, user.status].some((field) =>
        field.toLowerCase().includes(term),
      ),
    );
  }, [search, users.data]);
  const hasPrimaryAdmin = users.data.some((item) => item.isPrimaryAdmin === true);

  const performCreate = async (input: CreateUserInput) => {
    setBusy(true);
    setMessage(null);
    try {
      await callFunction('createUser', input);
      setCreating(false);
      await users.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear el usuario.');
    } finally {
      setBusy(false);
    }
  };

  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = createUserInputSchema.parse({
      email: form.get('email'),
      password: form.get('password'),
      displayName: form.get('displayName'),
      role: form.get('role'),
      status: form.get('status'),
    });
    if (input.role === 'admin') {
      setSensitiveAction({
        description:
          'Crear otra cuenta administradora requiere reautenticación del administrador principal.',
        run: () => performCreate(input),
      });
      return;
    }
    void performCreate(input);
  };

  const performUpdate = async (input: UserUpdateInput) => {
    setBusy(true);
    setMessage(null);
    try {
      await callFunction('updateUser', input);
      setEditing(null);
      await Promise.all([users.reload(), refreshProfile()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el usuario.');
    } finally {
      setBusy(false);
    }
  };

  const update = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const input: UserUpdateInput = {
      uid: editing.uid,
      displayName: String(form.get('displayName') ?? '').trim(),
      role: String(form.get('role')) as UserRole,
      status: String(form.get('status')) as UserStatus,
    };
    const sensitive = input.role !== editing.role || input.status !== editing.status;
    if (sensitive) {
      setSensitiveAction({
        description: `Confirma el cambio de ${roleLabel(editing.role)} / ${statusLabel(editing.status)} a ${roleLabel(input.role)} / ${statusLabel(input.status)} para ${editing.displayName}.`,
        run: () => performUpdate(input),
      });
      return;
    }
    void performUpdate(input);
  };

  const claimPrimary = () => {
    setSensitiveAction({
      description:
        'Esta acción protege permanentemente al único administrador activo como administrador principal y quedará auditada.',
      run: async () => {
        await callFunction('claimPrimaryAdmin', {});
        await Promise.all([users.reload(), refreshProfile()]);
      },
    });
  };

  if (users.loading) return <StatePanel kind="loading" title="Cargando usuarios…" />;

  return (
    <>
      <PageHeader
        eyebrow="Configuración · Acceso"
        title="Usuarios y permisos"
        description="Cuentas internas, jerarquía administrativa y control de acceso auditable."
        actions={
          <button
            className="button button--primary"
            onClick={() => setCreating(true)}
            data-testid="new-user"
          >
            Crear usuario
          </button>
        }
      />
      {!hasPrimaryAdmin && (
        <section className="notice notice--warning" role="status">
          <div>
            <strong>Falta proteger al administrador principal</strong>
            <p>El bootstrap sólo funcionará si tu cuenta es el único administrador activo.</p>
          </div>
          <button className="button button--secondary" onClick={claimPrimary}>
            Proteger mi cuenta
          </button>
        </section>
      )}
      <section className="toolbar">
        <label className="search-field">
          <span>Buscar usuario</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <span>{filtered.length} perfiles</span>
      </section>
      {users.error ? (
        <StatePanel kind="error" title="No fue posible consultar usuarios">
          <p>{users.error}</p>
        </StatePanel>
      ) : (
        <section className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Actividad reciente</th>
                <th>
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const protectedTarget =
                  user.isPrimaryAdmin ||
                  (profile?.isPrimaryAdmin !== true &&
                    user.role === 'admin' &&
                    user.uid !== profile?.uid);
                return (
                  <tr key={user.uid}>
                    <td>
                      <strong>{user.displayName}</strong>
                      {user.isPrimaryAdmin && (
                        <span className="badge badge--primary">Principal</span>
                      )}
                    </td>
                    <td>{user.email}</td>
                    <td>{roleLabel(user.role)}</td>
                    <td>
                      <span className={`badge badge--${user.status}`}>
                        {statusLabel(user.status)}
                      </span>
                    </td>
                    <td>
                      {user.lastActivityAt ? formatDate(user.lastActivityAt) : 'Sin registro'}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setEditing(user)}
                        disabled={protectedTarget && user.uid !== profile?.uid}
                      >
                        Administrar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {creating && (
        <Modal title="Crear usuario interno" onClose={() => setCreating(false)}>
          <form className="form-grid" onSubmit={create}>
            <label className="field-wide">
              Nombre
              <input name="displayName" required minLength={2} maxLength={120} />
            </label>
            <label className="field-wide">
              Correo
              <input name="email" type="email" required maxLength={254} />
            </label>
            <label className="field-wide">
              Contraseña temporal
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <UserControls canChangeRole={profile?.isPrimaryAdmin === true} />
            {message && <p className="form-message form-message--error field-wide">{message}</p>}
            <button className="button button--primary field-wide" disabled={busy}>
              {busy ? 'Creando…' : 'Crear cuenta'}
            </button>
          </form>
        </Modal>
      )}
      {editing && (
        <Modal title={`Administrar a ${editing.displayName}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={update}>
            <label className="field-wide">
              Nombre
              <input
                name="displayName"
                required
                minLength={2}
                maxLength={120}
                defaultValue={editing.displayName}
              />
            </label>
            <UserControls
              role={editing.role}
              status={editing.status}
              canChangeRole={
                profile?.isPrimaryAdmin === true &&
                !editing.isPrimaryAdmin &&
                editing.uid !== profile.uid
              }
              canChangeStatus={!editing.isPrimaryAdmin && editing.uid !== profile?.uid}
            />
            {editing.isPrimaryAdmin && (
              <p className="form-message field-wide">
                La cuenta principal no puede desactivarse ni degradarse.
              </p>
            )}
            {message && <p className="form-message form-message--error field-wide">{message}</p>}
            <button className="button button--primary field-wide" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        </Modal>
      )}
      {sensitiveAction && (
        <ReauthenticationModal
          description={sensitiveAction.description}
          onClose={() => setSensitiveAction(null)}
          onConfirmed={async () => {
            await sensitiveAction.run();
            setSensitiveAction(null);
          }}
        />
      )}
    </>
  );
}

function UserControls({
  role = 'operator',
  status = 'active',
  canChangeRole = false,
  canChangeStatus = true,
}: {
  role?: UserRole;
  status?: UserStatus;
  canChangeRole?: boolean;
  canChangeStatus?: boolean;
}) {
  return (
    <>
      <label>
        Rol
        <select name="role" defaultValue={role} disabled={!canChangeRole}>
          <option value="operator">Operador</option>
          <option value="admin">Administrador</option>
        </select>
        {!canChangeRole && <input type="hidden" name="role" value={role} />}
      </label>
      <label>
        Estado
        <select name="status" defaultValue={status} disabled={!canChangeStatus}>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="pending">Pendiente</option>
          <option value="suspended">Suspendido</option>
        </select>
        {!canChangeStatus && <input type="hidden" name="status" value={status} />}
      </label>
    </>
  );
}

function roleLabel(role: UserRole): string {
  return role === 'admin' ? 'Administrador' : 'Operador';
}

function statusLabel(status: UserStatus): string {
  return {active: 'Activo', inactive: 'Inactivo', pending: 'Pendiente', suspended: 'Suspendido'}[
    status
  ];
}
