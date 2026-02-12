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
 * Verify a symlink actually points to a different location (not self-referential).
 * Self-referential symlinks cause ELOOP and make the target inaccessible.
 * Returns true if the symlink is valid, false if self-referential or broken.
 */
function verifySymlink(linkPath: string, expectedTarget: string): boolean {
  try {
    const actualTarget = readlinkSync(linkPath);
    if (actualTarget === linkPath) {
      // Self-referential — symlink points to itself
      return false;
    }
    if (actualTarget !== expectedTarget) {
      // Points to wrong target
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a symlink with post-creation verification.
 * If the symlink ends up self-referential or invalid, removes the bad link
 * and returns false so the caller can apply its own fallback (copy for files,
 * mkdir for directories).
 */
function createVerifiedSymlink(target: string, linkPath: string): boolean {
  symlinkSync(target, linkPath);
  if (verifySymlink(linkPath, target)) {
    return true;
  }
  // Symlink is bad (self-referential or wrong target). Remove it.
  console.warn(`[cli-isolation] Bad symlink detected: ${linkPath} -> ${readlinkSync(linkPath)}, removing`);
  rmSync(linkPath, { force: true, recursive: true });
  return false;
}

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

    // Use lstatSync (not existsSync) because existsSync follows symlinks and returns
    // false for self-referential/broken symlinks, masking their existence.
    let authEntryExists = false;
    try { lstatSync(isolatedAuthFile); authEntryExists = true; } catch { /* ENOENT */ }

    if (authEntryExists) {
      const stat = lstatSync(isolatedAuthFile);
      if (!stat.isSymbolicLink()) {
        rmSync(isolatedAuthFile, { force: true });
        authEntryExists = false;
      } else if (!verifySymlink(isolatedAuthFile, realAuthFile)) {
        rmSync(isolatedAuthFile, { force: true });
        authEntryExists = false;
      }
    }

    if (!authEntryExists) {
      const ok = createVerifiedSymlink(realAuthFile, isolatedAuthFile);
      if (!ok) {
        // Symlink creation produced a bad link — fall back to copy.
        try { copyFileSync(realAuthFile, isolatedAuthFile); } catch { /* target may not exist */ }
      }
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
    // P1: if a stale entry exists, check if it's a valid symlink to the right target.
    // Use lstatSync (not existsSync) because existsSync follows symlinks and returns
    // false for self-referential/broken symlinks, masking their existence.
    let sessionsEntryExists = false;
    try { lstatSync(isolatedSessionsDir); sessionsEntryExists = true; } catch { /* ENOENT */ }

    if (sessionsEntryExists) {
      const stat = lstatSync(isolatedSessionsDir);
      if (!stat.isSymbolicLink()) {
        // Stale plain directory from a previous run
        rmSync(isolatedSessionsDir, { recursive: true, force: true });
        sessionsEntryExists = false;
      } else if (!verifySymlink(isolatedSessionsDir, realSessionsDir)) {
        // Broken or self-referential symlink
        rmSync(isolatedSessionsDir, { force: true });
        sessionsEntryExists = false;
      }
    }
    if (!sessionsEntryExists) {
      const ok = createVerifiedSymlink(realSessionsDir, isolatedSessionsDir);
      if (!ok) {
        // Symlink creation produced a bad link — fall back to plain directory.
        // Sessions won't persist to real HOME but Codex can still write them locally.
        mkdirSync(isolatedSessionsDir, { recursive: true });
      }
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
