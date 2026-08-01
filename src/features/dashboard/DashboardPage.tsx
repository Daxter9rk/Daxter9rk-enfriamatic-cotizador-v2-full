import {Link} from 'wouter';
import {useAuth} from '../../app/providers/AuthProvider';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import type {Notification, Quote, ServiceRequest, UserProfile} from '../../models/domain';
import {constraints} from '../../services/firebase/data';
import {useCollection} from '../../hooks/useCollection';
import {formatCurrency, formatDate} from '../../utils/format';

export function DashboardPage() {
  const {profile} = useAuth();
  const requestConstraints =
    profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : [];
  const requests = useCollection<ServiceRequest>('requests', requestConstraints, 20);
  const quotes = useCollection<Quote>(
    'quotes',
    profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : [],
    20,
  );
  const notifications = useCollection<Notification>(
    'notifications',
    profile ? [constraints.notificationsFor(profile.uid)] : [],
    8,
  );
  const users = useCollection<UserProfile>('users', [], 30, profile?.role === 'admin');

  if (requests.loading || quotes.loading) {
    return <StatePanel kind="loading" title="Preparando tu panel…" />;
  }
  if (requests.error || quotes.error) {
    return (
      <StatePanel kind="error" title="No fue posible cargar el panel">
        <p>{requests.error ?? quotes.error}</p>
        <button className="button button--secondary" onClick={() => void requests.reload()}>
          Reintentar
        </button>
      </StatePanel>
    );
  }

  const pending = requests.data.filter((item) => item.status === 'pending').length;
  const assigned = requests.data.filter((item) => item.status === 'assigned').length;
  const inProgress = requests.data.filter((item) => item.status === 'in_progress').length;
  const drafts = quotes.data.filter((item) => item.status === 'draft').length;
  const failed = quotes.data.filter((item) => item.documentStatus === 'failed').length;
  const issuedTotal = quotes.data
    .filter((item) => item.status === 'issued')
    .reduce((sum, item) => sum + item.grandTotal, 0);
  const activeOperators = users.data.filter(
    (item) => item.role === 'operator' && item.status === 'active',
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Centro de operación"
        title={`Buen día, ${profile?.displayName.split(' ')[0] ?? ''}`}
        description={
          profile?.role === 'admin'
            ? 'Visibilidad inmediata sobre solicitudes, cotizaciones y excepciones.'
            : 'Tus asignaciones y borradores prioritarios están reunidos aquí.'
        }
      />
      <section className="metrics-grid" aria-label="Indicadores">
        <Metric
          label={profile?.role === 'admin' ? 'Pendientes' : 'Asignadas'}
          value={profile?.role === 'admin' ? pending : assigned}
        />
        <Metric label="En progreso" value={inProgress} />
        <Metric label="Borradores" value={drafts} />
        {profile?.role === 'admin' ? (
          <>
            <Metric label="PDF con fallo" value={failed} critical={failed > 0} />
            <Metric label="Operadores activos" value={activeOperators} />
            <Metric label="Emitido reciente" value={formatCurrency(issuedTotal)} />
          </>
        ) : null}
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Trabajo activo</p>
              <h2>Solicitudes recientes</h2>
            </div>
            <Link href="/requests">Ver todas</Link>
          </div>
          {requests.data.length === 0 ? (
            <p className="empty-copy">No hay solicitudes en este momento.</p>
          ) : (
            <div className="stack-list">
              {requests.data.slice(0, 6).map((request) => (
                <Link href={`/requests/${request.id}`} className="stack-row" key={request.id}>
                  <div>
                    <strong>{request.title}</strong>
                    <span>
                      {request.priority} · {request.status}
                    </span>
                  </div>
                  <span>→</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Atención</p>
              <h2>Notificaciones</h2>
            </div>
          </div>
          {notifications.data.length === 0 ? (
            <p className="empty-copy">Sin novedades pendientes.</p>
          ) : (
            <div className="stack-list">
              {notifications.data.slice(0, 6).map((notification) => (
                <div className="stack-row" key={notification.id}>
                  <div>
                    <strong>{notification.title}</strong>
                    <span>{formatDate(notification.createdAt)}</span>
                  </div>
                  {!notification.read && <span className="status-dot" aria-label="No leída" />}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="quick-actions">
        <h2>Accesos rápidos</h2>
        <div>
          {profile?.role === 'admin' && (
            <Link className="button button--primary" href="/requests?new=1">
              Nueva solicitud
            </Link>
          )}
          <Link className="button button--secondary" href="/quotes">
            Abrir cotizaciones
          </Link>
          <Link className="button button--ghost" href="/manual">
            Consultar manual
          </Link>
        </div>
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  critical = false,
}: {
  label: string;
  value: string | number;
  critical?: boolean;
}) {
  return (
    <article className={`metric ${critical ? 'metric--critical' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
