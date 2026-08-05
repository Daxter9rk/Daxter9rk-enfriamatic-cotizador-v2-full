import {useEffect, useMemo, useState} from 'react';
import {Link} from 'wouter';
import {useAuth} from '../../app/providers/AuthProvider';
import {Icon, type IconName} from '../../components/Icon';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import type {Quote, ServiceRequest, UserProfile} from '../../models/domain';
import {constraints} from '../../services/firebase/data';
import {useCollection} from '../../hooks/useCollection';
import {formatCurrency, formatDate} from '../../utils/format';

const requestLabels = {
  pending: 'Pendiente',
  assigned: 'Asignada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
} as const;

export function DashboardPage() {
  const {profile} = useAuth();
  const requestConstraints = useMemo(
    () => (profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : []),
    [profile],
  );
  const quoteConstraints = useMemo(
    () => (profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : []),
    [profile],
  );
  const requests = useCollection<ServiceRequest>('requests', requestConstraints, 50);
  const quotes = useCollection<Quote>('quotes', quoteConstraints, 50);
  const users = useCollection<UserProfile>('users', [], 100, profile?.role === 'admin');
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const [, tick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([requests.reload(), quotes.reload(), users.reload()]);
    setUpdatedAt(new Date());
    setRefreshing(false);
  };

  if (requests.loading || quotes.loading)
    return <StatePanel kind="loading" title="Preparando tu panel…" />;
  if (requests.error || quotes.error) {
    return (
      <StatePanel kind="error" title="No fue posible cargar el panel">
        <p>{requests.error ?? quotes.error}</p>
        <button className="button button--secondary" onClick={() => void refresh()}>
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
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const issuedThisMonth = quotes.data.filter(
    (item) => item.issuedAt?.toDate && item.issuedAt.toDate() >= monthStart,
  );
  const issuedTotal = issuedThisMonth.reduce((sum, item) => sum + item.grandTotal, 0);
  const recentThreshold = Date.now() - 5 * 60_000;
  const recentOperators = users.data.filter(
    (item) =>
      item.role === 'operator' &&
      item.status === 'active' &&
      item.lastActivityAt?.toMillis &&
      item.lastActivityAt.toMillis() >= recentThreshold,
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Centro de operación"
        title={`Buen día, ${profile?.displayName.split(' ')[0] ?? ''}`}
        description={
          profile?.role === 'admin'
            ? 'Prioridades, excepciones y acciones operativas en una sola vista.'
            : 'Tus asignaciones y cotizaciones prioritarias están reunidas aquí.'
        }
        actions={
          <div className="refresh-control">
            <button
              className="button button--secondary"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <Icon name="refresh" />
              {refreshing ? 'Actualizando…' : 'Actualizar datos'}
            </button>
            <small>Actualizado {relativeTime(updatedAt)}</small>
          </div>
        }
      />
      <section className="dashboard-actions" aria-label="Acciones rápidas">
        <QuickAction href="/requests?new=1" icon="request" label="Nueva solicitud" adminOnly />
        <QuickAction href="/quotes?new=1" icon="quote" label="Nueva cotización" />
        <QuickAction href="/clients?new=1" icon="client" label="Registrar cliente" adminOnly />
        <QuickAction href="/sites?new=1" icon="site" label="Nueva instalación" adminOnly />
        <QuickAction href="/equipment?new=1" icon="equipment" label="Registrar equipo" adminOnly />
        <QuickAction href="/support" icon="support" label="Manual / Soporte" />
      </section>
      {failed > 0 && (
        <Link href="/quotes?documentStatus=failed" className="dashboard-alert">
          <span>
            <strong>
              {failed} PDF {failed === 1 ? 'requiere' : 'requieren'} atención
            </strong>
            <small>El folio se conserva; abre la cotización para reintentar.</small>
          </span>
          <span>Revisar →</span>
        </Link>
      )}
      <section className="metrics-grid metrics-grid--operational" aria-label="Indicadores">
        <Metric
          href="/requests?status=pending"
          icon="request"
          label={profile?.role === 'admin' ? 'Pendientes' : 'Asignadas'}
          value={profile?.role === 'admin' ? pending : assigned}
          tone="warning"
        />
        <Metric
          href="/requests?status=in_progress"
          icon="activity"
          label="En progreso"
          value={inProgress}
        />
        <Metric href="/quotes?status=draft" icon="quote" label="Borradores" value={drafts} />
        {profile?.role === 'admin' && (
          <Metric
            href="/users?recent=1"
            icon="users"
            label="Operadores con actividad reciente"
            value={recentOperators}
            tone="success"
          />
        )}
        {profile?.role === 'admin' && (
          <Metric
            href="/quotes?period=current-month"
            icon="quote"
            label="Monto emitido del mes"
            value={formatCurrency(issuedTotal)}
            caption={`${issuedThisMonth.length} cotizaciones emitidas`}
            wide
          />
        )}
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
              {requests.data.slice(0, 7).map((request) => (
                <Link href={`/requests/${request.id}`} className="stack-row" key={request.id}>
                  <div>
                    <strong>{request.title}</strong>
                    <span>
                      {requestLabels[request.status]} · {priorityLabel(request.priority)} ·{' '}
                      {formatDate(request.updatedAt)}
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
              <p className="eyebrow">Enfoque</p>
              <h2>Qué atender ahora</h2>
            </div>
          </div>
          <div className="focus-list">
            <FocusItem
              value={pending}
              label="solicitudes pendientes por asignar"
              href="/requests?status=pending"
            />
            <FocusItem
              value={inProgress}
              label="trabajos actualmente en progreso"
              href="/requests?status=in_progress"
            />
            <FocusItem
              value={drafts}
              label="cotizaciones en borrador"
              href="/quotes?status=draft"
            />
          </div>
        </section>
      </div>
      <Link className="support-fab" href="/support">
        <Icon name="support" />
        <span>Ayuda</span>
      </Link>
    </>
  );

  function QuickAction({
    href,
    icon,
    label,
    adminOnly = false,
  }: {
    href: string;
    icon: IconName;
    label: string;
    adminOnly?: boolean;
  }) {
    if (adminOnly && profile?.role !== 'admin') return null;
    return (
      <Link href={href}>
        <span>
          <Icon name={icon} />
        </span>
        <strong>{label}</strong>
      </Link>
    );
  }
}

function Metric({
  href,
  icon,
  label,
  value,
  caption,
  tone = 'blue',
  wide = false,
}: {
  href: string;
  icon: IconName;
  label: string;
  value: string | number;
  caption?: string;
  tone?: 'blue' | 'warning' | 'success';
  wide?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`metric metric--link metric--${tone}${wide ? ' metric--wide' : ''}`}
    >
      <span className="metric__icon">
        <Icon name={icon} />
      </span>
      <span>{label}</span>
      <strong>{value}</strong>
      {caption && <small>{caption}</small>}
    </Link>
  );
}

function FocusItem({value, label, href}: {value: number; label: string; href: string}) {
  return (
    <Link href={href}>
      <strong>{value}</strong>
      <span>{label}</span>
      <b>→</b>
    </Link>
  );
}

function relativeTime(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return 'hace unos segundos';
  const minutes = Math.floor(seconds / 60);
  return `hace ${minutes} min`;
}

function priorityLabel(priority: ServiceRequest['priority']): string {
  return {low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente'}[priority];
}
