import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  cleanup,
  commit,
  FIXED_TIMESTAMP,
  git,
  makeRepo,
  parseReportFromStdout,
  runCli,
  runCliDefault,
  setupBaselineRepos,
  writeFile,
} from './check-sync-public-delta-gate-cli-fixtures.mjs';

test('.sync-provenance.json passes as generated-or-provenance-pass (R6 砚砚 P1)', () => {
  // Plan AC matrix line 460: `.sync-provenance.json differs | PASS as provenance`.
  // Real sync writes fresh provenance JSON every run → 3-way blobs always diverge.
  const { target, source, filtered } = setupBaselineRepos('provenance-only-churn');
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-prov-'));
  try {
    const result = runCliDefault({ target, source, filtered, outputDir, extra: ['--head-ref', 'HEAD'] });
    assert.equal(result.status, 0, `provenance churn must PASS; got ${result.status}. stderr:\n${result.stderr}`);
    const report = parseReportFromStdout(result.stdout);
    const provItem = report.items.find((i) => i.path === '.sync-provenance.json');
    assert.ok(provItem, '.sync-provenance.json must appear in report');
    assert.equal(provItem.mode, 'generated-or-provenance-pass', `got ${provItem?.mode}`);
    assert.equal(report.summary.blockCount, 0, 'no BLOCK on provenance-only divergence');
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

test('binary files (by extension) are classified as binary-block (R4 cloud P2 #3481720165)', () => {
  // V1 INV-5: binary deltas must fail-closed via extension or NUL-byte sniff before
  // BLOB_STATE_RULES run.
  const target = makeRepo('cli-target-bin');
  const source = makeRepo('cli-source-bin');
  const filtered = mkdtempSync(join(tmpdir(), 'cli-filtered-bin-'));
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-bin-'));
  try {
    writeFile(target, 'packages/web/icon.png', 'PNG-v1');
    const baseSha = commit(target, 'baseline');
    git(target, ['tag', 'sync/2026-06-01-000000', baseSha]);
    git(target, ['update-ref', 'refs/sync/2026-06-01-000000', baseSha]);
    writeFile(source, 'packages/web/icon.png', 'PNG-v1');
    commit(source, 'source baseline');
    writeFile(filtered, 'packages/web/icon.png', 'PNG-v2');

    const result = runCliDefault({ target, source, filtered, outputDir, extra: ['--head-ref', 'HEAD'] });
    assert.equal(result.status, 1, `expected BLOCK on binary delta, got ${result.status}. stderr:\n${result.stderr}`);
    const report = parseReportFromStdout(result.stdout);
    const iconItem = report.items.find((i) => i.path === 'packages/web/icon.png');
    assert.ok(iconItem, 'icon.png must appear in report');
    assert.equal(iconItem.mode, 'binary-block', `got ${iconItem.mode}`);
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

test('report.targetHead is resolved to a commit SHA, not a ref name (R4 cloud P2 #3481720141)', () => {
  // AC-A3/A5/A6 reports must be immutable evidence — top-level targetHead must be a SHA
  // even when --head-ref HEAD is passed.
  const target = makeRepo('cli-target-sha');
  const source = makeRepo('cli-source-sha');
  const filtered = mkdtempSync(join(tmpdir(), 'cli-filtered-sha-'));
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-sha-'));
  try {
    writeFile(target, 'README.md', '# baseline\n');
    const baseSha = commit(target, 'baseline');
    git(target, ['tag', 'sync/2026-06-01-000000', baseSha]);
    git(target, ['update-ref', 'refs/sync/2026-06-01-000000', baseSha]);

    writeFile(source, 'README.md', '# baseline\n');
    commit(source, 'source baseline');
    writeFile(filtered, 'README.md', '# changed\n');

    const result = runCli([
      '--target-dir',
      target,
      '--filtered-dir',
      filtered,
      '--source-dir',
      source,
      '--sync-module',
      'full-outbound',
      '--no-fetch',
      '--head-ref',
      'HEAD',
      '--output-dir',
      outputDir,
      '--timestamp',
      FIXED_TIMESTAMP,
    ]);
    assert.equal(result.status, 0);
    const jsonLine = result.stdout.split('\n').find((l) => l.startsWith('json: '));
    const report = JSON.parse(readFileSync(jsonLine.slice('json: '.length), 'utf-8'));
    // targetHead must be a 40-char hex SHA, NOT a ref name like 'HEAD' or 'refs/remotes/origin/main'
    assert.match(report.targetHead, /^[0-9a-f]{40}$/, `targetHead must be SHA, got: ${report.targetHead}`);
    // baseline.targetHeadRef keeps the ref name for human diagnostics
    assert.ok(report.baseline.targetHeadRef, 'baseline.targetHeadRef must keep the ref name as diagnostic');
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

test('--target-owned-root with trailing slash matches files under the root (CLI regression)', () => {
  const target = makeRepo('cli-target-ts');
  const source = makeRepo('cli-source-ts');
  const filtered = mkdtempSync(join(tmpdir(), 'cli-filtered-ts-'));
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-ts-'));
  try {
    // Baseline: target has docs/community/foo.md
    writeFile(target, 'docs/community/foo.md', 'baseline\n');
    writeFile(target, 'README.md', '# baseline\n');
    const baseSha = commit(target, 'baseline');
    git(target, ['tag', 'sync/2026-06-01-000000', baseSha]);
    git(target, ['update-ref', 'refs/sync/2026-06-01-000000', baseSha]);

    // Target has a community fix on docs/community/foo.md
    writeFile(target, 'docs/community/foo.md', 'community fix\n');
    commit(target, 'community fix on target');

    // Filtered tree (raw export) has README.md but omits docs/community/foo.md
    // (because backup/restore handles it). Without normalize, this would be a
    // false delete-or-rename-block.
    writeFile(filtered, 'README.md', '# baseline\n');

    writeFile(source, 'README.md', '# baseline\n');
    commit(source, 'source baseline');

    // Pass target-owned-root WITH trailing slash (mimics sync-manifest yaml form).
    const result = runCli([
      '--target-dir',
      target,
      '--filtered-dir',
      filtered,
      '--source-dir',
      source,
      '--sync-module',
      'full-outbound',
      '--no-fetch',
      '--head-ref',
      'HEAD',
      '--target-owned-root',
      'docs/community/',
      '--output-dir',
      outputDir,
      '--timestamp',
      FIXED_TIMESTAMP,
    ]);
    assert.equal(
      result.status,
      0,
      `expected exit 0 (target-owned root with trailing slash should NOT block), got ${result.status}. stderr:\n${result.stderr}`,
    );
    const stdoutLines = result.stdout.split('\n');
    const jsonLine = stdoutLines.find((l) => l.startsWith('json: '));
    const jsonPath = jsonLine.slice('json: '.length);
    const report = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    assert.equal(report.summary.blockCount, 0, 'docs/community/foo.md must be target-owned-pass, not BLOCK');
    // Verify the path was classified as target-owned-pass
    const fooItem = report.items.find((i) => i.path === 'docs/community/foo.md');
    if (fooItem) {
      assert.equal(fooItem.mode, 'target-owned-pass', 'target-owned root must match trailing-slash form');
    }
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

test('target-revert scenario (clowder-ai#723 pattern) → gate BLOCKS', () => {
  const { target, source, filtered } = setupBaselineRepos('target-revert');
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-'));
  try {
    const result = runCli([
      '--target-dir',
      target,
      '--filtered-dir',
      filtered,
      '--source-dir',
      source,
      '--sync-module',
      'full-outbound',
      '--no-fetch',
      '--output-dir',
      outputDir,
      '--timestamp',
      FIXED_TIMESTAMP,
    ]);
    assert.equal(result.status, 1, `expected exit 1 (BLOCK), got ${result.status}. stderr:\n${result.stderr}`);
    assert.match(result.stderr, /gate BLOCK:/);
    // Verify report files exist
    const stdoutLines = result.stdout.split('\n');
    const jsonLine = stdoutLines.find((l) => l.startsWith('json: '));
    assert.ok(jsonLine, 'CLI must print json path');
    const jsonPath = jsonLine.slice('json: '.length);
    const report = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    assert.equal(report.summary.blockCount, 1, 'expected exactly 1 BLOCK (the reverted file)');
    assert.equal(report.summary.revertCandidateCount, 1, 'expected the BLOCK to be REVERT class');
    assert.equal(report.syncModule, 'full-outbound');
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

test('source-only-change scenario → gate PASSES (exit 0)', () => {
  const { target, source, filtered } = setupBaselineRepos('source-only-change');
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-'));
  try {
    const result = runCli([
      '--target-dir',
      target,
      '--filtered-dir',
      filtered,
      '--source-dir',
      source,
      '--sync-module',
      'full-outbound',
      '--no-fetch',
      '--output-dir',
      outputDir,
      '--timestamp',
      FIXED_TIMESTAMP,
    ]);
    assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr:\n${result.stderr}`);
    const stdoutLines = result.stdout.split('\n');
    const jsonLine = stdoutLines.find((l) => l.startsWith('json: '));
    const jsonPath = jsonLine.slice('json: '.length);
    const report = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    assert.equal(report.summary.blockCount, 0);
    assert.equal(report.summary.passCount, 1);
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

test('target-only-equivalent-preserved → gate PASSES (exit 0)', () => {
  const { target, source, filtered } = setupBaselineRepos('target-only-equivalent-preserved');
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-'));
  try {
    const result = runCli([
      '--target-dir',
      target,
      '--filtered-dir',
      filtered,
      '--source-dir',
      source,
      '--sync-module',
      'full-outbound',
      '--no-fetch',
      '--output-dir',
      outputDir,
      '--timestamp',
      FIXED_TIMESTAMP,
    ]);
    assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr:\n${result.stderr}`);
    const stdoutLines = result.stdout.split('\n');
    const jsonLine = stdoutLines.find((l) => l.startsWith('json: '));
    const jsonPath = jsonLine.slice('json: '.length);
    const report = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    assert.equal(report.summary.blockCount, 0);
    assert.equal(report.summary.passCount, 1);
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

test('--dry-run forces exit 0 even when BLOCK', () => {
  const { target, source, filtered } = setupBaselineRepos('target-revert');
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-'));
  try {
    const result = runCli([
      '--target-dir',
      target,
      '--filtered-dir',
      filtered,
      '--source-dir',
      source,
      '--sync-module',
      'full-outbound',
      '--no-fetch',
      '--output-dir',
      outputDir,
      '--timestamp',
      FIXED_TIMESTAMP,
      '--dry-run',
    ]);
    assert.equal(result.status, 0, `dry-run must exit 0 even on BLOCK; got ${result.status}`);
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

test('missing --target-dir → exit 2 (usage)', () => {
  const result = runCli(['--filtered-dir', '/tmp/x', '--source-dir', '/tmp/y', '--sync-module', 'm']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--target-dir/);
});

test('invalid baseline → exit 3 (baseline resolution failed)', () => {
  const { target, source, filtered } = setupBaselineRepos('source-only-change');
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-'));
  try {
    const result = runCli([
      '--target-dir',
      target,
      '--filtered-dir',
      filtered,
      '--source-dir',
      source,
      '--sync-module',
      'full-outbound',
      '--no-fetch',
      '--baseline',
      'bad-ref-does-not-exist',
      '--output-dir',
      outputDir,
      '--timestamp',
      FIXED_TIMESTAMP,
    ]);
    assert.equal(result.status, 3);
    assert.match(result.stderr, /baseline resolution failed/);
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});
