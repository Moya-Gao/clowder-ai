---
feature_ids: [F148]
doc_kind: plan
created: 2026-04-01
---

# F148 Phase B: Self-Serve Retrieval Enhancement — Implementation Plan

**Feature:** F148 — `docs/features/F148-hierarchical-context-transport.md`
**Goal:** 增强猫猫的主动检索能力，让 L4（self-service）成为真承诺：search_evidence 支持 threadId 过滤，get_thread_context keyword 有排序能力，两个工具边界清晰
**Acceptance Criteria:**
- AC-B1: search_evidence 支持 threadId 过滤参数
- AC-B2: get_thread_context keyword 有排序/相关性能力
- AC-B3: 两个工具边界清晰（找 vs 看），无功能重叠
**Architecture:** 三层改动：SearchOptions + SqliteEvidenceStore（threadId filter on anchor prefix）, callbacks.ts（keyword → tokenized BM25-like scoring）, MCP tool schema（参数+描述）
**Tech Stack:** SQLite FTS5, TypeScript
**前端验证:** No — 纯后端 API + MCP 工具

---

## Finish Line

猫猫可以说 `search_evidence("Redis CAS", threadId="thread_abc")` 只搜某个 thread 的知识；可以用 `get_thread_context(keyword="Redis")` 拿到按相关性排序的消息（不是随机 substring match）。两个工具互不重叠：search_evidence = "跨项目找知识"，get_thread_context = "读某 thread 的消息"。

## What We're NOT Building

- 不改 evidence.sqlite schema（不加新列/新表，v1 用 anchor prefix filter）
- 不做 semantic/vector search for get_thread_context（keyword 升级到 token scoring 就够）
- 不改 evidence ingestion pipeline

## Terminal Schema

```typescript
// SearchOptions 增加 threadId
interface SearchOptions {
  // ... existing fields ...
  threadId?: string; // Phase B (AC-B1): filter evidence by thread
}

// get_thread_context keyword response 增加 relevance
interface ThreadContextMessage {
  // ... existing fields ...
  relevanceScore?: number; // Phase B (AC-B2): keyword relevance score (0-1)
}
```

---

## Task 1: AC-B1 — search_evidence threadId filter

### Files
- Modify: `packages/api/src/domains/memory/interfaces.ts:97-114` — add `threadId` to SearchOptions
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts:60-200` — apply threadId filter in search queries
- Modify: `packages/api/src/routes/evidence.ts:13-22` — add `threadId` to Zod schema
- Modify: `packages/mcp-server/src/tools/evidence-tools.ts:15-38` — add `threadId` to MCP tool schema
- Test: `packages/api/test/f148-search-evidence-threadid.test.js`

### Design

Evidence anchor convention:
- Thread digest: `anchor = 'thread-{threadId}'`
- Session digest: `anchor = 'session-{sessionId}'`

When `threadId` is provided:
1. Anchor-exact path: `WHERE anchor = 'thread-{threadId}'`
2. FTS5 path: `AND d.anchor = 'thread-{threadId}'`
3. Passage search: `AND p.doc_anchor = 'thread-{threadId}'`

This scopes to the thread's evidence entry. Simple, no schema migration.

### Step 1: Write failing test — threadId filter returns only matching thread evidence

```javascript
test('search with threadId returns only that thread evidence', async () => {
  // Insert two thread evidences
  await store.upsert([
    { anchor: 'thread-abc', kind: 'thread', status: 'active', title: 'Redis CAS discussion', summary: 'Redis optimistic locking', keywords: ['redis', 'cas'] },
    { anchor: 'thread-xyz', kind: 'thread', status: 'active', title: 'Deploy pipeline', summary: 'CI/CD setup', keywords: ['deploy'] },
  ]);
  const results = await store.search('Redis', { threadId: 'thread_abc' });
  assert.equal(results.length, 1);
  assert.equal(results[0].anchor, 'thread-abc');
});
```

### Step 2: Run test — confirm FAIL (threadId not recognized)

### Step 3: Implement threadId filter in SearchOptions + SqliteEvidenceStore

Add `threadId?: string` to SearchOptions.

In SqliteEvidenceStore.search(), when `options.threadId`:
- Derive `threadAnchor = 'thread-' + threadId.replace(/^thread[-_]/, '')`
- Add `AND anchor = ?` with threadAnchor to all SQL paths (exact, FTS5, keyword fallback)

### Step 4: Run test — confirm GREEN

### Step 5: Write failing test — threadId filter in passage search (depth=raw)

### Step 6: Implement passage filter

### Step 7: Wire threadId through API route + MCP tool schema

Add to `searchSchema` in evidence.ts: `threadId: z.string().optional()`
Pass to searchOpts in handler.
Add to MCP tool input schema in evidence-tools.ts.
Add to MCP handler param forwarding.

### Step 8: Commit

```
feat(F148): AC-B1 — search_evidence threadId filter
```

---

## Task 2: AC-B2 — get_thread_context keyword ranking

### Files
- Modify: `packages/api/src/routes/callbacks.ts:787` — replace `.includes()` with tokenized scoring
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:109-129` — update description for ranking
- Test: `packages/api/test/f148-keyword-ranking.test.js`

### Design

Replace substring match with token-based scoring:

1. Tokenize keyword into terms: `"Redis CAS"` → `["redis", "cas"]`
2. For each message, compute score: `matchedTerms / totalTerms` (0-1)
3. Messages with score > 0 pass filter
4. Sort by score descending (most relevant first)
5. Return `relevanceScore` in response

This is a minimal upgrade from boolean `.includes()` to ranked output without importing a heavy library.

### Step 1: Write failing test — keyword ranking returns sorted results

```javascript
test('keyword "Redis CAS" ranks exact match above partial', async () => {
  // msg1: contains "Redis" only
  // msg2: contains "Redis CAS" both terms
  // msg3: no match
  // Expect: msg2 first (score 1.0), msg1 second (score 0.5), msg3 absent
});
```

### Step 2: Run test — confirm FAIL

### Step 3: Implement `scoreKeywordRelevance(content, terms)` pure function

```typescript
export function scoreKeywordRelevance(content: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const lower = content.toLowerCase();
  const matched = terms.filter(t => lower.includes(t)).length;
  return matched / terms.length;
}
```

### Step 4: Replace `.includes()` in callbacks.ts with scoring + sorting

```typescript
// Before: if (normalizedKeyword && !item.content.toLowerCase().includes(normalizedKeyword)) return false;
// After:
if (keywordTerms.length > 0) {
  const score = scoreKeywordRelevance(item.content, keywordTerms);
  if (score === 0) return false;
  item._relevanceScore = score;
}
// Then sort collected items by _relevanceScore descending
```

### Step 5: Run test — confirm GREEN

### Step 6: Wire relevanceScore into API response

### Step 7: Commit

```
feat(F148): AC-B2 — get_thread_context keyword ranking
```

---

## Task 3: AC-B3 — Tool boundary clarity

### Files
- Modify: `packages/mcp-server/src/tools/evidence-tools.ts` — update tool description
- Modify: `packages/mcp-server/src/tools/callback-tools.ts` — update tool description
- Test: `packages/api/test/f148-tool-boundary.test.js` (optional — description assertions)

### Design

Update MCP tool descriptions to clearly delineate:
- **search_evidence**: "Search project knowledge base — features, decisions, plans, lessons, session history. Use this to FIND information across the project. For reading a specific thread's messages, use get_thread_context instead."
- **get_thread_context**: "Read messages from a thread. Use this to READ/BROWSE a specific conversation. For searching across project knowledge, use search_evidence instead."

Add `threadId` parameter description to search_evidence:
- "Filter results to a specific thread. When provided, only returns evidence from that thread's digest and passages."

### Step 1: Update descriptions

### Step 2: Verify no functional overlap — search_evidence(threadId) searches evidence INDEX (digests/summaries), get_thread_context reads RAW MESSAGES

### Step 3: Commit

```
feat(F148): AC-B3 — tool boundary descriptions (search_evidence finds, get_thread_context reads)
```

---

## Task 4: Integration test + Biome + quality-gate

### Step 1: Run full test suite
### Step 2: Biome check + fix
### Step 3: Build verification
### Step 4: Commit any fixes
