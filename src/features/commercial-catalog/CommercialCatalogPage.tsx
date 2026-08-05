import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {deleteObject, getBlob, ref, uploadBytes} from 'firebase/storage';
import {useAuth} from '../../app/providers/AuthProvider';
import {Icon} from '../../components/Icon';
import {FilterBar} from '../../components/FilterBar';
import {Modal} from '../../components/Modal';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import type {CatalogItem} from '../../models/domain';
import {catalogItemInputSchema} from '../../models/schemas';
import {constraints, setKnownDocument, updateDocument} from '../../services/firebase/data';
import {storage} from '../../services/firebase/config';
import {buildSearchTokens, matchesCatalogSearch, normalizeCatalogCode} from '../../utils/catalog';
import {formatCurrency} from '../../utils/format';
import {
  buildPrivateStoragePath,
  normalizeFirebaseErrorCode,
  reportFileDiagnostic,
  runCompensatedUpload,
  sanitizeVisibleFileName,
  validatePrivateFile,
} from '../../utils/privateFiles';

export function CommercialCatalogPage() {
  const {profile} = useAuth();
  const catalog = useCollection<CatalogItem>(
    'catalogItems',
    profile?.role === 'operator' ? [constraints.activeOnly()] : [],
    100,
  );
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('az');
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
            (status === 'all' || item.status === status) &&
            matchesCatalogSearch(item, search),
        )
        .sort((left, right) => {
          if (sort === 'za') return right.name.localeCompare(left.name, 'es-MX');
          if (sort === 'price-desc') return right.basePrice - left.basePrice;
          if (sort === 'price-asc') return left.basePrice - right.basePrice;
          return left.name.localeCompare(right.name, 'es-MX');
        }),
    [catalog.data, category, search, sort, status, type],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || profile.role !== 'admin' || !editing) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      const image = form.get('image');
      if (image instanceof File && image.size > 0) validatePrivateFile(image, 'catalog');
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
        taxable: form.get('taxable') === 'on',
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
      if (editing !== 'new' && form.get('removeImage') === 'on' && editing.imageStoragePath) {
        await deleteObject(ref(storage, editing.imageStoragePath));
        await updateDocument(
          'catalogItems',
          code,
          {
            imageStoragePath: null,
            imageFileName: null,
            imageMimeType: null,
            imageSizeBytes: null,
            imageStatus: null,
          },
          profile.uid,
        );
      }
      if (image instanceof File && image.size > 0) {
        const fileId = crypto.randomUUID();
        const storagePath = buildPrivateStoragePath('catalog', code, fileId, image.type);
        const previous =
          editing === 'new'
            ? null
            : {
                imageStoragePath: editing.imageStoragePath ?? null,
                imageFileName: editing.imageFileName ?? null,
                imageMimeType: editing.imageMimeType ?? null,
                imageSizeBytes: editing.imageSizeBytes ?? null,
                imageStatus: editing.imageStatus ?? null,
              };
        await runCompensatedUpload({
          resourceType: 'catalog',
          resourceId: code,
          createMetadata: () =>
            updateDocument(
              'catalogItems',
              code,
              {
                imageStoragePath: storagePath,
                imageFileName: sanitizeVisibleFileName(image.name),
                imageMimeType: image.type,
                imageSizeBytes: image.size,
                imageStatus: 'pending',
              },
              profile.uid,
            ),
          uploadStorage: () =>
            uploadBytes(ref(storage, storagePath), image, {
              contentType: image.type,
              customMetadata: {resourceType: 'catalog', resourceId: code, fileId},
            }).then(() => undefined),
          finalizeLink: async () => {
            await updateDocument('catalogItems', code, {imageStatus: 'ready'}, profile.uid);
            if (previous?.imageStoragePath && previous.imageStoragePath !== storagePath) {
              await deleteObject(ref(storage, previous.imageStoragePath));
            }
          },
          cleanupStorage: () => deleteObject(ref(storage, storagePath)),
          cleanupMetadata: () =>
            updateDocument(
              'catalogItems',
              code,
              previous ?? {
                imageStoragePath: null,
                imageFileName: null,
                imageMimeType: null,
                imageSizeBytes: null,
                imageStatus: null,
              },
              profile.uid,
            ),
        });
      }
      setEditing(null);
      await catalog.reload();
    } catch (error) {
      if (imageForDiagnostic(error)) {
        reportFileDiagnostic({
          stage: 'validation',
          service: 'client',
          errorCode: normalizeFirebaseErrorCode(error),
          resourceType: 'catalog',
          resourceId: editing === 'new' ? 'new-item' : (editing?.id ?? 'unknown'),
        });
      }
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
        <StatePanel title="No hay artículos para estos filtros">
          <p>Prueba otra búsqueda o crea el primer artículo comercial.</p>
        </StatePanel>
      ) : (
        <section className="catalog-grid" aria-label={`${visible.length} artículos`}>
          {visible.map((item) => (
            <article className="catalog-card" key={item.id}>
              <CatalogImage item={item} />
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
                <span>{item.taxable ? 'Más IVA' : 'No gravado'}</span>
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
        <label className="checkbox field-wide">
          <input name="taxable" type="checkbox" defaultChecked={current?.taxable ?? true} /> Aplica
          IVA del documento
        </label>
        <label className="field-wide">
          Imagen opcional (JPG, PNG o WebP; máximo 5 MB)
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
          {current?.imageFileName && <small>Actual: {current.imageFileName}</small>}
        </label>
        {current?.imageStoragePath && (
          <label className="checkbox field-wide">
            <input name="removeImage" type="checkbox" /> Eliminar la imagen actual
          </label>
        )}
        {message && <p className="form-message form-message--error field-wide">{message}</p>}
        <button className="button button--primary field-wide" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar artículo'}
        </button>
      </form>
    </Modal>
  );
}

function CatalogImage({item}: {item: CatalogItem}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!item.imageStoragePath || item.imageStatus !== 'ready') {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void getBlob(ref(storage, item.imageStoragePath), 5 * 1024 * 1024)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.imageStatus, item.imageStoragePath]);
  return (
    <div className="catalog-card__image">
      {url ? (
        <img src={url} alt="" />
      ) : (
        <Icon name={item.type === 'product' ? 'equipment' : 'support'} width={34} height={34} />
      )}
    </div>
  );
}

function imageForDiagnostic(error: unknown): boolean {
  return error instanceof Error && /formato|extensión|archivo|imagen|\bMB\b/i.test(error.message);
}
