import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {Link, useLocation, useSearch} from 'wouter';
import {useAuth} from '../../app/providers/AuthProvider';
import {Modal} from '../../components/Modal';
import {FilterBar} from '../../components/FilterBar';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import {usePaginatedCollection} from '../../hooks/usePaginatedCollection';
import type {Client, Equipment, Site} from '../../models/domain';
import {
  clientInputSchema,
  equipmentInputSchema,
  siteInputSchema,
  type ClientInput,
  type EquipmentInput,
  type SiteInput,
} from '../../models/schemas';
import {constraints, createDocument, updateDocument} from '../../services/firebase/data';

type EntityKind = 'clients' | 'sites' | 'equipment';
type MasterRecord = Client | Site | Equipment;

const copy = {
  clients: {
    title: 'Clientes',
    description: 'Directorio comercial y operativo, sin borrado físico.',
    singular: 'cliente',
  },
  sites: {
    title: 'Instalaciones',
    description: 'Plantas, ranchos, sucursales y almacenes relacionados con cada cliente.',
    singular: 'instalación',
  },
  equipment: {
    title: 'Equipos',
    description: 'Activos industriales con trazabilidad por instalación.',
    singular: 'equipo',
  },
} as const;

export function MasterDataPage({kind}: {kind: EntityKind}) {
  const {profile} = useAuth();
  const searchQuery = useSearch();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [operationalFilter, setOperationalFilter] = useState('all');
  const [sort, setSort] = useState('az');
  const operatorConstraints =
    profile?.role === 'operator' ? [constraints.authorizedFor(profile.uid)] : [];
  const records = usePaginatedCollection<MasterRecord>(
    kind,
    kind === 'clients' && statusFilter !== 'all'
      ? [...operatorConstraints, constraints.status(statusFilter)]
      : operatorConstraints,
    [{field: 'name', direction: 'asc'}],
    25,
    true,
    `${kind}|${profile?.uid ?? 'admin'}|${statusFilter}`,
  );
  const clients = useCollection<Client>('clients', operatorConstraints);
  const sites = useCollection<Site>('sites', operatorConstraints);
  const [editing, setEditing] = useState<MasterRecord | 'new' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [view, setView] = useState<'cards' | 'list' | 'table'>(
    () =>
      (localStorage.getItem(`enfriamatic-view-${kind}`) as 'cards' | 'list' | 'table') ?? 'cards',
  );
  const labels = copy[kind];

  useEffect(() => {
    const parameters = new URLSearchParams(searchQuery);
    if (parameters.get('new') === '1' && profile?.role === 'admin') {
      setEditing('new');
      return;
    }
    const editId = parameters.get('edit');
    if (editId && profile?.role === 'admin') {
      const record = records.data.find((item) => item.id === editId);
      if (record) setEditing(record);
    }
  }, [records.data, searchQuery, profile]);

  useEffect(() => {
    if (kind !== 'clients') return;
    const notice = sessionStorage.getItem('enfriamatic:client-action-notice');
    if (notice) {
      setActionNotice(notice);
      sessionStorage.removeItem('enfriamatic:client-action-notice');
    }
  }, [kind]);

  const closeEditor = () => {
    setEditing(null);
    const parameters = new URLSearchParams(searchQuery);
    if (parameters.has('new') || parameters.has('edit')) navigate(`/${kind}`, {replace: true});
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-MX');
    return records.data
      .filter((record) => {
        const unit = kind === 'equipment' ? (record as Equipment) : null;
        const searchable = [
          record.name,
          'legalName' in record ? record.legalName : '',
          'rfc' in record ? record.rfc : '',
          'email' in record ? record.email : '',
          'phone' in record ? record.phone : '',
          'category' in record ? record.category : '',
          'brand' in record ? record.brand : '',
          'serialNumber' in record ? record.serialNumber : '',
        ];
        return (
          (!term || searchable.some((value) => value?.toLocaleLowerCase('es-MX').includes(term))) &&
          (!unit || siteFilter === 'all' || unit.siteId === siteFilter) &&
          (!unit || categoryFilter === 'all' || unit.category === categoryFilter) &&
          (!unit || brandFilter === 'all' || unit.brand === brandFilter) &&
          (!unit || operationalFilter === 'all' || unit.operationalStatus === operationalFilter)
        );
      })
      .sort((left, right) => {
        if (sort === 'za') return right.name.localeCompare(left.name, 'es-MX');
        if (kind === 'clients') return left.name.localeCompare(right.name, 'es-MX');
        if (sort === 'newest')
          return (right.updatedAt?.toMillis?.() ?? 0) - (left.updatedAt?.toMillis?.() ?? 0);
        if (sort === 'oldest')
          return (left.updatedAt?.toMillis?.() ?? 0) - (right.updatedAt?.toMillis?.() ?? 0);
        return left.name.localeCompare(right.name, 'es-MX');
      });
  }, [
    brandFilter,
    categoryFilter,
    kind,
    operationalFilter,
    records.data,
    search,
    siteFilter,
    sort,
  ]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setFormError(null);
    try {
      const data = parseForm(kind, new FormData(event.currentTarget));
      if (editing === 'new') {
        await createDocument(kind, {...data, operatorIds: []}, profile.uid);
      } else if (editing) {
        await updateDocument(kind, editing.id, data, profile.uid);
      }
      closeEditor();
      await Promise.all([records.reload(), clients.reload(), sites.reload()]);
    } catch (error) {
      setFormError(formatFormError(error));
    } finally {
      setSaving(false);
    }
  };

  if (records.loading)
    return <StatePanel kind="loading" title={`Cargando ${labels.title.toLowerCase()}…`} />;

  return (
    <>
      <PageHeader
        eyebrow="Datos maestros"
        title={labels.title}
        description={labels.description}
        actions={
          profile?.role === 'admin' ? (
            <button
              className="button button--primary"
              onClick={() => setEditing('new')}
              data-testid={`new-${kind}`}
            >
              Nueva {labels.singular}
            </button>
          ) : undefined
        }
      />
      {actionNotice && (
        <p className="form-message form-message--success" role="status">
          {actionNotice}
        </p>
      )}
      <FilterBar
        search={search}
        searchPlaceholder="Nombre, categoría, marca…"
        sort={sort}
        sortOptions={[
          {value: 'az', label: 'A–Z'},
          {value: 'za', label: 'Z–A'},
          {value: 'newest', label: 'Más recientes'},
          {value: 'oldest', label: 'Más antiguos'},
        ]}
        onSearch={setSearch}
        onSort={setSort}
        onClear={() => {
          setSearch('');
          setStatusFilter('all');
          setSiteFilter('all');
          setCategoryFilter('all');
          setBrandFilter('all');
          setOperationalFilter('all');
          setSort('az');
        }}
      >
        {kind === 'clients' && (
          <label>
            Estado
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </label>
        )}
        {kind === 'equipment' && (
          <>
            <label>
              Instalación
              <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
                <option value="all">Todas</option>
                {sites.data.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoría
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">Todas</option>
                {[
                  ...new Set(
                    records.data
                      .filter((item): item is Equipment => 'category' in item)
                      .map((item) => item.category),
                  ),
                ]
                  .sort()
                  .map((value) => (
                    <option key={value}>{value}</option>
                  ))}
              </select>
            </label>
            <label>
              Marca
              <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
                <option value="all">Todas</option>
                {[
                  ...new Set(
                    records.data
                      .filter((item): item is Equipment => 'brand' in item && Boolean(item.brand))
                      .map((item) => item.brand!),
                  ),
                ]
                  .sort()
                  .map((value) => (
                    <option key={value}>{value}</option>
                  ))}
              </select>
            </label>
            <label>
              Estado operativo
              <select
                value={operationalFilter}
                onChange={(event) => setOperationalFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                <option value="operational">Operativo</option>
                <option value="limited">Limitado</option>
                <option value="out_of_service">Fuera de servicio</option>
                <option value="unknown">Sin confirmar</option>
              </select>
            </label>
          </>
        )}
        <div className="view-toggle" aria-label="Tipo de vista">
          {(kind === 'clients'
            ? (['cards', 'table'] as const)
            : (['cards', 'list', 'table'] as const)
          ).map((option) => (
            <button
              key={option}
              className={view === option ? 'active' : undefined}
              onClick={() => {
                setView(option);
                localStorage.setItem(`enfriamatic-view-${kind}`, option);
              }}
            >
              {{cards: 'Tarjetas', list: 'Lista', table: 'Tabla'}[option]}
            </button>
          ))}
        </div>
        <span>{filtered.length} registros en esta página</span>
      </FilterBar>
      {records.error ? (
        <StatePanel kind="error" title="No fue posible cargar los datos">
          <p>{records.error}</p>
          <button className="button button--secondary" onClick={() => void records.reload()}>
            Reintentar
          </button>
        </StatePanel>
      ) : filtered.length === 0 ? (
        <StatePanel
          title={
            records.data.length === 0
              ? `No existen ${labels.title.toLowerCase()} todavía`
              : 'No se encontraron coincidencias con los filtros actuales'
          }
        >
          <p>
            {records.data.length === 0
              ? 'Crea el primer registro para comenzar.'
              : 'Prueba otra búsqueda o limpia los filtros.'}
          </p>
        </StatePanel>
      ) : (
        <section className={`record-grid record-grid--${view}`} aria-label={labels.title}>
          {filtered.map((record) => (
            <article className="record-card" key={record.id}>
              <div className="record-card__top">
                <span className={`badge badge--${record.status}`}>
                  {statusLabel(record.status)}
                </span>
                {profile?.role === 'admin' && (
                  <button className="text-button" onClick={() => setEditing(record)}>
                    Editar
                  </button>
                )}
              </div>
              <h2>
                <Link href={`/${kind}/${record.id}`}>{record.name}</Link>
              </h2>
              {'category' in record && (
                <p>
                  {record.category} {record.brand ? `· ${record.brand}` : ''}
                </p>
              )}
              {'type' in record && (
                <p>
                  {record.type ?? 'Instalación'} · {record.address.city}
                </p>
              )}
              {'contactName' in record && record.contactName && (
                <p>Contacto: {record.contactName}</p>
              )}
              <small>ID {record.id}</small>
              <Link className="record-card__open" href={`/${kind}/${record.id}`}>
                Abrir detalle <span>→</span>
              </Link>
            </article>
          ))}
        </section>
      )}
      {!records.loading && !records.error && (records.page > 1 || records.hasMore) && (
        <nav className="button-row" aria-label="Paginación de clientes">
          <button
            className="button button--ghost"
            disabled={records.page === 1}
            onClick={() => void records.previousPage()}
          >
            Anteriores
          </button>
          <span>Página {records.page}</span>
          <button
            className="button button--ghost"
            disabled={!records.hasMore}
            onClick={() => void records.nextPage()}
          >
            Siguientes
          </button>
        </nav>
      )}
      {editing && (
        <Modal
          title={`${editing === 'new' ? 'Nueva' : 'Editar'} ${labels.singular}`}
          onClose={closeEditor}
        >
          <MasterForm
            kind={kind}
            value={editing === 'new' ? null : editing}
            clients={clients.data}
            sites={sites.data}
            saving={saving}
            error={formError}
            onSubmit={submit}
          />
        </Modal>
      )}
    </>
  );
}

function MasterForm({
  kind,
  value,
  clients,
  sites,
  saving,
  error,
  onSubmit,
}: {
  kind: EntityKind;
  value: MasterRecord | null;
  clients: Client[];
  sites: Site[];
  saving: boolean;
  error: string | null;
  onSubmit(event: FormEvent<HTMLFormElement>): Promise<void>;
}) {
  return (
    <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
      {(kind === 'sites' || kind === 'equipment') && (
        <label>
          Cliente
          <select
            name="clientId"
            required
            defaultValue={value && 'clientId' in value ? value.clientId : ''}
          >
            <option value="">Selecciona</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === 'equipment' && (
        <label>
          Instalación
          <select
            name="siteId"
            required
            defaultValue={value && 'siteId' in value ? value.siteId : ''}
          >
            <option value="">Selecciona</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field-wide">
        Nombre
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={value?.name ?? ''}
          data-testid={`${kind}-name`}
          placeholder={kind === 'clients' ? 'Ej. Procesos Fríos del Bajío' : 'Ej. Planta Querétaro'}
        />
      </label>
      {kind === 'clients' && (
        <>
          <label>
            Razón social
            <input
              name="legalName"
              maxLength={160}
              defaultValue={value && 'legalName' in value ? value.legalName : ''}
              placeholder="Ej. Procesos Fríos del Bajío, S.A. de C.V."
            />
          </label>
          <label>
            RFC
            <input
              name="rfc"
              maxLength={13}
              defaultValue={value && 'rfc' in value ? value.rfc : ''}
              placeholder="Ej. PFB260101AB1"
            />
          </label>
          <label>
            Persona de contacto
            <input
              name="contactName"
              maxLength={160}
              defaultValue={value && 'contactName' in value ? value.contactName : ''}
              placeholder="Ej. José García"
            />
          </label>
          <label>
            Correo
            <input
              type="email"
              name="email"
              maxLength={254}
              defaultValue={value && 'email' in value ? value.email : ''}
              placeholder="Ej. contacto@empresa.com"
            />
          </label>
          <label>
            Teléfono
            <input
              name="phone"
              maxLength={30}
              defaultValue={value && 'phone' in value ? value.phone : ''}
              placeholder="Ej. 442 123 4567"
            />
          </label>
          <label className="field-wide">
            Notas
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={value && 'notes' in value ? value.notes : ''}
              placeholder="Agrega indicaciones comerciales o técnicas relevantes"
            />
          </label>
          <h3 className="field-wide form-section-title">
            Dirección <span>Opcional</span>
          </h3>
          <label className="field-wide">
            Dirección completa
            <textarea
              name="addressFull"
              maxLength={500}
              placeholder="Incluye calle, número, colonia, municipio o alcaldía y estado."
              defaultValue={
                value && 'addressFull' in value ? value.addressFull : legacyAddress(value)
              }
            />
          </label>
          <label>
            Código postal
            <input
              name="postalCode"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              defaultValue={
                value && 'postalCode' in value
                  ? value.postalCode
                  : value && 'billingAddress' in value
                    ? value.billingAddress?.postalCode
                    : ''
              }
              placeholder="Ej. 76175"
            />
          </label>
        </>
      )}
      {kind === 'sites' && (
        <>
          <label>
            Tipo
            <select name="type" defaultValue={value && 'type' in value ? value.type : 'plant'}>
              <option value="">Selecciona una opción</option>
              <option value="plant">Planta</option>
              <option value="ranch">Rancho</option>
              <option value="branch">Sucursal</option>
              <option value="warehouse">Almacén</option>
              <option value="other">Otro</option>
            </select>
          </label>
          <label>
            Calle
            <input
              name="street"
              required
              maxLength={160}
              defaultValue={value && 'address' in value ? value.address.street : ''}
              placeholder="Ej. Av. Industrial 125"
            />
          </label>
          <label>
            Número
            <input
              name="exteriorNumber"
              maxLength={20}
              defaultValue={value && 'address' in value ? value.address.exteriorNumber : ''}
            />
          </label>
          <label>
            Ciudad
            <input
              name="city"
              required
              maxLength={100}
              defaultValue={value && 'address' in value ? value.address.city : ''}
              placeholder="Ej. Querétaro"
            />
          </label>
          <label>
            Estado
            <input
              name="state"
              required
              maxLength={100}
              defaultValue={value && 'address' in value ? value.address.state : ''}
              placeholder="Ej. Querétaro"
            />
          </label>
          <label>
            Código postal
            <input
              name="postalCode"
              required
              maxLength={5}
              defaultValue={value && 'address' in value ? value.address.postalCode : ''}
              placeholder="Ej. 76175"
              pattern="[0-9]{5}"
              inputMode="numeric"
              minLength={5}
            />
          </label>
          <label>
            Contacto
            <input
              name="contactName"
              maxLength={160}
              defaultValue={value && 'contactName' in value ? value.contactName : ''}
            />
          </label>
          <label>
            Teléfono
            <input
              name="contactPhone"
              maxLength={30}
              defaultValue={value && 'contactPhone' in value ? value.contactPhone : ''}
            />
          </label>
          <label className="field-wide">
            Horario de acceso
            <input
              name="accessSchedule"
              maxLength={500}
              defaultValue={value && 'accessSchedule' in value ? value.accessSchedule : ''}
              placeholder="Lun–Vie 08:00–18:00"
            />
          </label>
          <label className="field-wide">
            Indicaciones y referencias
            <textarea
              name="accessInstructions"
              maxLength={2000}
              defaultValue={value && 'accessInstructions' in value ? value.accessInstructions : ''}
            />
          </label>
          <label>
            Latitud
            <input
              name="latitude"
              type="number"
              min={-90}
              max={90}
              step="any"
              defaultValue={
                value && 'latitude' in value && value.latitude != null ? value.latitude : ''
              }
            />
          </label>
          <label>
            Longitud
            <input
              name="longitude"
              type="number"
              min={-180}
              max={180}
              step="any"
              defaultValue={
                value && 'longitude' in value && value.longitude != null ? value.longitude : ''
              }
            />
          </label>
        </>
      )}
      {kind === 'equipment' && (
        <>
          <label>
            Categoría
            <input
              name="category"
              required
              maxLength={120}
              defaultValue={value && 'category' in value ? value.category : ''}
            />
          </label>
          <label>
            Marca
            <input
              name="brand"
              maxLength={160}
              defaultValue={value && 'brand' in value ? value.brand : ''}
            />
          </label>
          <label>
            Modelo
            <input
              name="model"
              maxLength={160}
              defaultValue={value && 'model' in value ? value.model : ''}
            />
          </label>
          <label>
            Número de serie
            <input
              name="serialNumber"
              maxLength={160}
              defaultValue={value && 'serialNumber' in value ? value.serialNumber : ''}
            />
          </label>
          <label>
            Capacidad
            <input
              name="capacity"
              maxLength={160}
              defaultValue={value && 'capacity' in value ? value.capacity : ''}
            />
          </label>
          <label>
            Refrigerante
            <input
              name="refrigerant"
              maxLength={160}
              defaultValue={value && 'refrigerant' in value ? value.refrigerant : ''}
            />
          </label>
          <label className="field-wide">
            Notas técnicas
            <textarea
              name="technicalNotes"
              maxLength={2000}
              defaultValue={value && 'technicalNotes' in value ? value.technicalNotes : ''}
            />
          </label>
          <label className="field-wide">
            Ubicación dentro del sitio
            <input
              name="locationReference"
              maxLength={500}
              defaultValue={value && 'locationReference' in value ? value.locationReference : ''}
            />
          </label>
          <label>
            Estado operativo
            <select
              name="operationalStatus"
              defaultValue={
                value && 'operationalStatus' in value ? value.operationalStatus : 'unknown'
              }
            >
              <option value="operational">Operativo</option>
              <option value="limited">Operación limitada</option>
              <option value="out_of_service">Fuera de servicio</option>
              <option value="unknown">Sin confirmar</option>
            </select>
          </label>
          <label className="field-wide">
            Diagnóstico más reciente
            <textarea
              name="latestDiagnosis"
              maxLength={2000}
              defaultValue={value && 'latestDiagnosis' in value ? value.latestDiagnosis : ''}
            />
          </label>
        </>
      )}
      <label>
        Estado
        <select name="status" defaultValue={value?.status ?? 'active'}>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          {kind === 'equipment' && <option value="retired">Retirado</option>}
        </select>
      </label>
      {error && <p className="form-message form-message--error field-wide">{error}</p>}
      <div className="form-actions field-wide">
        <button className="button button--primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

function value(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

function parseForm(kind: EntityKind, form: FormData): ClientInput | SiteInput | EquipmentInput {
  if (kind === 'clients') {
    const addressFull = value(form, 'addressFull');
    const postalCode = value(form, 'postalCode');
    return clientInputSchema.parse({
      name: value(form, 'name'),
      legalName: value(form, 'legalName'),
      rfc: value(form, 'rfc'),
      contactName: value(form, 'contactName'),
      email: value(form, 'email'),
      phone: value(form, 'phone'),
      status: value(form, 'status'),
      notes: value(form, 'notes'),
      ...(addressFull ? {addressFull} : {}),
      ...(postalCode ? {postalCode} : {}),
    });
  }
  if (kind === 'sites') {
    return siteInputSchema.parse({
      clientId: value(form, 'clientId'),
      name: value(form, 'name'),
      type: value(form, 'type'),
      address: {
        street: value(form, 'street'),
        exteriorNumber: value(form, 'exteriorNumber'),
        city: value(form, 'city'),
        state: value(form, 'state'),
        postalCode: value(form, 'postalCode'),
        country: 'México',
      },
      contactName: value(form, 'contactName'),
      contactPhone: value(form, 'contactPhone'),
      accessSchedule: value(form, 'accessSchedule'),
      accessInstructions: value(form, 'accessInstructions'),
      latitude: numberOrNull(form, 'latitude'),
      longitude: numberOrNull(form, 'longitude'),
      status: value(form, 'status'),
    });
  }
  return equipmentInputSchema.parse({
    clientId: value(form, 'clientId'),
    siteId: value(form, 'siteId'),
    name: value(form, 'name'),
    category: value(form, 'category'),
    brand: value(form, 'brand'),
    model: value(form, 'model'),
    serialNumber: value(form, 'serialNumber'),
    capacity: value(form, 'capacity'),
    refrigerant: value(form, 'refrigerant'),
    technicalNotes: value(form, 'technicalNotes'),
    locationReference: value(form, 'locationReference'),
    operationalStatus: value(form, 'operationalStatus'),
    latestDiagnosis: value(form, 'latestDiagnosis'),
    status: value(form, 'status'),
  });
}

function formatFormError(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as {issues?: Array<{path?: Array<string | number>; message?: string}>})
      .issues;
    const path = issues?.[0]?.path?.[0];
    if (path === 'addressFull') return 'Escribe la dirección completa.';
    if (path === 'postalCode') return 'El código postal debe contener cinco dígitos.';
    if (path === 'email') return 'Escribe un correo electrónico válido.';
    if (path === 'name') return 'Escribe un nombre válido.';
  }
  return 'No se pudo guardar el registro. Revisa los datos e inténtalo de nuevo.';
}

function statusLabel(status: string): string {
  return {active: 'Activo', inactive: 'Inactivo', retired: 'Retirado'}[status] ?? status;
}

function legacyAddress(value: MasterRecord | null): string {
  if (!value || !('billingAddress' in value) || !value.billingAddress) return '';
  return [
    value.billingAddress.street,
    value.billingAddress.exteriorNumber,
    value.billingAddress.interiorNumber,
    value.billingAddress.neighborhood,
    value.billingAddress.city,
    value.billingAddress.state,
  ]
    .filter(Boolean)
    .join(', ');
}

function numberOrNull(form: FormData, key: string): number | null {
  const raw = value(form, key);
  return raw === '' ? null : Number(raw);
}
