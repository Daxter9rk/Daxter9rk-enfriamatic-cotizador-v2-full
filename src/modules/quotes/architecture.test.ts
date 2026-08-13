import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const moduleRoot = join(process.cwd(), 'src', 'modules', 'quotes');

function sourceFiles(relativeDirectory: string): string[] {
  return readdirSync(join(moduleRoot, relativeDirectory), {withFileTypes: true})
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => readFileSync(join(moduleRoot, relativeDirectory, entry.name), 'utf8'));
}

describe('quotes module boundaries', () => {
  it('keeps the domain independent from frameworks and outer layers', () => {
    const source = sourceFiles('domain').join('\n');
    expect(source).not.toMatch(/from ['"][^'"]*(firebase|react|application|infrastructure|ui)/);
  });

  it('keeps application logic independent from frameworks and adapters', () => {
    const source = sourceFiles('application').join('\n');
    expect(source).not.toMatch(/from ['"][^'"]*(firebase|react|infrastructure|ui)/);
  });

  it('keeps legacy utility paths as compatibility facades', () => {
    const calculations = readFileSync(
      join(process.cwd(), 'src', 'utils', 'calculations.ts'),
      'utf8',
    );
    const catalog = readFileSync(join(process.cwd(), 'src', 'utils', 'catalog.ts'), 'utf8');
    expect(calculations).toContain('../modules/quotes/domain/calculations');
    expect(calculations).not.toMatch(/function calculate(Item|QuoteTotals)/);
    expect(catalog).toContain('../modules/quotes/application/quoteItems');
    expect(catalog).not.toMatch(/function (catalogItemToQuoteInput|snapshotCatalogItem)/);
  });
});
