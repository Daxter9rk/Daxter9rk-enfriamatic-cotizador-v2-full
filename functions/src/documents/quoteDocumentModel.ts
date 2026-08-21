import type {QuoteTotals} from '../shared/calculations';

export interface QuoteClientSnapshot {
  clientId: string;
  name: string;
  legalName: string | null;
  rfc: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  addressFull: string | null;
  postalCode: string | null;
  billingAddress: Record<string, string> | null;
}

export interface QuoteCompanySnapshot {
  companyName: string;
  rfc: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  legalText: string | null;
  paymentMethod: string | null;
  warranty: string | null;
  exclusions: string | null;
  watermark: string;
}

export interface QuoteOperationalContext {
  requestId: string | null;
  siteName: string | null;
  siteAddress: string | null;
  equipmentName: string | null;
  serviceReference: string | null;
  technicalContext: string | null;
}

export interface QuoteDocumentItem {
  position: number;
  quantity: number;
  unit: string;
  description: string;
  brand: string | null;
  model: string | null;
  originalUnitPrice: number;
  discountAmount: number;
  lineSubtotal: number;
  taxable: boolean;
}

export interface QuoteDocumentModel {
  identity: {
    quoteId: string;
    folio: string;
    issuedAt: Date;
    currency: 'MXN';
    validityDays: number;
    issuedBy: string;
  };
  mode: 'historical' | 'independent';
  client: QuoteClientSnapshot;
  company: QuoteCompanySnapshot;
  operationalContext: QuoteOperationalContext;
  items: QuoteDocumentItem[];
  totals: QuoteTotals;
  terms: {
    taxRate: number;
    applyTax: boolean;
    globalDiscountType: 'none' | 'percentage' | 'fixed';
    globalDiscountValue: number;
    globalDiscountAmount: number;
    discountDisplayMode: 'detailed' | 'summary' | 'incorporated';
    notes: string | null;
  };
  metadata: {
    actorRole: 'admin' | 'operator';
    generationAttempt: number;
    schemaVersion: 1;
  };
}

const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const addressSnapshot = (value: unknown): Record<string, string> | null => {
  if (!value || typeof value !== 'object') return null;
  const result = Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, text(item)])
      .filter((entry): entry is [string, string] => entry[1] !== null),
  );
  return Object.keys(result).length > 0 ? result : null;
};

export function buildQuoteDocumentModel(input: {
  quoteId: string;
  folio: string;
  issuedAt: Date;
  issuedBy: string;
  actorRole: 'admin' | 'operator';
  generationAttempt: number;
  quote: Record<string, unknown>;
  client: Record<string, unknown>;
  company: Record<string, unknown>;
  defaults: Record<string, unknown>;
  items: QuoteDocumentItem[];
  totals: QuoteTotals;
  request?: Record<string, unknown> | null;
  site?: Record<string, unknown> | null;
  equipment?: Record<string, unknown> | null;
}): QuoteDocumentModel {
  const requestId = text(input.quote.requestId);
  const independent = requestId === null;
  const validityDays = Number(input.quote.validityDays ?? input.defaults.validityDays ?? 15);
  const taxRate = Number(input.quote.taxRate ?? input.defaults.taxRate ?? 0.16);
  const applyTax = typeof input.quote.applyTax === 'boolean' ? input.quote.applyTax : true;
  const globalDiscountType =
    input.quote.globalDiscountType === 'percentage' || input.quote.globalDiscountType === 'fixed'
      ? input.quote.globalDiscountType
      : 'none';
  const globalDiscountValue = Number(input.quote.globalDiscountValue ?? 0);
  const globalDiscountAmount = Number(input.quote.globalDiscountAmount ?? 0);
  const request = input.request ?? {};
  const site = input.site ?? {};
  const equipment = input.equipment ?? {};
  const companyName = text(input.company.companyName);
  if (!companyName) throw new Error('missing-company-settings');
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365) {
    throw new Error('invalid-validity-days');
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
    throw new Error('invalid-tax-rate');
  }

  return {
    identity: {
      quoteId: input.quoteId,
      folio: input.folio,
      issuedAt: input.issuedAt,
      currency: 'MXN',
      validityDays,
      issuedBy: input.issuedBy,
    },
    mode: independent ? 'independent' : 'historical',
    client: {
      clientId: String(input.quote.clientId),
      name: text(input.client.name) ?? String(input.quote.clientId),
      legalName: text(input.client.legalName),
      rfc: text(input.client.rfc),
      contactName: text(input.client.contactName),
      email: text(input.client.email),
      phone: text(input.client.phone),
      addressFull: text(input.client.addressFull),
      postalCode: text(input.client.postalCode),
      billingAddress: addressSnapshot(input.client.billingAddress),
    },
    company: {
      companyName,
      rfc: text(input.company.rfc),
      address: text(input.company.address),
      phone: text(input.company.phone),
      email: text(input.company.email),
      legalText: text(input.company.legalText),
      paymentMethod: text(input.defaults.paymentMethod),
      warranty: text(input.defaults.warranty),
      exclusions: text(input.defaults.exclusions),
      watermark: text(input.defaults.devWatermark) ?? 'DOCUMENTO DE PRUEBA - DEV',
    },
    operationalContext: {
      requestId,
      siteName: independent ? null : text(site.name ?? request.siteName),
      siteAddress: independent ? null : text(site.address ?? request.siteAddress),
      equipmentName: independent ? null : text(equipment.name),
      serviceReference: text(input.quote.serviceReference),
      technicalContext: text(input.quote.technicalContext),
    },
    items: input.items,
    totals: input.totals,
    terms: {
      taxRate,
      applyTax,
      globalDiscountType,
      globalDiscountValue,
      globalDiscountAmount,
      discountDisplayMode:
        input.quote.discountDisplayMode === 'summary' ||
        input.quote.discountDisplayMode === 'incorporated'
          ? input.quote.discountDisplayMode
          : 'detailed',
      notes: text(input.quote.notes),
    },
    metadata: {
      actorRole: input.actorRole,
      generationAttempt: input.generationAttempt,
      schemaVersion: 1,
    },
  };
}
