/**
 * CLI Process Spawner
 * 通用 CLI 子进程管理器，处理生命周期、超时和清理
 */

import { spawn as nodeSpawn } from 'node:child_process';
import type { CliSpawnOptions, ChildProcessLike, SpawnFn } from './cli-types.js';
import { parseNDJSON, isParseError } from './ndjson-parser.js';

/** Default timeout: 5 minutes */
const DEFAULT_TIMEOUT_MS = 300_000;

/** Grace period between SIGTERM and SIGKILL */
const KILL_GRACE_MS = 3_000;

/**
 * Options for spawnCli (dependency injection for testing)
 */
export interface CliSpawnerDeps {
  /** Inject a custom spawn function (for testing) */
  spawnFn?: SpawnFn;
}

/**
 * Spawns a CLI process and yields parsed NDJSON events from stdout.
 *
 * Handles: NDJSON parsing, stderr buffering, timeout with SIGTERM→SIGKILL,
 * AbortSignal, cleanup on generator return, zombie prevention.
 */
export async function* spawnCli(
  options: CliSpawnOptions,
  deps?: CliSpawnerDeps
): AsyncGenerator<unknown, void, undefined> {
  const doSpawn: SpawnFn = deps?.spawnFn ?? defaultSpawn;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const child = doSpawn(options.command, options.args, {
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Buffer stderr for error reporting
  let stderrBuffer = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
  });

  let killed = false;
  let escalationTimer: ReturnType<typeof setTimeout> | undefined;

  function killChild(): void {
    if (killed) return;
    killed = true;
    child.kill('SIGTERM');
    escalationTimer = setTimeout(() => {
      child.kill('SIGKILL');
    }, KILL_GRACE_MS);
    escalationTimer.unref();
    child.on('exit', () => {
      if (escalationTimer !== undefined) clearTimeout(escalationTimer);
    });
  }

  // Timeout
  const timeoutTimer = setTimeout(() => killChild(), timeoutMs);
  timeoutTimer.unref();

  // AbortSignal
  const abortHandler = (): void => killChild();
  if (options.signal) {
    if (options.signal.aborted) {
      killChild();
    } else {
      options.signal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  // Zombie prevention
  const exitHandler = (): void => {
    if (!killed && child.pid !== undefined) {
      try {
        process.kill(child.pid, 'SIGKILL');
      } catch {
        // Process already gone
      }
    }
  };
  process.on('exit', exitHandler);

  try {
    if (!child.stdout) {
      throw new Error(`CLI process ${options.command} has no stdout`);
    }

    for await (const event of parseNDJSON(child.stdout)) {
      if (isParseError(event)) {
        // Log but don't yield parse errors
        const parseErr = event as { line: string };
        console.error(`[cli-spawn] JSON parse error from ${options.command}: ${parseErr.line}`);
        continue;
      }
      yield event;
    }
  } finally {
    clearTimeout(timeoutTimer);
    if (escalationTimer !== undefined) clearTimeout(escalationTimer);
    if (options.signal) {
      options.signal.removeEventListener('abort', abortHandler);
    }
    process.off('exit', exitHandler);
    killChild();
  }
}

/**
 * Default spawn function wrapping child_process.spawn
 */
function defaultSpawn(
  command: string,
  args: readonly string[],
  options: {
    cwd?: string | undefined;
    env?: NodeJS.ProcessEnv | undefined;
    stdio: ['ignore', 'pipe', 'pipe'];
  }
): ChildProcessLike {
  return nodeSpawn(command, [...args], {
    cwd: options.cwd,
    env: options.env,
    stdio: options.stdio,
  });
}
