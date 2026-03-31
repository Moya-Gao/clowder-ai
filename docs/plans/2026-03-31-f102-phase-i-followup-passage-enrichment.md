---
feature_ids: [F102]
related_features: [F024]
topics: [memory, passage, search, enrichment, context-window]
doc_kind: plan
created: 2026-03-31
---

# F102 Phase I Follow-up: Passage Enrichment + Context Window

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** 让猫和人能从 passage 搜索结果定位到具体消息——返回时间戳、passageId、上下文窗口
**Acceptance Criteria:**
- AC-I7: `searchPassages()` 返回 `createdAt`、`passageId`
- AC-I8: `searchPassages()` 支持上下文窗口参数（前后 N 条 passage）
- AC-I9: MCP `search_evidence(depth=raw)` 返回 passage 级细节（speaker + timestamp + 上下文）
- AC-I10: CLAUDE.md / SystemPromptBuilder 中 `search_evidence` 用法指南更新
**Architecture:** 在现有 `searchPassages()` 基础上扩展返回字段 + 上下文查询，API 层增加 passages 结构化返回，MCP 层格式化展示
**Tech Stack:** SQLite (better-sqlite3), FTS5, Fastify, Zod, MCP tools
**前端验证:** No — 纯后端 + MCP 改动

---

## Terminal Schema

```typescript
// PassageResult — enriched (AC-I7)
export interface PassageResult {
  docAnchor: string;
  passageId: string;
  content: string;
  speaker?: string;
  position?: number;
  createdAt?: string;           // NEW: ISO8601 timestamp
  context?: PassageResult[];    // NEW: surrounding passages (AC-I8)
}

// EvidenceResult — with passage detail (AC-I9)
export interface EvidenceResult {
  title: string;
  anchor: string;
  snippet: string;
  confidence: EvidenceConfidence;
  sourceType: EvidenceSourceType;
  passages?: PassageDetail[];   // NEW: when depth=raw
}

export interface PassageDetail {
  passageId: string;
  speaker?: string;
  content: string;
  createdAt?: string;
  context?: PassageDetail[];
}
```

## What We're NOT Building

- No passage-level vector search (Phase C scope)
- No frontend UI changes (Phase J scope)
- No new MCP tools — enriching existing `search_evidence` response

---

## Task 1: AC-I7 — searchPassages() returns createdAt

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts:15-21` (PassageResult interface)
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts:548-584` (searchPassages SQL + mapping)
- Test: `packages/api/test/memory/passage-permanence.test.js`

**Step 1: Write failing test**

```javascript
it('searchPassages returns createdAt and passageId fields (AC-I7)', () => {
  // Insert a passage with known created_at
  const db = store.getDb();
  db.exec("INSERT INTO evidence_docs (anchor, kind, status, title, updated_at) VALUES ('thread-t1', 'session', 'active', 'Test', '2026-03-31')");
  db.exec("INSERT INTO evidence_passages (doc_anchor, passage_id, content, speaker, position, created_at) VALUES ('thread-t1', 'msg-001', 'Redis config discussion', 'user', 0, '2026-03-31T10:00:00Z')");
  // Sync FTS
  db.exec("INSERT INTO passage_fts(rowid, content) SELECT rowid, content FROM evidence_passages");

  const results = store.searchPassages('Redis config');
  assert.ok(results.length >= 1);
  assert.equal(results[0].passageId, 'msg-001');
  assert.equal(results[0].createdAt, '2026-03-31T10:00:00Z');
});
```

**Step 2: Run test — expect FAIL** (createdAt is undefined)

Run: `cd packages/api && node --test test/memory/passage-permanence.test.js`

**Step 3: Implement**

In `PassageResult` interface, add `createdAt?: string`.

In `searchPassages()` SQL, add `p.created_at` to SELECT. In row type, add `created_at: string | null`. In mapping, add `createdAt: r.created_at ?? undefined`.

**Step 4: Run test — expect PASS**

**Step 5: Commit**

---

## Task 2: AC-I8 — Context window parameter

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts:534-589` (searchPassages method)
- Test: `packages/api/test/memory/passage-permanence.test.js`

**Step 1: Write failing test**

```javascript
it('searchPassages returns context window around match (AC-I8)', () => {
  const db = store.getDb();
  db.exec("INSERT INTO evidence_docs (anchor, kind, status, title, updated_at) VALUES ('thread-ctx', 'session', 'active', 'Context test', '2026-03-31')");

  // 5 passages in order
  const passages = [
    ['msg-a', 'Hello how are you', 'user', 0, '2026-03-31T10:00:00Z'],
    ['msg-b', 'Fine thanks', 'opus', 1, '2026-03-31T10:01:00Z'],
    ['msg-c', 'Tell me about Redis caching', 'user', 2, '2026-03-31T10:02:00Z'],  // ← match
    ['msg-d', 'Redis caching works like this', 'opus', 3, '2026-03-31T10:03:00Z'],
    ['msg-e', 'Thanks that helps', 'user', 4, '2026-03-31T10:04:00Z'],
  ];
  const stmt = db.prepare('INSERT INTO evidence_passages (doc_anchor, passage_id, content, speaker, position, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  for (const p of passages) stmt.run('thread-ctx', ...p);
  db.exec("INSERT INTO passage_fts(rowid, content) SELECT rowid, content FROM evidence_passages");

  const results = store.searchPassages('Redis caching', 10, undefined, { contextWindow: 1 });
  assert.ok(results.length >= 1);
  const match = results[0];
  assert.ok(match.context, 'context should be present');
  assert.ok(match.context.length >= 2, 'should have at least prev + next');
  // Context should include msg-b (pos 1) and msg-d (pos 3) around the match at pos 2
  const contextIds = match.context.map(c => c.passageId);
  assert.ok(contextIds.includes('msg-b'), 'should include previous passage');
  assert.ok(contextIds.includes('msg-d') || contextIds.includes('msg-e'), 'should include next passage');
});
```

**Step 2: Run test — expect FAIL** (no contextWindow parameter)

**Step 3: Implement**

Add `options?: { contextWindow?: number }` as 4th parameter to `searchPassages()`.

After fetching FTS matches, if `contextWindow > 0`:
```typescript
const contextStmt = this.db!.prepare(
  `SELECT doc_anchor, passage_id, content, speaker, position, created_at
   FROM evidence_passages
   WHERE doc_anchor = ? AND position BETWEEN ? AND ? AND passage_id != ?
   ORDER BY position`
);
for (const r of results) {
  if (r.position != null) {
    const ctx = contextStmt.all(r.docAnchor, r.position - contextWindow, r.position + contextWindow, r.passageId);
    r.context = ctx.map(mapRow);
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

---

## Task 3: AC-I9 — API + MCP return passage-level detail

**Files:**
- Modify: `packages/api/src/routes/evidence-helpers.ts:8-15` (EvidenceResult type — add passages field)
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts:210-228` (search depth=raw path)
- Modify: `packages/api/src/routes/evidence.ts:69-80` (include passages in response)
- Modify: `packages/mcp-server/src/tools/evidence-tools.ts:60-95` (format passage detail)
- Test: `packages/api/test/memory/passage-permanence.test.js`

**Step 1: Write failing test**

```javascript
it('search with depth=raw returns structured passages (AC-I9)', async () => {
  const db = store.getDb();
  db.exec("INSERT INTO evidence_docs (anchor, kind, status, title, summary, updated_at) VALUES ('thread-raw', 'session', 'active', 'Raw test', 'A thread', '2026-03-31')");
  db.exec("INSERT INTO evidence_passages (doc_anchor, passage_id, content, speaker, position, created_at) VALUES ('thread-raw', 'msg-r1', 'Redis pipeline optimization', 'user', 0, '2026-03-31T11:00:00Z')");
  db.exec("INSERT INTO passage_fts(rowid, content) SELECT rowid, content FROM evidence_passages WHERE doc_anchor = 'thread-raw'");

  const results = await store.search('Redis pipeline', { depth: 'raw', scope: 'threads', limit: 5 });
  assert.ok(results.length >= 1);
  const hit = results.find(r => r.anchor === 'thread-raw');
  assert.ok(hit, 'should find thread-raw');
  assert.ok(hit.passages, 'should have passages array');
  assert.ok(hit.passages.length >= 1);
  assert.equal(hit.passages[0].passageId, 'msg-r1');
  assert.equal(hit.passages[0].speaker, 'user');
  assert.equal(hit.passages[0].createdAt, '2026-03-31T11:00:00Z');
});
```

**Step 2: Run test — expect FAIL** (no passages field on EvidenceItem)

**Step 3: Implement**

3a. Add to `EvidenceItem` interface in `interfaces.ts`:
```typescript
passages?: Array<{
  passageId: string;
  content: string;
  speaker?: string;
  createdAt?: string;
  context?: Array<{ passageId: string; content: string; speaker?: string; createdAt?: string }>;
}>;
```

3b. In `search()` depth=raw path, collect passages per docAnchor instead of flattening to summary:
```typescript
// Group passages by docAnchor
const passagesByAnchor = new Map<string, PassageResult[]>();
for (const p of passages) {
  const arr = passagesByAnchor.get(p.docAnchor) ?? [];
  arr.push(p);
  passagesByAnchor.set(p.docAnchor, arr);
}
// Attach to result items
for (const [anchor, pList] of passagesByAnchor) {
  // find or create the parent doc result
  // attach pList as item.passages
}
```

3c. In `evidence.ts` route, include passages in response when present.

3d. In MCP handler, format passages as structured text:
```
  passages:
    [0] user (2026-03-31T11:00:00Z): Redis pipeline optimization
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

---

## Task 4: AC-I10 — CLAUDE.md + SystemPromptBuilder guidance

**Files:**
- Modify: `CLAUDE.md` (search_evidence usage section)
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts:207-213`
- Test: `node --test test/system-prompt-builder.test.js` (per CLAUDE.md rule)

**Step 1: Update SystemPromptBuilder** — add depth=raw guidance for message-level search:
```
- cat_cafe_search_evidence: **首选入口** — 搜索项目知识库（决策/讨论/教训/phase history）。
  用 depth=raw 可定位到具体消息（返回 speaker + timestamp + 上下文窗口）
```

**Step 2: Update CLAUDE.md** — in 检索策略 table, add row:
```
| 具体消息定位 | `search_evidence("redis config", depth="raw", scope="threads")` | `depth=raw` |
```

**Step 3: Run SystemPromptBuilder test**

Run: `cd packages/api && node --test test/system-prompt-builder.test.js`

**Step 4: Commit**

---

## Summary

| Task | AC | Files changed | Estimated |
|------|----|---------------|-----------|
| 1 | I7 | SqliteEvidenceStore + test | 小 |
| 2 | I8 | SqliteEvidenceStore + test | 中 |
| 3 | I9 | interfaces + Store + route + MCP + test | 中 |
| 4 | I10 | CLAUDE.md + SystemPromptBuilder + test | 小 |

Total: ~4 tasks, all within existing files. No new files except tests appended to `passage-permanence.test.js`.
