import {useMemo, useState, type FormEvent} from 'react';
import {Link} from 'wouter';
import {useAuth} from '../../app/providers/AuthProvider';
import {Modal} from '../../components/Modal';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import type {CatalogItem, Client, Quote, ServiceRequest, Site, UserRole} from '../../models/domain';
import {constraints, createDocument, getDocument} from '../../services/firebase/data';
import {formatCurrency, formatDate} from '../../utils/format';
import {QuoteEditor} from './QuoteEditor';

export function QuotesPage() {
  const {profile} = useAuth();
  const operatorFilter = profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : [];
  const masterDataFilter =
    profile?.role === 'operator' ? [constraints.authorizedFor(profile.uid)] : [];
  const quotes = useCollection<Quote>('quotes', operatorFilter);
  const requests = useCollection<ServiceRequest>('requests', operatorFilter);
  const clients = useCollection<Client>('clients', masterDataFilter);
  const sites = useCollection<Site>('sites', masterDataFilter);
  const catalog = useCollection<CatalogItem>('catalogItems', [constraints.activeOnly()], 100);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const validRequests = requests.data.filter((request) =>
    ['assigned', 'in_progress'].includes(request.status),
  );
  const visible = useMemo(
    () =>
      statusFilter === 'all'
        ? quotes.data
        : quotes.data.filter((quote) => quote.status === statusFilter),
    [quotes.data, statusFilter],
  );

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
      const created = await getDocument<Quote>('quotes', id);
      if (created) setSelected(created);
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
      <section className="toolbar">
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
        <span>{visible.length} cotizaciones</span>
      </section>
      {quotes.error ? (
        <StatePanel kind="error" title="No fue posible cargar cotizaciones">
          <button className="button button--secondary" onClick={() => void quotes.reload()}>
            Reintentar
          </button>
        </StatePanel>
      ) : visible.length === 0 ? (
        <StatePanel title="No hay cotizaciones para este filtro" />
      ) : (
        <section className="record-grid">
          {visible.map((quote) => (
            <button
              className="record-card record-card--button"
              key={quote.id}
              onClick={() => setSelected(quote)}
              data-testid={`quote-${quote.id}`}
            >
              <div className="record-card__top">
                <span className={`badge badge--${quote.status}`}>{quote.status}</span>
                <span>{quote.documentStatus}</span>
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
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await quotes.reload();
            setSelected(await getDocument<Quote>('quotes', selected.id));
          }}
        />
      )}
    </>
  );
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
