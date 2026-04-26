import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';

const SCRIPT = resolve(process.cwd(), 'scripts/generate-feature-index.mjs');

describe('generate-feature-index.mjs', () => {
  let sandboxRoot;

  afterEach(() => {
    rmSync(sandboxRoot, { recursive: true, force: true });
  });

  it('does not index verification records as feature lifecycle records', () => {
    sandboxRoot = mkdtempSync(join(tmpdir(), 'cc-feature-index-'));
    const featuresDir = join(sandboxRoot, 'docs', 'features');
    const outputPath = join(sandboxRoot, 'index.json');
    mkdirSync(featuresDir, { recursive: true });

    writeFileSync(
      join(featuresDir, 'F061-main.md'),
      [
        '---',
        'feature_ids: [F061]',
        'doc_kind: spec',
        '---',
        '',
        '# F061: Main Feature',
        '',
        '> **Status**: done | **Owner**: 三猫',
        '',
      ].join('\n'),
      'utf-8',
    );

    writeFileSync(
      join(featuresDir, 'F061-verification-2026-04-21.md'),
      [
        '---',
        'feature_ids: [F061]',
        'doc_type: verification',
        'status: partial',
        '---',
        '',
        '# F061 Real-World Verification',
        '',
      ].join('\n'),
      'utf-8',
    );

    execFileSync('node', [SCRIPT, '--features-dir', featuresDir, '--output', outputPath], {
      encoding: 'utf-8',
    });

    const index = JSON.parse(readFileSync(outputPath, 'utf-8'));
    assert.deepEqual(index.features, [
      {
        id: 'F061',
        name: 'Main Feature',
        status: 'done | **Owner**: 三猫',
        file: 'F061-main.md',
      },
    ]);
  });
});
