/**
 * F230 PTY utility helpers — shared by PtyDriver and ClaudeInteractivePtyCarrierService.
 * Functions here are stateless or use tmux/fs primitives only.
 */
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { PtyDriverOptions } from './PtyDriver.js';

const execFileAsync = promisify(execFile);

/**
 * Derives a compact session name from a random token.
 * Keep ≤20 chars: tmux has no hard limit but long names are ugly in `tmux ls`.
 */
export function generateSessionName(prefix: string): string {
  const token = Math.random().toString(36).slice(2, 10); // 8 hex-ish chars
  return `${prefix}-${token}`;
}

/**
 * Shell-quote a single argument for use in a $SHELL -c command string.
 * tmux new-session passes the shell-command arg to $SHELL -c, so every
 * token must be single-quoted to prevent metacharacter injection from
 * caller-supplied values (e.g. model override strings, extra args).
 */
export function shellQuoteArg(s: string): string {
  // Wrap in single quotes; escape embedded single quotes as '\''
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/**
 * Build the shell command string to launch claude inside the tmux pane.
 *
 * Handles null values from opts.env as `-u KEY` (unset) flags.
 * String values are passed via `tmux new-session -e KEY=VALUE` in start() instead
 * (avoids shell quoting issues — tmux receives them as direct args).
 *
 * Note 3: always unset CLAUDE_CODE_ENTRYPOINT / CLAUDECODE (双保险:
 * even if the caller already deleted them, tmux server env may carry them).
 */
export function buildClaudeCommand(opts: PtyDriverOptions): string {
  const binary = opts.claudeBinary ?? 'claude';
  const args: string[] = [];

  if (opts.resumeSessionId) {
    args.push('--resume', opts.resumeSessionId);
  } else if (opts.newSessionId) {
    // F230 R10: pre-assign session ID so transcript path is deterministic.
    // Claude names the transcript file <newSessionId>.jsonl in the projects dir.
    args.push('--session-id', opts.newSessionId);
  }
  if (opts.extraArgs?.length) {
    args.push(...opts.extraArgs);
  }

  // P1 shell-quote fix: tmux new-session passes the shell-command arg to
  // $SHELL -c — every token must be quoted to prevent metacharacter injection
  // from caller-supplied values (model override, extraArgs, etc.).
  const claudeCmd = [binary, ...args].map(shellQuoteArg).join(' ');

  // Build -u flags for every null/undefined var in opts.env delta
  const unsetFlags = Object.entries(opts.env)
    .filter(([, v]) => v === null || v === undefined)
    .map(([k]) => `-u ${k}`)
    .join(' ');

  return unsetFlags ? `env ${unsetFlags} ${claudeCmd}` : claudeCmd;
}

/** Run a tmux command, returning stdout. Throws on non-zero exit. */
export async function tmux(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('tmux', args, { encoding: 'utf8' });
  return stdout;
}

/** Run a tmux command synchronously for simple checks. Returns stdout or '' on error. */
export function tmuxSync(...args: string[]): string {
  try {
    return execFileSync('tmux', args, { encoding: 'utf8', timeout: 5000 });
  } catch {
    return '';
  }
}

/**
 * Wait for a specific file to appear at a known path.
 *
 * Used when the transcript path is pre-determined via `--session-id` (F230 R10 fix).
 * Resolves as soon as `filePath` exists; rejects after `timeoutMs`.
 *
 * Combines fs.watch (parent directory) for fast notification with polling (200ms)
 * as a fallback for platforms where fs.watch is unreliable.
 */
export function waitForExactFile(filePath: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (existsSync(filePath)) {
      resolve();
      return;
    }

    let watcher: ReturnType<typeof watch> | undefined;
    let pollInterval: ReturnType<typeof setInterval>;
    let timer: ReturnType<typeof setTimeout>;

    const targetName = basename(filePath);
    const parentDir = dirname(filePath);

    const cleanup = () => {
      clearInterval(pollInterval);
      clearTimeout(timer);
      watcher?.close();
    };

    const check = () => {
      if (existsSync(filePath)) {
        cleanup();
        resolve();
      }
    };

    // Watch parent directory for the specific file to appear
    try {
      if (existsSync(parentDir)) {
        watcher = watch(parentDir, { persistent: false }, (_event, filename) => {
          if (filename === targetName) check();
        });
        watcher.on('error', () => {
          // ignore watch errors — polling covers it
        });
      }
    } catch {
      // fs.watch may fail on some platforms — polling covers it
    }

    // Polling fallback every 200ms (covers dirs that don't exist yet)
    pollInterval = setInterval(check, 200);

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`PtyDriver: transcript file not found within ${timeoutMs}ms: ${filePath}`));
    }, timeoutMs);
  });
}

/**
 * Detect the `--permission-mode bypassPermissions` confirmation screen in tmux pane content.
 *
 * Claude TUI (2.1.170+) shows a confirmation menu when `--permission-mode bypassPermissions`
 * is passed on a fresh machine (consent has not been pre-accepted). The menu looks like:
 *
 *   ❯ 1. No, exit
 *     2. Yes, I accept
 *
 * The DEFAULT cursor is on "1. No, exit" — plain Enter exits the session.
 * To accept: send Down (navigate to "2. Yes, I accept"), then Enter.
 *
 * On machines where consent was already accepted (pre-warmed), this screen does not
 * appear — Claude loads the TUI directly.
 *
 * Detection: presence of the literal string "bypassPermissions" in the pane content
 * (specific enough not to fire on regular chat output).
 *
 * Evidence (砚砚 R3 pane capture 2026-06-10, Claude Code 2.1.170):
 *   - default cursor on "❯ 1. No, exit"
 *   - plain Enter → exits session (selects No)
 *   - "2" + Enter → also exits (numeric input not accepted)
 *   - Down + Enter → navigates to "2. Yes, I accept" → accepted (correct path)
 */
export function isBypassConfirmationScreen(paneContent: string): boolean {
  return paneContent.includes('bypassPermissions');
}

/**
 * Compute the Claude transcript directory for a given cwd.
 *
 * @param effectiveHome — the HOME used by the child Claude process. Pass
 *   `options.accountEnv.HOME` when it is set so that account-isolated
 *   invocations (which run Claude with a different HOME via tmux -e HOME=...)
 *   look for transcripts in the correct directory.
 *   Falls back to `os.homedir()` (API-process HOME) when not provided.
 */
export function ptyTranscriptDir(cwd: string, effectiveHome?: string): string {
  const slug = cwd.replace(/\//g, '-');
  return join(effectiveHome ?? homedir(), '.claude', 'projects', slug);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
