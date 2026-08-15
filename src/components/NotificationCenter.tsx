import {useMemo, useState} from 'react';
import {useLocation} from 'wouter';
import {useAuth} from '../app/providers/AuthProvider';
import {useRealtimeCollection} from '../hooks/useRealtimeCollection';
import type {Notification} from '../models/domain';
import {constraints, markNotificationRead} from '../services/firebase/data';
import {formatDate} from '../utils/format';
import {notificationActionLabel, notificationRoute} from '../utils/notifications';
import {Icon} from './Icon';

export function NotificationCenter() {
  const {profile} = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Notification | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const queryConstraints = useMemo(
    () => (profile ? [constraints.notificationsFor(profile.uid), constraints.newest()] : []),
    [profile],
  );
  const notifications = useRealtimeCollection<Notification>(
    'notifications',
    queryConstraints,
    30,
    Boolean(profile),
  );
  const unread = notifications.data.filter((item) => !item.read);

  const inspect = async (notification: Notification) => {
    if (busyId) return;
    setBusyId(notification.id);
    setMessage(null);
    try {
      if (!notification.read) await markNotificationRead(notification.id);
      const route = notificationRoute(notification);
      if (route) {
        setOpen(false);
        setSelected(null);
        navigate(route);
      } else {
        setSelected(notification);
      }
    } catch {
      setMessage('No fue posible abrir la notificación. Inténtalo de nuevo.');
    } finally {
      setBusyId(null);
    }
  };

  const openResource = (notification: Notification) => {
    const route = notificationRoute(notification);
    setOpen(false);
    setSelected(null);
    if (route) navigate(route);
  };

  return (
    <div className="notification-center">
      <button
        className="topbar-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notificaciones${unread.length ? `, ${unread.length} sin leer` : ''}`}
        aria-expanded={open}
      >
        <Icon name="bell" />
        {unread.length > 0 && <span>{unread.length > 99 ? '99+' : unread.length}</span>}
      </button>
      {open && (
        <section className="notification-popover" aria-label="Centro de notificaciones">
          <header>
            <div>
              <strong>Notificaciones</strong>
              <small>{unread.length} sin leer</small>
            </div>
            {unread.length > 0 && (
              <button
                className="text-button"
                onClick={() =>
                  void Promise.all(unread.map((item) => markNotificationRead(item.id)))
                }
              >
                Marcar todas
              </button>
            )}
          </header>
          {notifications.error && (
            <p className="form-message form-message--error">{notifications.error}</p>
          )}
          {message && <p className="form-message form-message--error">{message}</p>}
          {notifications.loading ? (
            <p className="empty-copy">Actualizando…</p>
          ) : notifications.data.length === 0 ? (
            <p className="empty-copy">No tienes notificaciones.</p>
          ) : (
            <div className="notification-list">
              {notifications.data.map((notification) => (
                <button
                  key={notification.id}
                  className={!notification.read ? 'unread' : undefined}
                  disabled={busyId === notification.id}
                  onClick={() => void inspect(notification)}
                >
                  <span className="notification-list__icon">
                    <Icon name="bell" />
                  </span>
                  <span>
                    <strong>{notification.title}</strong>
                    <small>{formatDate(notification.createdAt)}</small>
                  </span>
                  {!notification.read && <i aria-label="Sin leer" />}
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="notification-detail">
              <strong>{selected.title}</strong>
              <p>{selected.message}</p>
              <small>{formatDate(selected.createdAt)}</small>
              {notificationRoute(selected) ? (
                <button className="button button--primary" onClick={() => openResource(selected)}>
                  {notificationActionLabel(selected.resourceType)}
                </button>
              ) : (
                <p className="empty-copy">
                  El recurso no está disponible o no tiene una ruta compatible.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
