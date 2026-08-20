import {spawn} from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const environment = {
  ...process.env,
  FUNCTIONS_DISCOVERY_TIMEOUT: '60',
};

let activeChild;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const spawnArgs =
      process.platform === 'win32' && command === npxCommand
        ? args.map((arg, index) => (index === args.length - 1 ? `"${arg}"` : arg))
        : args;
    const child = spawn(command, spawnArgs, {
      env: environment,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });
    activeChild = child;

    const forwardSignal = (signal) => {
      if (activeChild === child) child.kill(signal);
    };
    const cleanup = () => {
      process.removeListener('SIGINT', forwardInterrupt);
      process.removeListener('SIGTERM', forwardTerminate);
      if (activeChild === child) activeChild = undefined;
    };
    const forwardInterrupt = () => forwardSignal('SIGINT');
    const forwardTerminate = () => forwardSignal('SIGTERM');

    process.once('SIGINT', forwardInterrupt);
    process.once('SIGTERM', forwardTerminate);
    child.once('error', (error) => {
      cleanup();
      reject(error);
    });
    child.once('exit', (code, signal) => {
      cleanup();
      resolve(signal ? 128 : (code ?? 1));
    });
  });
}

const steps = [
  [npmCommand, ['run', 'build']],
  [npmCommand, ['--prefix', 'functions', 'run', 'build']],
  [
    npxCommand,
    [
      '-y',
      'firebase-tools@latest',
      'emulators:exec',
      '--project',
      'demo-enfriamatic',
      '--only',
      'firestore,storage',
      'vitest run tests/firestore.rules.test.ts tests/storage.rules.test.ts',
    ],
  ],
  [
    npxCommand,
    [
      '-y',
      'firebase-tools@latest',
      'emulators:exec',
      '--project',
      'demo-enfriamatic',
      '--only',
      'auth,firestore,storage,functions,hosting',
      'npm run seed:emulators && npm run seed:emulators:functional && playwright test',
    ],
  ],
];

for (const [command, args] of steps) {
  try {
    const exitCode = await run(command, args);
    if (exitCode !== 0) {
      process.exitCode = exitCode;
      break;
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
    break;
  }
}
