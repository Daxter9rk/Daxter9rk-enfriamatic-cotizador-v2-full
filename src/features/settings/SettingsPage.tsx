import {useEffect, useState, type FormEvent} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import {PageHeader} from '../../components/PageHeader';
import {ReauthenticationModal} from '../../components/ReauthenticationModal';
import {StatePanel} from '../../components/StatePanel';
import {getDocument, updateDocument} from '../../services/firebase/data';
import {
  emptyCompany,
  emptyDefaults,
  normalizeCompany,
  normalizeDefaults,
  validateSettings,
  type CompanyProfile,
  type QuoteDefaults,
} from './settingsContract';

export function SettingsPage() {
  const {profile} = useAuth();
  const [company, setCompany] = useState(emptyCompany);
  const [defaults, setDefaults] = useState(emptyDefaults);
  const [snapshot, setSnapshot] = useState({company: emptyCompany, defaults: emptyDefaults});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    void Promise.all([
      getDocument<Partial<CompanyProfile>>('settings', 'companyProfile'),
      getDocument<Partial<QuoteDefaults>>('settings', 'quoteDefaults'),
    ])
      .then(([companyValue, defaultValue]) => {
        const nextCompany = normalizeCompany(companyValue);
        const nextDefaults = normalizeDefaults(defaultValue);
        setCompany(nextCompany);
        setDefaults(nextDefaults);
        setSnapshot({company: nextCompany, defaults: nextDefaults});
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const cancel = () => {
    setCompany(snapshot.company);
    setDefaults(snapshot.defaults);
    setEditing(false);
    setMessage('Cambios descartados.');
  };

  const requestSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    const normalizedCompany = normalizeCompany(company);
    const normalizedDefaults = normalizeDefaults(defaults);
    const validationError = validateSettings(normalizedCompany, normalizedDefaults);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setCompany(normalizedCompany);
    setDefaults(normalizedDefaults);
    setConfirming(true);
  };

  const save = async () => {
    if (!profile) return;
    setBusy(true);
    setMessage(null);
    try {
      await Promise.all([
        updateDocument('settings', 'companyProfile', company, profile.uid),
        updateDocument('settings', 'quoteDefaults', defaults, profile.uid),
      ]);
      setSnapshot({company: normalizeCompany(company), defaults: normalizeDefaults(defaults)});
      setEditing(false);
      setConfirming(false);
      setMessage('Configuración guardada y registrada en auditoría.');
    } catch {
      setMessage('No fue posible guardar la configuración. No se aplicaron cambios confirmados.');
      throw new Error('settings-write-failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <StatePanel kind="loading" title="Cargando configuración…" />;
  if (loadError) {
    return <StatePanel kind="error" title="No fue posible consultar la configuración" />;
  }

  const readonly = !editing || busy;
  const hasChanges = JSON.stringify({company, defaults}) !== JSON.stringify(snapshot);
  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Configuración"
        description="Consulta segura por defecto; los cambios sensibles requieren confirmar tu identidad."
        actions={
          !editing ? (
            <button
              className="button button--primary"
              onClick={() => {
                setEditing(true);
                setMessage(null);
              }}
            >
              Editar
            </button>
          ) : null
        }
      />
      <form className="settings-form" onSubmit={requestSave}>
        <section className="panel form-grid">
          <div className="field-wide">
            <p className="eyebrow">Empresa</p>
            <h2>Perfil comercial</h2>
          </div>
          <label>
            Nombre
            <input
              required
              maxLength={120}
              readOnly={readonly}
              value={company.companyName}
              onChange={(event) => setCompany({...company, companyName: event.target.value})}
            />
          </label>
          <label>
            RFC
            <input
              maxLength={13}
              readOnly={readonly}
              value={company.rfc}
              onChange={(event) => setCompany({...company, rfc: event.target.value.toUpperCase()})}
            />
          </label>
          <label className="field-wide">
            Dirección
            <input
              maxLength={300}
              readOnly={readonly}
              value={company.address}
              onChange={(event) => setCompany({...company, address: event.target.value})}
            />
          </label>
          <label>
            Teléfono
            <input
              maxLength={30}
              readOnly={readonly}
              value={company.phone}
              onChange={(event) => setCompany({...company, phone: event.target.value})}
            />
          </label>
          <label>
            Correo
            <input
              type="email"
              maxLength={254}
              readOnly={readonly}
              value={company.email}
              onChange={(event) => setCompany({...company, email: event.target.value})}
            />
          </label>
          <label className="field-wide">
            Texto legal
            <textarea
              maxLength={3000}
              readOnly={readonly}
              value={company.legalText}
              onChange={(event) => setCompany({...company, legalText: event.target.value})}
            />
          </label>
        </section>
        <section className="panel form-grid">
          <div className="field-wide">
            <p className="eyebrow">Cotización</p>
            <h2>Valores predeterminados DEV</h2>
          </div>
          <label>
            IVA (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              readOnly={readonly}
              value={defaults.taxRate * 100}
              onChange={(event) =>
                setDefaults({...defaults, taxRate: Number(event.target.value) / 100})
              }
            />
          </label>
          <label>
            Vigencia (días)
            <input
              type="number"
              min="1"
              max="365"
              readOnly={readonly}
              value={defaults.validityDays}
              onChange={(event) =>
                setDefaults({...defaults, validityDays: Number(event.target.value)})
              }
            />
          </label>
          <label>
            Prefijo de folio
            <input
              required
              maxLength={12}
              readOnly={readonly}
              value={defaults.folioPrefix}
              onChange={(event) =>
                setDefaults({...defaults, folioPrefix: event.target.value.toUpperCase()})
              }
            />
          </label>
          <label>
            Moneda
            <input readOnly value="MXN" />
          </label>
          <label>
            Método de pago
            <input
              maxLength={160}
              readOnly={readonly}
              value={defaults.paymentMethod}
              onChange={(event) => setDefaults({...defaults, paymentMethod: event.target.value})}
            />
          </label>
          <label>
            Anticipo
            <input
              maxLength={160}
              readOnly={readonly}
              value={defaults.advance}
              onChange={(event) => setDefaults({...defaults, advance: event.target.value})}
            />
          </label>
          <label>
            Plazo estimado
            <input
              maxLength={160}
              readOnly={readonly}
              value={defaults.estimatedTerm}
              onChange={(event) => setDefaults({...defaults, estimatedTerm: event.target.value})}
            />
          </label>
          <label className="field-wide">
            Garantía
            <textarea
              maxLength={1000}
              readOnly={readonly}
              value={defaults.warranty}
              onChange={(event) => setDefaults({...defaults, warranty: event.target.value})}
            />
          </label>
          <label className="field-wide">
            Exclusiones
            <textarea
              maxLength={2000}
              readOnly={readonly}
              value={defaults.exclusions}
              onChange={(event) => setDefaults({...defaults, exclusions: event.target.value})}
            />
          </label>
          <label className="field-wide">
            Observaciones
            <textarea
              maxLength={2000}
              readOnly={readonly}
              value={defaults.observations}
              onChange={(event) => setDefaults({...defaults, observations: event.target.value})}
            />
          </label>
          <label className="field-wide">
            Marca de agua DEV
            <input
              maxLength={120}
              readOnly={readonly}
              value={defaults.devWatermark}
              onChange={(event) => setDefaults({...defaults, devWatermark: event.target.value})}
            />
          </label>
        </section>
        {message && (
          <p
            className={`form-message ${message.startsWith('Configuración') ? 'form-message--success' : ''}`}
          >
            {message}
          </p>
        )}
        {editing && (
          <div className="form-actions">
            <button type="button" className="button button--ghost" onClick={cancel}>
              Cancelar
            </button>
            <button className="button button--primary" disabled={busy || !hasChanges}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </form>
      {confirming && (
        <ReauthenticationModal
          title="Autorizar cambios sensibles"
          description={`Se actualizarán el perfil comercial, IVA (${(defaults.taxRate * 100).toFixed(2)} %), vigencia (${defaults.validityDays} días) y valores documentales. La acción quedará auditada.`}
          onClose={() => setConfirming(false)}
          onConfirmed={save}
        />
      )}
    </>
  );
}
