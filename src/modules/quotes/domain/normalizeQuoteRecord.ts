import type {Quote} from '../../../models/domain';

const optionalReference = (value: string | null | undefined): string | null => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
};

export function normalizeQuoteRecord(raw: Quote): Quote {
  const requestId = optionalReference(raw.requestId);
  const normalized = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== undefined),
  ) as Quote;

  return {
    ...normalized,
    requestId,
    siteId: optionalReference(raw.siteId),
    equipmentId: optionalReference(raw.equipmentId),
    assignedTo: optionalReference(raw.assignedTo),
    serviceReference: optionalReference(raw.serviceReference),
    technicalContext: optionalReference(raw.technicalContext),
    notes: optionalReference(raw.notes),
  };
}
