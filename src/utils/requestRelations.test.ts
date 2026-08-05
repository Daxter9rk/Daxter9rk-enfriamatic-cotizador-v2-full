import {describe, expect, it} from 'vitest';
import type {Client, Equipment, Site} from '../models/domain';
import {requestRelationshipError} from './requestRelations';

const clients = [{id: 'c1', name: 'Cliente', status: 'active'}] as unknown as Client[];
const sites = [{id: 's1', clientId: 'c1', name: 'Sitio', status: 'active'}] as unknown as Site[];
const equipment = [
  {id: 'e1', clientId: 'c1', siteId: 's1', name: 'Equipo', status: 'active'},
] as unknown as Equipment[];

describe('request relationships', () => {
  it('accepts general scope without equipment and specific scope with a matching unit', () => {
    expect(
      requestRelationshipError({
        clientId: 'c1',
        siteId: 's1',
        equipmentId: null,
        scope: 'site',
        clients,
        sites,
        equipment,
      }),
    ).toBeNull();
    expect(
      requestRelationshipError({
        clientId: 'c1',
        siteId: 's1',
        equipmentId: 'e1',
        scope: 'equipment',
        clients,
        sites,
        equipment,
      }),
    ).toBeNull();
  });

  it('rejects a cross-client site or missing specific equipment', () => {
    expect(
      requestRelationshipError({
        clientId: 'other',
        siteId: 's1',
        equipmentId: null,
        scope: 'site',
        clients,
        sites,
        equipment,
      }),
    ).toMatch(/cliente activo/);
    expect(
      requestRelationshipError({
        clientId: 'c1',
        siteId: 's1',
        equipmentId: null,
        scope: 'equipment',
        clients,
        sites,
        equipment,
      }),
    ).toMatch(/equipo activo/);
  });
});
