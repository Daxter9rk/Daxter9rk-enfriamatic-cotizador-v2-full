import {describe, expect, it, vi} from 'vitest';
import {
  buildPrivateStoragePath,
  runCompensatedUpload,
  sanitizeVisibleFileName,
  validatePrivateFile,
} from './privateFiles';

function file(name: string, type: string, size = 10) {
  return new File([new Uint8Array(size)], name, {type});
}

describe('private file policy', () => {
  it('accepts matching image/PDF pairs and rejects active or mismatched content', () => {
    expect(() => validatePrivateFile(file('foto.jpeg', 'image/jpeg'), 'equipment')).not.toThrow();
    expect(() => validatePrivateFile(file('plano.pdf', 'application/pdf'), 'site')).not.toThrow();
    expect(() =>
      validatePrivateFile(file('foto.pdf', 'application/pdf'), 'equipment', 'photo'),
    ).toThrow(/sólo se permite/);
    expect(() =>
      validatePrivateFile(file('documento.pdf', 'application/pdf'), 'equipment', 'document'),
    ).not.toThrow();
    expect(() => validatePrivateFile(file('vector.svg', 'image/svg+xml'), 'catalog')).toThrow(
      /Formato no permitido/,
    );
    expect(() => validatePrivateFile(file('engaño.png', 'application/pdf'), 'site')).toThrow(
      /extensión/,
    );
    expect(() =>
      validatePrivateFile(file('grande.webp', 'image/webp', 5 * 1024 * 1024 + 1), 'catalog'),
    ).toThrow(/5 MB/);
  });

  it('uses a bounded display name and a non-user-controlled internal path', () => {
    expect(sanitizeVisibleFileName('../ plano\u0000 final.pdf')).toBe('..- plano final.pdf');
    expect(buildPrivateStoragePath('equipment', 'EQ-1', 'uuid_1', 'image/png')).toBe(
      'equipment/EQ-1/uuid_1/uuid_1.png',
    );
  });

  it('compensates metadata when upload fails and object plus metadata when linking fails', async () => {
    const cleanupStorage = vi.fn(() => Promise.resolve());
    const cleanupMetadata = vi.fn(() => Promise.resolve());
    await expect(
      runCompensatedUpload({
        resourceType: 'site',
        resourceId: 'site-1',
        createMetadata: () => Promise.resolve(),
        uploadStorage: () =>
          Promise.reject(Object.assign(new Error('denied'), {code: 'storage/unauthorized'})),
        finalizeLink: () => Promise.resolve(),
        cleanupStorage,
        cleanupMetadata,
        report: vi.fn(),
      }),
    ).rejects.toThrow(/almacenar/);
    expect(cleanupStorage).not.toHaveBeenCalled();
    expect(cleanupMetadata).toHaveBeenCalledOnce();

    cleanupStorage.mockClear();
    cleanupMetadata.mockClear();
    await expect(
      runCompensatedUpload({
        resourceType: 'catalog',
        resourceId: 'CAT-1',
        createMetadata: () => Promise.resolve(),
        uploadStorage: () => Promise.resolve(),
        finalizeLink: () => Promise.reject(new Error('write failed')),
        cleanupStorage,
        cleanupMetadata,
        report: vi.fn(),
      }),
    ).rejects.toThrow(/vincular/);
    expect(cleanupStorage).toHaveBeenCalledOnce();
    expect(cleanupMetadata).toHaveBeenCalledOnce();
  });
});
