import {useAuth} from '../../app/providers/AuthProvider';
import {PageHeader} from '../../components/PageHeader';

const adminSections = [
  [
    'Usuarios',
    'Crea cuentas internas, asigna únicamente roles admin u operator y controla el estado. Nunca compartas contraseñas.',
  ],
  [
    'Datos maestros',
    'Registra cliente, instalación y equipo antes de abrir una solicitud. Inactiva registros en lugar de borrarlos.',
  ],
  [
    'Solicitudes',
    'Crea, prioriza y asigna solicitudes. Una asignación notifica al operador responsable.',
  ],
  [
    'Cotizaciones',
    'El borrador permite partidas y descuentos. Al emitir se recalculan totales, se genera el folio y se bloquea el documento.',
  ],
  [
    'Correcciones',
    'Una cotización emitida nunca se edita. Crea una corrección, que conserva la relación y recibe un folio nuevo.',
  ],
  [
    'Configuración',
    'Revisa IVA, vigencia, watermark y textos antes de emitir documentos DEV. No inventes datos fiscales.',
  ],
  [
    'Errores',
    'Si el PDF falla, la cotización sigue en draft y conserva su folio. Revisa Actividad y vuelve a intentar.',
  ],
];

const operatorSections = [
  [
    'Mis solicitudes',
    'Abre sólo las solicitudes asignadas. Inícialas antes de preparar la cotización.',
  ],
  [
    'Borradores',
    'Agrega partidas con cantidad, unidad, descripción y precio. Guarda y recarga para verificar persistencia.',
  ],
  [
    'Descuentos',
    'Usa porcentaje o importe fijo. El descuento nunca puede superar el importe de la partida.',
  ],
  [
    'Emisión',
    'Revisa la vista previa y genera el PDF. La cotización queda bloqueada inmediatamente después de una emisión exitosa.',
  ],
  [
    'Historial',
    'Consulta tu actividad y notificaciones. Para corregir una emisión crea una corrección, no alteres el original.',
  ],
  [
    'Errores frecuentes',
    'Si pierdes conexión, reintenta. Si tu perfil está inactivo o suspendido, contacta al administrador.',
  ],
];

export function ManualPage() {
  const {profile} = useAuth();
  const sections = profile?.role === 'admin' ? adminSections : operatorSections;
  return (
    <>
      <PageHeader
        eyebrow="Ayuda operativa"
        title={`Manual de ${profile?.role === 'admin' ? 'administrador' : 'operador'}`}
        description="Guía breve para operar con seguridad y conservar la trazabilidad."
      />
      <section className="manual-grid">
        {sections.map(([title, content], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h2>{title}</h2>
            <p>{content}</p>
          </article>
        ))}
      </section>
    </>
  );
}
