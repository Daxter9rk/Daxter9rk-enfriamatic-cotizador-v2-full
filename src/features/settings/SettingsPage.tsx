import {useEffect, useState, type FormEvent} from 'react';
import {useAuth} from '../../app/providers/AuthProvider';
import {PageHeader} from '../../components/PageHeader';
import {getDocument, setKnownDocument} from '../../services/firebase/data';

interface CompanyProfile {
  companyName?: string;
  rfc?: string;
  address?: string;
  phone?: string;
  email?: string;
  legalText?: string;
}

interface QuoteDefaults {
  taxRate?: number;
  validityDays?: number;
  currency?: string;
  folioPrefix?: string;
  paymentMethod?: string;
  advance?: string;
  estimatedTerm?: string;
  warranty?: string;
  exclusions?: string;
  observations?: string;
  devWatermark?: string;
}

export function SettingsPage() {
  const {profile} = useAuth();
  const [company, setCompany] = useState<CompanyProfile>({});
  const [defaults, setDefaults] = useState<QuoteDefaults>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      getDocument<CompanyProfile>('settings', 'companyProfile'),
      getDocument<QuoteDefaults>('settings', 'quoteDefaults'),
    ]).then(([companyValue, defaultValue]) => {
      setCompany(companyValue ?? {});
      setDefaults(defaultValue ?? {});
    });
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    await Promise.all([
      setKnownDocument(
        'settings',
        'companyProfile',
        {
          companyName: String(form.get('companyName') ?? ''),
          rfc: String(form.get('rfc') ?? ''),
          address: String(form.get('address') ?? ''),
          phone: String(form.get('phone') ?? ''),
          email: String(form.get('email') ?? ''),
          legalText: String(form.get('legalText') ?? ''),
        },
        profile.uid,
      ),
      setKnownDocument(
        'settings',
        'quoteDefaults',
        {
          taxRate: Number(form.get('taxRate')) / 100,
          validityDays: Number(form.get('validityDays')),
          currency: 'MXN',
          folioPrefix: String(form.get('folioPrefix') ?? 'COT'),
          paymentMethod: String(form.get('paymentMethod') ?? ''),
          advance: String(form.get('advance') ?? ''),
          estimatedTerm: String(form.get('estimatedTerm') ?? ''),
          warranty: String(form.get('warranty') ?? ''),
          exclusions: String(form.get('exclusions') ?? ''),
          observations: String(form.get('observations') ?? ''),
          devWatermark: String(form.get('devWatermark') ?? ''),
        },
        profile.uid,
      ),
    ]);
    setMessage('Configuración guardada.');
  };

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Configuración"
        description="Datos comerciales y defaults editables utilizados al crear cotizaciones."
      />
      <form className="settings-form" onSubmit={(event) => void submit(event)}>
        <section className="panel form-grid">
          <div className="field-wide">
            <p className="eyebrow">Empresa</p>
            <h2>Perfil de Enfriamatic</h2>
          </div>
          <label>
            Nombre
            <input
              name="companyName"
              maxLength={120}
              defaultValue={company.companyName ?? 'Enfriamatic'}
            />
          </label>
          <label>
            RFC
            <input
              name="rfc"
              maxLength={13}
              defaultValue={company.rfc ?? ''}
              placeholder="Sin configurar"
            />
          </label>
          <label className="field-wide">
            Dirección
            <input name="address" maxLength={300} defaultValue={company.address ?? ''} />
          </label>
          <label>
            Teléfono
            <input name="phone" maxLength={30} defaultValue={company.phone ?? ''} />
          </label>
          <label>
            Correo
            <input name="email" type="email" maxLength={254} defaultValue={company.email ?? ''} />
          </label>
          <label className="field-wide">
            Texto legal
            <textarea name="legalText" maxLength={3000} defaultValue={company.legalText ?? ''} />
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
              name="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={(defaults.taxRate ?? 0.16) * 100}
            />
          </label>
          <label>
            Vigencia (días)
            <input
              name="validityDays"
              type="number"
              min="1"
              max="365"
              defaultValue={defaults.validityDays ?? 15}
            />
          </label>
          <label>
            Prefijo de folio
            <input name="folioPrefix" maxLength={12} defaultValue={defaults.folioPrefix ?? 'COT'} />
          </label>
          <label>
            Método de pago
            <input
              name="paymentMethod"
              maxLength={160}
              defaultValue={defaults.paymentMethod ?? ''}
            />
          </label>
          <label>
            Anticipo
            <input name="advance" maxLength={160} defaultValue={defaults.advance ?? ''} />
          </label>
          <label>
            Plazo estimado
            <input
              name="estimatedTerm"
              maxLength={160}
              defaultValue={defaults.estimatedTerm ?? ''}
            />
          </label>
          <label className="field-wide">
            Garantía
            <textarea name="warranty" maxLength={1000} defaultValue={defaults.warranty ?? ''} />
          </label>
          <label className="field-wide">
            Exclusiones
            <textarea name="exclusions" maxLength={2000} defaultValue={defaults.exclusions ?? ''} />
          </label>
          <label className="field-wide">
            Observaciones
            <textarea
              name="observations"
              maxLength={2000}
              defaultValue={defaults.observations ?? ''}
            />
          </label>
          <label className="field-wide">
            Watermark DEV
            <input
              name="devWatermark"
              maxLength={120}
              defaultValue={defaults.devWatermark ?? 'DOCUMENTO DE PRUEBA - DEV'}
            />
          </label>
        </section>
        {message && <p className="form-message form-message--success">{message}</p>}
        <button className="button button--primary">Guardar configuración</button>
      </form>
    </>
  );
}
