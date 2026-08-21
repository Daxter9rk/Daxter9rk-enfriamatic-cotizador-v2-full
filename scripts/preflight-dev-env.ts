import {loadEnv} from 'vite';

export function loadPreflightEnv(rootDir: string, ambientEnv: NodeJS.ProcessEnv) {
  return {...loadEnv('development', rootDir, ''), ...ambientEnv};
}

export function missingEnvironmentVariables(
  env: Record<string, string | undefined>,
  required: readonly string[],
) {
  return required.filter((key) => !(env[key] ?? '').trim());
}
