import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(process.cwd(), 'scripts/check-feature-truth.mjs');

function createRepoFixture({
  currentFeatures,
  generatedFeatures,
  backlogRows,
}) {
  const root = mkdtempSync(join(tmpdir(), 'cc-feature-truth-'));
  mkdirSync(join(root, 'docs', 'features'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });

  writeFileSync(
    join(root, 'docs', 'BACKLOG.md'),
    [
      '---',
      'doc_kind: note',
      '---',
      '',
      '# Backlog',
      '',
      '| ID | Name | Status | Owner | Link |',
      '|----|------|--------|-------|------|',
      ...backlogRows,
      '',
    ].join('\n'),
    'utf-8',
  );

  writeFileSync(
    join(root, 'docs', 'features', 'index.json'),
    `${JSON.stringify({ features: currentFeatures, generated_at: 'old' }, null, 2)}\n`,
    'utf-8',
  );

  const generatorScript = [
    '#!/usr/bin/env node',
    "import { writeFileSync } from 'node:fs';",
    "const outIndex = process.argv.indexOf('--output');",
    "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
    `const features = ${JSON.stringify(generatedFeatures, null, 2)};`,
    "writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\\n`, 'utf-8');",
  ].join('\n');

  writeFileSync(join(root, 'scripts', 'generate-feature-index.mjs'), generatorScript, 'utf-8');
  return root;
}

function runCheck(repoRoot) {
  return execFileSync('node', [SCRIPT, repoRoot], { encoding: 'utf-8' });
}

describe('check-feature-truth.mjs', () => {
  let sandboxRoot;

  afterEach(() => {
    rmSync(sandboxRoot, { recursive: true, force: true });
  });

  it('passes when index and backlog are consistent', () => {
    sandboxRoot = createRepoFixture({
      currentFeatures: [
        { id: 'F050', status: 'in-progress' },
        { id: 'F001', status: 'done' },
      ],
      generatedFeatures: [
        { id: 'F050', status: 'in-progress' },
        { id: 'F001', status: 'done' },
      ],
      backlogRows: ['| F050 | External | in-progress | 三猫 | [F050](features/F050.md) |'],
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('fails when index.json is stale', () => {
    sandboxRoot = createRepoFixture({
      currentFeatures: [{ id: 'F050', status: 'spec' }],
      generatedFeatures: [{ id: 'F050', status: 'in-progress' }],
      backlogRows: ['| F050 | External | in-progress | 三猫 | [F050](features/F050.md) |'],
    });

    assert.throws(
      () => runCheck(sandboxRoot),
      /index-sync|stale|check-feature-truth/i,
    );
  });

  it('fails when active feature is missing from BACKLOG', () => {
    sandboxRoot = createRepoFixture({
      currentFeatures: [{ id: 'F050', status: 'in-progress' }],
      generatedFeatures: [{ id: 'F050', status: 'in-progress' }],
      backlogRows: [],
    });

    assert.throws(
      () => runCheck(sandboxRoot),
      /backlog-missing|check-feature-truth/i,
    );
  });

  it('fails when BACKLOG still references done-only feature', () => {
    sandboxRoot = createRepoFixture({
      currentFeatures: [{ id: 'F001', status: 'done' }],
      generatedFeatures: [{ id: 'F001', status: 'done' }],
      backlogRows: ['| F001 | Legacy | in-progress | 三猫 | [F001](features/F001.md) |'],
    });

    assert.throws(
      () => runCheck(sandboxRoot),
      /backlog-active|done|check-feature-truth/i,
    );
  });
});
