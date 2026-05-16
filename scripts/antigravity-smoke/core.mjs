import { homedir } from 'node:os';
import { join } from 'node:path';

export const SCHEMA_VERSION = 1;
export const LOCK_NAME = '.antigravity-smoke-lock';
export const DEFAULT_STALE_LOCK_MS = 30 * 60 * 1000;

export function defaultSentinelRoot(now = Date.now()) {
  return join(homedir(), '.cat-cafe', 'smoke', `antigravity-sentinel-${now}`);
}

export function makeReport({ ok, stage, mode, cascadeId, cleanup, diagnostics }) {
  const finalCleanup = cleanup === undefined ? { ok: true, leftovers: [] } : cleanup;
  const finalDiagnostics = diagnostics === undefined ? {} : diagnostics;
  return {
    schemaVersion: SCHEMA_VERSION,
    ok,
    stage,
    mode,
    ...(cascadeId ? { cascadeId } : {}),
    journal: [],
    cleanup: finalCleanup,
    diagnostics: finalDiagnostics,
  };
}
