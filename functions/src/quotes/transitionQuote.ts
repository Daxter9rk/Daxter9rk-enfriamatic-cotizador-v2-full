import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {firestore} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';
import {invalidArgument} from '../shared/errors';
import {transitionQuoteSchema} from '../shared/schemas';
import {canApplyCommercialTransition, type CommercialQuoteStatus} from './transitionPolicy';
import {buildDomainAuditRecord, domainAuditId} from '../audit/domainEvent';

export const transitionQuote = onCall(
  {region: 'us-central1', maxInstances: 5, enforceAppCheck: false},
  async (request) => {
    const actor = await requireActiveActor(request);
    const parsed = transitionQuoteSchema.safeParse(request.data);
    if (!parsed.success) throw invalidArgument(parsed.error);
    const {quoteId, to, reason} = parsed.data;
    const quoteRef = firestore.doc(`quotes/${quoteId}`);
    const users = firestore.collection('users');
    const admins = users.where('role', '==', 'admin');
    const activeAdmins = admins.where('status', '==', 'active');
    const adminSnapshots = to === 'sent' ? await activeAdmins.limit(50).get() : null;
    const sourceEventId = firestore.collection('_eventIds').doc().id;
    const eventCode = `quote.${to}`;

    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(quoteRef);
      if (!snapshot.exists) throw new HttpsError('not-found', 'The quote does not exist.');
      const quote = snapshot.data() ?? {};
      const from = quote.status as CommercialQuoteStatus;
      const isAssignedOperator = actor.role === 'operator' && quote.assignedTo === actor.uid;
      if (!canApplyCommercialTransition(from, to, actor.role, isAssignedOperator)) {
        throw new HttpsError('failed-precondition', 'This commercial transition is not allowed.');
      }
      if (quote.locked !== true || quote.documentStatus !== 'ready') {
        throw new HttpsError(
          'failed-precondition',
          'Only a locked quote with a ready PDF may transition.',
        );
      }

      const now = FieldValue.serverTimestamp();
      const event = {
        sourceEventId,
        from,
        to,
        actorId: actor.uid,
        actorName: actor.displayName,
        actorRole: actor.role,
        at: new Date(),
        reason: reason ?? null,
      };
      const rejectionUpdate: Record<string, unknown> = {};
      if (to === 'rejected') {
        Object.assign(rejectionUpdate, {
          lastRejectionReason: reason,
          lastRejectedAt: now,
          lastRejectedBy: actor.uid,
          lastRejectedByName: actor.displayName,
          lastRejectedByRole: actor.role,
        });
      }
      transaction.update(quoteRef, {
        status: to,
        commercialTransition: {...event, at: now},
        commercialHistory: FieldValue.arrayUnion(event),
        ...rejectionUpdate,
        updatedAt: now,
        updatedBy: actor.uid,
      });
      transaction.set(
        firestore.collection('auditLogs').doc(domainAuditId(sourceEventId, eventCode)),
        buildDomainAuditRecord({
          sourceEventId,
          eventCode,
          actorUid: actor.uid,
          actorDisplayNameSnapshot: actor.displayName || actor.email,
          actorRoleSnapshot: actor.role,
          resourceType: 'quote',
          resourceId: quoteId,
          resourceLabelSnapshot: String(quote.folio || quoteId),
          requestId: typeof quote.requestId === 'string' ? quote.requestId : null,
          quoteId,
          result: 'success',
          reason: reason ?? null,
          before: {status: from},
          after: {status: to},
          route: `/quotes?quote=${encodeURIComponent(quoteId)}`,
          occurredAt: now,
        }),
      );

      const recipients = new Set<string>();
      if (to === 'sent') adminSnapshots?.docs.forEach((admin) => recipients.add(admin.id));
      if (to !== 'sent' && typeof quote.assignedTo === 'string') recipients.add(quote.assignedTo);
      recipients.delete(actor.uid);
      for (const userId of recipients) {
        transaction.set(firestore.collection('notifications').doc(), {
          userId,
          type: `quote_${to}`,
          title: `Cotización ${String(quote.folio)} ${statusLabel(to)}`,
          message:
            to === 'rejected'
              ? `La cotización fue rechazada. Motivo: ${String(reason)}`
              : `El estado comercial cambió de ${statusLabel(from)} a ${statusLabel(to)}.`,
          resourceType: 'quote',
          resourceId: quoteId,
          read: false,
          readAt: null,
          createdAt: now,
        });
      }

      return {quoteId, from, to};
    });
  },
);

function statusLabel(status: CommercialQuoteStatus): string {
  return (
    {
      draft: 'borrador',
      issued: 'emitida',
      sent: 'enviada',
      accepted: 'aceptada',
      rejected: 'rechazada',
      cancelled: 'cancelada',
      expired: 'expirada',
    } as const
  )[status];
}
