# F065 Phase B: ThreadMemory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Add thread-level rolling memory that accumulates across session seals, so Session 5 can understand what happened in Session 1.

**Architecture:** Each thread gets a `threadMemory` text blob (stored in ThreadStore). When a session is sealed, `SessionSealer.finalize()` reads the current ThreadMemory + the just-sealed session's extractive digest, merges them into an updated ThreadMemory (rule-based, no LLM), and writes back. `SessionBootstrap` injects ThreadMemory alongside the existing digest + task snapshot.

**Tech Stack:** TypeScript, Node.js test runner, existing ThreadStore/SessionSealer/SessionBootstrap patterns.

---

## Finish Line

**One-sentence B:** A cat starting Session #5 receives a rolling memory that covers Sessions 1-4, capped at ~3k tokens.

**Acceptance Criteria (from F065 spec):**
- AC-7: ThreadMemory is updated on every seal, new session bootstrap includes it
- AC-8: Session 5's cat can understand Session 1's key information via ThreadMemory

**What we're NOT building:**
- LLM-generated summaries (Phase C scope)
- Route-layer token budget modifications (Phase A explicitly excluded this)
- New MCP tools for ThreadMemory (it's injected in bootstrap, not queried separately)
- Redis persistence for ThreadMemory (ThreadStore is in-memory; Redis upgrade is separate work)

## Terminal Schema

```typescript
// ThreadStore additions
interface Thread {
  // ... existing fields ...
  /** F065 Phase B: rolling memory across sealed sessions */
  threadMemory?: ThreadMemoryV1;
}

interface ThreadMemoryV1 {
  v: 1;
  /** Rolling summary text, capped at MAX_THREAD_MEMORY_TOKENS */
  summary: string;
  /** Number of sealed sessions incorporated */
  sessionsIncorporated: number;
  /** Unix timestamp of last update */
  updatedAt: number;
}

// IThreadStore additions
interface IThreadStore {
  // ... existing methods ...
  getThreadMemory(threadId: string): ThreadMemoryV1 | null | Promise<ThreadMemoryV1 | null>;
  updateThreadMemory(threadId: string, memory: ThreadMemoryV1): void | Promise<void>;
}
```

```typescript
// ThreadMemoryBuilder — pure function
function buildThreadMemory(
  existing: ThreadMemoryV1 | null,
  newDigest: ExtractiveDigestV1,
  maxTokens: number,
): ThreadMemoryV1;
```

## Token Budget

From KD-5: `min(3000, floor(maxPromptTokens * 0.03))`, floor 1200.

For Phase B, use a simpler fixed cap: `MAX_THREAD_MEMORY_TOKENS = 1500` (half of the bootstrap's 2000 cap, leaving room for identity + tools + task snapshot). This fits within the existing `MAX_BOOTSTRAP_TOKENS = 2000` section-aware cap from Phase A — ThreadMemory replaces per-session digest as the primary context source.

## Tasks

### Task 1: ThreadMemoryV1 type + ThreadStore interface extension

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts`

**What:** Add `ThreadMemoryV1` interface and two methods to `IThreadStore` + `ThreadStore`.

**Step 1: Add ThreadMemoryV1 type**

After the existing `ThreadRoutingPolicyV1` interface (~line 51), add:

```typescript
/** F065 Phase B: Rolling thread-level memory across sealed sessions. */
export interface ThreadMemoryV1 {
  v: 1;
  /** Rolling summary text */
  summary: string;
  /** Number of sealed sessions incorporated into this memory */
  sessionsIncorporated: number;
  /** Unix timestamp of last update */
  updatedAt: number;
}
```

**Step 2: Add threadMemory to Thread interface**

After `routingPolicy` (~line 100):

```typescript
/** F065 Phase B: Rolling memory across sealed sessions */
threadMemory?: ThreadMemoryV1;
```

**Step 3: Add methods to IThreadStore interface**

After `updateRoutingPolicy` (~line 139):

```typescript
/** F065 Phase B: Get thread memory (rolling summary). */
getThreadMemory(threadId: string): ThreadMemoryV1 | null | Promise<ThreadMemoryV1 | null>;
/** F065 Phase B: Update thread memory after session seal. */
updateThreadMemory(threadId: string, memory: ThreadMemoryV1): void | Promise<void>;
```

**Step 4: Implement in ThreadStore class**

```typescript
getThreadMemory(threadId: string): ThreadMemoryV1 | null {
  const thread = this.get(threadId);
  return thread?.threadMemory ?? null;
}

updateThreadMemory(threadId: string, memory: ThreadMemoryV1): void {
  const thread = this.get(threadId);
  if (thread) thread.threadMemory = memory;
}
```

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts
git commit -m "feat(F065): add ThreadMemoryV1 type + ThreadStore interface [布偶猫/宪宪]"
```

---

### Task 2: buildThreadMemory — pure function + tests (TDD)

**Files:**
- Create: `packages/api/src/domains/cats/services/session/buildThreadMemory.ts`
- Create: `packages/api/test/build-thread-memory.test.js`

**What:** Pure function that merges existing ThreadMemory with a new extractive digest, producing an updated rolling summary. Rule-based (no LLM).

**Merge strategy:**
1. Extract key facts from new digest: duration, tools used (top 10), files touched (top 10), error count
2. Format as a single-paragraph session summary line: `"Session #N (HH:MM-HH:MM, Xmin): used [tools], touched [files], N errors."`
3. Prepend to existing summary
4. If total exceeds `maxTokens`, trim oldest session lines from the end
5. Increment `sessionsIncorporated`

**Step 1: Write the failing test**

```javascript
// test/build-thread-memory.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildThreadMemory } from '../dist/domains/cats/services/session/buildThreadMemory.js';

describe('buildThreadMemory', () => {
  const baseDigest = {
    v: 1, sessionId: 's1', threadId: 't1', catId: 'opus', seq: 0,
    time: { createdAt: 1000000, sealedAt: 1060000 },
    invocations: [{ toolNames: ['Edit', 'Read', 'Grep'] }],
    filesTouched: [{ path: 'src/index.ts', ops: ['edit'] }],
    errors: [],
  };

  it('creates new memory from null + digest', () => {
    const result = buildThreadMemory(null, baseDigest, 1500);
    assert.equal(result.v, 1);
    assert.equal(result.sessionsIncorporated, 1);
    assert.ok(result.summary.includes('Session #1'));
    assert.ok(result.summary.includes('Edit'));
    assert.ok(result.summary.includes('src/index.ts'));
  });

  it('appends to existing memory', () => {
    const existing = {
      v: 1, summary: 'Session #1 (00:16-00:17, 1min): Edit, Read. Files: src/a.ts.',
      sessionsIncorporated: 1, updatedAt: 1000,
    };
    const digest2 = { ...baseDigest, seq: 1, sessionId: 's2' };
    const result = buildThreadMemory(existing, digest2, 1500);
    assert.equal(result.sessionsIncorporated, 2);
    assert.ok(result.summary.includes('Session #2'));
    assert.ok(result.summary.includes('Session #1'));
  });

  it('trims oldest sessions when exceeding maxTokens', () => {
    // Build up a memory with many sessions, then add one more that pushes over
    let mem = null;
    for (let i = 0; i < 20; i++) {
      const d = {
        ...baseDigest, seq: i, sessionId: `s${i}`,
        invocations: [{ toolNames: Array.from({ length: 10 }, (_, j) => `Tool${j}_${'x'.repeat(20)}`) }],
        filesTouched: Array.from({ length: 10 }, (_, j) => ({ path: `src/deep/module-${j}.ts`, ops: ['edit'] })),
      };
      mem = buildThreadMemory(mem, d, 500); // low cap to force trimming
    }
    assert.ok(mem);
    assert.ok(mem.summary.includes('Session #20')); // newest kept
    assert.equal(mem.summary.includes('Session #1 '), false); // oldest trimmed
  });

  it('includes error count when digest has errors', () => {
    const digestWithErrors = {
      ...baseDigest,
      errors: [{ at: 1050000, message: 'TypeError: foo' }],
    };
    const result = buildThreadMemory(null, digestWithErrors, 1500);
    assert.ok(result.summary.includes('1 error'));
  });

  it('caps tools at 10 and files at 10', () => {
    const bigDigest = {
      ...baseDigest,
      invocations: [{ toolNames: Array.from({ length: 20 }, (_, i) => `Tool${i}`) }],
      filesTouched: Array.from({ length: 20 }, (_, i) => ({ path: `f${i}.ts`, ops: ['edit'] })),
    };
    const result = buildThreadMemory(null, bigDigest, 1500);
    // Should mention "+N more" for overflow
    assert.ok(result.summary.includes('+'));
  });

  it('returns v:1 with correct updatedAt', () => {
    const before = Date.now();
    const result = buildThreadMemory(null, baseDigest, 1500);
    assert.ok(result.updatedAt >= before);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && npx tsc && node --test test/build-thread-memory.test.js
```
Expected: FAIL — module not found.

**Step 3: Write implementation**

```typescript
// packages/api/src/domains/cats/services/session/buildThreadMemory.ts
import type { ThreadMemoryV1 } from '../stores/ports/ThreadStore.js';
import type { ExtractiveDigestV1 } from './TranscriptWriter.js';
import { estimateTokens } from '../../../../utils/token-counter.js';

const MAX_TOOLS_DISPLAY = 10;
const MAX_FILES_DISPLAY = 10;

function formatTimeShort(epoch: number): string {
  const d = new Date(epoch);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatSessionLine(digest: ExtractiveDigestV1): string {
  const displaySeq = digest.seq + 1;
  const duration = Math.round((digest.time.sealedAt - digest.time.createdAt) / 60000);
  const timeRange = `${formatTimeShort(digest.time.createdAt)}-${formatTimeShort(digest.time.sealedAt)}`;

  // Tools (deduplicated, capped)
  const allTools = [...new Set(digest.invocations.flatMap(inv => inv.toolNames ?? []))];
  const toolsDisplay = allTools.slice(0, MAX_TOOLS_DISPLAY).join(', ');
  const toolsExtra = allTools.length > MAX_TOOLS_DISPLAY
    ? ` +${allTools.length - MAX_TOOLS_DISPLAY} more` : '';

  // Files (capped)
  const files = digest.filesTouched.slice(0, MAX_FILES_DISPLAY)
    .map(f => f.path).join(', ');
  const filesExtra = digest.filesTouched.length > MAX_FILES_DISPLAY
    ? ` +${digest.filesTouched.length - MAX_FILES_DISPLAY} more` : '';

  // Errors
  const errorPart = digest.errors.length > 0
    ? ` ${digest.errors.length} error${digest.errors.length > 1 ? 's' : ''}.`
    : '';

  return `Session #${displaySeq} (${timeRange}, ${duration}min): ${toolsDisplay}${toolsExtra}. Files: ${files}${filesExtra}.${errorPart}`;
}

export function buildThreadMemory(
  existing: ThreadMemoryV1 | null,
  newDigest: ExtractiveDigestV1,
  maxTokens: number,
): ThreadMemoryV1 {
  const newLine = formatSessionLine(newDigest);

  // Prepend new session line to existing summary
  const existingLines = existing?.summary ? existing.summary.split('\n') : [];
  const allLines = [newLine, ...existingLines];

  // Trim oldest lines (from end) until within token budget
  let summary = allLines.join('\n');
  while (estimateTokens(summary) > maxTokens && allLines.length > 1) {
    allLines.pop();
    summary = allLines.join('\n');
  }

  return {
    v: 1,
    summary,
    sessionsIncorporated: (existing?.sessionsIncorporated ?? 0) + 1,
    updatedAt: Date.now(),
  };
}
```

**Step 4: Run test to verify it passes**

```bash
cd packages/api && npx tsc && node --test test/build-thread-memory.test.js
```
Expected: all pass.

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/session/buildThreadMemory.ts packages/api/test/build-thread-memory.test.js
git commit -m "feat(F065): add buildThreadMemory — rule-based rolling memory builder [布偶猫/宪宪]"
```

---

### Task 3: SessionSealer.finalize() — call buildThreadMemory on seal

**Files:**
- Modify: `packages/api/src/domains/cats/services/session/SessionSealer.ts`
- Modify: `packages/api/test/session-sealer.test.js` (or create if none exists)

**What:** After writing the extractive digest in `finalize()`, read existing ThreadMemory + the digest just written, call `buildThreadMemory()`, write result back via `ThreadStore.updateThreadMemory()`.

**Dependencies:** `SessionSealer` needs `IThreadStore` and `TranscriptReader` injected. Currently it only has `ISessionChainStore` and optional `TranscriptWriter`.

**Step 1: Write the failing test**

Add a test that verifies: after `finalize()`, `threadStore.getThreadMemory(threadId)` returns a non-null `ThreadMemoryV1` with `sessionsIncorporated === 1`.

**Step 2: Extend SessionSealer constructor**

```typescript
constructor(
  private readonly store: ISessionChainStore,
  private readonly transcriptWriter?: TranscriptWriter,
  private readonly threadStore?: IThreadStore,
  private readonly transcriptReader?: TranscriptReader,
) {}
```

**Step 3: Add ThreadMemory update to finalize()**

After the transcript flush block (~line 108), before the `store.update` that marks sealed:

```typescript
// F065 Phase B: Update thread memory after successful digest write
if (this.threadStore && this.transcriptReader) {
  try {
    const digest = await this.transcriptReader.readDigest(record.id, record.threadId, record.catId);
    if (digest) {
      const existingMemory = await this.threadStore.getThreadMemory(record.threadId);
      const updated = buildThreadMemory(
        existingMemory,
        digest as unknown as ExtractiveDigestV1,
        MAX_THREAD_MEMORY_TOKENS,
      );
      await this.threadStore.updateThreadMemory(record.threadId, updated);
    }
  } catch {
    // best-effort: thread memory update failure doesn't prevent sealing
  }
}
```

**Step 4: Wire dependencies in index.ts**

Find where `SessionSealer` is constructed and pass `threadStore` + `transcriptReader`.

**Step 5: Run tests, commit**

```bash
git commit -m "feat(F065): update ThreadMemory on session seal [布偶猫/宪宪]"
```

---

### Task 4: SessionBootstrap — inject ThreadMemory

**Files:**
- Modify: `packages/api/src/domains/cats/services/session/SessionBootstrap.ts`
- Modify: `packages/api/test/session-bootstrap.test.js`

**What:** If `ThreadMemory` exists for the thread, inject it in bootstrap between identity and digest sections. ThreadMemory replaces the per-session digest as the primary historical context (digest is still included for the immediate previous session).

**Bootstrap section order (updated):**
1. Identity (always kept)
2. ThreadMemory (new — higher priority than task snapshot, lower than identity)
3. Previous session digest (kept as-is from Phase A)
4. Task snapshot (lowest priority variable section)
5. MCP tools (always kept)

**Token cap update:** Section-aware cap now has 3 variable sections. Drop order: task snapshot → digest → thread memory.

**Step 1: Write the failing test**

```javascript
it('includes thread memory when threadStore has memory', async () => {
  // ... setup with threadStore that has ThreadMemory ...
  const result = await buildSessionBootstrap(opts, 'opus', 'thread-1');
  assert.ok(result.text.includes('Thread Memory'));
  assert.ok(result.text.includes('Session #1'));
  assert.equal(result.hasThreadMemory, true);
});
```

**Step 2: Add ThreadMemory section to buildSessionBootstrap**

Read ThreadMemory from `opts.taskStore` (via a new `threadStore` dependency on `SessionBootstrapOptions`):

```typescript
export interface SessionBootstrapOptions {
  sessionChainStore: ISessionChainStore;
  transcriptReader: TranscriptReader;
  taskStore?: ITaskStore;
  /** F065 Phase B: Thread store for ThreadMemory injection */
  threadStore?: IThreadStore;
}
```

Add between identity and digest sections:

```typescript
// 2. Thread Memory (F065 Phase B)
let threadMemorySection = '';
let hasThreadMemory = false;
if (opts.threadStore) {
  try {
    const mem = await opts.threadStore.getThreadMemory(threadId);
    if (mem && mem.summary) {
      threadMemorySection = `\n[Thread Memory — ${mem.sessionsIncorporated} sessions]\n${mem.summary}`;
      hasThreadMemory = true;
    }
  } catch {
    // best-effort
  }
}
```

**Step 3: Update token cap logic**

Three variable sections now: threadMemory > digest > taskSnapshot (drop order: task first, then digest, then threadMemory).

```typescript
const tmTokens = hasThreadMemory ? estimateTokens(threadMemorySection) : 0;
const digestTokens = hasDigest ? estimateTokens(digestSection) : 0;
const taskTokens = hasTaskSnapshot ? estimateTokens(taskSection) : 0;
const variableTotal = tmTokens + digestTokens + taskTokens;

if (variableTotal > remainingBudget) {
  // Drop task snapshot first (lowest priority)
  taskSection = ''; hasTaskSnapshot = false;
  if (tmTokens + digestTokens > remainingBudget) {
    // Drop digest next
    digestSection = ''; hasDigest = false;
    if (tmTokens > remainingBudget) {
      // Drop thread memory last resort
      threadMemorySection = ''; hasThreadMemory = false;
    }
  }
}
```

**Step 4: Update return type**

Add `hasThreadMemory: boolean` to `BootstrapContext`.

**Step 5: Wire threadStore in route-serial/parallel**

Pass `threadStore` to `buildSessionBootstrap` calls (same pattern as `taskStore` from Phase A).

**Step 6: Run tests, commit**

```bash
git commit -m "feat(F065): inject ThreadMemory into session bootstrap [布偶猫/宪宪]"
```

---

### Task 5: Full validation

**Step 1: Run all tests**

```bash
cd packages/api && node --test test/build-thread-memory.test.js test/session-bootstrap.test.js test/format-task-snapshot.test.js
```

**Step 2: Full suite regression**

```bash
pnpm test
```

**Step 3: Lint + type check + build**

```bash
pnpm lint && pnpm check && pnpm -r build && pnpm check:dir-size
```

**Step 4: Commit any fixes**

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| ThreadMemory grows too large | Low | Token cap + oldest-line trimming |
| Seal performance regression (reading digest from disk) | Low | `readDigest` is fast (single JSON file); best-effort catch |
| ThreadStore in-memory — memory lost on restart | Medium | Known limitation; Redis persistence is separate work |
| Token budget conflict with Phase A cap | Low | Section-aware cap already handles this; just add ThreadMemory as highest-priority variable section |
