---
feature_ids: [F102]
topics: [memory, indexing, sop-integration, eval, route-di]
doc_kind: plan
created: 2026-03-12
---

# F102 Phase B: 自动索引 + SOP 集成 + 评测

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** 让 search_evidence MCP 工具从 SQLite 检索项目知识，比 grep docs/ 信噪比可测量提升
**Acceptance Criteria:**
- AC-A4: 路由 DI 注入（从 Phase A 延续）
- AC-A9: KnowledgeResolver 全局 RRF 融合（从 Phase A 延续）
- AC-B1: frontmatter 解析器增强（anchor: 字段 + lesson 支持）
- AC-B2: 索引覆盖 features/decisions/plans/lessons
- AC-B3: feat-lifecycle 立项/关闭时自动 upsert
- AC-B4: search 支持 kind/status/keyword 过滤 + superseded_by 降权
- AC-B5: 比 grep docs/ 信噪比可测量提升
- AC-B6: 新项目初始化时自动创建空 evidence.sqlite
- AC-B7: memory_eval_corpus.yaml 评测集
**Architecture:** 在 Phase A 的 6 接口 + SQLite FTS5 基座上，补全索引覆盖、路由 DI 解耦、评测闭环
**Tech Stack:** better-sqlite3, FTS5, node:test, Fastify plugin DI
**前端验证:** No — 纯后端

---

## Straight-Line Check

**B (finish line):** `search_evidence` 和 `reflect` MCP 回调走 SQLite 路径，索引覆盖 4 类文档，eval corpus 验证 Recall@5 ≥ 80%。

**NOT building:**
- Phase C 向量增强
- Session digest 索引（数据源尚未稳定）
- 全局 `global_knowledge.sqlite` 的 _编译_ 流程（Phase B 只做 RRF 接口预留，全局编译是 F100 scope）
- Hindsight 完全移除（保留 legacy adapter 作为 fallback）

---

## Task 1: extractAnchor 增强 + lessons 目录

**Phase A 遗留**：extractAnchor() 不认 `anchor:` 字段；KIND_DIRS 缺 lessons。
**Canonical anchor normalization**：GPT-5.4 Phase B checkpoint — normalize + NOCASE 在此处实现。

**Files:**
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts`
- Test: `packages/api/test/memory/index-builder.test.js`

**Step 1: Write failing tests — anchor: field + lessons discovery**

```javascript
// Test: extractAnchor recognizes anchor: field from materialized files
test('parseFile recognizes anchor: field in frontmatter', async () => {
  // Create a lesson file with anchor: frontmatter (MaterializationService output format)
  writeFileSync(join(lessonsDir, 'lesson-marker1.md'), [
    '---', 'anchor: lesson-marker1', 'doc_kind: lesson', '---', '', '# Lesson content'
  ].join('\n'));
  const result = await builder.rebuild();
  assert.ok(result.docsIndexed >= 1);
  const item = await store.getByAnchor('lesson-marker1');
  assert.ok(item);
  assert.equal(item.kind, 'lesson');
});

// Test: lessons directory is discovered
test('discoverFiles scans lessons directory', async () => {
  writeFileSync(join(lessonsDir, 'LL-001.md'), [
    '---', 'anchor: LL-001', 'doc_kind: lesson', '---', '', '# Lesson'
  ].join('\n'));
  const result = await builder.rebuild();
  const item = await store.getByAnchor('LL-001');
  assert.ok(item);
});

// Test: canonical anchor normalization (case-insensitive)
test('anchor lookup is case-insensitive', async () => {
  writeFileSync(join(featuresDir, 'F042.md'), [
    '---', 'feature_ids: [F042]', '---', '', '# Feature'
  ].join('\n'));
  await builder.rebuild();
  const lower = await store.getByAnchor('f042');
  const upper = await store.getByAnchor('F042');
  assert.ok(upper);
  assert.ok(lower); // Should find same doc via NOCASE
});
```

**Step 2: Run tests — verify RED**

**Step 3: Implement**

```typescript
// IndexBuilder.ts — add to KIND_DIRS:
const KIND_DIRS: Record<string, EvidenceKind> = {
  features: 'feature',
  decisions: 'decision',
  plans: 'plan',
  lessons: 'lesson',  // NEW
};

// extractAnchor — add anchor: field as first priority:
function extractAnchor(fm: Record<string, unknown>): string | null {
  // Direct anchor field (from MaterializationService or explicit)
  const anchor = fm['anchor'];
  if (typeof anchor === 'string') return anchor;
  // ... existing feature_ids/decision_id/plan_id logic
}
```

For NOCASE: modify `SqliteEvidenceStore` — evidence_docs anchor column uses `COLLATE NOCASE`, and `getByAnchor` query uses case-insensitive match.

```sql
-- schema.ts: change anchor column
anchor TEXT PRIMARY KEY COLLATE NOCASE
```

**Step 4: Run tests — verify GREEN**

**Step 5: Commit** — `feat(F102): extractAnchor anchor: field + lessons dir + NOCASE`

---

## Task 2: Route DI 注入 — evidence.ts

**AC-A4 闭合（1/3）**: evidence.ts 从 `IHindsightClient` → `IEvidenceStore` + `IReflectionService`。

**Files:**
- Modify: `packages/api/src/routes/evidence.ts` (163 lines)
- Modify: `packages/api/test/evidence-route.test.js`
- Modify: `packages/api/src/index.ts` (route registration)

**Step 1: Write failing test — evidence route accepts IEvidenceStore**

```javascript
// New test: evidence route uses IEvidenceStore.search() instead of hindsightClient.recall()
test('search delegates to IEvidenceStore', async () => {
  const mockStore = {
    search: async (q, opts) => [{
      anchor: 'F042', kind: 'feature', status: 'active',
      title: 'Test', updatedAt: new Date().toISOString(),
    }],
    health: async () => true,
    // ... other IEvidenceStore methods
  };
  app = Fastify();
  await app.register(evidenceRoutes, { evidenceStore: mockStore, docsRoot: tmpDir });
  await app.ready();
  const res = await app.inject({ method: 'GET', url: '/api/evidence/search?q=F042' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(body.results.length > 0);
});
```

**Step 2: Run — verify RED**

**Step 3: Implement — change EvidenceRoutesOptions**

```typescript
export interface EvidenceRoutesOptions {
  evidenceStore: IEvidenceStore;        // NEW: replaces hindsightClient
  docsRoot?: string;
  freshnessProvider?: () => Promise<EvidenceFreshness>;
  reimportTriggerProvider?: (freshness: EvidenceFreshness) => Promise<EvidenceReimportTrigger>;
}
```

Route handler: replace `hindsightClient.recall()` → `opts.evidenceStore.search()`.
Map `EvidenceItem` → existing `EvidenceResult` response format.

**Step 4: Run — verify GREEN (new + existing tests)**

**Step 5: Commit** — `refactor(F102): evidence route DI — IEvidenceStore replaces HindsightClient`

---

## Task 3: Route DI 注入 — reflect.ts + callback-memory-routes.ts

**AC-A4 闭合（2/3, 3/3）**: Same pattern as Task 2.

**Files:**
- Modify: `packages/api/src/routes/reflect.ts` (93 lines)
- Modify: `packages/api/src/routes/callback-memory-routes.ts` (211 lines)
- Modify: `packages/api/src/index.ts` (wiring)
- Test: existing route tests + new DI tests

**Step 1: Write failing tests**

```javascript
// reflect.ts: accepts IReflectionService
test('reflect delegates to IReflectionService', async () => {
  const mockReflection = { reflect: async (q) => 'reflection result' };
  // ... register with new options, verify delegation
});

// callback-memory-routes.ts: search-evidence → IEvidenceStore
// callback-memory-routes.ts: reflect → IReflectionService
// callback-memory-routes.ts: retain-memory → IMarkerQueue.submit()
test('retain-memory writes to MarkerQueue instead of hindsight', async () => {
  const submitted = [];
  const mockQueue = { submit: async (m) => { submitted.push(m); return { ...m, id: 'test-1' }; } };
  // ... verify marker is submitted, not hindsight.retain()
});
```

**Step 2: Run — verify RED**

**Step 3: Implement**

- `reflect.ts`: `ReflectRoutesOptions.reflectionService: IReflectionService` replaces `hindsightClient`
- `callback-memory-routes.ts`:
  - `search-evidence` → `evidenceStore.search()`
  - `reflect` → `reflectionService.reflect()`
  - `retain-memory` → `markerQueue.submit()` (marker status: `captured`)
- `index.ts`: pass `MemoryServices` from factory to route registration

**Step 4: Run — verify GREEN**

**Step 5: Commit** — `refactor(F102): reflect + callback routes DI — complete AC-A4`

---

## Task 4: KnowledgeResolver RRF 融合

**AC-A9 闭合**: 当前 KnowledgeResolver 只查项目库。增加全局 store fan-out + RRF rank fusion。

**Files:**
- Modify: `packages/api/src/domains/memory/KnowledgeResolver.ts`
- Modify: `packages/api/src/domains/memory/factory.ts`
- Test: `packages/api/test/memory/knowledge-resolver.test.js`

**Step 1: Write failing tests**

```javascript
// Test: resolver merges results from project + global stores
test('resolve combines project and global results with RRF', async () => {
  const projectStore = createMockStore([
    { anchor: 'F042', kind: 'feature', title: 'Project Feature' },
  ]);
  const globalStore = createMockStore([
    { anchor: 'RULE-001', kind: 'lesson', title: 'Global Rule' },
  ]);
  const resolver = new KnowledgeResolver(projectStore, globalStore);
  const result = await resolver.resolve('architecture');
  assert.equal(result.items.length, 2);
  // RRF: items from both sources present
});

// Test: resolver works with project-only (no global)
test('resolve works without global store', async () => {
  const resolver = new KnowledgeResolver(projectStore);
  const result = await resolver.resolve('test');
  assert.ok(result.items.length > 0);
});
```

**Step 2: Run — verify RED**

**Step 3: Implement RRF**

```typescript
export class KnowledgeResolver implements IKnowledgeResolver {
  constructor(
    private readonly projectStore: IEvidenceStore,
    private readonly globalStore?: IEvidenceStore,
  ) {}

  async resolve(query: string, options?: SearchOptions): Promise<KnowledgeResult> {
    const projectResults = await this.projectStore.search(query, options);
    if (!this.globalStore) {
      return { items: projectResults, sources: ['project'] };
    }
    const globalResults = await this.globalStore.search(query, options);
    const merged = rrfMerge(projectResults, globalResults);
    return { items: merged, sources: ['project', 'global'] };
  }
}

// Reciprocal Rank Fusion: score = sum(1 / (k + rank_i))
function rrfMerge(listA: EvidenceItem[], listB: EvidenceItem[], k = 60): EvidenceItem[] {
  const scores = new Map<string, { item: EvidenceItem; score: number }>();
  for (const [i, item] of listA.entries()) {
    scores.set(item.anchor, { item, score: 1 / (k + i + 1) });
  }
  for (const [i, item] of listB.entries()) {
    const existing = scores.get(item.anchor);
    if (existing) {
      existing.score += 1 / (k + i + 1);
    } else {
      scores.set(item.anchor, { item, score: 1 / (k + i + 1) });
    }
  }
  return [...scores.values()].sort((a, b) => b.score - a.score).map((e) => e.item);
}
```

**Step 4: Run — verify GREEN**

**Step 5: Commit** — `feat(F102): KnowledgeResolver RRF fusion — AC-A9 closed`

---

## Task 5: search() keyword 过滤 + superseded_by 降权增强

**AC-B4**: search 已支持 kind/status 过滤。补全 keyword 过滤；superseded_by 降权已在 ORDER BY 实现，需验证。

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- Test: `packages/api/test/memory/sqlite-evidence-store.test.js`

**Step 1: Write failing tests**

```javascript
test('search filters by keywords', async () => {
  await store.upsert([
    { anchor: 'F001', kind: 'feature', keywords: ['auth', 'security'], ... },
    { anchor: 'F002', kind: 'feature', keywords: ['ui', 'design'], ... },
  ]);
  const results = await store.search('feature', { keywords: ['auth'] });
  assert.equal(results.length, 1);
  assert.equal(results[0].anchor, 'F001');
});

test('superseded items sort last', async () => {
  await store.upsert([
    { anchor: 'ADR-001', kind: 'decision', supersededBy: 'ADR-002', ... },
    { anchor: 'ADR-002', kind: 'decision', ... },
  ]);
  const results = await store.search('decision');
  assert.equal(results[0].anchor, 'ADR-002'); // Non-superseded first
});
```

**Step 2: Run — verify RED for keyword filter**

**Step 3: Implement keyword filter**

```typescript
// In search(): after kind/status filters, add keyword filter
if (options?.keywords?.length) {
  // keywords stored as JSON array in evidence_docs
  // Filter in application layer after FTS5 retrieval (JSON matching in SQLite is limited)
  results = results.filter(item =>
    item.keywords?.some(k => options.keywords!.includes(k))
  );
}
```

**Step 4: Run — verify GREEN**

**Step 5: Commit** — `feat(F102): search keyword filter + superseded_by sort verification`

---

## Task 6: feat-lifecycle SOP 集成

**AC-B3**: feat-lifecycle 立项/关闭时自动 upsert 索引。

这是 skill 层面的集成，不是 packages/api 内的代码。feat-lifecycle skill 在创建/关闭 feature 时调用 IndexBuilder。

**Files:**
- Modify: `cat-cafe-skills/feat-lifecycle/SKILL.md` (添加 indexBuilder 调用指令)
- Test: 手动验证 — 创建 test feature → 检查 evidence.sqlite 是否有记录

**Step 1: 在 SKILL.md 中添加索引触发步骤**

在 feat-lifecycle skill 的「立项」和「关闭」步骤中添加：

```markdown
## 索引更新（每次立项/关闭后自动执行）

立项后 / 关闭后，运行：
\`\`\`bash
node -e "
  const { createMemoryServices } = require('@cat-cafe/api/domains/memory');
  const svc = createMemoryServices({ type: 'sqlite', sqlitePath: 'evidence.sqlite', docsRoot: 'docs' });
  svc.indexBuilder.incrementalUpdate(['docs/features/F{id}.md']).then(() => console.log('indexed'));
"
\`\`\`
```

**注意**：由于 skill 是文本指令而非可执行代码，实际集成需要在 API 启动时注册 file watcher 或 hook。Phase B 先实现 CLI 手动触发入口（`pnpm --filter @cat-cafe/api index:rebuild`），SOP 步骤引用这个命令。

**Step 2: 创建 CLI 入口**

```typescript
// packages/api/src/cli/rebuild-index.ts
import { createMemoryServices } from '../domains/memory/index.js';

const services = createMemoryServices({
  type: 'sqlite',
  sqlitePath: process.env['EVIDENCE_DB'] ?? 'evidence.sqlite',
  docsRoot: process.env['DOCS_ROOT'] ?? 'docs',
});
const result = await services.indexBuilder!.rebuild();
console.log(`Indexed: ${result.docsIndexed}, Skipped: ${result.docsSkipped}, Duration: ${result.durationMs}ms`);
await services.evidenceStore.close?.();
```

**Step 3: 在 package.json 添加 script**

```json
"index:rebuild": "tsx src/cli/rebuild-index.ts"
```

**Step 4: Commit** — `feat(F102): CLI rebuild-index + feat-lifecycle SOP integration`

---

## Task 7: 新项目初始化

**AC-B6**: 新项目初始化时自动创建空 evidence.sqlite。

**Files:**
- Modify: `packages/api/src/domains/memory/factory.ts`
- Test: `packages/api/test/memory/factory.test.js`

**Step 1: Write failing test**

```javascript
test('createMemoryServices creates sqlite file if not exists', () => {
  const dbPath = join(tmpDir, 'new-project', 'evidence.sqlite');
  assert.ok(!existsSync(dbPath));
  const services = createMemoryServices({ type: 'sqlite', sqlitePath: dbPath, docsRoot: tmpDir });
  assert.ok(existsSync(dbPath)); // Auto-created
  services.evidenceStore.close();
});
```

**Step 2: Run — verify behavior (may already work since SqliteEvidenceStore.initialize() creates the DB)**

If already passing → document as already-met AC. If not → ensure `mkdirSync(dirname(dbPath), { recursive: true })` before DB open.

**Step 3: Commit** — `test(F102): verify AC-B6 auto-create evidence.sqlite`

---

## Task 8: 评测集 memory_eval_corpus.yaml

**AC-B7**: 检索评测（Recall@k）+ 状态评测（DB 变化验证），含 10-15 条 Hindsight 失败案例。

**Files:**
- Create: `packages/api/test/memory/memory_eval_corpus.yaml`
- Create: `packages/api/test/memory/eval-runner.test.js`

**Step 1: Write eval corpus (YAML)**

```yaml
# F102 Memory Eval Corpus
# Tests: Recall@5 on real project queries that Hindsight failed on

queries:
  # --- Hindsight failure cases (from historical experience) ---
  - id: HF-01
    query: "Redis 6399 safety"
    expected_anchors: [F088, ADR-005]
    expected_kind: [feature, decision]
    note: "Hindsight returned unrelated session fragments"

  - id: HF-02
    query: "marker approval workflow"
    expected_anchors: [F102]
    note: "Hindsight couldn't find our own spec"

  # ... 10-15 more cases based on real Hindsight failures

  # --- Precision cases ---
  - id: P-01
    query: "F042"
    expected_anchors: [F042]
    must_not_return: [archive/*, mailbox/*]
    note: "Must not return archived/mailbox copies"

  # --- Superseded cases ---
  - id: S-01
    query: "hindsight integration"
    expected_first: ADR-005  # Active version
    expected_deprioritized: [ADR-003]  # Superseded version
```

**Step 2: Write eval runner**

```javascript
// eval-runner.test.js — runs eval corpus against real IndexBuilder + SqliteEvidenceStore
test('eval corpus: Recall@5 >= 80%', async () => {
  // 1. Build index from real docs/
  // 2. For each query in corpus: search(query, {limit: 5})
  // 3. Check: expected_anchors ∈ results → hit
  // 4. Recall@5 = hits / total_expected
  // 5. Assert >= 0.80
});
```

**Step 3: Run eval — baseline measurement**

**Step 4: Commit** — `test(F102): memory eval corpus + runner — AC-B7`

---

## Task 9: AC-B5 信噪比验证 + 全量集成测试

**AC-B5**: 比 grep docs/ 信噪比可测量提升。

**Files:**
- Create: `packages/api/test/memory/signal-noise-comparison.test.js`

**Step 1: Write comparison test**

```javascript
test('SQLite search has better signal-to-noise than grep', async () => {
  // 1. Query: "session chain architecture"
  // 2. grep docs/ approach: count results including archive/mailbox/discussion
  // 3. SQLite approach: search() with kind filter
  // 4. Assert: SQLite returns fewer, more relevant results
  // 5. Specifically: no archive/* or mailbox/* in SQLite results
});
```

**Step 2: Run — verify GREEN**

**Step 3: Commit** — `test(F102): signal-noise comparison — AC-B5 verified`

---

## Task Dependency Graph

```
Task 1 (extractAnchor + lessons)
  ↓
Task 2 (evidence.ts DI) ──→ Task 3 (reflect + callback DI)
  ↓                              ↓
Task 4 (KnowledgeResolver RRF)   │
  ↓                              ↓
Task 5 (keyword filter)      Task 6 (SOP integration + CLI)
  ↓                              ↓
Task 7 (new project init)    Task 8 (eval corpus)
  ↓                              ↓
  └──────── Task 9 (integration + signal-noise) ────────┘
```

**Parallelizable pairs:**
- Task 2 + Task 4（不同文件）
- Task 6 + Task 8（不同领域）

**Critical path:** Task 1 → Task 2 → Task 3 → Task 9

---

## Phase B Checkpoints (from Phase A review)

| Checkpoint | Task | Source |
|-----------|------|--------|
| Canonical anchor normalization (NOCASE) | Task 1 | GPT-5.4 Phase B follow-up |
| extractAnchor recognizes `anchor:` field | Task 1 | Cloud codex review P1→P3 |
| lessons directory in KIND_DIRS | Task 1 | Cloud codex review P1→P3 |
| MaterializationService frontmatter compat | Task 1 | Cloud codex review P1→P3 |
| Route DI complete (AC-A4) | Task 2+3 | Phase A 未闭合 |
| Global RRF fusion (AC-A9) | Task 4 | Phase A 未闭合 |
| P3: FTS5 catch block debug logging | Task 5 | codex review suggestion |
