import {useMemo, useState, type FormEvent} from 'react';
import {Link, useLocation, useRoute, useSearch} from 'wouter';
import {useAuth} from '../../app/providers/AuthProvider';
import {Icon} from '../../components/Icon';
import {Modal} from '../../components/Modal';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import {useRealtimeCollection} from '../../hooks/useRealtimeCollection';
import type {Client, Equipment, ServiceRequest, Site, UserProfile} from '../../models/domain';
import {requestInputSchema} from '../../models/schemas';
import {
  callFunction,
  constraints,
  createDocument,
  updateDocument,
} from '../../services/firebase/data';
import {formatDate} from '../../utils/format';

const statusLabels = {
  pending: 'Pendiente',
  assigned: 'Asignada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
} as const;
const priorityLabels = {low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente'} as const;

export function RequestsPage() {
  const {profile} = useAuth();
  const search = useSearch();
  const [, navigate] = useLocation();
  const [, routeParams] = useRoute('/requests/:requestId');
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const requestConstraints = useMemo(
    () => (profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : []),
    [profile],
  );
  const operatorAccess = useMemo(
    () => (profile?.role === 'operator' ? [constraints.authorizedFor(profile.uid)] : []),
    [profile],
  );
  const requests = useRealtimeCollection<ServiceRequest>(
    'requests',
    requestConstraints,
    100,
    Boolean(profile),
  );
  const clients = useCollection<Client>('clients', operatorAccess);
  const sites = useCollection<Site>('sites', operatorAccess);
  const equipment = useCollection<Equipment>('equipment', operatorAccess);
  const users = useCollection<UserProfile>('users', [], 100, profile?.role === 'admin');
  const [filter, setFilter] = useState(searchParams.get('status') ?? 'all');
  const [view, setView] = useState<'cards' | 'list' | 'table'>(
    () =>
      (localStorage.getItem('enfriamatic-view-requests') as 'cards' | 'list' | 'table') ?? 'cards',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<'assign' | 'complete' | 'reopen' | 'cancel' | null>(null);
  const selected = requests.data.find((item) => item.id === routeParams?.requestId) ?? null;
  const creating = searchParams.get('new') === '1';

  const visible = useMemo(
    () =>
      filter === 'all' ? requests.data : requests.data.filter((item) => item.status === filter),
    [filter, requests.data],
  );
  const setSearchParams = (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    navigate(`/requests${query ? `?${query}` : ''}`, {replace: true});
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const assignedTo = String(form.get('assignedTo') ?? '') || null;
      const data = requestInputSchema.parse({
        clientId: form.get('clientId'),
        siteId: form.get('siteId'),
        equipmentId: String(form.get('equipmentId') ?? '') || null,
        title: form.get('title'),
        description: form.get('description'),
        priority: form.get('priority'),
        assignedTo,
      });
      await createDocument(
        'requests',
        {
          ...data,
          status: assignedTo ? 'assigned' : 'pending',
          assignedAt: assignedTo ? new Date() : null,
          completedAt: null,
          correctionOfRequestId: null,
          correctionOfQuoteId: null,
        },
        profile.uid,
      );
      setSearchParams({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible crear la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  const transition = async (
    request: ServiceRequest,
    to: 'in_progress' | 'completed' | 'cancelled',
    reason?: string | null,
    finalNote?: string | null,
  ) => {
    setSaving(true);
    setError(null);
    try {
      await callFunction('transitionRequest', {
        requestId: request.id,
        to,
        reason: reason ?? null,
        finalNote: finalNote ?? null,
      });
      setAction(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cambiar el estado.');
    } finally {
      setSaving(false);
    }
  };

  if (requests.loading) return <StatePanel kind="loading" title="Cargando solicitudes…" />;
  if (routeParams?.requestId && !selected)
    return (
      <StatePanel kind="error" title="Solicitud no disponible">
        <p>No existe, quedó fuera del alcance de tu perfil o no tienes permiso.</p>
        <Link className="button button--secondary" href="/requests">
          Volver a solicitudes
        </Link>
      </StatePanel>
    );
  if (selected)
    return (
      <RequestDetail
        request={selected}
        clients={clients.data}
        sites={sites.data}
        equipment={equipment.data}
        users={users.data}
        profile={profile!}
        action={action}
        setAction={setAction}
        saving={saving}
        error={error}
        transition={transition}
      />
    );

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title={profile?.role === 'admin' ? 'Solicitudes' : 'Mis solicitudes'}
        description="Asignación, seguimiento y trazabilidad del trabajo técnico."
        actions={
          profile?.role === 'admin' ? (
            <button
              className="button button--primary"
              onClick={() => setSearchParams({new: '1'})}
              data-testid="new-request"
            >
              <Icon name="plus" />
              Nueva solicitud
            </button>
          ) : undefined
        }
      />
      <section className="toolbar">
        <label>
          Estado
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              navigate(
                event.target.value === 'all'
                  ? '/requests'
                  : `/requests?status=${event.target.value}`,
                {replace: true},
              );
            }}
          >
            <option value="all">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <ViewToggle view={view} setView={setView} />
        <span>{visible.length} resultados</span>
      </section>
      {requests.error ? (
        <StatePanel kind="error" title="No fue posible cargar las solicitudes">
          <p>{requests.error}</p>
        </StatePanel>
      ) : visible.length === 0 ? (
        <StatePanel title="No hay solicitudes para este filtro" />
      ) : (
        <section className={`record-grid record-grid--${view}`}>
          {visible.map((request) => (
            <article className="record-card" key={request.id}>
              <div className="record-card__top">
                <span className={`badge badge--${request.status}`}>
                  {statusLabels[request.status]}
                </span>
                <span className={`priority priority--${request.priority}`}>
                  {priorityLabels[request.priority]}
                </span>
              </div>
              <h2>
                <Link href={`/requests/${request.id}`}>{request.title}</Link>
              </h2>
              <p>{request.description}</p>
              <small>
                {clients.data.find((client) => client.id === request.clientId)?.name ??
                  'Cliente no disponible'}{' '}
                · {formatDate(request.updatedAt)}
              </small>
              <Link className="record-card__open" href={`/requests/${request.id}`}>
                Abrir seguimiento <span>→</span>
              </Link>
            </article>
          ))}
        </section>
      )}
      {creating && (
        <Modal title="Nueva solicitud" onClose={() => setSearchParams({})}>
          <form className="form-grid" onSubmit={(event) => void create(event)}>
            <label>
              Cliente
              <select name="clientId" required>
                <option value="">Selecciona</option>
                {clients.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Instalación
              <select name="siteId" required>
                <option value="">Selecciona</option>
                {sites.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Equipo
              <select name="equipmentId">
                <option value="">Sin equipo</option>
                {equipment.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prioridad
              <select name="priority" defaultValue="normal">
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-wide">
              Título
              <input name="title" required maxLength={120} data-testid="request-title" />
            </label>
            <label className="field-wide">
              Descripción
              <textarea name="description" required maxLength={4000} />
            </label>
            <label className="field-wide">
              Asignar a
              <select name="assignedTo">
                <option value="">Sin asignar</option>
                {users.data
                  .filter(
                    (item) => item.status === 'active' && ['operator', 'admin'].includes(item.role),
                  )
                  .map((item) => (
                    <option key={item.uid} value={item.uid}>
                      {item.displayName} · {item.role === 'admin' ? 'Administrador' : 'Operador'}
                    </option>
                  ))}
              </select>
            </label>
            {error && <p className="form-message form-message--error field-wide">{error}</p>}
            <button className="button button--primary field-wide" disabled={saving}>
              {saving ? 'Guardando…' : 'Crear solicitud'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

function RequestDetail({
  request,
  clients,
  sites,
  equipment,
  users,
  profile,
  action,
  setAction,
  saving,
  error,
  transition,
}: {
  request: ServiceRequest;
  clients: Client[];
  sites: Site[];
  equipment: Equipment[];
  users: UserProfile[];
  profile: UserProfile;
  action: 'assign' | 'complete' | 'reopen' | 'cancel' | null;
  setAction(value: 'assign' | 'complete' | 'reopen' | 'cancel' | null): void;
  saving: boolean;
  error: string | null;
  transition(
    request: ServiceRequest,
    to: 'in_progress' | 'completed' | 'cancelled',
    reason?: string | null,
    finalNote?: string | null,
  ): Promise<void>;
}) {
  const client = clients.find((item) => item.id === request.clientId);
  const site = sites.find((item) => item.id === request.siteId);
  const unit = equipment.find((item) => item.id === request.equipmentId);
  const assignee =
    users.find((item) => item.uid === request.assignedTo) ??
    (request.assignedTo === profile.uid ? profile : undefined);
  const saveNotes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('workNotes') ?? '').trim();
    await updateDocument('requests', request.id, {workNotes: value}, profile.uid);
  };
  const assign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await callFunction('assignRequest', {
      requestId: request.id,
      assignedTo: String(form.get('assignedTo')),
      note: String(form.get('note') ?? '') || null,
    });
    setAction(null);
  };
  const submitAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (action === 'complete')
      await transition(request, 'completed', null, String(form.get('finalNote') ?? '') || null);
    if (action === 'reopen')
      await transition(request, 'in_progress', String(form.get('reason') ?? ''));
    if (action === 'cancel')
      await transition(request, 'cancelled', String(form.get('reason') ?? ''));
  };
  return (
    <>
      <PageHeader
        eyebrow="Solicitud · Seguimiento"
        title={request.title}
        description={`${statusLabels[request.status]} · Prioridad ${priorityLabels[request.priority]}`}
        actions={
          <div className="button-row">
            <Link className="button button--ghost" href="/requests">
              Volver
            </Link>
            {profile.role === 'admin' &&
              ['pending', 'assigned', 'in_progress'].includes(request.status) && (
                <button className="button button--secondary" onClick={() => setAction('assign')}>
                  Asignar
                </button>
              )}
          </div>
        }
      />
      <RequestStepper status={request.status} />
      <div className="request-detail-grid">
        <section className="panel entity-summary">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Información</p>
              <h2>Detalles de la solicitud</h2>
            </div>
            <span className={`badge badge--${request.status}`}>{statusLabels[request.status]}</span>
          </div>
          <p>{request.description}</p>
          <dl className="definition-grid">
            <div>
              <dt>Cliente</dt>
              <dd>
                {client ? (
                  <Link href={`/clients/${client.id}`}>{client.name}</Link>
                ) : (
                  request.clientId
                )}
              </dd>
            </div>
            <div>
              <dt>Instalación</dt>
              <dd>{site ? <Link href={`/sites/${site.id}`}>{site.name}</Link> : request.siteId}</dd>
            </div>
            <div>
              <dt>Equipo</dt>
              <dd>
                {unit ? <Link href={`/equipment/${unit.id}`}>{unit.name}</Link> : 'Sin equipo'}
              </dd>
            </div>
            <div>
              <dt>Responsable</dt>
              <dd>
                {assignee
                  ? `${assignee.displayName} · ${assignee.role === 'admin' ? 'Administrador' : 'Operador'}`
                  : 'Sin asignar'}
              </dd>
            </div>
            <div>
              <dt>Actualizada</dt>
              <dd>{formatDate(request.updatedAt)}</dd>
            </div>
          </dl>
        </section>
        <section className="panel entity-summary">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Acciones</p>
              <h2>Avance controlado</h2>
            </div>
          </div>
          <div className="request-actions">
            {request.status === 'assigned' && (
              <button
                className="button button--primary"
                disabled={saving}
                onClick={() => void transition(request, 'in_progress')}
              >
                Iniciar trabajo
              </button>
            )}
            {request.status === 'in_progress' && (
              <button
                className="button button--primary"
                disabled={saving}
                onClick={() => setAction('complete')}
              >
                Marcar como completada
              </button>
            )}
            {profile.role === 'admin' &&
              ['pending', 'assigned', 'in_progress'].includes(request.status) && (
                <button
                  className="button button--danger"
                  disabled={saving}
                  onClick={() => setAction('cancel')}
                >
                  Cancelar solicitud
                </button>
              )}
            {profile.role === 'admin' && request.status === 'completed' && (
              <button
                className="button button--secondary"
                disabled={saving}
                onClick={() => setAction('reopen')}
              >
                Reabrir con motivo
              </button>
            )}
          </div>
          {request.finalNote && (
            <p className="form-message form-message--success">Nota final: {request.finalNote}</p>
          )}
          {request.reopenReason && (
            <p className="form-message">Motivo de reapertura: {request.reopenReason}</p>
          )}
        </section>
      </div>
      <section className="panel entity-section">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Bitácora</p>
            <h2>Notas de trabajo</h2>
          </div>
        </div>
        <form className="form-grid" onSubmit={(event) => void saveNotes(event)}>
          <label className="field-wide">
            <span className="sr-only">Notas de trabajo</span>
            <textarea
              name="workNotes"
              maxLength={2000}
              defaultValue={request.workNotes ?? ''}
              disabled={['completed', 'cancelled'].includes(request.status)}
            />
          </label>
          {!['completed', 'cancelled'].includes(request.status) && (
            <button className="button button--secondary field-wide">Guardar notas</button>
          )}
        </form>
      </section>
      {request.assignmentHistory && request.assignmentHistory.length > 0 && (
        <section className="panel entity-section">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Trazabilidad</p>
              <h2>Historial de asignaciones</h2>
            </div>
          </div>
          <div className="timeline">
            {request.assignmentHistory.map((item, index) => (
              <article key={`${item.assignedTo}-${index}`}>
                <span />
                <div>
                  <strong>
                    {users.find((user) => user.uid === item.assignedTo)?.displayName ??
                      'Usuario asignado'}
                  </strong>
                  <p>{item.note || 'Asignación operativa'}</p>
                  <small>{formatDate(item.assignedAt)}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {action && (
        <Modal
          title={
            action === 'assign'
              ? 'Asignar solicitud'
              : action === 'complete'
                ? 'Confirmar finalización'
                : action === 'reopen'
                  ? 'Reabrir solicitud'
                  : 'Cancelar solicitud'
          }
          onClose={() => setAction(null)}
        >
          <form
            className="form-grid"
            onSubmit={(event) => void (action === 'assign' ? assign(event) : submitAction(event))}
          >
            {action === 'assign' ? (
              <>
                <label className="field-wide">
                  Responsable
                  <select name="assignedTo" required defaultValue={request.assignedTo ?? ''}>
                    <option value="">Selecciona</option>
                    {users
                      .filter(
                        (item) =>
                          item.status === 'active' && ['admin', 'operator'].includes(item.role),
                      )
                      .map((item) => (
                        <option key={item.uid} value={item.uid}>
                          {item.displayName} ·{' '}
                          {item.role === 'admin' ? 'Administrador' : 'Operador'}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field-wide">
                  Nota de asignación
                  <input name="note" maxLength={500} />
                </label>
              </>
            ) : action === 'complete' ? (
              <>
                <p className="field-wide">
                  Se registrará quién completa el trabajo y la fecha. Verifica que el seguimiento
                  esté listo.
                </p>
                <label className="field-wide">
                  Nota final
                  <textarea name="finalNote" maxLength={2000} />
                </label>
              </>
            ) : (
              <label className="field-wide">
                Motivo obligatorio
                <textarea name="reason" required minLength={5} maxLength={1000} />
              </label>
            )}
            {error && <p className="form-message form-message--error field-wide">{error}</p>}
            <button
              className={`button ${action === 'cancel' ? 'button--danger' : 'button--primary'} field-wide`}
              disabled={saving}
            >
              {saving ? 'Procesando…' : 'Confirmar'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

function RequestStepper({status}: {status: ServiceRequest['status']}) {
  const stages = ['pending', 'assigned', 'in_progress', 'completed'] as const;
  const current = stages.indexOf(status as (typeof stages)[number]);
  return (
    <section
      className={`request-stepper ${status === 'cancelled' ? 'request-stepper--cancelled' : ''}`}
      aria-label="Progreso de la solicitud"
    >
      {stages.map((stage, index) => (
        <div
          className={status !== 'cancelled' && index <= current ? 'complete' : undefined}
          key={stage}
        >
          <span>{index + 1}</span>
          <strong>{statusLabels[stage]}</strong>
        </div>
      ))}
      {status === 'cancelled' && <p>Solicitud cancelada</p>}
    </section>
  );
}
function ViewToggle({
  view,
  setView,
}: {
  view: 'cards' | 'list' | 'table';
  setView(value: 'cards' | 'list' | 'table'): void;
}) {
  return (
    <div className="view-toggle">
      {(['cards', 'list', 'table'] as const).map((option) => (
        <button
          key={option}
          className={view === option ? 'active' : undefined}
          onClick={() => {
            setView(option);
            localStorage.setItem('enfriamatic-view-requests', option);
          }}
        >
          {{cards: 'Tarjetas', list: 'Lista', table: 'Tabla'}[option]}
        </button>
      ))}
    </div>
  );
}
