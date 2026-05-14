# F200 Phase A: Search Session Telemetry — Implementation Plan

**Feature:** F200 — `docs/features/F200-memory-recall-eval.md`
**Goal:** Instrument every memory tool call (search_evidence / graph_resolve / list_recent) with a RecallEvent that captures candidates + consumption signals, enabling Phase B metrics and Phase C ranking improvements.
**Acceptance Criteria:**
- AC-A1: RecallEvent written to evidence.sqlite with candidates (targetRef union + docKind) + consumed
- AC-A2: consumed inferred via compound window (same_invocation + tool_call_distance≤20 + 300s cap) + target_match
- AC-A3: reformulated / fellBackToGrep / abandoned / nextGraphResolveAfterRead booleans correctly marked
- AC-A4: Health Dashboard exposes last-24h RecallEvent summary
- AC-A5: dwellProxy (Read → next tool call interval ms) recorded
**Architecture cell:** memory
**Map delta:** none
**Map delta why:** All changes are internal to the memory domain — new table + new correlator class + extended edges.
**Architecture:** RecallEvent correlation is a pure-backend pipeline: MCP tool handlers emit candidate metadata in tool_result → deriveResultSummary extracts it → RecallEventCorrelator reads ToolEventLog windows and writes RecallEvents to evidence.sqlite. No new MCP tools, no frontend.
**Tech Stack:** SQLite (evidence.sqlite V19), Redis (ToolEventLog read-only), TypeScript
**前端验证:** No — pure backend + MCP internal

---

## Plan Gate Resolutions

### PG-1: Schema — new `recall_events` table (not ToolEventLog columns)

**Decision:** New `recall_events` table in evidence.sqlite (V19 migration).

**Why not extend ToolEventLog (Redis)?**
- RecallEvents need 30d+ analytical queries (consumption_prior sliding window)
- Redis zset TTL is fire-and-forget; sqlite is durable
- ToolEventLog events are raw tool calls; RecallEvents are correlated sessions (1:N relationship)
- Aggregation queries (GROUP BY anchor, 30d windows) are SQLite's strength

**Why not add columns to evidence_docs?**
- RecallEvent is per-search-session, not per-document. Different cardinality.

### PG-2: target_match dispatch table

```
consumed.method        → targetRef.kind match
─────────────────────────────────────────────────────
Read                   → doc  (file_path contains sourcePath)
Grep                   → doc  (file_path contains sourcePath — only targeted grep, not rg fallback)
graph_resolve          → doc  (query matches anchor)
read_session_events    → session (sessionId match)
read_session_digest    → session (sessionId match)
read_invocation_detail → invocation (invocationId match)
get_thread_context     → thread (threadId match)
```

A consumed method can match multiple targetRef kinds (e.g., Read can match doc or passage if passage has sourcePath). The match function tries each candidate's targetRef and returns first hit.

### PG-3: Edge traversal columns — V19 migration

Add `traversal_count INTEGER DEFAULT 0` and `last_traversed_at TEXT` to edges table. Phase A starts recording traversals; Phase C will read them for edge_weight.

### PG-4: Shadow flag — `F200_CONSUMPTION_RERANK`

New file `f200-types.ts` following f163-types.ts pattern. Phase A ships with `off` default. Phase C will read `shadow`/`on`.

---

## Terminal Schema

### recall_events table (V19)

```sql
CREATE TABLE IF NOT EXISTS recall_events (
  recall_id TEXT PRIMARY KEY,
  cat_id TEXT NOT NULL,
  invocation_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  query TEXT NOT NULL,
  mode TEXT,
  scope TEXT,
  candidates_json TEXT NOT NULL,
  consumed_json TEXT NOT NULL,
  reformulated INTEGER NOT NULL DEFAULT 0,
  fell_back_to_grep INTEGER NOT NULL DEFAULT 0,
  abandoned INTEGER NOT NULL DEFAULT 0,
  next_graph_resolve_after_read INTEGER NOT NULL DEFAULT 0,
  token_cost INTEGER NOT NULL DEFAULT 0,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recall_events_cat ON recall_events(cat_id);
CREATE INDEX IF NOT EXISTS idx_recall_events_ts ON recall_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_recall_events_inv ON recall_events(invocation_id);
```

### edges table extensions (V19)

```sql
ALTER TABLE edges ADD COLUMN traversal_count INTEGER DEFAULT 0;
ALTER TABLE edges ADD COLUMN last_traversed_at TEXT;
```

### F200FlagSnapshot (f200-types.ts)

```typescript
export interface F200FlagSnapshot {
  consumptionRerank: 'off' | 'shadow' | 'on';
}

export function freezeF200Flags(): F200FlagSnapshot {
  return Object.freeze({
    consumptionRerank:
      (process.env.F200_CONSUMPTION_RERANK as 'off' | 'shadow' | 'on') ?? 'off',
  });
}
```

---

## Implementation Tasks

### Task 1: V19 migration — recall_events table + edge traversal columns

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts:68` (bump version) + append migration

**Step 1: Write failing test**

```typescript
// test/memory/schema-v19.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { applyMigrations, CURRENT_SCHEMA_VERSION } from '../../packages/api/src/domains/memory/schema.js';

describe('V19 migration', () => {
  test('creates recall_events table', () => {
    const db = new Database(':memory:');
    // ... apply V1 schema + migrations
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='recall_events'").all();
    assert.equal(tables.length, 1);
  });

  test('adds traversal columns to edges', () => {
    const db = new Database(':memory:');
    // ... apply V1 schema + migrations
    const cols = db.prepare("PRAGMA table_info('edges')").all() as Array<{ name: string }>;
    const names = cols.map(c => c.name);
    assert.ok(names.includes('traversal_count'));
    assert.ok(names.includes('last_traversed_at'));
  });

  test('CURRENT_SCHEMA_VERSION is 19', () => {
    assert.equal(CURRENT_SCHEMA_VERSION, 19);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/memory/schema-v19.test.ts`
Expected: FAIL (no recall_events table, version still 18)

**Step 3: Implement V19 migration**

In `schema.ts`:
- Change `CURRENT_SCHEMA_VERSION = 18` → `19`
- Append V19 migration block after V18:

```typescript
// V19: F200 Phase A — recall_events table + edge traversal columns
if (currentVersion < 19) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS recall_events (
        recall_id TEXT PRIMARY KEY,
        cat_id TEXT NOT NULL,
        invocation_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        query TEXT NOT NULL,
        mode TEXT,
        scope TEXT,
        candidates_json TEXT NOT NULL,
        consumed_json TEXT NOT NULL,
        reformulated INTEGER NOT NULL DEFAULT 0,
        fell_back_to_grep INTEGER NOT NULL DEFAULT 0,
        abandoned INTEGER NOT NULL DEFAULT 0,
        next_graph_resolve_after_read INTEGER NOT NULL DEFAULT 0,
        token_cost INTEGER NOT NULL DEFAULT 0,
        timestamp INTEGER NOT NULL
      )
    `);
  } catch {}
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_recall_events_cat ON recall_events(cat_id)');
  } catch {}
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_recall_events_ts ON recall_events(timestamp)');
  } catch {}
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_recall_events_inv ON recall_events(invocation_id)');
  } catch {}
  try {
    db.exec('ALTER TABLE edges ADD COLUMN traversal_count INTEGER DEFAULT 0');
  } catch {}
  try {
    db.exec('ALTER TABLE edges ADD COLUMN last_traversed_at TEXT');
  } catch {}
  db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(19, new Date().toISOString());
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/memory/schema-v19.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/schema.ts test/memory/schema-v19.test.ts
git commit -m "feat(F200): V19 migration — recall_events table + edge traversal columns [宪宪/Opus-46🐾]"
```

---

### Task 2: F200 types + shadow flag

**Files:**
- Create: `packages/api/src/domains/memory/f200-types.ts`

**Step 1: Write failing test**

```typescript
// test/memory/f200-types.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { freezeF200Flags } from '../../packages/api/src/domains/memory/f200-types.js';
import type { RecallEvent, TargetRef } from '../../packages/api/src/domains/memory/f200-types.js';

describe('F200 types', () => {
  test('freezeF200Flags defaults to off', () => {
    delete process.env.F200_CONSUMPTION_RERANK;
    const flags = freezeF200Flags();
    assert.equal(flags.consumptionRerank, 'off');
  });

  test('freezeF200Flags reads env', () => {
    process.env.F200_CONSUMPTION_RERANK = 'shadow';
    const flags = freezeF200Flags();
    assert.equal(flags.consumptionRerank, 'shadow');
    delete process.env.F200_CONSUMPTION_RERANK;
  });

  test('flags are frozen', () => {
    const flags = freezeF200Flags();
    assert.throws(() => { (flags as any).consumptionRerank = 'on'; });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/memory/f200-types.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement f200-types.ts**

```typescript
// F200: Memory Recall Eval types + experiment flags

export type RecallToolName = 'search_evidence' | 'graph_resolve' | 'list_recent';

export type TargetRef =
  | { kind: 'doc'; sourcePath: string }
  | { kind: 'thread'; threadId: string }
  | { kind: 'session'; sessionId: string }
  | { kind: 'invocation'; sessionId: string; invocationId: string }
  | { kind: 'passage'; passageId: string; threadId?: string; sessionId?: string };

export type ConsumedMethod =
  | 'Read' | 'Grep' | 'graph_resolve'
  | 'read_session_events' | 'read_session_digest'
  | 'read_invocation_detail' | 'get_thread_context';

export interface RecallCandidate {
  anchor: string;
  rank: number;
  score?: number;
  targetRef: TargetRef;
  docKind?: string;
  resultSetId?: string;
}

export interface ConsumedEntry {
  anchor: string;
  rank: number;
  method: ConsumedMethod;
  dwellProxy?: number;
}

export interface RecallEvent {
  recallId: string;
  catId: string;
  invocationId: string;
  toolName: RecallToolName;
  query: string;
  mode?: string;
  scope?: string;
  candidates: RecallCandidate[];
  consumed: ConsumedEntry[];
  reformulated: boolean;
  fellBackToGrep: boolean;
  abandoned: boolean;
  nextGraphResolveAfterRead: boolean;
  tokenCost: number;
  timestamp: number;
}

export interface F200FlagSnapshot {
  consumptionRerank: 'off' | 'shadow' | 'on';
}

export function freezeF200Flags(): F200FlagSnapshot {
  return Object.freeze({
    consumptionRerank:
      (process.env.F200_CONSUMPTION_RERANK as 'off' | 'shadow' | 'on') ?? 'off',
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/memory/f200-types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/f200-types.ts test/memory/f200-types.test.ts
git commit -m "feat(F200): RecallEvent types + F200 shadow flag [宪宪/Opus-46🐾]"
```

---

### Task 3: Enrich deriveResultSummary with candidate metadata

The MCP tool handlers already emit structured text in tool_result. `deriveResultSummary` parses it into summary fields that get merged into ToolEventLog. F200 needs candidate-level data (anchor + rank + targetRef) in the summary so the correlator can build RecallEvents.

**Approach:** Extend `deriveSearchEvidence`, `deriveGraphResolve`, `deriveListRecent` to also extract per-result anchor/sourcePath/kind data from the tool_result text. The MCP handlers already print structured blocks like:

```
[1] **Title** [high] (docs/features/F102-memory-adapter-refactor.md)
    anchor: F102  kind: feature
```

We parse these into `_f200Candidates: Array<{anchor, rank, sourcePath?, docKind?}>` in the summary.

**Files:**
- Modify: `packages/api/src/domains/cats/services/tool-usage/derive-result-summary.ts`

**Step 1: Write failing test**

```typescript
// test/tool-usage/derive-result-summary-f200.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deriveResultSummary } from '../../packages/api/src/domains/cats/services/tool-usage/derive-result-summary.js';

describe('F200 candidate extraction', () => {
  test('search_evidence extracts candidates with sourcePath', () => {
    const text = `Found 2 result(s) (mode: hybrid, variant: abc123)

[1] **Memory Adapter Refactor** [high] (docs/features/F102-memory-adapter-refactor.md)
    anchor: F102  kind: feature
    > Snippet text here

[2] **Library Stewardship** [mid] (docs/features/F188-library-stewardship.md)
    anchor: F188  kind: feature
    > Another snippet`;

    const summary = deriveResultSummary('search_evidence', text);
    assert.equal(summary['resultCount'], 2);
    const candidates = summary['_f200Candidates'] as Array<Record<string, unknown>>;
    assert.ok(candidates);
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0]!['anchor'], 'F102');
    assert.equal(candidates[0]!['rank'], 1);
    assert.equal(candidates[0]!['sourcePath'], 'docs/features/F102-memory-adapter-refactor.md');
    assert.equal(candidates[0]!['docKind'], 'feature');
  });

  test('graph_resolve extracts candidates from candidate list', () => {
    const text = `Candidates for "F200" (3 matches):

[0] F200 — Memory Recall Eval (docs/features/F200-memory-recall-eval.md)
[1] F192 — Socio-Technical Harness Eval (docs/features/F192-socio-technical-harness-eval.md)
[2] F153 — Observability Infrastructure (docs/features/F153-observability-infra.md)`;

    const summary = deriveResultSummary('graph_resolve', text);
    const candidates = summary['_f200Candidates'] as Array<Record<string, unknown>>;
    assert.ok(candidates);
    assert.equal(candidates.length, 3);
    assert.equal(candidates[0]!['anchor'], 'F200');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/tool-usage/derive-result-summary-f200.test.ts`
Expected: FAIL (_f200Candidates undefined)

**Step 3: Extend parsers**

Add candidate extraction to `deriveSearchEvidence` and `deriveGraphResolve`:

```typescript
// In deriveSearchEvidence, after existing parsing:
const candidates: Array<{ anchor: string; rank: number; sourcePath?: string; docKind?: string }> = [];
const resultBlockRe = /\[(\d+)\]\s+\*\*[^*]+\*\*\s+\[\w+\]\s+\(([^)]+)\)\s*\n\s*anchor:\s*(\S+)\s+kind:\s*(\S+)/g;
let rm: RegExpExecArray | null;
rm = resultBlockRe.exec(text);
while (rm !== null) {
  candidates.push({
    rank: Number.parseInt(rm[1]!, 10),
    sourcePath: rm[2],
    anchor: rm[3]!,
    docKind: rm[4],
  });
  rm = resultBlockRe.exec(text);
}
if (candidates.length > 0) summary['_f200Candidates'] = candidates;
```

Similar for graph_resolve candidates:

```typescript
// In deriveGraphResolve, after ranked anchor extraction:
const f200Candidates: Array<{ anchor: string; rank: number; sourcePath?: string }> = [];
const candLineRe = /\[(\d+)\]\s+([\w.:/-]+)\s+—\s+[^(]*\(([^)]+)\)/g;
let cm: RegExpExecArray | null;
cm = candLineRe.exec(text);
while (cm !== null) {
  f200Candidates.push({
    rank: Number.parseInt(cm[1]!, 10),
    anchor: cm[2]!,
    sourcePath: cm[3],
  });
  cm = candLineRe.exec(text);
}
if (f200Candidates.length > 0) summary['_f200Candidates'] = f200Candidates;
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/tool-usage/derive-result-summary-f200.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/tool-usage/derive-result-summary.ts test/tool-usage/derive-result-summary-f200.test.ts
git commit -m "feat(F200): enrich deriveResultSummary with candidate metadata [宪宪/Opus-46🐾]"
```

---

### Task 4: target_match function

**Files:**
- Create: `packages/api/src/domains/memory/recall-target-match.ts`

**Step 1: Write failing test**

```typescript
// test/memory/recall-target-match.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { targetMatch } from '../../packages/api/src/domains/memory/recall-target-match.js';

describe('targetMatch', () => {
  test('Read matches doc targetRef by sourcePath substring', () => {
    const ref = { kind: 'doc' as const, sourcePath: 'docs/features/F102-memory-adapter-refactor.md' };
    assert.ok(targetMatch('Read', { file_path: '/path/to/cat-cafe/docs/features/F102-memory-adapter-refactor.md' }, ref));
  });

  test('Read does not match unrelated doc', () => {
    const ref = { kind: 'doc' as const, sourcePath: 'docs/features/F102-memory-adapter-refactor.md' };
    assert.ok(!targetMatch('Read', { file_path: '/path/to/unrelated.md' }, ref));
  });

  test('get_thread_context matches thread targetRef', () => {
    const ref = { kind: 'thread' as const, threadId: 'thread-abc' };
    assert.ok(targetMatch('get_thread_context', { threadId: 'thread-abc' }, ref));
  });

  test('read_session_events matches session targetRef', () => {
    const ref = { kind: 'session' as const, sessionId: 'sess-123' };
    assert.ok(targetMatch('read_session_events', { sessionId: 'sess-123' }, ref));
  });

  test('read_invocation_detail matches invocation targetRef', () => {
    const ref = { kind: 'invocation' as const, sessionId: 's1', invocationId: 'inv-1' };
    assert.ok(targetMatch('read_invocation_detail', { invocationId: 'inv-1' }, ref));
  });

  test('Grep matches doc targetRef only for targeted grep', () => {
    const ref = { kind: 'doc' as const, sourcePath: 'docs/features/F102-memory-adapter-refactor.md' };
    assert.ok(targetMatch('Grep', { path: 'docs/features/F102-memory-adapter-refactor.md' }, ref));
    assert.ok(!targetMatch('Grep', { pattern: 'foo' }, ref)); // no path = untargeted
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/memory/recall-target-match.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement target_match**

```typescript
// F200: target_match — determines if a tool call consumed a specific candidate
import type { TargetRef, ConsumedMethod } from './f200-types.js';

export function targetMatch(
  method: ConsumedMethod | string,
  toolInput: Record<string, unknown>,
  ref: TargetRef,
): boolean {
  switch (method) {
    case 'Read': {
      if (ref.kind !== 'doc' && ref.kind !== 'passage') return false;
      const filePath = typeof toolInput['file_path'] === 'string' ? toolInput['file_path'] : '';
      const sourcePath = ref.kind === 'doc' ? ref.sourcePath : '';
      return sourcePath !== '' && filePath.includes(sourcePath);
    }
    case 'Grep': {
      if (ref.kind !== 'doc') return false;
      const grepPath = typeof toolInput['path'] === 'string' ? toolInput['path'] : '';
      return grepPath !== '' && grepPath.includes(ref.sourcePath);
    }
    case 'graph_resolve': {
      if (ref.kind !== 'doc') return false;
      const query = typeof toolInput['query'] === 'string' ? toolInput['query'] : '';
      return query !== '' && (query === ref.sourcePath || ref.sourcePath.includes(query));
    }
    case 'read_session_events':
    case 'read_session_digest': {
      if (ref.kind !== 'session' && ref.kind !== 'invocation') return false;
      const sid = typeof toolInput['sessionId'] === 'string' ? toolInput['sessionId'] : '';
      const refSid = ref.kind === 'session' ? ref.sessionId : ref.sessionId;
      return sid !== '' && sid === refSid;
    }
    case 'read_invocation_detail': {
      if (ref.kind !== 'invocation') return false;
      const invId = typeof toolInput['invocationId'] === 'string' ? toolInput['invocationId'] : '';
      return invId !== '' && invId === ref.invocationId;
    }
    case 'get_thread_context': {
      if (ref.kind !== 'thread') return false;
      const tid = typeof toolInput['threadId'] === 'string' ? toolInput['threadId'] : '';
      return tid !== '' && tid === ref.threadId;
    }
    default:
      return false;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/memory/recall-target-match.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/recall-target-match.ts test/memory/recall-target-match.test.ts
git commit -m "feat(F200): target_match dispatch for consumption detection [宪宪/Opus-46🐾]"
```

---

### Task 5: RecallEventCorrelator — core correlation logic

This is the heart of Phase A. It reads a ToolEventLog window for an invocation, identifies memory tool calls + subsequent drill-down tools, correlates them into RecallEvents using the compound window rule, and writes to sqlite.

**Files:**
- Create: `packages/api/src/domains/memory/RecallEventCorrelator.ts`

**Step 1: Write failing test**

```typescript
// test/memory/recall-event-correlator.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RecallEventCorrelator } from '../../packages/api/src/domains/memory/RecallEventCorrelator.js';
// ... mock ToolEventLog, mock sqlite db

describe('RecallEventCorrelator', () => {
  test('correlates search_evidence → Read into consumed entry', () => {
    // Setup: search_evidence event at turn 5 with _f200Candidates
    // Then: Read event at turn 7 matching candidate sourcePath
    // Expect: RecallEvent with consumed = [{ anchor, rank, method: 'Read' }]
  });

  test('respects tool_call_distance limit of 20', () => {
    // Setup: search at turn 5, Read matching candidate at turn 30
    // Expect: NOT consumed (distance = 25 > 20)
  });

  test('respects 300s wall-clock cap', () => {
    // Setup: search at t=1000, Read at t=1000+400000 (400s), distance=3
    // Expect: NOT consumed (wall_clock > 300s, even though distance <= 20)
  });

  test('respects invocation boundary', () => {
    // Setup: search in invocation A, Read in invocation B (same thread)
    // Expect: NOT consumed
  });

  test('marks reformulated when consecutive search_evidence calls', () => {
    // Setup: search at turn 5, search again at turn 8 (same invocation)
    // Expect: first RecallEvent has reformulated=true
  });

  test('marks fellBackToGrep when Bash grep follows search', () => {
    // Setup: search at turn 5, Bash with 'rg' at turn 8
    // Expect: RecallEvent.fellBackToGrep = true
  });

  test('marks abandoned when no consumed and no reformulation', () => {
    // Setup: search at turn 5, unrelated tools, invocation ends
    // Expect: abandoned = true
  });

  test('records dwellProxy as time between Read and next tool call', () => {
    // Setup: Read at t=5000, next tool at t=8000
    // Expect: dwellProxy = 3000
  });

  test('marks nextGraphResolveAfterRead', () => {
    // Setup: search → Read → graph_resolve
    // Expect: nextGraphResolveAfterRead = true
  });

  test('writes RecallEvent to sqlite', () => {
    // Verify recall_events row after correlation
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/memory/recall-event-correlator.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement RecallEventCorrelator**

```typescript
// F200 Phase A: Correlates ToolEventLog entries into RecallEvents

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { ToolEvent } from '../cats/services/tool-usage/event-log-types.js';
import type { RecallEvent, RecallCandidate, ConsumedEntry, ConsumedMethod, TargetRef } from './f200-types.js';
import { targetMatch } from './recall-target-match.js';

const MEMORY_TOOLS = new Set(['search_evidence', 'graph_resolve', 'list_recent']);
const CONSUMED_METHODS = new Set<string>([
  'Read', 'Grep', 'graph_resolve',
  'read_session_events', 'read_session_digest',
  'read_invocation_detail', 'get_thread_context',
]);
const MAX_TOOL_CALL_DISTANCE = 20;
const MAX_WALL_CLOCK_MS = 300_000;
const GREP_FALLBACK_PATTERNS = ['grep', 'rg ', 'ripgrep'];

export class RecallEventCorrelator {
  constructor(private readonly db: Database.Database) {}

  correlateWindow(events: ToolEvent[]): RecallEvent[] {
    const results: RecallEvent[] = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;
      if (!MEMORY_TOOLS.has(event.toolName)) continue;

      const candidates = this.extractCandidates(event);
      const windowEnd = this.findWindowEnd(events, i);
      const windowEvents = events.slice(i + 1, windowEnd + 1);

      const consumed = this.findConsumed(candidates, windowEvents, event);
      const reformulated = this.isReformulated(events, i);
      const fellBackToGrep = this.isFellBackToGrep(windowEvents, event);
      const abandoned = consumed.length === 0 && !reformulated;
      const nextGraphResolveAfterRead = this.hasGraphResolveAfterRead(windowEvents, event);

      results.push({
        recallId: randomUUID(),
        catId: event.catId,
        invocationId: event.invocationId,
        toolName: event.toolName as RecallEvent['toolName'],
        query: this.extractQuery(event),
        mode: (event.summary as Record<string, unknown>)?.['mode'] as string | undefined,
        scope: (event.summary as Record<string, unknown>)?.['scope'] as string | undefined,
        candidates,
        consumed,
        reformulated,
        fellBackToGrep,
        abandoned,
        nextGraphResolveAfterRead,
        tokenCost: 0,
        timestamp: event.timestamp,
      });
    }
    return results;
  }

  persistBatch(events: RecallEvent[]): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO recall_events
        (recall_id, cat_id, invocation_id, tool_name, query, mode, scope,
         candidates_json, consumed_json, reformulated, fell_back_to_grep,
         abandoned, next_graph_resolve_after_read, token_cost, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((batch: RecallEvent[]) => {
      for (const e of batch) {
        stmt.run(
          e.recallId, e.catId, e.invocationId, e.toolName,
          e.query, e.mode ?? null, e.scope ?? null,
          JSON.stringify(e.candidates), JSON.stringify(e.consumed),
          e.reformulated ? 1 : 0, e.fellBackToGrep ? 1 : 0,
          e.abandoned ? 1 : 0, e.nextGraphResolveAfterRead ? 1 : 0,
          e.tokenCost, e.timestamp,
        );
      }
    });
    tx(events);
  }

  // ... private helper methods (extractCandidates, findWindowEnd,
  //     findConsumed, isReformulated, isFellBackToGrep, etc.)
}
```

Key private methods:

- `extractCandidates(event)`: reads `event.summary._f200Candidates` → builds `RecallCandidate[]` with targetRef derived from sourcePath/anchor
- `findWindowEnd(events, startIdx)`: walks forward counting same-invocation events up to MAX_TOOL_CALL_DISTANCE or MAX_WALL_CLOCK_MS
- `findConsumed(candidates, windowEvents, sourceEvent)`: for each window event that's a CONSUMED_METHOD, checks `targetMatch` against each candidate; records dwellProxy
- `isReformulated(events, idx)`: next same-cat memory tool call within 3 steps
- `isFellBackToGrep(windowEvents)`: Bash with grep patterns
- `hasGraphResolveAfterRead(windowEvents)`: Read then graph_resolve in window

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/memory/recall-event-correlator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/RecallEventCorrelator.ts test/memory/recall-event-correlator.test.ts
git commit -m "feat(F200): RecallEventCorrelator — compound window + target_match [宪宪/Opus-46🐾]"
```

---

### Task 6: Edge traversal recording in GraphResolver

When GraphResolver expands edges, record the traversal so Phase C has data.

**Files:**
- Modify: `packages/api/src/domains/memory/GraphResolver.ts` (edge traversal recording)

**Step 1: Write failing test**

```typescript
// test/memory/graph-edge-traversal.test.ts
test('graph_resolve increments traversal_count on traversed edges', () => {
  // Setup: sqlite db with edges (A→B, A→C)
  // Call buildSubgraph('A', depth=1)
  // Assert: edges A→B and A→C have traversal_count=1, last_traversed_at set
});

test('repeated traversal increments count', () => {
  // Call buildSubgraph('A') twice
  // Assert: traversal_count=2
});
```

**Step 2: Run test, expect fail**

**Step 3: Add traversal recording**

After `getRelated()` call in `buildSubgraph()`, for each returned edge, execute:

```sql
UPDATE edges SET
  traversal_count = COALESCE(traversal_count, 0) + 1,
  last_traversed_at = ?
WHERE from_anchor = ? AND to_anchor = ? AND relation = ?
```

This is fire-and-forget (errors logged, not thrown) — traversal recording must not break graph queries.

**Step 4: Run test, expect pass**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/GraphResolver.ts test/memory/graph-edge-traversal.test.ts
git commit -m "feat(F200): record edge traversals in GraphResolver [宪宪/Opus-46🐾]"
```

---

### Task 7: Health Dashboard — RecallEvent stats endpoint

Extend the existing `/api/library/tool-usage-metrics` endpoint to include RecallEvent stats.

**Files:**
- Modify: `packages/api/src/routes/library.ts:304-320` (extend metrics endpoint)

**Step 1: Write failing test**

```typescript
// test/routes/library-recall-stats.test.ts
test('GET /api/library/tool-usage-metrics includes recallEventStats', async () => {
  // Insert sample recall_events into sqlite
  // Call endpoint
  // Assert response contains recallEventStats: { total24h, consumed24h, reformulated24h, abandoned24h }
});
```

**Step 2: Run test, expect fail**

**Step 3: Implement**

Add a `getRecallStats24h(db)` function that queries:

```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN consumed_json != '[]' THEN 1 ELSE 0 END) as consumed,
  SUM(reformulated) as reformulated,
  SUM(abandoned) as abandoned,
  SUM(fell_back_to_grep) as fell_back_to_grep
FROM recall_events
WHERE timestamp > ?
```

Wire it into the metrics endpoint response.

**Step 4: Run test, expect pass**

**Step 5: Commit**

```bash
git add packages/api/src/routes/library.ts test/routes/library-recall-stats.test.ts
git commit -m "feat(F200): AC-A4 RecallEvent stats in health dashboard [宪宪/Opus-46🐾]"
```

---

### Task 8: Wire correlation into invoke pipeline

The correlator runs after an invocation completes (or periodically). Trigger point: when a cat's invocation ends, read its ToolEventLog window and correlate.

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` (trigger point)
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` (same trigger)

**Step 1: Write integration test**

```typescript
// test/memory/recall-correlation-integration.test.ts
test('end-to-end: search_evidence → Read → RecallEvent persisted', () => {
  // Simulate: append search_evidence event with _f200Candidates
  // Simulate: append Read event matching candidate
  // Trigger: correlateWindow on the event sequence
  // Assert: recall_events table has 1 row with consumed entry
});
```

**Step 2: Run test, expect fail**

**Step 3: Implement**

At invocation end (where `catInvocationId` is cleaned up in route-parallel), add:

```typescript
if (deps.evidenceDb && deps.toolEventLog) {
  const events = await deps.toolEventLog.readByThread(threadId);
  const invEvents = events.filter(e => e.invocationId === invocationId);
  if (invEvents.some(e => MEMORY_TOOLS.has(e.toolName))) {
    const correlator = new RecallEventCorrelator(deps.evidenceDb);
    const recallEvents = correlator.correlateWindow(invEvents);
    if (recallEvents.length > 0) correlator.persistBatch(recallEvents);
  }
}
```

Fire-and-forget (`.catch(() => {})`) — must not block cat response.

**Step 4: Run test, expect pass**

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/routing/route-parallel.ts \
       packages/api/src/domains/cats/services/agents/routing/route-serial.ts \
       test/memory/recall-correlation-integration.test.ts
git commit -m "feat(F200): wire RecallEventCorrelator into invoke pipeline [宪宪/Opus-46🐾]"
```

---

### Task 9: Final integration test + quality gate

**Step 1: Run full test suite**

```bash
cd packages/api && pnpm test
pnpm lint
pnpm check
```

**Step 2: Verify all Phase A ACs**

| AC | Verification |
|----|-------------|
| AC-A1 | recall_events table exists, RecallEvent written with candidates+consumed |
| AC-A2 | compound window logic tested (distance, wall-clock, invocation boundary, target_match) |
| AC-A3 | boolean flags tested (reformulated, fellBackToGrep, abandoned, nextGraphResolveAfterRead) |
| AC-A4 | health endpoint returns recallEventStats |
| AC-A5 | dwellProxy recorded in consumed entries |

**Step 3: Commit any fixes**

**Step 4: Load quality-gate skill**

---

## File Summary

| Action | Path |
|--------|------|
| Modify | `packages/api/src/domains/memory/schema.ts` (V19) |
| Create | `packages/api/src/domains/memory/f200-types.ts` |
| Modify | `packages/api/src/domains/cats/services/tool-usage/derive-result-summary.ts` |
| Create | `packages/api/src/domains/memory/recall-target-match.ts` |
| Create | `packages/api/src/domains/memory/RecallEventCorrelator.ts` |
| Modify | `packages/api/src/domains/memory/GraphResolver.ts` |
| Modify | `packages/api/src/routes/library.ts` |
| Modify | `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` |
| Modify | `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` |
| Create | `test/memory/schema-v19.test.ts` |
| Create | `test/memory/f200-types.test.ts` |
| Create | `test/tool-usage/derive-result-summary-f200.test.ts` |
| Create | `test/memory/recall-target-match.test.ts` |
| Create | `test/memory/recall-event-correlator.test.ts` |
| Create | `test/memory/graph-edge-traversal.test.ts` |
| Create | `test/routes/library-recall-stats.test.ts` |
| Create | `test/memory/recall-correlation-integration.test.ts` |
