/**
 * F253 Phase C — AC-C1: Pre-push Gate Reminder (Layer 4)
 *
 * Tests the gate-freshness checker script that warns when `pnpm gate`
 * hasn't been run recently. Soft warning only — never blocks push.
 *
 * The core logic lives in scripts/check-gate-freshness.sh (testable
 * standalone), called from .githooks/pre-push Layer 4.
 */

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';

const SCRIPT = join(import.meta.dirname, 'check-gate-freshness.sh');

/**
 * Run the gate-freshness check against a temp directory as REPO_ROOT.
 * Captures stderr→stdout so we can inspect warnings.
 * Returns { exitCode, output }.
 */
function runCheckCapture(repoRoot) {
  try {
    const output = execSync(`bash "${SCRIPT}" "${repoRoot}" 2>&1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, output };
  } catch (err) {
    // execSync throws on non-zero exit — but our script should always exit 0
    return { exitCode: err.status ?? 1, output: err.stdout || '' };
  }
}

describe('pre-push Layer 4: gate reminder', () => {
  test('warns when .gate-last-run is missing', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'gate-reminder-'));
    try {
      // No .gate-last-run file exists
      const { exitCode, output } = runCheckCapture(tmpDir);

      assert.equal(exitCode, 0, 'must always exit 0 (non-blocking)');
      assert.match(output, /REMINDER/, 'should print a reminder');
      assert.match(output, /pnpm gate/, 'should mention pnpm gate');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('warns when .gate-last-run is stale (>1 hour)', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'gate-reminder-'));
    try {
      // Write a timestamp from 2 hours ago
      const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
      writeFileSync(join(tmpDir, '.gate-last-run'), String(twoHoursAgo));

      const { exitCode, output } = runCheckCapture(tmpDir);

      assert.equal(exitCode, 0, 'must always exit 0 (non-blocking)');
      assert.match(output, /REMINDER/, 'should print a reminder');
      assert.match(output, /minutes ago/, 'should mention how long ago');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('no warning when .gate-last-run is fresh (<1 hour)', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'gate-reminder-'));
    try {
      // Write current timestamp (just ran gate)
      const now = Math.floor(Date.now() / 1000);
      writeFileSync(join(tmpDir, '.gate-last-run'), String(now));

      const { exitCode, output } = runCheckCapture(tmpDir);

      assert.equal(exitCode, 0, 'must always exit 0 (non-blocking)');
      assert.ok(!output.includes('REMINDER'), 'should NOT print a reminder when gate is fresh');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('exits 0 even if .gate-last-run contains garbage', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'gate-reminder-'));
    try {
      writeFileSync(join(tmpDir, '.gate-last-run'), 'not-a-number\n');

      const { exitCode } = runCheckCapture(tmpDir);

      // Must be fail-open — garbage sentinel should not crash or block
      assert.equal(exitCode, 0, 'must always exit 0 even on bad data');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('exits 0 even if REPO_ROOT does not exist', () => {
    const { exitCode } = runCheckCapture('/tmp/nonexistent-dir-xyz');

    assert.equal(exitCode, 0, 'must always exit 0 even on bad path');
  });
});
