---
feature_ids: [F152]
related_features: [F102, F070]
topics: [generic-repo-scanner, provenance, memory, scanner-strategy, expedition-memory]
doc_kind: plan
created: 2026-04-09
phase: "Phase A"
---

# F152 Phase A: GenericRepoScanner — Implementation Plan

**Feature:** F152 — `docs/features/F152-expedition-memory.md`
**Goal:** 让 IndexBuilder 能扫描非 cat-cafe 结构的普通 Git 仓库，产出带 provenance 的 ScannedEvidence，并支持 provenance 感知的检索
**Acceptance Criteria:**
- AC-A1: `GenericRepoScanner` 能扫描一个没有 cat-cafe `docs/` 结构的普通 Git 仓库，产出 `ScannedEvidence[]`
- AC-A2: 每个 `ScannedEvidence` 带 `provenance: { tier: 'authoritative'|'derived'|'soft_clue', source: string }`
- AC-A3: `IIndexBuilder` 根据项目结构自动选择 `CatCafeScanner` 或 `GenericRepoScanner`
- AC-A4: 扫描结果可被 `IEvidenceStore.search()` 正常检索（FTS5 + 向量）
- AC-A5: 大仓库（>10k 文件）扫描完成时间 < 60 秒（只扫 authoritative + derived）
- AC-A6: 检索契约：`IEvidenceStore.search()` 支持 `provenance_tier` filter；authoritative 结果默认 boost 排序权重
**Architecture:** 从 IndexBuilder 抽出 pluggable RepoScanner 策略（KD-5）。CatCafeScanner 包裹现有 discoverFiles/parseFile 逻辑。GenericRepoScanner 新增三层扫描。provenance 持久化到 SQLite（KD-6）。IndexBuilder 只做 dedupe/hash/upsert/edges 编排。
**Tech Stack:** TypeScript, SQLite (better-sqlite3), node:test
**前端验证:** No — 纯后端改动

---

## Straight-Line Check

**终点（B）**：IndexBuilder 持有 `scanner: RepoScanner`，能自动检测项目类型并选择 CatCafeScanner 或 GenericRepoScanner。GenericRepoScanner 扫描任意 Git 仓库的 README/docs/manifests/changelog，产出带 provenance 的 ScannedEvidence。provenance_tier + provenance_source 持久化到 evidence_docs 表，search() 支持 provenance 过滤和 authoritative boost。

**不做的事**：
- 不改 Bootstrap 编排器（Phase B）
- 不做经验回流（Phase C）
- 不做 CLI/前端变更
- 不扫 commit messages / code comments（KD-10 否决）
- 不做 monorepo per-package 深扫（KD-9，Phase B）
- 不改 GlobalIndexBuilder（它有独立的 skillsRoot/memoryRoot 逻辑）

**Terminal schema**：

```typescript
// interfaces.ts additions
interface RepoScanner {
  discover(projectRoot: string): ScannedEvidence[];
}

interface ScannedEvidence {
  item: Omit<EvidenceItem, 'sourceHash'>;
  provenance: { tier: ProvenanceTier; source: string };
  rawContent: string;
}

type ProvenanceTier = 'authoritative' | 'derived' | 'soft_clue';

// EvidenceItem gains optional provenance
interface EvidenceItem {
  // ... existing fields ...
  provenance?: { tier: ProvenanceTier; source: string };
}

// SearchOptions gains provenance filter
interface SearchOptions {
  // ... existing fields ...
  provenanceTier?: ProvenanceTier;
}
```

```sql
-- schema.ts V10 migration
ALTER TABLE evidence_docs ADD COLUMN provenance_tier TEXT;
ALTER TABLE evidence_docs ADD COLUMN provenance_source TEXT;
CREATE INDEX idx_evidence_docs_provenance ON evidence_docs(provenance_tier);
```

---

## Task 1: Define RepoScanner interface + ScannedEvidence + provenance types

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts`

**Step 1: Add ProvenanceTier type and ScannedEvidence**

After the `EvidenceStatus` type (line 42), add:

```typescript
export type ProvenanceTier = 'authoritative' | 'derived' | 'soft_clue';

export interface Provenance {
  tier: ProvenanceTier;
  source: string;
}

export interface ScannedEvidence {
  item: Omit<EvidenceItem, 'sourceHash'>;
  provenance: Provenance;
  rawContent: string;
}
```

**Step 2: Add provenance field to EvidenceItem**

After the `passages` field (line 79), add:

```typescript
/** F152 Phase A: provenance tracking for scanner-produced evidence */
provenance?: Provenance;
```

**Step 3: Add RepoScanner interface**

After `IIndexBuilder` (line 176), add:

```typescript
export interface RepoScanner {
  discover(projectRoot: string): ScannedEvidence[];
}

export const IRepoScannerSymbol = Symbol.for('IRepoScanner');
```

**Step 4: Add provenanceTier to SearchOptions**

After the `dimension` field (line 117), add:

```typescript
/** F152 Phase A (AC-A6): filter by provenance tier */
provenanceTier?: ProvenanceTier;
```

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/interfaces.ts
git commit -m "feat(F152): define RepoScanner interface + ScannedEvidence + provenance types [宪宪/Opus-46🐾]"
```

---

## Task 2: SQLite V10 migration — provenance columns

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts`
- Test: `packages/api/test/memory/index-builder.test.js`

**Step 1: Write the failing test**

Add test to `index-builder.test.js` verifying the migration adds provenance columns:

```javascript
it('V10 migration adds provenance columns', async () => {
  const db = store.getDb();
  const columns = db.pragma('table_info(evidence_docs)').map(c => c.name);
  assert.ok(columns.includes('provenance_tier'), 'should have provenance_tier column');
  assert.ok(columns.includes('provenance_source'), 'should have provenance_source column');
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js --test-name-pattern "V10 migration"
```

Expected: FAIL — columns don't exist yet.

**Step 3: Add SCHEMA_V10 and migration**

In `schema.ts`, after SCHEMA_V8_DYNAMIC_TASKS constant, add:

```typescript
// F152 Phase A: provenance tracking for scanner-produced evidence
export const SCHEMA_V10 = `
CREATE INDEX IF NOT EXISTS idx_evidence_docs_provenance ON evidence_docs(provenance_tier);
`;
```

Bump `CURRENT_SCHEMA_VERSION` from 9 to 10.

In `applyMigrations()`, after the V9 block, add:

```typescript
if (currentVersion < 10) {
  // F152 Phase A: add provenance columns to evidence_docs
  try {
    db.exec('ALTER TABLE evidence_docs ADD COLUMN provenance_tier TEXT');
  } catch {
    // Column may already exist from a partial migration
  }
  try {
    db.exec('ALTER TABLE evidence_docs ADD COLUMN provenance_source TEXT');
  } catch {
    // Column may already exist from a partial migration
  }
  db.exec(SCHEMA_V10);
  db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(10, new Date().toISOString());
}
```

**Step 4: Run test to verify it passes**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js --test-name-pattern "V10 migration"
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/schema.ts packages/api/test/memory/index-builder.test.js
git commit -m "feat(F152): add V10 migration — provenance_tier + provenance_source columns [宪宪/Opus-46🐾]"
```

---

## Task 3: Extend SqliteEvidenceStore — upsert/read provenance

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- Test: `packages/api/test/memory/index-builder.test.js`

**Step 1: Write the failing test**

```javascript
it('upsert + getByAnchor round-trips provenance', async () => {
  await store.upsert([{
    anchor: 'test-prov',
    kind: 'research',
    status: 'active',
    title: 'Test provenance',
    updatedAt: new Date().toISOString(),
    provenance: { tier: 'derived', source: 'package.json' },
  }]);
  const item = await store.getByAnchor('test-prov');
  assert.ok(item);
  assert.deepStrictEqual(item.provenance, { tier: 'derived', source: 'package.json' });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js --test-name-pattern "round-trips provenance"
```

Expected: FAIL — provenance not persisted/read.

**Step 3: Extend RowShape, rowToItem, upsert**

In `SqliteEvidenceStore.ts`:

a) Add to `RowShape` (after `pack_id`):

```typescript
provenance_tier: string | null;
provenance_source: string | null;
```

b) Extend `rowToItem()` (after the `pack_id` line):

```typescript
if (row.provenance_tier != null) {
  item.provenance = {
    tier: row.provenance_tier as 'authoritative' | 'derived' | 'soft_clue',
    source: row.provenance_source ?? '',
  };
}
```

c) Extend `upsert()` SQL and parameters:

Change INSERT statement to include `provenance_tier, provenance_source`:

```typescript
const stmt = db.prepare(`
  INSERT OR REPLACE INTO evidence_docs
  (anchor, kind, status, title, summary, keywords, source_path, source_hash,
   superseded_by, materialized_from, updated_at, pack_id, provenance_tier, provenance_source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
```

Add two more parameters to `stmt.run()`:

```typescript
item.provenance?.tier ?? null,
item.provenance?.source ?? null,
```

**Step 4: Run test to verify it passes**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js --test-name-pattern "round-trips provenance"
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/SqliteEvidenceStore.ts packages/api/test/memory/index-builder.test.js
git commit -m "feat(F152): extend SqliteEvidenceStore to persist provenance [宪宪/Opus-46🐾]"
```

---

## Task 4: Extract CatCafeScanner from IndexBuilder

**Files:**
- Create: `packages/api/src/domains/memory/CatCafeScanner.ts`
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts`
- Test: `packages/api/test/memory/index-builder.test.js`

**Step 1: Write the failing test**

```javascript
it('CatCafeScanner.discover() returns ScannedEvidence with authoritative provenance', async () => {
  writeFileSync(
    join(docsDir, 'features', 'F099-test.md'),
    `---
feature_ids: [F099]
topics: [test]
doc_kind: spec
---

# F099: Test Feature

Some test content.
`,
  );

  const { CatCafeScanner } = await import('../../dist/domains/memory/CatCafeScanner.js');
  const scanner = new CatCafeScanner();
  const results = scanner.discover(docsDir);

  const f099 = results.find(r => r.item.anchor === 'F099');
  assert.ok(f099, 'should discover F099');
  assert.equal(f099.provenance.tier, 'authoritative');
  assert.ok(f099.provenance.source.includes('features'));
  assert.ok(f099.rawContent.includes('Test Feature'));
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js --test-name-pattern "CatCafeScanner.discover"
```

Expected: FAIL — CatCafeScanner doesn't exist.

**Step 3: Create CatCafeScanner.ts**

Extract from `IndexBuilder.ts`:
- `KIND_DIRS` constant
- `discoverFiles()` method → `discover(projectRoot)` (rename `docsRoot` to `projectRoot` parameter; for CatCafeScanner, projectRoot = docsRoot since cat-cafe conventionally passes `docs/`)
- `parseFile()` method → private, returns ScannedEvidence
- `splitLessonsLearned()` method
- Helper functions: `extractFrontmatter`, `extractAnchor`, `inferKind`, `inferKindFromPath`, `extractTitle`, `extractSummary`

CatCafeScanner implements `RepoScanner` from interfaces.ts. All evidence gets `provenance: { tier: 'authoritative', source: relative path }` since cat-cafe docs are structured and frontmattered.

**Key mapping (KD-7 compliance):**
- CatCafeScanner receives `docsRoot` as `projectRoot` — this is backward-compatible because cat-cafe projects pass `docs/` as root
- `sourcePath` computed as `relative(projectRoot, filePath)` — same semantics as before

```typescript
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { EvidenceKind, RepoScanner, ScannedEvidence } from './interfaces.js';

export const KIND_DIRS: Record<string, EvidenceKind> = {
  features: 'feature',
  decisions: 'decision',
  plans: 'plan',
  lessons: 'lesson',
  discussions: 'discussion',
  research: 'research',
  phases: 'plan',
  reflections: 'lesson',
  methods: 'lesson',
  episodes: 'lesson',
  postmortems: 'lesson',
  guides: 'plan',
  stories: 'lesson',
};

export class CatCafeScanner implements RepoScanner {
  discover(projectRoot: string): ScannedEvidence[] {
    const files = this.discoverFiles(projectRoot);
    const results: ScannedEvidence[] = [];

    // Lessons-learned split
    for (const item of this.splitLessonsLearned(projectRoot)) {
      results.push({
        item,
        provenance: { tier: 'authoritative', source: 'lessons-learned.md' },
        rawContent: '', // lessons are pre-parsed
      });
    }

    for (const file of files) {
      const evidence = this.parseFile(file.path, projectRoot);
      if (evidence) results.push(evidence);
    }

    return results;
  }

  // ... (discoverFiles, parseFile, splitLessonsLearned — moved from IndexBuilder)
}
```

**Step 4: Refactor IndexBuilder to use CatCafeScanner**

Remove from IndexBuilder:
- `KIND_DIRS` (now in CatCafeScanner — re-export for backward compat)
- `discoverFiles()` private method
- `parseFile()` private method
- `splitLessonsLearned()` private method
- Helper functions at file bottom (move to CatCafeScanner or shared util)

IndexBuilder changes:
- Add constructor parameter: `private readonly scanner: RepoScanner`
- `rebuild()` calls `this.scanner.discover(this.docsRoot)` instead of `this.discoverFiles()` + `this.parseFile()`
- Convert ScannedEvidence → EvidenceItem (compute sourceHash from rawContent, merge provenance)
- `incrementalUpdate()` — for now, keep delegating to scanner's parseFile-equivalent (CatCafeScanner exposes it via discover on single file, or keep a thin wrapper)

**Important backward-compat**: IndexBuilder re-exports `KIND_DIRS` from CatCafeScanner so existing imports don't break.

**Step 5: Run ALL existing tests**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js
```

Expected: ALL PASS — existing behavior preserved.

**Step 6: Commit**

```bash
git add packages/api/src/domains/memory/CatCafeScanner.ts packages/api/src/domains/memory/IndexBuilder.ts packages/api/test/memory/index-builder.test.js
git commit -m "refactor(F152): extract CatCafeScanner from IndexBuilder (KD-5) [宪宪/Opus-46🐾]"
```

---

## Task 5: Implement GenericRepoScanner

**Files:**
- Create: `packages/api/src/domains/memory/GenericRepoScanner.ts`
- Test: `packages/api/test/memory/generic-repo-scanner.test.js`

**Step 1: Write the failing tests**

Create `packages/api/test/memory/generic-repo-scanner.test.js`:

```javascript
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('GenericRepoScanner', () => {
  let tmpDir;
  let scanner;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `f152-generic-${randomUUID().slice(0, 8)}`);
    mkdirSync(tmpDir, { recursive: true });
    const { GenericRepoScanner } = await import('../../dist/domains/memory/GenericRepoScanner.js');
    scanner = new GenericRepoScanner();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scans README as authoritative', () => {
    writeFileSync(join(tmpDir, 'README.md'), '# My Project\n\nA cool project.');
    const results = scanner.discover(tmpDir);
    const readme = results.find(r => r.item.sourcePath === 'README.md');
    assert.ok(readme, 'should find README');
    assert.equal(readme.provenance.tier, 'authoritative');
    assert.equal(readme.item.kind, 'plan');
  });

  it('scans docs/**/*.md as authoritative', () => {
    mkdirSync(join(tmpDir, 'docs'), { recursive: true });
    writeFileSync(join(tmpDir, 'docs', 'guide.md'), '# Guide\n\nHow to use.');
    const results = scanner.discover(tmpDir);
    const guide = results.find(r => r.item.sourcePath === 'docs/guide.md');
    assert.ok(guide, 'should find docs/guide.md');
    assert.equal(guide.provenance.tier, 'authoritative');
  });

  it('scans package.json as derived', () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-project', version: '1.0.0',
      description: 'A test project', dependencies: { express: '^4.18' },
    }));
    const results = scanner.discover(tmpDir);
    const pkg = results.find(r => r.provenance.source === 'package.json');
    assert.ok(pkg, 'should find package.json');
    assert.equal(pkg.provenance.tier, 'derived');
    assert.equal(pkg.item.kind, 'research');
  });

  it('scans CHANGELOG as soft_clue', () => {
    writeFileSync(join(tmpDir, 'CHANGELOG.md'), '# Changelog\n\n## 1.0.0\n- Initial release');
    const results = scanner.discover(tmpDir);
    const cl = results.find(r => r.provenance.source === 'CHANGELOG.md');
    assert.ok(cl, 'should find CHANGELOG');
    assert.equal(cl.provenance.tier, 'soft_clue');
    assert.equal(cl.item.kind, 'lesson');
  });

  it('does not scan node_modules or .git', () => {
    mkdirSync(join(tmpDir, 'node_modules', 'foo'), { recursive: true });
    mkdirSync(join(tmpDir, '.git', 'objects'), { recursive: true });
    writeFileSync(join(tmpDir, 'node_modules', 'foo', 'README.md'), '# Foo');
    writeFileSync(join(tmpDir, '.git', 'objects', 'readme.md'), 'git data');
    writeFileSync(join(tmpDir, 'README.md'), '# Root');
    const results = scanner.discover(tmpDir);
    assert.equal(results.length, 1, 'should only find root README');
  });

  it('sourcePath is repo-relative (KD-7)', () => {
    mkdirSync(join(tmpDir, 'docs', 'api'), { recursive: true });
    writeFileSync(join(tmpDir, 'docs', 'api', 'endpoints.md'), '# Endpoints');
    const results = scanner.discover(tmpDir);
    const ep = results.find(r => r.item.sourcePath === 'docs/api/endpoints.md');
    assert.ok(ep, 'sourcePath should be repo-relative');
  });

  it('handles large repos by skipping soft_clues when >10k files', () => {
    // We can't create 10k files in a test, but we can pass a fileCount hint
    writeFileSync(join(tmpDir, 'README.md'), '# Big Repo');
    writeFileSync(join(tmpDir, 'CHANGELOG.md'), '# Changelog');
    const results = scanner.discover(tmpDir, { skipSoftClues: true });
    assert.ok(results.some(r => r.provenance.tier === 'authoritative'));
    assert.ok(!results.some(r => r.provenance.tier === 'soft_clue'));
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/api && pnpm build && node --test test/memory/generic-repo-scanner.test.js
```

Expected: FAIL — GenericRepoScanner doesn't exist.

**Step 3: Implement GenericRepoScanner**

Create `packages/api/src/domains/memory/GenericRepoScanner.ts`:

```typescript
import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { EvidenceKind, ProvenanceTier, RepoScanner, ScannedEvidence } from './interfaces.js';

/** Directories to always skip during scanning */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out',
  '.next', '.nuxt', '__pycache__', '.tox', 'target', 'vendor',
  '.claude',
]);

/** Authoritative top-level file patterns (case-insensitive basename match) */
const AUTHORITATIVE_FILES: RegExp[] = [
  /^readme/i,
  /^architecture/i,
  /^contributing/i,
  /^adr[-_]?\d/i,
];

/** Manifest files → derived tier */
const DERIVED_MANIFESTS = new Set([
  'package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml',
  'pom.xml', 'build.gradle', 'build.gradle.kts',
  'composer.json', 'Gemfile', 'pubspec.yaml',
  'pnpm-workspace.yaml', 'lerna.json', 'rush.json',
]);

/** Soft-clue files */
const SOFT_CLUE_FILES: RegExp[] = [
  /^changelog/i,
  /^history/i,
  /^release/i,
];

export interface GenericScanOptions {
  skipSoftClues?: boolean;
}

export class GenericRepoScanner implements RepoScanner {
  discover(projectRoot: string, options?: GenericScanOptions): ScannedEvidence[] {
    const results: ScannedEvidence[] = [];
    const skipSoft = options?.skipSoftClues ?? false;

    // Layer 1: Authoritative — README, docs/**/*.md, ARCHITECTURE, CONTRIBUTING, ADRs
    this.scanAuthoritative(projectRoot, projectRoot, results);

    // Layer 2: Derived — package manifests
    this.scanDerived(projectRoot, projectRoot, results);

    // Layer 3: Soft clues — CHANGELOG, issue templates
    if (!skipSoft) {
      this.scanSoftClues(projectRoot, projectRoot, results);
    }

    return results;
  }

  // ... private methods for each layer
}
```

**Tier-to-kind mapping (from spec):**

| Tier | Source | EvidenceKind |
|------|--------|-------------|
| authoritative | README, docs/\*\*, ARCHITECTURE, CONTRIBUTING, ADR\*.md | `plan` |
| derived | package.json, Cargo.toml, go.mod, etc. | `research` |
| soft_clue | CHANGELOG, .github/ISSUE_TEMPLATE/\*\* | `lesson` |

**Key implementation details:**
- `sourcePath` is always `relative(projectRoot, filePath)` — repo-relative per KD-7
- Anchors: `doc:{relative-path-without-.md}` (same scheme as IndexBuilder's no-frontmatter fallback)
- For files with YAML frontmatter (e.g. docs/\*\*.md), extract anchor from frontmatter if present
- `rawContent` = full file content (for sourceHash computation by IndexBuilder)
- Depth limit: 10 levels (same as CatCafeScanner)
- Manifest parsing: extract name/description/dependencies as summary text

**Step 4: Run tests to verify they pass**

```bash
cd packages/api && pnpm build && node --test test/memory/generic-repo-scanner.test.js
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/GenericRepoScanner.ts packages/api/test/memory/generic-repo-scanner.test.js
git commit -m "feat(F152): implement GenericRepoScanner with three-tier scanning (AC-A1, AC-A2) [宪宪/Opus-46🐾]"
```

---

## Task 6: Refactor IndexBuilder to use RepoScanner strategy + auto-selection (AC-A3)

**Files:**
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts`
- Modify: `packages/api/test/memory/index-builder.test.js`

**Step 1: Write the failing test**

```javascript
it('auto-selects GenericRepoScanner for non-cat-cafe repos', async () => {
  // Create a non-cat-cafe project (no features/, no decisions/, has README + package.json)
  const genericDir = join(tmpDir, 'generic-project');
  mkdirSync(genericDir, { recursive: true });
  writeFileSync(join(genericDir, 'README.md'), '# Generic Project\n\nA non-cat-cafe project.');
  writeFileSync(join(genericDir, 'package.json'), JSON.stringify({ name: 'generic', version: '1.0.0' }));

  const { IndexBuilder } = await import('../../dist/domains/memory/IndexBuilder.js');
  const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');

  const genericStore = new SqliteEvidenceStore(':memory:');
  await genericStore.initialize();
  // Pass projectRoot (not docsRoot) — auto-detection picks GenericRepoScanner
  const genericBuilder = new IndexBuilder(genericStore, genericDir);

  const result = await genericBuilder.rebuild();
  assert.ok(result.docsIndexed >= 1, 'should index at least README');

  const readme = await genericStore.getByAnchor('doc:README');
  assert.ok(readme, 'should have indexed README');
  assert.deepStrictEqual(readme.provenance?.tier, 'derived' || 'authoritative');
  genericStore.close();
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js --test-name-pattern "auto-selects"
```

Expected: FAIL — IndexBuilder doesn't auto-select yet.

**Step 3: Refactor IndexBuilder constructor + rebuild**

**Auto-detection logic (AC-A3):**

```typescript
function detectScanner(root: string): RepoScanner {
  // Cat-cafe project: has docs/features/ or docs/decisions/ with frontmattered .md
  const hasFeatures = existsSync(join(root, 'features'));
  const hasDecisions = existsSync(join(root, 'decisions'));
  if (hasFeatures || hasDecisions) {
    return new CatCafeScanner();
  }
  return new GenericRepoScanner();
}
```

IndexBuilder constructor gains optional `scanner` parameter:

```typescript
constructor(
  private readonly store: SqliteEvidenceStore,
  private readonly docsRoot: string,
  private embedDeps?: { embedding: IEmbeddingService; vectorStore: VectorStore },
  private readonly transcriptDataDir?: string,
  private readonly threadListFn?: ThreadListFn,
  private readonly messageListFn?: MessageListFn,
  private readonly excludeThreadIdsFn?: ExcludeThreadIdsFn,
  private readonly scanner?: RepoScanner,
) {}
```

In `rebuild()`, replace `this.discoverFiles()` + `this.parseFile()` loop with:

```typescript
const activeScanner = this.scanner ?? detectScanner(this.docsRoot);
const scannedItems = activeScanner.discover(this.docsRoot);

for (const scanned of scannedItems) {
  const sourceHash = createHash('sha256').update(scanned.rawContent).digest('hex').slice(0, 16);
  const item: EvidenceItem = {
    ...scanned.item,
    sourceHash,
    provenance: scanned.provenance,
  };
  // ... existing dedupe / kind-priority / upsert logic
}
```

**incrementalUpdate()** — for incremental, keep a thin `parseFile` helper that delegates to the scanner's logic. CatCafeScanner exposes a public `parseOneFile(filePath, root)` method for this purpose.

**Step 4: Run ALL existing tests**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js
```

Expected: ALL PASS (existing + new auto-selection test)

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/IndexBuilder.ts packages/api/test/memory/index-builder.test.js
git commit -m "refactor(F152): IndexBuilder uses RepoScanner strategy + auto-selection (AC-A3) [宪宪/Opus-46🐾]"
```

---

## Task 7: Search provenance_tier filter + authoritative boost (AC-A6)

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- Test: `packages/api/test/memory/index-builder.test.js`

**Step 1: Write the failing tests**

```javascript
it('search filters by provenanceTier', async () => {
  await store.upsert([
    {
      anchor: 'auth-doc', kind: 'plan', status: 'active',
      title: 'Auth doc about widgets', updatedAt: new Date().toISOString(),
      provenance: { tier: 'authoritative', source: 'README.md' },
    },
    {
      anchor: 'derived-doc', kind: 'research', status: 'active',
      title: 'Derived doc about widgets', updatedAt: new Date().toISOString(),
      provenance: { tier: 'derived', source: 'package.json' },
    },
  ]);

  const authOnly = await store.search('widgets', { provenanceTier: 'authoritative' });
  assert.equal(authOnly.length, 1);
  assert.equal(authOnly[0].anchor, 'auth-doc');
});

it('search boosts authoritative results', async () => {
  await store.upsert([
    {
      anchor: 'soft-clue', kind: 'lesson', status: 'active',
      title: 'Widget changelog notes', summary: 'Lots of widget details here',
      updatedAt: new Date().toISOString(),
      provenance: { tier: 'soft_clue', source: 'CHANGELOG.md' },
    },
    {
      anchor: 'auth-widget', kind: 'plan', status: 'active',
      title: 'Widget guide', summary: 'Brief widget overview',
      updatedAt: new Date().toISOString(),
      provenance: { tier: 'authoritative', source: 'docs/widget.md' },
    },
  ]);

  const results = await store.search('widget');
  // authoritative should appear before soft_clue regardless of BM25 score
  const authIdx = results.findIndex(r => r.anchor === 'auth-widget');
  const softIdx = results.findIndex(r => r.anchor === 'soft-clue');
  assert.ok(authIdx < softIdx, 'authoritative should rank before soft_clue');
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js --test-name-pattern "provenanceTier|boosts authoritative"
```

Expected: FAIL — filter not applied, no boost logic.

**Step 3: Implement provenance filter + boost in search()**

In `SqliteEvidenceStore.ts search()`:

a) **Filter**: In both anchor-lookup and FTS5 query blocks, add:

```typescript
if (options?.provenanceTier) {
  sql += ' AND d.provenance_tier = ?';
  params.push(options.provenanceTier);
}
```

b) **Boost**: In the FTS5 ORDER BY clause, add provenance-aware sort:

```sql
ORDER BY
  (d.superseded_by IS NOT NULL),
  (d.source_path LIKE 'archive/%'),
  (CASE d.provenance_tier
    WHEN 'authoritative' THEN 0
    WHEN 'derived' THEN 1
    WHEN 'soft_clue' THEN 2
    ELSE 1 END),
  rank
```

This ensures authoritative results appear first within equal BM25 relevance bands, while still allowing highly relevant soft_clues to surface.

For hybrid/semantic mode: add the same tier ordering to the RRF score computation:

```typescript
// Provenance boost: authoritative gets +0.3, derived +0.0, soft_clue -0.1
const provenanceBoost = tier === 'authoritative' ? 0.3 : tier === 'soft_clue' ? -0.1 : 0;
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js --test-name-pattern "provenanceTier|boosts authoritative"
```

Expected: PASS

**Step 5: Run full test suite**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js
```

Expected: ALL PASS

**Step 6: Commit**

```bash
git add packages/api/src/domains/memory/SqliteEvidenceStore.ts packages/api/test/memory/index-builder.test.js
git commit -m "feat(F152): search provenance_tier filter + authoritative boost (AC-A6) [宪宪/Opus-46🐾]"
```

---

## Task 8: Export barrel + type-check + full suite

**Files:**
- Modify: `packages/api/src/domains/memory/index.ts` (if barrel exists)
- Run: type-check + all tests

**Step 1: Verify exports**

Ensure `CatCafeScanner`, `GenericRepoScanner`, and new types are exported from the memory domain barrel (if one exists). Also ensure `KIND_DIRS` is re-exported from IndexBuilder for backward compat.

**Step 2: Type-check**

```bash
cd packages/api && pnpm lint
```

Expected: 0 errors

**Step 3: Full test suite**

```bash
cd packages/api && pnpm build && node --test test/memory/index-builder.test.js && node --test test/memory/generic-repo-scanner.test.js
```

Expected: ALL PASS

**Step 4: Biome check**

```bash
pnpm check
```

Expected: 0 errors

**Step 5: Commit**

```bash
git add -A
git commit -m "chore(F152): export barrel + type-check cleanup [宪宪/Opus-46🐾]"
```

---

## Task 9: End-to-end AC Verification

**Checklist:**

| AC | 验证方式 | 通过标准 |
|----|---------|---------|
| AC-A1 | `generic-repo-scanner.test.js` — scanner produces ScannedEvidence[] from a plain Git repo | README + docs/ + manifests all discovered |
| AC-A2 | Every ScannedEvidence in test output has `provenance: { tier, source }` | All three tiers represented in test fixtures |
| AC-A3 | `index-builder.test.js` auto-selection test | IndexBuilder picks CatCafeScanner for cat-cafe layout, GenericRepoScanner otherwise |
| AC-A4 | Round-trip test: GenericRepoScanner → IndexBuilder.rebuild → store.search finds the evidence | FTS5 matches on title/summary content |
| AC-A5 | GenericRepoScanner supports `skipSoftClues` option; IndexBuilder passes it for large repos | Test: soft_clues excluded when flag is set |
| AC-A6 | Search filter test + boost ordering test | `provenanceTier: 'authoritative'` filters; authoritative sorts before soft_clue |

**Integration test (manual verification):**

```bash
# In a test non-cat-cafe repo:
node -e "
  const { SqliteEvidenceStore } = require('./dist/domains/memory/SqliteEvidenceStore.js');
  const { IndexBuilder } = require('./dist/domains/memory/IndexBuilder.js');
  // ... build + search
"
```

---

## Implementation Notes

- **Backward compat**: `KIND_DIRS` re-exported from IndexBuilder → CatCafeScanner. Existing imports (`import { KIND_DIRS } from './IndexBuilder.js'`) must not break.
- **PR scope**: Only `packages/api/src/domains/memory/` + `packages/api/test/memory/`. No CLAUDE.md / AGENTS.md changes (feedback: `feedback_skill_pr_scope.md`).
- **Performance (AC-A5)**: GenericRepoScanner skips SKIP_DIRS at directory entry. `skipSoftClues` flag cuts the third scan pass. For >10k file repos, IndexBuilder passes this flag (count can be estimated from authoritative+derived pass file count × heuristic multiplier, or caller provides the hint).
- **incrementalUpdate()**: After refactoring, CatCafeScanner exposes `parseOneFile()` for single-file incremental updates. GenericRepoScanner equivalent deferred to Phase B (bootstrap triggers full rebuild anyway).

## Next

计划写完 → worktree → tdd（开始实现）→ quality-gate → request-review。
