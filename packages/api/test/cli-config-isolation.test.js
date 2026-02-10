/**
 * CLI Config Isolation Tests
 * Verifies that getCodexIsolatedHome() correctly isolates AGENTS.md
 * while preserving session storage via symlink.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const ISOLATION_ROOT = join(tmpdir(), 'cat-cafe-cli-isolation');

describe('getCodexIsolatedHome', () => {
  beforeEach(() => {
    // Clean up isolation dir to force fresh creation
    try { rmSync(ISOLATION_ROOT, { recursive: true, force: true }); } catch { /* ok */ }
  });

  afterEach(async () => {
    // Reset cached home so next test gets fresh creation
    const mod = await import('../dist/utils/cli-config-isolation.js');
    mod.resetCodexIsolatedHome();
    try { rmSync(ISOLATION_ROOT, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it('creates isolated .codex dir with auth and config but without AGENTS.md', async () => {
    const { getCodexIsolatedHome } = await import('../dist/utils/cli-config-isolation.js');
    const isolatedHome = getCodexIsolatedHome();
    const isolatedCodexDir = join(isolatedHome, '.codex');

    assert.ok(existsSync(isolatedCodexDir), 'isolated .codex dir should exist');

    // AGENTS.md must NOT be present (the whole point of isolation)
    assert.ok(
      !existsSync(join(isolatedCodexDir, 'AGENTS.md')),
      'AGENTS.md should NOT be copied to isolated dir',
    );

    // Auth files should be copied if they exist in real home
    const realCodexDir = join(homedir(), '.codex');
    if (existsSync(join(realCodexDir, 'auth.json'))) {
      assert.ok(
        existsSync(join(isolatedCodexDir, 'auth.json')),
        'auth.json should be copied',
      );
    }
  });

  it('symlinks sessions/ to real ~/.codex/sessions/ for session persistence', async () => {
    const realSessionsDir = join(homedir(), '.codex', 'sessions');
    if (!existsSync(realSessionsDir)) {
      // Create sessions dir if it doesn't exist (needed for test)
      mkdirSync(realSessionsDir, { recursive: true });
    }

    const { getCodexIsolatedHome } = await import('../dist/utils/cli-config-isolation.js');
    const isolatedHome = getCodexIsolatedHome();
    const isolatedSessionsDir = join(isolatedHome, '.codex', 'sessions');

    assert.ok(existsSync(isolatedSessionsDir), 'sessions dir should exist in isolated home');

    // Verify it's a symlink, not a regular directory
    const stat = lstatSync(isolatedSessionsDir);
    assert.ok(stat.isSymbolicLink(), 'sessions should be a symlink, not a copy');
  });

  it('returns consistent path on repeated calls (caching)', async () => {
    const { getCodexIsolatedHome } = await import('../dist/utils/cli-config-isolation.js');
    const first = getCodexIsolatedHome();
    const second = getCodexIsolatedHome();
    assert.equal(first, second, 'should return cached path');
  });

  it('P1: replaces stale plain directory with symlink (pre-existing isolation dir)', async () => {
    // Simulate pre-existing isolation dir with sessions as a plain directory
    const isolatedCodexDir = join(ISOLATION_ROOT, 'codex-home', '.codex');
    const staleSessionsDir = join(isolatedCodexDir, 'sessions');
    mkdirSync(staleSessionsDir, { recursive: true });

    // Verify it's a plain dir before the fix
    assert.ok(lstatSync(staleSessionsDir).isDirectory(), 'pre-condition: plain dir');
    assert.ok(!lstatSync(staleSessionsDir).isSymbolicLink(), 'pre-condition: not symlink');

    const { getCodexIsolatedHome } = await import('../dist/utils/cli-config-isolation.js');
    const isolatedHome = getCodexIsolatedHome();
    const isolatedSessionsDir = join(isolatedHome, '.codex', 'sessions');

    // After fix: should be a symlink, not the stale plain directory
    const stat = lstatSync(isolatedSessionsDir);
    assert.ok(stat.isSymbolicLink(), 'stale plain dir should be replaced with symlink');
  });

  it('P2: creates real sessions dir and symlinks even on fresh install (fake HOME)', async () => {
    // Use a temporary HOME to simulate fresh install where ~/.codex/sessions doesn't exist
    const fakeHome = join(tmpdir(), 'cat-cafe-test-fresh-home-' + Date.now());
    const fakeCodexDir = join(fakeHome, '.codex');
    mkdirSync(fakeCodexDir, { recursive: true });
    // Provide minimal auth so the function doesn't error on copy attempts
    writeFileSync(join(fakeCodexDir, 'auth.json'), '{}');

    const originalHome = process.env['HOME'];
    try {
      process.env['HOME'] = fakeHome;

      // Reset cache + re-import to pick up new HOME
      const mod = await import('../dist/utils/cli-config-isolation.js');
      mod.resetCodexIsolatedHome();
      const isolatedHome = mod.getCodexIsolatedHome();
      const isolatedSessionsDir = join(isolatedHome, '.codex', 'sessions');

      // Real sessions dir should have been created by the fix
      const fakeSessionsDir = join(fakeCodexDir, 'sessions');
      assert.ok(existsSync(fakeSessionsDir), 'real sessions dir should be created on fresh install');

      // Isolated sessions should be a symlink pointing to the real dir
      assert.ok(existsSync(isolatedSessionsDir), 'isolated sessions should exist');
      const stat = lstatSync(isolatedSessionsDir);
      assert.ok(stat.isSymbolicLink(), 'isolated sessions should be a symlink');
    } finally {
      process.env['HOME'] = originalHome;
      try { rmSync(fakeHome, { recursive: true, force: true }); } catch { /* ok */ }
    }
  });
});
