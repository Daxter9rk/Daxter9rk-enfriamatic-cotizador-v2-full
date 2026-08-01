export const DEV_PROJECT_ID = 'enfriamatic-cotizador-de-420e5';
export const SEED_ORIGIN = 'dev-seed';
export const SEED_VERSION = 'functional-dev-v1';
export const SEED_TAG = 'enfriamatic-functional-demo-v1';

export const seedMarker = {
  dataOrigin: SEED_ORIGIN,
  seedVersion: SEED_VERSION,
  seedTag: SEED_TAG,
} as const;

const emulatorVariables = [
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
  'STORAGE_EMULATOR_HOST',
  'FUNCTIONS_EMULATOR',
];

export interface DevCommandOptions {
  projectId: string;
  dryRun: boolean;
  confirmed: boolean;
}

export function parseDevCommandOptions(
  argv: string[],
  environment: NodeJS.ProcessEnv,
): DevCommandOptions {
  const projectIndex = argv.indexOf('--project');
  const confirmIndex = argv.indexOf('--confirm');
  const projectId = projectIndex >= 0 ? (argv[projectIndex + 1] ?? '') : '';
  const confirmation = confirmIndex >= 0 ? (argv[confirmIndex + 1] ?? '') : '';
  const dryRun = argv.includes('--dry-run');

  if (projectId !== DEV_PROJECT_ID || projectId.toLowerCase().includes('prod')) {
    throw new Error(`Project ID bloqueado. Usa exclusivamente ${DEV_PROJECT_ID}.`);
  }
  const activeEmulators = emulatorVariables.filter((name) => Boolean(environment[name]));
  if (activeEmulators.length > 0) {
    throw new Error(`Entorno de emuladores detectado: ${activeEmulators.join(', ')}.`);
  }
  const confirmed = confirmation === DEV_PROJECT_ID;
  if (!dryRun && !confirmed) {
    throw new Error(`Se requiere --dry-run o --confirm ${DEV_PROJECT_ID}.`);
  }
  return {projectId, dryRun, confirmed};
}

export function isSeedOwned(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return record.dataOrigin === SEED_ORIGIN && record.seedTag === SEED_TAG;
}

export type SeedAction = 'create' | 'update' | 'unchanged' | 'conflict' | 'preserve';

export function classifySeedDocument(
  existing: Record<string, unknown> | null,
  desired: Record<string, unknown>,
  preserveUnmanaged = false,
): SeedAction {
  if (!existing) return 'create';
  if (!isSeedOwned(existing)) return preserveUnmanaged ? 'preserve' : 'conflict';
  const unchanged = Object.entries(desired).every(([key, value]) =>
    value === 'SERVER_TIMESTAMP'
      ? key in existing
      : JSON.stringify(existing[key]) === JSON.stringify(value),
  );
  return unchanged ? 'unchanged' : 'update';
}
