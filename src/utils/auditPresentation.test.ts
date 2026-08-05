import {describe, expect, it} from 'vitest';
import {
  auditActionLabel,
  auditResourceLabel,
  auditRoleLabel,
  visibleAuditIdentity,
} from './auditPresentation';

describe('presentación de auditoría', () => {
  it('traduce eventos conocidos y ofrece un fallback seguro', () => {
    expect(auditActionLabel('auth.login')).toBe('inició sesión');
    expect(auditActionLabel('quote.issued')).toBe('emitió la cotización');
    expect(auditActionLabel('equipment.intervention_created')).toBe(
      'registró una intervención',
    );
    expect(auditActionLabel('unknown.internal_code')).toBe('realizó una acción operativa');
    expect(auditResourceLabel('equipmentInterventions')).toBe('Intervención');
  });

  it('muestra nombre y rol sin usar el UID como identidad operativa', () => {
    expect(
      visibleAuditIdentity({
        actorId: 'uid-secreto',
        actorDisplayNameSnapshot: 'Administrador DEV',
        actorRoleSnapshot: 'admin',
      }),
    ).toEqual({name: 'Administrador DEV', role: 'Administrador'});
    expect(auditRoleLabel('operator')).toBe('Operador');
  });
});
