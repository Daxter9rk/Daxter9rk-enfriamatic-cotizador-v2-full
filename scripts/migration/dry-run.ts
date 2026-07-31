import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {z} from 'zod';

const rowSchema = z.object({
  externalId: z.string().min(1).max(200),
  type: z.enum(['client', 'site', 'equipment', 'request', 'quote']),
  payload: z.record(z.string(), z.unknown()),
});

const source = process.argv[2];
if (!source) {
  throw new Error('Uso: npm exec tsx scripts/migration/dry-run.ts -- archivo.json');
}

const parsed: unknown = JSON.parse(readFileSync(resolve(source), 'utf8'));
if (!Array.isArray(parsed)) throw new Error('La entrada debe ser un arreglo JSON.');

const identifiers = new Set<string>();
const report = parsed.map((row, index) => {
  const result = rowSchema.safeParse(row);
  if (!result.success) return {row: index + 1, status: 'invalid', errors: result.error.issues};
  const duplicate = identifiers.has(result.data.externalId);
  identifiers.add(result.data.externalId);
  return {row: index + 1, status: duplicate ? 'duplicate' : 'valid'};
});

console.log(
  JSON.stringify(
    {
      dryRun: true,
      total: report.length,
      valid: report.filter((row) => row.status === 'valid').length,
      duplicates: report.filter((row) => row.status === 'duplicate').length,
      invalid: report.filter((row) => row.status === 'invalid').length,
      rows: report,
      writesPerformed: 0,
    },
    null,
    2,
  ),
);
