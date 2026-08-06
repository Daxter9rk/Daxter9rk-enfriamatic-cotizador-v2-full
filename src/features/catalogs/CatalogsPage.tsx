import {useState, type FormEvent} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import {Modal} from '../../components/Modal';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import {createDocument, updateDocument} from '../../services/firebase/data';

interface CatalogItem {
  id: string;
  type: CatalogType;
  name: string;
  value: string;
  status: 'active' | 'inactive';
}

type CatalogType = (typeof types)[number];

const types = [
  'unit',
  'concept',
  'equipment_category',
  'site_type',
  'payment_method',
  'priority',
  'commercial_text',
] as const;

const typeLabels: Record<CatalogType, string> = {
  unit: 'Unidad',
  concept: 'Concepto',
  equipment_category: 'Categoría de equipo',
  site_type: 'Tipo de instalación',
  payment_method: 'Método de pago',
  priority: 'Prioridad',
  commercial_text: 'Texto comercial',
};

const valueLabels: Record<string, string> = {
  high: 'Alta',
  normal: 'Normal',
  low: 'Baja',
  urgent: 'Urgente',
};

export function CatalogsPage() {
  const {profile} = useAuth();
  const catalogs = useCollection<CatalogItem>('catalogs');
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);
  const [type, setType] = useState<'all' | CatalogType>('all');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const admin = profile?.role === 'admin';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !admin || !editing) return;
    const form = new FormData(event.currentTarget);
    const nextType = String(form.get('type')) as CatalogType;
    const name = String(form.get('name')).trim();
    const value = String(form.get('value')).trim();
    const duplicate = catalogs.data.some(
      (item) =>
        item.id !== (editing === 'new' ? '' : editing.id) &&
        item.type === nextType &&
        item.value.trim().toLocaleLowerCase('es-MX') === value.toLocaleLowerCase('es-MX'),
    );
    if (duplicate) {
      setError('Ya existe un elemento con ese tipo y valor.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing === 'new') {
        await createDocument(
          'catalogs',
          {type: nextType, name, value, status: 'active'},
          profile.uid,
        );
      } else {
        await updateDocument('catalogs', editing.id, {name, value}, profile.uid);
      }
      setEditing(null);
      await catalogs.reload();
    } catch {
      setError('No fue posible guardar el elemento de catálogo.');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (item: CatalogItem) => {
    if (!profile || !admin) return;
    setBusy(true);
    setError(null);
    try {
      await updateDocument(
        'catalogs',
        item.id,
        {status: item.status === 'active' ? 'inactive' : 'active'},
        profile.uid,
      );
      await catalogs.reload();
    } catch {
      setError('No fue posible cambiar el estado del elemento.');
    } finally {
      setBusy(false);
    }
  };

  if (catalogs.loading) return <StatePanel kind="loading" title="Cargando catálogos…" />;
  const visible =
    type === 'all' ? catalogs.data : catalogs.data.filter((item) => item.type === type);
  const current = editing === 'new' ? null : editing;
  return (
    <>
      <PageHeader
        eyebrow="Configuración operativa"
        title="Catálogos internos"
        description="Valores internos controlados, en español y sin eliminaciones físicas."
        actions={
          admin ? (
            <button className="button button--primary" onClick={() => setEditing('new')}>
              Nuevo elemento
            </button>
          ) : undefined
        }
      />
      <section className="toolbar">
        <label>
          Tipo
          <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
            <option value="all">Todos</option>
            {types.map((item) => (
              <option key={item} value={item}>
                {typeLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <span>{visible.length} elementos</span>
      </section>
      {error && <p className="form-message form-message--error">{error}</p>}
      {visible.length === 0 ? (
        <StatePanel title="No hay elementos para este filtro" />
      ) : (
        <section className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nombre</th>
                <th>Valor</th>
                <th>Estado</th>
                {admin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td>{typeLabels[item.type]}</td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{valueLabels[item.value] ?? item.value}</td>
                  <td>
                    <span className={`badge badge--${item.status}`}>
                      {item.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {admin && (
                    <td>
                      <div className="table-actions">
                        <button className="button button--ghost" onClick={() => setEditing(item)}>
                          Editar
                        </button>
                        <button
                          className="button button--secondary"
                          disabled={busy}
                          onClick={() => void toggleStatus(item)}
                        >
                          {item.status === 'active' ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {editing && admin && (
        <Modal
          title={editing === 'new' ? 'Nuevo elemento de catálogo' : 'Editar elemento de catálogo'}
          onClose={() => setEditing(null)}
        >
          <form className="form-grid" onSubmit={(event) => void submit(event)}>
            <label>
              Tipo
              <select
                name="type"
                defaultValue={current?.type ?? 'unit'}
                disabled={editing !== 'new'}
              >
                {types.map((item) => (
                  <option key={item} value={item}>
                    {typeLabels[item]}
                  </option>
                ))}
              </select>
              {editing !== 'new' && <input type="hidden" name="type" value={current?.type} />}
            </label>
            <label>
              Nombre
              <input name="name" required maxLength={120} defaultValue={current?.name ?? ''} />
            </label>
            <label className="field-wide">
              Valor
              <input name="value" required maxLength={500} defaultValue={current?.value ?? ''} />
            </label>
            {error && <p className="form-message form-message--error field-wide">{error}</p>}
            <button className="button button--primary field-wide" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
