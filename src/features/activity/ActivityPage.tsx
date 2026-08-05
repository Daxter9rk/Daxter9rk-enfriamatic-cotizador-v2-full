import {useMemo, useState} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import type {AuditLog, UserProfile} from '../../models/domain';
import {constraints} from '../../services/firebase/data';
import {formatDate} from '../../utils/format';

const actionLabels: Record<string, string> = {
  'requests.created': 'creó la solicitud',
  'requests.updated': 'actualizó la solicitud',
  'quotes.created': 'creó la cotización',
  'quotes.updated': 'actualizó la cotización',
  'users.updated': 'actualizó el usuario',
  'settings.updated': 'actualizó la configuración',
  'equipmentInterventions.created': 'registró una intervención',
  'supportRequests.created': 'registró una solicitud de soporte',
};

const resourceLabels: Record<string, string> = {
  requests: 'Solicitud',
  quotes: 'Cotización',
  users: 'Usuario',
  settings: 'Configuración',
  clients: 'Cliente',
  sites: 'Instalación',
  equipment: 'Equipo',
  equipmentInterventions: 'Intervención',
  supportRequests: 'Soporte',
};

type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export function ActivityPage() {
  const {profile} = useAuth();
  const [pageSize, setPageSize] = useState(50);
  const [preset, setPreset] = useState<DatePreset>('7d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actor, setActor] = useState('all');
  const [role, setRole] = useState('all');
  const [action, setAction] = useState('all');
  const [resource, setResource] = useState('all');
  const [search, setSearch] = useState('');
  const audit = useCollection<AuditLog>(
    'auditLogs',
    profile?.role === 'operator' ? [constraints.auditFor(profile.uid)] : [],
    pageSize,
  );
  const users = useCollection<UserProfile>('users', [], 100, profile?.role === 'admin');
  const userMap = useMemo(
    () => new Map(users.data.map((user) => [user.uid || user.id, user.displayName || user.email])),
    [users.data],
  );
  const choices = useMemo(
    () => ({
      actions: [...new Set(audit.data.map((item) => item.action))].sort(),
      resources: [...new Set(audit.data.map((item) => item.resourceType))].sort(),
    }),
    [audit.data],
  );
  const visible = useMemo(() => {
    const range = dateRange(preset, from, to);
    const term = search.trim().toLocaleLowerCase('es-MX');
    return [...audit.data]
      .filter((item) => {
        const date = item.createdAt?.toDate?.();
        const actorName = userMap.get(item.actorId) ?? item.actorId;
        return (
          (!date || (date >= range.start && date <= range.end)) &&
          (actor === 'all' || item.actorId === actor) &&
          (role === 'all' || item.actorRole === role) &&
          (action === 'all' || item.action === action) &&
          (resource === 'all' || item.resourceType === resource) &&
          (!term ||
            `${actorName} ${item.action} ${item.resourceType} ${item.resourceId}`
              .toLocaleLowerCase('es-MX')
              .includes(term))
        );
      })
      .sort(
        (left, right) => (right.createdAt?.toMillis?.() ?? 0) - (left.createdAt?.toMillis?.() ?? 0),
      );
  }, [action, actor, audit.data, from, preset, resource, role, search, to, userMap]);

  if (audit.loading && audit.data.length === 0)
    return <StatePanel kind="loading" title="Cargando actividad…" />;
  return (
    <>
      <PageHeader
        eyebrow="Trazabilidad"
        title={profile?.role === 'admin' ? 'Actividad y auditoría' : 'Mi historial'}
        description="Registro limitado, filtrable y legible de acciones operativas."
        actions={
          <button className="button button--secondary" onClick={() => void audit.reload()}>
            Actualizar
          </button>
        }
      />
      <section className="panel activity-filters" aria-label="Filtros de actividad">
        <label>
          Fecha
          <select value={preset} onChange={(event) => setPreset(event.target.value as DatePreset)}>
            <option value="today">Hoy</option>
            <option value="yesterday">Ayer</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="custom">Rango personalizado</option>
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label>
              Desde
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </>
        )}
        {profile?.role === 'admin' && (
          <label>
            Usuario
            <select value={actor} onChange={(event) => setActor(event.target.value)}>
              <option value="all">Todos</option>
              {users.data.map((user) => (
                <option key={user.id} value={user.uid || user.id}>
                  {user.displayName || user.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Rol
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="all">Todos</option>
            <option value="admin">Administrador</option>
            <option value="operator">Operador</option>
          </select>
        </label>
        <label>
          Acción
          <select value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="all">Todas</option>
            {choices.actions.map((value) => (
              <option key={value} value={value}>{filterActionLabel(value)}</option>
            ))}
          </select>
        </label>
        <label>
          Recurso
          <select value={resource} onChange={(event) => setResource(event.target.value)}>
            <option value="all">Todos</option>
            {choices.resources.map((value) => (
              <option key={value}>{resourceLabels[value] ?? value}</option>
            ))}
          </select>
        </label>
        <label className="activity-search">
          Buscar
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Actor, acción, folio o recurso"
          />
        </label>
      </section>
      {audit.error ? (
        <StatePanel kind="error" title="No fue posible cargar la actividad">
          <button className="button button--secondary" onClick={() => void audit.reload()}>
            Reintentar
          </button>
        </StatePanel>
      ) : (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Registro append-only</p>
              <h2>{visible.length} eventos visibles</h2>
            </div>
          </div>
          {visible.length === 0 ? (
            <p className="empty-copy">No hay eventos para los filtros seleccionados.</p>
          ) : (
            <div className="audit-list">
              {visible.map((item) => (
                <AuditEntry
                  key={item.id}
                  item={item}
                  actorName={
                    userMap.get(item.actorId) ??
                    (profile?.uid === item.actorId ? profile.displayName : 'Usuario autorizado')
                  }
                  admin={profile?.role === 'admin'}
                />
              ))}
            </div>
          )}
          {audit.data.length >= pageSize && pageSize < 200 && (
            <button
              className="button button--secondary load-more"
              onClick={() => setPageSize((value) => Math.min(value + 50, 200))}
            >
              Cargar 50 eventos más
            </button>
          )}
          <p className="pagination-note">
            Se consultan hasta {pageSize} registros; aplica filtros antes de ampliar el límite.
          </p>
        </section>
      )}
    </>
  );
}

function AuditEntry({item, actorName, admin}: {item: AuditLog; actorName: string; admin: boolean}) {
  const changes = summarizeChanges(item.before, item.after);
  return (
    <article className="audit-entry">
      <div className="audit-entry__icon" aria-hidden="true">
        ✓
      </div>
      <div>
        <h3>
          {actorName} {actionLabels[item.action] ?? item.action}.
        </h3>
        <p>
          <strong>{resourceLabels[item.resourceType] ?? item.resourceType}:</strong>{' '}
          {item.quoteId ?? item.requestId ?? item.resourceId}
        </p>
        {changes && <p className="audit-entry__changes">{changes}</p>}
        <time>{formatDate(item.createdAt)}</time>
        {admin && (
          <details>
            <summary>Detalle técnico</summary>
            <code>
              Actor: {item.actorId} · Recurso: {item.resourceId}
            </code>
          </details>
        )}
      </div>
    </article>
  );
}

function summarizeChanges(
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null,
) {
  if (!before || !after) return '';
  const changed = Object.keys(after)
    .filter(
      (key) =>
        !['updatedAt', 'updatedBy'].includes(key) &&
        JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    )
    .slice(0, 4);
  return changed
    .map((key) => `${key}: ${readable(before[key])} → ${readable(after[key])}`)
    .join(' · ');
}

function readable(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Sin valor';
  if (typeof value === 'object') return 'Valor actualizado';
  return String(value)
    .replace('in_progress', 'En progreso')
    .replace('assigned', 'Asignada')
    .replace('completed', 'Completada')
    .replace('draft', 'Borrador')
    .replace('issued', 'Emitida');
}

function filterActionLabel(action: string) {
  return (
    {
      'quote.sent': 'Cotización enviada',
      'quote.accepted': 'Cotización aceptada',
      'quote.rejected': 'Cotización rechazada',
      'quote.cancelled': 'Cotización cancelada',
      'quote.correction_created': 'Corrección creada',
      'auth.login': 'Inicio de sesión',
    }[action] ?? actionLabels[action] ?? 'Acción operativa'
  );
}

function dateRange(preset: DatePreset, from: string, to: string) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }
  if (preset === '7d') start.setDate(start.getDate() - 6);
  if (preset === '30d') start.setDate(start.getDate() - 29);
  if (preset === 'custom') {
    const customStart = from ? new Date(`${from}T00:00:00`) : new Date(0);
    const customEnd = to ? new Date(`${to}T23:59:59.999`) : end;
    return {start: customStart, end: customEnd};
  }
  return {start, end};
}
