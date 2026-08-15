export interface ManualSection {
  title: string;
  summary: string;
  steps: string[];
}

const access: ManualSection = {
  title: 'Acceso y sesión',
  summary: 'Usa tu cuenta individual y confirma que el rol mostrado sea el correcto.',
  steps: [
    'Una cuenta inactiva, pendiente o suspendida no puede operar.',
    'Cierra sesión en equipos compartidos.',
    'Nunca compartas contraseñas ni códigos de recuperación.',
  ],
};

const clients: ManualSection = {
  title: 'Clientes',
  summary: 'Consulta, busca, filtra y pagina los Clientes disponibles para tu alcance.',
  steps: [
    'Los administradores pueden crear, editar y activar o desactivar Clientes.',
    'Los operadores consultan Clientes autorizados y los seleccionan al crear una cotización.',
    'Si no hay coincidencias, revisa la búsqueda, filtros y paginación.',
  ],
};

const catalog: ManualSection = {
  title: 'Catálogo comercial',
  summary: 'Administra o consulta conceptos comerciales activos y agrégalos como partidas.',
  steps: [
    'El administrador puede crear, editar, activar y desactivar conceptos.',
    'El operador consulta conceptos activos y puede filtrarlos.',
    'Cada partida conserva su información al agregarse; desactivar el concepto no cambia partidas históricas.',
  ],
};

const quote: ManualSection = {
  title: 'Cotizaciones',
  summary:
    'Crea borradores, agrega contexto y partidas, revisa Preview y emite cuando corresponda.',
  steps: [
    'Selecciona un Cliente y captura referencia de servicio o contexto técnico cuando aplique.',
    'Agrega partidas del Catálogo comercial o partidas manuales; revisa cantidades, precios, descuentos e IVA.',
    'Guarda el borrador, abre Preview y emite sólo después de revisar los totales.',
    'La emisión genera folio y PDF privado, y bloquea la cotización.',
  ],
};

const corrections: ManualSection = {
  title: 'Correcciones y documentos',
  summary: 'Una corrección crea una nueva revisión sin alterar la cotización emitida.',
  steps: [
    'No desbloquees ni edites el documento original.',
    'Usa Crear corrección desde la cotización autorizada.',
    'La nueva revisión conserva la referencia histórica y recibe su propio folio.',
  ],
};

const errors: ManualSection = {
  title: 'Errores frecuentes',
  summary: 'Resuelve problemas comunes sin exponer datos internos.',
  steps: [
    'Permiso insuficiente: confirma rol, estado activo y alcance.',
    'Registro no encontrado: revisa filtros, búsqueda y paginación.',
    'PDF fallido: conserva el borrador y reintenta la acción autorizada; no dupliques la cotización.',
  ],
};

export const administratorManual: ManualSection[] = [
  access,
  {
    title: 'Inicio',
    summary: 'El Dashboard concentra acciones comerciales y cotizaciones recientes.',
    steps: [
      'Usa accesos rápidos a Clientes, Cotizaciones y Catálogo comercial.',
      'Consulta las cotizaciones recientes y sus estados.',
      'Manual y Soporte están disponibles desde Ayuda.',
    ],
  },
  {
    title: 'Usuarios y permisos',
    summary: 'Administra usuarios dentro de los permisos autorizados.',
    steps: [
      'Crea usuarios con rol Administrador u Operador.',
      'Revisa estados activo, inactivo, pendiente o suspendido.',
      'Desactivar un usuario impide su operación; no concede permisos adicionales.',
    ],
  },
  clients,
  quote,
  catalog,
  {
    title: 'Configuración',
    summary: 'Edita el perfil empresarial y los valores predeterminados de nuevas cotizaciones.',
    steps: [
      'Actualiza sólo los campos autorizados de companyProfile y quoteDefaults desde la pantalla.',
      'La moneda soportada es MXN; valida IVA, vigencia y prefijo antes de guardar.',
      'Los cambios aplican a nuevas operaciones según el contrato vigente; no cambian cotizaciones emitidas ni sus snapshots.',
    ],
  },
  corrections,
  {
    title: 'Estados comerciales',
    summary: 'Sigue el estado de una cotización mediante las acciones permitidas.',
    steps: [
      'Revisa el estado antes de emitir o cambiarlo.',
      'Los estados terminales y documentos emitidos conservan su historial.',
      'Una corrección es la vía para modificar una propuesta emitida.',
    ],
  },
  errors,
];

export const operatorManual: ManualSection[] = [
  access,
  {
    title: 'Inicio',
    summary: 'El Dashboard muestra acciones y cotizaciones dentro de tu alcance.',
    steps: [
      'Usa los accesos rápidos a Clientes, Cotizaciones y Catálogo comercial.',
      'No verás administración de usuarios ni Configuración.',
      'Manual y Soporte están disponibles desde Ayuda.',
    ],
  },
  clients,
  quote,
  catalog,
  corrections,
  {
    title: 'Restricciones del rol',
    summary: 'El Operador trabaja únicamente sobre registros autorizados.',
    steps: [
      'No puede administrar usuarios ni modificar Configuración.',
      'No puede editar cotizaciones emitidas ni cambiar folios.',
      'No puede acceder a módulos retirados ni a registros fuera de su alcance.',
    ],
  },
  errors,
];
