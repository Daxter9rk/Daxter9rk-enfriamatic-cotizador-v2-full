import {createHash} from 'node:crypto';
import {HttpsError} from 'firebase-functions/v2/https';
import sharp = require('sharp');

export const MAX_CATALOG_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_CATALOG_IMAGE_PIXELS = 25_000_000;
export const MAX_CATALOG_IMAGE_DIMENSION = 10_000;

export type CatalogImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
export type CatalogImageExtension = 'jpg' | 'png' | 'webp';

export interface ValidatedCatalogImage {
  bytes: Buffer;
  mimeType: CatalogImageMimeType;
  extension: CatalogImageExtension;
  sizeBytes: number;
  width: number;
  height: number;
  sha256: string;
  originalFileName: string;
}

export async function validateCatalogImage(input: {
  bytes: Buffer;
  declaredMimeType: string;
  originalFileName: string;
}): Promise<ValidatedCatalogImage> {
  if (input.bytes.length === 0) {
    throw new HttpsError('invalid-argument', 'The image has no content.', {reason: 'empty'});
  }
  if (input.bytes.length > MAX_CATALOG_IMAGE_BYTES) {
    throw new HttpsError('resource-exhausted', 'The image exceeds five megabytes.', {
      reason: 'too-large',
    });
  }

  const detected = detectImageType(input.bytes);
  if (!detected || detected.mimeType !== input.declaredMimeType) {
    throw new HttpsError('invalid-argument', 'The image type does not match its content.', {
      reason: 'mime-mismatch',
    });
  }

  try {
    const options = {limitInputPixels: MAX_CATALOG_IMAGE_PIXELS, sequentialRead: true};
    const metadata = await sharp(input.bytes, options).metadata();
    const expectedFormat = detected.mimeType === 'image/jpeg' ? 'jpeg' : detected.extension;
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (
      metadata.format !== expectedFormat ||
      (metadata.pages ?? 1) !== 1 ||
      width < 1 ||
      height < 1 ||
      width > MAX_CATALOG_IMAGE_DIMENSION ||
      height > MAX_CATALOG_IMAGE_DIMENSION ||
      width * height > MAX_CATALOG_IMAGE_PIXELS
    ) {
      throw new Error('unsupported image geometry');
    }
    // stats() forces a complete decode and rejects truncated/corrupt payloads.
    await sharp(input.bytes, options).stats();
    return {
      bytes: input.bytes,
      ...detected,
      sizeBytes: input.bytes.length,
      width,
      height,
      sha256: createHash('sha256').update(input.bytes).digest('hex'),
      originalFileName: sanitizeOriginalFileName(input.originalFileName),
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('invalid-argument', 'The image is corrupt or cannot be decoded.', {
      reason: 'corrupt',
    });
  }
}

function detectImageType(bytes: Buffer): {
  mimeType: CatalogImageMimeType;
  extension: CatalogImageExtension;
} | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return {mimeType: 'image/jpeg', extension: 'jpg'};
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return {mimeType: 'image/png', extension: 'png'};
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return {mimeType: 'image/webp', extension: 'webp'};
  }
  return null;
}

function sanitizeOriginalFileName(name: string): string {
  const normalized = Array.from(name.normalize('NFKC'))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || 'imagen').slice(0, 160);
}
