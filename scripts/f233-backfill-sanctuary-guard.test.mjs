/**
 * F233 Phase C C2c — Cloud round 4 P1 regression: sanctuary guard in backfill script.
 *
 * Verifies that scripts/f233-backfill-feat-trajectory.mjs:
 *  1. Imports `resolveSanctuaryGuard` from community-bootstrap (defense in depth
 *     — guard against accidental future removal of the import).
 *  2. Behavioral: REDIS_URL=redis://localhost:6399 without --allow-sanctuary
 *     exits non-zero with a sanctuary diagnostic on stderr.
 *  3. Behavioral: 6398 does NOT trigger the sanctuary block (CLAUDE.md Rule 1:
 *     worktree dev uses 6398).
 *
 * Backstop for cloud Codex round 4 P1 finding on PR #2470: backfill could
 * mutate the protected Redis instance if REDIS_URL=6399 was set in env.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCRIPT_PATH = join(__dirname, 'f233-backfill-feat-trajectory.mjs');

function runScript(env, args = []) {
  return new Promise((resolve) => {
    const proc = spawn('node', [SCRIPT_PATH, ...args], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    let stdout = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.on('close', (code) => resolve({ code, stderr, stdout }));
    // Defensive timeout — if script hangs (e.g. on real redis.connect), kill.
    setTimeout(() => proc.kill('SIGKILL'), 8_000);
  });
}

describe('F233 backfill — sanctuary guard (cloud round 4 P1 regression)', () => {
  test('source imports resolveSanctuaryGuard from community-bootstrap', () => {
    const src = readFileSync(SCRIPT_PATH, 'utf8');
    assert.match(
      src,
      /import\s*\{\s*resolveSanctuaryGuard\s*\}\s*from\s*['"]\.\/community-bootstrap\.mjs['"]/,
      'must import resolveSanctuaryGuard from community-bootstrap.mjs',
    );
    assert.match(src, /resolveSanctuaryGuard\(REDIS_URL,\s*allowSanctuary\)/, 'must call the guard with REDIS_URL');
    assert.match(src, /--allow-sanctuary/, 'must document/use the --allow-sanctuary CLI flag');
  });

  test('REDIS_URL=6399 without --allow-sanctuary → exit 1 + sanctuary diagnostic on stderr', async () => {
    const result = await runScript({ REDIS_URL: 'redis://localhost:6399' });
    assert.strictEqual(result.code, 1, `expected exit 1 (sanctuary block), got ${result.code}`);
    assert.match(result.stderr, /sanctuary/i, 'stderr should mention sanctuary');
    assert.match(result.stderr, /6399/, 'stderr should call out port 6399');
    assert.match(result.stderr, /--allow-sanctuary/, 'stderr should hint at --allow-sanctuary escape');
  });

  test('REDIS_URL=6398 (worktree dev) → does NOT trigger sanctuary block', async () => {
    // 6398 is the worktree-dev port; sanctuary guard MUST NOT block it. The
    // script may exit non-zero for other reasons (Redis not running, 0 snapshots,
    // etc.) — those are downstream of the guard. We only assert the sanctuary
    // diagnostic is absent.
    const result = await runScript({ REDIS_URL: 'redis://localhost:6398' });
    assert.doesNotMatch(
      result.stderr,
      /sanctuary/i,
      `port 6398 must not trigger sanctuary block; stderr: ${result.stderr.slice(0, 200)}`,
    );
  });

  test('REDIS_URL=6399 WITH --allow-sanctuary → sanctuary warning on stderr (not blocked)', async () => {
    // CVO sign-off escape: --allow-sanctuary should bypass the block but emit
    // a warning so the operator knows they're targeting production. The script
    // may still exit non-zero for downstream reasons (Hub Redis not actually
    // running on the test machine) — we only assert the WARN diagnostic + no
    // BLOCK message.
    const result = await runScript({ REDIS_URL: 'redis://localhost:6399' }, ['--allow-sanctuary']);
    const combined = result.stderr + result.stdout;
    assert.match(combined, /TARGETING REDIS SANCTUARY|CVO sign-off required/i, 'should warn about sanctuary target');
    assert.doesNotMatch(result.stderr, /Refusing to proceed/i, 'should not block when --allow-sanctuary is passed');
  });
});
