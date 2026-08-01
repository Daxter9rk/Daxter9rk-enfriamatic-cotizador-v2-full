export interface ManualSection {
  title: string;
  summary: string;
  steps: string[];
}

export const administratorManual: ManualSection[] = [
  {
    title: 'Acceso seguro',
    summary:
      'Ingresa con tu cuenta individual y confirma que el panel muestre el rol Administrador.',
    steps: [
      'No compartas credenciales ni códigos de recuperación.',
      'Si el perfil aparece inactivo, solicita a otro administrador que revise el estado.',
      'Cierra sesión al terminar en equipos compartidos.',
    ],
  },
  {
    title: 'Usuarios, roles y estados',
    summary: 'Administra cuentas internas mediante las funciones protegidas del sistema.',
    steps: [
      'Crea usuarios con correo corporativo, nombre, rol admin u operator y contraseña temporal robusta.',
      'Usa active, inactive, pending o suspended según corresponda.',
      'No reutilices cuentas ni cambies identidades para pruebas.',
    ],
  },
  {
    title: 'Clientes',
    summary: 'Registra la entidad comercial antes de crear instalaciones o solicitudes.',
    steps: [
      'Captura nombre y datos de contacto válidos.',
      'Usa datos fiscales únicamente cuando estén confirmados.',
      'Inactiva registros que ya no deban usarse; no los borres.',
    ],
  },
  {
    title: 'Instalaciones',
    summary: 'Cada instalación pertenece a un cliente y contiene su ubicación operativa.',
    steps: [
      'Selecciona primero el cliente correcto.',
      'Completa dirección, tipo y contacto de sitio.',
      'Verifica la relación antes de crear equipos.',
    ],
  },
  {
    title: 'Equipos',
    summary: 'Documenta los activos técnicos ligados a cliente e instalación.',
    steps: [
      'Registra categoría, marca, modelo y serie si están disponibles.',
      'No inventes capacidades ni refrigerantes.',
      'Marca retirado o inactivo sin perder el historial.',
    ],
  },
  {
    title: 'Catálogo comercial',
    summary: 'Administra productos y servicios con código único, precio base e IVA.',
    steps: [
      'Crea códigos normalizados que no cambiarán después.',
      'Clasifica como producto o servicio y agrega categoría, unidad, marca y modelo.',
      'Desactiva artículos obsoletos; las cotizaciones previas conservan su snapshot.',
    ],
  },
  {
    title: 'Catálogos genéricos',
    summary:
      'Mantén unidades, prioridades, tipos y textos operativos separados del catálogo comercial.',
    steps: [
      'No agregues productos ni servicios en Catálogos genéricos.',
      'Usa nombres claros y valores estables.',
      'Revisa dependencias antes de inactivar una opción.',
    ],
  },
  {
    title: 'Solicitudes y asignación',
    summary: 'Una cotización siempre nace de una solicitud trazable.',
    steps: [
      'Selecciona cliente, instalación y equipo opcional.',
      'Define prioridad, alcance y operador.',
      'El operador podrá avanzar assigned → in_progress → completed.',
    ],
  },
  {
    title: 'Nueva cotización',
    summary: 'Selecciona una solicitud asignada o en progreso; no existen cotizaciones libres.',
    steps: [
      'Confirma cliente e instalación.',
      'Verifica el equipo cuando aplique.',
      'Crea la cotización: internamente seguirá siendo un borrador.',
    ],
  },
  {
    title: 'Partidas, descuentos e IVA',
    summary: 'Combina artículos del catálogo y partidas manuales sin modificar el origen.',
    steps: [
      'Al agregar del catálogo se copia un snapshot independiente.',
      'Edita cantidad, descripción, precio o descuento sólo dentro de la cotización.',
      'Comprueba subtotal, descuento, IVA predeterminado del 16 % y total en MXN.',
    ],
  },
  {
    title: 'Vista previa, emisión y PDF',
    summary:
      'La emisión recalcula totales, asigna folio, genera el PDF privado y bloquea la cotización.',
    steps: [
      'Revisa cliente, partidas, vigencia y totales en Vista previa.',
      'Emite una sola vez; el proceso es idempotente.',
      'Descarga mediante el botón autorizado, nunca mediante una URL pública.',
    ],
  },
  {
    title: 'Seguimiento comercial',
    summary: 'Registra sent, accepted, rejected o cancelled mediante acciones protegidas.',
    steps: [
      'Administrador u operador asignado puede marcar enviada.',
      'Sólo administrador acepta, rechaza o cancela.',
      'Rechazo y cancelación exigen motivo; los estados terminales no regresan.',
    ],
  },
  {
    title: 'Correcciones',
    summary: 'Nunca desbloquees una cotización emitida.',
    steps: [
      'Abre una cotización emitida o con seguimiento comercial.',
      'Crea la corrección para obtener solicitud y borrador relacionados.',
      'Verifica nuevo folio, revisión y referencia al original.',
    ],
  },
  {
    title: 'Auditoría',
    summary: 'Consulta acciones sensibles, actor, recurso y fecha.',
    steps: [
      'Filtra por actor o evento cuando investigues una incidencia.',
      'No intentes editar registros append-only.',
      'Relaciona quoteId y requestId para reconstruir el flujo.',
    ],
  },
  {
    title: 'Notificaciones',
    summary: 'Revisa asignaciones, emisiones y cambios comerciales.',
    steps: [
      'Abre el panel o Actividad.',
      'Marca como leída sólo después de atenderla.',
      'Confirma el recurso relacionado antes de actuar.',
    ],
  },
  {
    title: 'Configuración',
    summary: 'Mantén perfil de empresa y valores predeterminados de cotización.',
    steps: [
      'Valida moneda MXN, IVA 16 %, vigencia y prefijo.',
      'En DEV conserva la marca de agua de prueba.',
      'No publiques información fiscal no confirmada.',
    ],
  },
  {
    title: 'Errores frecuentes',
    summary: 'Los mensajes visibles evitan exponer detalles técnicos.',
    steps: [
      'Sin solicitud válida: completa cliente, instalación y asignación.',
      'PDF fallido: el borrador permanece editable y puede reintentarse.',
      'Permiso denegado: confirma rol, estado y asignación antes de escalar.',
    ],
  },
  {
    title: 'Recuperación y soporte',
    summary: 'Preserva trazabilidad y usa rollback selectivo.',
    steps: [
      'Registra folio, hora y acción que falló sin compartir secretos.',
      'Revisa Actividad y estado del documento.',
      'Ante una liberación fallida, restaura cada recurso con el procedimiento documentado.',
    ],
  },
];

export const operatorManual: ManualSection[] = [
  {
    title: 'Acceso',
    summary: 'Usa únicamente tu cuenta individual y confirma el rol Operador.',
    steps: [
      'No compartas contraseña.',
      'Si tu cuenta está pendiente, inactiva o suspendida, contacta al administrador.',
      'Cierra sesión en dispositivos compartidos.',
    ],
  },
  {
    title: 'Panel del operador',
    summary: 'El panel muestra sólo asignaciones, borradores y actividad dentro de tu alcance.',
    steps: [
      'Revisa indicadores de asignadas, en progreso, borradores y emitidas.',
      'Prioriza solicitudes urgentes y altas.',
      'Usa los accesos rápidos en móvil.',
    ],
  },
  {
    title: 'Solicitudes asignadas',
    summary: 'Sólo puedes abrir solicitudes asignadas a tu UID.',
    steps: [
      'Verifica cliente, instalación, equipo y alcance.',
      'Inicia la solicitud para cambiar a En progreso.',
      'No trabajes sobre solicitudes de otro operador.',
    ],
  },
  {
    title: 'Clientes, instalaciones y equipos',
    summary: 'Consulta los datos vinculados con tus asignaciones.',
    steps: [
      'Confirma que el cliente y la instalación coincidan.',
      'Revisa placa, marca, modelo y refrigerante del equipo.',
      'Solicita al administrador cualquier corrección de datos maestros.',
    ],
  },
  {
    title: 'Nueva cotización',
    summary: 'Crea una cotización desde una solicitud assigned o in_progress.',
    steps: [
      'Abre Cotizaciones y pulsa Nueva cotización.',
      'Selecciona la solicitud válida.',
      'Si no aparece, inicia la solicitud o pide revisar la asignación.',
    ],
  },
  {
    title: 'Catálogo comercial',
    summary: 'Consulta artículos activos y agrégalos desde el panel lateral o adaptativo.',
    steps: [
      'Busca por código, nombre, marca o modelo.',
      'Filtra productos y servicios.',
      'Un artículo inactivo no puede agregarse a una cotización nueva.',
    ],
  },
  {
    title: 'Partidas de catálogo',
    summary: 'La partida recibe un snapshot y queda separada del catálogo.',
    steps: [
      'Agrega el artículo.',
      'Edita cantidad, descripción, precio o descuento según el trabajo real.',
      'Los cambios no alteran el catálogo ni otras cotizaciones.',
    ],
  },
  {
    title: 'Partidas manuales',
    summary: 'Úsalas cuando el concepto no exista en el catálogo.',
    steps: [
      'Captura unidad, descripción y precio.',
      'Marca si aplica IVA.',
      'Evita duplicar artículos que ya existen.',
    ],
  },
  {
    title: 'Descuentos e IVA',
    summary: 'Aplica porcentaje o monto fijo sin superar el importe de la partida.',
    steps: [
      'Verifica cada descuento.',
      'Confirma IVA del 16 % según la condición de la partida.',
      'Compara el total con la vista previa.',
    ],
  },
  {
    title: 'Vista previa',
    summary: 'Es la última revisión antes del bloqueo.',
    steps: [
      'Comprueba cliente, instalación, conceptos y precios.',
      'Revisa subtotal, descuento, IVA y total MXN.',
      'Corrige el borrador antes de emitir.',
    ],
  },
  {
    title: 'Emisión y descarga',
    summary: 'La emisión genera folio y PDF privado y bloquea cambios económicos.',
    steps: [
      'Pulsa Generar PDF y emitir.',
      'Espera el mensaje de éxito.',
      'Descarga el PDF con el botón autorizado.',
    ],
  },
  {
    title: 'Marcar enviada',
    summary: 'Sólo el operador asignado puede marcar su cotización emitida como enviada.',
    steps: [
      'Confirma que la propuesta realmente fue enviada.',
      'Usa Marcar enviada.',
      'Las decisiones posteriores corresponden al administrador.',
    ],
  },
  {
    title: 'Correcciones',
    summary: 'Corrige mediante una nueva revisión; nunca edites el original.',
    steps: [
      'Abre la cotización emitida.',
      'Pulsa Crear corrección.',
      'Trabaja sobre el nuevo borrador y conserva la referencia.',
    ],
  },
  {
    title: 'Historial y notificaciones',
    summary: 'Consulta tu actividad y avisos relacionados.',
    steps: [
      'Revisa cambios recientes.',
      'Marca notificaciones atendidas como leídas.',
      'Usa folio y solicitud para pedir soporte.',
    ],
  },
  {
    title: 'Errores frecuentes',
    summary: 'Resuelve primero asignación, conectividad y estado.',
    steps: [
      'Solicitud no visible: confirma que está asignada a ti.',
      'Sin permiso: confirma rol activo y recurso dentro de alcance.',
      'PDF fallido: reintenta el borrador; no crees duplicados.',
    ],
  },
  {
    title: 'Restricciones del rol',
    summary:
      'El operador no administra usuarios, configuración, catálogos ni decisiones comerciales.',
    steps: [
      'No puede ver datos fuera de sus asignaciones.',
      'No puede aceptar, rechazar o cancelar cotizaciones.',
      'No puede editar documentos emitidos, auditoría ni archivos privados directamente.',
    ],
  },
];
