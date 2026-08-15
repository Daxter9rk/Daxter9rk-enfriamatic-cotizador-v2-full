import type {Quote, UserRole} from '../../../models/domain';

export interface CreateQuoteDraftInput {
  clientId: string;
  actorId: string;
  actorRole: UserRole;
  requestId?: string | null;
  siteId?: string | null;
  equipmentId?: string | null;
  assignedTo?: string | null;
  serviceReference?: string | null;
  technicalContext?: string | null;
}

export interface QuoteDraftWrite {
  folio: '';
  requestId: string | null;
  assignedTo: string | null;
  clientId: string;
  siteId: string | null;
  equipmentId: string | null;
  serviceReference?: string | null;
  technicalContext?: string | null;
  status: 'draft';
  documentStatus: 'not_generated';
  currency: 'MXN';
  taxRate: 0.16;
  discountDisplayMode: 'detailed';
  subtotalOriginal: 0;
  discountTotal: 0;
  subtotalFinal: 0;
  taxTotal: 0;
  grandTotal: 0;
  notes: null;
  validityDays: 15;
  validUntil: null;
  issuedAt: null;
  issuedBy: null;
  originalQuoteId: null;
  revisionNumber: 1;
  locked: false;
}

const clean = (value: string | null | undefined): string | null => {
  const result = typeof value === 'string' ? value.trim() : '';
  return result || null;
};

export function createQuoteDraft(input: CreateQuoteDraftInput): QuoteDraftWrite {
  const clientId = input.clientId.trim();
  const requestId = clean(input.requestId);
  if (!clientId) throw new Error('El cliente es obligatorio.');
  const assignedTo =
    clean(input.assignedTo) ?? (input.actorRole === 'operator' ? input.actorId : null);
  if (input.actorRole === 'operator' && assignedTo !== input.actorId) {
    throw new Error('El operador debe quedar asignado a sí mismo.');
  }
  return {
    folio: '',
    requestId,
    assignedTo,
    clientId,
    siteId: requestId ? clean(input.siteId) : null,
    equipmentId: requestId ? clean(input.equipmentId) : null,
    ...(requestId
      ? {}
      : {
          serviceReference: clean(input.serviceReference),
          technicalContext: clean(input.technicalContext),
        }),
    status: 'draft',
    documentStatus: 'not_generated',
    currency: 'MXN',
    taxRate: 0.16,
    discountDisplayMode: 'detailed',
    subtotalOriginal: 0,
    discountTotal: 0,
    subtotalFinal: 0,
    taxTotal: 0,
    grandTotal: 0,
    notes: null,
    validityDays: 15,
    validUntil: null,
    issuedAt: null,
    issuedBy: null,
    originalQuoteId: null,
    revisionNumber: 1,
    locked: false,
  };
}

export function updateQuoteDraft(
  quote: Quote,
  patch: Pick<Quote, 'notes' | 'serviceReference' | 'technicalContext'>,
  actor: {id: string; role: UserRole},
): Pick<Quote, 'notes' | 'serviceReference' | 'technicalContext'> {
  if (quote.status !== 'draft' || quote.locked)
    throw new Error('Sólo se pueden editar borradores desbloqueados.');
  if (actor.role === 'operator' && quote.assignedTo !== actor.id) {
    throw new Error('No puedes editar una cotización asignada a otro usuario.');
  }
  return {
    notes: clean(patch.notes),
    serviceReference: clean(patch.serviceReference),
    technicalContext: clean(patch.technicalContext),
  };
}

export type QuoteDraftValidationStage = 'save' | 'preview' | 'issue';

export function validateQuoteDraft(quote: Quote, stage: QuoteDraftValidationStage): string[] {
  const errors: string[] = [];
  if (!quote.clientId) errors.push('El cliente es obligatorio.');
  if (quote.status !== 'draft' || quote.locked)
    errors.push('La cotización no es un borrador editable.');
  if (!quote.requestId && (quote.siteId != null || quote.equipmentId != null)) {
    errors.push('Una cotizacion independiente no puede vincular instalacion o equipo.');
  }
  if (stage === 'issue' && !quote.requestId) {
    errors.push('Las cotizaciones independientes no pueden emitirse en este hito.');
  }
  return errors;
}
