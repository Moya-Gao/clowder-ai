---
feature_ids: [F102]
topics: [memory, passages, permanence, transcript, search]
doc_kind: plan
created: 2026-03-30
---

# F102 Phase I — Message-Level Permanence Repair

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** Make passage indexing truly permanent by backing it with JSONL transcripts, not just Redis (7-day TTL default)
**Acceptance Criteria:** AC-I1 ~ AC-I6（详见 feat doc）
**Architecture:** Change indexPassages() from delete-all-then-insert to incremental merge (INSERT OR IGNORE). Add JSONL transcript backfill for threads where Redis messages have expired. Add dateFrom/dateTo time filtering to SearchOptions.
**Tech Stack:** SQLite, FTS5, Node.js fs (readline/readdir), existing TranscriptReader patterns
**前端验证:** No — pure backend

---

## Straight-Line Check

**Finish line:** `indexPassages()` never deletes passages on rebuild. JSONL transcripts serve as cold-source backup. Time-range queries work. Hot path (<5ms) unchanged.

**NOT building:** Full JSONL→message reconstruction (too complex, diminishing returns). Changing how messages are stored in Redis. Changing TranscriptWriter format. Any frontend changes.

**Terminal schema additions:**
- `SearchOptions` gains `dateFrom?: string` and `dateTo?: string` (ISO8601)
- `IndexBuilder` gains `backfillPassagesFromTranscript(threadId)` method
- No new tables, no schema migration

---

## Task 1: Stop Deleting Passages on Rebuild (AC-I2)

The highest-value change. Currently `indexPassages()` does `DELETE FROM evidence_passages WHERE doc_anchor = ?` before inserting. This means expired Redis messages → passages disappear on rebuild.

**Files:**
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts:786-824`
- Test: `packages/api/test/memory/index-builder.test.js`

**Step 1: Write the failing test**

```javascript
it('rebuild does not delete existing passages when Redis returns fewer messages', async () => {
  // Setup: create IndexBuilder with messageListFn that returns 3 messages
  // Run indexPassages → verify 3 passages exist
  // Change messageListFn to return only 1 message (simulating Redis expiry)
  // Run indexPassages again
  // Assert: all 3 passages still exist (not just 1)
});
```

**Step 2: Run test — expect FAIL** (current code deletes passages before re-inserting)

**Step 3: Modify indexPassages()**

```typescript
// REMOVE this line:
// deleteByAnchorStmt.run(`thread-${thread.id}`);

// CHANGE INSERT OR REPLACE to INSERT OR IGNORE:
const upsertStmt = db.prepare(`
  INSERT OR IGNORE INTO evidence_passages
  (doc_anchor, passage_id, content, speaker, position, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
```

Key behavior change:
- `INSERT OR IGNORE`: if `(doc_anchor, passage_id)` already exists, skip (keep old data)
- No DELETE: old passages from expired Redis messages persist
- New messages from Redis still get added

**Step 4: Run test — expect PASS**

**Step 5: Commit** `feat(memory): stop deleting passages on rebuild (AC-I2)`

---

## Task 2: JSONL Transcript Passage Backfill (AC-I1)

Add a method to read JSONL events and create passages for content that isn't in SQLite yet.

**Files:**
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts` (add `backfillPassagesFromTranscript`)
- Test: `packages/api/test/memory/index-builder.test.js`

**Step 1: Write the failing test**

```javascript
it('backfillPassagesFromTranscript adds passages from JSONL events', async () => {
  // Setup: create a mock JSONL directory structure:
  //   threads/<threadId>/<catId>/sessions/<sessionId>/events.jsonl
  // Write JSONL events with type='text' content
  // Run backfillPassagesFromTranscript(threadId)
  // Assert: passages exist in evidence_passages with transcript-sourced passage_ids
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement backfillPassagesFromTranscript()**

```typescript
async backfillPassagesFromTranscript(threadId: string): Promise<number> {
  if (!this.transcriptDataDir) return 0;
  const db = this.store.getDb();
  const threadDir = join(this.transcriptDataDir, 'threads', threadId);

  // Check if thread directory exists
  let catDirs: string[];
  try {
    catDirs = await readdir(threadDir);
  } catch { return 0; }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO evidence_passages
    (doc_anchor, passage_id, content, speaker, position, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let added = 0;
  let position = 10000; // offset to avoid collision with Redis-sourced positions (0-based)

  for (const catId of catDirs) {
    const sessionsDir = join(threadDir, catId, 'sessions');
    let sessionDirs: string[];
    try { sessionDirs = await readdir(sessionsDir); } catch { continue; }

    for (const sessionId of sessionDirs) {
      const eventsPath = join(sessionsDir, sessionId, 'events.jsonl');
      let content: string;
      try { content = await readFile(eventsPath, 'utf-8'); } catch { continue; }

      // Accumulate text chunks by invocationId
      const invocationTexts = new Map<string, { text: string; t: number; catId: string }>();

      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          if (evt.event?.type === 'text' && typeof evt.event?.content === 'string') {
            const invId = evt.invocationId ?? `${sessionId}-noninv`;
            const existing = invocationTexts.get(invId);
            if (existing) {
              existing.text += evt.event.content;
            } else {
              invocationTexts.set(invId, {
                text: evt.event.content,
                catId: evt.catId ?? catId,
                t: evt.t,
              });
            }
          }
        } catch { /* skip malformed */ }
      }

      // Insert accumulated text per invocation as passages
      const tx = db.transaction(() => {
        for (const [invId, data] of invocationTexts) {
          if (!data.text.trim()) continue;
          insertStmt.run(
            `thread-${threadId}`,
            `transcript-${invId}`,
            data.text,
            data.catId,
            position++,
            new Date(data.t).toISOString(),
          );
          added++;
        }
      });
      tx();
    }
  }
  return added;
}
```

Key design decisions:
- **passage_id = `transcript-{invocationId}`** — different namespace from Redis-sourced `msg-{messageId}`, no collision
- **Text chunks aggregated by invocationId** — one passage per cat invocation, not per streaming chunk
- **INSERT OR IGNORE** — idempotent, safe to run repeatedly
- **position offset 10000** — avoids interleaving with Redis-sourced positions (0-based)

**Step 4: Run test — expect PASS**

**Step 5: Commit** `feat(memory): add JSONL transcript passage backfill (AC-I1)`

---

## Task 3: Integrate Backfill into rebuild() (AC-I1, AC-I3)

Wire the backfill into the rebuild flow so it runs automatically.

**Files:**
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts:274-283`
- Test: `packages/api/test/memory/index-builder.test.js`

**Step 1: Write the failing test**

```javascript
it('rebuild runs transcript backfill after Redis-based passage indexing', async () => {
  // Setup: empty messageListFn (simulating all Redis expired)
  // But JSONL transcript exists with text events
  // Run rebuild()
  // Assert: passages from JSONL exist in evidence_passages
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Add backfill call after indexPassages in rebuild()**

```typescript
// Phase E-3: Index thread message passages
if (this.messageListFn && this.threadListFn && !threadListFailed) {
  // ... existing indexPassages(threads) call ...
  await this.indexPassages(threads);

  // Phase I: Backfill from JSONL transcripts for threads with expired Redis messages
  if (this.transcriptDataDir) {
    for (const thread of threads) {
      await this.backfillPassagesFromTranscript(thread.id);
    }
  }
}
```

Hot path is unchanged (AC-I3): normal append → dirty-thread → flush still goes Redis → passage. Backfill only runs during `rebuild()`.

**Step 4: Run test — expect PASS**

**Step 5: Run full existing test suite** to ensure no regressions: `pnpm --filter @cat-cafe/api test:memory`

**Step 6: Commit** `feat(memory): integrate transcript backfill into rebuild (AC-I1/I3)`

---

## Task 4: Add dateFrom/dateTo to SearchOptions (AC-I4)

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts:83-94`
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (search + searchPassages)
- Modify: `packages/api/src/domains/memory/evidence-tools.ts` (MCP schema)
- Test: `packages/api/test/memory/index-builder.test.js` or new test file

**Step 1: Write the failing test**

```javascript
it('search filters by dateFrom/dateTo', async () => {
  // Setup: insert passages with different created_at timestamps
  // Search with dateFrom='2026-03-15' dateTo='2026-03-20'
  // Assert: only passages within range returned
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Add dateFrom/dateTo to SearchOptions**

```typescript
// interfaces.ts
export interface SearchOptions {
  kind?: EvidenceKind;
  status?: EvidenceStatus;
  keywords?: string[];
  limit?: number;
  scope?: 'docs' | 'memory' | 'threads' | 'sessions' | 'all';
  mode?: 'lexical' | 'semantic' | 'hybrid';
  depth?: 'summary' | 'raw';
  dateFrom?: string; // ISO8601, inclusive
  dateTo?: string;   // ISO8601, inclusive
}
```

**Step 4: Add SQL filtering in SqliteEvidenceStore**

In `search()`: add `AND updatedAt >= ? AND updatedAt <= ?` clauses when dateFrom/dateTo present.
In `searchPassages()`: add `AND p.created_at >= ? AND p.created_at <= ?` clauses.

**Step 5: Update MCP tool schema**

In `evidence-tools.ts`, add `dateFrom` and `dateTo` string parameters to `searchEvidenceInputSchema`.

**Step 6: Run test — expect PASS**

**Step 7: Commit** `feat(memory): add dateFrom/dateTo time filtering to search (AC-I4)`

---

## Task 5: TTL Documentation (AC-I5)

**Files:**
- Modify: `packages/api/src/config/env-registry.ts:300-305`

**Step 1: Update env-registry description**

```typescript
// Current:
{ description: '消息过期时间', defaultValue: '604800 (7天)' }

// New:
{
  description: '消息过期时间（秒）。默认 604800（7天）。' +
    '设为 0 或负数 → 消息永不过期。' +
    '注意：过期的 Redis 消息不影响已索引的 evidence_passages（Phase I 保证永久性）。',
  defaultValue: '604800 (7天)',
}
```

**Step 2: Commit** `docs(memory): clarify MESSAGE_TTL_SECONDS behavior (AC-I5)`

---

## Task 6: Regression Test — Redis Expiry Scenario (AC-I6)

End-to-end test validating the full permanence guarantee.

**Files:**
- Test: `packages/api/test/memory/passage-permanence.test.js` (new)

**Step 1: Write the test**

```javascript
describe('passage permanence (Phase I regression)', () => {
  it('rebuild recovers passages from JSONL when Redis messages expired', async () => {
    // 1. Create IndexBuilder with messageListFn returning 5 messages
    // 2. Create matching JSONL transcript files with text events
    // 3. Run rebuild() → verify 5+ passages exist
    // 4. Change messageListFn to return 0 messages (all expired)
    // 5. Run rebuild() again
    // 6. Assert: original passages still exist (from Task 1: no delete)
    // 7. Assert: transcript-sourced passages also exist (from Task 2: backfill)
  });

  it('hot path passage insertion is under 5ms', async () => {
    // Benchmark: single INSERT OR IGNORE into evidence_passages
    // Assert: < 5ms per message
  });
});
```

**Step 2: Run test — expect PASS** (all prior tasks should make this green)

**Step 3: Commit** `test(memory): add passage permanence regression test (AC-I6)`

---

## Execution Order

```
Task 1 (no-delete) → Task 2 (backfill method) → Task 3 (integrate)
  → Task 4 (time filter) → Task 5 (docs) → Task 6 (regression)
```

Each task is independently committable. Tasks 1-3 are the core permanence fix. Task 4 is the search enhancement. Tasks 5-6 are documentation and verification.

## Post-Implementation

- Run `pnpm gate` (or equivalent subset for api package)
- Load `quality-gate` for self-check
- Load `request-review` → send to 砚砚
