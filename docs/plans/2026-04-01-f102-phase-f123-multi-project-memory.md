---
doc_kind: plan
feature_ids: [F102]
created: 2026-04-01
status: active
---

# F102 Phase F-1/F-2/F-3: Multi-Project Memory Implementation Plan

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** 让猫出征新项目或接手遗留项目时，记忆系统能自动适配——新项目建标准骨架，遗留项目递归发现 .md 文件并索引
**Acceptance Criteria:**
- AC-F1-1: `project:init` CLI 创建 13 个 KIND_DIRS + 骨架文件
- AC-F1-2: 初始化后 `rebuild()` 产出健康 evidence.sqlite
- AC-F1-3: 幂等安全——已有文件不覆盖
- AC-F2-1: `discoverFiles()` 增加递归 fallback
- AC-F2-2: 递归发现的 .md kind 推断链：frontmatter → 父目录 → 默认 plan
- AC-F2-3: 遗留项目 rebuild 后 `search_evidence` 可搜到
- AC-F3-1: `frontmatter-formatter` CLI 报告缺失 frontmatter
- AC-F3-2: 自动推断 doc_kind / topics / anchor
- AC-F3-3: `--dry-run` 和 `--apply` 两种模式
- AC-F3-4: 已有 frontmatter 的文件不修改
**Architecture:** 三个独立工具，共享 IndexBuilder 基础。F-2 改 IndexBuilder.discoverFiles()，F-1 和 F-3 是独立 CLI 脚本
**Tech Stack:** Node.js, better-sqlite3, node:test
**前端验证:** No — 纯后端 CLI + IndexBuilder 改动

---

## Terminal Schema

### F-2: discoverFiles() 新增递归 fallback

```typescript
// IndexBuilder.ts — discoverFiles() 末尾新增
// Phase 4: Recursive fallback — scan all .md under docsRoot not already discovered
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'archive',
  ...Object.keys(KIND_DIRS),  // 已经在 Phase 1 扫过
]);

const scanFallback = (dirPath: string, depth = 0) => {
  if (depth > 10) return;
  try {
    for (const entry of readdirSync(dirPath)) {
      if (depth === 0 && EXCLUDE_DIRS.has(entry)) continue;
      const fullPath = join(dirPath, entry);
      try {
        const lst = lstatSync(fullPath);
        if (lst.isSymbolicLink()) continue;
        if (lst.isFile() && entry.endsWith('.md')) {
          if (!discoveredPaths.has(fullPath)) {
            const kind = inferKindFromPath(fullPath);
            results.push({ path: fullPath, kind });
          }
        } else if (lst.isDirectory()) {
          scanFallback(fullPath, depth + 1);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
};
scanFallback(this.docsRoot);
```

### F-1: project-init CLI

```typescript
// scripts/project-init.ts
export async function runProjectInit(targetDir: string): Promise<InitResult> {
  // Create 13 KIND_DIRS + top-level skeleton files
  // Skip existing files (idempotent)
}
```

### F-3: frontmatter-formatter CLI

```typescript
// scripts/frontmatter-formatter.ts
export async function runFrontmatterFormatter(opts: FormatterOptions): Promise<FormatterResult> {
  // Scan .md → infer missing fields → dry-run report or apply
}
```

---

## Task 1: F-2 — IndexBuilder recursive fallback (core change)

**Why first:** F-2 is the core IndexBuilder change that F-1 and F-3 depend on for testing. If discoverFiles() can find arbitrary .md files, the init script and formatter have a verifiable effect.

**Files:**
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts` — `discoverFiles()`
- Test: `packages/api/test/memory/index-builder.test.js` — new test group

### Step 1: Write failing test — recursive fallback discovers non-standard .md

```javascript
it('discoverFiles fallback: indexes .md outside KIND_DIRS', async () => {
  // Create a .md file in a non-standard directory
  mkdirSync(join(docsDir, 'custom-notes'), { recursive: true });
  writeFileSync(
    join(docsDir, 'custom-notes', 'meeting.md'),
    '# Team Meeting Notes\n\nDiscussion about architecture.',
  );

  const result = await builder.rebuild();
  assert.ok(result.docsIndexed >= 1, 'should index .md from non-standard dir');

  const item = await store.getByAnchor('doc:custom-notes/meeting');
  assert.ok(item, 'should have path-based anchor');
  assert.equal(item.kind, 'plan'); // default kind for unknown dirs
  assert.equal(item.title, 'Team Meeting Notes');
});
```

Run: `pnpm --filter @cat-cafe/api build && node --test test/memory/index-builder.test.js`
Expected: FAIL — custom-notes/meeting.md not discovered

### Step 2: Write failing test — frontmatter doc_kind overrides path inference

```javascript
it('discoverFiles fallback: respects frontmatter doc_kind over path', async () => {
  mkdirSync(join(docsDir, 'random'), { recursive: true });
  writeFileSync(
    join(docsDir, 'random', 'api-review.md'),
    `---
doc_kind: decision
anchor: REVIEW-001
---

# API Review Decision

We decided to use REST.
`,
  );

  const result = await builder.rebuild();
  const item = await store.getByAnchor('REVIEW-001');
  assert.ok(item, 'should index with explicit anchor');
  assert.equal(item.kind, 'decision'); // from frontmatter, not path
});
```

Run: same as above
Expected: FAIL — random/ not scanned

### Step 3: Write failing test — excludes node_modules and .git

```javascript
it('discoverFiles fallback: excludes node_modules and .git', async () => {
  mkdirSync(join(docsDir, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(docsDir, 'node_modules', 'pkg', 'README.md'), '# Package\n');

  mkdirSync(join(docsDir, '.git', 'info'), { recursive: true });
  writeFileSync(join(docsDir, '.git', 'info', 'notes.md'), '# Git Notes\n');

  // Also create a valid file to prove normal scan works
  mkdirSync(join(docsDir, 'misc'), { recursive: true });
  writeFileSync(join(docsDir, 'misc', 'valid.md'), '# Valid Doc\n');

  const result = await builder.rebuild();
  const nodeModItem = await store.getByAnchor('doc:node_modules/pkg/README');
  assert.equal(nodeModItem, null, 'should NOT index node_modules');

  const gitItem = await store.getByAnchor('doc:.git/info/notes');
  assert.equal(gitItem, null, 'should NOT index .git');

  const validItem = await store.getByAnchor('doc:misc/valid');
  assert.ok(validItem, 'should index valid misc dir');
});
```

### Step 4: Implement recursive fallback in discoverFiles()

Modify `packages/api/src/domains/memory/IndexBuilder.ts`:

After the top-level .md scan (line ~508), add Phase 4: recursive fallback.

Key changes:
1. Track already-discovered paths in a `Set<string>` at start of `discoverFiles()`
2. After all existing phases, do recursive scan of `docsRoot` excluding `EXCLUDE_DIRS` + already-scanned KIND_DIRS + archive
3. Files found in fallback use `inferKindFromPath()` → frontmatter override happens in `parseFile()`

### Step 5: Run tests, verify green

Run: `pnpm --filter @cat-cafe/api build && node --test test/memory/index-builder.test.js`
Expected: All new + existing tests PASS

### Step 6: Commit

```
feat(F102-F2): recursive fallback discovery for legacy project .md files
```

---

## Task 2: F-2 — Integration test with search_evidence (AC-F2-3)

**Files:**
- Test: `packages/api/test/memory/index-builder.test.js` — add search integration test

### Step 1: Write test — legacy project rebuild + search

```javascript
it('legacy project: rebuild + search finds non-standard docs', async () => {
  // Simulate a legacy project with no standard dirs
  mkdirSync(join(docsDir, 'notes'), { recursive: true });
  mkdirSync(join(docsDir, 'specs'), { recursive: true });

  writeFileSync(join(docsDir, 'notes', 'redis-setup.md'), `---
doc_kind: plan
topics: [redis, setup]
---

# Redis Setup Guide

How to configure Redis for production deployment.
`);

  writeFileSync(join(docsDir, 'specs', 'api-v2.md'), '# API v2 Specification\n\nNew endpoints for user management.\n');

  await builder.rebuild();

  // Search should find both docs
  const results = await store.search('redis setup', { limit: 5 });
  assert.ok(results.length >= 1, 'should find redis doc via search');
  assert.ok(results.some(r => r.title.includes('Redis')), 'result should include redis doc');
});
```

### Step 2: Run and verify

Run: `pnpm --filter @cat-cafe/api build && node --test test/memory/index-builder.test.js`
Expected: PASS (relies on Task 1 implementation)

### Step 3: Commit

```
test(F102-F2): integration test — legacy project search after rebuild
```

---

## Task 3: F-1 — project-init CLI script (AC-F1-1/F1-2/F1-3)

**Files:**
- Create: `packages/api/src/scripts/project-init.ts`
- Test: `packages/api/test/memory/project-init.test.js`
- Modify: `packages/api/package.json` — add `project:init` script

### Step 1: Write failing tests

```javascript
// project-init.test.js
describe('project-init', () => {
  it('creates all 13 KIND_DIRS subdirectories', async () => {
    // Run init on empty tmpdir
    // Verify all 13 dirs exist
  });

  it('creates skeleton files (BACKLOG.md, VISION.md)', async () => {
    // Verify files created with valid frontmatter
  });

  it('idempotent: does not overwrite existing files', async () => {
    // Create a custom VISION.md first
    // Run init
    // Verify custom content preserved
  });

  it('initialized project produces healthy evidence.sqlite', async () => {
    // Run init → rebuild → checkConsistency
    // Verify ok=true
  });
});
```

### Step 2: Implement project-init.ts

```typescript
export const SKELETON_FILES: Record<string, string> = {
  'BACKLOG.md': `---\ndoc_kind: plan\ncreated: {DATE}\n---\n\n# Backlog\n\n| ID | Feature | Status | Owner |\n|----|---------|--------|-------|\n`,
  'VISION.md': `---\ndoc_kind: plan\ncreated: {DATE}\n---\n\n# Vision\n\n> What is this project trying to achieve?\n`,
};

export async function runProjectInit(targetDir: string): Promise<InitResult> {
  const docsDir = join(targetDir, 'docs');
  const created: string[] = [];
  const skipped: string[] = [];

  // Create 13 KIND_DIRS
  for (const dir of Object.keys(KIND_DIRS)) {
    const dirPath = join(docsDir, dir);
    mkdirSync(dirPath, { recursive: true });
    created.push(dir + '/');
  }

  // Create skeleton files (skip if exists)
  for (const [filename, template] of Object.entries(SKELETON_FILES)) {
    const filePath = join(docsDir, filename);
    if (existsSync(filePath)) {
      skipped.push(filename);
    } else {
      writeFileSync(filePath, template.replace('{DATE}', new Date().toISOString().slice(0, 10)));
      created.push(filename);
    }
  }

  return { created, skipped };
}
```

### Step 3: Add to package.json

```json
"project:init": "node dist/scripts/project-init.js"
```

### Step 4: Run tests, verify green

### Step 5: Commit

```
feat(F102-F1): project-init CLI — scaffold standard docs structure
```

---

## Task 4: F-3 — frontmatter-formatter CLI (AC-F3-1/F3-2/F3-3/F3-4)

**Files:**
- Create: `scripts/frontmatter-formatter.mjs` (root-level script, like `check-frontmatter.mjs`)
- Test: `scripts/frontmatter-formatter.test.mjs`

### Step 1: Write failing tests

```javascript
describe('frontmatter-formatter', () => {
  it('dry-run: reports files missing frontmatter', () => {
    // Create .md without frontmatter → run dry-run → reports it
  });

  it('dry-run: does not modify files', () => {
    // Run dry-run → verify file content unchanged
  });

  it('apply: adds frontmatter to file without it', () => {
    // Create bare .md → run apply → verify frontmatter added
  });

  it('infers doc_kind from parent directory name', () => {
    // File in decisions/ → doc_kind: decision
  });

  it('infers doc_kind from content keywords', () => {
    // File with "## Decision" heading → doc_kind: decision
  });

  it('extracts topics from title', () => {
    // "# Redis Setup Guide" → topics: [redis, setup]
  });

  it('generates anchor from filename', () => {
    // api-review.md → anchor: doc:path/api-review
  });

  it('idempotent: skips files with complete frontmatter', () => {
    // File with full frontmatter → not modified
  });
});
```

### Step 2: Implement frontmatter-formatter.mjs

Key logic:
- `inferDocKind(filePath, content)`: path-based (KIND_DIRS match) → content keywords ("Decision"/"Lesson"/"Plan") → default `plan`
- `extractTopics(title)`: split title words, filter stop words, lowercase, take top 3
- `generateAnchor(filePath, docsRoot)`: `doc:{relativePath without .md}`
- `formatFrontmatter(fields)`: produce `---\nkey: value\n---\n` block
- `--dry-run`: print report, exit 0
- `--apply`: prepend frontmatter, preserve original content

### Step 3: Run tests, verify green

### Step 4: Commit

```
feat(F102-F3): frontmatter-formatter CLI — dry-run/apply modes
```

---

## Task 5: Root package.json script + final integration

**Files:**
- Modify: `package.json` (root) — add convenience script
- Modify: `packages/api/package.json` — add `project:init`

### Step 1: Add root-level script alias

```json
"project:init": "pnpm --filter @cat-cafe/api project:init"
```

### Step 2: End-to-end verification

Run full test suite:
```bash
pnpm --filter @cat-cafe/api build && pnpm --filter @cat-cafe/api test
```

Run `pnpm gate` to confirm no regressions.

### Step 3: Commit

```
chore(F102-F123): wire project:init + frontmatter-formatter into package scripts
```

---

## Task 6: Biome + lint + feature index

### Step 1: `pnpm check:fix` + `pnpm lint`
### Step 2: Regenerate feature index: `node scripts/generate-feature-index.mjs`
### Step 3: Final `pnpm gate`
### Step 4: Commit

```
style(F102-F123): biome format + regenerate feature index
```

---

## Execution Order Summary

```
Task 1: F-2 recursive fallback (IndexBuilder core change)     ← most impactful
Task 2: F-2 search integration test                           ← proves AC-F2-3
Task 3: F-1 project-init CLI                                  ← depends on rebuild working
Task 4: F-3 frontmatter-formatter CLI                         ← independent tool
Task 5: Script wiring + integration                           ← glue
Task 6: Lint + gate                                           ← final check
```

Total: ~6 commits, estimated 200-300 lines new code + 200 lines tests.
