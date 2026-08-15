import {HttpsError} from 'firebase-functions/v2/https';
import type {ValidatedCatalogImage} from './imageValidation';

export interface CatalogImageActor {
  uid: string;
  displayName: string;
  email: string;
  role: 'admin';
}

export interface CatalogImageReference {
  storagePath: string;
  generation: string | null;
}

export interface CatalogImageOperationResult {
  catalogItemId: string;
  operationId: string;
  status: 'ready' | 'deleted';
  deleted?: boolean;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  cleanupPending?: CatalogImageReference | null;
  idempotent?: boolean;
}

export interface CatalogImageGateway {
  getCompletedOperation(
    kind: 'upsert' | 'delete',
    catalogItemId: string,
    operationId: string,
  ): Promise<CatalogImageOperationResult | null>;
  readCurrent(catalogItemId: string): Promise<{
    itemLabel: string;
    current: CatalogImageReference | null;
    revision: string | null;
  }>;
  uploadUnique(
    storagePath: string,
    image: ValidatedCatalogImage,
    catalogItemId: string,
    operationId: string,
  ): Promise<{generation: string; created: boolean}>;
  commitUpsert(input: {
    catalogItemId: string;
    operationId: string;
    storagePath: string;
    generation: string;
    previous: CatalogImageReference | null;
    expectedRevision: string | null;
    image: ValidatedCatalogImage;
    actor: CatalogImageActor;
    itemLabel: string;
  }): Promise<{kind: 'committed' | 'idempotent'; result?: CatalogImageOperationResult}>;
  commitDelete(input: {
    catalogItemId: string;
    operationId: string;
    expectedRevision: string | null;
    actor: CatalogImageActor;
    itemLabel: string;
  }): Promise<{
    kind: 'committed' | 'idempotent';
    previous: CatalogImageReference | null;
    result?: CatalogImageOperationResult;
  }>;
  deleteExact(storagePath: string, generation: string | null): Promise<void>;
  markCleanupPending(input: {
    kind: 'upsert' | 'delete';
    catalogItemId: string;
    operationId: string;
    target: CatalogImageReference;
    actor: CatalogImageActor;
    itemLabel: string;
  }): Promise<void>;
  completeCleanup(input: {
    kind: 'upsert' | 'delete';
    catalogItemId: string;
    operationId: string;
    target: CatalogImageReference;
    actor: CatalogImageActor;
    itemLabel: string;
  }): Promise<void>;
}

export async function upsertCatalogImageWorkflow(
  input: {catalogItemId: string; operationId: string; image: ValidatedCatalogImage},
  actor: CatalogImageActor,
  gateway: CatalogImageGateway,
): Promise<CatalogImageOperationResult> {
  const completed = await gateway.getCompletedOperation(
    'upsert',
    input.catalogItemId,
    input.operationId,
  );
  if (completed) {
    await retryPendingCleanup(
      completed,
      'upsert',
      actor,
      gateway,
      input.catalogItemId,
      input.operationId,
    );
    return {...completed, cleanupPending: null, idempotent: true};
  }

  const current = await gateway.readCurrent(input.catalogItemId);
  const storagePath = catalogImagePath(
    input.catalogItemId,
    input.operationId,
    input.image.extension,
  );
  const uploaded = await gateway.uploadUnique(
    storagePath,
    input.image,
    input.catalogItemId,
    input.operationId,
  );
  let commit: Awaited<ReturnType<CatalogImageGateway['commitUpsert']>>;
  try {
    commit = await gateway.commitUpsert({
      catalogItemId: input.catalogItemId,
      operationId: input.operationId,
      storagePath,
      generation: uploaded.generation,
      previous: current.current,
      expectedRevision: current.revision,
      image: input.image,
      actor,
      itemLabel: current.itemLabel,
    });
  } catch (error) {
    if (uploaded.created) {
      try {
        await gateway.deleteExact(storagePath, uploaded.generation);
      } catch {
        // The original failure remains authoritative; bounded backend logging is handled upstream.
      }
    }
    throw articleUpdateError(error);
  }

  if (commit.kind === 'idempotent' && commit.result) {
    return {...commit.result, idempotent: true};
  }
  const result: CatalogImageOperationResult = {
    catalogItemId: input.catalogItemId,
    operationId: input.operationId,
    status: 'ready',
    storagePath,
    mimeType: input.image.mimeType,
    sizeBytes: input.image.sizeBytes,
    width: input.image.width,
    height: input.image.height,
  };
  if (current.current && current.current.storagePath !== storagePath) {
    try {
      await gateway.deleteExact(current.current.storagePath, current.current.generation);
    } catch {
      await gateway.markCleanupPending({
        kind: 'upsert',
        catalogItemId: input.catalogItemId,
        operationId: input.operationId,
        target: current.current,
        actor,
        itemLabel: current.itemLabel,
      });
      result.cleanupPending = current.current;
    }
  }
  return result;
}

export async function deleteCatalogImageWorkflow(
  input: {catalogItemId: string; operationId: string},
  actor: CatalogImageActor,
  gateway: CatalogImageGateway,
): Promise<CatalogImageOperationResult> {
  const completed = await gateway.getCompletedOperation(
    'delete',
    input.catalogItemId,
    input.operationId,
  );
  if (completed) {
    await retryPendingCleanup(
      completed,
      'delete',
      actor,
      gateway,
      input.catalogItemId,
      input.operationId,
    );
    return {...completed, cleanupPending: null, idempotent: true};
  }
  const current = await gateway.readCurrent(input.catalogItemId);
  let commit: Awaited<ReturnType<CatalogImageGateway['commitDelete']>>;
  try {
    commit = await gateway.commitDelete({
      catalogItemId: input.catalogItemId,
      operationId: input.operationId,
      expectedRevision: current.revision,
      actor,
      itemLabel: current.itemLabel,
    });
  } catch (error) {
    throw articleUpdateError(error);
  }
  if (commit.kind === 'idempotent' && commit.result) {
    return {...commit.result, idempotent: true};
  }
  const result: CatalogImageOperationResult = {
    catalogItemId: input.catalogItemId,
    operationId: input.operationId,
    status: 'deleted',
    deleted: commit.previous !== null,
  };
  if (!commit.previous) return result;
  try {
    await gateway.deleteExact(commit.previous.storagePath, commit.previous.generation);
    await gateway.completeCleanup({
      kind: 'delete',
      catalogItemId: input.catalogItemId,
      operationId: input.operationId,
      target: commit.previous,
      actor,
      itemLabel: current.itemLabel,
    });
  } catch {
    await gateway.markCleanupPending({
      kind: 'delete',
      catalogItemId: input.catalogItemId,
      operationId: input.operationId,
      target: commit.previous,
      actor,
      itemLabel: current.itemLabel,
    });
    result.cleanupPending = commit.previous;
  }
  return result;
}

function catalogImagePath(catalogItemId: string, operationId: string, extension: string): string {
  if (
    !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(catalogItemId) ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(operationId) ||
    !['jpg', 'png', 'webp'].includes(extension)
  ) {
    throw new HttpsError('invalid-argument', 'The catalog image path is invalid.');
  }
  return `catalog-items/${catalogItemId}/images/${operationId}.${extension}`;
}

async function retryPendingCleanup(
  completed: CatalogImageOperationResult,
  kind: 'upsert' | 'delete',
  actor: CatalogImageActor,
  gateway: CatalogImageGateway,
  catalogItemId: string,
  operationId: string,
): Promise<void> {
  if (!completed.cleanupPending) return;
  const current = await gateway.readCurrent(catalogItemId);
  try {
    await gateway.deleteExact(
      completed.cleanupPending.storagePath,
      completed.cleanupPending.generation,
    );
    await gateway.completeCleanup({
      kind,
      catalogItemId,
      operationId,
      target: completed.cleanupPending,
      actor,
      itemLabel: current.itemLabel,
    });
  } catch {
    throw new HttpsError('unavailable', 'Image cleanup is still pending.');
  }
}

function articleUpdateError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  return new HttpsError('unavailable', 'The catalog article could not be updated.', {
    reason: 'article-update',
  });
}
