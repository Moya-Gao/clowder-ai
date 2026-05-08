import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import {
  checkArchitectureCellDeclarations,
  checkCodeAnchors,
  checkDiffArchitectureNouns,
  checkInProgressFeaturesMissingCell,
  loadOwnershipCells,
} from './check-architecture-ownership.mjs';

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cc-ownership-check-'));
  tempDirs.push(dir);
  return dir;
}

test('detects stale code anchors from ownership cell frontmatter', () => {
  const root = tempRepo();
  const cellsDir = join(root, 'cells');
  mkdirSync(cellsDir);
  writeFileSync(join(root, 'existing.ts'), 'export const ok = true;\n');
  writeFileSync(
    join(cellsDir, 'dispatch.md'),
    `---
cell_id: dispatch
title: Dispatch
summary: Queue ownership.
canonical_features: [F185]
code_anchors:
  - existing.ts
  - missing.ts
doc_anchors: []
static_scan_hints: [InvocationQueue]
cited_by: []
---

# Dispatch
`,
  );

  const cells = loadOwnershipCells(cellsDir);
  const warnings = checkCodeAnchors(cells, root);

  assert.deepEqual(
    warnings.map((warning) => warning.message),
    ['dispatch references missing code_anchor: missing.ts'],
  );
});

test('detects unknown Architecture cell declarations outside fenced code', () => {
  const root = tempRepo();
  writeFileSync(
    join(root, 'feature.md'),
    `# Feature

Architecture cell: not-a-cell

\`\`\`markdown
Architecture cell: template-placeholder
\`\`\`
`,
  );

  const warnings = checkArchitectureCellDeclarations([join(root, 'feature.md')], new Set(['dispatch']), root);

  assert.deepEqual(
    warnings.map((warning) => warning.message),
    ['feature.md declares unknown Architecture cell: not-a-cell'],
  );
});

test('warns when diff adds architecture nouns without Architecture cell declaration', () => {
  const diff = `diff --git a/src/new.ts b/src/new.ts
@@ -0,0 +1,2 @@
+export class SurpriseQueue {}
+export class SurpriseRouter {}
`;

  const warnings = checkDiffArchitectureNouns(diff);

  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /adds architecture nouns without Architecture cell declaration/);
  assert.match(warnings[0].details[0], /SurpriseQueue/);
});

test('does not warn for architecture nouns when diff declares Architecture cell', () => {
  const diff = `diff --git a/docs/features/F999.md b/docs/features/F999.md
@@ -0,0 +1,4 @@
+Architecture cell: dispatch
+Map delta: none
+Why: Extends the existing queue owner.
+export class PlannedQueue {}
`;

  assert.deepEqual(checkDiffArchitectureNouns(diff), []);
});

test('warns when in-progress feature spec is missing Architecture cell declaration', () => {
  const root = tempRepo();
  const featuresDir = join(root, 'features');
  mkdirSync(featuresDir);

  writeFileSync(
    join(featuresDir, 'F200-missing-cell.md'),
    `---
feature_ids: [F200]
doc_kind: spec
---

# F200: Missing Cell

> **Status**: in-progress | **Owner**: 布偶猫

## Why

Some reason.
`,
  );

  writeFileSync(
    join(featuresDir, 'F201-has-cell.md'),
    `---
feature_ids: [F201]
doc_kind: spec
---

# F201: Has Cell

> **Status**: in-progress | **Owner**: 布偶猫

Architecture cell: dispatch
Map delta: none
Why: Extends dispatch.
`,
  );

  writeFileSync(
    join(featuresDir, 'F202-done.md'),
    `---
feature_ids: [F202]
doc_kind: spec
---

# F202: Already Done

> **Status**: done | **Owner**: 布偶猫
`,
  );

  const warnings = checkInProgressFeaturesMissingCell(featuresDir, root);

  assert.deepEqual(
    warnings.map((warning) => warning.message),
    ['features/F200-missing-cell.md is in-progress but missing Architecture cell declaration'],
  );
});

test('does not warn for in-progress feature with Architecture cell: none', () => {
  const root = tempRepo();
  const featuresDir = join(root, 'features');
  mkdirSync(featuresDir);

  writeFileSync(
    join(featuresDir, 'F203-none-cell.md'),
    `---
feature_ids: [F203]
doc_kind: spec
---

# F203: Process Feature

> **Status**: in-progress | **Owner**: 布偶猫

Architecture cell: none
Map delta: none
Why: Process feature, no code architecture.
`,
  );

  assert.deepEqual(checkInProgressFeaturesMissingCell(featuresDir, root), []);
});
