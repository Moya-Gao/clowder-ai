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
function createRepoFixture({ generatedFeatures, backlogRows, committedFeatures, featureDocs }) {
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

  // Feature doc markdown fixtures. Canonical docs ALSO get an index entry (with
  // `file`) so the generator stub mirrors generate-feature-index, which EXCLUDES
  // verification docs (doc_kind/doc_type: verification → not in index). A doc
  // marked { verification: true } is written to disk but kept OUT of the index,
  // proving the drift scan only walks canonical specs the index vouches for.
  const docIndexEntries = [];
  for (const doc of featureDocs ?? []) {
    const lines = [
      '---',
      `feature_ids: [${doc.id}]`,
      `doc_kind: ${doc.verification ? 'verification' : 'spec'}`,
      '---',
      '',
      `# ${doc.id}: Fixture Feature`,
      '',
      doc.statusLine,
      '',
    ];
    if (doc.timeline) {
      lines.push('## Timeline', '', doc.timeline, '');
    }
    writeFileSync(join(root, 'docs', 'features', `${doc.id}-fixture.md`), `${lines.join('\n')}\n`, 'utf-8');
    if (!doc.verification) {
      // index status defaults to 'done' so the entry exists (carrying `file`)
      // WITHOUT tripping the backlog-active/missing checks; doc-status-drift reads
      // the markdown Status line, not this placeholder.
      docIndexEntries.push({ id: doc.id, status: doc.indexStatus ?? 'done', file: `${doc.id}-fixture.md` });
    }
  }

  const indexFeatures = [...(generatedFeatures ?? []), ...docIndexEntries];
  const generatorScript = [
    '#!/usr/bin/env node',
    "import { writeFileSync } from 'node:fs';",
    "const outIndex = process.argv.indexOf('--output');",
    "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
    `const features = ${JSON.stringify(indexFeatures, null, 2)};`,
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

describe('check-feature-truth.mjs — doc-status-drift (Status vs ## Timeline)', () => {
  let sandboxRoot;

  afterEach(() => {
    rmSync(sandboxRoot, { recursive: true, force: true });
  });

  it('fails when pre-development Status (spec) coexists with a merged PR in Timeline', () => {
    sandboxRoot = createRepoFixture({
      generatedFeatures: [],
      backlogRows: [],
      featureDocs: [
        {
          id: 'F900',
          statusLine: '> **Status**: spec | **Owner**: 测试猫',
          timeline: '| 2026-06-01 | Phase A merged (PR #1234) |',
        },
      ],
    });

    assert.throws(() => runCheck(sandboxRoot), /doc-status-drift/i);
  });

  it('passes when Status is in-progress with merged PRs (legitimate multi-phase)', () => {
    // 25 real feature docs sit at in-progress with already-merged Phases — this is
    // the normal multi-phase state, NOT drift. The check must never flag it.
    sandboxRoot = createRepoFixture({
      generatedFeatures: [],
      backlogRows: [],
      featureDocs: [
        {
          id: 'F901',
          statusLine: '> **Status**: in-progress（Phase A merged）| **Owner**: 测试猫',
          timeline: '| 2026-06-01 | Phase A merged (PR #1234) |',
        },
      ],
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('passes when a pre-development Status carries a reopen marker (reopened feature)', () => {
    // F156 pattern: Phase A~D done & merged, reopened for a new Phase still at spec.
    // The reopen marker on the Status line is a mechanical exemption (grep, not semantics).
    sandboxRoot = createRepoFixture({
      generatedFeatures: [],
      backlogRows: [],
      featureDocs: [
        {
          id: 'F902',
          statusLine: '> **Status**: spec (Phase E planned) | **Reopened**: 2026-04-16',
          timeline: '| 2026-04-10 | Phase A merged (PR #1041) |',
        },
      ],
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('passes when a pre-development Status has no merged PR in its Timeline', () => {
    sandboxRoot = createRepoFixture({
      generatedFeatures: [],
      backlogRows: [],
      featureDocs: [
        {
          id: 'F903',
          statusLine: '> **Status**: spec | **Owner**: 测试猫',
          timeline: '| 2026-06-01 | 立项（铲屎官 signoff）|',
        },
      ],
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('does NOT flag when "merged" and "#NNN" sit on DIFFERENT Timeline rows (no merged PR)', () => {
    // peer-review repro (P1): an issue ref on one row + a PR-less "merged" on
    // another must not be read as a merged PR. Requires row-level matching.
    sandboxRoot = createRepoFixture({
      generatedFeatures: [],
      backlogRows: [],
      featureDocs: [
        {
          id: 'F904',
          statusLine: '> **Status**: spec | **Owner**: 测试猫',
          timeline: ['| 2026-06-01 | issue #123 opened |', '| 2026-06-02 | Phase A merged |'].join('\n'),
        },
      ],
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('does NOT scan verification docs (excluded from the generated index)', () => {
    // peer-review repro (P2): generate-feature-index excludes doc_kind: verification.
    // The drift scan must mirror that — a verification report with spec + merged
    // Timeline is not a canonical spec and must never block merge-gate.
    sandboxRoot = createRepoFixture({
      generatedFeatures: [],
      backlogRows: [],
      featureDocs: [
        {
          id: 'F905',
          verification: true,
          statusLine: '> **Status**: spec | **Owner**: 测试猫',
          timeline: '| 2026-06-01 | Phase A merged (PR #1234) |',
        },
      ],
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('flags design status (pre-development) with a merged PR', () => {
    // cloud-review P2: `design` is a real pre-dev status (F249) — a design-status
    // feature that records a merged PR in Timeline must hard-block, not slip through.
    sandboxRoot = createRepoFixture({
      generatedFeatures: [],
      backlogRows: [],
      featureDocs: [
        {
          id: 'F906',
          statusLine: '> **Status**: design | **Owner**: 测试猫',
          timeline: '| 2026-06-01 | Phase A merged (PR #1234) |',
        },
      ],
    });

    assert.throws(() => runCheck(sandboxRoot), /doc-status-drift/i);
  });

  it('does NOT flag a negated/unmerged PR row (honest open-PR tracking)', () => {
    // cloud-review P2: "PR #123 opened, not yet merged" carries both "merged" and
    // "#123" but no code landed — a spec honestly tracking an OPEN PR must not be
    // read as drift. Requires excluding negated "merged".
    sandboxRoot = createRepoFixture({
      generatedFeatures: [],
      backlogRows: [],
      featureDocs: [
        {
          id: 'F907',
          statusLine: '> **Status**: spec | **Owner**: 测试猫',
          timeline: '| 2026-06-01 | PR #123 opened, not yet merged |',
        },
      ],
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });
});
