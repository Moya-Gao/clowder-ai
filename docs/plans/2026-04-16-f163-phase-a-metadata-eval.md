---
feature_ids: [F163]
related_features: [F102, F152]
topics: [memory, entropy, knowledge-lifecycle, experiment-framework]
doc_kind: plan
created: 2026-04-16
---

# F163 Phase A: 多轴元数据 + 评测基础设施 Implementation Plan

**Feature:** F163 — `docs/features/F163-memory-entropy-reduction.md`
**Goal:** 让每条知识都有 authority/activation/status 元数据、实验框架可开关可度量、search_evidence 带归因字段
**Acceptance Criteria:**
- AC-A1: 50-100 query gold set 建立，baseline NDCG@10 和 MRR 记录在案
- AC-A2: `search_evidence` 支持多轴元数据（authority / activation / status），文档可标记
- AC-A3: `always_on` 文档走物理注入路径，不走检索管道；`always_on` 仅限 constitutional + 当前任务约束
- AC-A4: `query` 文档支持窄幅 post-retrieval boost，NDCG@10 对比实验通过（优于 baseline）
- AC-A5: 现有 shared-rules 铁律、P0 LL 已标记为 `authority=constitutional`
- AC-A6: 知识晋升路径（observed → candidate → validated → constitutional）可操作
- AC-A7: `search_evidence` 返回结果携带 `boostSource` 归因字段
**Architecture:** Schema migration adds 3 metadata columns + 3 experiment tables. Feature flags via env-registry. Write queue wraps SqliteEvidenceStore. Post-retrieval boost applied after existing BM25/hybrid ranking.
**Tech Stack:** better-sqlite3, env-registry.ts, zod
**前端验证:** No — 纯后端

**Design Gate:** `docs/discussions/2026-04-16-f163-design/README.md`（4 个 API 契约全部收口）

---

## Terminal Schema

### evidence_docs 新增列

```sql
ALTER TABLE evidence_docs ADD COLUMN authority TEXT DEFAULT 'observed';
-- 'constitutional' | 'validated' | 'candidate' | 'observed'

ALTER TABLE evidence_docs ADD COLUMN activation TEXT DEFAULT 'query';
-- 'always_on' | 'scoped' | 'query' | 'backstop'

ALTER TABLE evidence_docs ADD COLUMN verified_at TEXT;
-- ISO8601 最后验证日期
```

### evidence_docs.status 轴扩展

现有 `EvidenceStatus = 'active' | 'done' | 'archived'`。F163 lifecycle status 需要新增 `'review'` 和 `'invalidated'`：

- `review`：猫发现过时或冲突，等待 CVO 裁决
- `invalidated`：已被确认失效（由 `contradicts[]` / `replaced_by` 驱动）

不加新列——复用现有 `status` 列，扩展枚举值。`done` 保留（feature 完成态），不与 lifecycle status 冲突。

### 新增表

```sql
-- 实验 cohort 绑定
CREATE TABLE IF NOT EXISTS f163_cohorts (
  thread_id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);

-- suggest 模式建议日志
CREATE TABLE IF NOT EXISTS f163_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capability TEXT NOT NULL,
  target_anchor TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 实验日志
CREATE TABLE IF NOT EXISTS f163_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_type TEXT NOT NULL,       -- 'search' | 'write'
  variant_id TEXT NOT NULL,
  effective_flags TEXT NOT NULL, -- JSON
  payload TEXT NOT NULL,         -- JSON (query/results/latency for search; capability/action for write)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_f163_logs_type ON f163_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_f163_logs_variant ON f163_logs(variant_id);
```

### TypeScript 接口

```typescript
// F163 authority levels
type F163Authority = 'constitutional' | 'validated' | 'candidate' | 'observed';

// F163 activation modes
type F163Activation = 'always_on' | 'scoped' | 'query' | 'backstop';

// Boost source attribution (排序相关，不含注入通道)
type BoostSource = 'authority_boost' | 'retrieval_rerank' | 'compression_summary' | 'legacy';

// Flag snapshot — frozen per request
interface F163FlagSnapshot {
  authorityBoost: 'off' | 'shadow' | 'on';
  alwaysOnInjection: 'off' | 'shadow' | 'on';
  retrievalRerank: 'off' | 'shadow' | 'on';
  compression: 'off' | 'suggest' | 'apply';
  promotionGate: 'off' | 'suggest' | 'apply';
  contradictionDetection: 'off' | 'suggest' | 'apply';
  reviewQueue: 'off' | 'suggest' | 'apply';
}
```

## What we're NOT building (Phase A boundary)

- No compression/summary generation (Phase B)
- No contradiction detection (Phase C)
- No review queue UI (Phase C)
- No `scoped` activation glob matching (OQ-5, deferred)

---

## Task 1: Schema Migration (V13) — 3 metadata columns + 3 experiment tables

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts` (add SCHEMA_V13 + migration)
- Test: `packages/api/test/evidence-route.test.js` (migration smoke)

**Step 1: Write the migration constant**

Add `SCHEMA_V13` with the 3 ALTER TABLEs + 3 CREATE TABLEs. Increment `CURRENT_SCHEMA_VERSION` to 13.

**Step 2: Add migration block in `applyMigrations()`**

```typescript
if (currentVersion < 13) {
  // F163 Phase A: multi-axis metadata + experiment infrastructure
  try { db.exec("ALTER TABLE evidence_docs ADD COLUMN authority TEXT DEFAULT 'observed'"); } catch { /* column exists */ }
  try { db.exec("ALTER TABLE evidence_docs ADD COLUMN activation TEXT DEFAULT 'query'"); } catch { /* column exists */ }
  try { db.exec('ALTER TABLE evidence_docs ADD COLUMN verified_at TEXT'); } catch { /* column exists */ }
  db.exec(SCHEMA_V13);
  db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(13, new Date().toISOString());
}
```

**Step 3: Run existing tests to verify migration doesn't break**

Run: `pnpm --filter @cat-cafe/api test -- --grep evidence`
Expected: All existing tests pass (migration is additive, no breaking changes)

**Step 4: Commit**

```
feat(F163): schema V13 — multi-axis metadata + experiment tables [布偶猫🐾]
```

---

## Task 2: F163 Types + Flag Snapshot

**Files:**
- Create: `packages/api/src/domains/memory/f163-types.ts`
- Modify: `packages/api/src/domains/memory/interfaces.ts` (add authority/activation to EvidenceItem)
- Test: inline type checks (compile-time)

**Step 1: Create f163-types.ts**

```typescript
// F163: Knowledge lifecycle types + experiment framework types

export type F163Authority = 'constitutional' | 'validated' | 'candidate' | 'observed';
export type F163Activation = 'always_on' | 'scoped' | 'query' | 'backstop';
export type BoostSource = 'authority_boost' | 'retrieval_rerank' | 'compression_summary' | 'legacy';

export interface F163FlagSnapshot {
  authorityBoost: 'off' | 'shadow' | 'on';
  alwaysOnInjection: 'off' | 'shadow' | 'on';
  retrievalRerank: 'off' | 'shadow' | 'on';
  compression: 'off' | 'suggest' | 'apply';
  promotionGate: 'off' | 'suggest' | 'apply';
  contradictionDetection: 'off' | 'suggest' | 'apply';
  reviewQueue: 'off' | 'suggest' | 'apply';
}

export function freezeFlags(): F163FlagSnapshot {
  return Object.freeze({
    authorityBoost: (process.env.F163_AUTHORITY_BOOST as 'off' | 'shadow' | 'on') ?? 'off',
    alwaysOnInjection: (process.env.F163_ALWAYS_ON_INJECTION as 'off' | 'shadow' | 'on') ?? 'off',
    retrievalRerank: (process.env.F163_RETRIEVAL_RERANK as 'off' | 'shadow' | 'on') ?? 'off',
    compression: (process.env.F163_COMPRESSION as 'off' | 'suggest' | 'apply') ?? 'off',
    promotionGate: (process.env.F163_PROMOTION_GATE as 'off' | 'suggest' | 'apply') ?? 'off',
    contradictionDetection: (process.env.F163_CONTRADICTION_DETECTION as 'off' | 'suggest' | 'apply') ?? 'off',
    reviewQueue: (process.env.F163_REVIEW_QUEUE as 'off' | 'suggest' | 'apply') ?? 'off',
  });
}

import { createHash } from 'node:crypto';

export function computeVariantId(flags: F163FlagSnapshot): string {
  const sorted = Object.entries(flags).sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 12);
}
```

**Step 2: Add authority/activation/verifiedAt to EvidenceItem + extend EvidenceStatus**

In `interfaces.ts`, add to EvidenceItem:
```typescript
/** F163 Phase A: knowledge authority level */
authority?: F163Authority;
/** F163 Phase A: knowledge activation mode */
activation?: F163Activation;
/** F163 Phase A: last verification date (ISO8601) */
verifiedAt?: string;
```

Extend EvidenceStatus to include F163 lifecycle states:
```typescript
export type EvidenceStatus = 'active' | 'done' | 'archived' | 'review' | 'invalidated';
```

Update `CatCafeScanner.ts` 中对 status 的硬编码映射（如有）以兼容新值。

**Step 3: Verify type compilation**

Run: `pnpm lint`
Expected: No type errors

**Step 4: Commit**

```
feat(F163): types + flag snapshot + variant_id [布偶猫🐾]
```

---

## Task 3: Register F163 Feature Flags in env-registry

**Files:**
- Modify: `packages/api/src/config/env-registry.ts` (add 7 F163 flags)
- Test: Hub UI automatically shows new flags (manual verification)

**Step 1: Add 7 flag definitions**

After existing `F102_TOPIC_SEGMENTS` block, add:

```typescript
// --- F163 记忆熵减实验框架 ---
{ name: 'F163_AUTHORITY_BOOST',         defaultValue: 'off', description: 'F163 authority 加权 rerank (off/shadow/on)', category: 'evidence', sensitive: false, runtimeEditable: true },
{ name: 'F163_ALWAYS_ON_INJECTION',     defaultValue: 'off', description: 'F163 constitutional 物理注入 (off/shadow/on)', category: 'evidence', sensitive: false, runtimeEditable: true },
{ name: 'F163_RETRIEVAL_RERANK',        defaultValue: 'off', description: 'F163 多轴元数据 rerank (off/shadow/on)', category: 'evidence', sensitive: false, runtimeEditable: true },
{ name: 'F163_COMPRESSION',             defaultValue: 'off', description: 'F163 非替代式压缩 (off/suggest/apply)', category: 'evidence', sensitive: false, runtimeEditable: true },
{ name: 'F163_PROMOTION_GATE',          defaultValue: 'off', description: 'F163 晋升门禁 (off/suggest/apply)', category: 'evidence', sensitive: false, runtimeEditable: true },
{ name: 'F163_CONTRADICTION_DETECTION', defaultValue: 'off', description: 'F163 矛盾检测 (off/suggest/apply)', category: 'evidence', sensitive: false, runtimeEditable: true },
{ name: 'F163_REVIEW_QUEUE',            defaultValue: 'off', description: 'F163 审计 review queue (off/suggest/apply)', category: 'evidence', sensitive: false, runtimeEditable: true },
```

**Step 2: Verify compilation**

Run: `pnpm lint`
Expected: No errors

**Step 3: Commit**

```
feat(F163): register 7 feature flags in env-registry [布偶猫🐾]
```

---

## Task 4: SqliteEvidenceStore — Persist & Read metadata columns

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (upsert, rowToItem, search ORDER BY)
- Test: `packages/api/test/evidence-route.test.js` (new test for metadata round-trip)

**Step 1: Write failing test — metadata round-trip**

```typescript
test('F163: upsert persists authority/activation/verifiedAt and search returns them', async () => {
  // upsert item with authority=validated, activation=query, verifiedAt=date
  // search for it
  // assert authority, activation, verifiedAt on result
});
```

**Step 2: Run test — expect FAIL**

Run: `pnpm --filter @cat-cafe/api test -- --grep F163`
Expected: FAIL (fields not read/written yet)

**Step 3: Update upsert() to include new columns**

In `upsert()` INSERT statement, add `authority, activation, verified_at` columns and corresponding `item.authority ?? 'observed'`, `item.activation ?? 'query'`, `item.verifiedAt ?? null` values.

**Step 4: Update rowToItem() to read new columns**

Map `row.authority` → `item.authority`, `row.activation` → `item.activation`, `row.verified_at` → `item.verifiedAt`.

**Step 5: Run test — expect PASS**

Run: `pnpm --filter @cat-cafe/api test -- --grep F163`
Expected: PASS

**Step 6: Commit**

```
feat(F163): persist authority/activation/verifiedAt in evidence store [布偶猫🐾]
```

---

## Task 5: Post-retrieval authority boost (shadow-capable)

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (search method — add boost after RRF/BM25)
- Test: `packages/api/test/evidence-route.test.js` (new test for boost ordering)

**Step 1: Write failing test — authority boost reranks validated above observed**

```typescript
test('F163: authority_boost=on reranks validated items above observed at same BM25', async () => {
  // Insert two items matching same query: one observed, one validated
  // Set F163_AUTHORITY_BOOST=on
  // Search — validated should appear first
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement post-retrieval boost**

After existing search results are collected (BM25 or hybrid), if `F163_AUTHORITY_BOOST` is `'on'` or `'shadow'`:

```typescript
const AUTHORITY_WEIGHTS: Record<F163Authority, number> = {
  constitutional: 1.3,
  validated: 1.2,
  candidate: 1.1,
  observed: 1.0,
};

// Apply post-retrieval boost
if (flags.authorityBoost !== 'off') {
  const boosted = results.map(item => ({
    item,
    score: (originalScore(item)) * (AUTHORITY_WEIGHTS[item.authority ?? 'observed']),
    boosted: (item.authority ?? 'observed') !== 'observed',
  }));
  boosted.sort((a, b) => b.score - a.score);

  if (flags.authorityBoost === 'on') {
    results = boosted.map(b => b.item);
  }
  // shadow: log difference but return original order
}
```

Key: boost factors are in `1.0 ~ 1.3` range (spec constraint). The actual values will be calibrated with gold set in Task 8.

**Step 4: Track boostSource per result**

Attach `boostSource: BoostSource[]` to each result. If authority_boost affected ordering, include `'authority_boost'`. If no F163 flags active, use `['legacy']`.

**Step 5: Run test — expect PASS**

**Step 6: Commit**

```
feat(F163): post-retrieval authority boost with shadow mode [布偶猫🐾]
```

---

## Task 6: EvidenceSearchResponse — variantId + boostSource

**Files:**
- Modify: `packages/api/src/routes/evidence-helpers.ts` (add `boostSource` to EvidenceResult)
- Modify: `packages/api/src/routes/evidence.ts` (add `variantId`, `injectionSources` to response)
- Modify: `packages/mcp-server/src/tools/evidence-tools.ts` (pass through new fields)
- Test: `packages/api/test/evidence-route.test.js` (verify fields in HTTP response)

**Step 1: Write failing test — response includes variantId and boostSource**

```typescript
test('F163: /api/evidence/search response includes variantId and boostSource', async () => {
  // Call search endpoint
  // Assert response has variantId (string, 12 chars)
  // Assert each result has boostSource array with at least ['legacy']
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Add boostSource to EvidenceResult**

In `evidence-helpers.ts`:
```typescript
export interface EvidenceResult {
  // ... existing ...
  boostSource: BoostSource[];
}
```

**Step 4: Add variantId + injectionSources to EvidenceSearchResponse**

In `evidence.ts`:
```typescript
export interface EvidenceSearchResponse {
  // ... existing ...
  variantId: string;
  injectionSources?: string[];
}
```

**Step 5: Wire up in route handler**

At request entry, `freezeFlags()` → `computeVariantId()`. Pass snapshot to store search. Attach `variantId` to response. Each result gets `boostSource` from the store's boost logic.

**Step 6: Update MCP tool handler to pass through**

In `evidence-tools.ts`, include `boostSource` and `variantId` in the tool response object.

**Step 7: Run test — expect PASS**

**Step 8: Commit**

```
feat(F163): search response with variantId + boostSource attribution [布偶猫🐾]
```

---

## Task 7: Experiment logging (f163_logs)

**Files:**
- Create: `packages/api/src/domains/memory/f163-experiment-logger.ts`
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (inject logger)
- Test: new test for log recording

**Step 1: Write failing test — search logs effective_flags**

```typescript
test('F163: search logs effective_flags and variant_id', async () => {
  // Set F163_AUTHORITY_BOOST=shadow
  // Call search
  // Query f163_logs table
  // Assert log entry with log_type='search', variant_id, effective_flags JSON
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement F163ExperimentLogger**

```typescript
export class F163ExperimentLogger {
  constructor(private db: Database.Database) {}

  logSearch(variantId: string, flags: F163FlagSnapshot, payload: Record<string, unknown>): void {
    this.db.prepare(
      'INSERT INTO f163_logs (log_type, variant_id, effective_flags, payload, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('search', variantId, JSON.stringify(flags), JSON.stringify(payload), new Date().toISOString());
  }

  logWrite(variantId: string, flags: F163FlagSnapshot, payload: Record<string, unknown>): void {
    this.db.prepare(
      'INSERT INTO f163_logs (log_type, variant_id, effective_flags, payload, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('write', variantId, JSON.stringify(flags), JSON.stringify(payload), new Date().toISOString());
  }
}
```

**Step 4: Wire logger into search path**

After search completes, if any F163 flag is not `'off'`, log the search event.

**Step 5: Run test — expect PASS**

**Step 6: Commit**

```
feat(F163): experiment logger — effective_flags + variant_id per search [布偶猫🐾]
```

---

## Task 8: Gold Set + Baseline Evaluation Script

**Files:**
- Create: `packages/api/scripts/f163-eval.ts`
- Create: `packages/api/scripts/f163-gold-set.json` (initial empty, populated manually)
- Test: script runs without error on empty gold set

**Step 1: Create gold set schema**

```json
{
  "version": 1,
  "queries": [
    {
      "query": "redis pitfall",
      "relevantAnchors": ["LL-001", "LL-045"],
      "relevance": { "LL-001": 3, "LL-045": 2 },
      "shouldHitConstitutional": false
    }
  ]
}
```

**Step 2: Create eval script**

Script that:
1. Loads gold set
2. Runs each query against `search_evidence` (via direct store call, not HTTP)
3. Computes NDCG@10 and MRR
4. Outputs baseline metrics to stdout + writes to `packages/api/scripts/f163-baseline.json`

**Step 3: Populate initial gold set**

Extract 50-100 queries from real usage (search_evidence call logs / session history). Mark gold relevance manually. AC-A1 要求 50-100，不能少于 50。

**Step 4: Run eval, record baseline**

Run: `npx tsx packages/api/scripts/f163-eval.ts`
Expected: Outputs NDCG@10 and MRR baseline numbers

**Step 5: Commit**

```
feat(F163): gold set evaluation script + initial baseline [布偶猫🐾]
```

---

## Task 9: Tag existing constitutional knowledge (AC-A5)

**Files:**
- Create: `packages/api/scripts/f163-tag-constitutional.ts`
- Data: Updates `evidence_docs` rows for shared-rules, P0 LL items

**Step 1: Write tagging script**

Script that:
1. Opens evidence.sqlite
2. Finds anchors matching shared-rules (铁律) and P0 lessons-learned
3. Updates `authority='constitutional', activation='always_on'` for those rows
4. Reports what was tagged

**Step 2: Run script**

Run: `npx tsx packages/api/scripts/f163-tag-constitutional.ts`
Expected: Reports N items tagged as constitutional

**Step 3: Verify via search**

Run: `search_evidence("铁律")` → results should have `authority=constitutional`

**Step 4: Commit**

```
feat(F163): tag shared-rules + P0 LL as constitutional [布偶猫🐾]
```

---

## Task 10: Cohort Sticky Routing (thread-level)

**Files:**
- Modify: `packages/api/src/domains/memory/f163-types.ts` (add cohort functions)
- Test: new test for cohort assignment + stickiness

**Step 1: Write failing test**

```typescript
test('F163: same threadId gets same variantId across requests', async () => {
  // Search with threadId=A, flags=X → get variantId V1
  // Search with threadId=A, flags=X → get variantId V1 (same)
  // Change flags to Y, search threadId=A → still V1 (sticky)
  // Search with threadId=B, flags=Y → get variantId V2 (different)
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement cohort lookup/assign**

```typescript
export function getOrAssignCohort(db: Database.Database, threadId: string, currentVariantId: string): string {
  const existing = db.prepare('SELECT variant_id FROM f163_cohorts WHERE thread_id = ?').get(threadId);
  if (existing) return (existing as { variant_id: string }).variant_id;

  db.prepare('INSERT INTO f163_cohorts (thread_id, variant_id, assigned_at) VALUES (?, ?, ?)')
    .run(threadId, currentVariantId, new Date().toISOString());
  return currentVariantId;
}
```

**Step 4: Wire into search path**

When `threadId` is provided in search options, use `getOrAssignCohort()` to get the sticky variant.

**Step 5: Run test — expect PASS**

**Step 6: Commit**

```
feat(F163): thread-level cohort sticky routing [布偶猫🐾]
```

---

## Task 11: Kill-switch / Fail-open (read path)

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (try-catch around F163 boost)
- Test: new test for graceful degradation

**Step 1: Write failing test**

```typescript
test('F163: boost error degrades gracefully to legacy results', async () => {
  // Mock authority_boost to throw
  // Search — should return results with degraded=true, boostSource=['legacy']
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement try-catch wrapper**

Wrap the F163 boost/rerank logic in try-catch. On error:
- Return original (pre-boost) results
- Set `degraded: true, degradeReason: 'f163_read_failopen'`
- Set all `boostSource` to `['legacy']`
- Log the error to f163_logs

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```
feat(F163): read-path kill-switch — fail-open to legacy on boost error [布偶猫🐾]
```

---

## Task 12: Promotion API (AC-A6)

**Files:**
- Create: `packages/api/src/routes/f163-admin.ts` (lightweight admin route)
- Test: new test for promotion endpoint

**Step 1: Write failing test**

```typescript
test('F163: POST /api/f163/promote upgrades authority level', async () => {
  // Create item with authority=observed
  // POST /api/f163/promote { anchor, targetAuthority: 'candidate' }
  // GET item — assert authority=candidate
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement promotion route**

```typescript
// POST /api/f163/promote
// Body: { anchor: string, targetAuthority: F163Authority, reason: string }
// Validates: can only promote upward (observed→candidate→validated)
// constitutional requires special flag (CVO-only)
```

**Step 4: Register route in app**

**Step 5: Run test — expect PASS**

**Step 6: Commit**

```
feat(F163): knowledge promotion API — observed→candidate→validated [布偶猫🐾]
```

---

## Task 13: Zero-behavior regression test (f163.enabled=false)

**Files:**
- Test: `packages/api/test/f163-zero-behavior.test.js`

**Step 1: Write test**

```typescript
test('F163: all flags off = identical behavior to pre-F163', async () => {
  // Ensure all F163 flags are 'off'
  // Run same queries as gold set
  // Assert: results identical to baseline (same order, same content)
  // Assert: no f163_logs entries created
  // Assert: boostSource = ['legacy'] for all results
  // Assert: variantId present but all queries share same variant
});
```

**Step 2: Run test — expect PASS (zero-behavior guarantee)**

Run: `pnpm --filter @cat-cafe/api test -- --grep "zero-behavior"`
Expected: PASS — confirms F163 is invisible when flags are off

**Step 3: Commit**

```
test(F163): zero-behavior regression — all flags off = no side effects [布偶猫🐾]
```

---

## Task 14: EvidenceWriteQueue — single-writer scheduler (Design Gate 契约 3 硬约束)

**Files:**
- Create: `packages/api/src/domains/memory/evidence-write-queue.ts`
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (wrap write methods)
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts` (wrap direct DB writes at lines 182, 250, 772)
- Test: new test for serialized write ordering

**Why standalone task:** Design Gate 契约 3 要求 ALL evidence.sqlite mutations 走单一写入调度器，包括 IndexBuilder 绕过 store 的直写。这不是 store 内部重构——是架构层约束。

**Step 1: Write failing test — concurrent writes are serialized**

```typescript
test('F163: EvidenceWriteQueue serializes concurrent writes', async () => {
  const order: number[] = [];
  // Enqueue 3 writes that each push their index
  await Promise.all([
    queue.enqueue(() => { order.push(1); }),
    queue.enqueue(() => { order.push(2); }),
    queue.enqueue(() => { order.push(3); }),
  ]);
  // Assert: order is [1, 2, 3] (FIFO, not interleaved)
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement EvidenceWriteQueue**

```typescript
export class EvidenceWriteQueue {
  private queue: Promise<void> = Promise.resolve();

  enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        try { resolve(await fn()); }
        catch (e) { reject(e); }
      });
    });
  }
}
```

Global singleton — all SqliteEvidenceStore write methods (`upsert`, `delete`, `updateStatus`) and IndexBuilder direct DB writes route through `enqueue()`.

**Step 4: Wrap SqliteEvidenceStore write methods**

In `upsert()`, `delete()`, etc.: wrap the DB mutation in `writeQueue.enqueue(() => { ... })`.

**Step 5: Wrap IndexBuilder direct writes**

IndexBuilder lines 182 (batch insert), 250 (update), 772 (delete) — each wrapped in `writeQueue.enqueue()`. IndexBuilder gets write queue via constructor injection.

**Step 6: Write-path fail-open**

If queue errors on a write-path operation, degrade to `suggest` mode (log the intended mutation to f163_suggestions instead of applying). Read path is unaffected.

**Step 7: Run test — expect PASS**

**Step 8: Commit**

```
feat(F163): EvidenceWriteQueue — single-writer for all evidence.sqlite mutations [布偶猫🐾]
```

---

## Task 15: always_on injection into SystemPromptBuilder (AC-A3)

**Files:**
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` (inject always_on docs)
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (add `queryAlwaysOn()` method)
- Modify: `packages/api/src/routes/evidence.ts` (add `injectionSources` to response envelope)
- Test: new test for injection path

**Why standalone task:** AC-A3 明确要求 `always_on` 文档走物理注入路径（不走检索管道）。这是独立于 boost/rerank 的注入通道。

**Step 1: Write failing test — always_on docs injected into system prompt**

```typescript
test('F163: always_on docs appear in system prompt when flag=on', async () => {
  // Insert doc with activation='always_on', authority='constitutional'
  // Set F163_ALWAYS_ON_INJECTION=on
  // Build system prompt
  // Assert: doc content appears in prompt output
});

test('F163: always_on docs NOT injected when flag=off', async () => {
  // Same setup, flag=off
  // Build system prompt
  // Assert: doc content NOT in prompt
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Add `queryAlwaysOn()` to SqliteEvidenceStore**

```typescript
queryAlwaysOn(): EvidenceItem[] {
  return this.db.prepare(
    "SELECT * FROM evidence_docs WHERE activation = 'always_on' AND authority = 'constitutional' AND status = 'active'"
  ).all().map(row => this.rowToItem(row));
}
```

约束：`always_on` 仅限 `constitutional` authority（spec KD-2 + AC-A3 guard）。

**Step 4: Wire into SystemPromptBuilder**

In `buildInvocationContext()` (`SystemPromptBuilder.ts:461`):

```typescript
// F163: always_on knowledge injection
if (getEnv('F163_ALWAYS_ON_INJECTION') !== 'off') {
  const alwaysOnDocs = evidenceStore.queryAlwaysOn();
  if (alwaysOnDocs.length > 0) {
    const section = alwaysOnDocs.map(d => d.content).join('\n---\n');
    if (getEnv('F163_ALWAYS_ON_INJECTION') === 'on') {
      // Physically inject into prompt
      parts.push(`## Constitutional Knowledge (always_on)\n\n${section}`);
    }
    // shadow: log injection candidates but don't add to prompt
    injectionSources = alwaysOnDocs.map(d => d.anchor);
  }
}
```

**Step 5: Add `injectionSources` to search response**

When always_on injection fires, `injectionSources` in `EvidenceSearchResponse` carries the list of injected anchors (separate from `boostSource` — injection is not a search operation).

**Step 6: Run test — expect PASS**

**Step 7: Run full test suite**

Run: `pnpm --filter @cat-cafe/api test -- --grep F163`
Expected: All F163 tests pass including zero-behavior (flag=off → no injection)

**Step 8: Commit**

```
feat(F163): always_on injection into SystemPromptBuilder [布偶猫🐾]
```

---

## Task Dependency Graph

```
Task 1 (schema) ──→ Task 2 (types) ──→ Task 3 (env flags)
                         │
                         ▼
                    Task 14 (write queue) ←── Design Gate 契約 3 硬約束
                         │
                         ▼
                    Task 4 (store persist)
                         │
                    ┌────┴────┐
                    ▼         ▼
              Task 5        Task 7
            (boost)       (logger)
                    │         │
                    └────┬────┘
                         ▼
                    Task 6 (response fields)
                         │
                    ┌────┴────┐
                    ▼         ▼
              Task 8        Task 10
            (gold set)    (cohort)
                    │         │
                    └────┬────┘
                         ▼
                    Task 9 (tag constitutional)
                         │
                    ┌────┴────┐
                    ▼         ▼
              Task 11      Task 15
          (kill-switch)  (always_on injection)
                    │         │
                    └────┬────┘
                         ▼
                    Task 12 (promotion API)
                         │
                         ▼
                    Task 13 (zero-behavior test)
```

## Verification Checklist

| AC | Covered by Task |
|----|----------------|
| AC-A1 | Task 8 (gold set + baseline) |
| AC-A2 | Task 1 (schema) + Task 4 (store) |
| AC-A3 | Task 9 (tag constitutional) + **Task 15 (always_on injection into SystemPromptBuilder)** |
| AC-A4 | Task 5 (boost) + Task 8 (eval) |
| AC-A5 | Task 9 (tag constitutional) |
| AC-A6 | Task 12 (promotion API) |
| AC-A7 | Task 6 (response fields) |
| Zero-behavior | Task 13 |
| DG 契约 3 (write queue) | **Task 14 (EvidenceWriteQueue — all mutations serialized)** |
| DG-4.1/4.2 (砚砚 残余风险) | Task 7 (logging) + Task 8 (eval) |
