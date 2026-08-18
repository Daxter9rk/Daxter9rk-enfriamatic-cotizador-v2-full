import {useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import {Icon} from '../../components/Icon';
import {FilterBar} from '../../components/FilterBar';
import {Modal} from '../../components/Modal';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {usePaginatedCollection} from '../../hooks/usePaginatedCollection';
import type {CatalogItem} from '../../models/domain';
import {catalogItemInputSchema} from '../../models/schemas';
import {
  catalogImageErrorMessage,
  catalogImageTechnicalCode,
  deleteCatalogImage,
  getCatalogImageBlob,
  upsertCatalogImage,
} from '../../services/firebase/catalogImages';
import {constraints, setKnownDocument, updateDocument} from '../../services/firebase/data';
import {buildSearchTokens, matchesCatalogSearch, normalizeCatalogCode} from '../../utils/catalog';
import {formatCurrency} from '../../utils/format';
import {reportFileDiagnostic} from '../../utils/privateFiles';

export function CommercialCatalogPage() {
  const {profile} = useAuth();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [unit, setUnit] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('az');
  const catalog = usePaginatedCollection<CatalogItem>(
    'catalogItems',
    profile?.role === 'operator'
      ? [constraints.activeOnly()]
      : status === 'all'
        ? []
        : [constraints.status(status)],
    [
      {field: 'name', direction: 'asc'},
      {field: '__name__', direction: 'asc'},
    ],
    25,
    true,
    `${profile?.role ?? 'operator'}|${status}|${search}|${type}|${category}|${unit}|${sort}`,
  );
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(catalog.data.map((item) => item.category))].sort(),
    [catalog.data],
  );
  const visible = useMemo(
    () =>
      catalog.data
        .filter(
          (item) =>
            (type === 'all' || item.type === type) &&
            (category === 'all' || item.category === category) &&
            (unit === 'all' || item.unit === unit) &&
            (status === 'all' || item.status === status) &&
            matchesCatalogSearch(item, search),
        )
        .sort((left, right) => {
          if (sort === 'za') return right.name.localeCompare(left.name, 'es-MX');
          if (sort === 'price-desc') return right.basePrice - left.basePrice;
          if (sort === 'price-asc') return left.basePrice - right.basePrice;
          return left.name.localeCompare(right.name, 'es-MX');
        }),
    [catalog.data, category, search, sort, status, type, unit],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || profile.role !== 'admin' || !editing) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      const code = normalizeCatalogCode(String(form.get('code')));
      const parsed = catalogItemInputSchema.parse({
        code,
        type: form.get('type'),
        name: form.get('name'),
        description: form.get('description'),
        category: form.get('category'),
        unit: form.get('unit'),
        brand: String(form.get('brand') || '') || null,
        model: String(form.get('model') || '') || null,
        basePrice: Number(form.get('basePrice')),
        // Kept only for historical schema compatibility; IVA is global.
        taxable: true,
        status: form.get('status'),
        searchTokens: buildSearchTokens(
          code,
          String(form.get('name')),
          String(form.get('description')),
          String(form.get('category')),
          String(form.get('brand')),
          String(form.get('model')),
        ),
      });
      if (editing === 'new') {
        if (catalog.data.some((item) => item.code === code)) {
          throw new Error('Ya existe un artículo con ese código.');
        }
        await setKnownDocument('catalogItems', code, parsed, profile.uid);
      } else {
        if (editing.code !== code) throw new Error('El código no se puede modificar.');
        await updateDocument('catalogItems', editing.id, parsed, profile.uid);
      }
      setEditing(null);
      await catalog.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible guardar el artículo.');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (item: CatalogItem) => {
    if (!profile || profile.role !== 'admin') return;
    setBusy(true);
    setMessage(null);
    try {
      await updateDocument('catalogItems', item.id, {status: 'inactive'}, profile.uid);
      await catalog.reload();
    } catch {
      setMessage('No fue posible desactivar el artículo.');
    } finally {
      setBusy(false);
    }
  };

  if (catalog.loading && catalog.data.length === 0) {
    return <StatePanel kind="loading" title="Cargando catálogo comercial…" />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Oferta comercial"
        title="Catálogo de productos y servicios"
        description="Precios base y conceptos reutilizables con snapshot independiente en cada cotización."
        actions={
          profile?.role === 'admin' ? (
            <button className="button button--primary" onClick={() => setEditing('new')}>
              Nuevo artículo
            </button>
          ) : null
        }
      />
      <FilterBar
        label="Filtros del catálogo"
        search={search}
        searchPlaceholder="Código, nombre, marca o modelo…"
        sort={sort}
        sortOptions={[
          {value: 'az', label: 'A–Z'},
          {value: 'za', label: 'Z–A'},
          {value: 'price-desc', label: 'Mayor precio'},
          {value: 'price-asc', label: 'Menor precio'},
        ]}
        onSearch={setSearch}
        onSort={setSort}
        onClear={() => {
          setSearch('');
          setType('all');
          setCategory('all');
          setUnit('all');
          setStatus('all');
          setSort('az');
        }}
      >
        <select aria-label="Tipo" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">Productos y servicios</option>
          <option value="product">Productos</option>
          <option value="service">Servicios</option>
        </select>
        <select
          aria-label="Categoría"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">Todas las categorías</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select aria-label="Unidad" value={unit} onChange={(event) => setUnit(event.target.value)}>
          <option value="all">Todas las unidades</option>
          {[...new Set(catalog.data.map((item) => item.unit))].sort().map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        {profile?.role === 'admin' && (
          <select
            aria-label="Estado"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Activos e inactivos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        )}
      </FilterBar>
      {catalog.error ? (
        <StatePanel kind="error" title="No fue posible cargar el catálogo">
          <button className="button button--secondary" onClick={() => void catalog.reload()}>
            Reintentar
          </button>
        </StatePanel>
      ) : visible.length === 0 ? (
        <StatePanel
          title={
            catalog.data.length === 0
              ? 'No existen artículos comerciales todavía'
              : 'No se encontraron coincidencias con los filtros actuales'
          }
        >
          <p>
            {catalog.data.length === 0
              ? 'Crea el primer artículo comercial.'
              : 'Prueba otra búsqueda o limpia los filtros.'}
          </p>
        </StatePanel>
      ) : (
        <section className="catalog-grid" aria-label={`${visible.length} artículos`}>
          {visible.map((item) => (
            <article className="catalog-card" key={item.id}>
              <CatalogImage
                item={item}
                admin={profile?.role === 'admin'}
                onChanged={() => catalog.reload()}
              />
              <div className="catalog-card__top">
                <span className={`catalog-type catalog-type--${item.type}`}>
                  {item.type === 'product' ? 'Producto' : 'Servicio'}
                </span>
                <span className={`badge badge--${item.status}`}>
                  {item.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <small>{item.code}</small>
              <h2>{item.name}</h2>
              <p>{item.description}</p>
              <dl>
                <div>
                  <dt>Categoría</dt>
                  <dd>{item.category}</dd>
                </div>
                <div>
                  <dt>Unidad</dt>
                  <dd>{item.unit}</dd>
                </div>
                {(item.brand || item.model) && (
                  <div>
                    <dt>Marca / modelo</dt>
                    <dd>{[item.brand, item.model].filter(Boolean).join(' · ')}</dd>
                  </div>
                )}
              </dl>
              <footer>
                <strong>{formatCurrency(item.basePrice)}</strong>
                <span>Precio antes de IVA</span>
              </footer>
              {profile?.role === 'admin' && (
                <div className="button-row">
                  <button className="button button--ghost" onClick={() => setEditing(item)}>
                    Editar
                  </button>
                  {item.status === 'active' && (
                    <button
                      className="button button--danger"
                      disabled={busy}
                      onClick={() => void deactivate(item)}
                    >
                      Desactivar
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
      {!catalog.loading && !catalog.error && (catalog.page > 1 || catalog.hasMore) && (
        <nav className="button-row" aria-label="Paginación del catálogo comercial">
          <button
            className="button button--ghost"
            disabled={catalog.page === 1}
            onClick={() => void catalog.previousPage()}
          >
            Anteriores
          </button>
          <span>Página {catalog.page}</span>
          <button
            className="button button--ghost"
            disabled={!catalog.hasMore}
            onClick={() => void catalog.nextPage()}
          >
            Siguientes
          </button>
        </nav>
      )}
      {message && !editing && <p className="form-message form-message--error">{message}</p>}
      {editing && profile?.role === 'admin' && (
        <CatalogEditor
          item={editing}
          busy={busy}
          message={message}
          onClose={() => setEditing(null)}
          onSubmit={submit}
        />
      )}
    </>
  );
}

function CatalogEditor({
  item,
  busy,
  message,
  onClose,
  onSubmit,
}: {
  item: CatalogItem | 'new';
  busy: boolean;
  message: string | null;
  onClose(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): Promise<void>;
}) {
  const current = item === 'new' ? null : item;
  return (
    <Modal
      title={current ? `Editar ${current.code}` : 'Nuevo artículo comercial'}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
        <label>
          Código
          <input
            name="code"
            required
            maxLength={40}
            defaultValue={current?.code}
            readOnly={Boolean(current)}
          />
        </label>
        <label>
          Tipo
          <select name="type" defaultValue={current?.type ?? 'product'}>
            <option value="product">Producto</option>
            <option value="service">Servicio</option>
          </select>
        </label>
        <label className="field-wide">
          Nombre
          <input name="name" required maxLength={160} defaultValue={current?.name} />
        </label>
        <label className="field-wide">
          Descripción
          <textarea
            name="description"
            required
            maxLength={2000}
            defaultValue={current?.description}
          />
        </label>
        <label>
          Categoría
          <input name="category" required maxLength={120} defaultValue={current?.category} />
        </label>
        <label>
          Unidad
          <input name="unit" required maxLength={40} defaultValue={current?.unit ?? 'pieza'} />
        </label>
        <label>
          Marca
          <input name="brand" maxLength={160} defaultValue={current?.brand ?? ''} />
        </label>
        <label>
          Modelo
          <input name="model" maxLength={160} defaultValue={current?.model ?? ''} />
        </label>
        <label>
          Precio base (MXN)
          <input
            name="basePrice"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={current?.basePrice ?? 0}
          />
        </label>
        <label>
          Estado
          <select name="status" defaultValue={current?.status ?? 'active'}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
        {message && <p className="form-message form-message--error field-wide">{message}</p>}
        <button className="button button--primary field-wide" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar artículo'}
        </button>
      </form>
    </Modal>
  );
}

function CatalogImage({
  item,
  admin,
  onChanged,
}: {
  item: CatalogItem;
  admin: boolean;
  onChanged(): Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const hasImage = Boolean(item.imageStoragePath && item.imageStatus === 'ready');

  useEffect(() => {
    if (!hasImage) {
      replaceObjectUrl(null);
      setUrl(null);
      return;
    }
    let cancelled = false;
    void getCatalogImageBlob(item.id)
      .then((blob) => {
        if (cancelled) return;
        replaceObjectUrl(blob);
      })
      .catch((error) => {
        if (!cancelled) {
          setUrl(null);
          setMessage(catalogImageErrorMessage(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasImage, item.id, item.imageStoragePath]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const replaceObjectUrl = (blob: Blob | null) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = blob ? URL.createObjectURL(blob) : null;
    setUrl(objectUrlRef.current);
  };

  const selectImage = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await upsertCatalogImage(item.id, file);
      replaceObjectUrl(file);
      await onChanged();
      if (result.cleanupPending) {
        setMessage('La imagen se guardó; la limpieza anterior se reintentará de forma segura.');
      }
    } catch (error) {
      reportFileDiagnostic({
        stage: 'entity-link',
        service: 'function',
        errorCode: catalogImageTechnicalCode(error),
        resourceType: 'catalog',
        resourceId: item.id,
      });
      setMessage(catalogImageErrorMessage(error));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeImage = async () => {
    if (busy || !window.confirm('¿Eliminar la imagen actual del artículo?')) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await deleteCatalogImage(item.id);
      replaceObjectUrl(null);
      await onChanged();
      if (result.cleanupPending) {
        setMessage('La referencia fue retirada; la limpieza física queda pendiente de reintento.');
      }
    } catch (error) {
      reportFileDiagnostic({
        stage: 'cleanup',
        service: 'function',
        errorCode: catalogImageTechnicalCode(error),
        resourceType: 'catalog',
        resourceId: item.id,
      });
      setMessage(catalogImageErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="catalog-card__image">
        {url ? (
          <img src={url} alt={`Imagen de ${item.name}`} />
        ) : (
          <Icon name={item.type === 'product' ? 'equipment' : 'support'} width={34} height={34} />
        )}
      </div>
      {admin && (
        <div className="button-row catalog-card__image-actions">
          <input
            ref={inputRef}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void selectImage(event.target.files?.[0])}
          />
          <button
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Procesando…' : hasImage ? 'Cambiar imagen' : 'Agregar imagen'}
          </button>
          {hasImage && (
            <button
              type="button"
              className="button button--danger"
              disabled={busy}
              onClick={() => void removeImage()}
            >
              Eliminar imagen
            </button>
          )}
        </div>
      )}
      {message && <p className="form-message form-message--error">{message}</p>}
    </>
  );
}
