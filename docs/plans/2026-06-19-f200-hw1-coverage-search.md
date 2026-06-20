# F200 HW-1: Coverage Search Mode — Implementation Plan

**Feature:** F200 — `docs/features/F200-memory-recall-eval.md` (HW-1 row, v1.2 backlog)
**Goal:** 让 `search_evidence` 支持 coverage/source-map 搜索模式——多 scope 多路全集召回 + coverage matrix 输出 + expansion 来源展示，解决 top-k 搜索无法满足"X 主题在家里有哪些沉淀"的问题
**Acceptance Criteria:**
- AC-1: `search_evidence` 新增 `intent=coverage` 参数，触发 coverage search pipeline
- AC-2: Coverage pipeline 分 scope 配额搜索（docs + threads 各自保底 top-N）
- AC-3: Structured expansion 从三类数据源：① frontmatter aliases ② source-thread 链接 ③ F242 convention graph edges（soft dep）
- AC-4: Union + dedup 按 anchor 去重，direct hit 优先于 indirect hit
- AC-5: 输出 coverage matrix（每条标注 matchType + source + expansionProvenance）
- AC-6: max 50 cap + per-source quota（docs/threads/conventionGraph 各自 cap）
- AC-7: F242 unavailable / stale → graceful fallback 纯文档 expansion
- AC-8: 新 `CoverageSearchEvent` telemetry（触发率 / 消费率 / expansion source 分布）
- AC-9: 普通 top-k 搜索不受影响（intent 默认 undefined = topk 行为不变）
**What we're NOT building:**
- 不改 `IEvidenceStore.search()` 核心语义
- 不做 LLM 推理 expansion（KD-8：给数据不给结论）
- 不做自动触发（第一版只 nudge，猫显式 `intent=coverage` 才切）
- 不做 shadow mode（coverage 不改排序）
**Architecture cell:** `memory` primary, `code-intelligence` soft dependency
**Map delta:** none
**Map delta why:** 扩展 memory retrieval surface，不改变 memory cell 边界
**Architecture:** 新建 `CoverageSearchService` 编排多次 `searchWithMeta()` 调用 + frontmatter/source-thread/convention-graph expansion。MCP 层扩展 `search_evidence` input schema 加 `intent` 参数，API route 按 intent 分流到 CoverageSearchService 或现有 search pipeline。Telemetry 新增 `CoverageSearchEvent` type。
**Tech Stack:** TypeScript, better-sqlite3 (existing evidence.sqlite), @cat-cafe/convention-graph (soft dep)
**前端验证:** No — 纯后端 + MCP 输出

**Design Gate:** PASS with amendments（2026-06-19，宪宪+砚砚）
**Research:** `docs/discussions/2026-06-19-f200-hw1-coverage-search-research/README.md`

---

## Stateful Object Gate

Coverage search 不引入有生命周期的状态对象。`CoverageSearchService` 是无状态 service（每次调用独立，无缓存/注册表/索引/持久 config）。`CoverageSearchEvent` 是 append-only telemetry（同 RecallEvent——只 INSERT，无更新/删除/转移）。

结论：无需状态转移表 / 不变量清单 / 对抗场景。

---

## Terminal Schema

```typescript
// ── Coverage Search types (new file: coverage-search-types.ts) ──

export type CoverageMatchType = 'direct' | 'alias' | 'source-thread' | 'convention';
export type CoverageSource = 'docs' | 'threads' | 'convention-graph';
export type ExpansionSourceType = 'frontmatter-alias' | 'source-thread' | 'convention-edge';

export interface ExpansionProvenance {
  source: ExpansionSourceType;
  via: string;        // "F200 → topic:memory" | "thread-xxx" | "mcp-tool:search_evidence → skill:memory-search"
  confidence: 'static' | 'heuristic';
}

export interface CoverageMatrixItem {
  anchor: string;
  title: string;
  kind: EvidenceKind;
  matchType: CoverageMatchType;
  confidence: number;        // search match quality
  source: CoverageSource;
  expansionProvenance?: ExpansionProvenance;  // undefined for direct hits
  sourcePath?: string;
  drillDown?: EvidenceDrillDown;
}

export interface CoverageSearchResult {
  query: string;
  totalHits: number;
  bySource: {
    docs: { count: number; cap: number };
    threads: { count: number; cap: number };
    conventionGraph: { count: number; cap: number };
  };
  matrix: CoverageMatrixItem[];
  gaps: string[];           // 明确标注未覆盖的维度
  degraded?: { source: CoverageSource; reason: string }[];
}

// ── CoverageSearchEvent telemetry (extends f200-types.ts) ──

export interface CoverageSearchEvent {
  coverageId: string;
  catId: string;
  invocationId: string;
  query: string;
  totalHits: number;
  directHits: number;
  indirectHits: number;
  bySource: Record<CoverageSource, number>;
  expansionSources: Record<ExpansionSourceType, number>;
  conventionGraphUsed: boolean;
  conventionGraphStaleSkips: number;
  matrixSize: number;
  timestamp: number;
  threadId?: string;
}

// ── SearchOptions extension ──
// Add to existing SearchOptions interface:
//   intent?: 'topk' | 'coverage';

// ── MCP input schema extension ──
// Add to searchEvidenceInputSchema:
//   intent: z.enum(['topk', 'coverage']).optional()
```

---

## Per-Source Quota Design

| Source | Cap | Rationale |
|--------|-----|-----------|
| docs | 25 | Canonical truth sources, most valuable |
| threads | 20 | Discussion context, cross-language recall |
| conventionGraph | 10 | Code-level structural associations, F242 soft dep |
| **Total max** | **50** | Token budget constraint |

When F242 unavailable: conventionGraph quota=0, docs+threads get +5 each (25→30, 20→25).

---

## Tasks

### Task 1: Coverage Search Types + CoverageSearchService skeleton

**Files:**
- Create: `packages/api/src/domains/memory/coverage-search-types.ts`
- Create: `packages/api/src/domains/memory/CoverageSearchService.ts`
- Test: `packages/api/test/memory/coverage-search.test.js`

**Step 1: Write the type definitions**

Create `coverage-search-types.ts` with all terminal schema types above.

**Step 2: Write failing test — basic coverage search returns matrix**

```javascript
// packages/api/test/memory/coverage-search.test.js
import { describe, it, expect } from 'vitest';
import { CoverageSearchService } from '../../src/domains/memory/CoverageSearchService.js';

describe('CoverageSearchService', () => {
  it('returns coverage matrix with direct hits from multiple scopes', async () => {
    const mockStore = createMockEvidenceStore([
      { anchor: 'F200', title: 'Memory Recall Eval', kind: 'feature', sourcePath: 'features/F200.md' },
      { anchor: 'thread-001', title: 'Discussion about F200', kind: 'thread', sourcePath: '' },
    ]);
    const service = new CoverageSearchService(mockStore);
    const result = await service.search('F200 memory recall');

    expect(result.matrix.length).toBeGreaterThan(0);
    expect(result.matrix[0].matchType).toBe('direct');
    expect(result.bySource.docs.count).toBeGreaterThanOrEqual(0);
    expect(result.bySource.threads.count).toBeGreaterThanOrEqual(0);
    expect(result.totalHits).toBe(result.matrix.length);
    expect(result.matrix.length).toBeLessThanOrEqual(50);
  });
});
```

Run: `cd ../cat-cafe-f200-hw1 && env -u NODE_ENV pnpm vitest run packages/api/test/memory/coverage-search.test.js`
Expected: FAIL — CoverageSearchService doesn't exist

**Step 3: Write minimal CoverageSearchService**

```typescript
// packages/api/src/domains/memory/CoverageSearchService.ts
import type { IEvidenceStore, EvidenceItem, SearchOptions, EvidenceSearchExecution } from './interfaces.js';
import type {
  CoverageSearchResult, CoverageMatrixItem, CoverageSource, CoverageMatchType,
} from './coverage-search-types.js';

const QUOTA = { docs: 25, threads: 20, conventionGraph: 10 } as const;
const MAX_TOTAL = 50;

export class CoverageSearchService {
  constructor(
    private readonly store: Pick<IEvidenceStore, 'searchWithMeta'>,
    private readonly conventionGraph?: { /* typed later */ } | null,
  ) {}

  async search(query: string): Promise<CoverageSearchResult> {
    // Step 1: multi-scope search
    const [docsResult, threadsResult] = await Promise.all([
      this.searchScope(query, 'docs', QUOTA.docs),
      this.searchScope(query, 'threads', QUOTA.threads),
    ]);

    // Step 2: structured expansion (Task 2)
    // Step 3: union + dedup
    const seen = new Set<string>();
    const matrix: CoverageMatrixItem[] = [];

    for (const item of [...docsResult, ...threadsResult]) {
      const key = item.anchor.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      matrix.push({
        anchor: item.anchor,
        title: item.title,
        kind: item.kind,
        matchType: 'direct',
        confidence: 1,
        source: this.classifySource(item),
        sourcePath: item.sourcePath,
        drillDown: item.drillDown,
      });
    }

    // Step 4: cap
    const capped = matrix.slice(0, MAX_TOTAL);

    return {
      query,
      totalHits: capped.length,
      bySource: {
        docs: { count: capped.filter(m => m.source === 'docs').length, cap: QUOTA.docs },
        threads: { count: capped.filter(m => m.source === 'threads').length, cap: QUOTA.threads },
        conventionGraph: { count: 0, cap: QUOTA.conventionGraph },
      },
      matrix: capped,
      gaps: [],
    };
  }

  private async searchScope(query: string, scope: string, limit: number): Promise<EvidenceItem[]> {
    const opts: SearchOptions = { scope: scope as 'docs' | 'threads', mode: 'hybrid', limit };
    const execution = await this.store.searchWithMeta!(query, opts);
    return execution.items;
  }

  private classifySource(item: EvidenceItem): CoverageSource {
    if (item.sourcePath?.includes('thread') || item.kind === 'thread') return 'threads';
    return 'docs';
  }
}
```

Run: `cd ../cat-cafe-f200-hw1 && env -u NODE_ENV pnpm vitest run packages/api/test/memory/coverage-search.test.js`
Expected: PASS

**Step 4: Commit**
```bash
git add packages/api/src/domains/memory/coverage-search-types.ts \
       packages/api/src/domains/memory/CoverageSearchService.ts \
       packages/api/test/memory/coverage-search.test.js
git commit -m "feat(F200): HW-1 coverage search types + service skeleton [宪宪/Opus-46🐾]"
```

---

### Task 2: Structured Expansion — frontmatter + source-thread

**Files:**
- Modify: `packages/api/src/domains/memory/CoverageSearchService.ts`
- Test: `packages/api/test/memory/coverage-search.test.js`

**Step 1: Write failing test — expansion from frontmatter aliases**

```javascript
it('expands coverage via frontmatter aliases (feature_ids/topics)', async () => {
  const mockStore = createMockEvidenceStore([
    // Direct hit: a doc that mentions F200 in frontmatter
    { anchor: 'F200', title: 'Memory Recall Eval', kind: 'feature',
      sourcePath: 'features/F200.md',
      // Simulated frontmatter: feature_ids: [F200], topics: [memory, search]
    },
    // Indirect hit: another doc with topic:memory
    { anchor: 'F102', title: 'Memory System Core', kind: 'feature',
      sourcePath: 'features/F102.md',
    },
  ]);
  const service = new CoverageSearchService(mockStore);
  const result = await service.search('F200');

  const indirectHits = result.matrix.filter(m => m.matchType === 'alias');
  // Should find F102 via shared topic:memory
  // (exact behavior depends on frontmatter indexing, tested with real data in integration)
});
```

**Step 2: Write failing test — expansion from source-thread links**

```javascript
it('expands coverage via source-thread links in canonical docs', async () => {
  const service = new CoverageSearchService(mockStore);
  const result = await service.search('coverage search');

  const threadExpansions = result.matrix.filter(m => m.matchType === 'source-thread');
  for (const item of threadExpansions) {
    expect(item.expansionProvenance).toBeDefined();
    expect(item.expansionProvenance!.source).toBe('source-thread');
  }
});
```

**Step 3: Implement expansion methods**

Add to `CoverageSearchService`:
- `expandViaFrontmatter(directHits: EvidenceItem[]): CoverageMatrixItem[]` — parse `feature_ids`, `topics`, `related_features` from doc metadata, search for docs sharing these tags
- `expandViaSourceThreads(directHits: EvidenceItem[]): CoverageMatrixItem[]` — regex extract `thread-{id}` / `[[wikilink]]` patterns from doc content, resolve to anchors
- Both methods attach `ExpansionProvenance` to every indirect hit

**Step 4: Run tests → green**

**Step 5: Write test — every indirect hit MUST have expansionProvenance**

```javascript
it('every indirect hit has expansionProvenance (砚砚 constraint #2)', async () => {
  const service = new CoverageSearchService(mockStore);
  const result = await service.search('memory system');

  for (const item of result.matrix) {
    if (item.matchType !== 'direct') {
      expect(item.expansionProvenance).toBeDefined();
      expect(item.expansionProvenance!.source).toBeTruthy();
      expect(item.expansionProvenance!.via).toBeTruthy();
    }
  }
});
```

**Step 6: Commit**
```bash
git commit -m "feat(F200): HW-1 structured expansion — frontmatter + source-thread [宪宪/Opus-46🐾]"
```

---

### Task 3: F242 Convention Graph Expansion (soft dep)

**Files:**
- Modify: `packages/api/src/domains/memory/CoverageSearchService.ts`
- Test: `packages/api/test/memory/coverage-search.test.js`

**Step 1: Write failing test — F242 unavailable fallback**

```javascript
it('falls back gracefully when convention graph is null (砚砚 constraint #3)', async () => {
  const service = new CoverageSearchService(mockStore, null /* no graph */);
  const result = await service.search('search_evidence');

  // Should still work — just no convention-graph hits
  expect(result.bySource.conventionGraph.count).toBe(0);
  expect(result.matrix.length).toBeGreaterThan(0);
  expect(result.degraded).toContainEqual(
    expect.objectContaining({ source: 'convention-graph', reason: expect.any(String) })
  );
});
```

**Step 2: Write failing test — F242 stale edge skip**

```javascript
it('skips stale convention graph edges with degraded note (砚砚 constraint #3)', async () => {
  const mockGraph = createMockConventionGraph({
    stale: true,
    nodes: [{ id: 'n1', name: 'search_evidence', kind: 'mcp-tool' }],
    consumers: [{ node: { id: 'n2', name: 'memory-search', filePath: 'cat-cafe-skills/memory-search/SKILL.md' } }],
  });
  const service = new CoverageSearchService(mockStore, mockGraph);
  const result = await service.search('search_evidence');

  // Stale graph → convention-graph count = 0 + degraded note
  expect(result.bySource.conventionGraph.count).toBe(0);
  expect(result.degraded).toContainEqual(
    expect.objectContaining({ source: 'convention-graph', reason: expect.stringContaining('stale') })
  );
});
```

**Step 3: Write failing test — F242 fresh edge expansion**

```javascript
it('expands via convention graph edges when fresh', async () => {
  const mockGraph = createMockConventionGraph({
    stale: false,
    nodes: [{ id: 'n1', name: 'search_evidence', kind: 'mcp-tool', domainId: 'mcp-tool' }],
    consumers: [{
      node: { id: 'n2', name: 'memory-search', kind: 'skill-manifest',
              filePath: 'cat-cafe-skills/memory-search-best-practices/SKILL.md' },
      edge: { provenance: { extractor: 'skill-manifest', extractorVersion: '1.0', confidence: 'static' } },
    }],
  });
  const service = new CoverageSearchService(mockStore, mockGraph);
  const result = await service.search('search_evidence');

  const conventionHits = result.matrix.filter(m => m.matchType === 'convention');
  expect(conventionHits.length).toBeGreaterThan(0);
  expect(conventionHits[0].expansionProvenance).toEqual({
    source: 'convention-edge',
    via: expect.stringContaining('search_evidence'),
    confidence: 'static',
  });
  expect(result.bySource.conventionGraph.count).toBeGreaterThan(0);
});
```

**Step 4: Implement `expandViaConventionGraph()`**

Add method that:
1. Extracts MCP tool names / skill names from direct hits content
2. Calls `codeConsumers(graph, { name })` for each
3. Checks `freshness.stale` → skip if stale, add degraded note
4. Maps consumer `filePath` → anchor via `resolveFileToAnchor()`
5. Attaches `ExpansionProvenance` with edge provenance confidence

**Step 5: Run tests → green**

**Step 6: Commit**
```bash
git commit -m "feat(F200): HW-1 convention graph expansion — soft dep + stale guard [宪宪/Opus-46🐾]"
```

---

### Task 4: Per-source quota + dedup refinement

**Files:**
- Modify: `packages/api/src/domains/memory/CoverageSearchService.ts`
- Test: `packages/api/test/memory/coverage-search.test.js`

**Step 1: Write failing test — per-source quota enforcement**

```javascript
it('enforces per-source quota (砚砚 amendment: docs/threads/conventionGraph each capped)', async () => {
  // Set up mock with 30 docs hits + 25 thread hits
  const manyDocs = Array.from({ length: 30 }, (_, i) => ({
    anchor: `doc-${i}`, title: `Doc ${i}`, kind: 'feature', sourcePath: `features/doc-${i}.md`,
  }));
  const manyThreads = Array.from({ length: 25 }, (_, i) => ({
    anchor: `thread-${i}`, title: `Thread ${i}`, kind: 'thread', sourcePath: '',
  }));
  const mockStore = createMockEvidenceStore([...manyDocs, ...manyThreads]);
  const service = new CoverageSearchService(mockStore, null);
  const result = await service.search('test');

  expect(result.bySource.docs.count).toBeLessThanOrEqual(25);
  expect(result.bySource.threads.count).toBeLessThanOrEqual(20);
  expect(result.matrix.length).toBeLessThanOrEqual(50);
});
```

**Step 2: Write failing test — dedup direct > indirect priority**

```javascript
it('dedup prefers direct hits over indirect expansion hits', async () => {
  // Same anchor appears as direct doc hit AND indirect expansion
  const service = new CoverageSearchService(mockStore, null);
  const result = await service.search('F200');

  const f200Items = result.matrix.filter(m => m.anchor === 'F200');
  expect(f200Items.length).toBe(1);
  expect(f200Items[0].matchType).toBe('direct');
});
```

**Step 3: Implement quota + dedup refinement**

Refine `search()` method:
- Apply per-source cap before union
- During dedup, direct hit wins over indirect hit for same anchor
- Redistribute unused quota (e.g., F242 unavailable → docs+threads get +5 each)

**Step 4: Run tests → green**

**Step 5: Commit**
```bash
git commit -m "feat(F200): HW-1 per-source quota + dedup priority [宪宪/Opus-46🐾]"
```

---

### Task 5: MCP + API integration

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts:231-264` — add `intent` to `SearchOptions`
- Modify: `packages/mcp-server/src/tools/evidence-tools.ts:41-86` — add `intent` to input schema
- Modify: `packages/mcp-server/src/tools/evidence-tools.ts:88-210` — route `intent=coverage` to new formatter
- Modify: `packages/api/src/routes/evidence.ts:105-180` — route `intent=coverage` to CoverageSearchService
- Test: `packages/api/test/memory/coverage-search.test.js`

**Step 1: Write failing test — intent=coverage routes to CoverageSearchService**

```javascript
it('intent=coverage on API route returns coverage matrix format', async () => {
  // Integration test using Fastify inject
  const response = await app.inject({
    method: 'GET',
    url: '/api/evidence/search?q=memory&intent=coverage',
  });
  const data = response.json();
  expect(data.matrix).toBeDefined();
  expect(data.bySource).toBeDefined();
  expect(data.totalHits).toBeDefined();
});
```

**Step 2: Write failing test — normal search unaffected (AC-9)**

```javascript
it('normal search (no intent) returns existing top-k format unchanged', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/evidence/search?q=memory',
  });
  const data = response.json();
  // Should have results[] not matrix[]
  expect(data.results).toBeDefined();
  expect(data.matrix).toBeUndefined();
});
```

**Step 3: Implement**

1. Add `intent?: 'topk' | 'coverage'` to `SearchOptions`
2. Add `intent` to `searchEvidenceInputSchema` in evidence-tools.ts
3. In evidence.ts route: `if (intent === 'coverage') → CoverageSearchService.search()` else existing pipeline
4. In evidence-tools.ts `handleSearchEvidence`: format `CoverageSearchResult` into MCP text output with matrix table

**Step 4: Write MCP output formatter test**

```javascript
it('MCP output for coverage search renders matrix table', async () => {
  const result = await handleSearchEvidence({ query: 'memory', intent: 'coverage' });
  expect(result.content[0].text).toContain('Coverage Matrix');
  expect(result.content[0].text).toContain('direct');
  expect(result.content[0].text).toContain('bySource');
});
```

**Step 5: Run tests → green**

**Step 6: Commit**
```bash
git commit -m "feat(F200): HW-1 MCP + API integration — intent=coverage routing [宪宪/Opus-46🐾]"
```

---

### Task 6: CoverageSearchEvent telemetry

**Files:**
- Modify: `packages/api/src/domains/memory/f200-types.ts` — add `CoverageSearchEvent`
- Modify: `packages/api/src/domains/memory/RecallEventCorrelator.ts` — add coverage event recording
- Modify: `packages/api/src/domains/memory/CoverageSearchService.ts` — emit telemetry
- Test: `packages/api/test/memory/coverage-search.test.js`

**Step 1: Write failing test — coverage search emits CoverageSearchEvent**

```javascript
it('coverage search emits CoverageSearchEvent telemetry', async () => {
  const events: CoverageSearchEvent[] = [];
  const service = new CoverageSearchService(mockStore, null, {
    onCoverageEvent: (e) => events.push(e),
  });
  await service.search('memory');

  expect(events.length).toBe(1);
  expect(events[0].query).toBe('memory');
  expect(events[0].totalHits).toBeGreaterThanOrEqual(0);
  expect(events[0].directHits).toBeDefined();
  expect(events[0].indirectHits).toBeDefined();
  expect(events[0].conventionGraphUsed).toBe(false); // no graph
  expect(events[0].conventionGraphStaleSkips).toBe(0);
  expect(events[0].timestamp).toBeGreaterThan(0);
});
```

**Step 2: Implement CoverageSearchEvent emission**

1. Add `CoverageSearchEvent` interface to `f200-types.ts`
2. Add `onCoverageEvent` callback to `CoverageSearchService` constructor
3. Emit event at end of `search()` with all metrics
4. In API route, wire up callback to write to `recall_events` table (or separate coverage_events table — defer schema migration to HW-1 Phase 2 if needed)

**Step 3: Run tests → green**

**Step 4: Commit**
```bash
git commit -m "feat(F200): HW-1 CoverageSearchEvent telemetry [宪宪/Opus-46🐾]"
```

---

### Task 7: MCP tool description + nudge upgrade

**Files:**
- Modify: `packages/mcp-server/src/tools/evidence-tools.ts:402-431` — update tool description
- Modify: `packages/mcp-server/src/tools/evidence-coverage-nudge.ts` — upgrade nudge to mention `intent=coverage`
- Test: `packages/api/test/memory/coverage-search.test.js`

**Step 1: Update coverage nudge to mention intent=coverage**

```typescript
// Updated nudge output:
'📚 Coverage task — single top-k search is not exhaustive.',
'  • Use intent=coverage for system-level multi-scope coverage search with matrix output.',
'  • Or follow memory-search-best-practices skill for manual multi-query coverage.',
```

**Step 2: Update MCP tool description SEARCH TIPS**

Add `intent` parameter description and coverage usage tip.

**Step 3: Write test — nudge mentions intent=coverage**

```javascript
it('coverage nudge now mentions intent=coverage', () => {
  const nudge = composeCoverageIntentNudge('哪些 thread 提过 Redis');
  expect(nudge).toContain('intent=coverage');
});
```

**Step 4: Run tests → green**

**Step 5: Commit**
```bash
git commit -m "feat(F200): HW-1 coverage nudge upgrade + MCP description [宪宪/Opus-46🐾]"
```

---

## Test Matrix Summary

| Test | Covers | Constraint |
|------|--------|------------|
| multi-scope direct hits | AC-1, AC-2 | — |
| frontmatter alias expansion | AC-3① | — |
| source-thread link expansion | AC-3② | — |
| convention graph expansion (fresh) | AC-3③ | — |
| F242 unavailable fallback | AC-7 | 砚砚 #3 |
| F242 stale edge skip | AC-7 | 砚砚 #3 |
| every indirect hit has provenance | AC-5 | 砚砚 #2 |
| per-source quota enforcement | AC-6 | 砚砚 #4 |
| dedup direct > indirect priority | AC-4 | — |
| max 50 cap | AC-6 | — |
| intent=coverage API routing | AC-1 | — |
| normal search unaffected | AC-9 | 砚砚 #1 |
| MCP output renders matrix | AC-5 | — |
| CoverageSearchEvent telemetry | AC-8 | — |
| coverage nudge mentions intent | — | — |

## Open Questions（技术 OQ，实现中自决）

| # | 问题 | 倾向 |
|---|------|------|
| T-1 | CoverageSearchEvent 写 recall_events 表（加 type 列）还是新建 coverage_events 表？ | 新 INSERT-only 表，避免 recall_events schema 膨胀 |
| T-2 | frontmatter expansion 从 evidence.sqlite metadata 读还是重新 parse 源文件？ | 从 evidence.sqlite keywords/sourceIds 读（已索引，避免 I/O） |
| T-3 | Convention graph `resolveFileToAnchor()` 用 sourcePath 反查 evidence 还是用文件名推断？ | 用 `store.search(filePath)` 反查 evidence anchor |

---

[宪宪/Opus-46🐾]
