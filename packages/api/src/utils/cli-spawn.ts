/**
 * CLI Process Spawner
 * 通用 CLI 子进程管理器，处理生命周期、超时和清理
 */

import { spawn as nodeSpawn } from 'node:child_process';
import type { CliSpawnOptions, ChildProcessLike, SpawnFn } from './cli-types.js';
import { parseNDJSON, isParseError } from './ndjson-parser.js';

/** Default timeout: 30 minutes (configurable via CLI_TIMEOUT_MS env var, 0 = disable) */
const DEFAULT_TIMEOUT_MS = Number(process.env['CLI_TIMEOUT_MS']) || 1_800_000;

/** Grace period between SIGTERM and SIGKILL */
export const KILL_GRACE_MS = 3_000;

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
 * Handles: NDJSON parsing, stderr buffering, timeout with SIGTERM->SIGKILL,
 * AbortSignal, cleanup on generator return, zombie prevention.
 *
 * On non-zero exit: yields a final `{ __cliError, exitCode, stderr }` object.
 * On spawn error (e.g. ENOENT): throws.
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

  // Buffer stderr for error reporting (handler attached after resetTimeout is defined)
  let stderrBuffer = '';

  // Track child exit state (P1: prevents PID reuse kills)
  let childExited = false;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;

  const exitPromise = new Promise<void>((resolve) => {
    child.once('exit', (code, signal) => {
      childExited = true;
      exitCode = code;
      exitSignal = signal;
      resolve();
    });
  });

  // Handle spawn errors (P2: ENOENT for command-not-found)
  let spawnError: Error | undefined;
  child.once('error', (err: Error) => {
    spawnError = err;
  });

  let killed = false;
  let timedOut = false;
  let escalationTimer: ReturnType<typeof setTimeout> | undefined;

  function killChild(): void {
    if (killed || childExited) return;
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

  // Timeout (distinct from user cancel via AbortSignal)
  // Reset on any output — only triggers if CLI goes completely silent
  // timeoutMs = 0 disables timeout (rely on user cancel)
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  const resetTimeout = (): void => {
    if (timeoutMs === 0) return; // Disabled
    if (timeoutTimer) clearTimeout(timeoutTimer);
    timeoutTimer = setTimeout(() => {
      timedOut = true;
      killChild();
    }, timeoutMs);
    timeoutTimer.unref();
  };
  if (timeoutMs > 0) resetTimeout(); // Start initial timeout only if enabled

  // Attach stderr handler now that resetTimeout is defined
  // Reset timeout on stderr activity — CLI is alive (working on tools, thinking, etc.)
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
    resetTimeout();
  });

  // AbortSignal
  const abortHandler = (): void => killChild();
  if (options.signal) {
    if (options.signal.aborted) {
      killChild();
    } else {
      options.signal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  // Zombie prevention (P1: guard with childExited to prevent PID reuse kills)
  const exitHandler = (): void => {
    if (!childExited && child.pid !== undefined) {
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

    // Throw on spawn error before iterating
    if (spawnError) {
      throw spawnError;
    }

    for await (const event of parseNDJSON(child.stdout)) {
      if (spawnError) throw spawnError;
      // Reset timeout on any output — CLI is still alive
      resetTimeout();
      if (isParseError(event)) {
        const parseErr = event as { line: string };
        console.error(`[cli-spawn] JSON parse error from ${options.command}: ${parseErr.line}`);
        continue;
      }
      yield event;
    }

    // Check for spawn error that arrived during/after iteration
    if (spawnError) throw spawnError;

    // Wait for child to fully exit after stdout closes
    await exitPromise;

    // Yield error on abnormal exit (only if WE didn't kill it)
    // Covers both non-zero exitCode AND external signal kills
    if (!killed && (exitCode !== 0 || exitSignal !== null)) {
      const stderrTail = stderrBuffer.trim().slice(-500);
      yield {
        __cliError: true,
        exitCode,
        signal: exitSignal,
        stderr: stderrTail,
        command: options.command,
      };
    }

    // Yield timeout error (distinct from user cancel which stays silent)
    if (timedOut) {
      const stderrTail = stderrBuffer.trim().slice(-500);
      yield {
        __cliTimeout: true,
        timeoutMs,
        stderr: stderrTail,
        command: options.command,
      };
    }
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (escalationTimer !== undefined) clearTimeout(escalationTimer);
    if (options.signal) {
      options.signal.removeEventListener('abort', abortHandler);
    }
    process.off('exit', exitHandler);
    killChild();
  }
}

/**
 * Type guard for CLI error objects (abnormal exit or external signal kill)
 */
export function isCliError(
  value: unknown
): value is { __cliError: true; exitCode: number | null; signal: string | null; stderr: string; command: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__cliError' in value &&
    (value as Record<string, unknown>)['__cliError'] === true
  );
}

/**
 * Type guard for CLI timeout objects (process killed due to timeout)
 */
export function isCliTimeout(
  value: unknown
): value is { __cliTimeout: true; timeoutMs: number; stderr: string; command: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__cliTimeout' in value &&
    (value as Record<string, unknown>)['__cliTimeout'] === true
  );
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
