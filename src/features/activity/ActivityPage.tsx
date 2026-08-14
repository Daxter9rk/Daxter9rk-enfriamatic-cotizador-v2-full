import {useMemo, useState} from 'react';
import {Link} from 'wouter';
import {useAuth} from '../../app/providers/AuthProvider';
import {FilterBar} from '../../components/FilterBar';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useAuditCollection} from '../../hooks/useAuditCollection';
import {useCollection} from '../../hooks/useCollection';
import type {AuditLog, UserProfile} from '../../models/domain';
import {constraints} from '../../services/firebase/data';
import {formatDate} from '../../utils/format';
import {
  auditActionFilterLabel,
  auditActionLabel,
  auditResourceLabel,
  visibleAuditIdentity,
} from '../../utils/auditPresentation';

type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export function ActivityPage() {
  const {profile} = useAuth();
  const [preset, setPreset] = useState<DatePreset>('7d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actor, setActor] = useState('all');
  const [role, setRole] = useState('all');
  const [action, setAction] = useState('all');
  const [resource, setResource] = useState('all');
  const [result, setResult] = useState('all');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');
  const audit = useAuditCollection<AuditLog>(
    profile?.role === 'operator' ? [constraints.auditFor(profile.uid)] : [],
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
        const actorName =
          item.actorDisplayNameSnapshot ?? userMap.get(item.actorId) ?? 'Usuario autorizado';
        return (
          (!date || (date >= range.start && date <= range.end)) &&
          (actor === 'all' || item.actorId === actor) &&
          (role === 'all' || item.actorRole === role) &&
          (action === 'all' || item.action === action) &&
          (resource === 'all' || item.resourceType === resource) &&
          (result === 'all' || auditResult(item) === result) &&
          (!term ||
            `${actorName} ${auditActionLabel(item.action)} ${auditResourceLabel(item.resourceType)} ${item.resourceLabelSnapshot ?? item.resourceId}`
              .toLocaleLowerCase('es-MX')
              .includes(term))
        );
      })
      .sort((left, right) => {
        const timestampDifference =
          (left.createdAt?.toMillis?.() ?? 0) - (right.createdAt?.toMillis?.() ?? 0);
        if (timestampDifference !== 0) {
          return sort === 'oldest' ? timestampDifference : -timestampDifference;
        }
        return sort === 'oldest'
          ? left.id.localeCompare(right.id)
          : right.id.localeCompare(left.id);
      });
  }, [action, actor, audit.data, from, preset, resource, result, role, search, sort, to, userMap]);

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
      <FilterBar
        label="Filtros de actividad"
        search={search}
        searchPlaceholder="Actor, acción, folio o recurso…"
        sort={sort}
        sortOptions={[
          {value: 'newest', label: 'Más recientes'},
          {value: 'oldest', label: 'Más antiguos'},
        ]}
        onSearch={setSearch}
        onSort={setSort}
        onClear={() => {
          setPreset('7d');
          setFrom('');
          setTo('');
          setActor('all');
          setRole('all');
          setAction('all');
          setResource('all');
          setResult('all');
          setSearch('');
          setSort('newest');
        }}
      >
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
              <option key={value} value={value}>
                {auditActionFilterLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Recurso
          <select value={resource} onChange={(event) => setResource(event.target.value)}>
            <option value="all">Todos</option>
            {choices.resources.map((value) => (
              <option key={value} value={value}>
                {auditResourceLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Resultado
          <select value={result} onChange={(event) => setResult(event.target.value)}>
            <option value="all">Todos</option>
            <option value="success">Correcto</option>
            <option value="denied">Denegado</option>
            <option value="failed">Falló</option>
          </select>
        </label>
      </FilterBar>
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
          {audit.hasMore && (
            <button
              className="button button--secondary load-more"
              onClick={() => void audit.loadMore()}
              disabled={audit.loading}
            >
              Cargar 50 eventos más
            </button>
          )}
          <p className="pagination-note">
            Se consultan páginas de 50 registros ordenadas de forma estable; aplica filtros antes de
            ampliar el límite.
          </p>
        </section>
      )}
    </>
  );
}

function AuditEntry({item, actorName, admin}: {item: AuditLog; actorName: string; admin: boolean}) {
  const changes = summarizeChanges(item.before, item.after);
  const reason =
    item.reason ?? (typeof item.metadata?.reason === 'string' ? item.metadata.reason : null);
  const route = auditResourceRoute(item);
  const identity = visibleAuditIdentity({
    actorId: item.actorId,
    actorDisplayNameSnapshot: item.actorDisplayNameSnapshot,
    actorRoleSnapshot: item.actorRoleSnapshot,
    actorRole: item.actorRole,
    fallbackName: actorName,
  });
  const resourceLabel =
    item.resourceLabelSnapshot ?? item.quoteId ?? item.requestId ?? item.resourceId;
  return (
    <article className="audit-entry">
      <div className="audit-entry__icon" aria-hidden="true">
        ✓
      </div>
      <div>
        <h3>
          {identity.name} {auditActionLabel(item.action)}.
        </h3>
        <p>
          <strong>{auditResourceLabel(item.resourceType)}:</strong> {resourceLabel}
        </p>
        <p>
          Rol: <strong>{identity.role}</strong>
        </p>
        <p>
          Resultado: <strong>{auditResultLabel(auditResult(item))}</strong>
        </p>
        {reason && <p className="audit-entry__changes">Motivo: {reason}</p>}
        {changes && <p className="audit-entry__changes">{changes}</p>}
        <time title={formatDate(item.createdAt)}>
          {relativeDate(item.createdAt?.toDate?.())} · {formatDate(item.createdAt)}
        </time>
        {route && <Link href={route}>Abrir recurso</Link>}
        {admin && (
          <details>
            <summary>Detalle técnico</summary>
            <pre>
              {JSON.stringify(
                {
                  actorUid: item.actorId,
                  actorRole: item.actorRoleSnapshot ?? item.actorRole,
                  eventKey: item.action,
                  resourceType: item.resourceType,
                  resourceId: item.resourceId,
                  result: auditResult(item),
                  before: item.before ?? null,
                  after: item.after ?? null,
                  origin: item.metadata?.source ?? 'backend',
                },
                null,
                2,
              )}
            </pre>
          </details>
        )}
      </div>
    </article>
  );
}

function auditResult(item: AuditLog) {
  const value = item.result ?? item.metadata?.result;
  return value === 'denied' || value === 'failed' ? value : 'success';
}

function auditResultLabel(result: string) {
  return {success: 'Correcto', denied: 'Denegado', failed: 'Falló'}[result] ?? 'Correcto';
}

function auditResourceRoute(item: AuditLog) {
  if (item.route?.startsWith('/') && !item.route.startsWith('//')) return item.route;
  const id = item.resourceId;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  return (
    (
      {
        request: `/requests/${id}`,
        requests: `/requests/${id}`,
        quote: `/quotes?quote=${encodeURIComponent(id)}`,
        quotes: `/quotes?quote=${encodeURIComponent(id)}`,
        client: `/clients/${id}`,
        clients: `/clients/${id}`,
        site: `/sites/${id}`,
        sites: `/sites/${id}`,
        equipment: `/equipment/${id}`,
        catalog: `/commercial-catalog?item=${encodeURIComponent(id)}`,
      } as Record<string, string>
    )[item.resourceType] ?? null
  );
}

function relativeDate(value?: Date) {
  if (!value) return 'Fecha no disponible';
  const minutes = Math.max(0, Math.floor((Date.now() - value.getTime()) / 60_000));
  if (minutes < 1) return 'Hace menos de un minuto';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.floor(hours / 24)} d`;
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
