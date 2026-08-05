import type {Notification} from '../models/domain';

const routeBuilders: Record<string, (id: string) => string> = {
  request: (id) => `/requests/${id}`,
  quote: (id) => `/quotes?quote=${encodeURIComponent(id)}`,
  client: (id) => `/clients/${id}`,
  site: (id) => `/sites/${id}`,
  equipment: (id) => `/equipment/${id}`,
};

export function notificationRoute(notification: Pick<Notification, 'resourceType' | 'resourceId'>) {
  const id = notification.resourceId ?? '';
  const builder = routeBuilders[notification.resourceType ?? ''];
  if (!builder || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  return builder(id);
}

export function notificationActionLabel(resourceType?: string) {
  return (
    (
      {
        request: 'Ver solicitud',
        quote: 'Ver cotización',
        client: 'Ver cliente',
        site: 'Ver instalación',
        equipment: 'Ver equipo',
      } as Record<string, string>
    )[resourceType ?? ''] ?? 'Abrir recurso'
  );
}
