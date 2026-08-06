import {describe, expect, it, vi} from 'vitest';
import {
  deleteCatalogImageWorkflow,
  upsertCatalogImageWorkflow,
  type CatalogImageGateway,
} from './imageWorkflow';

function gateway(overrides: Partial<CatalogImageGateway> = {}): CatalogImageGateway {
  return {
    getCompletedOperation: vi.fn().mockResolvedValue(null),
    readCurrent: vi.fn().mockResolvedValue({
      itemLabel: 'Aceite de prueba',
      current: null,
      revision: null,
    }),
    uploadUnique: vi.fn().mockResolvedValue({generation: '1', created: true}),
    commitUpsert: vi.fn().mockResolvedValue({kind: 'committed'}),
    commitDelete: vi.fn().mockResolvedValue({kind: 'committed', previous: null}),
    deleteExact: vi.fn().mockResolvedValue(undefined),
    markCleanupPending: vi.fn().mockResolvedValue(undefined),
    completeCleanup: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const actor = {uid: 'admin', displayName: 'Admin', email: 'admin@example.test', role: 'admin' as const};
const image = {
  bytes: Buffer.from([1, 2, 3]),
  mimeType: 'image/png' as const,
  extension: 'png' as const,
  sizeBytes: 3,
  width: 1,
  height: 1,
  sha256: 'a'.repeat(64),
  originalFileName: 'image.png',
};

describe('catalog image consistency workflow', () => {
  it('compensates the new object when Firestore fails after upload', async () => {
    const store = gateway({commitUpsert: vi.fn().mockRejectedValue(new Error('firestore'))});
    await expect(
      upsertCatalogImageWorkflow(
        {catalogItemId: 'PROD-1', operationId: 'operation-123', image},
        actor,
        store,
      ),
    ).rejects.toThrow();
    expect(store.deleteExact).toHaveBeenCalledWith(
      'catalog-items/PROD-1/images/operation-123.png',
      '1',
    );
  });

  it('reuses a completed operation without uploading again', async () => {
    const store = gateway({
      getCompletedOperation: vi.fn().mockResolvedValue({
        catalogItemId: 'PROD-1',
        operationId: 'operation-123',
        status: 'ready',
      }),
    });
    await upsertCatalogImageWorkflow(
      {catalogItemId: 'PROD-1', operationId: 'operation-123', image},
      actor,
      store,
    );
    expect(store.uploadUnique).not.toHaveBeenCalled();
    expect(store.commitUpsert).not.toHaveBeenCalled();
  });

  it('keeps the new reference and records pending cleanup when old deletion fails', async () => {
    const store = gateway({
      readCurrent: vi.fn().mockResolvedValue({
        itemLabel: 'Aceite de prueba',
        current: {storagePath: 'catalog-items/PROD-1/images/old.png', generation: '7'},
        revision: '7',
      }),
      deleteExact: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    });
    await upsertCatalogImageWorkflow(
      {catalogItemId: 'PROD-1', operationId: 'operation-123', image},
      actor,
      store,
    );
    expect(store.markCleanupPending).toHaveBeenCalledOnce();
  });

  it('deletes idempotently without accepting a client storage path', async () => {
    const store = gateway();
    const result = await deleteCatalogImageWorkflow(
      {catalogItemId: 'PROD-1', operationId: 'delete-operation-123'},
      actor,
      store,
    );
    expect(result).toMatchObject({deleted: false});
    expect(store.deleteExact).not.toHaveBeenCalled();
  });
});
