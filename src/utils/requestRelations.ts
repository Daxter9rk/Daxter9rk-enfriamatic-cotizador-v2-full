import type {Client, Equipment, Site} from '../models/domain';

export type RequestScope = 'site' | 'equipment';

export function requestRelationshipError(input: {
  clientId: string;
  siteId: string;
  equipmentId: string | null;
  scope: RequestScope;
  clients: Client[];
  sites: Site[];
  equipment: Equipment[];
}): string | null {
  const client = input.clients.find(
    (item) => item.id === input.clientId && item.status === 'active',
  );
  if (!client) return 'Selecciona un cliente activo.';
  const site = input.sites.find(
    (item) => item.id === input.siteId && item.clientId === client.id && item.status === 'active',
  );
  if (!site) return 'Selecciona una instalación activa del cliente.';
  if (input.scope === 'site') {
    return input.equipmentId ? 'El alcance general no debe incluir un equipo.' : null;
  }
  const unit = input.equipment.find(
    (item) =>
      item.id === input.equipmentId &&
      item.siteId === site.id &&
      item.clientId === client.id &&
      item.status === 'active',
  );
  return unit ? null : 'Selecciona un equipo activo de la instalación.';
}
