import {FieldValue} from 'firebase-admin/firestore';
import {onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';
import {firestore} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';
import {invalidArgument} from '../shared/errors';

const inputSchema = z.object({clientId: z.string().trim().min(1).max(128)}).strict();
type DependencySummary = {quotes?: number; sites?: number; equipment?: number; requests?: number};

export type DeleteClientResult =
  | {outcome: 'deleted'}
  | {outcome: 'already_deleted'}
  | {
      outcome: 'has_dependencies';
      dependencySummary: DependencySummary;
    };

export const deleteClient = onCall(
  {region: 'us-central1', maxInstances: 5, enforceAppCheck: false},
  async (request): Promise<DeleteClientResult> => {
    const actor = await requireActiveActor(request, ['admin']);
    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) throw invalidArgument(parsed.error);

    const clientRef = firestore.doc(`clients/${parsed.data.clientId}`);
    const dependencySummary = await findDependencies(parsed.data.clientId);
    if (dependencySummary) return {outcome: 'has_dependencies', dependencySummary};
    return firestore.runTransaction(async (transaction) => {
      const clientSnapshot = await transaction.get(clientRef);
      if (!clientSnapshot.exists) return {outcome: 'already_deleted'};

      const dependencyQueries = {
        quotes: firestore
          .collection('quotes')
          .where('clientId', '==', parsed.data.clientId)
          .limit(100),
        sites: firestore.collection('sites').where('clientId', '==', parsed.data.clientId).limit(1),
        equipment: firestore
          .collection('equipment')
          .where('clientId', '==', parsed.data.clientId)
          .limit(1),
        requests: firestore
          .collection('requests')
          .where('clientId', '==', parsed.data.clientId)
          .limit(1),
      };
      const quotes = await transaction.get(dependencyQueries.quotes);
      const sites = await transaction.get(dependencyQueries.sites);
      const equipment = await transaction.get(dependencyQueries.equipment);
      const requests = await transaction.get(dependencyQueries.requests);

      if (quotes.size || sites.size || equipment.size || requests.size) {
        return {
          outcome: 'has_dependencies',
          dependencySummary: {
            ...(quotes.size ? {quotes: quotes.size} : {}),
            ...(sites.size ? {sites: sites.size} : {}),
            ...(equipment.size ? {equipment: equipment.size} : {}),
            ...(requests.size ? {requests: requests.size} : {}),
          },
        };
      }

      const now = FieldValue.serverTimestamp();
      transaction.delete(clientRef);
      transaction.set(firestore.collection('auditLogs').doc(), {
        actorId: actor.uid,
        actorUid: actor.uid,
        actorDisplayNameSnapshot: actor.displayName || actor.email,
        actorRole: actor.role,
        actorRoleSnapshot: actor.role,
        action: 'clients.deleted',
        resourceType: 'client',
        resourceId: parsed.data.clientId,
        requestId: null,
        quoteId: null,
        before: {
          name: String(clientSnapshot.data()?.name ?? ''),
          status: clientSnapshot.data()?.status,
        },
        after: null,
        metadata: {},
        result: 'success',
        reason: null,
        schemaVersion: 1,
        createdAt: now,
      });
      return {outcome: 'deleted'};
    });
  },
);

async function findDependencies(clientId: string): Promise<DependencySummary | null> {
  const [quotes, sites, equipment, requests] = await Promise.all([
    firestore.collection('quotes').where('clientId', '==', clientId).limit(100).get(),
    firestore.collection('sites').where('clientId', '==', clientId).limit(1).get(),
    firestore.collection('equipment').where('clientId', '==', clientId).limit(1).get(),
    firestore.collection('requests').where('clientId', '==', clientId).limit(1).get(),
  ]);
  if (!quotes.size && !sites.size && !equipment.size && !requests.size) return null;
  return {
    ...(quotes.size ? {quotes: quotes.size} : {}),
    ...(sites.size ? {sites: sites.size} : {}),
    ...(equipment.size ? {equipment: equipment.size} : {}),
    ...(requests.size ? {requests: requests.size} : {}),
  };
}
