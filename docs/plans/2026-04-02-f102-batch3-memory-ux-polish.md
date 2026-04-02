---
feature_ids: [F102]
doc_kind: plan
created: 2026-04-02
---

# F102 Batch 3: /memory 体验层收口 Implementation Plan

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** 补齐 Memory Hub 的两个体验层缺口：project/global 维度切换器 + Recall Feed snippet/drill-down，让铲屎官能亲手体验"好用"
**Acceptance Criteria:**
- AC-B3a: EvidenceSearch 新增维度选择器（项目/全局/全部），搜索结果标注来源维度
- AC-B3b: Recall Feed 展示 snippet 预览 + anchor 来源链接，点击结果可跳转 Search 页 drill-down
**Not building:** 新搜索算法、IndexStatus TTL 配置、Recall Feed 样式重设计
**Architecture:** 后端 KnowledgeResolver 已支持联邦检索 (RRF fusion)，Batch 3 仅需：① 后端加 dimension param 控制查哪个 store ② 前端加 UI 选择器 + 来源标注 ③ Recall Feed parser 补全 anchor/snippet 字段
**Tech Stack:** Fastify + Zod (API) / React + Next.js (前端) / TDD (node:test)
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Straight-Line Check

**Finish line:** 铲屎官打开 `/memory/search`，能选 project/global/all 维度搜索并看到来源标签；Recall Feed 每条结果显示 snippet + 可点击 drill-down 到 Search 页。

**Terminal schema:**

```typescript
// Backend: evidence.ts searchSchema 新增
dimension?: 'project' | 'global' | 'all'  // default 'all'

// Backend: EvidenceSearchResponse.results[].source
source?: 'project' | 'global'

// Frontend: RecallResultItem 扩展
interface RecallResultItem {
  title: string;
  confidence?: string;
  sourceType?: string;
  anchor?: string;    // NEW
  snippet?: string;   // NEW
}
```

**NOT building list:**
- KnowledgeResolver 内部改动（已终态）
- IndexStatus TTL 配置
- 新的搜索 UI 组件
- Recall Feed 实时 WebSocket 推送

---

## Task 1: Backend — dimension param + source origin

**Files:**
- Modify: `packages/api/src/routes/evidence.ts:14-24` (searchSchema + handler)
- Modify: `packages/api/src/routes/evidence-helpers.ts:16-36` (EvidenceResult + source field)
- Modify: `packages/api/src/domains/memory/KnowledgeResolver.ts:20-48` (resolve dimension routing)
- Modify: `packages/api/src/domains/memory/interfaces.ts:97-107` (SearchOptions + dimension)
- Test: `packages/api/test/memory/knowledge-resolver-dimension.test.js`

### Step 1: Write failing test — dimension routing

```javascript
// knowledge-resolver-dimension.test.js
// Test: dimension='project' only queries projectStore
// Test: dimension='global' only queries globalStore
// Test: dimension='all' (default) does federation
// Test: dimension='global' with no globalStore returns empty
// Test: source field is set on results
```

### Step 2: Run test to verify it fails

```bash
pnpm --filter @cat-cafe/api exec node --test test/memory/knowledge-resolver-dimension.test.js
```

### Step 3: Implement dimension support

**interfaces.ts**: Add `dimension?: 'project' | 'global' | 'all'` to SearchOptions.

**KnowledgeResolver.ts**: In `resolve()`, check `options?.dimension`:
- `'project'` → only projectStore.search, tag results `source: 'project'`
- `'global'` → only globalStore?.search, tag results `source: 'global'`
- `'all'` / undefined → current RRF fusion behavior

**evidence-helpers.ts**: Add `source?: 'project' | 'global'` to EvidenceResult.

**evidence.ts**: Add `dimension` to searchSchema + pass to searchOpts. Map KnowledgeResult.sources to per-result source field (project items from project, global items from global).

### Step 4: Run test to verify it passes

### Step 5: Commit

```bash
git commit -m "feat(F102): dimension param for project/global search routing"
```

---

## Task 2: Frontend — dimension selector in EvidenceSearch

**Files:**
- Modify: `packages/web/src/components/memory/EvidenceSearch.tsx`
- Test: `packages/web/test/memory/evidence-search.test.tsx` (existing or new)

### Step 1: Write failing test — dimension selector renders + sends param

### Step 2: Run test to verify it fails

### Step 3: Implement dimension selector

Add to EvidenceSearchParams:
```typescript
dimension?: 'project' | 'global' | 'all';
```

Add `<select>` for 维度 (项目/全局/全部) in the selectors row, same pattern as mode/scope.

Update `buildSearchUrl` to include `dimension` param.

Update result cards to show source badge when present:
```tsx
{item.source && (
  <span className={item.source === 'project' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'}>
    {item.source === 'project' ? '项目' : '全局'}
  </span>
)}
```

### Step 4: Run test to verify it passes

### Step 5: Commit

```bash
git commit -m "feat(F102): dimension selector + source badge in EvidenceSearch"
```

---

## Task 3: Recall Feed — parse anchor + snippet from MCP output

**Files:**
- Modify: `packages/web/src/hooks/useRecallEvents.ts:15-19,65-93`
- Test: `packages/web/test/hooks/useRecallEvents.test.ts` (existing)

### Step 1: Write failing test — parseTextResults extracts anchor + snippet

MCP output format (evidence-tools.ts:116-119):
```
[confidence] title
  anchor: doc:decisions/xxx
  type: sourceType
  > snippet text here
```

Test that `parseTextResults` returns `{ title, confidence, sourceType, anchor, snippet }`.

### Step 2: Run test to verify it fails

### Step 3: Extend parser

Add `anchor?: string` and `snippet?: string` to `RecallResultItem` interface.

In `parseTextResults`, extend the lookahead loop to also capture:
- `^\s+anchor:\s+(.+)$` → `item.anchor`
- `^\s+>\s+(.+)$` → `item.snippet`

### Step 4: Run test to verify it passes

### Step 5: Commit

```bash
git commit -m "feat(F102): RecallFeed parser extracts anchor + snippet"
```

---

## Task 4: Recall Feed — display snippet + drill-down link

**Files:**
- Modify: `packages/web/src/components/memory/RecallFeed.tsx:28-41`

### Step 1: Write failing test — RecallCard renders snippet + link

### Step 2: Run test to verify it fails

### Step 3: Implement snippet display + drill-down

In RecallCard, after the sourceType badge + title line, add:
```tsx
{r.snippet && (
  <p className="mt-0.5 text-[10px] text-cafe-secondary/80 line-clamp-2">
    {r.snippet}
  </p>
)}
```

Add drill-down link: clicking a result navigates to `/memory/search?q={event.query}`:
```tsx
<Link href={`/memory/search?q=${encodeURIComponent(event.query)}`}>
  搜索详情 →
</Link>
```

### Step 4: Run test to verify it passes

### Step 5: Commit

```bash
git commit -m "feat(F102): RecallFeed snippet display + drill-down link"
```

---

## Task 5: Integration — biome format + quality gate

### Step 1: Run biome check

```bash
pnpm check
```

### Step 2: Run full test suite

```bash
pnpm --filter @cat-cafe/api test:redis
```

### Step 3: Run pnpm gate

```bash
pnpm gate
```

### Step 4: Commit any format fixes

---

## Summary

| Task | What | Files Changed |
|------|------|---------------|
| 1 | Backend dimension + source | interfaces.ts, KnowledgeResolver.ts, evidence.ts, evidence-helpers.ts |
| 2 | Frontend dimension selector | EvidenceSearch.tsx |
| 3 | Recall parser anchor+snippet | useRecallEvents.ts |
| 4 | Recall UI snippet+drill-down | RecallFeed.tsx |
| 5 | Quality gate | format + tests |

**Total estimated new tests:** ~10 (5 dimension routing + 2 parser + 3 UI)
