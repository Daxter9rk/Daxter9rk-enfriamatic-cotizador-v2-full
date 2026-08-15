import {describe, expect, it} from 'vitest';
import {buildDomainAuditRecord, domainAuditId} from './domainEvent';

describe('eventos globales de dominio', () => {
  it('usa una clave idempotente determinista', () => {
    expect(domainAuditId('event-1', 'quote.rejected')).toBe(
      domainAuditId('event-1', 'quote.rejected'),
    );
  });

  it('conserva snapshots legibles para intervención y rechazo', () => {
    expect(
      buildDomainAuditRecord({
        sourceEventId: 'event-1',
        eventCode: 'equipment.intervention_created',
        actorUid: 'operator-1',
        actorDisplayNameSnapshot: 'Operador DEV',
        actorRoleSnapshot: 'operator',
        resourceType: 'equipment',
        resourceId: 'equipment-1',
        resourceLabelSnapshot: 'Compresor Demo',
        result: 'success',
      }),
    ).toMatchObject({
      actorDisplayNameSnapshot: 'Operador DEV',
      actorRoleSnapshot: 'operator',
      action: 'equipment.intervention_created',
      sourceEventId: 'event-1',
    });
  });
});
