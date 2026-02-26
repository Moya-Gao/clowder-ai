import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addFrontmatterIfMissing,
  applyContractFrontmatter,
  buildFeatureIndex,
  convertDebtTableIds,
  extractActiveFeatures,
  inferDocKind,
  inferFeatureIds,
  normalizeFeatureId,
} from './f40-backlog-metadata.mjs';

test('normalizeFeatureId canonicalizes legacy/variant IDs', () => {
  assert.equal(normalizeFeatureId('F1'), 'F001');
  assert.equal(normalizeFeatureId('F21++'), 'F021');
  assert.equal(normalizeFeatureId('f20b'), 'F020');
  assert.equal(normalizeFeatureId('unknown'), null);
});

test('inferDocKind resolves archive and active paths', () => {
  assert.equal(inferDocKind('plans/2026-02-26-demo.md'), 'plan');
  assert.equal(inferDocKind('archive/2026-02/discussions/a.md'), 'discussion');
  assert.equal(inferDocKind('archive/2026-02/bug-report/a.md'), 'bug-report');
  assert.equal(inferDocKind('features/F040-backlog-reorganization.md'), 'note');
});

test('inferFeatureIds extracts and canonicalizes IDs from path and heading', () => {
  const ids = inferFeatureIds('plans/2026-02-26-f21-study-mode-design.md', '# Design\n\nDepends on F34 and f3b.');
  assert.deepEqual(ids, ['F021']);
});

test('addFrontmatterIfMissing injects metadata for docs without frontmatter', () => {
  const out = addFrontmatterIfMissing('# Hello\n', {
    featureIds: ['F040'],
    topics: ['backlog', 'memory'],
    docKind: 'plan',
    created: '2026-02-26',
  });

  assert.match(
    out,
    /^---\nfeature_ids: \[F040\]\ntopics: \[backlog, memory\]\ndoc_kind: plan\ncreated: 2026-02-26\n---\n\n# Hello\n$/,
  );
});

test('addFrontmatterIfMissing preserves files that already have frontmatter', () => {
  const input = '---\nfeature_ids: [F010]\ntopics: [mobile]\ndoc_kind: plan\ncreated: 2026-02-20\n---\n\n# A\n';
  const out = addFrontmatterIfMissing(input, {
    featureIds: ['F040'],
    topics: ['backlog'],
    docKind: 'plan',
    created: '2026-02-26',
  });
  assert.equal(out, input);
});

test('applyContractFrontmatter rewrites existing frontmatter contract fields', () => {
  const input = '---\nfeature_ids: [F999]\ntopics: [old]\ndoc_kind: note\ncreated: 2000-01-01\n---\n\n# A\n';
  const out = applyContractFrontmatter(input, {
    featureIds: ['F040'],
    topics: ['backlog'],
    docKind: 'plan',
    created: '2026-02-26',
  });
  assert.match(
    out,
    /^---\nfeature_ids: \[F040\]\ntopics: \[backlog\]\ndoc_kind: plan\ncreated: 2026-02-26\n---\n\n# A\n$/,
  );
});

test('convertDebtTableIds migrates numeric debt IDs to TDxxx', () => {
  const input = `| # | 项目 | 状态 |\n|---|------|------|\n| 1 | A | [ ] |\n| 38 | B | [x] |\n| TD099 | C | [ ] |\n`;
  const out = convertDebtTableIds(input);
  assert.match(out, /\| TD001 \| A \|/);
  assert.match(out, /\| TD038 \| B \|/);
  assert.match(out, /\| TD099 \| C \|/);
});

test('extractActiveFeatures keeps only unfinished rows and canonical IDs', () => {
  const section = `## Feature Requests — 新功能需求\n\n| # | 功能 | 优先级 | 来源 | 描述 |\n|---|------|--------|------|------|\n| F10 | 手机端猫猫 | P1 (#5) | src | ... |\n| F11 | 模式系统 | [x] | src | ... |\n| F21++ | Study Mode | **P1** | src | ... |\n| ~~F29~~ | 已删除功能 | ~~P2~~ | src | ... |\n`;
  const items = extractActiveFeatures(section);
  assert.deepEqual(
    items.map((x) => x.id),
    ['F010', 'F021'],
  );
  assert.equal(items[0]?.name, '手机端猫猫');
  assert.equal(items[0]?.status, 'in-progress');
});

test('buildFeatureIndex groups docs by feature and unassigned', () => {
  const index = buildFeatureIndex(
    [
      {
        path: 'docs/plans/a.md',
        docKind: 'plan',
        featureIds: ['F010'],
        topics: ['mobile'],
        created: '2026-02-20',
        title: 'A',
      },
      {
        path: 'docs/research/b.md',
        docKind: 'research',
        featureIds: [],
        topics: ['memory'],
        created: '2026-02-25',
        title: 'B',
      },
    ],
    '2026-02-26T09:00:00.000Z',
  );

  assert.equal(index.totalDocs, 2);
  assert.equal(index.features.F010.length, 1);
  assert.equal(index.unassigned.length, 1);
});
