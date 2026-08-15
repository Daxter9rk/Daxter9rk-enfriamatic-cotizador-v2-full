import {createHash} from 'node:crypto';
import {FieldValue, type Timestamp} from 'firebase-admin/firestore';

export interface DomainAuditInput {
  sourceEventId: string;
  eventCode: string;
  actorUid: string;
  actorDisplayNameSnapshot: string;
  actorRoleSnapshot: 'admin' | 'operator';
  resourceType: string;
  resourceId: string;
  resourceLabelSnapshot: string;
  requestId?: string | null;
  quoteId?: string | null;
  result: 'success' | 'denied' | 'failed';
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  route?: string | null;
  occurredAt?: Timestamp | FieldValue;
}

export function domainAuditId(sourceEventId: string, eventCode: string): string {
  return createHash('sha256').update(`${eventCode}:${sourceEventId}`).digest('hex').slice(0, 48);
}

export function buildDomainAuditRecord(input: DomainAuditInput) {
  return {
    action: input.eventCode,
    eventCode: input.eventCode,
    sourceEventId: input.sourceEventId,
    occurredAt: input.occurredAt ?? FieldValue.serverTimestamp(),
    actorId: input.actorUid,
    actorUid: input.actorUid,
    actorDisplayNameSnapshot: input.actorDisplayNameSnapshot.slice(0, 120),
    actorRole: input.actorRoleSnapshot,
    actorRoleSnapshot: input.actorRoleSnapshot,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    resourceLabelSnapshot: input.resourceLabelSnapshot.slice(0, 160),
    requestId: input.requestId ?? null,
    quoteId: input.quoteId ?? null,
    result: input.result,
    reason: input.reason ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    route: input.route ?? null,
    metadata: {source: 'backend', reason: input.reason ?? null, result: input.result},
    schemaVersion: 1,
    createdAt: input.occurredAt ?? FieldValue.serverTimestamp(),
  };
}
