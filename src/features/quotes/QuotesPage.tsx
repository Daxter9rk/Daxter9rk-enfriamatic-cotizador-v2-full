import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import {Modal} from '../../components/Modal';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import type {Client, Quote, QuoteItem, ServiceRequest, Site} from '../../models/domain';
import {quoteItemInputSchema} from '../../models/schemas';
import {
  callFunction,
  constraints,
  createDocument,
  deleteQuoteItem,
  getDocument,
  listQuoteItems,
  saveQuoteItem,
  updateDocument,
} from '../../services/firebase/data';
import {calculateItem, calculateQuoteTotals, discountModeLabel} from '../../utils/calculations';
import {formatCurrency, formatDate, safeFileName} from '../../utils/format';

interface IssueResult {
  quoteId: string;
  documentId: string;
  folio: string;
  status: 'issued';
}

interface DownloadResult {
  base64: string;
  mimeType: 'application/pdf';
  fileName: string;
}

export function QuotesPage() {
  const {profile} = useAuth();
  const quotes = useCollection<Quote>(
    'quotes',
    profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : [],
  );
  const requests = useCollection<ServiceRequest>(
    'requests',
    profile?.role === 'operator' ? [constraints.assignedTo(profile.uid)] : [],
  );
  const operatorAccess =
    profile?.role === 'operator' ? [constraints.authorizedFor(profile.uid)] : [];
  const clients = useCollection<Client>('clients', operatorAccess);
  const sites = useCollection<Site>('sites', operatorAccess);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      statusFilter === 'all'
        ? quotes.data
        : quotes.data.filter((quote) => quote.status === statusFilter),
    [quotes.data, statusFilter],
  );

  const createDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      const request = requests.data.find((item) => item.id === String(form.get('requestId')));
      if (!request || !['assigned', 'in_progress'].includes(request.status)) {
        throw new Error('Selecciona una solicitud asignada o en progreso.');
      }
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
      setMessage(error instanceof Error ? error.message : 'No se pudo crear el borrador.');
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
        description="Borradores, emisión controlada, documentos y correcciones."
        actions={
          <button
            className="button button--primary"
            onClick={() => setCreating(true)}
            data-testid="new-quote"
          >
            Nuevo borrador
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
            <option value="expired">Expirada</option>
          </select>
        </label>
        <span>{visible.length} cotizaciones</span>
      </section>
      {quotes.error ? (
        <StatePanel kind="error" title="No fue posible cargar cotizaciones">
          <p>{quotes.error}</p>
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
        <Modal title="Crear borrador" onClose={() => setCreating(false)}>
          <form className="form-grid" onSubmit={(event) => void createDraft(event)}>
            <label className="field-wide">
              Solicitud
              <select name="requestId" required data-testid="quote-request">
                <option value="">Selecciona</option>
                {requests.data
                  .filter((request) => ['assigned', 'in_progress'].includes(request.status))
                  .map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.title}
                    </option>
                  ))}
              </select>
            </label>
            {message && <p className="form-message form-message--error field-wide">{message}</p>}
            <button className="button button--primary field-wide" disabled={busy}>
              {busy ? 'Creando…' : 'Crear borrador'}
            </button>
          </form>
        </Modal>
      )}
      {selected && profile && (
        <QuoteEditor
          quote={selected}
          profileId={profile.uid}
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

function QuoteEditor({
  quote,
  profileId,
  client,
  site,
  onClose,
  onChanged,
}: {
  quote: Quote;
  profileId: string;
  client: Client | undefined;
  site: Site | undefined;
  onClose(): void;
  onChanged(): Promise<void>;
}) {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const totals = useMemo(() => calculateQuoteTotals(items, quote.taxRate), [items, quote.taxRate]);

  const reloadItems = async () => {
    setLoading(true);
    try {
      setItems(await listQuoteItems<QuoteItem>(quote.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadItems();
    // quote.id is stable while the modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.id]);

  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      const parsed = quoteItemInputSchema.parse({
        position: items.length,
        quantity: Number(form.get('quantity')),
        unit: form.get('unit'),
        equipmentOrService: form.get('equipmentOrService'),
        brand: form.get('brand'),
        model: form.get('model'),
        description: form.get('description'),
        originalUnitPrice: Number(form.get('originalUnitPrice')),
        discountType: form.get('discountType'),
        discountValue: Number(form.get('discountValue')),
        taxable: form.get('taxable') === 'on',
      });
      const calculated = calculateItem(parsed);
      await saveQuoteItem(quote.id, null, {...parsed, ...calculated});
      const nextItems = await listQuoteItems<QuoteItem>(quote.id);
      const nextTotals = calculateQuoteTotals(nextItems, quote.taxRate);
      await updateDocument('quotes', quote.id, nextTotals, profileId);
      setItems(nextItems);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la partida.');
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setBusy(true);
    await deleteQuoteItem(quote.id, itemId);
    const next = await listQuoteItems<QuoteItem>(quote.id);
    await updateDocument('quotes', quote.id, calculateQuoteTotals(next, quote.taxRate), profileId);
    setItems(next);
    setBusy(false);
  };

  const issue = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await callFunction<{quoteId: string; idempotencyKey: string}, IssueResult>(
        'issueQuote',
        {
          quoteId: quote.id,
          idempotencyKey: crypto.randomUUID(),
        },
      );
      setMessage(`Cotización ${result.folio} emitida correctamente.`);
      await onChanged();
    } catch {
      setMessage('La emisión no concluyó. El borrador permanece editable y puede reintentarse.');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const result = await callFunction<{quoteId: string}, DownloadResult>('downloadQuotePdf', {
        quoteId: quote.id,
      });
      const bytes = Uint8Array.from(atob(result.base64), (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], {type: result.mimeType}));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName || safeFileName(quote.folio);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage('No fue posible descargar el PDF autorizado.');
    } finally {
      setBusy(false);
    }
  };

  const correction = async () => {
    setBusy(true);
    try {
      await callFunction('createCorrection', {quoteId: quote.id});
      setMessage('Corrección creada con una nueva solicitud y borrador relacionados.');
    } catch {
      setMessage('No se pudo crear la corrección.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={quote.folio || 'Editor de borrador'} onClose={onClose}>
      <div className="quote-editor">
        <header className="quote-summary">
          <div>
            <span>Cliente</span>
            <strong>{client?.name ?? quote.clientId}</strong>
          </div>
          <div>
            <span>Instalación</span>
            <strong>{site?.name ?? quote.siteId}</strong>
          </div>
          <div>
            <span>Estado</span>
            <strong>{quote.status}</strong>
          </div>
        </header>
        {loading ? (
          <p>Cargando partidas…</p>
        ) : (
          <>
            <div className="quote-items">
              {items.length === 0 ? (
                <p className="empty-copy">Agrega al menos una partida para emitir.</p>
              ) : (
                items.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.description}</strong>
                      <span>
                        {item.quantity} {item.unit} · {formatCurrency(item.finalUnitPrice)}
                      </span>
                    </div>
                    <strong>{formatCurrency(item.lineSubtotal)}</strong>
                    {!quote.locked && (
                      <button
                        className="icon-button"
                        aria-label={`Eliminar ${item.description}`}
                        disabled={busy}
                        onClick={() => void removeItem(item.id)}
                      >
                        ×
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
            {!quote.locked && (
              <form
                className="form-grid quote-item-form"
                onSubmit={(event) => void saveItem(event)}
              >
                <label>
                  Cantidad
                  <input
                    name="quantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue="1"
                    required
                  />
                </label>
                <label>
                  Unidad
                  <input name="unit" defaultValue="servicio" maxLength={40} required />
                </label>
                <label className="field-wide">
                  Concepto
                  <input
                    name="description"
                    maxLength={2000}
                    required
                    data-testid="quote-item-description"
                  />
                </label>
                <label>
                  Equipo/servicio
                  <input name="equipmentOrService" maxLength={160} />
                </label>
                <label>
                  Marca
                  <input name="brand" maxLength={160} />
                </label>
                <label>
                  Modelo
                  <input name="model" maxLength={160} />
                </label>
                <label>
                  Precio unitario
                  <input
                    name="originalUnitPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    data-testid="quote-item-price"
                  />
                </label>
                <label>
                  Descuento
                  <select name="discountType" defaultValue="none">
                    <option value="none">Sin descuento</option>
                    <option value="percentage">Porcentaje</option>
                    <option value="fixed">Importe fijo</option>
                  </select>
                </label>
                <label>
                  Valor descuento
                  <input name="discountValue" type="number" min="0" step="0.01" defaultValue="0" />
                </label>
                <label className="checkbox">
                  <input name="taxable" type="checkbox" defaultChecked /> Aplica IVA
                </label>
                <button className="button button--secondary field-wide" disabled={busy}>
                  Agregar partida
                </button>
              </form>
            )}
            <section className="totals-card">
              <div>
                <span>Subtotal original</span>
                <strong>{formatCurrency(totals.subtotalOriginal)}</strong>
              </div>
              <div>
                <span>Descuento</span>
                <strong>-{formatCurrency(totals.discountTotal)}</strong>
              </div>
              <div>
                <span>Subtotal</span>
                <strong>{formatCurrency(totals.subtotalFinal)}</strong>
              </div>
              <div>
                <span>IVA {quote.taxRate * 100}%</span>
                <strong>{formatCurrency(totals.taxTotal)}</strong>
              </div>
              <div className="totals-card__grand">
                <span>Total</span>
                <strong>{formatCurrency(totals.grandTotal)}</strong>
              </div>
            </section>
            <div className="button-row">
              <button className="button button--ghost" onClick={() => setPreview(true)}>
                Vista previa
              </button>
              {quote.status === 'draft' && (
                <button
                  className="button button--primary"
                  disabled={busy || items.length === 0}
                  onClick={() => void issue()}
                  data-testid="issue-quote"
                >
                  {busy ? 'Procesando…' : 'Generar PDF y emitir'}
                </button>
              )}
              {quote.documentStatus === 'ready' && (
                <button
                  className="button button--secondary"
                  disabled={busy}
                  onClick={() => void download()}
                >
                  Descargar PDF
                </button>
              )}
              {quote.status === 'issued' && (
                <button
                  className="button button--ghost"
                  disabled={busy}
                  onClick={() => void correction()}
                >
                  Crear corrección
                </button>
              )}
            </div>
            {message && (
              <p className="form-message" role="status">
                {message}
              </p>
            )}
          </>
        )}
      </div>
      {preview && (
        <div className="preview-overlay">
          <button
            className="icon-button"
            aria-label="Cerrar vista previa"
            onClick={() => setPreview(false)}
          >
            ×
          </button>
          <article className="quote-preview">
            <h2>{quote.folio || 'BORRADOR'}</h2>
            <p>
              {client?.name} · {site?.name}
            </p>
            <p>{discountModeLabel[quote.discountDisplayMode]}</p>
            {items.map((item) => (
              <div key={item.id}>
                <span>
                  {item.quantity} × {item.description}
                </span>
                <strong>{formatCurrency(item.lineSubtotal)}</strong>
              </div>
            ))}
            <footer>Total {formatCurrency(totals.grandTotal)} MXN</footer>
          </article>
        </div>
      )}
    </Modal>
  );
}
