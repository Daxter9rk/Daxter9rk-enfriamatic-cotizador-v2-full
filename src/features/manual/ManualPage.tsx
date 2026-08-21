import {useAuth} from '../../app/providers/AuthProvider';
import {PageHeader} from '../../components/PageHeader';

const manuals = [
  {
    key: 'administrador',
    title: 'Manual del administrador',
    description: 'Gestión de clientes, catálogo, usuarios, cotizaciones y configuración.',
    audience: 'Administrador',
    file: '/manuales/manual-administrador-v2.1.pdf',
  },
  {
    key: 'operador',
    title: 'Manual del operador',
    description: 'Operación diaria de cotizaciones, catálogo de consulta y documentos PDF.',
    audience: 'Operador',
    file: '/manuales/manual-operador-v2.1.pdf',
  },
  {
    key: 'general',
    title: 'Manual general de la plataforma',
    description: 'Conceptos comunes, sesión, flujo comercial y buenas prácticas de V2.1.',
    audience: 'Todos los perfiles',
    file: '/manuales/manual-general-enfriamatic-v2-1.pdf',
  },
] as const;

export function ManualPage() {
  const {profile} = useAuth();
  const visibleManuals =
    profile?.role === 'admin'
      ? manuals
      : manuals.filter((manual) => manual.key !== 'administrador');
  return (
    <>
      <PageHeader
        eyebrow="Ayuda operativa"
        title="Biblioteca de manuales"
        description="Documentación vigente de Enfriamatic Cotizador V2.1."
      />
      <section className="manual-library" aria-label="Manuales disponibles">
        {visibleManuals.map((manual) => (
          <article className="manual-card" key={manual.key}>
            <div className="manual-card__cover" aria-hidden="true">
              V2.1
            </div>
            <div className="manual-card__body">
              <p className="eyebrow">{manual.audience}</p>
              <h2>{manual.title}</h2>
              <p>{manual.description}</p>
              <dl>
                <div>
                  <dt>Versión</dt>
                  <dd>V2.1</dd>
                </div>
                <div>
                  <dt>Actualización</dt>
                  <dd>Agosto 2026</dd>
                </div>
              </dl>
              <div className="button-row">
                <a
                  className="button button--primary"
                  href={manual.file}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver manual
                </a>
                <a className="button button--ghost" href={manual.file} download>
                  Descargar PDF
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>
      <p className="form-hint">Sesión activa: {profile?.displayName ?? 'Usuario autenticado'}</p>
    </>
  );
}
