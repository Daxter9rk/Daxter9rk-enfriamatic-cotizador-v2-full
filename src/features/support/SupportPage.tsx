import {useState, type FormEvent} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import {PageHeader} from '../../components/PageHeader';
import {supportRequestInputSchema} from '../../models/schemas';

const faqs = [
  [
    '¿Cómo creo una cotización?',
    'Abre Cotizaciones, inicia una cotización nueva, selecciona un Cliente, agrega contexto y partidas, guarda el borrador y revisa Preview antes de emitir.',
  ],
  [
    '¿Por qué no puedo editar una cotización emitida?',
    'La emisión conserva el documento y su PDF. Para cambiarlo debes crear una corrección, que genera una nueva revisión sin alterar el original.',
  ],
  [
    '¿Qué hago si no encuentro un registro?',
    'Revisa los filtros, la búsqueda y la paginación. Los operadores sólo ven registros dentro de su alcance autorizado.',
  ],
  [
    '¿Por qué no puedo acceder a una sección?',
    'La navegación depende de tu rol y estado. Configuración y Usuarios son funciones administrativas; los módulos retirados no forman parte del MVP activo.',
  ],
  [
    '¿Cómo genero nuevamente un PDF fallido?',
    'Abre el borrador o la cotización con el estado visible, corrige el problema indicado y utiliza la acción autorizada de emisión o descarga. No crees duplicados.',
  ],
];

const modules = [
  'General',
  'Inicio',
  'Clientes',
  'Cotizaciones',
  'Catálogo comercial',
  'Configuración',
];

export function SupportPage() {
  const {profile} = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      supportRequestInputSchema.parse({
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
      event.currentTarget.reset();
      setMessage(
        'La solicitud fue validada en modo demostración. No se envió información a un servicio externo.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Revisa los campos obligatorios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Ayuda"
        title="Centro de ayuda y soporte"
        description="Encuentra respuestas breves o valida una solicitud de soporte en el entorno de demostración."
      />
      <section className="panel support-demo-notice" aria-label="Modo demostración">
        <p className="eyebrow">Modo demostración</p>
        <strong>No envía correos ni crea tickets externos.</strong>
        <p>
          El formulario sólo valida los datos en esta pantalla y no solicita contraseñas, tokens ni
          información bancaria.
        </p>
      </section>
      <div className="support-layout">
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Preguntas frecuentes</p>
              <h2>Ayuda rápida</h2>
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
          <a className="button button--secondary" href="/manual">
            Abrir manual de mi perfil
          </a>
        </section>
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Soporte simulado</p>
              <h2>Describir un problema</h2>
            </div>
          </div>
          <form className="form-grid" onSubmit={submit}>
            <label className="field-wide">
              ¿Qué intentabas hacer?
              <input name="intent" required minLength={4} maxLength={160} />
            </label>
            <label>
              ¿En qué sección ocurrió?
              <select name="module" defaultValue="General">
                {modules.map((module) => (
                  <option key={module}>{module}</option>
                ))}
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
            <p className="form-message field-wide">
              No incluyas contraseñas, tokens, datos bancarios ni otros secretos.
            </p>
            {message && (
              <p className="form-message field-wide" role="status">
                {message}
              </p>
            )}
            <button className="button button--primary field-wide" disabled={saving}>
              {saving ? 'Validando…' : 'Validar solicitud'}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
