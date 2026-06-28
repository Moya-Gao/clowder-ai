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
      `doc_kind: ${doc.docKind ?? (doc.verification ? 'verification' : 'spec')}`,
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

// --- User Journey readiness (F252 gate) ---
// These tests use git repo fixtures to exercise getChangedFeatureDocs + the
// ## User Journey / user_journey_exempt check end-to-end.

function createGitRepoFixture({ featureDocContent, featureDocId = 'F999' }) {
  const root = mkdtempSync(join(tmpdir(), 'cc-journey-'));
  mkdirSync(join(root, 'docs', 'features'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });

  // BACKLOG includes F999 so backlog-missing doesn't fire on active features.
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
      `| ${featureDocId} | Test | in-progress | 测试猫 | link |`,
      '',
    ].join('\n'),
    'utf-8',
  );

  // Stub generator — index status 'in-progress' + file ref so both backlog and
  // User Journey checks can find the feature. The journey check reads the actual
  // markdown Status, not the index status.
  const generatorScript = [
    '#!/usr/bin/env node',
    "import { writeFileSync } from 'node:fs';",
    "const outIndex = process.argv.indexOf('--output');",
    "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
    `const features = [{ id: '${featureDocId}', status: 'in-progress', file: '${featureDocId}-fixture.md' }];`,
    "writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\\n`, 'utf-8');",
  ].join('\n');
  writeFileSync(join(root, 'scripts', 'generate-feature-index.mjs'), generatorScript, 'utf-8');

  // Initialize git repo with 'main' branch + initial commit.
  // Then create a bare clone as 'origin' so `origin/main...HEAD` works.
  execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: root, stdio: 'pipe' });

  // Create a bare clone to serve as origin, then add it as a remote
  const bareRoot = mkdtempSync(join(tmpdir(), 'cc-journey-bare-'));
  execFileSync('git', ['clone', '--bare', root, bareRoot], { stdio: 'pipe' });
  execFileSync('git', ['remote', 'add', 'origin', bareRoot], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['fetch', 'origin'], { cwd: root, stdio: 'pipe' });

  // Create a feature branch with the changed feature doc
  execFileSync('git', ['checkout', '-b', 'feat/test-journey'], { cwd: root, stdio: 'pipe' });
  writeFileSync(join(root, 'docs', 'features', `${featureDocId}-fixture.md`), featureDocContent, 'utf-8');
  execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'add feature doc'], { cwd: root, stdio: 'pipe' });

  return root;
}

describe('check-feature-truth.mjs — User Journey readiness (F252 gate)', () => {
  let sandboxRoot;

  afterEach(() => {
    rmSync(sandboxRoot, { recursive: true, force: true });
  });

  it('fails when an active changed feature doc lacks ## User Journey and user_journey_exempt', () => {
    sandboxRoot = createGitRepoFixture({
      featureDocContent: [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Test Feature',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'Some feature without a user journey.',
        '',
      ].join('\n'),
    });

    assert.throws(() => runCheck(sandboxRoot), /user-journey-missing/i);
  });

  it('passes when changed feature doc has ## User Journey section', () => {
    sandboxRoot = createGitRepoFixture({
      featureDocContent: [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Test Feature',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'Some feature.',
        '',
        '## User Journey',
        '',
        '### Primary Journey: 用户打开页面',
        '- **Scope unit**: thread',
        '',
      ].join('\n'),
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('passes when changed feature doc has user_journey_exempt marker', () => {
    sandboxRoot = createGitRepoFixture({
      featureDocContent: [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Internal Refactor',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'user_journey_exempt: pure refactor with no user-perceivable changes',
        '',
      ].join('\n'),
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('skips done/closed features (they predate this gate)', () => {
    // Use a separate ID so the fixture generator can return done status
    // (F999 BACKLOG entry says 'in-progress', which would conflict).
    const root = mkdtempSync(join(tmpdir(), 'cc-journey-done-'));
    sandboxRoot = root;
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
        '',
      ].join('\n'),
      'utf-8',
    );

    const generatorScript = [
      '#!/usr/bin/env node',
      "import { writeFileSync } from 'node:fs';",
      "const outIndex = process.argv.indexOf('--output');",
      "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
      "const features = [{ id: 'F998', status: 'done', file: 'F998-fixture.md' }];",
      "writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\\n`, 'utf-8');",
    ].join('\n');
    writeFileSync(join(root, 'scripts', 'generate-feature-index.mjs'), generatorScript, 'utf-8');

    execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: root, stdio: 'pipe' });

    const bareRoot = mkdtempSync(join(tmpdir(), 'cc-journey-done-bare-'));
    execFileSync('git', ['clone', '--bare', root, bareRoot], { stdio: 'pipe' });
    execFileSync('git', ['remote', 'add', 'origin', bareRoot], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['fetch', 'origin'], { cwd: root, stdio: 'pipe' });

    execFileSync('git', ['checkout', '-b', 'feat/test-done'], { cwd: root, stdio: 'pipe' });
    writeFileSync(
      join(root, 'docs', 'features', 'F998-fixture.md'),
      [
        '---',
        'feature_ids: [F998]',
        'doc_kind: spec',
        '---',
        '',
        '# F998: Done Feature',
        '',
        '> **Status**: done | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'Already completed, no journey needed.',
        '',
      ].join('\n'),
      'utf-8',
    );
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'add done feature doc'], { cwd: root, stdio: 'pipe' });

    const output = runCheck(root);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('fails when branch name references a feature but only code changed (F252 failure mode)', () => {
    // This is the exact F252 scenario: branch feat/F999-story-player changes code
    // but never touches docs/features/F999-fixture.md. The gate must still check
    // the feature doc because the branch name references F999.
    const root = mkdtempSync(join(tmpdir(), 'cc-journey-branch-'));
    sandboxRoot = root;
    mkdirSync(join(root, 'docs', 'features'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });

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
        '| F999 | Test | in-progress | 测试猫 | link |',
        '',
      ].join('\n'),
      'utf-8',
    );

    // Feature doc exists on main WITHOUT User Journey
    writeFileSync(
      join(root, 'docs', 'features', 'F999-story-player.md'),
      [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Story Player',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'A feature without user journey.',
        '',
      ].join('\n'),
      'utf-8',
    );

    const generatorScript = [
      '#!/usr/bin/env node',
      "import { writeFileSync } from 'node:fs';",
      "const outIndex = process.argv.indexOf('--output');",
      "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
      "const features = [{ id: 'F999', status: 'in-progress', file: 'F999-story-player.md' }];",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: generator stub embeds template literal
      "writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\\n`, 'utf-8');",
    ].join('\n');
    writeFileSync(join(root, 'scripts', 'generate-feature-index.mjs'), generatorScript, 'utf-8');

    execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial with feature doc on main'], { cwd: root, stdio: 'pipe' });

    const bareRoot = mkdtempSync(join(tmpdir(), 'cc-journey-branch-bare-'));
    execFileSync('git', ['clone', '--bare', root, bareRoot], { stdio: 'pipe' });
    execFileSync('git', ['remote', 'add', 'origin', bareRoot], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['fetch', 'origin'], { cwd: root, stdio: 'pipe' });

    // Feature branch only changes code, NOT the feature doc
    execFileSync('git', ['checkout', '-b', 'feat/F999-story-player'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'src', 'app.js'), 'console.log("code change only");\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'code only, no doc change'], { cwd: root, stdio: 'pipe' });

    assert.throws(() => runCheck(root), /user-journey-missing/i);
  });

  it('fails when branch name lacks F-number but commit message references the feature (R3 commit-msg discovery)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-journey-commit-'));
    sandboxRoot = root;

    mkdirSync(join(root, 'docs', 'features'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });

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
        '| F999 | Test | in-progress | 测试猫 | link |',
        '',
      ].join('\n'),
      'utf-8',
    );

    // Feature doc exists on main WITHOUT User Journey
    writeFileSync(
      join(root, 'docs', 'features', 'F999-story-player.md'),
      [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Story Player',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'A feature without user journey.',
        '',
      ].join('\n'),
      'utf-8',
    );

    const generatorScript = [
      '#!/usr/bin/env node',
      "import { writeFileSync } from 'node:fs';",
      "const outIndex = process.argv.indexOf('--output');",
      "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
      "const features = [{ id: 'F999', status: 'in-progress', file: 'F999-story-player.md' }];",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: generator stub embeds template literal
      "writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\\n`, 'utf-8');",
    ].join('\n');
    writeFileSync(join(root, 'scripts', 'generate-feature-index.mjs'), generatorScript, 'utf-8');

    execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial with feature doc on main'], { cwd: root, stdio: 'pipe' });

    const bareRoot = mkdtempSync(join(tmpdir(), 'cc-journey-commit-bare-'));
    execFileSync('git', ['clone', '--bare', root, bareRoot], { stdio: 'pipe' });
    execFileSync('git', ['remote', 'add', 'origin', bareRoot], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['fetch', 'origin'], { cwd: root, stdio: 'pipe' });

    // Branch name has NO F-number, but commit message references F999
    execFileSync('git', ['checkout', '-b', 'feat/story-player'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'src', 'player.js'), 'console.log("player code");\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'fix(F999): update story player logic'], { cwd: root, stdio: 'pipe' });

    assert.throws(() => runCheck(root), /user-journey-missing/i);
  });

  it('skips emoji-prefixed done status like "✅ closed" (P2 regression)', () => {
    sandboxRoot = createGitRepoFixture({
      featureDocContent: [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Emoji Done Feature',
        '',
        '> **Status**: ✅ closed | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'Closed feature with emoji prefix, no journey needed.',
        '',
      ].join('\n'),
    });

    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('fails when feat/* branch has no discoverable F-number anywhere (structural gate)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-journey-nofnum-'));
    sandboxRoot = root;

    mkdirSync(join(root, 'docs', 'features'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });

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
        '| F999 | Test | in-progress | 测试猫 | link |',
        '',
      ].join('\n'),
      'utf-8',
    );

    writeFileSync(
      join(root, 'docs', 'features', 'F999-story-player.md'),
      [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Story Player',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'A feature without user journey.',
        '',
      ].join('\n'),
      'utf-8',
    );

    const generatorScript = [
      '#!/usr/bin/env node',
      "import { writeFileSync } from 'node:fs';",
      "const outIndex = process.argv.indexOf('--output');",
      "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
      "const features = [{ id: 'F999', status: 'in-progress', file: 'F999-story-player.md' }];",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: generator stub embeds template literal
      "writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\\n`, 'utf-8');",
    ].join('\n');
    writeFileSync(join(root, 'scripts', 'generate-feature-index.mjs'), generatorScript, 'utf-8');

    execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial with feature doc on main'], { cwd: root, stdio: 'pipe' });

    const bareRoot = mkdtempSync(join(tmpdir(), 'cc-journey-nofnum-bare-'));
    execFileSync('git', ['clone', '--bare', root, bareRoot], { stdio: 'pipe' });
    execFileSync('git', ['remote', 'add', 'origin', bareRoot], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['fetch', 'origin'], { cwd: root, stdio: 'pipe' });

    // Branch name has NO F-number, commit has NO F-number — exactly the
    // reviewer's reproduced bypass scenario.
    execFileSync('git', ['checkout', '-b', 'feat/story-player'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'src', 'player.js'), 'console.log("code change");\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'update story player logic'], { cwd: root, stdio: 'pipe' });

    assert.throws(() => runCheck(root), /user-journey-undiscoverable/i);
  });

  it('passes when non-feat branch has no discoverable feature docs (fix/chore exempt)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-journey-nonfeat-'));
    sandboxRoot = root;

    mkdirSync(join(root, 'docs', 'features'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });

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
        '| F999 | Test | in-progress | 测试猫 | link |',
        '',
      ].join('\n'),
      'utf-8',
    );

    writeFileSync(
      join(root, 'docs', 'features', 'F999-story-player.md'),
      [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Story Player',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'A feature without user journey.',
        '',
      ].join('\n'),
      'utf-8',
    );

    const generatorScript = [
      '#!/usr/bin/env node',
      "import { writeFileSync } from 'node:fs';",
      "const outIndex = process.argv.indexOf('--output');",
      "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
      "const features = [{ id: 'F999', status: 'in-progress', file: 'F999-story-player.md' }];",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: generator stub embeds template literal
      "writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\\n`, 'utf-8');",
    ].join('\n');
    writeFileSync(join(root, 'scripts', 'generate-feature-index.mjs'), generatorScript, 'utf-8');

    execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: root, stdio: 'pipe' });

    const bareRoot = mkdtempSync(join(tmpdir(), 'cc-journey-nonfeat-bare-'));
    execFileSync('git', ['clone', '--bare', root, bareRoot], { stdio: 'pipe' });
    execFileSync('git', ['remote', 'add', 'origin', bareRoot], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['fetch', 'origin'], { cwd: root, stdio: 'pipe' });

    // fix/ branch — not a feature branch, should not trigger structural gate
    execFileSync('git', ['checkout', '-b', 'fix/cleanup-typos'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'src', 'util.js'), 'console.log("fix");\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'fix typos'], { cwd: root, stdio: 'pipe' });

    const output = runCheck(root);
    assert.match(output, /PASS check-feature-truth/i);
  });

  it('fails in detached HEAD mode when feat/* branch has no F-number (R4 review worktree bypass)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-journey-detached-'));
    sandboxRoot = root;

    mkdirSync(join(root, 'docs', 'features'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });

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
        '| F999 | Test | in-progress | 测试猫 | link |',
        '',
      ].join('\n'),
      'utf-8',
    );

    writeFileSync(
      join(root, 'docs', 'features', 'F999-story-player.md'),
      [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Story Player',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'A feature without user journey.',
        '',
      ].join('\n'),
      'utf-8',
    );

    const generatorScript = [
      '#!/usr/bin/env node',
      "import { writeFileSync } from 'node:fs';",
      "const outIndex = process.argv.indexOf('--output');",
      "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
      "const features = [{ id: 'F999', status: 'in-progress', file: 'F999-story-player.md' }];",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: generator stub embeds template literal
      "writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\\n`, 'utf-8');",
    ].join('\n');
    writeFileSync(join(root, 'scripts', 'generate-feature-index.mjs'), generatorScript, 'utf-8');

    execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: root, stdio: 'pipe' });

    const bareRoot = mkdtempSync(join(tmpdir(), 'cc-journey-detached-bare-'));
    execFileSync('git', ['clone', '--bare', root, bareRoot], { stdio: 'pipe' });
    execFileSync('git', ['remote', 'add', 'origin', bareRoot], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['fetch', 'origin'], { cwd: root, stdio: 'pipe' });

    // Create feat branch with no F-number, then detach HEAD at the same commit
    execFileSync('git', ['checkout', '-b', 'feat/story-player'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'src', 'player.js'), 'console.log("code change");\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'update story player logic'], { cwd: root, stdio: 'pipe' });

    // Detach HEAD — simulates review worktree (git worktree add ... --detach)
    execFileSync('git', ['checkout', '--detach', 'HEAD'], { cwd: root, stdio: 'pipe' });

    // Should still fail — getCurrentBranch resolves feat/story-player via for-each-ref
    assert.throws(() => runCheck(root), /user-journey-undiscoverable/i);
  });

  it('fails in detached HEAD with remote-only feat/* ref (clean clone / CI scenario)', () => {
    // Simulates: git clone repo && git checkout --detach origin/feat/story-player
    // No local branch exists — only origin/feat/story-player in refs/remotes/.
    const root = mkdtempSync(join(tmpdir(), 'cc-journey-remote-detach-'));
    sandboxRoot = root;

    mkdirSync(join(root, 'docs', 'features'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });

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
        '| F999 | Test | in-progress | 测试猫 | link |',
        '',
      ].join('\n'),
      'utf-8',
    );

    writeFileSync(
      join(root, 'docs', 'features', 'F999-story-player.md'),
      [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Story Player',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'A feature without user journey.',
        '',
      ].join('\n'),
      'utf-8',
    );

    const generatorScript = [
      '#!/usr/bin/env node',
      "import { writeFileSync } from 'node:fs';",
      "const outIndex = process.argv.indexOf('--output');",
      "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
      "const features = [{ id: 'F999', status: 'in-progress', file: 'F999-story-player.md' }];",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: generator stub embeds template literal
      "writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\\n`, 'utf-8');",
    ].join('\n');
    writeFileSync(join(root, 'scripts', 'generate-feature-index.mjs'), generatorScript, 'utf-8');

    execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial with feature doc on main'], { cwd: root, stdio: 'pipe' });

    // Create bare remote with feat branch
    const bareRoot = mkdtempSync(join(tmpdir(), 'cc-journey-remote-detach-bare-'));
    execFileSync('git', ['clone', '--bare', root, bareRoot], { stdio: 'pipe' });

    // Push a feat branch to the bare remote (no F-number in name)
    execFileSync('git', ['checkout', '-b', 'feat/story-player'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'src', 'player.js'), 'console.log("code change");\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'update story player logic'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['push', bareRoot, 'feat/story-player'], { cwd: root, stdio: 'pipe' });

    // Simulate clean clone: fresh repo that only has remote-tracking refs
    const cloneRoot = mkdtempSync(join(tmpdir(), 'cc-journey-remote-detach-clone-'));
    execFileSync('git', ['clone', bareRoot, cloneRoot], { stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: cloneRoot, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: cloneRoot, stdio: 'pipe' });

    // Detach at origin/feat/story-player — no local branch, only remote-tracking ref
    execFileSync('git', ['checkout', '--detach', 'origin/feat/story-player'], { cwd: cloneRoot, stdio: 'pipe' });

    // Update sandboxRoot so afterEach cleans up the clone (root already cleaned by tmpdir)
    sandboxRoot = cloneRoot;

    // Should fail — getCurrentBranch resolves via refs/remotes/ fallback
    assert.throws(() => runCheck(cloneRoot), /user-journey-undiscoverable/i);
  });

  it('does NOT false-positive when detached at origin/main sharing a commit with origin/feat/*', () => {
    // Scenario: main and feat/story-player point at the same commit (feat just created,
    // no work done). CI detaches at origin/main. getCurrentBranch() must NOT return
    // feat/story-player — that would be a false positive blocking a main checkout.
    const root = mkdtempSync(join(tmpdir(), 'cc-journey-false-pos-'));
    sandboxRoot = root;

    mkdirSync(join(root, 'docs', 'features'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });

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
        '| F999 | Test | in-progress | 測試猫 | link |',
        '',
      ].join('\n'),
      'utf-8',
    );

    writeFileSync(
      join(root, 'docs', 'features', 'F999-story-player.md'),
      [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Story Player',
        '',
        '> **Status**: in-progress | **Owner**: 測試猫',
        '',
        '## What',
        '',
        'A feature.',
        '',
      ].join('\n'),
      'utf-8',
    );

    const generatorScript = [
      '#!/usr/bin/env node',
      "import { writeFileSync } from 'node:fs';",
      "const outIndex = process.argv.indexOf('--output');",
      "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
      "const features = [{ id: 'F999', status: 'in-progress', file: 'F999-story-player.md' }];",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: generator stub embeds template literal
      "writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\\n`, 'utf-8');",
    ].join('\n');
    writeFileSync(join(root, 'scripts', 'generate-feature-index.mjs'), generatorScript, 'utf-8');

    execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: root, stdio: 'pipe' });

    // Create feat/story-player at SAME commit as main — no new commits
    execFileSync('git', ['checkout', '-b', 'feat/story-player'], { cwd: root, stdio: 'pipe' });

    // Push both to bare (bare clone captures both branches)
    const bareRoot = mkdtempSync(join(tmpdir(), 'cc-journey-false-pos-bare-'));
    execFileSync('git', ['clone', '--bare', root, bareRoot], { stdio: 'pipe' });

    // Fresh clone — has origin/main and origin/feat/story-player at same SHA
    const cloneRoot = mkdtempSync(join(tmpdir(), 'cc-journey-false-pos-clone-'));
    execFileSync('git', ['clone', bareRoot, cloneRoot], { stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: cloneRoot, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: cloneRoot, stdio: 'pipe' });

    // Detach at origin/main — NOT at the feat branch
    execFileSync('git', ['checkout', '--detach', 'origin/main'], { cwd: cloneRoot, stdio: 'pipe' });

    sandboxRoot = cloneRoot;

    // Must NOT throw — we're on main, not on feat/story-player
    assert.doesNotThrow(() => runCheck(cloneRoot));
  });

  it('skips non-spec docs (verification/evidence) in User Journey check', () => {
    // A branch that changes a verification doc should not false-positive the gate.
    // F061-verification-2026-04-21.md has doc_type: verification — not a spec.
    // Manual fixture (like detached HEAD tests) for full control over doc content.
    const root = mkdtempSync(join(tmpdir(), 'cc-journey-nonspec-'));
    sandboxRoot = root;

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
        '| F061 | Design Tokens | in-progress | 猫猫 | link |',
        '',
      ].join('\n'),
      'utf-8',
    );

    // Spec doc WITH User Journey (passes gate)
    writeFileSync(
      join(root, 'docs', 'features', 'F061-design-tokens.md'),
      [
        '---',
        'feature_ids: [F061]',
        'doc_kind: spec',
        '---',
        '',
        '# F061: Design Tokens',
        '',
        '> **Status**: in-progress | **Owner**: 猫猫',
        '',
        '## User Journey',
        '',
        '**Scope unit**: design-tokens',
        '',
      ].join('\n'),
      'utf-8',
    );

    // Verification doc (doc_type: verification) — NO User Journey
    writeFileSync(
      join(root, 'docs', 'features', 'F061-verification-2026-04-21.md'),
      [
        '---',
        'feature_ids: [F061]',
        'doc_type: verification',
        'status: partial',
        '---',
        '',
        '# F061 Verification Report',
        '',
        'No User Journey section here.',
        '',
      ].join('\n'),
      'utf-8',
    );

    // Dogfood report (doc_kind: verification) — NO User Journey
    writeFileSync(
      join(root, 'docs', 'features', 'F061-dogfood-report.md'),
      [
        '---',
        'feature_ids: [F061]',
        'doc_kind: verification',
        '---',
        '',
        '# F061 Dogfood Report',
        '',
        'Also no User Journey.',
        '',
      ].join('\n'),
      'utf-8',
    );

    const generatorScript = [
      '#!/usr/bin/env node',
      "import { writeFileSync } from 'node:fs';",
      "const outIndex = process.argv.indexOf('--output');",
      "const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';",
      "const features = [{ id: 'F061', status: 'in-progress', file: 'F061-design-tokens.md' }];",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: generator stub embeds template literal
      "writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\\n`, 'utf-8');",
    ].join('\n');
    writeFileSync(join(root, 'scripts', 'generate-feature-index.mjs'), generatorScript, 'utf-8');

    execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: root, stdio: 'pipe' });

    const bareRoot = mkdtempSync(join(tmpdir(), 'cc-journey-nonspec-bare-'));
    execFileSync('git', ['clone', '--bare', root, bareRoot], { stdio: 'pipe' });
    execFileSync('git', ['remote', 'add', 'origin', bareRoot], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['fetch', 'origin'], { cwd: root, stdio: 'pipe' });

    // Create feat branch and modify the verification doc (triggers getChangedFeatureDocs)
    execFileSync('git', ['checkout', '-b', 'feat/F061-design-tokens'], { cwd: root, stdio: 'pipe' });
    writeFileSync(
      join(root, 'docs', 'features', 'F061-verification-2026-04-21.md'),
      [
        '---',
        'feature_ids: [F061]',
        'doc_type: verification',
        'status: complete',
        '---',
        '',
        '# F061 Verification Report',
        '',
        'Updated verification.',
        '',
      ].join('\n'),
      'utf-8',
    );
    writeFileSync(
      join(root, 'docs', 'features', 'F061-dogfood-report.md'),
      [
        '---',
        'feature_ids: [F061]',
        'doc_kind: verification',
        '---',
        '',
        '# F061 Dogfood Report',
        '',
        'Updated dogfood report.',
        '',
      ].join('\n'),
      'utf-8',
    );
    execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'update(F061): verification results'], { cwd: root, stdio: 'pipe' });

    // Both non-spec docs are "changed" (in diff). Without filter, gate falsely
    // flags them for missing ## User Journey. With filter, they're skipped.
    assert.doesNotThrow(() => runCheck(root));
  });

  it('checks legacy doc_kind: feature-spec docs for User Journey (not skipped)', () => {
    // Legacy feature specs use doc_kind: feature-spec instead of spec.
    // They ARE specs and must be checked — the non-spec filter must not skip them.
    sandboxRoot = createGitRepoFixture({
      featureDocContent: [
        '---',
        'feature_ids: [F999]',
        'doc_kind: feature-spec',
        '---',
        '',
        '# F999: Legacy Feature-Spec',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'A feature using legacy doc_kind: feature-spec without User Journey.',
        '',
      ].join('\n'),
    });

    // F999 has doc_kind: feature-spec but no ## User Journey → should FAIL
    assert.throws(() => runCheck(sandboxRoot), /user-journey-missing/i);
  });

  it('handles quoted YAML frontmatter values without false-skip (R4 cloud review)', () => {
    // Cloud R4 P2: when doc_kind: "spec" uses YAML quotes, the regex captures
    // the quotes too → allowlist comparison fails → doc treated as non-spec → skipped.
    // Gate must strip quotes before comparing.
    sandboxRoot = createGitRepoFixture({
      featureDocContent: [
        '---',
        'feature_ids: [F999]',
        'doc_kind: "spec"',
        '---',
        '',
        '# F999: Quoted Frontmatter Feature',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'A feature with quoted doc_kind value and no User Journey.',
        '',
      ].join('\n'),
    });

    // doc_kind: "spec" should be treated as spec → checked → fail (no journey)
    assert.throws(() => runCheck(sandboxRoot), /user-journey-missing/i);
  });

  it('accepts Chinese heading ## 用户旅程 as equivalent to ## User Journey', () => {
    // F252 dog-fooding: existing feature doc uses Chinese heading.
    // Gate must accept both languages.
    sandboxRoot = createGitRepoFixture({
      featureDocContent: [
        '---',
        'feature_ids: [F999]',
        'doc_kind: spec',
        '---',
        '',
        '# F999: Chinese Journey Heading',
        '',
        '> **Status**: in-progress | **Owner**: 测试猫',
        '',
        '## What',
        '',
        'A feature with Chinese User Journey heading.',
        '',
        '## 用户旅程',
        '',
        '**Scope unit**: thread-level',
        '',
      ].join('\n'),
    });

    // ## 用户旅程 should satisfy the gate — doc passes
    const output = runCheck(sandboxRoot);
    assert.match(output, /PASS check-feature-truth/i);
  });
});
