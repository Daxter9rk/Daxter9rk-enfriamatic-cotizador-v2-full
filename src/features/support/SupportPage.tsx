import {useMemo, useState, type FormEvent} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import type {SupportRequest} from '../../models/domain';
import {supportRequestInputSchema} from '../../models/schemas';
import {constraints, createDocument} from '../../services/firebase/data';
import {formatDate} from '../../utils/format';

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
      const input = supportRequestInputSchema.parse({
        category: form.get('category'),
        subject: form.get('subject'),
        description: form.get('description'),
        module: form.get('module'),
        priority: form.get('priority'),
        appVersion: '2.1.0-dev',
        status: 'open',
      });
      await createDocument('supportRequests', input, profile.uid);
      event.currentTarget.reset();
      setMessage('Tu solicitud quedó registrada.');
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
        title="Manual y soporte"
        description="Resuelve dudas o registra un problema con contexto operativo."
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
              <h2>Reportar un problema / Solicitar ayuda</h2>
            </div>
          </div>
          <form className="form-grid" onSubmit={(event) => void submit(event)}>
            <label>
              Categoría
              <select name="category" defaultValue="technical">
                <option value="technical">Problema técnico</option>
                <option value="access">Acceso</option>
                <option value="data">Datos</option>
                <option value="question">Pregunta</option>
              </select>
            </label>
            <label>
              Prioridad declarada
              <select name="priority" defaultValue="normal">
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>
            <label className="field-wide">
              Asunto
              <input name="subject" required minLength={4} maxLength={160} />
            </label>
            <label>
              Módulo
              <input name="module" required maxLength={80} defaultValue="General" />
            </label>
            <label>
              Versión
              <input value="2.1.0-dev" readOnly />
            </label>
            <label className="field-wide">
              Descripción
              <textarea name="description" required minLength={10} maxLength={4000} />
            </label>
            {message && <p className="form-message field-wide">{message}</p>}
            <button className="button button--primary field-wide" disabled={saving}>
              {saving ? 'Enviando…' : 'Registrar solicitud'}
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
  return {open: 'Abierta', in_progress: 'En progreso', resolved: 'Resuelta', closed: 'Cerrada'}[
    status
  ];
}
