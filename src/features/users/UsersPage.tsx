import {useMemo, useState, type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import type {UserProfile, UserRole, UserStatus} from '../../models/domain';
import {createUserInputSchema} from '../../models/schemas';
import {callFunction} from '../../services/firebase/data';

export function UsersPage() {
  const users = useCollection<UserProfile>('users');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.data.filter((user) =>
      [user.displayName, user.email, user.role, user.status].some((field) =>
        field.toLowerCase().includes(term),
      ),
    );
  }, [search, users.data]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      const input = createUserInputSchema.parse({
        email: form.get('email'),
        password: form.get('password'),
        displayName: form.get('displayName'),
        role: form.get('role'),
        status: form.get('status'),
      });
      await callFunction('createUser', input);
      setCreating(false);
      await users.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear el usuario.');
    } finally {
      setBusy(false);
    }
  };

  const update = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      await callFunction('updateUser', {
        uid: editing.uid,
        displayName: String(form.get('displayName')),
        role: String(form.get('role')) as UserRole,
        status: String(form.get('status')) as UserStatus,
      });
      setEditing(null);
      await users.reload();
    } catch {
      setMessage(
        'No se pudo actualizar el usuario. Verifica que no estés modificando tu propio rol o estado.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (users.loading) return <StatePanel kind="loading" title="Cargando usuarios…" />;

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Cuentas internas, roles permanentes y control de acceso."
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
                <th>
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.uid}>
                  <td>
                    <strong>{user.displayName}</strong>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <span className={`badge badge--${user.status}`}>{user.status}</span>
                  </td>
                  <td>
                    <button className="text-button" onClick={() => setEditing(user)}>
                      Administrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {creating && (
        <Modal title="Crear usuario interno" onClose={() => setCreating(false)}>
          <form className="form-grid" onSubmit={(event) => void create(event)}>
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
            <UserControls />
            {message && <p className="form-message form-message--error field-wide">{message}</p>}
            <button className="button button--primary field-wide" disabled={busy}>
              {busy ? 'Creando…' : 'Crear cuenta'}
            </button>
          </form>
        </Modal>
      )}
      {editing && (
        <Modal title="Administrar usuario" onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={(event) => void update(event)}>
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
            <UserControls role={editing.role} status={editing.status} />
            {message && <p className="form-message form-message--error field-wide">{message}</p>}
            <button className="button button--primary field-wide" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

function UserControls({
  role = 'operator',
  status = 'active',
}: {
  role?: UserRole;
  status?: UserStatus;
}) {
  return (
    <>
      <label>
        Rol
        <select name="role" defaultValue={role}>
          <option value="operator">Operador</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <label>
        Estado
        <select name="status" defaultValue={status}>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="pending">Pendiente</option>
          <option value="suspended">Suspendido</option>
        </select>
      </label>
    </>
  );
}
