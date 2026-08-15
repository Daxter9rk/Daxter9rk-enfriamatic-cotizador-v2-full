import type {UserRole} from '../models/domain';

const actionLabels: Record<string, string> = {
  'auth.login': 'inició sesión',
  'clients.created': 'creó el cliente',
  'clients.updated': 'actualizó el cliente',
  'sites.created': 'creó la instalación',
  'sites.updated': 'actualizó la instalación',
  'equipment.created': 'creó el equipo',
  'equipment.updated': 'actualizó el equipo',
  'equipment.intervention_created': 'registró una intervención',
  'equipmentInterventions.created': 'registró una intervención',
  'requests.created': 'creó la solicitud',
  'requests.updated': 'actualizó la solicitud',
  'request.assigned': 'asignó la solicitud',
  'request.reassigned': 'reasignó la solicitud',
  'quotes.created': 'creó la cotización',
  'quotes.updated': 'actualizó la cotización',
  'quote.issued': 'emitió la cotización',
  'quote.sent': 'marcó como enviada la cotización',
  'quote.accepted': 'aceptó la cotización',
  'quote.rejected': 'rechazó la cotización',
  'quote.cancelled': 'canceló la cotización',
  'quote.correction_created': 'creó una corrección de la cotización',
  'catalogs.created': 'creó un elemento de catálogo',
  'catalogs.updated': 'actualizó un elemento de catálogo',
  'catalog.image_added': 'agregó una imagen al artículo',
  'catalog.image_changed': 'cambió la imagen del artículo',
  'catalog.image_deleted': 'eliminó la imagen del artículo',
  'catalog.image_cleanup_pending': 'registró una limpieza pendiente de imagen',
  'catalog.image_cleanup_completed': 'completó la limpieza de una imagen',
  'settings.updated': 'actualizó la configuración',
  'supportRequests.created': 'registró una solicitud de soporte',
  'user.created': 'creó el usuario',
  'user.updated': 'actualizó el usuario',
  'user.role_changed': 'cambió el rol del usuario',
  'user.primary_admin_claimed': 'confirmó al administrador principal',
};

const resourceLabels: Record<string, string> = {
  user: 'Usuario',
  users: 'Usuario',
  client: 'Cliente',
  clients: 'Cliente',
  site: 'Instalación',
  sites: 'Instalación',
  equipment: 'Equipo',
  equipmentInterventions: 'Intervención',
  request: 'Solicitud',
  requests: 'Solicitud',
  quote: 'Cotización',
  quotes: 'Cotización',
  catalogs: 'Catálogo interno',
  catalog: 'Artículo comercial',
  settings: 'Configuración',
  supportRequests: 'Soporte',
};

const actionFilterLabels: Record<string, string> = {
  'auth.login': 'Inicio de sesión',
  'quote.issued': 'Cotización emitida',
  'quote.sent': 'Cotización enviada',
  'quote.accepted': 'Cotización aceptada',
  'quote.rejected': 'Cotización rechazada',
  'quote.cancelled': 'Cotización cancelada',
  'quote.correction_created': 'Corrección creada',
  'equipment.intervention_created': 'Intervención registrada',
  'catalog.image_added': 'Imagen de artículo agregada',
  'catalog.image_changed': 'Imagen de artículo cambiada',
  'catalog.image_deleted': 'Imagen de artículo eliminada',
  'catalog.image_cleanup_pending': 'Limpieza de imagen pendiente',
  'catalog.image_cleanup_completed': 'Limpieza de imagen completada',
};

export function auditActionLabel(action: string): string {
  return actionLabels[action] ?? 'realizó una acción operativa';
}

export function auditResourceLabel(resourceType: string): string {
  return resourceLabels[resourceType] ?? 'Recurso';
}

export function auditRoleLabel(role: string | undefined): string {
  return role === 'admin'
    ? 'Administrador'
    : role === 'operator'
      ? 'Operador'
      : 'Rol no disponible';
}

export function visibleAuditIdentity(input: {
  actorId: string;
  actorDisplayNameSnapshot?: string | null | undefined;
  actorRoleSnapshot?: UserRole | null | undefined;
  actorRole?: UserRole | undefined;
  fallbackName?: string | null | undefined;
}): {name: string; role: string} {
  return {
    name:
      input.actorDisplayNameSnapshot?.trim() || input.fallbackName?.trim() || 'Usuario autorizado',
    role: auditRoleLabel(input.actorRoleSnapshot ?? input.actorRole),
  };
}

export function auditActionFilterLabel(action: string): string {
  if (actionFilterLabels[action]) return actionFilterLabels[action];
  const label = auditActionLabel(action);
  return label === 'realizó una acción operativa' ? 'Acción operativa' : label;
}
