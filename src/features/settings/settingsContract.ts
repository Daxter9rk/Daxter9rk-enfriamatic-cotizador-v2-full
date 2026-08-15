export interface CompanyProfile {
  companyName: string;
  rfc: string;
  address: string;
  phone: string;
  email: string;
  legalText: string;
}

export interface QuoteDefaults {
  taxRate: number;
  validityDays: number;
  currency: 'MXN';
  folioPrefix: string;
  paymentMethod: string;
  advance: string;
  estimatedTerm: string;
  warranty: string;
  exclusions: string;
  observations: string;
  devWatermark: string;
}

export const emptyCompany: CompanyProfile = {
  companyName: 'Enfriamatic',
  rfc: '',
  address: '',
  phone: '',
  email: '',
  legalText: '',
};

export const emptyDefaults: QuoteDefaults = {
  taxRate: 0.16,
  validityDays: 15,
  currency: 'MXN',
  folioPrefix: 'COT',
  paymentMethod: '',
  advance: '',
  estimatedTerm: '',
  warranty: '',
  exclusions: '',
  observations: '',
  devWatermark: 'DOCUMENTO DE PRUEBA - DEV',
};

const limits: Record<keyof CompanyProfile, number> = {
  companyName: 120,
  rfc: 13,
  address: 300,
  phone: 30,
  email: 254,
  legalText: 3000,
};

const defaultLimits: Record<keyof QuoteDefaults, number | null> = {
  taxRate: null,
  validityDays: null,
  currency: null,
  folioPrefix: 12,
  paymentMethod: 160,
  advance: 160,
  estimatedTerm: 160,
  warranty: 1000,
  exclusions: 2000,
  observations: 2000,
  devWatermark: 120,
};

export function normalizeCompany(value: Partial<CompanyProfile> | null): CompanyProfile {
  const next = {...emptyCompany, ...(value ?? {})};
  return {
    companyName: next.companyName.trim(),
    rfc: next.rfc.trim().toUpperCase(),
    address: next.address.trim(),
    phone: next.phone.trim(),
    email: next.email.trim().toLowerCase(),
    legalText: next.legalText.trim(),
  };
}

export function normalizeDefaults(value: Partial<QuoteDefaults> | null): QuoteDefaults {
  const next = {...emptyDefaults, ...(value ?? {})};
  return {
    taxRate: Number(next.taxRate),
    validityDays: Number(next.validityDays),
    currency: 'MXN',
    folioPrefix: next.folioPrefix.trim().toUpperCase(),
    paymentMethod: next.paymentMethod.trim(),
    advance: next.advance.trim(),
    estimatedTerm: next.estimatedTerm.trim(),
    warranty: next.warranty.trim(),
    exclusions: next.exclusions.trim(),
    observations: next.observations.trim(),
    devWatermark: next.devWatermark.trim(),
  };
}

function validateTexts<T extends object>(value: T, fieldLimits: Record<keyof T, number>) {
  for (const [field, rawText] of Object.entries(value)) {
    const text = String(rawText);
    if (text.length > fieldLimits[field as keyof T])
      return `${field} supera su longitud permitida.`;
  }
  return null;
}

export function validateSettings(company: CompanyProfile, defaults: QuoteDefaults): string | null {
  const companyError = validateTexts(company, limits);
  if (companyError) return companyError;
  if (!company.companyName) return 'El nombre comercial es obligatorio.';
  if (company.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(company.rfc)) {
    return 'El RFC debe tener un formato válido o quedar vacío.';
  }
  if (company.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)) {
    return 'El correo de empresa no tiene un formato válido.';
  }
  if (!Number.isFinite(defaults.taxRate) || defaults.taxRate < 0 || defaults.taxRate > 1) {
    return 'La tasa de impuesto debe estar entre 0 % y 100 %.';
  }
  if (
    !Number.isInteger(defaults.validityDays) ||
    defaults.validityDays < 1 ||
    defaults.validityDays > 365
  ) {
    return 'La vigencia debe ser un número entero entre 1 y 365 días.';
  }
  if (defaults.currency !== 'MXN') return 'La moneda soportada es MXN.';
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(defaults.folioPrefix)) {
    return 'El prefijo debe usar letras, números y guiones.';
  }
  const defaultError = validateTexts(
    Object.fromEntries(
      Object.entries(defaults).filter(([field]) => fieldLimitsForText(field)),
    ) as Record<string, string>,
    Object.fromEntries(
      Object.entries(defaultLimits).filter(([field, limit]) => limit && fieldLimitsForText(field)),
    ) as Record<string, number>,
  );
  return defaultError;
}

function fieldLimitsForText(field: string): boolean {
  return (
    field !== 'taxRate' &&
    field !== 'validityDays' &&
    field !== 'currency' &&
    defaultLimits[field as keyof QuoteDefaults] !== null
  );
}
