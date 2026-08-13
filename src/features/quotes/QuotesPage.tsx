import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {Link, useLocation, useSearch} from 'wouter';
import {useAuth} from '../../app/providers/AuthProvider';
import {Modal} from '../../components/Modal';
import {FilterBar} from '../../components/FilterBar';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
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
import {getQuoteRecord} from '../../modules/quotes';
import {constraints, createDocument} from '../../services/firebase/data';
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
  const operatorFilter = profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : [];
  const masterDataFilter =
    profile?.role === 'operator' ? [constraints.authorizedFor(profile.uid)] : [];
  const quotes = useCollection<Quote>('quotes', operatorFilter);
  const requests = useCollection<ServiceRequest>('requests', operatorFilter);
  const clients = useCollection<Client>('clients', masterDataFilter);
  const sites = useCollection<Site>('sites', masterDataFilter);
  const equipment = useCollection<Equipment>('equipment', masterDataFilter);
  const catalog = useCollection<CatalogItem>('catalogItems', [constraints.activeOnly()], 100);
  const users = useCollection<UserProfile>('users', [], 100, profile?.role === 'admin');
  const [selected, setSelected] = useState<Quote | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [quoteSearch, setQuoteSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState<'cards' | 'list' | 'table'>(
    () =>
      (localStorage.getItem('enfriamatic:quotes-view') as 'cards' | 'list' | 'table') || 'cards',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const quoteId = detailIdFromSearch(search, 'quote');
    if (quoteId && selected?.id !== quoteId) {
      const target = quotes.data.find((quote) => quote.id === quoteId);
      if (target) setSelected(target);
      else if (!quotes.loading) {
        setMessage('La cotización no existe o no tienes permiso para consultarla.');
      }
    }
    if (!quoteId && selected) setSelected(null);
  }, [quotes.data, quotes.loading, search, selected]);

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
  const visible = useMemo(() => {
    const term = quoteSearch.trim().toLocaleLowerCase('es-MX');
    const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : 0;
    return quotes.data
      .filter((quote) => {
        const clientName = clients.data.find((client) => client.id === quote.clientId)?.name ?? '';
        return (
          (statusFilter === 'all' || quote.status === statusFilter) &&
          (clientFilter === 'all' || quote.clientId === clientFilter) &&
          (creatorFilter === 'all' || quote.createdBy === creatorFilter) &&
          (!start || (quote.createdAt?.toMillis?.() ?? 0) >= start) &&
          (!term || `${quote.folio} ${clientName}`.toLocaleLowerCase('es-MX').includes(term))
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
    quotes.data,
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
      const request = validRequests.find((item) => item.id === String(form.get('requestId')));
      if (!request) throw new Error('Selecciona una solicitud asignada o en progreso.');
      const id = await createDocument(
        'quotes',
        {
          folio: '',
          requestId: request.id,
          assignedTo: request.assignedTo ?? null,
          clientId: request.clientId,
          siteId: request.siteId,
          equipmentId: request.equipmentId ?? null,
          status: 'draft',
          documentStatus: 'not_generated',
          currency: 'MXN',
          taxRate: 0.16,
          discountDisplayMode: 'detailed',
          subtotalOriginal: 0,
          discountTotal: 0,
          subtotalFinal: 0,
          taxTotal: 0,
          grandTotal: 0,
          notes: '',
          validityDays: 15,
          validUntil: null,
          issuedAt: null,
          issuedBy: null,
          originalQuoteId: null,
          revisionNumber: 1,
          locked: false,
        },
        profile.uid,
      );
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
            onClick={() => setCreating(true)}
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
      {quotes.error ? (
        <StatePanel kind="error" title="No fue posible cargar cotizaciones">
          <button className="button button--secondary" onClick={() => void quotes.reload()}>
            Reintentar
          </button>
        </StatePanel>
      ) : visible.length === 0 ? (
        <StatePanel title="No hay cotizaciones para este filtro" />
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
      {creating && (
        <Modal title="Nueva cotización" onClose={() => setCreating(false)}>
          <QuoteCreationGuide />
          <form className="form-grid" onSubmit={(event) => void createQuote(event)}>
            <label className="field-wide">
              Solicitud asignada o en progreso
              <select name="requestId" required data-testid="quote-request">
                <option value="">Selecciona</option>
                {validRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.title}
                  </option>
                ))}
              </select>
            </label>
            {validRequests.length === 0 && <MissingRequirements role={profile?.role} />}
            {message && <p className="form-message form-message--error field-wide">{message}</p>}
            <button
              className="button button--primary field-wide"
              disabled={busy || validRequests.length === 0}
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
        <small>Ligada al cliente</small>
      </li>
      <li>
        <span>3</span>
        <strong>Solicitud</strong>
        <small>Asignada o en progreso</small>
      </li>
      <li>
        <span>4</span>
        <strong>Equipo</strong>
        <small>Opcional</small>
      </li>
    </ol>
  );
}

function MissingRequirements({role}: {role: UserRole | undefined}) {
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
