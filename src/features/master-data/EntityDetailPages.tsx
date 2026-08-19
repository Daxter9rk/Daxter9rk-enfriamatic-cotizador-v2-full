import {useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {Link} from 'wouter';
import {useAuth} from '../../app/providers/AuthProvider';
import {Icon} from '../../components/Icon';
import {Modal} from '../../components/Modal';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import type {
  Client,
  Equipment,
  EquipmentIntervention,
  Quote,
  ServiceRequest,
  Site,
} from '../../models/domain';
import {equipmentInterventionInputSchema} from '../../models/schemas';
import {
  constraints,
  createDocument,
  deleteClient,
  getDocument,
  updateDocument,
  type DeleteClientResult,
} from '../../services/firebase/data';
import {formatDate} from '../../utils/format';
import {FileManager} from './FileManager';

type DeleteClientDialogState =
  | 'confirm'
  | 'checking'
  | 'has_dependencies'
  | 'deactivating'
  | 'error';

export function ClientDetailPage({clientId}: {clientId: string}) {
  const {profile} = useAuth();
  const client = useDocument<Client>('clients', clientId);
  const related = useMemo(() => [constraints.byClient(clientId)], [clientId]);
  const sites = useCollection<Site>('sites', related, 50);
  const equipment = useCollection<Equipment>('equipment', related, 50);
  const requests = useCollection<ServiceRequest>('requests', related, 50);
  const quotes = useCollection<Quote>('quotes', related, 50);
  const [dialog, setDialog] = useState<DeleteClientDialogState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  const closeDialog = () => {
    if (dialog !== 'checking' && dialog !== 'deactivating') {
      setDialog(null);
      setActionError(null);
    }
  };

  const removeClient = async () => {
    if (!client.data || dialog === 'checking' || dialog === 'deactivating') return;
    setDialog('checking');
    setActionError(null);
    try {
      const result: DeleteClientResult = await deleteClient(client.data.id);
      if (result.outcome === 'has_dependencies') {
        setDialog('has_dependencies');
      } else {
        setDialog(null);
        setActionNotice(
          result.outcome === 'already_deleted'
            ? 'El cliente ya no existe.'
            : 'Cliente eliminado permanentemente.',
        );
        await client.reload();
      }
    } catch (error) {
      setDialog('error');
      setActionError(formatClientActionError(error));
    }
  };

  const deactivateClient = async () => {
    if (!client.data || !profile || dialog === 'checking' || dialog === 'deactivating') return;
    setDialog('deactivating');
    setActionError(null);
    try {
      await updateDocument('clients', client.data.id, {status: 'inactive'}, profile.uid);
      setDialog(null);
      setActionNotice('Cliente desactivado. Ya no aparecerá en nuevas cotizaciones.');
      await client.reload();
    } catch (error) {
      setDialog('error');
      setActionError(formatClientActionError(error));
    }
  };

  if (client.loading) return <StatePanel kind="loading" title="Cargando cliente…" />;
  if (client.error || !client.data)
    return (
      <StatePanel kind="error" title="No fue posible abrir el cliente">
        <p>{client.error ?? 'El registro no existe o no tienes permiso.'}</p>
      </StatePanel>
    );
  const address = client.data.billingAddress ? formatAddress(client.data.billingAddress) : null;
  return (
    <>
      <PageHeader
        eyebrow="Cliente · Vista 360°"
        title={client.data.name}
        description="Información administrativa y relaciones operativas conectadas."
        actions={
          <Link className="button button--ghost" href="/clients">
            Volver a clientes
          </Link>
        }
      />
      <div className="entity-overview">
        <section className="panel entity-summary">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Información general</p>
              <h2>Perfil del cliente</h2>
            </div>
            <span className={`badge badge--${client.data.status}`}>
              {client.data.status === 'active' ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <DefinitionList
            items={[
              ['Razón social', client.data.legalName],
              ['RFC', client.data.rfc],
              ['Contacto', client.data.contactName],
              ['Correo', client.data.email],
              ['Teléfono', client.data.phone],
            ]}
          />
        </section>
        <section className="panel entity-summary">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Dirección administrativa / fiscal</p>
              <h2>{address ?? 'Sin dirección registrada'}</h2>
            </div>
          </div>
          {address && <AddressActions address={address} />}
          {client.data.notes && <p className="entity-notes">{client.data.notes}</p>}
        </section>
      </div>
      <RelatedEntities
        sites={sites.data}
        equipment={equipment.data}
        requests={requests.data}
        quotes={quotes.data}
      />
      {actionNotice && <p className="form-message form-message--success">{actionNotice}</p>}
      {profile?.role === 'admin' && (
        <section className="panel danger-zone" aria-label="Acciones administrativas">
          <div>
            <p className="eyebrow">Zona de peligro</p>
            <h2>Eliminar cliente</h2>
            <p>
              La eliminación permanente sólo está disponible cuando no existe historial relacionado.
            </p>
          </div>
          <button
            className="button button--danger"
            onClick={() => {
              setActionError(null);
              setDialog('confirm');
            }}
            disabled={client.data.status !== 'active' && dialog !== null}
          >
            Eliminar cliente
          </button>
        </section>
      )}
      {dialog && (
        <Modal
          title={
            dialog === 'has_dependencies'
              ? 'Cliente con historial'
              : dialog === 'checking'
                ? 'Comprobando dependencias'
                : dialog === 'deactivating'
                  ? 'Desactivando cliente'
                  : 'Eliminar cliente'
          }
          onClose={closeDialog}
          initialFocusRef={cancelDeleteRef}
        >
          {dialog === 'has_dependencies' ? (
            <div className="stacked-form">
              <p>Este cliente tiene historial relacionado y no puede eliminarse permanentemente.</p>
              <p>
                Puedes desactivarlo para impedir su uso en nuevas cotizaciones sin perder su
                historial.
              </p>
              <div className="form-actions">
                <button
                  ref={cancelDeleteRef}
                  className="button button--ghost"
                  onClick={closeDialog}
                >
                  Cancelar
                </button>
                {client.data.status === 'active' && (
                  <button className="button button--danger" onClick={() => void deactivateClient()}>
                    Desactivar cliente
                  </button>
                )}
              </div>
            </div>
          ) : dialog === 'checking' ? (
            <div className="stacked-form" role="status">
              <p>Estamos verificando si existen cotizaciones o historial relacionado.</p>
            </div>
          ) : dialog === 'deactivating' ? (
            <div className="stacked-form" role="status">
              <p>Actualizando el estado del cliente…</p>
            </div>
          ) : dialog === 'confirm' || dialog === 'error' ? (
            <div className="stacked-form">
              <p>
                Se eliminará permanentemente <strong>“{client.data.name}”</strong>. Esta acción no
                puede deshacerse.
              </p>
              {actionError && <p className="form-message form-message--error">{actionError}</p>}
              <div className="form-actions">
                <button
                  ref={cancelDeleteRef}
                  className="button button--ghost"
                  onClick={closeDialog}
                >
                  Cancelar
                </button>
                <button className="button button--danger" onClick={() => void removeClient()}>
                  Eliminar cliente
                </button>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </>
  );
}

export function SiteDetailPage({siteId}: {siteId: string}) {
  const site = useDocument<Site>('sites', siteId);
  const siteConstraints = useMemo(() => [constraints.bySite(siteId)], [siteId]);
  const equipment = useCollection<Equipment>('equipment', siteConstraints, 50);
  const requests = useCollection<ServiceRequest>('requests', siteConstraints, 50);
  const quotes = useCollection<Quote>('quotes', siteConstraints, 50);
  const client = useDocument<Client>(
    'clients',
    site.data?.clientId ?? '',
    Boolean(site.data?.clientId),
  );
  if (site.loading) return <StatePanel kind="loading" title="Cargando instalación…" />;
  if (site.error || !site.data)
    return (
      <StatePanel kind="error" title="No fue posible abrir la instalación">
        <p>{site.error ?? 'El registro no existe o no tienes permiso.'}</p>
      </StatePanel>
    );
  const address = formatAddress(site.data.address);
  return (
    <>
      <PageHeader
        eyebrow="Instalación · Detalle operativo"
        title={site.data.name}
        description={
          client.data
            ? `Cliente: ${client.data.name}`
            : 'Ubicación operativa y trazabilidad relacionada.'
        }
        actions={
          <div className="button-row">
            <Link className="button button--ghost" href="/sites">
              Volver
            </Link>
            {client.data && (
              <Link className="button button--secondary" href={`/clients/${client.data.id}`}>
                Abrir cliente
              </Link>
            )}
          </div>
        }
      />
      <div className="entity-overview entity-overview--site">
        <section className="panel entity-summary">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Ubicación</p>
              <h2>{address}</h2>
            </div>
            <span className={`badge badge--${site.data.status}`}>
              {site.data.status === 'active' ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          <AddressActions address={address} />
          {site.data.latitude != null && site.data.longitude != null && (
            <p className="coordinate-copy">
              Coordenadas: {site.data.latitude}, {site.data.longitude}
            </p>
          )}
        </section>
        <section className="panel entity-summary">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Acceso</p>
              <h2>Contacto y referencias</h2>
            </div>
          </div>
          <DefinitionList
            items={[
              ['Contacto', site.data.contactName],
              ['Teléfono', site.data.contactPhone],
              ['Horario', site.data.accessSchedule],
              ['Indicaciones', site.data.accessInstructions],
            ]}
          />
        </section>
      </div>
      <FileManager entityType="site" entityId={siteId} />
      <RelatedEntities equipment={equipment.data} requests={requests.data} quotes={quotes.data} />
    </>
  );
}

export function EquipmentDetailPage({equipmentId}: {equipmentId: string}) {
  const {profile} = useAuth();
  const equipment = useDocument<Equipment>('equipment', equipmentId);
  const equipmentConstraints = useMemo(() => [constraints.byEquipment(equipmentId)], [equipmentId]);
  const requests = useCollection<ServiceRequest>('requests', equipmentConstraints, 50);
  const quotes = useCollection<Quote>('quotes', equipmentConstraints, 50);
  const interventions = useCollection<EquipmentIntervention>(
    'equipmentInterventions',
    equipmentConstraints,
    50,
  );
  const site = useDocument<Site>(
    'sites',
    equipment.data?.siteId ?? '',
    Boolean(equipment.data?.siteId),
  );
  const client = useDocument<Client>(
    'clients',
    equipment.data?.clientId ?? '',
    Boolean(equipment.data?.clientId),
  );
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (equipment.loading) return <StatePanel kind="loading" title="Cargando expediente técnico…" />;
  if (equipment.error || !equipment.data)
    return (
      <StatePanel kind="error" title="No fue posible abrir el equipo">
        <p>{equipment.error ?? 'El registro no existe o no tienes permiso.'}</p>
      </StatePanel>
    );

  const addIntervention = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !equipment.data) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const split = (name: string) =>
        String(form.get(name) ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      const input = equipmentInterventionInputSchema.parse({
        equipmentId,
        siteId: equipment.data.siteId,
        requestId: String(form.get('requestId') ?? '') || null,
        interventionType: form.get('interventionType'),
        diagnosis: form.get('diagnosis'),
        actions: form.get('actions'),
        partsUsed: split('partsUsed'),
        partsRecommended: split('partsRecommended'),
        resultingStatus: form.get('resultingStatus'),
        notes: form.get('notes'),
        responsibleName: profile.displayName,
        responsibleRole: profile.role,
      });
      await createDocument('equipmentInterventions', input, profile.uid);
      setAdding(false);
      await interventions.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible guardar la intervención.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Equipo · Expediente técnico"
        title={equipment.data.name}
        description={[client.data?.name, site.data?.name].filter(Boolean).join(' · ')}
        actions={
          <div className="button-row">
            <Link className="button button--ghost" href="/equipment">
              Volver
            </Link>
            <button className="button button--primary" onClick={() => setAdding(true)}>
              Registrar intervención
            </button>
            {profile?.role === 'admin' && (
              <Link className="button button--secondary" href={`/equipment?edit=${equipmentId}`}>
                Editar datos del equipo
              </Link>
            )}
          </div>
        }
      />
      <div className="entity-overview">
        <section className="panel entity-summary">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Ficha técnica</p>
              <h2>{equipment.data.category}</h2>
            </div>
            <span className={`badge badge--${equipment.data.status}`}>
              {equipment.data.status === 'active'
                ? 'Activo'
                : equipment.data.status === 'retired'
                  ? 'Retirado'
                  : 'Inactivo'}
            </span>
          </div>
          <DefinitionList
            items={[
              ['Marca', equipment.data.brand],
              ['Modelo', equipment.data.model],
              ['Serie', equipment.data.serialNumber],
              ['Capacidad', equipment.data.capacity],
              ['Refrigerante', equipment.data.refrigerant],
              ['Ubicación interna', equipment.data.locationReference],
            ]}
          />
        </section>
        <section className="panel entity-summary">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Estado actual</p>
              <h2>{operationalLabel(equipment.data.operationalStatus)}</h2>
            </div>
          </div>
          <DefinitionList
            items={[
              ['Diagnóstico reciente', equipment.data.latestDiagnosis],
              [
                'Última intervención',
                equipment.data.lastInterventionAt
                  ? formatDate(equipment.data.lastInterventionAt)
                  : undefined,
              ],
              ['Observaciones', equipment.data.technicalNotes],
            ]}
          />
        </section>
      </div>
      <section className="panel entity-section">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Historial</p>
            <h2>Intervenciones técnicas</h2>
          </div>
        </div>
        {interventions.data.length === 0 ? (
          <p className="empty-copy">Aún no hay intervenciones registradas.</p>
        ) : (
          <div className="intervention-list">
            {interventions.data.map((item) => (
              <article key={item.id}>
                <header>
                  <strong>{interventionLabel(item.interventionType)}</strong>
                  <span className={`badge badge--${item.resultingStatus}`}>
                    {operationalLabel(item.resultingStatus)}
                  </span>
                </header>
                <p>{item.diagnosis}</p>
                <dl>
                  <div>
                    <dt>Acciones</dt>
                    <dd>{item.actions}</dd>
                  </div>
                  <div>
                    <dt>Piezas utilizadas</dt>
                    <dd>{item.partsUsed.join(', ') || 'Ninguna registrada'}</dd>
                  </div>
                  <div>
                    <dt>Recomendadas</dt>
                    <dd>{item.partsRecommended.join(', ') || 'Ninguna'}</dd>
                  </div>
                </dl>
                <small>
                  {item.responsibleName || 'Responsable autorizado'} · {formatDate(item.createdAt)}
                </small>
              </article>
            ))}
          </div>
        )}
      </section>
      <FileManager entityType="equipment" entityId={equipmentId} />
      <RelatedEntities requests={requests.data} quotes={quotes.data} />
      {adding && (
        <Modal title="Registrar intervención" onClose={() => setAdding(false)}>
          <form className="form-grid" onSubmit={(event) => void addIntervention(event)}>
            <label>
              Tipo
              <select name="interventionType" defaultValue="maintenance">
                <option value="inspection">Inspección</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="repair">Reparación</option>
                <option value="installation">Instalación</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label>
              Solicitud relacionada
              <select name="requestId">
                <option value="">Sin solicitud</option>
                {requests.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-wide">
              Diagnóstico
              <textarea name="diagnosis" required maxLength={2000} />
            </label>
            <label className="field-wide">
              Acciones realizadas
              <textarea name="actions" required maxLength={4000} />
            </label>
            <label>
              Piezas utilizadas
              <input name="partsUsed" maxLength={1000} placeholder="Separadas por coma" />
            </label>
            <label>
              Piezas recomendadas
              <input name="partsRecommended" maxLength={1000} placeholder="Separadas por coma" />
            </label>
            <label>
              Estado resultante
              <select name="resultingStatus" defaultValue="operational">
                <option value="operational">Operativo</option>
                <option value="limited">Operación limitada</option>
                <option value="out_of_service">Fuera de servicio</option>
                <option value="unknown">Sin confirmar</option>
              </select>
            </label>
            <label className="field-wide">
              Observaciones
              <textarea name="notes" maxLength={2000} />
            </label>
            <p className="form-message field-wide">
              Los adjuntos permitidos se agregan en “Fotografías y documentos” y permanecen en el
              expediente histórico del equipo.
            </p>
            {error && <p className="form-message form-message--error field-wide">{error}</p>}
            <button className="button button--primary field-wide" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar intervención'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

function RelatedEntities({
  sites = [],
  equipment = [],
  requests = [],
  quotes = [],
}: {
  sites?: Site[];
  equipment?: Equipment[];
  requests?: ServiceRequest[];
  quotes?: Quote[];
}) {
  const groups = [
    {
      label: 'Instalaciones',
      items: sites.map((item) => ({id: item.id, name: item.name, href: `/sites/${item.id}`})),
    },
    {
      label: 'Equipos',
      items: equipment.map((item) => ({
        id: item.id,
        name: item.name,
        href: `/equipment/${item.id}`,
      })),
    },
    {
      label: 'Solicitudes',
      items: requests.map((item) => ({
        id: item.id,
        name: item.title,
        href: `/requests/${item.id}`,
      })),
    },
    {
      label: 'Cotizaciones',
      items: quotes.map((item) => ({
        id: item.id,
        name: item.folio || 'Borrador',
        href: `/quotes?quote=${item.id}`,
      })),
    },
  ].filter((group) => group.items.length > 0);
  return (
    <section className="panel entity-section">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Trazabilidad</p>
          <h2>Registros relacionados</h2>
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="empty-copy">No hay relaciones disponibles.</p>
      ) : (
        <div className="related-grid">
          {groups.map((group) => (
            <article key={group.label}>
              <strong>{group.label}</strong>
              {group.items.slice(0, 8).map((item) => (
                <Link key={item.id} href={item.href}>
                  {item.name}
                  <span>→</span>
                </Link>
              ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AddressActions({address}: {address: string}) {
  return (
    <div className="button-row">
      <button
        className="button button--secondary"
        onClick={() => void navigator.clipboard.writeText(address)}
      >
        <Icon name="copy" />
        Copiar dirección
      </button>
      <a
        className="button button--ghost"
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="map" />
        Abrir en Google Maps
      </a>
    </div>
  );
}

function DefinitionList({items}: {items: Array<[string, string | undefined | null]>}) {
  const visible = items.filter(([, value]) => value);
  return visible.length === 0 ? (
    <p className="empty-copy">Sin datos adicionales.</p>
  ) : (
    <dl className="definition-grid">
      {visible.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function useDocument<T>(collectionName: string, id: string, enabled = true) {
  const [data, setData] = useState<(T & {id: string}) | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (!enabled || !id) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    void getDocument<T>(collectionName, id)
      .then((value) => {
        if (active) setData(value as (T & {id: string}) | null);
      })
      .catch(() => {
        if (active) setError('No fue posible consultar el registro.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [collectionName, id, enabled, revision]);
  return {data, loading, error, reload: () => setRevision((value) => value + 1)};
}

function formatClientActionError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code.includes('unauthenticated'))
    return 'Tu sesión ya no es válida. Inicia sesión nuevamente.';
  if (code.includes('permission-denied')) return 'No tienes permisos para realizar esta acción.';
  if (code.includes('not-found')) return 'El cliente ya no existe.';
  return 'No fue posible completar la operación. Inténtalo de nuevo.';
}

function formatAddress(address: Site['address']) {
  return [
    address.street,
    address.exteriorNumber,
    address.interiorNumber,
    address.neighborhood,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(', ');
}
function operationalLabel(value?: Equipment['operationalStatus']) {
  return {
    operational: 'Operativo',
    limited: 'Operación limitada',
    out_of_service: 'Fuera de servicio',
    unknown: 'Sin confirmar',
  }[value ?? 'unknown'];
}
function interventionLabel(value: EquipmentIntervention['interventionType']) {
  return {
    inspection: 'Inspección',
    maintenance: 'Mantenimiento',
    repair: 'Reparación',
    installation: 'Instalación',
    other: 'Otra intervención',
  }[value];
}
