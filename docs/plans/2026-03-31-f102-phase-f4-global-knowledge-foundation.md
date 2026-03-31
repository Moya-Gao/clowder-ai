---
feature_ids: [F102]
related_features: [F100, F042]
topics: [memory, global-knowledge, federation, rrf, skills, knowledge-resolver]
doc_kind: plan
created: 2026-03-31
---

# F102 Phase F-4: Global Knowledge Foundation

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** 让猫猫出征新项目时带走全局知识——Skills/家规/MEMORY.md 编译为 `global_knowledge.sqlite`，KnowledgeResolver 联邦检索同时查 project + global
**Acceptance Criteria:**
- AC-F4-1: `GlobalIndexBuilder` 编译 Skills（SKILL.md + refs/）到 `global_knowledge.sqlite`
- AC-F4-2: `GlobalIndexBuilder` 编译 MEMORY.md 条目（所有项目的 auto-memory）到 `global_knowledge.sqlite`
- AC-F4-3: `global_knowledge.sqlite` 放在 `~/.cat-cafe/`（`GLOBAL_KNOWLEDGE_DB` env 可覆盖），启动时自动 rebuild
- AC-F4-4: Evidence search route 使用 `KnowledgeResolver`（已实现 RRF fusion），搜索结果透明融合 project + global
- AC-F4-5: Global store 故障时优雅降级为 project-only（KnowledgeResolver 已实现 `.catch(() => null)`）
**Architecture:** 新建 `GlobalIndexBuilder` 扫描 Skills + MEMORY.md，编译到独立 SQLite。复用现有 `SqliteEvidenceStore` 和 `KnowledgeResolver`（RRF + dedup + graceful degradation 已就位）。Evidence route 改为走 KnowledgeResolver 而非直连 evidenceStore
**Tech Stack:** SQLite (better-sqlite3), FTS5, existing SqliteEvidenceStore + KnowledgeResolver
**前端验证:** No — 纯后端改动

---

## Terminal Schema

```typescript
// GlobalIndexBuilder — compiles global knowledge sources
interface GlobalIndexConfig {
  skillsRoot: string;      // default: ~/.claude/skills/
  memoryRoot: string;      // default: ~/.claude/projects/
  globalDbPath: string;    // default: ~/.cat-cafe/global_knowledge.sqlite
}

// Reuses existing EvidenceItem, no new types needed
// Anchor conventions:
//   Skills:  global:skill/{dir-name}     e.g. global:skill/tdd
//   Refs:    global:ref/{file-stem}      e.g. global:ref/shared-rules
//   Memory:  global:memory/{slug}/{stem} e.g. global:memory/cat-cafe/redis-pitfalls
```

## What We're NOT Building

- No new MCP tools — existing `search_evidence` via KnowledgeResolver transparently fuses results
- No cross-project evidence.sqlite search (that's Phase F-1/F-2/F-3 scope)
- No embedding/vector for global index (lexical-only; project store has embeddings if enabled)
- No Memory Hub frontend (Phase J scope)
- No IMaterializationService for global knowledge

---

## Task 1: AC-F4-1 — GlobalIndexBuilder discovers + indexes Skills

**Files:**
- Create: `packages/api/src/domains/memory/GlobalIndexBuilder.ts`
- Test: `packages/api/test/memory/global-index-builder.test.js`

**Step 1: Write failing test**

```javascript
it('indexes SKILL.md files into global store (AC-F4-1)', () => {
  // Setup: create temp dir with skill structure
  const tmpDir = mkdtempSync(join(tmpdir(), 'skills-'));
  mkdirSync(join(tmpDir, 'tdd'));
  writeFileSync(join(tmpDir, 'tdd', 'SKILL.md'), `---
name: tdd
description: Red-Green-Refactor 测试驱动开发纪律
---

# TDD（测试驱动开发）

Red-Green-Refactor cycle for all implementation work.`);

  const globalStore = new SqliteEvidenceStore(':memory:');
  globalStore.initialize();

  const builder = new GlobalIndexBuilder({
    skillsRoot: tmpDir,
    memoryRoot: '/nonexistent',
    globalStore,
  });

  const result = builder.rebuild();
  assert.ok(result.docsIndexed >= 1);

  const items = globalStore.search('TDD 测试驱动');
  assert.ok(items.length >= 1);
  assert.equal(items[0].anchor, 'global:skill/tdd');
  assert.equal(items[0].kind, 'plan');

  globalStore.close();
  rmSync(tmpDir, { recursive: true });
});
```

**Step 2: Run test — expect FAIL** (GlobalIndexBuilder not found)

Run: `cd packages/api && node --test test/memory/global-index-builder.test.js`

**Step 3: Implement GlobalIndexBuilder skeleton + discoverSkills()**

```typescript
export class GlobalIndexBuilder {
  private readonly skillsRoot: string;
  private readonly memoryRoot: string;
  private readonly store: SqliteEvidenceStore;

  constructor(config: { skillsRoot: string; memoryRoot: string; globalStore: SqliteEvidenceStore }) {
    this.skillsRoot = config.skillsRoot;
    this.memoryRoot = config.memoryRoot;
    this.store = config.globalStore;
  }

  rebuild(): { docsIndexed: number; docsSkipped: number; durationMs: number } {
    const start = Date.now();
    const items = [...this.discoverSkills(), ...this.discoverMemories()];
    if (items.length > 0) this.store.upsert(items);
    return { docsIndexed: items.length, docsSkipped: 0, durationMs: Date.now() - start };
  }

  private discoverSkills(): EvidenceItem[] {
    if (!existsSync(this.skillsRoot)) return [];
    const items: EvidenceItem[] = [];
    const entries = readdirSync(this.skillsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && entry.name !== 'refs') continue;
      if (entry.name === 'refs') {
        // index refs/*.md as kind='decision'
        items.push(...this.indexDir(join(this.skillsRoot, 'refs'), 'decision', 'global:ref'));
      } else {
        // index SKILL.md as kind='plan'
        const skillPath = join(this.skillsRoot, entry.name, 'SKILL.md');
        if (existsSync(skillPath)) {
          const content = readFileSync(skillPath, 'utf-8');
          const fm = parseFrontmatter(content);
          items.push({
            anchor: `global:skill/${entry.name}`,
            kind: 'plan',
            status: 'active',
            title: (fm?.name ?? entry.name),
            summary: fm?.description ?? content.slice(0, 300),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
    return items;
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

---

## Task 2: AC-F4-1b — GlobalIndexBuilder indexes refs/*.md

**Files:**
- Modify: `packages/api/src/domains/memory/GlobalIndexBuilder.ts` (indexDir helper)
- Test: `packages/api/test/memory/global-index-builder.test.js`

**Step 1: Write failing test**

```javascript
it('indexes refs/*.md files as decisions (AC-F4-1b)', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'skills-'));
  mkdirSync(join(tmpDir, 'refs'));
  writeFileSync(join(tmpDir, 'refs', 'shared-rules.md'), `# 家规（三猫共用协作规则）

面向终态，不绕路。协作优先。`);

  const globalStore = new SqliteEvidenceStore(':memory:');
  globalStore.initialize();

  const builder = new GlobalIndexBuilder({
    skillsRoot: tmpDir,
    memoryRoot: '/nonexistent',
    globalStore,
  });

  builder.rebuild();
  const items = globalStore.search('家规 协作规则');
  assert.ok(items.length >= 1);
  assert.equal(items[0].anchor, 'global:ref/shared-rules');
  assert.equal(items[0].kind, 'decision');

  globalStore.close();
  rmSync(tmpDir, { recursive: true });
});
```

**Step 2: Run test — expect FAIL** (indexDir not implemented)

**Step 3: Implement `indexDir` helper**

```typescript
private indexDir(dirPath: string, kind: EvidenceKind, anchorPrefix: string): EvidenceItem[] {
  if (!existsSync(dirPath)) return [];
  const items: EvidenceItem[] = [];
  for (const file of readdirSync(dirPath)) {
    if (!file.endsWith('.md')) continue;
    const content = readFileSync(join(dirPath, file), 'utf-8');
    const fm = parseFrontmatter(content);
    const stem = file.replace(/\.md$/, '');
    const title = fm?.name ?? extractTitle(content) ?? stem;
    items.push({
      anchor: `${anchorPrefix}/${stem}`,
      kind,
      status: 'active',
      title,
      summary: fm?.description ?? content.slice(0, 300),
      updatedAt: new Date().toISOString(),
    });
  }
  return items;
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

---

## Task 3: AC-F4-2 — GlobalIndexBuilder discovers + indexes Memory entries

**Files:**
- Modify: `packages/api/src/domains/memory/GlobalIndexBuilder.ts` (discoverMemories)
- Test: `packages/api/test/memory/global-index-builder.test.js`

**Step 1: Write failing test**

```javascript
it('indexes MEMORY.md entries from all projects (AC-F4-2)', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'projects-'));
  const projDir = join(tmpDir, '-Users-test-projects-cat-cafe', 'memory');
  mkdirSync(projDir, { recursive: true });
  writeFileSync(join(projDir, 'MEMORY.md'), '# Index\n- [redis](redis-pitfalls.md)');
  writeFileSync(join(projDir, 'redis-pitfalls.md'), `---
name: Redis 踩坑记录
description: ioredis keyPrefix 行为差异
type: reference
---

## ioredis keyPrefix 行为速查表
keyPrefix 在 eval 里自动加，在 keys() 里不加。`);

  const globalStore = new SqliteEvidenceStore(':memory:');
  globalStore.initialize();

  const builder = new GlobalIndexBuilder({
    skillsRoot: '/nonexistent',
    memoryRoot: tmpDir,
    globalStore,
  });

  builder.rebuild();
  const items = globalStore.search('ioredis keyPrefix');
  assert.ok(items.length >= 1);
  assert.match(items[0].anchor, /global:memory\//);
  assert.equal(items[0].kind, 'lesson');

  globalStore.close();
  rmSync(tmpDir, { recursive: true });
});
```

**Step 2: Run test — expect FAIL** (discoverMemories returns [])

**Step 3: Implement `discoverMemories()`**

```typescript
private static readonly MEMORY_KIND_MAP: Record<string, EvidenceKind> = {
  feedback: 'lesson',
  project: 'plan',
  reference: 'plan',
  user: 'lesson',
};

private discoverMemories(): EvidenceItem[] {
  if (!existsSync(this.memoryRoot)) return [];
  const items: EvidenceItem[] = [];

  // Scan ~/.claude/projects/*/memory/*.md
  for (const projEntry of readdirSync(this.memoryRoot, { withFileTypes: true })) {
    if (!projEntry.isDirectory()) continue;
    const memDir = join(this.memoryRoot, projEntry.name, 'memory');
    if (!existsSync(memDir)) continue;

    // Extract project slug from dir name (e.g. "-Users-test-projects-cat-cafe" → "cat-cafe")
    const slug = projEntry.name.split('-').pop() ?? projEntry.name;

    for (const file of readdirSync(memDir)) {
      if (!file.endsWith('.md') || file === 'MEMORY.md') continue;
      const content = readFileSync(join(memDir, file), 'utf-8');
      const fm = parseFrontmatter(content);
      const stem = file.replace(/\.md$/, '');
      const memType = fm?.type ?? 'reference';
      const kind = GlobalIndexBuilder.MEMORY_KIND_MAP[memType] ?? 'lesson';

      items.push({
        anchor: `global:memory/${slug}/${stem}`,
        kind,
        status: 'active',
        title: fm?.name ?? extractTitle(content) ?? stem,
        summary: fm?.description ?? content.slice(0, 300),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return items;
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

---

## Task 4: AC-F4-3 + AC-F4-4 — Factory wiring + route upgrade

**Files:**
- Modify: `packages/api/src/domains/memory/factory.ts:57-127` (create global store + wire)
- Modify: `packages/api/src/routes/evidence.ts:49-55,68-90` (use knowledgeResolver)
- Test: `packages/api/test/memory/global-index-builder.test.js` (integration test)

**Step 1: Write failing integration test**

```javascript
it('KnowledgeResolver merges project + global results via factory wiring (AC-F4-4)', async () => {
  // Project store with a project-specific item
  const projectStore = new SqliteEvidenceStore(':memory:');
  await projectStore.initialize();
  await projectStore.upsert([{
    anchor: 'F042',
    kind: 'feature',
    status: 'active',
    title: 'Prompt Engineering Audit',
    summary: 'Three-layer information architecture',
    updatedAt: '2026-03-31',
  }]);

  // Global store with a global item
  const globalStore = new SqliteEvidenceStore(':memory:');
  await globalStore.initialize();
  await globalStore.upsert([{
    anchor: 'global:memory/cat-cafe/redis-pitfalls',
    kind: 'lesson',
    status: 'active',
    title: 'Redis 踩坑记录',
    summary: 'ioredis keyPrefix 在 eval 里自动加',
    updatedAt: '2026-03-31',
  }]);

  const { KnowledgeResolver } = await import('../../dist/domains/memory/KnowledgeResolver.js');
  const resolver = new KnowledgeResolver({ projectStore, globalStore });
  const result = await resolver.resolve('Redis keyPrefix');

  // Should find the global item via federation
  assert.ok(result.results.length >= 1);
  assert.deepEqual(result.sources, ['project', 'global']);
  const anchors = result.results.map(r => r.anchor);
  assert.ok(anchors.includes('global:memory/cat-cafe/redis-pitfalls'));

  projectStore.close();
  globalStore.close();
});
```

**Step 2: Run test — expect PASS** (KnowledgeResolver already works with globalStore)

This test validates the existing KnowledgeResolver wiring. The real work is in factory + route:

**Step 3: Update factory.ts**

Add to `MemoryConfig`:
```typescript
/** Phase F-4: path to global knowledge SQLite */
globalDbPath?: string;
```

In `createMemoryServices()`, after project store init:
```typescript
// F-4: Global knowledge store (optional — graceful if missing)
let globalStore: SqliteEvidenceStore | undefined;
try {
  const globalPath = config.globalDbPath
    ?? join(homedir(), '.cat-cafe', 'global_knowledge.sqlite');
  // Ensure parent dir exists
  mkdirSync(dirname(globalPath), { recursive: true });
  globalStore = new SqliteEvidenceStore(globalPath);
  await globalStore.initialize();
} catch {
  // fail-open: no global knowledge → project-only search
}

const knowledgeResolver = new KnowledgeResolver({
  projectStore: store,
  globalStore,
});
```

**Step 4: Update evidence.ts route**

Add to `EvidenceRoutesOptions`:
```typescript
knowledgeResolver?: IKnowledgeResolver;
```

In search handler, use resolver when available:
```typescript
const searchFn = opts.knowledgeResolver
  ? async (q: string, o: SearchOptions) => {
      const kr = await opts.knowledgeResolver!.resolve(q, o);
      return kr.results;
    }
  : async (q: string, o: SearchOptions) => opts.evidenceStore.search(q, o);

const items = await searchFn(q, { limit: effectiveLimit, scope, mode, depth, dateFrom, dateTo, contextWindow });
```

**Step 5: Wire in index.ts**

```typescript
await app.register(evidenceRoutes, {
  evidenceStore: memoryServices.evidenceStore,
  indexBuilder: memoryServices.indexBuilder,
  knowledgeResolver: memoryServices.knowledgeResolver,  // NEW
});
```

**Step 6: Run test — expect PASS**

**Step 7: Commit**

---

## Task 5: AC-F4-3 — Global rebuild on startup

**Files:**
- Modify: `packages/api/src/domains/memory/factory.ts` (return globalIndexBuilder)
- Modify: `packages/api/src/index.ts` (run global rebuild after project rebuild)
- Test: `packages/api/test/memory/global-index-builder.test.js`

**Step 1: Write failing test**

```javascript
it('rebuild is idempotent — second run same result (AC-F4-3)', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'skills-'));
  mkdirSync(join(tmpDir, 'debugging'));
  writeFileSync(join(tmpDir, 'debugging', 'SKILL.md'), `---
name: debugging
description: Bug diagnosis workflow
---
# Debugging Skill`);

  const globalStore = new SqliteEvidenceStore(':memory:');
  globalStore.initialize();

  const builder = new GlobalIndexBuilder({
    skillsRoot: tmpDir,
    memoryRoot: '/nonexistent',
    globalStore,
  });

  const r1 = builder.rebuild();
  const r2 = builder.rebuild();
  assert.equal(r1.docsIndexed, r2.docsIndexed);

  // Search still works after double rebuild
  const items = globalStore.search('debugging');
  assert.ok(items.length >= 1);

  globalStore.close();
  rmSync(tmpDir, { recursive: true });
});
```

**Step 2: Run test — expect PASS** (rebuild upserts are idempotent by anchor)

**Step 3: Add globalIndexBuilder to MemoryServices + startup**

In factory.ts, add to return:
```typescript
globalIndexBuilder?: GlobalIndexBuilder;
globalStore?: SqliteEvidenceStore;
```

In index.ts startup, after project rebuild:
```typescript
if (memoryServices.globalIndexBuilder) {
  const gResult = memoryServices.globalIndexBuilder.rebuild();
  app.log.info(`global knowledge rebuilt — ${gResult.docsIndexed} indexed (${gResult.durationMs}ms)`);
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

---

## Task 6: AC-F4-5 — Graceful degradation test

**Files:**
- Test: `packages/api/test/memory/global-index-builder.test.js`

**Step 1: Write test**

```javascript
it('missing skills/memory dirs degrade gracefully (AC-F4-5)', () => {
  const globalStore = new SqliteEvidenceStore(':memory:');
  globalStore.initialize();

  const builder = new GlobalIndexBuilder({
    skillsRoot: '/nonexistent/skills',
    memoryRoot: '/nonexistent/projects',
    globalStore,
  });

  const result = builder.rebuild();
  assert.equal(result.docsIndexed, 0);
  assert.equal(result.docsSkipped, 0);

  globalStore.close();
});
```

**Step 2: Run test — expect PASS** (discoverSkills/discoverMemories check existsSync)

**Step 3: Commit**

---

## Summary

| Task | AC | Files changed | Scope |
|------|----|---------------|-------|
| 1 | F4-1 | GlobalIndexBuilder (new) + test | Skills SKILL.md indexing |
| 2 | F4-1b | GlobalIndexBuilder + test | refs/*.md indexing |
| 3 | F4-2 | GlobalIndexBuilder + test | MEMORY.md entries indexing |
| 4 | F4-3/F4-4 | factory.ts + evidence.ts + index.ts + test | Wiring: global store + KnowledgeResolver in route |
| 5 | F4-3 | factory.ts + index.ts + test | Startup rebuild + idempotency |
| 6 | F4-5 | test | Graceful degradation |

Total: 1 new file (`GlobalIndexBuilder.ts`, ~120 lines) + 3 modified files + 1 test file.
