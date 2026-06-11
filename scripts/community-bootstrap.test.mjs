#!/usr/bin/env node
/**
 * community-bootstrap CLI — argument parsing + sanctuary guard tests (F168)
 *
 * Tests are split into three levels:
 *  1. parseArgs()           — pure arg parsing, no I/O
 *  2. resolveSanctuaryGuard() — pure guard decision, no I/O
 *  3. CLI entrypoint (spawn) — behavior-level: guards main() calling convention
 *
 * Level 3 is the critical layer: it catches regressions where a developer
 * keeps the helper but removes the `if (blocked) { process.exit(1) }` call
 * in main(). Levels 1+2 alone cannot catch that.
 *
 * The underlying communityBootstrap() module is covered separately in
 * packages/api/test/redis-community-bootstrap.test.js.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { parseArgs, resolveSanctuaryGuard } from './community-bootstrap.mjs';

const SCRIPT = new URL('./community-bootstrap.mjs', import.meta.url).pathname;

describe('community-bootstrap CLI parseArgs', () => {
  it('defaults to dry-run when no flags given', () => {
    const { dryRun } = parseArgs([]);
    assert.strictEqual(dryRun, true, 'no flags → dryRun should be true');
  });

  it('--dry-run flag → dry-run mode', () => {
    const { dryRun } = parseArgs(['--dry-run']);
    assert.strictEqual(dryRun, true);
  });

  it('--execute flag → live run mode (dryRun=false)', () => {
    const { dryRun } = parseArgs(['--execute']);
    assert.strictEqual(dryRun, false, '--execute must set dryRun=false');
  });

  it('unknown flags are ignored; default dry-run preserved', () => {
    const { dryRun } = parseArgs(['--verbose', '--no-color']);
    assert.strictEqual(dryRun, true);
  });

  it('--execute combined with other flags → live run mode', () => {
    const { dryRun } = parseArgs(['--verbose', '--execute', '--no-color']);
    assert.strictEqual(dryRun, false);
  });
});

describe('community-bootstrap CLI parseArgs — --allow-sanctuary flag', () => {
  it('no --allow-sanctuary → allowSanctuary defaults to false', () => {
    const { allowSanctuary } = parseArgs([]);
    assert.strictEqual(allowSanctuary, false, 'missing flag must default to false');
  });

  it('--allow-sanctuary → allowSanctuary=true', () => {
    const { allowSanctuary } = parseArgs(['--allow-sanctuary']);
    assert.strictEqual(allowSanctuary, true);
  });

  it('--execute --allow-sanctuary → dryRun=false AND allowSanctuary=true', () => {
    const result = parseArgs(['--execute', '--allow-sanctuary']);
    assert.strictEqual(result.dryRun, false);
    assert.strictEqual(result.allowSanctuary, true);
  });

  it('--dry-run --allow-sanctuary → dryRun=true AND allowSanctuary=true', () => {
    const result = parseArgs(['--dry-run', '--allow-sanctuary']);
    assert.strictEqual(result.dryRun, true);
    assert.strictEqual(result.allowSanctuary, true);
  });

  it('--allow-sanctuary alone does not flip dryRun (default stays true)', () => {
    const result = parseArgs(['--allow-sanctuary']);
    assert.strictEqual(result.dryRun, true, 'sanctuary flag alone must not imply live run');
  });
});

describe('sanctuary guard decision — resolveSanctuaryGuard()', () => {
  it('6399 without --allow-sanctuary → blocked (hard-exit signal)', () => {
    const r = resolveSanctuaryGuard('redis://localhost:6399', false);
    assert.strictEqual(r.blocked, true, '6399 without flag must block');
  });

  it('6399 with --allow-sanctuary → NOT blocked, warnSanctuary=true', () => {
    const r = resolveSanctuaryGuard('redis://localhost:6399', true);
    assert.strictEqual(r.blocked, false, '6399 with flag must not block');
    assert.strictEqual(r.warnSanctuary, true, '6399 with flag must warn');
  });

  it('6398 without --allow-sanctuary → NOT blocked, no warning', () => {
    const r = resolveSanctuaryGuard('redis://localhost:6398', false);
    assert.strictEqual(r.blocked, false);
    assert.strictEqual(r.warnSanctuary, false);
  });

  it('6398 with --allow-sanctuary → NOT blocked, no warning (flag irrelevant for non-sanctuary)', () => {
    const r = resolveSanctuaryGuard('redis://localhost:6398', true);
    assert.strictEqual(r.blocked, false);
    assert.strictEqual(r.warnSanctuary, false);
  });
});

// ---------------------------------------------------------------------------
// Level 3: CLI entrypoint behavior (spawn-level)
//
// These tests spawn the actual CLI process to guard the calling convention
// in main():  resolveSanctuaryGuard() result → if (blocked) process.exit(1)
//
// Without these, a developer could keep the helper but remove the
// `if (blocked)` call in main() and all unit tests would still pass.
//
// The 6399 hard-exit test is SAFE — the guard fires before createRedisClient(),
// so no Redis connection is ever attempted.
//
// The --allow-sanctuary banner test is intentionally NOT spawn-tested here:
// that path proceeds past the guard to Redis ping, which would touch the
// production sanctuary if it is online.  The banner branch is covered by the
// resolveSanctuaryGuard() unit test (warnSanctuary=true) + code review.
// ---------------------------------------------------------------------------

describe('sanctuary guard — CLI entrypoint behavior (spawn)', () => {
  it('CLI: 6399 without --allow-sanctuary → exits 1 and prints --allow-sanctuary hint (no Redis ping)', () => {
    // Guard fires BEFORE createRedisClient(), so this spawn never touches Redis.
    const result = spawnSync(process.execPath, [SCRIPT], {
      env: { ...process.env, REDIS_URL: 'redis://localhost:6399' },
      encoding: 'utf8',
      timeout: 5000,
    });

    assert.strictEqual(result.status, 1, 'guard must hard-exit with code 1');
    assert.ok(
      result.stderr.includes('allow-sanctuary'),
      `stderr must mention --allow-sanctuary (got: ${result.stderr.slice(0, 300)})`,
    );
  });
});
