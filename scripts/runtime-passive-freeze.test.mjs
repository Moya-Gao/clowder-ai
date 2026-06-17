#!/usr/bin/env node

// ADR-039 invariant guard tests
//
// Verifies runtime passive-freeze contract:
// 1. scripts/runtime-worktree.sh exports CAT_CAFE_DIRECT_NO_WATCH in both
//    start paths (in-place mode + worktree mode) before exec'ing start-dev.sh.
// 2. No `sync)` dispatch case in runtime-worktree.sh — sync folded into start.
// 3. No `runtime:sync` script entry in package.json.
//
// These are static-source checks. End-to-end verification (does runtime
// actually start without tsx watch?) belongs to alpha test per LL-064.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const RUNTIME_SCRIPT = readFileSync(join(REPO_ROOT, 'scripts/runtime-worktree.sh'), 'utf-8');
const PACKAGE_JSON = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'));

test('ADR-039 Invariant 1a: in-place start path exports CAT_CAFE_DIRECT_NO_WATCH', () => {
  // Find the in-place exec block (RUNTIME_DIR=PROJECT_DIR path)
  const inPlaceBlockMatch = RUNTIME_SCRIPT.match(
    /In-place deployment[\s\S]*?exec \.\/scripts\/start-dev\.sh --prod-web/,
  );
  assert.ok(inPlaceBlockMatch, 'in-place deployment exec block not found in runtime-worktree.sh');
  assert.match(
    inPlaceBlockMatch[0],
    /export CAT_CAFE_DIRECT_NO_WATCH="\$\{CAT_CAFE_DIRECT_NO_WATCH:-1\}"/,
    'in-place start path must export CAT_CAFE_DIRECT_NO_WATCH before exec start-dev.sh (ADR-039 Invariant 1)',
  );
});

test('ADR-039 Invariant 1b: worktree start path exports CAT_CAFE_DIRECT_NO_WATCH', () => {
  // Find the worktree mode exec block
  const worktreeBlockMatch = RUNTIME_SCRIPT.match(
    /starting production stack from runtime worktree[\s\S]*?exec \.\/scripts\/start-dev\.sh --prod-web/,
  );
  assert.ok(worktreeBlockMatch, 'worktree mode exec block not found in runtime-worktree.sh');
  assert.match(
    worktreeBlockMatch[0],
    /export CAT_CAFE_DIRECT_NO_WATCH="\$\{CAT_CAFE_DIRECT_NO_WATCH:-1\}"/,
    'worktree start path must export CAT_CAFE_DIRECT_NO_WATCH before exec start-dev.sh (ADR-039 Invariant 1)',
  );
});

test('ADR-039 Invariant 2a: no `sync)` dispatch case in runtime-worktree.sh', () => {
  // Match the case dispatch block (between `case "$COMMAND" in` and `esac` end-of-file)
  const dispatchMatch = RUNTIME_SCRIPT.match(/case "\$COMMAND" in[\s\S]*?esac/);
  assert.ok(dispatchMatch, 'COMMAND case dispatch not found');
  assert.doesNotMatch(
    dispatchMatch[0],
    /^\s*sync\)/m,
    '`sync)` dispatch case must be removed — sync is folded into start (ADR-039 Invariant 2)',
  );
});

test('ADR-039 Invariant 2b: no `runtime:sync` script in package.json', () => {
  assert.strictEqual(
    PACKAGE_JSON.scripts['runtime:sync'],
    undefined,
    '`runtime:sync` script must be removed from package.json — single entry via runtime:start (ADR-039 Invariant 2)',
  );
});

test('ADR-039 Invariant 2c: runtime:start script still exists', () => {
  assert.ok(PACKAGE_JSON.scripts['runtime:start'], 'runtime:start is the single entry; must exist');
});

test('ADR-039 Invariant 2d: sync_runtime_worktree function preserved (used internally by start)', () => {
  // The function is still needed; only the standalone subcommand is removed.
  assert.match(
    RUNTIME_SCRIPT,
    /^sync_runtime_worktree\(\)/m,
    'sync_runtime_worktree() must remain defined — start_runtime_worktree calls it internally',
  );
  assert.match(
    RUNTIME_SCRIPT,
    /sync_runtime_worktree\s*$/m,
    'sync_runtime_worktree must be called from start_runtime_worktree (verify call site exists)',
  );
});

test('ADR-039 Invariant 3a: build invariant runs in non-quick mode too (no runtime_quick_mode gate)', () => {
  // F228 stale-dist incident: ensure_quick_start_artifacts had a `runtime_quick_mode || return 0`
  // gate, so default `pnpm start` skipped builds → CAT_CAFE_DIRECT_NO_WATCH=1 dist mode crashed on
  // stale/missing dist. The gate must be removed so all start paths get freshness-checked.
  const ensureFunc = RUNTIME_SCRIPT.match(/ensure_runtime_dist_freshness\(\)\s*\{[\s\S]*?^\}/m);
  assert.ok(
    ensureFunc,
    'ensure_runtime_dist_freshness function (renamed from ensure_quick_start_artifacts) must exist',
  );
  assert.doesNotMatch(
    ensureFunc[0],
    /runtime_quick_mode\s*\|\|\s*return\s*0/,
    'build invariant must NOT short-circuit on non-quick mode — passive runtime always needs dist (ADR-039 Invariant 3)',
  );
});

test('ADR-039 Invariant 3b: api dist freshness checked + rebuilt when stale', () => {
  // The whole reason for ADR-039 — F228 stale api dist crashed runtime.
  assert.match(
    RUNTIME_SCRIPT,
    /needs_rebuild "\$RUNTIME_DIR\/packages\/api\/dist\/index\.js"/,
    'api dist freshness check must exist in build gate (ADR-039 Invariant 3 — F228 stale-dist root cause)',
  );
  assert.match(
    RUNTIME_SCRIPT,
    /pnpm -C "\$RUNTIME_DIR\/packages\/api" run build/,
    'api build must be triggered when dist is stale',
  );
});

test('ADR-039 Invariant 3c: shared dist still checked (api depends on it)', () => {
  // Order matters: shared first, then api/mcp (which depend on shared).
  assert.match(
    RUNTIME_SCRIPT,
    /needs_rebuild "\$RUNTIME_DIR\/packages\/shared\/dist\/index\.js"/,
    'shared dist freshness still required (api/mcp depend on it)',
  );
});

test('ADR-039 docs: ADR file exists', () => {
  // Lightweight provenance check
  const adrPath = join(REPO_ROOT, 'docs/decisions/039-runtime-passive-freeze.md');
  const adr = readFileSync(adrPath, 'utf-8');
  assert.match(adr, /Status: ratified/i, 'ADR-039 should be ratified');
  assert.match(adr, /CAT_CAFE_DIRECT_NO_WATCH/, 'ADR-039 should document the env var');
});
