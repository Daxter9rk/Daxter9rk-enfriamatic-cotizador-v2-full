import {execFileSync} from 'node:child_process';
import process from 'node:process';

export function runProcess(command: string, args: string[]): string {
  const windowsCommand = process.platform === 'win32' && ['gcloud', 'npx'].includes(command);
  const executable = windowsCommand ? (process.env.ComSpec ?? 'cmd.exe') : command;
  const executableArgs = windowsCommand ? ['/d', '/s', '/c', command, ...args] : args;
  return execFileSync(executable, executableArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
