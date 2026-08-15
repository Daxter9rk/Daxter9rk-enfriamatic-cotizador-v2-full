import {callFunction} from './data';
import {validatePrivateFile} from '../../utils/privateFiles';

interface CatalogImageMutationResponse {
  catalogItemId: string;
  operationId: string;
  status: 'ready' | 'deleted';
  deleted?: boolean;
  cleanupPending?: {storagePath: string; generation: string | null} | null;
}

interface CatalogImageContentResponse {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  width: number;
  height: number;
  generation: string;
}

export async function upsertCatalogImage(
  catalogItemId: string,
  file: File,
  operationId = crypto.randomUUID(),
): Promise<CatalogImageMutationResponse> {
  validatePrivateFile(file, 'catalog');
  const base64 = await fileToBase64(file);
  return callFunction('upsertCatalogImage', {
    catalogItemId,
    operationId,
    base64,
    originalFileName: file.name,
    declaredMimeType: file.type,
  });
}

export async function deleteCatalogImage(
  catalogItemId: string,
  operationId = crypto.randomUUID(),
): Promise<CatalogImageMutationResponse> {
  return callFunction('deleteCatalogImage', {catalogItemId, operationId});
}

export async function getCatalogImageBlob(catalogItemId: string): Promise<Blob> {
  const response = await callFunction<{catalogItemId: string}, CatalogImageContentResponse>(
    'getCatalogImageContent',
    {catalogItemId},
  );
  const binary = atob(response.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  try {
    return new Blob([bytes], {type: response.mimeType});
  } finally {
    bytes.fill(0);
  }
}

export function catalogImageErrorMessage(error: unknown): string {
  const code = errorCode(error);
  const reason = errorReason(error);
  if (code === 'functions/unauthenticated') return 'Tu sesión expiró. Inicia sesión nuevamente.';
  if (code === 'functions/permission-denied') {
    if (reason === 'inactive') return 'Tu cuenta está inactiva y no puede modificar imágenes.';
    if (reason === 'missing-profile') return 'Tu perfil no está configurado para esta operación.';
    return 'No tienes permiso para modificar imágenes del catálogo.';
  }
  if (code === 'functions/resource-exhausted') {
    return 'La imagen supera el tamaño máximo permitido de 5 MB.';
  }
  if (code === 'functions/invalid-argument') {
    if (reason === 'mime-mismatch') return 'El formato declarado no coincide con la imagen.';
    if (reason === 'corrupt') return 'La imagen está dañada, incompleta o no puede procesarse.';
    return 'La imagen no es válida. Usa JPG, PNG o WebP.';
  }
  if (code === 'functions/not-found') return 'El artículo o su imagen ya no existen.';
  if (code === 'functions/aborted' || code === 'functions/already-exists') {
    return 'La imagen cambió durante la operación. Actualiza el catálogo e inténtalo de nuevo.';
  }
  if (code === 'functions/unavailable') {
    return reason === 'article-update'
      ? 'La imagen se almacenó temporalmente, pero no fue posible actualizar el artículo.'
      : 'El almacenamiento no está disponible temporalmente. Vuelve a intentarlo.';
  }
  return 'No fue posible completar la operación de imagen. Vuelve a intentarlo.';
}

export function catalogImageTechnicalCode(error: unknown): string {
  return errorCode(error).slice(0, 80) || 'unknown';
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
    }
    return btoa(chunks.join(''));
  } finally {
    bytes.fill(0);
  }
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as {code?: unknown}).code ?? '')
    : '';
}

function errorReason(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const direct = 'details' in error ? (error as {details?: unknown}).details : undefined;
  const custom =
    'customData' in error
      ? (error as {customData?: {details?: unknown}}).customData?.details
      : undefined;
  const details = (direct ?? custom) as {reason?: unknown} | undefined;
  return typeof details?.reason === 'string' ? details.reason : '';
}
