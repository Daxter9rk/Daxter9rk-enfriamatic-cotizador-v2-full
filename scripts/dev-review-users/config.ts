export const DEV_PROJECT_ID = 'enfriamatic-cotizador-de-420e5';

export type ReviewTarget = 'emulator' | 'remote';
export type ReviewAction = 'provision' | 'disable' | 'restore' | 'cleanup';

export interface ReviewUserOptions {
  target: ReviewTarget;
  action: ReviewAction;
  projectId: string;
  confirmProject?: string;
}

export function parseReviewUserOptions(argumentsList: string[]): ReviewUserOptions {
  const values = new Map(
    argumentsList
      .filter((argument) => argument.startsWith('--') && argument.includes('='))
      .map((argument) => {
        const separator = argument.indexOf('=');
        return [argument.slice(2, separator), argument.slice(separator + 1)];
      }),
  );
  const target = values.get('target');
  const action = values.get('action');
  const projectId = values.get('project') ?? DEV_PROJECT_ID;
  if (target !== 'emulator' && target !== 'remote') {
    throw new Error('Indica --target=emulator o --target=remote de forma explícita.');
  }
  if (!['provision', 'disable', 'restore', 'cleanup'].includes(action ?? '')) {
    throw new Error('Indica --action=provision|disable|restore|cleanup.');
  }
  if (projectId !== DEV_PROJECT_ID) {
    throw new Error(`Proyecto rechazado. Sólo se permite DEV: ${DEV_PROJECT_ID}.`);
  }
  const confirmProject = values.get('confirm-project');
  if (target === 'remote' && confirmProject !== DEV_PROJECT_ID) {
    throw new Error(`DEV remoto exige --confirm-project=${DEV_PROJECT_ID}.`);
  }
  return {target, action: action as ReviewAction, projectId, confirmProject};
}

export function requiredReviewEnvironment(environment: NodeJS.ProcessEnv) {
  const definitions = [
    {
      key: 'promotedAdmin',
      role: 'admin',
      status: 'active',
      email: 'REVIEW_ADMIN_EMAIL',
      password: 'REVIEW_ADMIN_PASSWORD',
      profile: true,
    },
    {
      key: 'activeOperator',
      role: 'operator',
      status: 'active',
      email: 'REVIEW_OPERATOR_EMAIL',
      password: 'REVIEW_OPERATOR_PASSWORD',
      profile: true,
    },
    {
      key: 'inactiveUser',
      role: 'operator',
      status: 'inactive',
      email: 'REVIEW_INACTIVE_EMAIL',
      password: 'REVIEW_INACTIVE_PASSWORD',
      profile: true,
    },
    {
      key: 'noProfileUser',
      role: 'operator',
      status: 'active',
      email: 'REVIEW_NO_PROFILE_EMAIL',
      password: 'REVIEW_NO_PROFILE_PASSWORD',
      profile: false,
    },
  ] as const;
  return definitions.flatMap((definition) => {
    const email = environment[definition.email]?.trim();
    const password = environment[definition.password];
    if (!email && !password && definition.key === 'noProfileUser') return [];
    if (!email || !password || password.length < 12) {
      throw new Error(
        `Faltan ${definition.email}/${definition.password} o la contraseña tiene menos de 12 caracteres.`,
      );
    }
    return [{...definition, email, password}];
  });
}
