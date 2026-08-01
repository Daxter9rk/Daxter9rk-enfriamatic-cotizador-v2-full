import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {firestore} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';
import {invalidArgument} from '../shared/errors';
import {transitionQuoteSchema} from '../shared/schemas';
import {canApplyCommercialTransition, type CommercialQuoteStatus} from './transitionPolicy';

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
      transaction.update(quoteRef, {
        status: to,
        commercialTransition: {
          from,
          to,
          actorId: actor.uid,
          at: now,
          reason: reason ?? null,
        },
        updatedAt: now,
        updatedBy: actor.uid,
      });
      transaction.set(firestore.collection('auditLogs').doc(), {
        actorId: actor.uid,
        actorRole: actor.role,
        action: `quote.${to}`,
        resourceType: 'quote',
        resourceId: quoteId,
        requestId: quote.requestId ?? null,
        quoteId,
        before: {status: from},
        after: {status: to},
        metadata: {reason: reason ?? null},
        createdAt: now,
      });

      const recipients = new Set<string>();
      if (to === 'sent') adminSnapshots?.docs.forEach((admin) => recipients.add(admin.id));
      if (to !== 'sent' && typeof quote.assignedTo === 'string') recipients.add(quote.assignedTo);
      recipients.delete(actor.uid);
      for (const userId of recipients) {
        transaction.set(firestore.collection('notifications').doc(), {
          userId,
          type: `quote_${to}`,
          title: `Cotización ${String(quote.folio)} ${statusLabel(to)}`,
          message: `El estado comercial cambió de ${statusLabel(from)} a ${statusLabel(to)}.`,
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
