# F236 Track-2: Open-Rate Event Model + eval:anchor-first Domain

**Feature:** F236 — `docs/features/F236-anchor-first-context-entry.md`
**Goal:** Build per-event preview↔drill correlation model (AC-E2) + register `eval:anchor-first` domain on Y-lite (AC-E4) — enabling sunset verdict automation for anchor-first read tools.
**Acceptance Criteria:**
- AC-E2: per-tool open-rate / sunset verdict via preview↔drill joinable event model (correlation key = itemId/sourceTool); high-cardinality IDs as event records not metric labels; double-sided net benefit (省 − drill cost); reference-read `eval:task-outcome` for blindness signal
- AC-E3: verdict net-loss → auto alert for sunset; net-gain + no blindness → Phase C data basis
- AC-E4: registered `eval:anchor-first` domain via F192 harness eval system; F192 md only link back
**Architecture cell:** harness-eval
**Map delta:** update required (new domain + generator in harness-eval cell)
**Map delta why:** Adding eval:anchor-first domain with generator adapter — same cell, update ownership doc with new domain entry.
**Architecture:** Extend Track-1 anchor-telemetry recorder with per-event log (in-memory ring buffer, 24h, matching callback-auth-telemetry pattern). Per-event records carry correlation keys (itemId = messageId/taskId) to join preview↔drill. Register eval:anchor-first domain following eval:friction pattern (YAML + instructions + source refs type + generator adapter + wiring). Generator reads event log rollup + Track-1 OTel substrate.
**Tech Stack:** TypeScript, Zod, OTel (existing instruments), in-memory ring buffer, F192 verdict pipeline
**前端验证:** No — backend eval infrastructure only

---

## Stateful Object Gate

### Census

1. **AnchorEventLog** — in-memory ring buffer storing per-event preview/drill records with correlation keys (24h retention, matching callback-auth-telemetry)

### AnchorEventLog — State × Event Transition Table

**Lifecycle owner:** API process (single Node.js event loop, single-writer)

| Current State | Event | Next State | Side Effect |
|---|---|---|---|
| empty | `recordPreviewEvent(e)` | accumulating | append to buffer |
| accumulating | `recordPreviewEvent(e)` | accumulating | append; evict if oldest > 24h |
| accumulating | `recordDrillEvent(e)` | accumulating | append; evict if oldest > 24h |
| accumulating | `getRollup(window)` | accumulating (unchanged) | pure computation, no mutation |
| accumulating | `getSnapshot()` | accumulating (unchanged) | copy-on-read |
| any | process crash/restart | empty | lose-on-restart (acceptable — eval signal, not user data; same pattern as callback-auth-telemetry) |
| any | `resetForTest()` | empty | test-only reset |

**旁路 API 限制:** None. No external mutation paths. Append-only within process.

### Invariants

- **INV-1**: Events append-only (no mutation/deletion except 24h TTL eviction)
- **INV-2**: 24h maximum retention (eviction on write, matching callback-auth-telemetry)
- **INV-3**: High-cardinality IDs (messageId/taskId) NEVER leak to OTel metric labels — event log is separate channel from Track-1 OTel counters
- **INV-4**: `getRollup()` is pure computation — does not mutate the log
- **INV-5**: Lose-on-restart acceptable (in-memory eval signal, not LL-048 user state)
- **INV-6**: Per-event `itemIds` bounded by tool response limit (pending-mentions max ~50, thread-context max 200, list-tasks unbounded but typically <100)

### Adversarial Scenarios

| Scenario | Expected Behavior | Test |
|---|---|---|
| Process crash | Events lost, log empty on restart. Eval cat sees shorter window, flags as telemetry gap. | INV-5 by design (not tested — same as callback-auth-telemetry) |
| High-volume burst (200 items × 100 calls/hr) | ~20K events in 24h, ~7MB. Bounded by eviction. | Task 2 test: buffer size stays bounded after many inserts |
| Drill event for un-previewed itemId | Recorded but unmatched in rollup. Tracked as "orphan drill" count (signal: drill came from outside anchor system or preview aged out). | Task 2 test: orphan drill counted separately |
| Preview then drill after 24h eviction | Preview event evicted, drill recorded but unmatched. Same as orphan drill. | Task 2 test: eviction + late drill → orphan |
| Concurrent emit (two requests) | Single Node.js event loop — no true concurrency. Sequential append safe. | N/A (runtime guarantee) |

---

## Terminal Schema

### Per-Event Records (anchor-telemetry.ts extension)

```typescript
/** Per-response preview event with correlation keys. */
interface AnchorPreviewEvent {
  id: string;                    // monotonic counter (not UUID — cheaper, unique within process)
  tool: AnchorPreviewTool;       // 'pending-mentions' | 'thread-context' | 'list-tasks'
  itemIds: string[];             // messageIds or taskIds of all items in this response
  itemCount: number;             // === itemIds.length (denorm for fast rollup)
  returnedChars: number;         // actual preview payload chars
  originalChars: number;         // what full-body would have been (sum of contentLength across items)
  timestamp: number;             // Date.now() epoch ms
}

/** Per-drill event with correlation key. */
interface AnchorDrillEvent {
  id: string;                    // monotonic counter
  tool: AnchorDrillTool;         // 'get-message' | 'list-tasks'
  itemId: string;                // which item was drilled (messageId or taskId)
  fullDrillChars: number;
  timestamp: number;
}
```

### Source Selector (shared types — replayable window)

```typescript
/** @cat-cafe/shared */
interface AnchorTelemetrySourceSelector {
  kind: 'anchor-telemetry-snapshot';
  windowStartMs: number;
  windowEndMs: number;
}
```

### Rollup (source adapter output → generator input)

```typescript
interface AnchorTelemetryRollup {
  window: { startMs: number; endMs: number };
  perTool: Record<string, {
    previewResponses: number;      // how many preview calls
    previewedItems: number;        // total items across all preview responses
    drills: number;                // total drill calls
    drilledUniqueItems: number;    // unique itemIds that were drilled
    openRateByItem: number;        // drilledUniqueItems / previewedItems
    returnedChars: number;         // total preview chars (the 省 numerator)
    originalChars: number;         // total full-body chars (baseline)
    drillChars: number;            // total drill chars (cost)
    charsSaved: number;            // originalChars - returnedChars
    netBenefit: number;            // charsSaved - drillChars (砚砚 KD: double-sided)
  }>;
  orphanDrills: number;            // drills with no matching preview (item aged out or external)
  /** Track-1 OTel substrate snapshot (chars + volume) for cross-reference. */
  track1Snapshot: AnchorTelemetrySnapshot;
}
```

---

## Implementation Tasks

### Task 1: Per-Event Types + AnchorEventLog

**Files:**
- Modify: `packages/api/src/routes/anchor-telemetry.ts` (add event types + AnchorEventLog class)
- Test: `packages/api/test/anchor-event-log.test.js` (new)

**Step 1: Write failing tests for AnchorEventLog**

```javascript
// anchor-event-log.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordAnchorPreviewEvent,
  recordAnchorDrillEvent,
  getAnchorEventSnapshot,
  getAnchorTelemetryRollup,
  resetAnchorEventLogForTest,
} from '../src/routes/anchor-telemetry.js';

describe('AnchorEventLog', () => {
  beforeEach(() => resetAnchorEventLogForTest());

  it('starts empty', () => {
    const snap = getAnchorEventSnapshot();
    expect(snap.previewEvents).toEqual([]);
    expect(snap.drillEvents).toEqual([]);
  });

  it('records preview events with correlation keys', () => {
    recordAnchorPreviewEvent({
      tool: 'thread-context',
      itemIds: ['msg-1', 'msg-2', 'msg-3'],
      returnedChars: 500,
      originalChars: 5000,
    });
    const snap = getAnchorEventSnapshot();
    expect(snap.previewEvents).toHaveLength(1);
    expect(snap.previewEvents[0].tool).toBe('thread-context');
    expect(snap.previewEvents[0].itemIds).toEqual(['msg-1', 'msg-2', 'msg-3']);
    expect(snap.previewEvents[0].itemCount).toBe(3);
    expect(snap.previewEvents[0].returnedChars).toBe(500);
    expect(snap.previewEvents[0].originalChars).toBe(5000);
  });

  it('records drill events with itemId correlation', () => {
    recordAnchorDrillEvent({
      tool: 'get-message',
      itemId: 'msg-2',
      fullDrillChars: 3000,
    });
    const snap = getAnchorEventSnapshot();
    expect(snap.drillEvents).toHaveLength(1);
    expect(snap.drillEvents[0].itemId).toBe('msg-2');
  });

  it('computes per-tool open-rate rollup (double-sided)', () => {
    const now = Date.now();
    recordAnchorPreviewEvent({
      tool: 'thread-context',
      itemIds: ['msg-1', 'msg-2', 'msg-3'],
      returnedChars: 500,
      originalChars: 5000,
    });
    recordAnchorDrillEvent({
      tool: 'get-message',
      itemId: 'msg-2',
      fullDrillChars: 2000,
    });
    const rollup = getAnchorTelemetryRollup({
      windowStartMs: now - 60000,
      windowEndMs: now + 60000,
    });
    const tc = rollup.perTool['thread-context'];
    expect(tc).toBeDefined();
    expect(tc.previewResponses).toBe(1);
    expect(tc.previewedItems).toBe(3);
    expect(tc.drilledUniqueItems).toBe(1);
    expect(tc.openRateByItem).toBeCloseTo(1 / 3);
    expect(tc.charsSaved).toBe(5000 - 500);
    expect(tc.drillChars).toBe(2000);
    expect(tc.netBenefit).toBe(4500 - 2000); // charsSaved - drillChars
  });

  it('tracks orphan drills (no matching preview)', () => {
    const now = Date.now();
    recordAnchorDrillEvent({
      tool: 'get-message',
      itemId: 'msg-orphan',
      fullDrillChars: 1000,
    });
    const rollup = getAnchorTelemetryRollup({
      windowStartMs: now - 60000,
      windowEndMs: now + 60000,
    });
    expect(rollup.orphanDrills).toBe(1);
  });

  it('evicts events older than 24h on write (INV-2)', () => {
    // Internal: manipulate timestamp for testing via test-helper
    recordAnchorPreviewEvent({
      tool: 'pending-mentions',
      itemIds: ['msg-old'],
      returnedChars: 100,
      originalChars: 1000,
      _testTimestamp: Date.now() - 25 * 60 * 60 * 1000, // 25h ago
    });
    // New write triggers eviction
    recordAnchorPreviewEvent({
      tool: 'pending-mentions',
      itemIds: ['msg-new'],
      returnedChars: 100,
      originalChars: 1000,
    });
    const snap = getAnchorEventSnapshot();
    expect(snap.previewEvents).toHaveLength(1);
    expect(snap.previewEvents[0].itemIds).toEqual(['msg-new']);
  });

  it('rollup window filters events by timestamp', () => {
    const now = Date.now();
    recordAnchorPreviewEvent({
      tool: 'thread-context',
      itemIds: ['msg-1'],
      returnedChars: 100,
      originalChars: 1000,
      _testTimestamp: now - 2 * 60 * 60 * 1000, // 2h ago — inside window
    });
    recordAnchorPreviewEvent({
      tool: 'thread-context',
      itemIds: ['msg-2'],
      returnedChars: 200,
      originalChars: 2000,
    });
    const rollup = getAnchorTelemetryRollup({
      windowStartMs: now - 60 * 60 * 1000, // last 1h only
      windowEndMs: now + 60000,
    });
    expect(rollup.perTool['thread-context'].previewResponses).toBe(1);
  });

  it('drill↔preview join across tools (get-message drills thread-context preview)', () => {
    const now = Date.now();
    recordAnchorPreviewEvent({
      tool: 'thread-context',
      itemIds: ['msg-A', 'msg-B'],
      returnedChars: 300,
      originalChars: 3000,
    });
    recordAnchorPreviewEvent({
      tool: 'pending-mentions',
      itemIds: ['msg-C'],
      returnedChars: 100,
      originalChars: 800,
    });
    // Drill msg-A (was in thread-context preview)
    recordAnchorDrillEvent({ tool: 'get-message', itemId: 'msg-A', fullDrillChars: 1500 });
    // Drill msg-C (was in pending-mentions preview)
    recordAnchorDrillEvent({ tool: 'get-message', itemId: 'msg-C', fullDrillChars: 700 });

    const rollup = getAnchorTelemetryRollup({
      windowStartMs: now - 60000,
      windowEndMs: now + 60000,
    });
    // thread-context had 2 items, 1 drilled
    expect(rollup.perTool['thread-context'].drilledUniqueItems).toBe(1);
    expect(rollup.perTool['thread-context'].drillChars).toBe(1500);
    // pending-mentions had 1 item, 1 drilled
    expect(rollup.perTool['pending-mentions'].drilledUniqueItems).toBe(1);
    expect(rollup.perTool['pending-mentions'].drillChars).toBe(700);
    expect(rollup.orphanDrills).toBe(0);
  });
});
```

Run: `cd /Users/lysander/projects/relay-station/cat-cafe && pnpm --filter @cat-cafe/api test -- anchor-event-log`
Expected: FAIL — functions not exported yet.

**Step 2: Implement AnchorEventLog in anchor-telemetry.ts**

Add to existing `anchor-telemetry.ts`:
- Export types: `AnchorPreviewEvent`, `AnchorDrillEvent`, `AnchorPreviewEventInput`, `AnchorDrillEventInput`
- Internal: `previewEvents: AnchorPreviewEvent[]`, `drillEvents: AnchorDrillEvent[]`, `eventCounter: number`
- Export: `recordAnchorPreviewEvent(input)` — auto-assign `id`/`timestamp`/`itemCount`, evict old, append
- Export: `recordAnchorDrillEvent(input)` — auto-assign `id`/`timestamp`, evict old, append
- Export: `getAnchorEventSnapshot()` — copy-on-read
- Export: `getAnchorTelemetryRollup(window)` — pure computation:
  1. Filter events by window
  2. Build `previewedItemsByTool: Map<tool, Set<itemId>>` from preview events
  3. Build `drilledItemsByTool: Map<tool, Set<itemId>>` by joining drill.itemId against previewedItemsByTool
  4. Drills whose itemId isn't in any preview's itemIds → orphanDrills
  5. Compute charsSaved/netBenefit per tool
- Export: `resetAnchorEventLogForTest()`
- `_testTimestamp` optional param for testing (internal, underscore convention)

**Step 3: Run tests, verify pass**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe && pnpm --filter @cat-cafe/api test -- anchor-event-log`
Expected: All PASS.

**Step 4: Commit**

```bash
git add packages/api/src/routes/anchor-telemetry.ts packages/api/test/anchor-event-log.test.js
git commit -m "feat(F236): add AnchorEventLog per-event model with preview↔drill correlation

Track-2 core: in-memory ring buffer (24h, matching callback-auth-telemetry pattern)
storing per-event preview/drill records with correlation keys (itemId = messageId/taskId).
Rollup joins preview↔drill events to compute per-tool open-rate + double-sided
net benefit (charsSaved - drillChars). High-cardinality IDs stay in event log,
never leak to OTel metric labels (INV-3)."
```

---

### Task 2: Extend 4 Emit Points with Per-Event Recording

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts` (3 sites: pending-mentions, thread-context, get-message)
- Modify: `packages/api/src/routes/callback-task-routes.ts` (1 site: list-tasks)
- Test: `packages/api/test/anchor-event-emit-points.test.js` (new — integration test verifying events flow through)

**Step 1: Write failing tests**

Test that each emit point records a per-event with the correct correlation keys:

```javascript
// For each of the 4 emit points:
// 1. Call the route handler with test data
// 2. Assert getAnchorEventSnapshot() contains the expected preview/drill event
// 3. Assert itemIds match the response's message/task IDs
```

Key test cases:
- pending-mentions: preview event with each mention's messageId as itemId
- thread-context: preview event with each message's id as itemId
- list-tasks (no taskId): preview event with each task's taskId as itemId
- list-tasks (with taskId): drill event with the specific taskId as itemId
- get-message (mode=full): drill event with messageId as itemId

**Step 2: Add `recordAnchorPreviewEvent` / `recordAnchorDrillEvent` calls at each emit point**

At each existing `recordAnchorReturned(...)` call site, ADD (not replace — Track-1 OTel continues):

```typescript
// callbacks.ts — pending-mentions (~line 1841)
recordAnchorPreviewEvent({
  tool: 'pending-mentions',
  itemIds: payload.mentions.map(m => m.id),
  returnedChars,
  originalChars: payload.mentions.reduce((sum, m) => sum + m.contentLength, 0),
});

// callbacks.ts — thread-context (~line 2193)
recordAnchorPreviewEvent({
  tool: 'thread-context',
  itemIds: payload.messages.map(m => m.id),
  returnedChars,
  originalChars: payload.messages.reduce((sum, m) => sum + m.contentLength, 0),
});

// callback-task-routes.ts — list-tasks preview (~line 260)
recordAnchorPreviewEvent({
  tool: 'list-tasks',
  itemIds: payload.tasks.map(t => t.id),
  returnedChars,
  originalChars: payload.tasks.reduce((sum, t) => sum + (t.whyLength ?? 0), 0),
});
```

At each existing `recordAnchorFullDrill(...)` call site, ADD:

```typescript
// callback-task-routes.ts — list-tasks drill (~line 275)
recordAnchorDrillEvent({
  tool: 'list-tasks',
  itemId: taskId,     // the requested taskId
  fullDrillChars,
});

// callbacks.ts — get-message full drill (~line 2349)
recordAnchorDrillEvent({
  tool: 'get-message',
  itemId: messageId,  // the requested messageId
  fullDrillChars,
});
```

**Step 3: Run tests, verify pass**

Run: `pnpm --filter @cat-cafe/api test -- anchor-event-emit`
Expected: All PASS.

**Step 4: Commit**

---

### Task 3: Source Selector Type + Validation (shared + API)

**Files:**
- Create: `packages/shared/src/types/anchor-telemetry.ts` (AnchorTelemetrySourceSelector)
- Modify: `packages/shared/src/types/index.ts` (re-export)
- Modify: `packages/api/src/infrastructure/harness-eval/publish-verdict/types.ts` (add to VerdictSourceRefs union)
- Modify: `packages/api/src/infrastructure/harness-eval/publish-verdict/validation.ts` (discriminator + validator + KNOWN_SOURCE_REFS_KINDS)
- Modify: `packages/mcp-server/src/tools/publish-verdict-tool.ts` (add zod shape to sourceRefsShape union — 易漏点 ①)
- Test: extend `packages/mcp-server/test/publish-verdict-tool-schema.test.js`

**Step 1: Write failing test**

Test that `isAnchorTelemetrySourceRefs()` correctly discriminates + `validateAnchorTelemetrySelector()` rejects bad windows.

**Step 2: Implement**

```typescript
// packages/shared/src/types/anchor-telemetry.ts
export interface AnchorTelemetrySourceSelector {
  kind: 'anchor-telemetry-snapshot';
  /** Inclusive epoch ms window start. */
  windowStartMs: number;
  /** Exclusive epoch ms window end. Must be > windowStartMs. */
  windowEndMs: number;
}
```

In `validation.ts`:
- Add `isAnchorTelemetrySourceRefs()` discriminator
- Add `validateAnchorTelemetrySelector()` structural validator
- Add `'anchor-telemetry-snapshot'` to `KNOWN_SOURCE_REFS_KINDS`
- Insert `isAnchorTelemetrySourceRefs` guard in `inferSourceRefsKind()` BEFORE the a2a default

In `types.ts`:
- Import `AnchorTelemetrySourceSelector` from `@cat-cafe/shared`
- Add to `VerdictSourceRefs` union

In `publish-verdict-tool.ts` (易漏点 ①):
- Add `anchorTelemetrySourceRefsShape` zod object
- Add to `sourceRefsShape` union
- Add to `PublishVerdictToolInput` type

**Step 3: Build shared, run tests**

Run: `pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api test -- validation && pnpm --filter @cat-cafe/mcp-server test -- publish-verdict-tool-schema`

**Step 4: Commit**

---

### Task 4: YAML Registration + Eval-Cat Instructions

**Files:**
- Create: `docs/harness-feedback/eval-domains/eval-anchor-first.yaml`
- Modify: `packages/api/src/infrastructure/harness-eval/eval-cat-invocation.ts` (DOMAIN_INSTRUCTIONS + PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN — 易漏点 ②)
- Test: extend existing eval-cat-invocation tests

**Step 1: Write YAML**

```yaml
domainId: eval:anchor-first
displayName: Anchor-First Context Entry Eval
systemThreadId: thread_eval_anchor_first
evalCat:
  catId: gpt52
  handle: "@gpt52"
  model: gpt-5.4
frequency: weekly
sourceAdapter: f236-anchor-telemetry
sourceRefsKind: anchor-telemetry-snapshot
threadPolicy:
  role: working-home
  stateSot: registry
  allowedContent:
    - longitudinal-analysis
    - verdict-discussion
    - handoff-drafts
legacyScheduledTaskIds: []
handoffTargetResolver:
  featureId: F236
  ownerCatId: opus-47
  threadLookup: feature-thread
sla:
  acknowledgeHours: 48
  reevalWithinHours: 168
# Gated OFF until generator adapter is wired (Task 6 flips to true).
enabled: false
```

**Step 2: Add instructions**

`DOMAIN_INSTRUCTIONS['eval:anchor-first']` — instruction telling eval cat to:
- Review anchor-first telemetry rollup (per-tool open-rate + chars substrate + net benefit)
- Check double-sided: savings vs drill cost
- Reference-read eval:task-outcome for blindness signal (变瞎子)
- Produce verdict with 4-class harness judgement

`PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN['eval:anchor-first']` — sourceRefs shape documentation for the anchor-telemetry-snapshot selector.

**Step 3: Write failing test — `buildEvalCatInvocation` for anchor-first returns instructions**

**Step 4: Run test, verify pass, commit**

---

### Task 5: Generator Adapter + Live Verdict

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/publish-verdict/anchor-telemetry-generator-adapter.ts`
- Create: `packages/api/src/infrastructure/harness-eval/anchor-first/eval-anchor-first-live-verdict.ts`
- Test: `packages/api/test/anchor-telemetry-generator-adapter.test.js` (new)

**Step 1: Write failing tests**

Test the adapter:
1. Rejects wrong sourceRefs kind → throws
2. Calls provider.resolve(selector) → rollup
3. Passes rollup to live verdict generator → writes verdict.md + bundle
4. Returns { verdictPath, bundleDir }

**Step 2: Implement**

```typescript
// anchor-telemetry-generator-adapter.ts
export interface AnchorTelemetryMetricsProvider {
  resolve(selector: AnchorTelemetrySourceSelector): Promise<AnchorTelemetryRollup>;
}

export function createAnchorTelemetryGeneratorAdapter(
  provider: AnchorTelemetryMetricsProvider,
): VerdictGenerator {
  return async (packet, sourceRefs, deps) => {
    const kind = (sourceRefs as { kind?: string }).kind;
    if (kind !== 'anchor-telemetry-snapshot') {
      throw new Error(`anchor_adapter_wrong_kind: received sourceRefs with kind='${kind ?? '(omitted)'}'`);
    }
    const selector = sourceRefs as AnchorTelemetrySourceSelector;
    const validationError = validateAnchorTelemetrySelector(selector);
    if (validationError) throw new Error(`invalid_source_ref: ${validationError}`);

    const rollup = await provider.resolve(selector);

    const domains = loadDomains(deps.harnessFeedbackRoot);
    const domain = domains.get(packet.domainId);
    if (!domain || domain.domainId !== 'eval:anchor-first') {
      throw new Error(`anchor_adapter_wrong_domain: expected eval:anchor-first`);
    }

    const artifact = generateAnchorFirstLiveVerdict({
      verdictId: packet.id,
      harnessFeedbackRoot: deps.harnessFeedbackRoot,
      domain,
      rollup,
      selector,
      submittedPacket: packet,
    });

    return { verdictPath: artifact.path, bundleDir: artifact.bundleDir };
  };
}
```

Live verdict generator (`eval-anchor-first-live-verdict.ts`): mirrors `eval-friction-live-verdict.ts` — writes rollup report JSON to bundle/raw/, writes snapshot + attribution + provenance.json, renders verdict.md from packet + rollup.

**Step 3: Run tests, verify pass, commit**

---

### Task 6: Provider Implementation + Wiring

**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/anchor-first/anchor-telemetry-provider-impl.ts`
- Modify: `packages/api/src/index.ts` (wire generator + wiredPublishDomains)
- Modify: `docs/harness-feedback/eval-domains/eval-anchor-first.yaml` (flip `enabled: true`)
- Test: `packages/api/test/anchor-telemetry-provider.test.js` (new)

**Step 1: Write failing test for provider**

Provider calls `getAnchorTelemetryRollup(window)` + `getAnchorTelemetrySnapshot()` and returns the combined rollup.

**Step 2: Implement provider**

```typescript
export class AnchorTelemetryProviderImpl implements AnchorTelemetryMetricsProvider {
  async resolve(selector: AnchorTelemetrySourceSelector): Promise<AnchorTelemetryRollup> {
    return getAnchorTelemetryRollup({
      windowStartMs: selector.windowStartMs,
      windowEndMs: selector.windowEndMs,
    });
  }
}
```

**Step 3: Wire in index.ts**

```typescript
// In verdictGenerators block:
{
  const { createAnchorTelemetryGeneratorAdapter } = await import(
    './infrastructure/harness-eval/publish-verdict/anchor-telemetry-generator-adapter.js'
  );
  const { AnchorTelemetryProviderImpl } = await import(
    './infrastructure/harness-eval/anchor-first/anchor-telemetry-provider-impl.js'
  );
  const anchorProvider = new AnchorTelemetryProviderImpl();
  verdictGenerators['eval:anchor-first'] = createAnchorTelemetryGeneratorAdapter(anchorProvider);
}

// In wiredPublishDomains block:
wiredPublishDomains.add('eval:anchor-first');
```

**Step 4: Flip YAML enabled: true, run full test suite**

Run: `pnpm --filter @cat-cafe/api test && pnpm --filter @cat-cafe/mcp-server test`

**Step 5: Commit**

---

### Task 7: Architecture Ownership + F192/F236 Doc Sync

**Files:**
- Modify: `docs/architecture/ownership/cells/harness-eval.md` (add eval:anchor-first domain)
- Modify: `docs/features/F236-anchor-first-context-entry.md` (mark AC-E2/E4 done, update Status)
- Modify: `docs/features/F192-socio-technical-harness-eval.md` (add one-line link to F236 eval spec — not bloat)

**Step 1: Update docs, commit + push**

---

## Open Questions

### Technical OQ (self-resolve during implementation)

1. **Drill→preview tool mapping**: get-message drills join to both thread-context and pending-mentions previews (both preview messages). The rollup join uses itemId (messageId) to find which preview tool the drill belongs to. If the same messageId appears in both thread-context and pending-mentions previews (possible), attribute the drill to the tool whose preview was most recent (latest timestamp).

2. **list-tasks itemId field name**: Need to verify the task ID field name in the list-tasks response (likely `id` or `taskId`). Will confirm by reading callback-task-routes.ts during implementation.

### Value OQ — None

All decisions are reversible (≤1 commit), align with F192 existing patterns, and follow CVO-approved F236 spec. No CVO escalation needed.

---

## Checklist (3 易漏点 from F245 实测)

- [ ] ① `publish-verdict-tool.ts` — add `anchorTelemetrySourceRefsShape` to `sourceRefsShape` union (独立 zod schema, must stay in sync with `types.ts`)
- [ ] ② `eval-cat-invocation.ts` — add to BOTH `DOMAIN_INSTRUCTIONS` AND `PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN` maps
- [ ] ③ `assertNoNewlineInBulletFields` — no new bullet fields added by this domain (existing guard covers all packet fields already; verify no regression)

---

## Implementation Sequence

```
Task 1 (event model)  ──→  Task 2 (emit points)  ──→  Task 3 (source refs type)
                                                            │
                                                            ├──→  Task 4 (YAML + instructions)
                                                            │
                                                            ├──→  Task 5 (generator adapter)
                                                            │
                                                            └──→  Task 6 (provider + wiring)  ──→  Task 7 (docs)
```

Tasks 4/5 can partially parallelize after Task 3; Task 6 depends on both 4 and 5; Task 7 is final cleanup.
