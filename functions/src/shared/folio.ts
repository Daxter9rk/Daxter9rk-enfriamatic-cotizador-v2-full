export function formatFolio(prefix: string, year: number, sequence: number): string {
  if (!/^[A-Z0-9-]{1,12}$/.test(prefix)) throw new Error('invalid-folio-prefix');
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error('invalid-folio-year');
  }
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999999) {
    throw new Error('invalid-folio-sequence');
  }
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}
