import {useMemo, useState, type FormEvent} from 'react';
import {deleteObject, ref, uploadBytes} from 'firebase/storage';
import {useAuth} from '../../app/providers/AuthProvider';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import type {SupportRequest} from '../../models/domain';
import {supportRequestInputSchema} from '../../models/schemas';
import {
  constraints,
  createDocument,
  reserveDocumentId,
  setKnownDocument,
  updateDocument,
} from '../../services/firebase/data';
import {storage} from '../../services/firebase/config';
import {formatDate} from '../../utils/format';
import {
  buildPrivateStoragePath,
  runCompensatedUpload,
  sanitizeVisibleFileName,
  validatePrivateFile,
} from '../../utils/privateFiles';

const faqs = [
  [
    '¿Cómo corrijo una cotización emitida?',
    'Crea una corrección desde la cotización. El sistema conserva el original y reserva un folio nuevo.',
  ],
  [
    '¿Por qué no puedo editar una solicitud?',
    'Las solicitudes completadas o canceladas están bloqueadas. Un administrador puede reabrir una completada con motivo.',
  ],
  [
    '¿Dónde consulto un plano?',
    'Abre el detalle de la instalación y revisa la sección Archivos y croquis.',
  ],
  [
    '¿La actividad reciente indica quién está en línea?',
    'No. Sólo indica interacción reciente dentro de una ventana aproximada de cinco minutos.',
  ],
];

export function SupportPage() {
  const {profile} = useAuth();
  const queryConstraints = useMemo(
    () => (profile?.role === 'admin' ? [] : profile ? [constraints.createdBy(profile.uid)] : []),
    [profile],
  );
  const requests = useCollection<SupportRequest>('supportRequests', queryConstraints, 30);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      const attachment = form.get('attachment');
      const input = supportRequestInputSchema.parse({
        category: 'technical',
        subject: form.get('intent'),
        description: form.get('outcome'),
        module: form.get('module'),
        priority: form.get('blocked') === 'yes' ? 'high' : 'normal',
        appVersion: '2.1.0-dev',
        status: 'open',
        blocked: form.get('blocked') === 'yes',
        route: window.location.pathname,
        browser: navigator.userAgent.slice(0, 300),
        reporterRole: profile.role,
      });
      if (attachment instanceof File && attachment.size > 0) {
        validatePrivateFile(attachment, 'support');
        const supportId = reserveDocumentId('supportRequests');
        const fileId = crypto.randomUUID();
        const storagePath = buildPrivateStoragePath('support', supportId, fileId, attachment.type);
        await runCompensatedUpload({
          resourceType: 'support',
          resourceId: supportId,
          createMetadata: () =>
            setKnownDocument(
              'supportRequests',
              supportId,
              {
                ...input,
                attachmentStoragePath: storagePath,
                attachmentFileName: sanitizeVisibleFileName(attachment.name),
                attachmentMimeType: attachment.type,
                attachmentSizeBytes: attachment.size,
                attachmentStatus: 'pending',
              },
              profile.uid,
            ),
          uploadStorage: () =>
            uploadBytes(ref(storage, storagePath), attachment, {
              contentType: attachment.type,
              customMetadata: {resourceType: 'support', resourceId: supportId, fileId},
            }).then(() => undefined),
          finalizeLink: () =>
            updateDocument('supportRequests', supportId, {attachmentStatus: 'ready'}, profile.uid),
          cleanupStorage: () => deleteObject(ref(storage, storagePath)),
          cleanupMetadata: () =>
            updateDocument('supportRequests', supportId, {attachmentStatus: 'failed'}, profile.uid),
        });
      } else {
        await createDocument('supportRequests', input, profile.uid);
      }
      event.currentTarget.reset();
      setMessage('Reporte recibido. Puedes consultar su avance en esta página.');
      await requests.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible registrar la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  const copyTechnicalInfo = async () => {
    await navigator.clipboard.writeText(
      `Enfriamatic Cotizador V2.1.0-dev\nMódulo: ${window.location.pathname}\nNavegador: ${navigator.userAgent.split(' ').slice(0, 4).join(' ')}`,
    );
    setMessage('Información técnica no sensible copiada.');
  };

  return (
    <>
      <PageHeader
        eyebrow="Ayuda"
        title="Ayuda y reportes"
        description="Cuéntanos qué ocurrió con palabras sencillas; el contexto técnico se agrega automáticamente."
        actions={
          <button className="button button--secondary" onClick={() => void copyTechnicalInfo()}>
            Copiar información técnica
          </button>
        }
      />
      <div className="support-layout">
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Autoservicio</p>
              <h2>Preguntas frecuentes</h2>
            </div>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Contacto</p>
              <h2>Pedir ayuda o reportar un problema</h2>
            </div>
          </div>
          <form className="form-grid" onSubmit={(event) => void submit(event)}>
            <label className="field-wide">
              ¿Qué intentabas hacer?
              <input name="intent" required minLength={4} maxLength={160} />
            </label>
            <label>
              ¿En qué sección ocurrió?
              <select name="module" defaultValue="General">
                <option>General</option>
                <option>Inicio</option>
                <option>Solicitudes</option>
                <option>Cotizaciones</option>
                <option>Instalaciones</option>
                <option>Equipos</option>
                <option>Configuración</option>
              </select>
            </label>
            <label>
              ¿Esto te impide continuar?
              <select name="blocked" defaultValue="no">
                <option value="no">No</option>
                <option value="yes">Sí</option>
              </select>
            </label>
            <label className="field-wide">
              ¿Qué ocurrió?
              <textarea name="outcome" required minLength={10} maxLength={4000} />
            </label>
            <label className="field-wide">
              ¿Quieres agregar una captura? (JPG, PNG o WebP; máximo 5 MB)
              <input name="attachment" type="file" accept="image/jpeg,image/png,image/webp" />
            </label>
            <p className="form-message field-wide">No incluyas contraseñas ni datos bancarios.</p>
            {message && <p className="form-message field-wide">{message}</p>}
            <button className="button button--primary field-wide" disabled={saving}>
              {saving ? 'Enviando…' : 'Enviar reporte'}
            </button>
          </form>
        </section>
      </div>
      <section className="panel support-history">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Seguimiento</p>
            <h2>{profile?.role === 'admin' ? 'Solicitudes recientes' : 'Mis solicitudes'}</h2>
          </div>
        </div>
        {requests.error ? (
          <StatePanel kind="error" title="No fue posible consultar soporte" />
        ) : requests.data.length === 0 ? (
          <p className="empty-copy">Aún no hay solicitudes registradas.</p>
        ) : (
          <div className="stack-list">
            {requests.data.map((item) => (
              <div className="stack-row" key={item.id}>
                <div>
                  <strong>{item.subject}</strong>
                  <span>
                    {item.module} · {statusLabel(item.status)} · {formatDate(item.createdAt)}
                  </span>
                </div>
                <span className={`badge badge--${item.status}`}>{statusLabel(item.status)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function statusLabel(status: SupportRequest['status']) {
  return {
    open: 'Reporte recibido',
    in_progress: 'En revisión',
    needs_information: 'Necesitamos más información',
    resolved: 'Resuelto',
    closed: 'Resuelto',
  }[status];
}
