#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { parseAntigravitySmokeArgs, runAntigravityAvailabilitySmoke } from './antigravity-availability-smoke.mjs';
import { discoverLanguageServer } from './antigravity-smoke/discovery.mjs';
import { runReadonlySmoke } from './antigravity-smoke/readonly.mjs';

describe('F201 Phase D Antigravity availability smoke runner', () => {
  test('keeps smoke source files under the 350-line hard limit', () => {
    const moduleDir = new URL('./antigravity-smoke/', import.meta.url);
    const smokeFiles = [
      new URL('./antigravity-availability-smoke.mjs', import.meta.url),
      ...readdirSync(moduleDir)
        .filter((name) => name.endsWith('.mjs'))
        .map((name) => new URL(name, moduleDir)),
    ];

    for (const file of smokeFiles) {
      const lineCount = readFileSync(file, 'utf8').split('\n').length;
      assert.ok(lineCount <= 350, `${file.pathname} has ${lineCount} lines`);
    }
  });

  test('defaults to readonly dry-run shape without mutating sentinel filesystem', async () => {
    const report = await runAntigravityAvailabilitySmoke({ dryRun: true });

    assert.equal(report.ok, true);
    assert.equal(report.mode, 'readonly');
    assert.equal(report.stage, 'readonly_dry_run');
    assert.equal(report.schemaVersion, 1);
    assert.deepEqual(report.journal, []);
    assert.deepEqual(report.cleanup, { ok: true, leftovers: [] });
    assert.equal(report.diagnostics.dryRun, true);
  });

  test('sentinel mode refuses writes without explicit opt-in', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-ag-smoke-refuse-'));
    try {
      const report = await runAntigravityAvailabilitySmoke({
        mode: 'sentinel',
        sentinelRoot: root,
        allowWrite: false,
        dryRun: false,
      });

      assert.equal(report.ok, false);
      assert.equal(report.stage, 'write_opt_in_required');
      assert.deepEqual(report.cleanup, { ok: true, leftovers: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('sentinel mode reports and cleans stale lock plus leftovers before running', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-ag-smoke-sentinel-'));
    try {
      writeFileSync(join(root, '.antigravity-smoke-lock'), JSON.stringify({ pid: 99999999, createdAt: 1 }), 'utf8');
      writeFileSync(join(root, 'sentinel-1769999999999.txt'), 'old run', 'utf8');

      const report = await runAntigravityAvailabilitySmoke({
        mode: 'sentinel',
        sentinelRoot: root,
        allowWrite: true,
        now: 1770000000000,
      });

      assert.equal(report.ok, true);
      assert.equal(report.stage, 'sentinel_complete');
      assert.equal(report.cleanup.ok, true);
      assert.deepEqual(report.cleanup.leftovers, []);
      assert.deepEqual(report.diagnostics.preflight.staleLock, { pid: 99999999, createdAt: 1 });
      assert.deepEqual(report.diagnostics.preflight.cleanedLeftovers, ['sentinel-1769999999999.txt']);
      assert.throws(() => readFileSync(join(root, '.antigravity-smoke-lock'), 'utf8'), /ENOENT/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('sentinel mode preserves non-smoke files under a custom root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-ag-smoke-guard-'));
    const importantDir = join(root, 'important-dir');
    try {
      mkdirSync(importantDir);
      writeFileSync(join(root, 'important.txt'), 'keep me', 'utf8');
      writeFileSync(join(importantDir, 'nested.txt'), 'keep nested', 'utf8');
      writeFileSync(join(root, 'sentinel-1769999999999.txt'), 'old smoke artifact', 'utf8');

      const report = await runAntigravityAvailabilitySmoke({
        mode: 'sentinel',
        sentinelRoot: root,
        allowWrite: true,
        now: 1770000000000,
      });

      assert.equal(existsSync(join(root, 'important.txt')), true);
      assert.equal(existsSync(join(importantDir, 'nested.txt')), true);
      assert.equal(report.ok, false);
      assert.equal(report.stage, 'sentinel_cleanup_failed');
      assert.deepEqual(report.diagnostics.preflight.cleanedLeftovers, ['sentinel-1769999999999.txt']);
      assert.deepEqual(report.cleanup.leftovers, ['important-dir', 'important.txt']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('CLI parser keeps writes opt-in and defaults mode to readonly', () => {
    assert.deepEqual(parseAntigravitySmokeArgs([]), {
      mode: 'readonly',
      allowWrite: false,
      dryRun: false,
      sentinelRoot: undefined,
      threadId: undefined,
      outputJson: undefined,
    });
    assert.deepEqual(parseAntigravitySmokeArgs(['--mode=sentinel', '--allow-write', '--sentinel-root=/tmp/x']), {
      mode: 'sentinel',
      allowWrite: true,
      dryRun: false,
      sentinelRoot: '/tmp/x',
      threadId: undefined,
      outputJson: undefined,
    });
  });

  test('falls back to process discovery when env language server probe is stale', async () => {
    const report = await discoverLanguageServer(
      {
        ANTIGRAVITY_PORT: '48123',
        ANTIGRAVITY_CSRF_TOKEN: 'stale-token',
      },
      {
        probeEnvLanguageServer: async () => ({
          ok: false,
          stage: 'ls_unreachable',
          conn: { port: 48123, csrfToken: 'stale-token', useTls: true },
          probe: { ok: false, error: 'ECONNREFUSED' },
        }),
        listLanguageServerProcesses: () => [
          {
            pid: '12345',
            cmd: 'language_server --csrf_token fresh-token --extension_server_port 4100',
          },
        ],
        probeProcessLanguageServer: async (proc) => ({
          ok: true,
          source: 'process',
          pid: proc.pid,
          conn: { port: 4101, csrfToken: 'fresh-token', useTls: false },
          probe: { ok: true, status: 200, body: '{}' },
        }),
      },
    );

    assert.equal(report.ok, true);
    assert.equal(report.source, 'process');
    assert.equal(report.pid, '12345');
    assert.equal(report.conn.csrfToken, 'fresh-token');
  });

  test('readonly failure diagnostics redact connection secrets before reporting', async () => {
    const report = await runReadonlySmoke({
      env: {
        ANTIGRAVITY_PORT: '48123',
        ANTIGRAVITY_CSRF_TOKEN: 'live-env-token',
      },
      discoveryDeps: {
        probeEnvLanguageServer: async () => ({
          ok: false,
          stage: 'ls_unreachable',
          conn: { port: 48123, csrfToken: 'live-env-token', useTls: true },
          probe: { ok: false, error: 'ECONNREFUSED' },
        }),
        listLanguageServerProcesses: () => [
          {
            pid: '12345',
            cmd: 'language_server --csrf_token live-process-token --extension_server_port 4100',
          },
        ],
        probeProcessLanguageServer: async () => undefined,
      },
    });

    const serialized = JSON.stringify(report);
    assert.equal(report.ok, false);
    assert.equal(report.stage, 'ls_unreachable');
    assert.equal(report.diagnostics.conn.csrfToken, '[REDACTED]');
    assert.equal(
      report.diagnostics.processes[0].cmd,
      'language_server --csrf_token [REDACTED] --extension_server_port 4100',
    );
    assert.doesNotMatch(serialized, /live-env-token|live-process-token/);
  });
});
