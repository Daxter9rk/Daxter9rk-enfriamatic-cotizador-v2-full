import {logger} from 'firebase-functions';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {z} from 'zod';
import {firestore, storage} from '../shared/admin';
import {requireActiveActor} from '../shared/auth';
import {invalidArgument, safeErrorCode} from '../shared/errors';
import {AdminCatalogImageGateway} from './imageRepository';
import {
  deleteCatalogImageWorkflow,
  upsertCatalogImageWorkflow,
  type CatalogImageActor,
} from './imageWorkflow';
import {MAX_CATALOG_IMAGE_BYTES, validateCatalogImage} from './imageValidation';

const catalogItemId = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/);
const operationId = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const upsertSchema = z
  .object({
    catalogItemId,
    operationId,
    base64: z
      .string()
      .min(4)
      .max(Math.ceil(MAX_CATALOG_IMAGE_BYTES / 3) * 4 + 4),
    originalFileName: z.string().min(1).max(160),
    declaredMimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  })
  .strict();
const mutationSchema = z.object({catalogItemId, operationId}).strict();
const readSchema = z.object({catalogItemId}).strict();

const callableOptions = {
  region: 'us-central1' as const,
  memory: '512MiB' as const,
  timeoutSeconds: 60,
  maxInstances: 5,
  enforceAppCheck: false,
};

export const upsertCatalogImage = onCall(callableOptions, async (request) => {
  const actor = await requireActiveActor(request, ['admin']);
  const parsed = upsertSchema.safeParse(request.data);
  if (!parsed.success) throw invalidArgument(parsed.error);
  const input = parsed.data;
  const bytes = decodeBase64(input.base64);
  try {
    const image = await validateCatalogImage({
      bytes,
      declaredMimeType: input.declaredMimeType,
      originalFileName: input.originalFileName,
    });
    return await upsertCatalogImageWorkflow(
      {catalogItemId: input.catalogItemId, operationId: input.operationId, image},
      callableActor(actor),
      new AdminCatalogImageGateway(),
    );
  } catch (error) {
    logger.warn('Catalog image upsert failed', {
      stage: 'catalog-image-upsert',
      errorCode: safeErrorCode(error),
      catalogItemId: input.catalogItemId,
      operationId: input.operationId,
    });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('unavailable', 'The catalog image could not be stored.');
  } finally {
    bytes.fill(0);
  }
});

export const deleteCatalogImage = onCall(callableOptions, async (request) => {
  const actor = await requireActiveActor(request, ['admin']);
  const parsed = mutationSchema.safeParse(request.data);
  if (!parsed.success) throw invalidArgument(parsed.error);
  try {
    return await deleteCatalogImageWorkflow(
      parsed.data,
      callableActor(actor),
      new AdminCatalogImageGateway(),
    );
  } catch (error) {
    logger.warn('Catalog image deletion failed', {
      stage: 'catalog-image-delete',
      errorCode: safeErrorCode(error),
      catalogItemId: parsed.data.catalogItemId,
      operationId: parsed.data.operationId,
    });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('unavailable', 'The catalog image could not be deleted.');
  }
});

export const getCatalogImageContent = onCall(callableOptions, async (request) => {
  const actor = await requireActiveActor(request);
  const parsed = readSchema.safeParse(request.data);
  if (!parsed.success) throw invalidArgument(parsed.error);
  const {catalogItemId: itemId} = parsed.data;
  const [itemSnapshot, metadataSnapshot] = await Promise.all([
    firestore.doc(`catalogItems/${itemId}`).get(),
    firestore.doc(`catalogImageMetadata/${itemId}`).get(),
  ]);
  if (!itemSnapshot.exists) throw new HttpsError('not-found', 'The catalog item does not exist.');
  const item = itemSnapshot.data() ?? {};
  if (actor.role === 'operator' && item.status !== 'active') {
    throw new HttpsError('permission-denied', 'The catalog item is not available.');
  }
  if (item.imageStatus !== 'ready' || typeof item.imageStoragePath !== 'string') {
    throw new HttpsError('not-found', 'The catalog image does not exist.');
  }
  const storagePath = item.imageStoragePath;
  if (!validStoredPath(itemId, storagePath)) {
    throw new HttpsError('data-loss', 'The stored catalog image path is invalid.');
  }
  const file = storage.bucket().file(storagePath);
  try {
    const [objectMetadata] = await file.getMetadata();
    const sizeBytes = Number(objectMetadata.size);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_CATALOG_IMAGE_BYTES) {
      throw new HttpsError('data-loss', 'The stored catalog image size is invalid.');
    }
    const expectedGeneration = metadataSnapshot.data()?.generation;
    if (
      typeof expectedGeneration === 'string' &&
      String(objectMetadata.generation) !== expectedGeneration
    ) {
      throw new HttpsError('aborted', 'The catalog image changed during download.');
    }
    const [bytes] = await file.download();
    try {
      const validated = await validateCatalogImage({
        bytes,
        declaredMimeType: String(item.imageMimeType ?? objectMetadata.contentType ?? ''),
        originalFileName: String(item.imageFileName ?? 'imagen'),
      });
      return {
        base64: bytes.toString('base64'),
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        width: validated.width,
        height: validated.height,
        generation: String(objectMetadata.generation),
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw new HttpsError('data-loss', 'The stored catalog image is invalid.');
      }
      throw error;
    } finally {
      bytes.fill(0);
    }
  } catch (error) {
    logger.warn('Catalog image read failed', {
      stage: 'catalog-image-read',
      errorCode: safeErrorCode(error),
      catalogItemId: itemId,
    });
    if (error instanceof HttpsError) throw error;
    if (storageErrorCode(error) === 404) {
      throw new HttpsError('not-found', 'The catalog image does not exist.');
    }
    throw new HttpsError('unavailable', 'The catalog image could not be loaded.');
  }
});

function callableActor(actor: Awaited<ReturnType<typeof requireActiveActor>>): CatalogImageActor {
  if (actor.role !== 'admin') throw new HttpsError('permission-denied', 'Admin role is required.');
  return {
    uid: actor.uid,
    displayName: actor.displayName,
    email: actor.email,
    role: actor.role,
  };
}

function decodeBase64(value: string): Buffer {
  if (
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new HttpsError('invalid-argument', 'The image encoding is invalid.');
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length > MAX_CATALOG_IMAGE_BYTES) {
    bytes.fill(0);
    throw new HttpsError('resource-exhausted', 'The image exceeds five megabytes.');
  }
  return bytes;
}

function validStoredPath(catalogItemId: string, storagePath: string): boolean {
  const escapedId = catalogItemId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(`^catalog-items/${escapedId}/images/[A-Za-z0-9_-]{8,128}\\.(jpg|png|webp)$`).test(
      storagePath,
    ) ||
    new RegExp(`^catalog/${escapedId}/[A-Za-z0-9_-]{1,128}/[A-Za-z0-9_.-]{1,160}$`).test(
      storagePath,
    )
  );
}

function storageErrorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const value = (error as {code?: unknown}).code;
  return typeof value === 'number' ? value : Number(value) || null;
}
