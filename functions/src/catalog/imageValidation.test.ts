import sharp from 'sharp';
import {beforeAll, describe, expect, it} from 'vitest';
import {MAX_CATALOG_IMAGE_BYTES, validateCatalogImage} from './imageValidation';

const images: Record<'image/jpeg' | 'image/png' | 'image/webp', Buffer> = {
  'image/jpeg': Buffer.alloc(0),
  'image/png': Buffer.alloc(0),
  'image/webp': Buffer.alloc(0),
};

beforeAll(async () => {
  const source = {create: {width: 3, height: 2, channels: 4 as const, background: '#1261d8'}};
  images['image/jpeg'] = await sharp(source).jpeg().toBuffer();
  images['image/png'] = await sharp(source).png().toBuffer();
  images['image/webp'] = await sharp(source).webp().toBuffer();
});

describe('catalog image validation', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ] as const)('accepts structurally valid %s bytes', async (mimeType, extension) => {
    const result = await validateCatalogImage({
      bytes: images[mimeType],
      declaredMimeType: mimeType,
      originalFileName: `catalog.${extension}`,
    });

    expect(result).toMatchObject({mimeType, extension, width: 3, height: 2});
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects a false declared MIME type', async () => {
    await expect(
      validateCatalogImage({
        bytes: images['image/png'],
        declaredMimeType: 'image/jpeg',
        originalFileName: 'false.jpg',
      }),
    ).rejects.toMatchObject({code: 'invalid-argument'});
  });

  it('rejects non-image and truncated content', async () => {
    await expect(
      validateCatalogImage({
        bytes: Buffer.from('not-an-image'),
        declaredMimeType: 'image/jpeg',
        originalFileName: 'fake.jpg',
      }),
    ).rejects.toMatchObject({code: 'invalid-argument'});
    await expect(
      validateCatalogImage({
        bytes: images['image/png'].subarray(0, 20),
        declaredMimeType: 'image/png',
        originalFileName: 'truncated.png',
      }),
    ).rejects.toMatchObject({code: 'invalid-argument'});
  });

  it('rejects bytes above the real five-megabyte limit', async () => {
    await expect(
      validateCatalogImage({
        bytes: Buffer.alloc(MAX_CATALOG_IMAGE_BYTES + 1),
        declaredMimeType: 'image/png',
        originalFileName: 'large.png',
      }),
    ).rejects.toMatchObject({code: 'resource-exhausted'});
  });
});
