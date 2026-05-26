import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

const SCRIPT = path.resolve(process.cwd(), 'scripts/pre-merge-gate-guard.mjs');

function runGuard(tempDir, args, env = {}) {
  const psFixture = path.join(tempDir, 'ps.txt');
  const lsofFixture = path.join(tempDir, 'lsof.txt');
  if (!existsSync(psFixture)) {
    writeFileSync(psFixture, `1 0 16016 /System/Library/PrivateFrameworks/fseventsd\n${process.pid} 1 100 node\n`);
  }
  if (!existsSync(lsofFixture)) {
    writeFileSync(lsofFixture, '');
  }

  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      CAT_CAFE_GATE_GUARD_PS_FIXTURE: psFixture,
      CAT_CAFE_GATE_GUARD_LSOF_FIXTURE: lsofFixture,
      ...env,
    },
  });
}

describe('pre-merge gate guard', () => {
  it('blocks a second gate while the holder pid is still alive', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'gate-guard-test-'));
    const lockDir = path.join(tempDir, 'pre-merge-check.lock');
    try {
      const first = runGuard(tempDir, ['acquire', '--lock-dir', lockDir, '--holder-pid', String(process.pid)]);
      assert.equal(first.status, 0, first.stderr);
      assert.equal(existsSync(lockDir), true);

      const second = runGuard(tempDir, ['acquire', '--lock-dir', lockDir, '--holder-pid', String(process.pid)]);
      assert.notEqual(second.status, 0);
      assert.match(second.stderr, /already running/);

      const release = runGuard(tempDir, ['release', '--lock-dir', lockDir, '--holder-pid', String(process.pid)]);
      assert.equal(release.status, 0, release.stderr);
      assert.equal(existsSync(lockDir), false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails fast on high fseventsd RSS and does not leave a lock', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'gate-guard-test-'));
    const lockDir = path.join(tempDir, 'pre-merge-check.lock');
    writeFileSync(path.join(tempDir, 'ps.txt'), '318 1 5000000 /System/Library/PrivateFrameworks/fseventsd\n');
    try {
      const result = runGuard(tempDir, ['acquire', '--lock-dir', lockDir, '--holder-pid', String(process.pid)], {
        CAT_CAFE_FSEVENTSD_RSS_MAX_KB: '1000',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /fseventsd RSS/);
      assert.equal(existsSync(lockDir), false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails fast on unmanaged random-port Redis listeners', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'gate-guard-test-'));
    const lockDir = path.join(tempDir, 'pre-merge-check.lock');
    writeFileSync(
      path.join(tempDir, 'lsof.txt'),
      [
        'redis-ser 100 user 6u IPv4 0x0 0t0 TCP 127.0.0.1:6399 (LISTEN)',
        'redis-ser 101 user 6u IPv4 0x0 0t0 TCP 127.0.0.1:63552 (LISTEN)',
      ].join('\n'),
    );
    try {
      const result = runGuard(tempDir, ['acquire', '--lock-dir', lockDir, '--holder-pid', String(process.pid)]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /port 63552/);
      assert.equal(existsSync(lockDir), false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
