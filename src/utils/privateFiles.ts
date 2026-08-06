export type PrivateFileResource = 'site' | 'equipment' | 'catalog' | 'support';
export type FileOperationStage =
  | 'validation'
  | 'metadata-create'
  | 'storage-upload'
  | 'entity-link'
  | 'cleanup';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const technicalTypes = [...imageTypes, 'application/pdf'] as const;
const extensionsByMime: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
};

export const PRIVATE_FILE_LIMITS = {
  site: {maxBytes: 10 * 1024 * 1024, mimeTypes: technicalTypes},
  equipment: {maxBytes: 10 * 1024 * 1024, mimeTypes: technicalTypes},
  catalog: {maxBytes: 5 * 1024 * 1024, mimeTypes: imageTypes},
  support: {maxBytes: 5 * 1024 * 1024, mimeTypes: imageTypes},
} as const;

export interface FileDiagnostic {
  stage: FileOperationStage;
  service: 'client' | 'storage' | 'firestore' | 'function';
  errorCode: string;
  resourceType: PrivateFileResource;
  resourceId: string;
}

export class PrivateFileError extends Error {
  constructor(
    message: string,
    public readonly diagnostic: FileDiagnostic,
  ) {
    super(message);
    this.name = 'PrivateFileError';
  }
}

export function sanitizeVisibleFileName(name: string): string {
  const withoutControlCharacters = Array.from(name.normalize('NFKC'))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
  const cleaned = withoutControlCharacters
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'archivo').slice(0, 160);
}

export function validatePrivateFile(
  file: File,
  resourceType: PrivateFileResource,
  category?: string,
): void {
  const specification = PRIVATE_FILE_LIMITS[resourceType];
  const extension = file.name.split('.').pop()?.toLocaleLowerCase('en-US') ?? '';
  const allowedExtensions = extensionsByMime[file.type] ?? [];
  if (file.size <= 0) throw new Error('Selecciona un archivo con contenido.');
  if (!(specification.mimeTypes as readonly string[]).includes(file.type)) {
    throw new Error(
      resourceType === 'site' || resourceType === 'equipment'
        ? 'Formato no permitido. Usa JPG, JPEG, PNG, WebP o PDF.'
        : 'Formato no permitido. Usa JPG, JPEG, PNG o WebP.',
    );
  }
  if (!allowedExtensions.includes(extension)) {
    throw new Error('La extensión del archivo no coincide con su tipo permitido.');
  }
  if (
    file.type === 'application/pdf' &&
    category !== undefined &&
    !['document', 'plan', 'sketch'].includes(category)
  ) {
    throw new Error('El formato PDF sólo se permite como documento, plano o croquis.');
  }
  if (file.size > specification.maxBytes) {
    throw new Error(`El archivo supera el límite de ${specification.maxBytes / 1024 / 1024} MB.`);
  }
}

export function buildPrivateStoragePath(
  resourceType: PrivateFileResource,
  resourceId: string,
  fileId: string,
  mimeType: string,
): string {
  const extension = extensionsByMime[mimeType]?.[0];
  if (!extension || !/^[A-Za-z0-9_-]{1,128}$/.test(resourceId)) {
    throw new Error('No fue posible construir una ruta segura para el archivo.');
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(fileId)) {
    throw new Error('El identificador interno del archivo no es válido.');
  }
  const root =
    resourceType === 'site' ? 'sites' : resourceType === 'equipment' ? 'equipment' : resourceType;
  return `${root}/${resourceId}/${fileId}/${fileId}.${extension}`;
}

export function normalizeFirebaseErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as {code?: unknown}).code ?? 'unknown').slice(0, 80);
  }
  return 'unknown';
}

export function reportFileDiagnostic(diagnostic: FileDiagnostic): void {
  // Deliberately bounded: no File, payload, URL, token, credential or user-provided name.
  console.warn('private-file-operation', diagnostic);
}

export async function runCompensatedUpload(input: {
  resourceType: PrivateFileResource;
  resourceId: string;
  createMetadata(): Promise<void>;
  uploadStorage(): Promise<void>;
  finalizeLink(): Promise<void>;
  cleanupStorage(): Promise<void>;
  cleanupMetadata(): Promise<void>;
  report?: (diagnostic: FileDiagnostic) => void;
}): Promise<void> {
  const report = input.report ?? reportFileDiagnostic;
  let stage: FileOperationStage = 'metadata-create';
  let metadataCreated = false;
  let objectUploaded = false;
  try {
    await input.createMetadata();
    metadataCreated = true;
    stage = 'storage-upload';
    await input.uploadStorage();
    objectUploaded = true;
    stage = 'entity-link';
    await input.finalizeLink();
  } catch (error) {
    const service = stage === 'storage-upload' ? 'storage' : 'firestore';
    const diagnostic: FileDiagnostic = {
      stage,
      service,
      errorCode: normalizeFirebaseErrorCode(error),
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    };
    report(diagnostic);
    if (objectUploaded) {
      try {
        await input.cleanupStorage();
      } catch (cleanupError) {
        report({
          ...diagnostic,
          stage: 'cleanup',
          service: 'storage',
          errorCode: normalizeFirebaseErrorCode(cleanupError),
        });
      }
    }
    if (metadataCreated) {
      try {
        await input.cleanupMetadata();
      } catch (cleanupError) {
        report({
          ...diagnostic,
          stage: 'cleanup',
          service: 'firestore',
          errorCode: normalizeFirebaseErrorCode(cleanupError),
        });
      }
    }
    throw new PrivateFileError(
      stage === 'storage-upload'
        ? 'No fue posible almacenar el archivo. Vuelve a intentarlo.'
        : stage === 'metadata-create'
          ? 'No fue posible preparar el archivo. Vuelve a intentarlo.'
          : 'No fue posible vincular el archivo. Vuelve a intentarlo.',
      diagnostic,
    );
  }
}
