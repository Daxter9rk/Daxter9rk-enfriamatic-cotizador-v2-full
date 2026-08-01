import {useMemo, useState, type FormEvent} from 'react';
import {useLocation, useSearch} from 'wouter';
import {useAuth} from '../../app/providers/AuthProvider';
import {Modal} from '../../components/Modal';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import type {Client, Equipment, ServiceRequest, Site, UserProfile} from '../../models/domain';
import {requestInputSchema} from '../../models/schemas';
import {constraints, createDocument, updateDocument} from '../../services/firebase/data';
import {canTransitionRequest} from '../../utils/transitions';

export function RequestsPage() {
  const {profile} = useAuth();
  const search = useSearch();
  const [, navigate] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const setSearchParams = (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    navigate(`/requests${query ? `?${query}` : ''}`, {replace: true});
  };
  const requestConstraints =
    profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : [];
  const requests = useCollection<ServiceRequest>('requests', requestConstraints);
  const operatorAccess =
    profile?.role === 'operator' ? [constraints.authorizedFor(profile.uid)] : [];
  const clients = useCollection<Client>('clients', operatorAccess);
  const sites = useCollection<Site>('sites', operatorAccess);
  const equipment = useCollection<Equipment>('equipment', operatorAccess);
  const users = useCollection<UserProfile>('users', [], 50, profile?.role === 'admin');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creating = searchParams.get('new') === '1';

  const visible = useMemo(
    () =>
      filter === 'all' ? requests.data : requests.data.filter((item) => item.status === filter),
    [filter, requests.data],
  );

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
      await requests.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible crear la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  const transition = async (request: ServiceRequest, nextStatus: ServiceRequest['status']) => {
    if (!profile || !canTransitionRequest(request.status, nextStatus)) return;
    setSaving(true);
    try {
      await updateDocument(
        'requests',
        request.id,
        {
          status: nextStatus,
          ...(nextStatus === 'completed' ? {completedAt: new Date()} : {}),
        },
        profile.uid,
      );
      setSelected(null);
      await requests.reload();
    } finally {
      setSaving(false);
    }
  };

  if (requests.loading) return <StatePanel kind="loading" title="Cargando solicitudes…" />;

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
              Nueva solicitud
            </button>
          ) : undefined
        }
      />
      <section className="toolbar">
        <label>
          Estado
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="assigned">Asignadas</option>
            <option value="in_progress">En progreso</option>
            <option value="completed">Completadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </label>
        <span>{visible.length} resultados</span>
      </section>
      {requests.error ? (
        <StatePanel kind="error" title="No fue posible cargar las solicitudes">
          <p>{requests.error}</p>
        </StatePanel>
      ) : visible.length === 0 ? (
        <StatePanel title="No hay solicitudes para este filtro" />
      ) : (
        <section className="record-grid">
          {visible.map((request) => (
            <button
              className="record-card record-card--button"
              key={request.id}
              onClick={() => setSelected(request)}
              data-testid={`request-${request.id}`}
            >
              <div className="record-card__top">
                <span className={`badge badge--${request.status}`}>{request.status}</span>
                <span className={`priority priority--${request.priority}`}>{request.priority}</span>
              </div>
              <h2>{request.title}</h2>
              <p>{request.description}</p>
              <small>
                {clients.data.find((client) => client.id === request.clientId)?.name ??
                  request.clientId}
              </small>
            </button>
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
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
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
                  .filter((item) => item.role === 'operator' && item.status === 'active')
                  .map((item) => (
                    <option key={item.uid} value={item.uid}>
                      {item.displayName}
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
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="detail-stack">
            <span className={`badge badge--${selected.status}`}>{selected.status}</span>
            <p>{selected.description}</p>
            <dl>
              <div>
                <dt>Prioridad</dt>
                <dd>{selected.priority}</dd>
              </div>
              <div>
                <dt>Asignado</dt>
                <dd>
                  {users.data.find((item) => item.uid === selected.assignedTo)?.displayName ??
                    'Sin asignar'}
                </dd>
              </div>
            </dl>
            <div className="button-row">
              {selected.status === 'assigned' && (
                <button
                  className="button button--primary"
                  disabled={saving}
                  onClick={() => void transition(selected, 'in_progress')}
                >
                  Iniciar solicitud
                </button>
              )}
              {selected.status === 'in_progress' && (
                <button
                  className="button button--primary"
                  disabled={saving}
                  onClick={() => void transition(selected, 'completed')}
                >
                  Completar
                </button>
              )}
              {profile?.role === 'admin' &&
                ['pending', 'assigned', 'in_progress'].includes(selected.status) && (
                  <button
                    className="button button--danger"
                    disabled={saving}
                    onClick={() => void transition(selected, 'cancelled')}
                  >
                    Cancelar
                  </button>
                )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
