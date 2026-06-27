// F251 Task 4c — AC-A4 override-with-reason flag tests.
//
// Asserts CLI semantics for:
//   --override <path>:<reason>       (repeatable, non-empty reason)
//   --cvo-approved-public-delta-overwrite  (boolean alarm suppression)
//
// 5 scenarios:
//   1. single override + reason → exit 0, mode=override-pass
//   2. empty reason → exit 2 (usage)
//   3. override count ≤ 3 → no cvoApprovalRequired alarm
//   4. override count > 3 without --cvo-approved → exit 1 (cvoApprovalRequired blocks)
//   5. override count > 3 with    --cvo-approved → exit 0 (alarm recorded, gate passes)

import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  cleanup,
  commit,
  git,
  makeRepo,
  parseReportFromStdout,
  runCliDefault,
  setupBaselineRepos,
  writeFile,
} from './check-sync-public-delta-gate-cli-fixtures.mjs';

test('AC-A4 single --override <path>:<reason> for BLOCK path → exit 0 + mode=override-pass', () => {
  const { target, source, filtered } = setupBaselineRepos('target-revert');
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-ovr-'));
  try {
    // target-revert scenario: packages/api/example.ts has target-only-would-revert-block
    const result = runCliDefault({
      target,
      source,
      filtered,
      outputDir,
      extra: [
        '--head-ref',
        'HEAD',
        '--override',
        'packages/api/example.ts:absorbed in cat-cafe#1234 maintainer quickfix',
      ],
    });
    assert.equal(result.status, 0, `expected exit 0 with override; got ${result.status}. stderr:\n${result.stderr}`);
    const report = parseReportFromStdout(result.stdout);
    const item = report.items.find((i) => i.path === 'packages/api/example.ts');
    assert.ok(item, 'overridden path must appear in report');
    assert.equal(item.mode, 'override-pass', `expected override-pass, got ${item.mode}`);
    assert.match(item.overrideReason, /absorbed in cat-cafe#1234/);
    assert.equal(report.summary.overrideCount, 1);
    assert.equal(report.summary.blockCount, 0);
    assert.equal(report.summary.cvoApprovalRequired, false);
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

test('AC-A4 --override with empty reason → exit 2 (usage)', () => {
  const { target, source, filtered } = setupBaselineRepos('target-revert');
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-ovr-'));
  try {
    const result = runCliDefault({
      target,
      source,
      filtered,
      outputDir,
      extra: ['--head-ref', 'HEAD', '--override', 'packages/api/example.ts:'],
    });
    assert.equal(result.status, 2, `expected exit 2 on empty reason; got ${result.status}`);
    assert.match(result.stderr, /reason must be non-empty/);
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

// Stage a target with N BLOCK paths so we can exercise override counts.
function stageMultiBlockScenario(blockCount) {
  const target = makeRepo('cli-target-multi');
  const source = makeRepo('cli-source-multi');
  const filtered = mkdtempSync(join(tmpdir(), 'cli-filtered-multi-'));

  // Baseline: target has N files at v1
  for (let i = 0; i < blockCount; i += 1) {
    writeFile(target, `pkg/file${i}.ts`, `// v1 ${i}\n`);
  }
  const baseSha = commit(target, 'baseline');
  git(target, ['tag', 'sync/2026-06-01-000000', baseSha]);
  git(target, ['update-ref', 'refs/sync/2026-06-01-000000', baseSha]);

  // Target moves: each file gets a community fix (target-only delta)
  for (let i = 0; i < blockCount; i += 1) {
    writeFile(target, `pkg/file${i}.ts`, `// v2 community ${i}\n`);
  }
  commit(target, 'community fix on N paths');

  // Filtered (export): reverts every path back to v1 → revert pattern on each
  for (let i = 0; i < blockCount; i += 1) {
    writeFile(filtered, `pkg/file${i}.ts`, `// v1 ${i}\n`);
  }

  // Source mirror
  writeFile(source, 'README.md', 'src\n');
  commit(source, 'source baseline');

  return { target, source, filtered };
}

test('AC-A4 override count ≤ 3 → no cvoApprovalRequired alarm', () => {
  const { target, source, filtered } = stageMultiBlockScenario(3);
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-3-'));
  try {
    const result = runCliDefault({
      target,
      source,
      filtered,
      outputDir,
      extra: [
        '--head-ref',
        'HEAD',
        '--override',
        'pkg/file0.ts:reason0',
        '--override',
        'pkg/file1.ts:reason1',
        '--override',
        'pkg/file2.ts:reason2',
      ],
    });
    assert.equal(
      result.status,
      0,
      `3 overrides should not trip CVO alarm; got ${result.status}. stderr:\n${result.stderr}`,
    );
    const report = parseReportFromStdout(result.stdout);
    assert.equal(report.summary.overrideCount, 3);
    assert.equal(report.summary.cvoApprovalRequired, false);
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

test('AC-A4 override count > 3 WITHOUT --cvo-approved → exit 1 (alarm blocks)', () => {
  const { target, source, filtered } = stageMultiBlockScenario(4);
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-4-noCvo-'));
  try {
    const result = runCliDefault({
      target,
      source,
      filtered,
      outputDir,
      extra: [
        '--head-ref',
        'HEAD',
        '--override',
        'pkg/file0.ts:reason0',
        '--override',
        'pkg/file1.ts:reason1',
        '--override',
        'pkg/file2.ts:reason2',
        '--override',
        'pkg/file3.ts:reason3',
      ],
    });
    assert.equal(
      result.status,
      1,
      `>3 overrides without CVO must BLOCK; got ${result.status}. stdout:\n${result.stdout}`,
    );
    const report = parseReportFromStdout(result.stdout);
    assert.equal(report.summary.overrideCount, 4);
    assert.equal(report.summary.cvoApprovalRequired, true, 'cvoApprovalRequired must be true');
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});

test('AC-A4 override count > 3 WITH --cvo-approved-public-delta-overwrite → exit 0 (alarm recorded, gate passes)', () => {
  const { target, source, filtered } = stageMultiBlockScenario(4);
  const outputDir = mkdtempSync(join(tmpdir(), 'cli-out-4-cvo-'));
  try {
    const result = runCliDefault({
      target,
      source,
      filtered,
      outputDir,
      extra: [
        '--head-ref',
        'HEAD',
        '--override',
        'pkg/file0.ts:reason0',
        '--override',
        'pkg/file1.ts:reason1',
        '--override',
        'pkg/file2.ts:reason2',
        '--override',
        'pkg/file3.ts:reason3',
        '--cvo-approved-public-delta-overwrite',
      ],
    });
    assert.equal(result.status, 0, `>3 overrides with CVO must PASS; got ${result.status}. stderr:\n${result.stderr}`);
    const report = parseReportFromStdout(result.stdout);
    assert.equal(report.summary.overrideCount, 4);
    // Report STILL records cvoApprovalRequired=true (audit trail), CLI just suppresses the exit.
    assert.equal(report.summary.cvoApprovalRequired, true, 'cvoApprovalRequired stays true in report for audit');
    assert.match(result.stdout, /cvoApproved=true/);
  } finally {
    cleanup(target, source, filtered, outputDir);
  }
});
