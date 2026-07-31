import {useState, type FormEvent} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import {Modal} from '../../components/Modal';
import {PageHeader} from '../../components/PageHeader';
import {StatePanel} from '../../components/StatePanel';
import {useCollection} from '../../hooks/useCollection';
import {createDocument} from '../../services/firebase/data';

interface CatalogItem {
  id: string;
  type: string;
  name: string;
  value: string;
  status: 'active' | 'inactive';
}

const types = [
  'unit',
  'concept',
  'equipment_category',
  'site_type',
  'payment_method',
  'priority',
  'commercial_text',
];

export function CatalogsPage() {
  const {profile} = useAuth();
  const catalogs = useCollection<CatalogItem>('catalogs');
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    try {
      await createDocument(
        'catalogs',
        {
          type: String(form.get('type')),
          name: String(form.get('name')).trim(),
          value: String(form.get('value')).trim(),
          status: 'active',
        },
        profile.uid,
      );
      setCreating(false);
      await catalogs.reload();
    } catch {
      setError('No fue posible guardar el catálogo.');
    }
  };

  if (catalogs.loading) return <StatePanel kind="loading" title="Cargando catálogos…" />;
  const visible =
    type === 'all' ? catalogs.data : catalogs.data.filter((item) => item.type === type);
  return (
    <>
      <PageHeader
        eyebrow="Configuración operativa"
        title="Catálogos"
        description="Unidades, conceptos, equipos y textos comerciales editables."
        actions={
          <button className="button button--primary" onClick={() => setCreating(true)}>
            Nuevo elemento
          </button>
        }
      />
      <section className="toolbar">
        <label>
          Tipo
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">Todos</option>
            {types.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <span>{visible.length} elementos</span>
      </section>
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
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td>{item.type}</td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.value}</td>
                  <td>
                    <span className={`badge badge--${item.status}`}>{item.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {creating && (
        <Modal title="Nuevo elemento de catálogo" onClose={() => setCreating(false)}>
          <form className="form-grid" onSubmit={(event) => void submit(event)}>
            <label>
              Tipo
              <select name="type">
                {types.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nombre
              <input name="name" required maxLength={120} />
            </label>
            <label className="field-wide">
              Valor
              <input name="value" required maxLength={500} />
            </label>
            {error && <p className="form-message form-message--error field-wide">{error}</p>}
            <button className="button button--primary field-wide">Guardar</button>
          </form>
        </Modal>
      )}
    </>
  );
}
