import {useMemo, useState, type FormEvent} from 'react';
import {deleteObject, getBlob, ref, uploadBytes} from 'firebase/storage';
import {useAuth} from '../../app/providers/AuthProvider';
import {Icon} from '../../components/Icon';
import {Modal} from '../../components/Modal';
import {useCollection} from '../../hooks/useCollection';
import type {EquipmentFile, SiteFile} from '../../models/domain';
import {
  constraints,
  deleteDocument,
  setKnownDocument,
  updateDocument,
} from '../../services/firebase/data';
import {storage} from '../../services/firebase/config';
import {formatDate} from '../../utils/format';
import {
  buildPrivateStoragePath,
  normalizeFirebaseErrorCode,
  reportFileDiagnostic,
  runCompensatedUpload,
  sanitizeVisibleFileName,
  validatePrivateFile,
} from '../../utils/privateFiles';

type ManagedFile = SiteFile | EquipmentFile;

export function FileManager({
  entityType,
  entityId,
}: {
  entityType: 'site' | 'equipment';
  entityId: string;
}) {
  const {profile} = useAuth();
  const collectionName = entityType === 'site' ? 'siteFiles' : 'equipmentFiles';
  const idField = entityType === 'site' ? 'siteId' : 'equipmentId';
  const queryConstraints = useMemo(
    () =>
      entityType === 'site' ? [constraints.bySite(entityId)] : [constraints.byEquipment(entityId)],
    [entityId, entityType],
  );
  const files = useCollection<ManagedFile>(collectionName, queryConstraints, 40);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return setMessage('Selecciona un archivo.');
    try {
      validatePrivateFile(file, entityType);
    } catch (error) {
      reportFileDiagnostic({
        stage: 'validation',
        service: 'client',
        errorCode: 'invalid-file',
        resourceType: entityType,
        resourceId: entityId,
      });
      return setMessage(error instanceof Error ? error.message : 'El archivo no es válido.');
    }
    setUploading(true);
    setMessage(null);
    const fileId = crypto.randomUUID();
    const storagePath = buildPrivateStoragePath(entityType, entityId, fileId, file.type);
    const type = String(form.get('type'));
    try {
      await runCompensatedUpload({
        resourceType: entityType,
        resourceId: entityId,
        createMetadata: () =>
          setKnownDocument(
            collectionName,
            fileId,
            {
              [idField]: entityId,
              type,
              storagePath,
              fileName: sanitizeVisibleFileName(file.name),
              mimeType: file.type,
              sizeBytes: file.size,
              description: String(form.get('description') ?? '').trim(),
              ...(entityType === 'site' ? {isPrimary: false} : {}),
              status: 'pending',
            },
            profile.uid,
          ),
        uploadStorage: () =>
          uploadBytes(ref(storage, storagePath), file, {
            contentType: file.type,
            customMetadata: {fileId, entityId, resourceType: entityType},
          }).then(() => undefined),
        finalizeLink: () => updateDocument(collectionName, fileId, {status: 'ready'}, profile.uid),
        cleanupStorage: () => deleteObject(ref(storage, storagePath)),
        cleanupMetadata: () => deleteDocument(collectionName, fileId),
      });
      setUploadOpen(false);
      await files.reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No fue posible subir el archivo. Verifica tus permisos e inténtalo de nuevo.',
      );
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (file: ManagedFile) => {
    if (!profile || ('isPrimary' in file && file.isPrimary)) return;
    setUploading(true);
    setMessage(null);
    try {
      await deleteObject(ref(storage, file.storagePath));
      try {
        await deleteDocument(collectionName, file.id);
      } catch (error) {
        await updateDocument(collectionName, file.id, {status: 'failed'}, profile.uid);
        throw error;
      }
      await files.reload();
    } catch (error) {
      reportFileDiagnostic({
        stage: 'cleanup',
        service: 'storage',
        errorCode: normalizeFirebaseErrorCode(error),
        resourceType: entityType,
        resourceId: entityId,
      });
      setMessage('No fue posible eliminar el archivo de forma consistente. Inténtalo de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const openFile = async (file: ManagedFile, download: boolean) => {
    setMessage(null);
    try {
      const blob = await getBlob(ref(storage, file.storagePath), 10 * 1024 * 1024);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = download ? '_self' : '_blank';
      anchor.rel = 'noopener';
      if (download) anchor.download = file.fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setMessage('No fue posible abrir el archivo o no tienes permiso.');
    }
  };

  const markPrimary = async (file: ManagedFile) => {
    if (!profile || entityType !== 'site') return;
    setUploading(true);
    try {
      await Promise.all([
        updateDocument('siteFiles', file.id, {isPrimary: true}, profile.uid),
        updateDocument('sites', entityId, {primaryPlanFileId: file.id}, profile.uid),
      ]);
      await files.reload();
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="panel entity-section">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Evidencia privada</p>
          <h2>
            {entityType === 'site' ? 'Archivos, croquis y planos' : 'Fotografías y documentos'}
          </h2>
        </div>
        <button className="button button--secondary" onClick={() => setUploadOpen(true)}>
          <Icon name="plus" />
          Subir archivo
        </button>
      </div>
      {message && <p className="form-message form-message--error">{message}</p>}
      {files.data.length === 0 ? (
        <p className="empty-copy">No hay archivos vinculados.</p>
      ) : (
        <div className="file-grid">
          {files.data.map((file) => (
            <article key={file.id}>
              <span className="file-card__icon">
                <Icon name="file" />
              </span>
              <div>
                <strong>{file.fileName}</strong>
                <small>
                  {file.type} · {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
                </small>
                {file.description && <p>{file.description}</p>}
              </div>
              <span className={`badge badge--${file.status}`}>
                {file.status === 'ready'
                  ? 'Disponible'
                  : file.status === 'pending'
                    ? 'Procesando'
                    : 'Falló'}
              </span>
              <div className="button-row">
                <button
                  className="text-button"
                  disabled={file.status !== 'ready'}
                  onClick={() => void openFile(file, false)}
                >
                  Vista previa
                </button>
                <button
                  className="text-button"
                  disabled={file.status !== 'ready'}
                  onClick={() => void openFile(file, true)}
                >
                  Descargar
                </button>
                {entityType === 'site' &&
                  profile?.role === 'admin' &&
                  'isPrimary' in file &&
                  !file.isPrimary &&
                  ['plan', 'sketch'].includes(file.type) && (
                    <button
                      className="text-button"
                      disabled={uploading}
                      onClick={() => void markPrimary(file)}
                    >
                      Marcar principal
                    </button>
                  )}
                {(profile?.role === 'admin' || file.createdBy === profile?.uid) && (
                  <button
                    className="text-button text-button--danger"
                    disabled={uploading || ('isPrimary' in file && file.isPrimary)}
                    title={
                      'isPrimary' in file && file.isPrimary
                        ? 'Cambia primero el archivo principal.'
                        : undefined
                    }
                    onClick={() => void removeFile(file)}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {uploadOpen && (
        <Modal title="Subir archivo privado" onClose={() => setUploadOpen(false)}>
          <form className="form-grid" onSubmit={(event) => void upload(event)}>
            <label>
              Tipo
              <select name="type" defaultValue={entityType === 'site' ? 'photo' : 'photo'}>
                {entityType === 'site' && (
                  <>
                    <option value="plan">Plano</option>
                    <option value="sketch">Croquis</option>
                  </>
                )}
                <option value="photo">Fotografía</option>
                <option value="document">Documento</option>
              </select>
            </label>
            <label className="field-wide">
              Archivo
              <input
                name="file"
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
              />
            </label>
            <label className="field-wide">
              Descripción
              <textarea name="description" maxLength={1000} />
            </label>
            {message && <p className="form-message form-message--error field-wide">{message}</p>}
            <button className="button button--primary field-wide" disabled={uploading}>
              {uploading ? 'Subiendo…' : 'Subir de forma segura'}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}

function formatBytes(value: number) {
  return value < 1024 * 1024
    ? `${Math.ceil(value / 1024)} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
}
