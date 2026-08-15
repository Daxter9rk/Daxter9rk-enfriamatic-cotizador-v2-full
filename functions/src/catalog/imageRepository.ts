import {createHash} from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {buildDomainAuditRecord, domainAuditId} from '../audit/domainEvent';
import {firestore, storage} from '../shared/admin';
import type {
  CatalogImageActor,
  CatalogImageGateway,
  CatalogImageOperationResult,
  CatalogImageReference,
} from './imageWorkflow';
import type {ValidatedCatalogImage} from './imageValidation';

export class AdminCatalogImageGateway implements CatalogImageGateway {
  async getCompletedOperation(
    kind: 'upsert' | 'delete',
    catalogItemId: string,
    operationId: string,
  ): Promise<CatalogImageOperationResult | null> {
    const snapshot = await operationRef(kind, catalogItemId, operationId).get();
    return snapshot.exists ? operationResult(snapshot.data() ?? {}) : null;
  }

  async readCurrent(catalogItemId: string) {
    const [itemSnapshot, metadataSnapshot] = await Promise.all([
      firestore.doc(`catalogItems/${catalogItemId}`).get(),
      firestore.doc(`catalogImageMetadata/${catalogItemId}`).get(),
    ]);
    if (!itemSnapshot.exists) {
      throw new HttpsError('not-found', 'The catalog item does not exist.');
    }
    const item = itemSnapshot.data() ?? {};
    const metadata = metadataSnapshot.data() ?? {};
    const storagePath = typeof item.imageStoragePath === 'string' ? item.imageStoragePath : null;
    return {
      itemLabel: String(item.name || item.code || catalogItemId).slice(0, 160),
      current: storagePath ? imageReference(storagePath, metadata) : null,
      revision:
        typeof metadata.currentOperationId === 'string' ? metadata.currentOperationId : null,
    };
  }

  async uploadUnique(
    storagePath: string,
    image: ValidatedCatalogImage,
    catalogItemId: string,
    operationId: string,
  ): Promise<{generation: string; created: boolean}> {
    const file = storage.bucket().file(storagePath);
    try {
      await file.save(image.bytes, {
        resumable: false,
        validation: 'crc32c',
        contentType: image.mimeType,
        metadata: {
          cacheControl: 'private,max-age=3600',
          metadata: {
            resourceType: 'catalog',
            catalogItemId,
            operationId,
            sha256: image.sha256,
          },
        },
        preconditionOpts: {ifGenerationMatch: 0},
      });
      const [metadata] = await file.getMetadata();
      return {generation: String(metadata.generation), created: true};
    } catch (error) {
      if (errorCode(error) !== 412) throw error;
      const [metadata] = await file.getMetadata();
      if (metadata.metadata?.sha256 !== image.sha256) {
        throw new HttpsError('aborted', 'The image operation identifier is already in use.');
      }
      return {generation: String(metadata.generation), created: false};
    }
  }

  async commitUpsert(input: {
    catalogItemId: string;
    operationId: string;
    storagePath: string;
    generation: string;
    previous: CatalogImageReference | null;
    expectedRevision: string | null;
    image: ValidatedCatalogImage;
    actor: CatalogImageActor;
    itemLabel: string;
  }): Promise<{kind: 'committed' | 'idempotent'; result?: CatalogImageOperationResult}> {
    const itemRef = firestore.doc(`catalogItems/${input.catalogItemId}`);
    const metadataRef = firestore.doc(`catalogImageMetadata/${input.catalogItemId}`);
    const opRef = operationRef('upsert', input.catalogItemId, input.operationId);
    return firestore.runTransaction(async (transaction) => {
      const operation = await transaction.get(opRef);
      if (operation.exists) {
        return {kind: 'idempotent' as const, result: operationResult(operation.data() ?? {})};
      }
      const [itemSnapshot, metadataSnapshot] = await Promise.all([
        transaction.get(itemRef),
        transaction.get(metadataRef),
      ]);
      if (!itemSnapshot.exists) {
        throw new HttpsError('not-found', 'The catalog item does not exist.');
      }
      const item = itemSnapshot.data() ?? {};
      const metadata = metadataSnapshot.data() ?? {};
      const currentPath = typeof item.imageStoragePath === 'string' ? item.imageStoragePath : null;
      const currentRevision =
        typeof metadata.currentOperationId === 'string' ? metadata.currentOperationId : null;
      if (
        currentPath !== (input.previous?.storagePath ?? null) ||
        currentRevision !== input.expectedRevision
      ) {
        throw new HttpsError('aborted', 'The catalog image changed during this operation.');
      }

      const now = FieldValue.serverTimestamp();
      transaction.update(itemRef, {
        imageStoragePath: input.storagePath,
        imageFileName: input.image.originalFileName,
        imageMimeType: input.image.mimeType,
        imageSizeBytes: input.image.sizeBytes,
        imageStatus: 'ready',
        updatedAt: now,
        updatedBy: input.actor.uid,
      });
      transaction.set(
        metadataRef,
        {
          catalogItemId: input.catalogItemId,
          storagePath: input.storagePath,
          mimeType: input.image.mimeType,
          sizeBytes: input.image.sizeBytes,
          width: input.image.width,
          height: input.image.height,
          sha256: input.image.sha256,
          generation: input.generation,
          originalFileName: input.image.originalFileName,
          currentOperationId: input.operationId,
          status: 'ready',
          cleanupPending: metadata.cleanupPending ?? null,
          updatedAt: now,
          updatedBy: input.actor.uid,
          schemaVersion: 1,
        },
        {merge: true},
      );
      const result: CatalogImageOperationResult = {
        catalogItemId: input.catalogItemId,
        operationId: input.operationId,
        status: 'ready',
        storagePath: input.storagePath,
        mimeType: input.image.mimeType,
        sizeBytes: input.image.sizeBytes,
        width: input.image.width,
        height: input.image.height,
      };
      transaction.set(opRef, {
        kind: 'upsert',
        ...result,
        cleanupPending: null,
        createdAt: now,
        updatedAt: now,
        actorUid: input.actor.uid,
        schemaVersion: 1,
      });
      const eventCode = input.previous ? 'catalog.image_changed' : 'catalog.image_added';
      transaction.set(
        firestore
          .collection('auditLogs')
          .doc(domainAuditId(`${input.catalogItemId}:${input.operationId}`, eventCode)),
        buildDomainAuditRecord({
          sourceEventId: `${input.catalogItemId}:${input.operationId}`,
          eventCode,
          actorUid: input.actor.uid,
          actorDisplayNameSnapshot: input.actor.displayName || input.actor.email,
          actorRoleSnapshot: input.actor.role,
          resourceType: 'catalog',
          resourceId: input.catalogItemId,
          resourceLabelSnapshot: input.itemLabel,
          result: 'success',
          before: input.previous ? {image: 'present'} : {image: null},
          after: {
            image: 'ready',
            mimeType: input.image.mimeType,
            sizeBytes: input.image.sizeBytes,
            width: input.image.width,
            height: input.image.height,
          },
          route: `/commercial-catalog?item=${encodeURIComponent(input.catalogItemId)}`,
          occurredAt: now,
        }),
      );
      return {kind: 'committed' as const};
    });
  }

  async commitDelete(input: {
    catalogItemId: string;
    operationId: string;
    expectedRevision: string | null;
    actor: CatalogImageActor;
    itemLabel: string;
  }) {
    const itemRef = firestore.doc(`catalogItems/${input.catalogItemId}`);
    const metadataRef = firestore.doc(`catalogImageMetadata/${input.catalogItemId}`);
    const opRef = operationRef('delete', input.catalogItemId, input.operationId);
    return firestore.runTransaction(async (transaction) => {
      const operation = await transaction.get(opRef);
      if (operation.exists) {
        const result = operationResult(operation.data() ?? {});
        return {
          kind: 'idempotent' as const,
          previous: result.cleanupPending ?? null,
          result,
        };
      }
      const [itemSnapshot, metadataSnapshot] = await Promise.all([
        transaction.get(itemRef),
        transaction.get(metadataRef),
      ]);
      if (!itemSnapshot.exists) {
        throw new HttpsError('not-found', 'The catalog item does not exist.');
      }
      const item = itemSnapshot.data() ?? {};
      const metadata = metadataSnapshot.data() ?? {};
      const currentRevision =
        typeof metadata.currentOperationId === 'string' ? metadata.currentOperationId : null;
      if (currentRevision !== input.expectedRevision) {
        throw new HttpsError('aborted', 'The catalog image changed during this operation.');
      }
      const storagePath = typeof item.imageStoragePath === 'string' ? item.imageStoragePath : null;
      const previous = storagePath ? imageReference(storagePath, metadata) : null;
      const now = FieldValue.serverTimestamp();
      if (previous) {
        transaction.update(itemRef, {
          imageStoragePath: null,
          imageFileName: null,
          imageMimeType: null,
          imageSizeBytes: null,
          imageStatus: null,
          updatedAt: now,
          updatedBy: input.actor.uid,
        });
      }
      transaction.set(
        metadataRef,
        {
          catalogItemId: input.catalogItemId,
          storagePath: null,
          generation: null,
          currentOperationId: input.operationId,
          status: 'deleted',
          cleanupPending: previous,
          updatedAt: now,
          updatedBy: input.actor.uid,
          schemaVersion: 1,
        },
        {merge: true},
      );
      const result: CatalogImageOperationResult = {
        catalogItemId: input.catalogItemId,
        operationId: input.operationId,
        status: 'deleted',
        deleted: previous !== null,
        cleanupPending: previous,
      };
      transaction.set(opRef, {
        kind: 'delete',
        ...result,
        createdAt: now,
        updatedAt: now,
        actorUid: input.actor.uid,
        schemaVersion: 1,
      });
      if (previous) {
        transaction.set(
          firestore
            .collection('auditLogs')
            .doc(
              domainAuditId(`${input.catalogItemId}:${input.operationId}`, 'catalog.image_deleted'),
            ),
          buildDomainAuditRecord({
            sourceEventId: `${input.catalogItemId}:${input.operationId}`,
            eventCode: 'catalog.image_deleted',
            actorUid: input.actor.uid,
            actorDisplayNameSnapshot: input.actor.displayName || input.actor.email,
            actorRoleSnapshot: input.actor.role,
            resourceType: 'catalog',
            resourceId: input.catalogItemId,
            resourceLabelSnapshot: input.itemLabel,
            result: 'success',
            before: {image: 'present'},
            after: {image: null},
            route: `/commercial-catalog?item=${encodeURIComponent(input.catalogItemId)}`,
            occurredAt: now,
          }),
        );
      }
      return {kind: 'committed' as const, previous};
    });
  }

  async deleteExact(storagePath: string, generation: string | null): Promise<void> {
    try {
      await storage
        .bucket()
        .file(storagePath)
        .delete(generation ? {ifGenerationMatch: generation} : undefined);
    } catch (error) {
      if (errorCode(error) !== 404) throw error;
    }
  }

  async markCleanupPending(input: {
    kind: 'upsert' | 'delete';
    catalogItemId: string;
    operationId: string;
    target: CatalogImageReference;
    actor: CatalogImageActor;
    itemLabel: string;
  }): Promise<void> {
    await this.writeCleanupState(input, 'pending');
  }

  async completeCleanup(input: {
    kind: 'upsert' | 'delete';
    catalogItemId: string;
    operationId: string;
    target: CatalogImageReference;
    actor: CatalogImageActor;
    itemLabel: string;
  }): Promise<void> {
    await this.writeCleanupState(input, 'completed');
  }

  private async writeCleanupState(
    input: {
      kind: 'upsert' | 'delete';
      catalogItemId: string;
      operationId: string;
      target: CatalogImageReference;
      actor: CatalogImageActor;
      itemLabel: string;
    },
    status: 'pending' | 'completed',
  ): Promise<void> {
    const now = FieldValue.serverTimestamp();
    const cleanupId = operationDocumentId(
      input.kind,
      input.catalogItemId,
      `${input.operationId}:cleanup`,
    );
    const batch = firestore.batch();
    batch.set(
      firestore.doc(`catalogImageCleanups/${cleanupId}`),
      {
        catalogItemId: input.catalogItemId,
        operationId: input.operationId,
        kind: input.kind,
        target: input.target,
        status,
        updatedAt: now,
        updatedBy: input.actor.uid,
        schemaVersion: 1,
      },
      {merge: true},
    );
    batch.set(
      operationRef(input.kind, input.catalogItemId, input.operationId),
      {cleanupPending: status === 'pending' ? input.target : null, updatedAt: now},
      {merge: true},
    );
    batch.set(
      firestore.doc(`catalogImageMetadata/${input.catalogItemId}`),
      {cleanupPending: status === 'pending' ? input.target : null, updatedAt: now},
      {merge: true},
    );
    const eventCode =
      status === 'pending' ? 'catalog.image_cleanup_pending' : 'catalog.image_cleanup_completed';
    batch.set(
      firestore
        .collection('auditLogs')
        .doc(domainAuditId(`${input.catalogItemId}:${input.operationId}:cleanup`, eventCode)),
      buildDomainAuditRecord({
        sourceEventId: `${input.catalogItemId}:${input.operationId}:cleanup`,
        eventCode,
        actorUid: input.actor.uid,
        actorDisplayNameSnapshot: input.actor.displayName || input.actor.email,
        actorRoleSnapshot: input.actor.role,
        resourceType: 'catalog',
        resourceId: input.catalogItemId,
        resourceLabelSnapshot: input.itemLabel,
        result: status === 'pending' ? 'failed' : 'success',
        reason: status === 'pending' ? 'storage-cleanup-pending' : null,
        before: {cleanup: status === 'pending' ? 'required' : 'pending'},
        after: {cleanup: status},
        route: `/commercial-catalog?item=${encodeURIComponent(input.catalogItemId)}`,
        occurredAt: now,
      }),
    );
    await batch.commit();
  }
}

function operationRef(kind: 'upsert' | 'delete', catalogItemId: string, operationId: string) {
  return firestore.doc(
    `catalogImageOperations/${operationDocumentId(kind, catalogItemId, operationId)}`,
  );
}

function operationDocumentId(kind: string, catalogItemId: string, operationId: string): string {
  return createHash('sha256')
    .update(`${kind}:${catalogItemId}:${operationId}`)
    .digest('hex')
    .slice(0, 48);
}

function operationResult(data: Record<string, unknown>): CatalogImageOperationResult {
  const cleanup = data.cleanupPending as Partial<CatalogImageReference> | null | undefined;
  const cleanupPending =
    cleanup && typeof cleanup.storagePath === 'string'
      ? imageReference(cleanup.storagePath, cleanup)
      : null;
  return {
    catalogItemId: String(data.catalogItemId ?? ''),
    operationId: String(data.operationId ?? ''),
    status: data.status === 'deleted' ? 'deleted' : 'ready',
    deleted: data.deleted === true,
    ...(typeof data.storagePath === 'string' ? {storagePath: data.storagePath} : {}),
    ...(typeof data.mimeType === 'string' ? {mimeType: data.mimeType} : {}),
    ...(typeof data.sizeBytes === 'number' ? {sizeBytes: data.sizeBytes} : {}),
    ...(typeof data.width === 'number' ? {width: data.width} : {}),
    ...(typeof data.height === 'number' ? {height: data.height} : {}),
    cleanupPending,
  };
}

function imageReference(
  storagePath: string,
  metadata: {storagePath?: unknown; generation?: unknown},
): CatalogImageReference {
  return {
    storagePath,
    generation:
      metadata.storagePath === storagePath && typeof metadata.generation === 'string'
        ? metadata.generation
        : null,
  };
}

function errorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const value = (error as {code?: unknown}).code;
  return typeof value === 'number' ? value : Number(value) || null;
}
