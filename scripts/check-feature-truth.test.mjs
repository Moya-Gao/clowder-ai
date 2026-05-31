import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';

const SCRIPT = resolve(process.cwd(), 'scripts/check-feature-truth.mjs');

// docs/features/index.json is a derived artifact with NO live consumer: the
// runtime builds its feature index from the docs directly, sync regenerates it
// fresh, and this check used to read it only to diff it against its own
// regeneration. It is no longer committed, so the check must derive everything
// from a fresh regeneration. `committedFeatures` is therefore set ONLY by the
// test that proves a stray local index.json is ignored rather than treated as
// truth.
function createRepoFixture({ generatedFeatures, backlogRows, committedFeatures }) {
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

  // The repo no longer commits docs/features/index.json. Only write it when a
  // test explicitly wants to prove the check ignores a stray/stale local copy.
  if (committedFeatures !== undefined) {
    writeFileSync(
      join(root, 'docs', 'features', 'index.json'),
      `${JSON.stringify({ features: committedFeatures, generated_at: 'old' }, null, 2)}\n`,
      'utf-8',
    );
  }

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

  it('passes with no committed index.json (derives from fresh regeneration)', () => {
    sandboxRoot = createRepoFixture({
      generatedFeatures: [
        { id: 'F050', status: 'in-progress' },
        { id: 'F001', status: 'done' },
      ],
      backlogRows: ['| F050 | External | in-progress | 三猫 | [F050](features/F050.md) |'],
      // committedFeatures omitted on purpose — the file no longer exists in the repo.
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('ignores a stray/divergent committed index.json (no longer self-checked)', () => {
    sandboxRoot = createRepoFixture({
      generatedFeatures: [{ id: 'F050', status: 'in-progress' }],
      backlogRows: ['| F050 | External | in-progress | 三猫 | [F050](features/F050.md) |'],
      // A divergent local copy must be ignored, NOT reported as a stale failure.
      committedFeatures: [{ id: 'F050', status: 'spec' }],
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('fails when active feature is missing from BACKLOG', () => {
    sandboxRoot = createRepoFixture({
      generatedFeatures: [{ id: 'F050', status: 'in-progress' }],
      backlogRows: [],
    });

    assert.throws(() => runCheck(sandboxRoot), /backlog-missing/i);
  });

  it('fails when BACKLOG still references done-only feature', () => {
    sandboxRoot = createRepoFixture({
      generatedFeatures: [{ id: 'F001', status: 'done' }],
      backlogRows: ['| F001 | Legacy | in-progress | 三猫 | [F001](features/F001.md) |'],
    });

    assert.throws(() => runCheck(sandboxRoot), /backlog-active/i);
  });
});
