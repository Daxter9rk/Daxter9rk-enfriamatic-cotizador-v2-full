import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {Link} from 'wouter';
import {Modal} from '../../components/Modal';
import type {
  CatalogItem,
  Client,
  Quote,
  QuoteItem,
  QuoteStatus,
  Site,
  UserRole,
} from '../../models/domain';
import {quoteItemInputSchema} from '../../models/schemas';
import {
  callFunction,
  deleteQuoteItem,
  listQuoteItems,
  saveQuoteItem,
  updateDocument,
} from '../../services/firebase/data';
import {calculateItem, calculateQuoteTotals, discountModeLabel} from '../../utils/calculations';
import {catalogItemToQuoteInput, matchesCatalogSearch} from '../../utils/catalog';
import {formatCurrency, safeFileName} from '../../utils/format';

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

export function QuoteEditor({
  quote,
  profileId,
  profileRole,
  catalog,
  client,
  site,
  onClose,
  onChanged,
}: {
  quote: Quote;
  profileId: string;
  profileRole: UserRole;
  catalog: CatalogItem[];
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
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogType, setCatalogType] = useState<'all' | 'product' | 'service'>('all');
  const [transitionTarget, setTransitionTarget] = useState<QuoteStatus | null>(null);
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
    // reloadItems is scoped to the stable quote opened by this modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.id]);

  const persistTotals = async () => {
    const next = await listQuoteItems<QuoteItem>(quote.id);
    await updateDocument('quotes', quote.id, calculateQuoteTotals(next, quote.taxRate), profileId);
    setItems(next);
  };

  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      const parsed = quoteItemInputSchema.parse({
        position: editingItem?.position ?? items.length,
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
        ...(editingItem?.catalogItemId
          ? {
              catalogItemId: editingItem.catalogItemId,
              catalogCode: editingItem.catalogCode,
              catalogType: editingItem.catalogType,
              catalogSnapshot: editingItem.catalogSnapshot,
            }
          : {}),
      });
      await saveQuoteItem(quote.id, editingItem?.id ?? null, {...parsed, ...calculateItem(parsed)});
      await persistTotals();
      setEditingItem(null);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la partida.');
    } finally {
      setBusy(false);
    }
  };

  const addCatalogItem = async (item: CatalogItem) => {
    setBusy(true);
    setMessage(null);
    try {
      const parsed = quoteItemInputSchema.parse(catalogItemToQuoteInput(item, items.length));
      await saveQuoteItem(quote.id, null, {...parsed, ...calculateItem(parsed)});
      await persistTotals();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo agregar el artículo.');
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await deleteQuoteItem(quote.id, itemId);
      await persistTotals();
    } catch {
      setMessage('No se pudo eliminar la partida.');
    } finally {
      setBusy(false);
    }
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
      setMessage('Corrección creada con una nueva solicitud y cotización relacionadas.');
    } catch {
      setMessage('No se pudo crear la corrección.');
    } finally {
      setBusy(false);
    }
  };

  const transition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!transitionTarget) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      await callFunction('transitionQuote', {
        quoteId: quote.id,
        to: transitionTarget,
        reason: String(form.get('reason') ?? '').trim() || null,
      });
      setMessage(`Estado actualizado a ${transitionLabel(transitionTarget)}.`);
      setTransitionTarget(null);
      await onChanged();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No se pudo actualizar el estado comercial.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={quote.folio || 'Editor de cotización'} onClose={onClose}>
      <div className="quote-editor-layout">
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
              <strong>{transitionLabel(quote.status)}</strong>
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
                        {item.catalogCode && <small>Snapshot {item.catalogCode}</small>}
                      </div>
                      <strong>{formatCurrency(item.lineSubtotal)}</strong>
                      {!quote.locked && (
                        <div className="quote-item-actions">
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => setEditingItem(item)}
                          >
                            Editar
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Eliminar ${item.description}`}
                            disabled={busy}
                            onClick={() => void removeItem(item.id)}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
              {!quote.locked && (
                <ItemForm
                  key={editingItem?.id ?? 'manual'}
                  item={editingItem}
                  busy={busy}
                  onSubmit={saveItem}
                  onCancel={() => setEditingItem(null)}
                />
              )}
              <Totals quote={quote} totals={totals} />
              <div className="button-row quote-actions">
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
                {['issued', 'sent', 'accepted', 'rejected'].includes(quote.status) && (
                  <button
                    className="button button--ghost"
                    disabled={busy}
                    onClick={() => void correction()}
                  >
                    Crear corrección
                  </button>
                )}
              </div>
              <CommercialActions
                quote={quote}
                role={profileRole}
                busy={busy}
                target={transitionTarget}
                onTarget={setTransitionTarget}
                onSubmit={transition}
              />
              {message && (
                <p className="form-message" role="status">
                  {message}
                </p>
              )}
            </>
          )}
        </div>
        {!quote.locked && (
          <CatalogPicker
            items={catalog}
            search={catalogSearch}
            type={catalogType}
            busy={busy}
            onSearch={setCatalogSearch}
            onType={setCatalogType}
            onAdd={addCatalogItem}
          />
        )}
      </div>
      {preview && (
        <Preview
          quote={quote}
          items={items}
          client={client}
          site={site}
          totals={totals}
          onClose={() => setPreview(false)}
        />
      )}
    </Modal>
  );
}

function ItemForm({
  item,
  busy,
  onSubmit,
  onCancel,
}: {
  item: QuoteItem | null;
  busy: boolean;
  onSubmit(event: FormEvent<HTMLFormElement>): Promise<void>;
  onCancel(): void;
}) {
  return (
    <form className="form-grid quote-item-form" onSubmit={(event) => void onSubmit(event)}>
      <div className="field-wide form-section-title">
        <strong>{item ? 'Editar partida' : 'Partida manual'}</strong>
        <span>Los cambios sólo afectan esta cotización.</span>
      </div>
      <label>
        Cantidad
        <input
          name="quantity"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={item?.quantity ?? 1}
          required
        />
      </label>
      <label>
        Unidad
        <input name="unit" defaultValue={item?.unit ?? 'servicio'} maxLength={40} required />
      </label>
      <label className="field-wide">
        Concepto
        <input
          name="description"
          maxLength={2000}
          required
          data-testid="quote-item-description"
          defaultValue={item?.description}
        />
      </label>
      <label>
        Equipo/servicio
        <input name="equipmentOrService" maxLength={160} defaultValue={item?.equipmentOrService} />
      </label>
      <label>
        Marca
        <input name="brand" maxLength={160} defaultValue={item?.brand} />
      </label>
      <label>
        Modelo
        <input name="model" maxLength={160} defaultValue={item?.model} />
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
          defaultValue={item?.originalUnitPrice}
        />
      </label>
      <label>
        Descuento
        <select name="discountType" defaultValue={item?.discountType ?? 'none'}>
          <option value="none">Sin descuento</option>
          <option value="percentage">Porcentaje</option>
          <option value="fixed">Importe fijo</option>
        </select>
      </label>
      <label>
        Valor descuento
        <input
          name="discountValue"
          type="number"
          min="0"
          step="0.01"
          defaultValue={item?.discountValue ?? 0}
        />
      </label>
      <label className="checkbox">
        <input name="taxable" type="checkbox" defaultChecked={item?.taxable ?? true} /> Aplica IVA
      </label>
      <button className="button button--secondary field-wide" disabled={busy}>
        {item ? 'Guardar cambios de partida' : 'Agregar partida manual'}
      </button>
      {item && (
        <button type="button" className="button button--ghost field-wide" onClick={onCancel}>
          Cancelar edición
        </button>
      )}
    </form>
  );
}

function Totals({quote, totals}: {quote: Quote; totals: ReturnType<typeof calculateQuoteTotals>}) {
  return (
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
  );
}

function CatalogPicker({
  items,
  search,
  type,
  busy,
  onSearch,
  onType,
  onAdd,
}: {
  items: CatalogItem[];
  search: string;
  type: 'all' | 'product' | 'service';
  busy: boolean;
  onSearch(value: string): void;
  onType(value: 'all' | 'product' | 'service'): void;
  onAdd(item: CatalogItem): Promise<void>;
}) {
  const visible = items.filter(
    (item) =>
      item.status === 'active' &&
      (type === 'all' || item.type === type) &&
      matchesCatalogSearch(item, search),
  );
  return (
    <aside className="quote-catalog" aria-label="Catálogo para la cotización">
      <div>
        <p className="eyebrow">Catálogo</p>
        <h2>Agregar artículos</h2>
      </div>
      <input
        type="search"
        placeholder="Buscar producto o servicio…"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />
      <div className="segmented-control">
        {(['all', 'product', 'service'] as const).map((value) => (
          <button
            type="button"
            key={value}
            className={type === value ? 'active' : ''}
            onClick={() => onType(value)}
          >
            {value === 'all' ? 'Todos' : value === 'product' ? 'Productos' : 'Servicios'}
          </button>
        ))}
      </div>
      <div className="quote-catalog__list">
        {visible.length === 0 ? (
          <p className="empty-copy">Sin coincidencias.</p>
        ) : (
          visible.map((item) => (
            <article key={item.id}>
              <div>
                <span className={`catalog-type catalog-type--${item.type}`}>
                  {item.type === 'product' ? 'Producto' : 'Servicio'}
                </span>
                <strong>{item.name}</strong>
                <small>
                  {item.code} · {item.brand || item.category}
                </small>
              </div>
              <div>
                <strong>{formatCurrency(item.basePrice)}</strong>
                <button
                  className="icon-button"
                  aria-label={`Agregar ${item.name}`}
                  disabled={busy}
                  onClick={() => void onAdd(item)}
                >
                  +
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      <Link className="button button--ghost" href="/commercial-catalog">
        Abrir catálogo completo
      </Link>
    </aside>
  );
}

function CommercialActions({
  quote,
  role,
  busy,
  target,
  onTarget,
  onSubmit,
}: {
  quote: Quote;
  role: UserRole;
  busy: boolean;
  target: QuoteStatus | null;
  onTarget(value: QuoteStatus | null): void;
  onSubmit(event: FormEvent<HTMLFormElement>): Promise<void>;
}) {
  const targets: QuoteStatus[] =
    quote.status === 'issued'
      ? ['sent', ...(role === 'admin' ? ['cancelled' as const] : [])]
      : quote.status === 'sent' && role === 'admin'
        ? ['accepted', 'rejected', 'cancelled']
        : [];
  if (targets.length === 0 && !target) return null;
  return (
    <section className="commercial-actions">
      <div>
        <p className="eyebrow">Seguimiento comercial</p>
        <h3>Actualizar estado</h3>
      </div>
      <div className="button-row">
        {targets.map((status) => (
          <button
            key={status}
            className={
              status === 'cancelled' ? 'button button--danger' : 'button button--secondary'
            }
            disabled={busy}
            onClick={() => onTarget(status)}
          >
            {transitionActionLabel(status)}
          </button>
        ))}
      </div>
      {target && (
        <form onSubmit={(event) => void onSubmit(event)}>
          <p>
            Confirmar transición:{' '}
            <strong>
              {transitionLabel(quote.status)} → {transitionLabel(target)}
            </strong>
          </p>
          {['rejected', 'cancelled'].includes(target) && (
            <label>
              Motivo obligatorio
              <textarea name="reason" required minLength={5} maxLength={1000} />
            </label>
          )}
          <div className="button-row">
            <button className="button button--primary" disabled={busy}>
              Confirmar
            </button>
            <button type="button" className="button button--ghost" onClick={() => onTarget(null)}>
              Volver
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Preview({
  quote,
  items,
  client,
  site,
  totals,
  onClose,
}: {
  quote: Quote;
  items: QuoteItem[];
  client: Client | undefined;
  site: Site | undefined;
  totals: ReturnType<typeof calculateQuoteTotals>;
  onClose(): void;
}) {
  return (
    <div className="preview-overlay">
      <button className="icon-button" aria-label="Cerrar vista previa" onClick={onClose}>
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
  );
}

function transitionLabel(status: QuoteStatus): string {
  return {
    draft: 'Borrador',
    issued: 'Emitida',
    sent: 'Enviada',
    accepted: 'Aceptada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
    expired: 'Expirada',
  }[status];
}

function transitionActionLabel(status: QuoteStatus): string {
  const labels: Partial<Record<QuoteStatus, string>> = {
    sent: 'Marcar enviada',
    accepted: 'Marcar aceptada',
    rejected: 'Marcar rechazada',
    cancelled: 'Cancelar',
  };
  return labels[status] ?? transitionLabel(status);
}
