---
feature_ids: [F102]
topics: [memory, contract, evidence-search]
doc_kind: plan
created: 2026-04-13
---

# F102 Phase K: Contract Closure Implementation Plan

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** 修复 evidence search 对外契约缺口 — 消除"说一套做一套"问题
**Acceptance Criteria:**
- AC-K1: `depth=raw` 强制降级时 API 返回 `degraded: true` + `effectiveMode` + 前端锁定 mode
- AC-K2: passage 前端类型匹配后端实际返回，渲染 `content/speaker/createdAt/context`
**Architecture:** 后端 evidence route 增加降级信号；前端类型修正 + mode 联动 + passage 渲染修正
**Tech Stack:** TypeScript, Fastify, React, Vitest
**前端验证:** Yes — reviewer 必须实测 `/memory` 页面

---

## Terminal Schema

### 后端 `EvidenceSearchResponse`（终态）

```typescript
// evidence.ts — 已有字段 + 新增 effectiveMode
interface EvidenceSearchResponse {
  results: EvidenceResult[];
  degraded: boolean;
  degradeReason?: string;
  effectiveMode?: 'lexical' | 'semantic' | 'hybrid'; // AC-K1: 实际使用的检索模式
  freshness?: EvidenceFreshness;
  reimportTrigger?: EvidenceReimportTrigger;
}
```

### 前端 `SearchResultItem.passages`（终态）

```typescript
// EvidenceSearch.tsx — 匹配后端 evidence-helpers.ts 的 EvidenceResult.passages
passages?: Array<{
  passageId: string;
  content: string;
  speaker?: string;
  createdAt?: string;
  context?: Array<{
    passageId: string;
    content: string;
    speaker?: string;
    createdAt?: string;
  }>;
}>;
```

### 前端 `SearchResponse`（终态）

```typescript
interface SearchResponse {
  results: SearchResultItem[];
  degraded: boolean;
  degradeReason?: string;
  effectiveMode?: 'lexical' | 'semantic' | 'hybrid'; // AC-K1
}
```

---

## Task 1: AC-K1 后端 — route 返回降级信号

**Files:**
- Modify: `packages/api/src/routes/evidence.ts:69-99`

**Step 1: Write the failing test**

```typescript
// packages/web/src/__tests__/evidence-search.test.ts — 新增测试
describe('parseSearchResults with degradation', () => {
  it('preserves effectiveMode from degraded response', () => {
    const response = {
      results: [{ title: 'T', anchor: 'a', snippet: 's', confidence: 'mid', sourceType: 'decision' }],
      degraded: true,
      degradeReason: 'raw_lexical_only',
      effectiveMode: 'lexical' as const,
    };
    const items = parseSearchResults(response);
    expect(items).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it passes（parseSearchResults 只看 results，不会 fail）**

Run: `cd packages/web && pnpm vitest run src/__tests__/evidence-search.test.ts`

**Step 3: Implement route degradation signal**

```typescript
// packages/api/src/routes/evidence.ts:69-99
// 在 searchOpts 构建后、items 映射前，检测 raw+non-lexical 组合
const requestedMode = mode ?? 'lexical';
const isRawDegraded = depth === 'raw' && requestedMode !== 'lexical';
const effectiveMode = isRawDegraded ? 'lexical' : requestedMode;

// ... items mapping stays the same ...

return {
  results,
  degraded: isRawDegraded,
  ...(isRawDegraded ? { degradeReason: 'raw_lexical_only', effectiveMode } : {}),
} satisfies Partial<EvidenceSearchResponse>;
```

**Step 4: Verify types compile**

Run: `pnpm lint`

**Step 5: Commit**

```
feat(F102-K1): route returns degraded signal for depth=raw + non-lexical mode
```

---

## Task 2: AC-K1 前端 — mode 联动 + 降级提示

**Files:**
- Modify: `packages/web/src/components/memory/EvidenceSearch.tsx:168-181,25-28`

**Step 1: Write the failing test**

```typescript
// packages/web/src/__tests__/evidence-search.test.ts — 新增
describe('depth=raw mode constraint', () => {
  it('buildSearchUrl forces mode=lexical when depth=raw', () => {
    const url = buildSearchUrl({ q: 'test', depth: 'raw', mode: 'hybrid' });
    expect(url).toContain('mode=lexical');
    expect(url).not.toContain('mode=hybrid');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run src/__tests__/evidence-search.test.ts`
Expected: FAIL — 当前 buildSearchUrl 不做 mode 覆盖

**Step 3: Implement buildSearchUrl mode override**

```typescript
// EvidenceSearch.tsx — buildSearchUrl
export function buildSearchUrl(params: EvidenceSearchParams): string {
  const sp = new URLSearchParams();
  sp.set('q', params.q);
  // AC-K1: depth=raw forces lexical — passage vectors not yet available
  const effectiveMode = params.depth === 'raw' ? 'lexical' : params.mode;
  if (effectiveMode) sp.set('mode', effectiveMode);
  // ... rest unchanged
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run src/__tests__/evidence-search.test.ts`

**Step 5: Implement UI — mode 下拉锁定 + 提示**

```tsx
// EvidenceSearch.tsx — mode select 区域
<select
  value={depth === 'raw' ? 'lexical' : mode}
  onChange={(e) => setMode(e.target.value as ...)}
  disabled={depth === 'raw'}
  className="..."
>
  ...
</select>
{depth === 'raw' && (
  <span className="text-[10px] text-amber-600">消息级仅支持精确匹配</span>
)}
```

**Step 6: Update SearchResponse type to include effectiveMode**

```typescript
interface SearchResponse {
  results: SearchResultItem[];
  degraded: boolean;
  degradeReason?: string;
  effectiveMode?: 'lexical' | 'semantic' | 'hybrid';
}
```

**Step 7: Commit**

```
feat(F102-K1): lock mode to lexical when depth=raw, show degradation hint
```

---

## Task 3: AC-K2 — passage 类型对齐 + 渲染修正

**Files:**
- Modify: `packages/web/src/components/memory/EvidenceSearch.tsx:15-22,264-274`

**Step 1: Write the failing test**

```typescript
// packages/web/src/__tests__/evidence-search.test.ts — 新增
describe('parseSearchResults with passages', () => {
  it('preserves passage fields from backend (content, speaker, createdAt)', () => {
    const response = {
      results: [{
        title: 'Thread',
        anchor: 'thread-123',
        snippet: 'Discussion',
        confidence: 'mid',
        sourceType: 'discussion',
        passages: [
          { passageId: 'p1', content: 'Hello world', speaker: 'opus', createdAt: '2026-04-13T00:00:00Z' },
        ],
      }],
      degraded: false,
    };
    const items = parseSearchResults(response);
    expect(items[0].passages![0]).toHaveProperty('content', 'Hello world');
    expect(items[0].passages![0]).toHaveProperty('speaker', 'opus');
    expect(items[0].passages![0]).not.toHaveProperty('text');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run src/__tests__/evidence-search.test.ts`
Expected: FAIL — 当前类型是 `{ text, score }`

**Step 3: Fix passage type definition**

```typescript
// EvidenceSearch.tsx — SearchResultItem
interface SearchResultItem {
  title: string;
  anchor: string;
  snippet: string;
  confidence: string;
  sourceType: string;
  source?: 'project' | 'global';
  passages?: Array<{
    passageId: string;
    content: string;
    speaker?: string;
    createdAt?: string;
    context?: Array<{
      passageId: string;
      content: string;
      speaker?: string;
      createdAt?: string;
    }>;
  }>;
}
```

**Step 4: Fix passage rendering**

```tsx
// EvidenceSearch.tsx — passage render block (line ~264)
{item.passages && item.passages.length > 0 && (
  <div className="mt-2 space-y-1 border-l-2 border-cocreator-light pl-2">
    {item.passages.map((p) => (
      <div key={p.passageId} className="text-xs text-cafe-secondary">
        {p.speaker && (
          <span className="font-medium text-cafe-black">{p.speaker}: </span>
        )}
        <span className="italic">{p.content}</span>
        {p.createdAt && (
          <span className="ml-1 text-[10px] text-cafe-secondary/60">
            {new Date(p.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {p.context && p.context.length > 0 && (
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-cafe/30 pl-2">
            {p.context.map((ctx) => (
              <div key={ctx.passageId} className="text-[11px] text-cafe-secondary/70">
                {ctx.speaker && <span className="font-medium">{ctx.speaker}: </span>}
                <span>{ctx.content}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
)}
```

**Step 5: Run tests**

Run: `cd packages/web && pnpm vitest run src/__tests__/evidence-search.test.ts`

**Step 6: Commit**

```
feat(F102-K2): align passage type with backend, render content/speaker/createdAt/context
```

---

## Task 4: 全量验证

**Step 1: Type check**

Run: `pnpm lint`

**Step 2: Full test**

Run: `pnpm check && cd packages/web && pnpm vitest run`

**Step 3: Final commit if any cleanup needed**

---

## Not Building

- passage-level vector path (AC-K3, deferred)
- L2 rollup (AC-K4, deferred)
- `classifySource()` 扩展（Issue 5, 不在 Phase K scope）
- IndexStatus 面板补字段（Issue 6, 不在 Phase K scope）
