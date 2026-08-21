export const normalizeMoney = (value: number): number => (Math.abs(value) < 0.005 ? 0 : value);

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'}).format(
    normalizeMoney(value),
  );

export const formatDate = (value?: {toDate(): Date} | null): string =>
  value
    ? new Intl.DateTimeFormat('es-MX', {dateStyle: 'medium', timeStyle: 'short'}).format(
        value.toDate(),
      )
    : '—';

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const safeFileName = (folio: string): string =>
  `${folio.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
