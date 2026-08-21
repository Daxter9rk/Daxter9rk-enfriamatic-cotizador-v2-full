import {createHash} from 'node:crypto';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {firestore, storage} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';
import {invalidArgument} from '../shared/errors';
import {quoteIdSchema} from '../shared/schemas';

const MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024;

export const downloadQuotePdf = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    maxInstances: 10,
    enforceAppCheck: false,
  },
  async (request) => {
    const actor = await requireActiveActor(request);
    const parsed = quoteIdSchema.safeParse(request.data);
    if (!parsed.success) throw invalidArgument(parsed.error);
    const {quoteId} = parsed.data;

    const [quoteSnapshot, documentSnapshot] = await Promise.all([
      firestore.doc(`quotes/${quoteId}`).get(),
      firestore.doc(`documents/${quoteId}`).get(),
    ]);
    if (!quoteSnapshot.exists || !documentSnapshot.exists) {
      throw new HttpsError('not-found', 'The quote document does not exist.');
    }
    const quote = quoteSnapshot.data() ?? {};
    const document = documentSnapshot.data() ?? {};
    if (quote.status !== 'issued' || document.status !== 'ready') {
      throw new HttpsError('failed-precondition', 'The quote PDF is not ready.');
    }

    if (quote.requestId == null) {
      if (quote.siteId != null || quote.equipmentId != null) {
        throw new HttpsError('data-loss', 'The independent quote contains operational references.');
      }
      if (actor.role === 'operator' && quote.assignedTo != null && quote.assignedTo !== actor.uid) {
        throw new HttpsError('permission-denied', 'The document is not assigned to this operator.');
      }
    } else {
      const requestSnapshot = await firestore.doc(`requests/${String(quote.requestId)}`).get();
      const serviceRequest = requestSnapshot.data() ?? {};
      if (
        !requestSnapshot.exists ||
        quote.clientId !== serviceRequest.clientId ||
        quote.siteId !== serviceRequest.siteId ||
        (quote.equipmentId ?? null) !== (serviceRequest.equipmentId ?? null)
      ) {
        throw new HttpsError('data-loss', 'The quote does not match its related request.');
      }
      if (
        actor.role === 'operator' &&
        (quote.assignedTo !== actor.uid || serviceRequest.assignedTo !== actor.uid)
      ) {
        throw new HttpsError('permission-denied', 'The document is not assigned to this operator.');
      }
    }

    if (
      typeof document.storagePath !== 'string' ||
      !document.storagePath.startsWith(`quotes/${quoteId}/documents/`) ||
      !document.storagePath.endsWith('.pdf')
    ) {
      throw new HttpsError('data-loss', 'The document path is invalid.');
    }
    if (
      typeof document.sizeBytes !== 'number' ||
      document.sizeBytes < 5 ||
      document.sizeBytes > MAX_DOWNLOAD_BYTES
    ) {
      throw new HttpsError('resource-exhausted', 'The document size is invalid.');
    }

    const [bytes] = await storage.bucket().file(document.storagePath).download();
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (
      bytes.length > MAX_DOWNLOAD_BYTES ||
      bytes.subarray(0, 5).toString('ascii') !== '%PDF-' ||
      (typeof document.sizeBytes === 'number' && document.sizeBytes !== bytes.length) ||
      (typeof document.sha256 === 'string' && document.sha256 !== hash)
    ) {
      throw new HttpsError('data-loss', 'The stored document is not a PDF.');
    }
    return {
      base64: bytes.toString('base64'),
      mimeType: 'application/pdf' as const,
      fileName: String(document.fileName ?? `${quote.folio}.pdf`),
    };
  },
);
