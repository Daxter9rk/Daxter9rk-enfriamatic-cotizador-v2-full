import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {Link, useLocation, useSearch} from 'wouter';
import {useAuth} from '../../app/providers/AuthProvider';
import {Modal} from '../../components/Modal';
import {FilterBar} from '../../components/FilterBar';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import {usePaginatedCollection} from '../../hooks/usePaginatedCollection';
import type {
  CatalogItem,
  Client,
  Equipment,
  Quote,
  ServiceRequest,
  Site,
  UserProfile,
  UserRole,
} from '../../models/domain';
import {
  createQuoteRecord,
  createQuoteDraft,
  getQuoteRecord,
  normalizeQuoteRecord,
} from '../../modules/quotes';
import {constraints} from '../../services/firebase/data';
import {formatCurrency, formatDate} from '../../utils/format';
import {
  closeDetailSearch,
  detailIdFromSearch,
  openDetailSearch,
} from '../../utils/detailNavigation';
import {QuoteEditor} from './QuoteEditor';

export function QuotesPage() {
  const {profile} = useAuth();
  const search = useSearch();
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState('all');
  const [documentStatusFilter, setDocumentStatusFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [quoteSearch, setQuoteSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [sort, setSort] = useState('newest');
  const operatorFilter = profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : [];
  const masterDataFilter =
    profile?.role === 'operator' ? [constraints.authorizedFor(profile.uid)] : [];
  const quoteConstraints = [
    ...operatorFilter,
    ...(statusFilter !== 'all' ? [constraints.status(statusFilter)] : []),
    ...(documentStatusFilter !== 'all' ? [constraints.documentStatus(documentStatusFilter)] : []),
    ...(profile?.role === 'admin' && assignmentFilter !== 'all'
      ? [
          assignmentFilter === 'unassigned'
            ? constraints.unassigned()
            : constraints.assignedTo(assignmentFilter),
        ]
      : []),
  ];
  const quotes = usePaginatedCollection<Quote>(
    'quotes',
    quoteConstraints,
    [
      {field: 'updatedAt', direction: 'desc'},
      {field: '__name__', direction: 'desc'},
    ],
    25,
    true,
    `${profile?.uid ?? 'admin'}|${statusFilter}|${documentStatusFilter}|${assignmentFilter}|${quoteSearch}|${clientFilter}|${creatorFilter}|${fromDate}|${sort}`,
  );
  const requests = useCollection<ServiceRequest>('requests', operatorFilter);
  const clients = useCollection<Client>('clients', masterDataFilter);
  const sites = useCollection<Site>('sites', masterDataFilter);
  const equipment = useCollection<Equipment>('equipment', masterDataFilter);
  const catalog = useCollection<CatalogItem>('catalogItems', [constraints.activeOnly()], 100);
  const users = useCollection<UserProfile>('users', [], 100, profile?.role === 'admin');
  const normalizedQuotes = useMemo(
    () => quotes.data.map((quote) => normalizeQuoteRecord(quote)),
    [quotes.data],
  );
  const [selected, setSelected] = useState<Quote | null>(null);
  const [creating, setCreating] = useState(false);
  const [creationClientId, setCreationClientId] = useState('');
  const [creationRequestId, setCreationRequestId] = useState('');
  const [view, setView] = useState<'cards' | 'list' | 'table'>(
    () =>
      (localStorage.getItem('enfriamatic:quotes-view') as 'cards' | 'list' | 'table') || 'cards',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const quoteId = detailIdFromSearch(search, 'quote');
    if (quoteId && selected?.id !== quoteId) {
      const target = normalizedQuotes.find((quote) => quote.id === quoteId);
      if (target) setSelected(target);
      else if (!quotes.loading) {
        setMessage('La cotización no existe o no tienes permiso para consultarla.');
      }
    }
    if (!quoteId && selected) setSelected(null);
  }, [normalizedQuotes, quotes.loading, search, selected]);

  const openQuote = (quote: Quote) => {
    setMessage(null);
    setSelected(quote);
    navigate(`/quotes${openDetailSearch(search, 'quote', quote.id)}`);
  };

  const closeQuote = () => {
    navigate(`/quotes${closeDetailSearch(search, 'quote')}`, {replace: true});
    setSelected(null);
  };

  const validRequests = requests.data.filter((request) =>
    ['assigned', 'in_progress'].includes(request.status),
  );
  const creationRequest = validRequests.find((request) => request.id === creationRequestId);
  const visible = useMemo(() => {
    const term = quoteSearch.trim().toLocaleLowerCase('es-MX');
    const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : 0;
    return normalizedQuotes
      .filter((quote) => {
        const clientName = clients.data.find((client) => client.id === quote.clientId)?.name ?? '';
        return (
          (statusFilter === 'all' || quote.status === statusFilter) &&
          (clientFilter === 'all' || quote.clientId === clientFilter) &&
          (creatorFilter === 'all' || quote.createdBy === creatorFilter) &&
          (!start || (quote.createdAt?.toMillis?.() ?? 0) >= start) &&
          (!term ||
            `${quote.folio} ${clientName} ${quote.serviceReference ?? ''}`
              .toLocaleLowerCase('es-MX')
              .includes(term))
        );
      })
      .sort((left, right) => {
        if (sort === 'oldest')
          return (left.createdAt?.toMillis?.() ?? 0) - (right.createdAt?.toMillis?.() ?? 0);
        if (sort === 'amount-desc') return right.grandTotal - left.grandTotal;
        if (sort === 'amount-asc') return left.grandTotal - right.grandTotal;
        if (sort === 'az') return left.folio.localeCompare(right.folio, 'es-MX');
        return (right.createdAt?.toMillis?.() ?? 0) - (left.createdAt?.toMillis?.() ?? 0);
      });
  }, [
    clientFilter,
    clients.data,
    creatorFilter,
    fromDate,
    quoteSearch,
    normalizedQuotes,
    sort,
    statusFilter,
  ]);

  const createQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      const requestId = String(form.get('requestId') ?? '').trim() || null;
      const request = requestId ? validRequests.find((item) => item.id === requestId) : null;
      const clientId = request?.clientId ?? String(form.get('clientId') ?? '');
      const assignedTo =
        request?.assignedTo ?? (String(form.get('assignedTo') ?? '').trim() || null);
      const draft = createQuoteDraft({
        actorId: profile.uid,
        actorRole: profile.role,
        clientId,
        requestId,
        assignedTo,
        siteId: request?.siteId ?? (String(form.get('siteId') ?? '').trim() || null),
        equipmentId: request?.equipmentId ?? (String(form.get('equipmentId') ?? '').trim() || null),
        serviceReference: String(form.get('serviceReference') ?? ''),
        technicalContext: String(form.get('technicalContext') ?? ''),
      });
      if (request && request.clientId !== clientId) {
        throw new Error('La solicitud no coincide con el cliente seleccionado.');
      }
      const id = await createQuoteRecord({
        actorId: profile.uid,
        actorRole: profile.role,
        clientId: draft.clientId,
        requestId: draft.requestId,
        assignedTo: draft.assignedTo,
        siteId: draft.siteId,
        equipmentId: draft.equipmentId,
        serviceReference: draft.serviceReference ?? null,
        technicalContext: draft.technicalContext ?? null,
      });
      setCreating(false);
      await quotes.reload();
      const created = await getQuoteRecord(id);
      if (created) openQuote(created);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la cotización.');
    } finally {
      setBusy(false);
    }
  };

  if (quotes.loading && quotes.data.length === 0) {
    return <StatePanel kind="loading" title="Cargando cotizaciones…" />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Cotizaciones"
        description="Crea, emite y da seguimiento a propuestas con trazabilidad completa."
        actions={
          <button
            className="button button--primary"
            onClick={() => {
              setCreationClientId('');
              setCreationRequestId('');
              setCreating(true);
            }}
            data-testid="new-quote"
          >
            Nueva cotización
          </button>
        }
      />
      <FilterBar
        search={quoteSearch}
        searchPlaceholder="Folio o cliente…"
        sort={sort}
        sortOptions={[
          {value: 'newest', label: 'Más recientes'},
          {value: 'oldest', label: 'Más antiguas'},
          {value: 'amount-desc', label: 'Mayor monto'},
          {value: 'amount-asc', label: 'Menor monto'},
          {value: 'az', label: 'A–Z'},
        ]}
        onSearch={setQuoteSearch}
        onSort={setSort}
        onClear={() => {
          setQuoteSearch('');
          setStatusFilter('all');
          setDocumentStatusFilter('all');
          setAssignmentFilter('all');
          setClientFilter('all');
          setCreatorFilter('all');
          setFromDate('');
          setSort('newest');
        }}
      >
        <label>
          Estado
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Todos</option>
            <option value="draft">Borrador</option>
            <option value="issued">Emitida</option>
            <option value="sent">Enviada</option>
            <option value="accepted">Aceptada</option>
            <option value="rejected">Rechazada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>
        <label>
          Documento
          <select
            value={documentStatusFilter}
            onChange={(event) => setDocumentStatusFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            <option value="not_generated">Sin PDF</option>
            <option value="generating">Generando PDF</option>
            <option value="ready">PDF listo</option>
            <option value="failed">PDF con fallo</option>
          </select>
        </label>
        <label>
          Cliente
          <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
            <option value="all">Todos</option>
            {clients.data.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        {profile?.role === 'admin' && (
          <label>
            Creador
            <select
              value={creatorFilter}
              onChange={(event) => setCreatorFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              {users.data.map((user) => (
                <option key={user.uid} value={user.uid}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
        {profile?.role === 'admin' && (
          <label>
            Asignación
            <select
              value={assignmentFilter}
              onChange={(event) => setAssignmentFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="unassigned">Sin asignar</option>
              {users.data.map((user) => (
                <option key={user.uid} value={user.uid}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Desde
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>
        <span>{visible.length} cotizaciones</span>
        <div className="view-toggle" role="group" aria-label="Vista de cotizaciones">
          {(['list', 'cards', 'table'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={view === option ? 'active' : ''}
              onClick={() => {
                setView(option);
                localStorage.setItem('enfriamatic:quotes-view', option);
              }}
            >
              {option === 'list' ? 'Lista' : option === 'cards' ? 'Tarjetas' : 'Tabla'}
            </button>
          ))}
        </div>
      </FilterBar>
      {clients.data.length === 0 ? (
        <MissingRequirements role={profile?.role} />
      ) : quotes.error ? (
        <StatePanel kind="error" title="No fue posible cargar cotizaciones">
          <button className="button button--secondary" onClick={() => void quotes.reload()}>
            Reintentar
          </button>
        </StatePanel>
      ) : visible.length === 0 ? (
        <StatePanel
          title={
            quotes.data.length === 0
              ? 'No existen cotizaciones todavía'
              : 'No se encontraron coincidencias con los filtros actuales'
          }
        />
      ) : (
        <section className={`record-grid record-grid--${view}`}>
          {view === 'table' && (
            <div className="record-table-head">
              <span>Folio</span>
              <span>Cliente</span>
              <span>Estado</span>
              <span>Total</span>
              <span>Actualización</span>
            </div>
          )}
          {visible.map((quote) => (
            <button
              className="record-card record-card--button"
              key={quote.id}
              onClick={() => openQuote(quote)}
              data-testid={`quote-${quote.id}`}
            >
              <div className="record-card__top">
                <span className={`badge badge--${quote.status}`}>
                  {quoteStatusLabel(quote.status)}
                </span>
                <span>{documentStatusLabel(quote.documentStatus)}</span>
              </div>
              <h2>{quote.folio || 'Borrador sin folio'}</h2>
              <p>
                {clients.data.find((client) => client.id === quote.clientId)?.name ??
                  quote.clientId}
              </p>
              <strong className="record-card__total">{formatCurrency(quote.grandTotal)}</strong>
              <small>Actualizada {formatDate(quote.updatedAt)}</small>
            </button>
          ))}
        </section>
      )}
      {!quotes.loading && !quotes.error && (quotes.page > 1 || quotes.hasMore) && (
        <nav className="button-row" aria-label="Paginación de cotizaciones">
          <button
            className="button button--ghost"
            disabled={quotes.page === 1}
            onClick={() => void quotes.previousPage()}
          >
            Anteriores
          </button>
          <span>Página {quotes.page}</span>
          <button
            className="button button--ghost"
            disabled={!quotes.hasMore}
            onClick={() => void quotes.nextPage()}
          >
            Siguientes
          </button>
        </nav>
      )}
      {creating && (
        <Modal title="Nueva cotización" onClose={() => setCreating(false)}>
          <QuoteCreationGuide />
          <form className="form-grid" onSubmit={(event) => void createQuote(event)}>
            <label className="field-wide">
              Cliente
              <select
                name="clientId"
                required
                data-testid="quote-client"
                value={creationClientId}
                onChange={(event) => setCreationClientId(event.target.value)}
              >
                <option value="">Selecciona</option>
                {clients.data.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-wide">
              Solicitud (opcional)
              <select
                name="requestId"
                data-testid="quote-request"
                value={creationRequestId}
                onChange={(event) => {
                  const requestId = event.target.value;
                  const request = validRequests.find((item) => item.id === requestId);
                  setCreationRequestId(requestId);
                  if (request) setCreationClientId(request.clientId);
                }}
              >
                <option value="">Sin solicitud vinculada</option>
                {validRequests
                  .filter((request) => !creationClientId || request.clientId === creationClientId)
                  .map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.title}
                    </option>
                  ))}
              </select>
            </label>
            {creationRequest ? (
              <section className="field-wide quote-link-summary" aria-label="Cotización vinculada">
                <strong>Cotización vinculada a solicitud</strong>
                <span>Instalación y equipo se derivan de la solicitud.</span>
              </section>
            ) : (
              <section
                className="field-wide quote-link-summary"
                aria-label="Cotización independiente"
              >
                <strong>Cotización independiente</strong>
                <span>Se guardará sin Instalación ni Equipo vinculados.</span>
              </section>
            )}
            <label>
              Referencia de servicio (opcional)
              <input name="serviceReference" maxLength={500} />
            </label>
            <label>
              Contexto tÃ©cnico (opcional)
              <textarea name="technicalContext" maxLength={2000} />
            </label>
            {profile?.role === 'admin' && (
              <label>
                Operador asignado (opcional)
                <select name="assignedTo">
                  <option value="">Sin asignar</option>
                  {users.data
                    .filter((user) => user.role === 'operator' && user.status === 'active')
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {message && <p className="form-message form-message--error field-wide">{message}</p>}
            <button
              className="button button--primary field-wide"
              disabled={busy || clients.data.length === 0}
            >
              {busy ? 'Creando…' : 'Crear cotización'}
            </button>
          </form>
        </Modal>
      )}
      {selected && profile && (
        <QuoteEditor
          quote={selected}
          profileId={profile.uid}
          profileRole={profile.role}
          catalog={catalog.data}
          client={clients.data.find((client) => client.id === selected.clientId)}
          site={sites.data.find((site) => site.id === selected.siteId)}
          equipment={equipment.data.find((item) => item.id === selected.equipmentId)}
          onClose={closeQuote}
          onChanged={async () => {
            await quotes.reload();
            setSelected(await getQuoteRecord(selected.id));
          }}
          onCorrectionCreated={async (quoteId) => {
            await quotes.reload();
            const created = await getQuoteRecord(quoteId);
            if (created) {
              openQuote(created);
            }
          }}
        />
      )}
    </>
  );
}

function quoteStatusLabel(status: Quote['status']) {
  return (
    {
      draft: 'Borrador',
      issued: 'Emitida',
      sent: 'Enviada',
      accepted: 'Aceptada',
      rejected: 'Rechazada',
      cancelled: 'Cancelada',
      expired: 'Vencida',
    } as const
  )[status];
}

function documentStatusLabel(status: Quote['documentStatus']) {
  return (
    {
      not_generated: 'Sin PDF',
      generating: 'Generando PDF',
      ready: 'PDF listo',
      failed: 'PDF con fallo',
    } as const
  )[status];
}

function QuoteCreationGuide() {
  return (
    <ol className="quote-guide" aria-label="Requisitos de la cotización">
      <li>
        <span>1</span>
        <strong>Cliente</strong>
        <small>Registro activo</small>
      </li>
      <li>
        <span>2</span>
        <strong>Instalación</strong>
        <small>Opcional para cotizaciones independientes</small>
      </li>
      <li>
        <span>3</span>
        <strong>Solicitud</strong>
        <small>Referencia de servicio opcional</small>
      </li>
      <li>
        <span>4</span>
        <strong>Equipo</strong>
        <small>Contexto tÃ©cnico, instalaciÃ³n y equipo opcionales</small>
      </li>
    </ol>
  );
}

export function MissingRequirements({role}: {role: UserRole | undefined}) {
  return (
    <section className="requirements-panel field-wide" role="status">
      <h3>Aún no puedes crear una cotización</h3>
      <p>
        Necesitas una solicitud asignada o en progreso vinculada con un cliente y una instalación.
        No se permiten cotizaciones libres porque romperían la trazabilidad.
      </p>
      <div className="button-row">
        <Link className="button button--ghost" href="/clients">
          Ver clientes
        </Link>
        <Link className="button button--ghost" href="/sites">
          Ver instalaciones
        </Link>
        <Link className="button button--secondary" href="/requests">
          {role === 'admin' ? 'Gestionar solicitudes' : 'Ver mis solicitudes'}
        </Link>
      </div>
    </section>
  );
}
