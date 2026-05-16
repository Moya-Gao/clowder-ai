import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_STALE_LOCK_MS, defaultSentinelRoot, LOCK_NAME, makeReport } from './core.mjs';

function pidAlive(pid) {
  if (!Number.isInteger(pid)) return false;
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLock(lockPath) {
  if (!existsSync(lockPath)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(lockPath, 'utf8'));
    return {
      pid: Number(parsed.pid),
      createdAt: Number(parsed.createdAt),
    };
  } catch {
    return { pid: 0, createdAt: 0 };
  }
}

function isStaleLock(lock, now) {
  if (!lock) return false;
  if (!pidAlive(lock.pid)) return true;
  if (!Number.isFinite(lock.createdAt)) return true;
  return now - lock.createdAt > DEFAULT_STALE_LOCK_MS;
}

function isSmokeOwnedName(name) {
  if (name === LOCK_NAME) return true;
  return /^sentinel-\d+\.txt$/.test(name);
}

function cleanupRoot(root, keep = new Set()) {
  const cleaned = [];
  if (!existsSync(root)) return cleaned;
  for (const name of readdirSync(root)) {
    if (keep.has(name)) continue;
    if (!isSmokeOwnedName(name)) continue;
    rmSync(join(root, name), { recursive: true, force: true });
    cleaned.push(name);
  }
  return cleaned.sort();
}

export function runSentinelSmoke(options) {
  if (!options.allowWrite) {
    return makeReport({
      ok: false,
      mode: 'sentinel',
      stage: 'write_opt_in_required',
      cleanup: { ok: true, leftovers: [] },
      diagnostics: { message: 'sentinel smoke requires --allow-write' },
    });
  }

  const now = options.now === undefined ? Date.now() : options.now;
  const root = resolve(options.sentinelRoot === undefined ? defaultSentinelRoot(now) : options.sentinelRoot);
  mkdirSync(root, { recursive: true });
  const lockPath = join(root, LOCK_NAME);
  const lock = readLock(lockPath);
  const staleLock = isStaleLock(lock, now) ? lock : undefined;

  if (lock && !staleLock) {
    return makeReport({
      ok: false,
      mode: 'sentinel',
      stage: 'sentinel_lock_active',
      cleanup: { ok: false, leftovers: readdirSync(root).sort() },
      diagnostics: { sentinelRoot: root, activeLock: lock },
    });
  }

  const cleanedLeftovers = cleanupRoot(root, new Set([LOCK_NAME]));
  if (staleLock) rmSync(lockPath, { force: true });
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, createdAt: now }, null, 2), 'utf8');

  const sentinelPath = join(root, `sentinel-${now}.txt`);
  writeFileSync(sentinelPath, `antigravity sentinel ${now}\n`, 'utf8');
  rmSync(sentinelPath, { force: true });
  rmSync(lockPath, { force: true });

  const leftovers = readdirSync(root).sort();
  return makeReport({
    ok: leftovers.length === 0,
    mode: 'sentinel',
    stage: leftovers.length === 0 ? 'sentinel_complete' : 'sentinel_cleanup_failed',
    cleanup: { ok: leftovers.length === 0, leftovers },
    diagnostics: {
      sentinelRoot: root,
      preflight: {
        ...(staleLock ? { staleLock } : {}),
        cleanedLeftovers,
      },
    },
  });
}
