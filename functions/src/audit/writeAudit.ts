import {FieldValue} from 'firebase-admin/firestore';
import type {ActiveActor} from '../shared/auth';
import {firestore} from '../shared/admin';

interface AuditInput {
  action: string;
  resourceType: string;
  resourceId: string;
  requestId?: string | null;
  quoteId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_FIELDS = new Set(['password', 'passwordHash', 'tokens', 'storagePath']);

function sanitize(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_FIELDS.has(key))
      .slice(0, 50),
  );
}

export async function writeAudit(actor: ActiveActor, input: AuditInput): Promise<void> {
  await firestore.collection('auditLogs').add({
    actorId: actor.uid,
    actorRole: actor.role,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requestId: input.requestId ?? null,
    quoteId: input.quoteId ?? null,
    before: sanitize(input.before),
    after: sanitize(input.after),
    metadata: input.metadata ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
}
