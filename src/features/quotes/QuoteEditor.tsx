import {useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {Link} from 'wouter';
import logoUrl from '../../assets/brand/enfriamatic-logo-transparent.png';
import {Modal} from '../../components/Modal';
import type {
  CatalogItem,
  Client,
  Equipment,
  Quote,
  QuoteItem,
  QuoteStatus,
  Site,
  UserRole,
} from '../../models/domain';
import {quoteItemInputSchema} from '../../models/schemas';
import {
  calculateItem,
  calculateQuoteTotals,
  createQuoteItemFromCatalog,
  discountModeLabel,
  updateQuoteRecord,
  quoteStatusLabel,
} from '../../modules/quotes';
import {
  callFunction,
  deleteQuoteItem,
  listQuoteItems,
  saveQuoteItem,
  updateDocument,
} from '../../services/firebase/data';
import {matchesCatalogSearch} from '../../utils/catalog';
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

interface CorrectionResult {
  quoteId: string;
  requestId: string | null;
  folio: string;
  revisionNumber: number;
  idempotent: boolean;
}

export function QuoteEditor({
  quote,
  profileId,
  profileRole,
  catalog,
  client,
  site,
  equipment,
  onClose,
  onChanged,
  onCorrectionCreated,
}: {
  quote: Quote;
  profileId: string;
  profileRole: UserRole;
  catalog: CatalogItem[];
  client: Client | undefined;
  site: Site | undefined;
  equipment: Equipment | undefined;
  onClose(): void;
  onChanged(): Promise<void>;
  onCorrectionCreated?(quoteId: string): Promise<void>;
}) {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [serviceReference, setServiceReference] = useState(quote.serviceReference ?? '');
  const [technicalContext, setTechnicalContext] = useState(quote.technicalContext ?? '');
  const [preview, setPreview] = useState(false);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const panelTriggerRef = useRef<HTMLButtonElement>(null);
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const [manualItemOpen, setManualItemOpen] = useState(false);
  const [globalDiscountType, setGlobalDiscountType] = useState(
    quote.globalDiscountType ?? 'none',
  );
  const [globalDiscountValue, setGlobalDiscountValue] = useState(quote.globalDiscountValue ?? 0);
  const [applyTax, setApplyTax] = useState(quote.applyTax ?? true);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogType, setCatalogType] = useState<'all' | 'product' | 'service'>('all');
  const [transitionTarget, setTransitionTarget] = useState<QuoteStatus | null>(null);
  const restorePanelFocus = () => {
    requestAnimationFrame(() => {
      const trigger = panelTriggerRef.current?.isConnected
        ? panelTriggerRef.current
        : document.querySelector<HTMLButtonElement>('[data-testid="manual-item-trigger"]');
      trigger?.focus();
    });
  };
  const baseTotals = useMemo(
    () =>
      quote.locked || quote.status !== 'draft'
        ? {
            subtotalOriginal: quote.subtotalOriginal ?? 0,
            discountTotal: quote.discountTotal ?? 0,
            subtotalFinal: quote.subtotalFinal ?? 0,
            globalDiscountAmount: quote.globalDiscountAmount ?? 0,
            taxableBase: quote.subtotalFinal ?? 0,
            taxTotal: quote.taxTotal ?? 0,
            grandTotal: quote.grandTotal ?? 0,
          }
        : calculateQuoteTotals(
            items,
            quote.taxRate ?? 0.16,
            {type: 'none', value: 0},
            applyTax,
          ),
    [applyTax, items, quote],
  );
  const globalDiscountError =
    globalDiscountType === 'percentage' && globalDiscountValue > 100
      ? 'El descuento porcentual no puede superar 100 %.'
      : globalDiscountType === 'fixed' && globalDiscountValue > baseTotals.subtotalFinal
        ? 'El importe fijo no puede superar el subtotal después de partidas.'
        : null;
  const totals = useMemo(() => {
    if (quote.locked || quote.status !== 'draft') {
      return {
        subtotalOriginal: quote.subtotalOriginal ?? 0,
        discountTotal: quote.discountTotal ?? 0,
        subtotalFinal: quote.subtotalFinal ?? 0,
        globalDiscountAmount: quote.globalDiscountAmount ?? 0,
        taxableBase: quote.subtotalFinal ?? 0,
        taxTotal: quote.taxTotal ?? 0,
        grandTotal: quote.grandTotal ?? 0,
      };
    }
    if (globalDiscountError) return baseTotals;
    return calculateQuoteTotals(
      items,
      quote.taxRate ?? 0.16,
      {type: globalDiscountType, value: globalDiscountValue},
      applyTax,
    );
  }, [applyTax, baseTotals, globalDiscountError, globalDiscountType, globalDiscountValue, items, quote]);

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

  const persistTotals = async (
    overrides: Partial<{
      globalDiscountType: typeof globalDiscountType;
      globalDiscountValue: number;
      applyTax: boolean;
    }> = {},
  ) => {
    const next = await listQuoteItems<QuoteItem>(quote.id);
    const nextType = overrides.globalDiscountType ?? globalDiscountType;
    const nextValue = overrides.globalDiscountValue ?? globalDiscountValue;
    const nextApplyTax = overrides.applyTax ?? applyTax;
    const nextTotals = calculateQuoteTotals(
      next,
      quote.taxRate ?? 0.16,
      {type: nextType, value: nextValue},
      nextApplyTax,
    );
    await updateDocument(
      'quotes',
      quote.id,
      {
        ...nextTotals,
        globalDiscountType: nextType,
        globalDiscountValue: nextValue,
        globalDiscountAmount: nextTotals.globalDiscountAmount,
        applyTax: nextApplyTax,
      },
      profileId,
    );
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
        equipmentOrService: editingItem?.equipmentOrService ?? '',
        brand: editingItem?.brand ?? '',
        model: editingItem?.model ?? '',
        description: form.get('description'),
        originalUnitPrice: Number(form.get('originalUnitPrice')),
        discountType: form.get('discountType'),
        discountValue: Number(form.get('discountValue')),
        taxable: true,
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
      setManualItemOpen(false);
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
      const parsed = quoteItemInputSchema.parse(createQuoteItemFromCatalog(item, items.length));
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
      await onChanged();
      setMessage(`Cotización ${result.folio} emitida correctamente.`);
    } catch {
      setMessage('La emisión no concluyó. El borrador permanece editable y puede reintentarse.');
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      await updateQuoteRecord(
        quote,
        {
          notes: String(form.get('notes') ?? ''),
          serviceReference,
          technicalContext,
        },
        {id: profileId, role: profileRole},
      );
      await updateDocument(
        'quotes',
        quote.id,
        {
          ...totals,
          globalDiscountType,
          globalDiscountValue,
          globalDiscountAmount: totals.globalDiscountAmount,
          applyTax,
        },
        profileId,
      );
      await onChanged();
      setMessage('Datos de la cotización guardados.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron guardar los datos.');
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
    setMessage(null);
    try {
      const result = await callFunction<
        {quoteId: string; idempotencyKey: string},
        CorrectionResult
      >('createCorrection', {quoteId: quote.id, idempotencyKey: crypto.randomUUID()});
      if (onCorrectionCreated) await onCorrectionCreated(result.quoteId);
      else setMessage(`Se creó la revisión ${result.revisionNumber} como borrador editable.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la corrección.');
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
      setTransitionTarget(null);
      await onChanged();
      setMessage(`Estado actualizado a ${quoteStatusLabel(transitionTarget)}.`);
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
      <div className="quote-editor-layout" data-testid={`quote-editor-${quote.id}`}>
        <div className="quote-editor">
          <header className="quote-summary">
            <div>
              <span>Cliente</span>
              <strong>{client?.name ?? quote.clientId}</strong>
            </div>
            {quote.requestId ? (
              <div>
                <span>Instalación</span>
                <strong>{site?.name ?? quote.siteId}</strong>
              </div>
            ) : (
              <div>
                <span>Contexto del servicio</span>
                <strong>{quote.serviceReference || 'Sin referencia'}</strong>
              </div>
            )}
            <div>
              <span>Estado</span>
              <strong>{quoteStatusLabel(quote.status)}</strong>
            </div>
          </header>
          {loading ? (
            <p>Cargando partidas…</p>
          ) : (
            <>
              {quote.status === 'rejected' && quote.lastRejectionReason && (
                <section className="quote-rejection" role="status">
                  <strong>Cotización rechazada</strong>
                  <p>Motivo: {quote.lastRejectionReason}</p>
                  <small>
                    Registrado por {quote.lastRejectedByName || 'Administrador/a'} ·{' '}
                    {quote.lastRejectedByRole === 'operator' ? 'Operador/a' : 'Administrador/a'} ·{' '}
                    {quote.lastRejectedAt ? formatDate(quote.lastRejectedAt) : 'Fecha registrada'}
                  </small>
                </section>
              )}
              {!quote.locked && (
                <form
                  className="form-grid quote-context-form"
                  onSubmit={(event) => void saveDetails(event)}
                >
                  <label>
                    Referencia de servicio
                    <input
                      name="serviceReference"
                      className="quote-service-reference"
                      value={serviceReference}
                      maxLength={500}
                      onChange={(event) => setServiceReference(event.target.value)}
                    />
                  </label>
                  <label>
                    Contexto técnico
                    <textarea
                      name="technicalContext"
                      value={technicalContext}
                      maxLength={2000}
                      onChange={(event) => setTechnicalContext(event.target.value)}
                    />
                  </label>
                  <label className="field-wide">
                    Notas
                    <textarea name="notes" defaultValue={quote.notes ?? ''} maxLength={4000} />
                  </label>
                  <fieldset className="field-wide quote-calculation-settings">
                    <legend>Descuento global e IVA</legend>
                    <label>
                      Tipo de descuento global
                      <select
                        value={globalDiscountType}
                        onChange={(event) => {
                          const value = event.target.value as typeof globalDiscountType;
                          setGlobalDiscountType(value);
                          void persistTotals({globalDiscountType: value});
                        }}
                      >
                        <option value="none">Sin descuento</option>
                        <option value="percentage">Porcentaje</option>
                        <option value="fixed">Importe fijo</option>
                      </select>
                    </label>
                    <label>
                      Valor del descuento global
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={globalDiscountType === 'percentage' ? 100 : baseTotals.subtotalFinal}
                        value={globalDiscountValue}
                        disabled={globalDiscountType === 'none'}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setGlobalDiscountValue(value);
                          void persistTotals({globalDiscountValue: value});
                        }}
                      />
                    </label>
                    <label className="tax-switch">
                      <input
                        role="switch"
                        type="checkbox"
                        checked={applyTax}
                        onChange={(event) => {
                          const value = event.target.checked;
                          setApplyTax(value);
                          void persistTotals({applyTax: value});
                        }}
                      />
                      <span>Aplicar IVA {quote.taxRate ? `${quote.taxRate * 100} %` : '16 %'}</span>
                    </label>
                    <small>Descuento calculado: {formatCurrency(totals.globalDiscountAmount ?? 0)}</small>
                    {globalDiscountError && (
                      <small role="alert" className="form-message form-message--error">
                        {globalDiscountError}
                      </small>
                    )}
                  </fieldset>
                  <button
                    className="button button--secondary field-wide"
                    disabled={busy || Boolean(globalDiscountError)}
                  >
                    Guardar datos de cotización
                  </button>
                </form>
              )}
              {quote.locked && (
                <fieldset className="field-wide quote-calculation-settings">
                  <legend>Configuración fiscal</legend>
                  <label className="tax-switch">
                    <input role="switch" type="checkbox" checked={applyTax} disabled readOnly />
                    <span>Aplicar IVA {quote.taxRate ? `${quote.taxRate * 100} %` : '16 %'}</span>
                  </label>
                </fieldset>
              )}
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
                            onClick={(event) => {
                              panelTriggerRef.current = event.currentTarget;
                              setEditingItem(item);
                            }}
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
              {!quote.locked && (editingItem || manualItemOpen) ? (
                <ItemForm
                  key={editingItem?.id ?? 'manual'}
                  item={editingItem}
                  busy={busy}
                  onSubmit={saveItem}
                  onCancel={() => {
                    setEditingItem(null);
                    setManualItemOpen(false);
                    restorePanelFocus();
                  }}
                />
              ) : !quote.locked ? (
                <button
                  type="button"
                  className="button button--secondary"
                  ref={panelTriggerRef}
                  data-testid="manual-item-trigger"
                  onClick={() => setManualItemOpen(true)}
                >
                  Agregar partida manual
                </button>
              ) : null}
              <Totals quote={quote} totals={totals} applyTax={applyTax} />
              <div className="button-row quote-actions">
                <button
                  ref={previewTriggerRef}
                  className="button button--ghost"
                  onClick={() => setPreview(true)}
                >
                  Vista previa
                </button>
                {quote.status === 'draft' && (
                  <button
                    className="button button--primary"
                    disabled={busy || items.length === 0}
                    onClick={() => void issue()}
                    data-testid="issue-quote"
                  >
                    {quote.requestId !== undefined
                      ? busy
                        ? 'Procesando…'
                        : 'Generar PDF y emitir'
                      : 'Emisión no disponible'}
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
              {quote.commercialHistory && quote.commercialHistory.length > 0 && (
                <section className="commercial-history">
                  <h3>Historial comercial</h3>
                  {quote.commercialHistory.map((event, index) => (
                    <article key={`${event.to}-${index}`}>
                      <strong>
                        {quoteStatusLabel(event.from)} → {quoteStatusLabel(event.to)}
                      </strong>
                      {event.reason && <p>Motivo: {event.reason}</p>}
                      <small>
                        {event.actorName || 'Usuario autorizado'} ·{' '}
                        {event.at ? formatDate(event.at) : 'Fecha registrada'}
                      </small>
                    </article>
                  ))}
                </section>
              )}
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
          equipment={equipment}
          totals={totals}
          applyTax={applyTax}
          onClose={() => {
            setPreview(false);
            requestAnimationFrame(() => previewTriggerRef.current?.focus());
          }}
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
      <div className="button-row field-wide quote-item-form__actions">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button className="button button--secondary" disabled={busy}>
          {item ? 'Guardar cambios' : 'Agregar partida'}
        </button>
      </div>
    </form>
  );
}

function Totals({
  quote,
  totals,
  applyTax = quote.applyTax ?? true,
}: {
  quote: Quote;
  totals: ReturnType<typeof calculateQuoteTotals>;
  applyTax?: boolean;
}) {
  const taxLabel = Number.isFinite(quote.taxRate) ? ` (${(quote.taxRate ?? 0) * 100}%)` : '';
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
        <span>Subtotal después de partidas</span>
        <strong>{formatCurrency(totals.subtotalFinal)}</strong>
      </div>
      <div>
        <span>Descuento global</span>
        <strong>-{formatCurrency(totals.globalDiscountAmount ?? 0)}</strong>
      </div>
      <div>
        <span>Base antes de IVA</span>
        <strong>{formatCurrency(totals.taxableBase ?? totals.subtotalFinal)}</strong>
      </div>
      <div>
        <span>{applyTax ? `IVA global${taxLabel}` : 'IVA desactivado'}</span>
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
              {quoteStatusLabel(quote.status)} → {quoteStatusLabel(target)}
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
  equipment,
  totals,
  applyTax,
  onClose,
}: {
  quote: Quote;
  items: QuoteItem[];
  client: Client | undefined;
  site: Site | undefined;
  equipment: Equipment | undefined;
  totals: ReturnType<typeof calculateQuoteTotals>;
  applyTax: boolean;
  onClose(): void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pages = chunkQuoteItems(items, 10);
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);
  return (
    <div
      className="preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <button
        ref={closeButtonRef}
        className="icon-button"
        aria-label="Cerrar vista previa"
        onClick={onClose}
      >
        ×
      </button>
      <section className="quote-preview-pages" aria-label="Vista previa del documento">
        {pages.map((pageItems, pageIndex) => (
          <article className="quote-preview" key={pageIndex}>
            <span className="quote-preview__watermark">DOCUMENTO DE PRUEBA DEV</span>
            <header className="quote-preview__header">
              <div>
                <img className="quote-preview__logo" src={logoUrl} alt="Enfriamatic" />
                <small>Cotizador V2.1</small>
              </div>
              <div>
                <h2>{quote.folio || 'BORRADOR'}</h2>
                <span>
                  Fecha: {formatDate(quote.issuedAt ?? quote.createdAt)} · Vigencia:{' '}
                  {quote.validityDays} días
                </span>
              </div>
            </header>
            <section className="quote-preview__customer">
              <div>
                <span>Cliente</span>
                <strong>{client?.name ?? quote.clientId}</strong>
              </div>
              {quote.siteId && (
                <div>
                  <span>Instalación</span>
                  <strong>{site?.name ?? quote.siteId}</strong>
                </div>
              )}
              {quote.serviceReference && (
                <div>
                  <span>Referencia de servicio</span>
                  <strong>{quote.serviceReference}</strong>
                </div>
              )}
              {quote.technicalContext && (
                <div>
                  <span>Contexto técnico</span>
                  <strong>{quote.technicalContext}</strong>
                </div>
              )}
              {quote.equipmentId && (
                <div>
                  <span>Equipo</span>
                  <strong>{equipment?.name ?? quote.equipmentId}</strong>
                </div>
              )}
            </section>
            <div className="quote-preview__table">
              <div className="quote-preview__row quote-preview__row--head">
                <span>Cant.</span>
                <span>Descripción</span>
                <span>Precio</span>
                <span>Importe</span>
              </div>
              {pageItems.map((item) => (
                <div className="quote-preview__row" key={item.id}>
                  <span>
                    {item.quantity} {item.unit}
                  </span>
                  <span>
                    {item.description}
                    {(item.brand || item.model) && (
                      <small className="quote-preview__item-snapshot">
                        {[item.brand, item.model].filter(Boolean).join(' ')}
                      </small>
                    )}
                  </span>
                  <span>{formatCurrency(item.finalUnitPrice)}</span>
                  <strong>{formatCurrency(item.lineSubtotal)}</strong>
                </div>
              ))}
            </div>
            {pageIndex === pages.length - 1 && (
              <div className="quote-preview__closing">
                <section>
                  <strong>Condiciones comerciales</strong>
                  <p>{quote.notes || 'Precios en MXN. Vigencia indicada en este documento.'}</p>
                  <small>{discountModeLabel[quote.discountDisplayMode]}</small>
                </section>
                <Totals quote={quote} totals={totals} applyTax={applyTax} />
              </div>
            )}
            <footer>
              Página {pageIndex + 1} de {pages.length} · Enfriamatic
            </footer>
          </article>
        ))}
      </section>
    </div>
  );
}

export function chunkQuoteItems(items: QuoteItem[], pageSize: number) {
  if (items.length === 0) return [[]];
  return Array.from({length: Math.ceil(items.length / pageSize)}, (_, index) =>
    items.slice(index * pageSize, (index + 1) * pageSize),
  );
}

function transitionActionLabel(status: QuoteStatus): string {
  const labels: Partial<Record<QuoteStatus, string>> = {
    sent: 'Marcar enviada',
    accepted: 'Marcar aceptada',
    rejected: 'Marcar rechazada',
    cancelled: 'Cancelar',
  };
  return labels[status] ?? quoteStatusLabel(status);
}
