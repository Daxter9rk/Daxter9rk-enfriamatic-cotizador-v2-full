import {useAuth} from '../../app/providers/AuthProvider';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import type {AuditLog, Notification} from '../../models/domain';
import {constraints, markNotificationRead} from '../../services/firebase/data';
import {formatDate} from '../../utils/format';

export function ActivityPage() {
  const {profile} = useAuth();
  const auditConstraints = profile?.role === 'operator' ? [constraints.auditFor(profile.uid)] : [];
  const audit = useCollection<AuditLog>('auditLogs', auditConstraints, 100);
  const notifications = useCollection<Notification>(
    'notifications',
    profile ? [constraints.notificationsFor(profile.uid)] : [],
    30,
  );

  if (audit.loading || notifications.loading)
    return <StatePanel kind="loading" title="Cargando actividad…" />;
  return (
    <>
      <PageHeader
        eyebrow="Trazabilidad"
        title={profile?.role === 'admin' ? 'Actividad' : 'Mi historial'}
        description="Eventos operativos y notificaciones internas, ordenados por contexto."
      />
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Bandeja</p>
              <h2>Notificaciones</h2>
            </div>
          </div>
          {notifications.data.length === 0 ? (
            <p className="empty-copy">Sin notificaciones.</p>
          ) : (
            <div className="stack-list">
              {notifications.data.map((item) => (
                <button
                  className="stack-row stack-row--button"
                  key={item.id}
                  onClick={() =>
                    !item.read && profile
                      ? void markNotificationRead(item.id).then(notifications.reload)
                      : undefined
                  }
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.message} · {formatDate(item.createdAt)}
                    </span>
                  </div>
                  {!item.read && <span className="status-dot" />}
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Registro</p>
              <h2>Auditoría</h2>
            </div>
          </div>
          {audit.data.length === 0 ? (
            <p className="empty-copy">Sin eventos visibles.</p>
          ) : (
            <div className="timeline">
              {audit.data.map((item) => (
                <article key={item.id}>
                  <span />
                  <div>
                    <strong>{item.action}</strong>
                    <p>
                      {item.resourceType} · {item.resourceId}
                    </p>
                    <small>{formatDate(item.createdAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
