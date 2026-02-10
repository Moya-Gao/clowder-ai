/**
 * CLI Config Isolation
 * Prevents global user configs (e.g. ~/.codex/AGENTS.md) from overriding
 * session-level instructions during Cat Cafe invocations.
 */

import { mkdirSync, copyFileSync, symlinkSync, rmSync, existsSync, lstatSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const ISOLATION_ROOT = join(tmpdir(), 'cat-cafe-cli-isolation');

/** Files to copy from ~/.codex/ to the isolated dir (NOT AGENTS.md) */
const CODEX_COPY_FILES = ['config.toml'];

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
  for (const file of CODEX_COPY_FILES) {
    const src = join(realCodexDir, file);
    const dst = join(isolatedCodexDir, file);
    if (existsSync(src)) {
      copyFileSync(src, dst);
    }
  }

  // OAuth token refresh must persist to real HOME for long-running sessions.
  // Keep auth.json as a symlink to ~/.codex/auth.json (fallback to copy if symlink fails).
  const realAuthFile = join(realCodexDir, 'auth.json');
  const isolatedAuthFile = join(isolatedCodexDir, 'auth.json');
  try {
    if (!existsSync(realCodexDir)) {
      mkdirSync(realCodexDir, { recursive: true });
    }

    if (existsSync(isolatedAuthFile)) {
      const stat = lstatSync(isolatedAuthFile);
      if (!stat.isSymbolicLink()) {
        rmSync(isolatedAuthFile, { force: true });
      } else {
        const target = readlinkSync(isolatedAuthFile);
        if (target !== realAuthFile) {
          rmSync(isolatedAuthFile, { force: true });
        }
      }
    }

    if (!existsSync(isolatedAuthFile)) {
      symlinkSync(realAuthFile, isolatedAuthFile);
    }
  } catch {
    // Fallback: keep a local auth snapshot if symlink creation is not allowed.
    if (existsSync(realAuthFile)) {
      try {
        copyFileSync(realAuthFile, isolatedAuthFile);
      } catch {
        // Best-effort only.
      }
    }
  }

  // Symlink sessions/ so Codex writes session records to the real HOME.
  // Without this, sessions are lost in /tmp and `codex resume` can't find them.
  const realSessionsDir = join(realCodexDir, 'sessions');
  const isolatedSessionsDir = join(isolatedCodexDir, 'sessions');
  try {
    // P2: ensure real sessions dir exists (fresh install scenario)
    if (!existsSync(realSessionsDir)) {
      mkdirSync(realSessionsDir, { recursive: true });
    }
    // P1: if a stale plain directory exists from a previous run, replace it
    if (existsSync(isolatedSessionsDir)) {
      const stat = lstatSync(isolatedSessionsDir);
      if (!stat.isSymbolicLink()) {
        rmSync(isolatedSessionsDir, { recursive: true, force: true });
      }
    }
    if (!existsSync(isolatedSessionsDir)) {
      symlinkSync(realSessionsDir, isolatedSessionsDir);
    }
  } catch {
    // Best-effort: if symlink fails (permissions), sessions won't persist
    // but Cat Cafe can still function via SessionManager's in-memory store
  }

  codexIsolatedHome = isolatedHome;
  return isolatedHome;
}

/** Reset cached path (for testing) */
export function resetCodexIsolatedHome(): void {
  codexIsolatedHome = null;
}
