/**
 * CLI Config Isolation
 * Prevents global user configs (e.g. ~/.codex/AGENTS.md) from overriding
 * session-level instructions during Cat Cafe invocations.
 */

import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const ISOLATION_ROOT = join(tmpdir(), 'cat-cafe-cli-isolation');

/** Files to copy from ~/.codex/ to the isolated dir (auth only, NOT AGENTS.md) */
const CODEX_SAFE_FILES = ['auth.json', 'config.toml'];

let codexIsolatedHome: string | null = null;

/**
 * Returns a HOME path where ~/.codex/ contains only auth + config,
 * without AGENTS.md or other user-specific overrides.
 * Creates the directory lazily on first call.
 */
export function getCodexIsolatedHome(): string {
  if (codexIsolatedHome) return codexIsolatedHome;

  const isolatedHome = join(ISOLATION_ROOT, 'codex-home');
  const isolatedCodexDir = join(isolatedHome, '.codex');
  mkdirSync(isolatedCodexDir, { recursive: true });

  const realCodexDir = join(homedir(), '.codex');
  for (const file of CODEX_SAFE_FILES) {
    const src = join(realCodexDir, file);
    const dst = join(isolatedCodexDir, file);
    if (existsSync(src)) {
      copyFileSync(src, dst);
    }
  }

  codexIsolatedHome = isolatedHome;
  return isolatedHome;
}

/** Reset cached path (for testing) */
export function resetCodexIsolatedHome(): void {
  codexIsolatedHome = null;
}
