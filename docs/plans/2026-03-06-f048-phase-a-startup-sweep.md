# F048 Phase A — Startup Sweep Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** On API startup, sweep Redis for orphaned `running` invocation records (left by crashed processes) and converge them to `failed(error=process_restart)`, clearing associated task progress snapshots.

**Architecture:** New `StartupReconciler` service called once in `index.ts` after stores are created but before routes are registered. Uses Redis SCAN to find `invoc:*` keys, checks status, and batch-updates stale records. Pure function design — no timers, no background workers.

**Tech Stack:** ioredis (SCAN + pipeline), node:test, existing `RedisInvocationRecordStore` + `TaskProgressStore` interfaces.

**Not building:** Queue persistence (Phase B), periodic watchdog, WebSocket notifications, new frontend UI states.

---

## Terminal Schema

```typescript
// New type (for sweep results, used in audit log)
interface StartupSweepResult {
  swept: number;           // total records converged
  running: number;         // running → failed
  queued: number;          // stale queued → failed
  taskProgressCleared: number;
  durationMs: number;
}

// No new InvocationStatus — reuse 'failed' with error = 'process_restart'
// No new TaskProgressStatus — reuse 'interrupted' (already exists in TaskProgressStore.ts)
```

---

## Task 1: Add `scanByStatus` to RedisInvocationRecordStore

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisInvocationRecordStore.ts`
- Modify: `packages/api/src/domains/cats/services/stores/ports/InvocationRecordStore.ts` (interface)
- Test: `packages/api/test/startup-reconciler.test.js`

We need a way to find all invocation records with a given status. Redis stores invocation records as hashes (`invoc:{id}`), so we'll SCAN for `invoc:*` keys and filter by status field.

**Step 1: Write the failing test**

```javascript
// test/startup-reconciler.test.js
test('scanByStatus returns records matching the given status', async () => {
  // Create store with mock redis that has 2 running + 1 succeeded records
  // Call scanByStatus('running')
  // Assert: returns exactly the 2 running record IDs
});
```

**Step 2: Run test → expected FAIL (method doesn't exist)**

**Step 3: Add `scanByStatus` method**

Add to `IInvocationRecordStore` interface (optional method, only Redis impl has it):

```typescript
// In RedisInvocationRecordStore.ts
async scanByStatus(status: InvocationStatus): Promise<string[]> {
  const ids: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, keys] = await this.redis.scan(
      cursor, 'MATCH', 'invoc:*', 'COUNT', 100
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const key of keys) pipeline.hget(key, 'status');
      const results = await pipeline.exec();
      for (let i = 0; i < keys.length; i++) {
        const [err, val] = results![i]!;
        if (!err && val === status) {
          // Extract ID from key pattern "invoc:{id}" (keyPrefix stripped by scan)
          ids.push(keys[i]!.replace(/^invoc:/, ''));
        }
      }
    }
  } while (cursor !== '0');
  return ids;
}
```

**Step 4: Run test → PASS**

**Step 5: Commit**

```
feat(F048): add scanByStatus to RedisInvocationRecordStore
```

---

## Task 2: Create StartupReconciler service

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/invocation/StartupReconciler.ts`
- Test: `packages/api/test/startup-reconciler.test.js` (add to existing)

**Step 1: Write the failing test**

```javascript
test('reconcileOrphans sweeps running records to failed', async () => {
  // Setup: create a RedisInvocationRecordStore with 2 running, 1 succeeded
  // Setup: task progress store with matching snapshots
  // Call: reconciler.reconcileOrphans()
  // Assert: 2 running → failed (error = 'process_restart')
  // Assert: task progress cleared for swept records
  // Assert: result.swept === 2, result.running === 2
});

test('reconcileOrphans skips stores without scanByStatus (memory mode)', async () => {
  // Setup: InvocationRecordStore (in-memory, no scanByStatus)
  // Call: reconciler.reconcileOrphans()
  // Assert: returns { swept: 0 } — no-op in memory mode
});
```

**Step 2: Run test → FAIL**

**Step 3: Implement StartupReconciler**

```typescript
// StartupReconciler.ts
import type { IInvocationRecordStore } from '../../stores/ports/InvocationRecordStore.js';
import type { TaskProgressStore } from './TaskProgressStore.js';
import type { RedisInvocationRecordStore } from '../../stores/redis/RedisInvocationRecordStore.js';

export interface StartupSweepResult {
  swept: number;
  running: number;
  queued: number;
  taskProgressCleared: number;
  durationMs: number;
}

export interface StartupReconcilerDeps {
  invocationRecordStore: IInvocationRecordStore;
  taskProgressStore: TaskProgressStore;
  log: { info: (msg: string) => void; warn: (msg: string) => void };
}

export class StartupReconciler {
  constructor(private readonly deps: StartupReconcilerDeps) {}

  async reconcileOrphans(): Promise<StartupSweepResult> {
    const start = Date.now();
    const store = this.deps.invocationRecordStore;

    // Guard: only Redis-backed stores have scanByStatus
    if (!('scanByStatus' in store)) {
      this.deps.log.info('[startup-reconciler] Memory mode — no orphans to sweep');
      return { swept: 0, running: 0, queued: 0, taskProgressCleared: 0, durationMs: Date.now() - start };
    }

    const redisStore = store as RedisInvocationRecordStore;
    let running = 0;
    let queued = 0;
    let taskProgressCleared = 0;

    // Sweep running records
    const runningIds = await redisStore.scanByStatus('running');
    for (const id of runningIds) {
      const record = await redisStore.get(id);
      if (!record) continue;
      const updated = await redisStore.update(id, {
        status: 'failed',
        expectedStatus: 'running',
        error: 'process_restart',
      });
      if (updated) {
        running++;
        // Clear task progress for this thread+cat combination
        for (const catId of record.targetCats) {
          try {
            await this.deps.taskProgressStore.deleteSnapshot(record.threadId, catId);
            taskProgressCleared++;
          } catch { /* best-effort */ }
        }
      }
    }

    // Sweep stale queued records (> 5 min old)
    const queuedIds = await redisStore.scanByStatus('queued');
    const staleThreshold = Date.now() - 5 * 60 * 1000;
    for (const id of queuedIds) {
      const record = await redisStore.get(id);
      if (!record || record.createdAt > staleThreshold) continue;
      const updated = await redisStore.update(id, {
        status: 'failed',
        expectedStatus: 'queued',
        error: 'process_restart',
      });
      if (updated) queued++;
    }

    const swept = running + queued;
    const durationMs = Date.now() - start;
    this.deps.log.info(
      `[startup-reconciler] Sweep complete: ${swept} orphans (${running} running, ${queued} stale queued), ` +
      `${taskProgressCleared} task-progress cleared, ${durationMs}ms`
    );
    return { swept, running, queued, taskProgressCleared, durationMs };
  }
}
```

**Step 4: Run test → PASS**

**Step 5: Commit**

```
feat(F048): StartupReconciler service — sweep orphaned invocations on startup
```

---

## Task 3: Wire into startup flow + audit log

**Files:**
- Modify: `packages/api/src/index.ts` (~5 lines, after store creation)
- Modify: `packages/api/src/domains/cats/services/orchestration/EventAuditLog.ts` (add event type)
- Modify: `packages/api/src/domains/cats/services/index.ts` (export)
- Test: `packages/api/test/startup-reconciler.test.js` (add integration-style test)

**Step 1: Write the failing test**

```javascript
test('startup reconciler is called and logs audit event', async () => {
  // This is more of a smoke test: ensure the module exports correctly
  // and StartupReconciler can be instantiated with the right deps
});
```

**Step 2: Add STARTUP_SWEEP audit event type**

In `EventAuditLog.ts`:
```typescript
/** F048: Startup sweep completed */
STARTUP_SWEEP: 'startup_sweep',
```

**Step 3: Wire in index.ts**

Insert after `const invocationRecordStore = createInvocationRecordStore(redis);` (line ~133) and after `const taskProgressStore = ...` (line ~132):

```typescript
// F048: Sweep orphaned invocations from previous process crash
if (redis) {
  const { StartupReconciler } = await import('./domains/cats/services/agents/invocation/StartupReconciler.js');
  const reconciler = new StartupReconciler({
    invocationRecordStore,
    taskProgressStore,
    log: app.log,
  });
  try {
    const sweepResult = await reconciler.reconcileOrphans();
    if (sweepResult.swept > 0) {
      await auditLog.append({
        type: AuditEventTypes.STARTUP_SWEEP,
        data: sweepResult,
      });
    }
  } catch (err) {
    app.log.warn(`[api] Startup sweep failed (best-effort): ${String(err)}`);
  }
}
```

Note: `auditLog` is created later (line ~468). We need to either move the audit log creation earlier, or just log to app.log and skip audit file for sweep (it's already logged via app.log.info inside the reconciler). **Decision: use app.log only, skip audit log for sweep.** Simpler, no startup ordering changes needed.

Revised wiring (no audit log dependency):
```typescript
// F048: Sweep orphaned invocations from previous process crash
if (redis) {
  const { StartupReconciler } = await import('./domains/cats/services/agents/invocation/StartupReconciler.js');
  const reconciler = new StartupReconciler({
    invocationRecordStore,
    taskProgressStore,
    log: app.log,
  });
  try {
    await reconciler.reconcileOrphans();
  } catch (err) {
    app.log.warn(`[api] Startup sweep failed (best-effort): ${String(err)}`);
  }
}
```

**Step 4: Run full test suite → PASS**

**Step 5: Commit**

```
feat(F048): wire StartupReconciler into API startup flow
```

---

## Task 4: Edge case tests

**Files:**
- Test: `packages/api/test/startup-reconciler.test.js`

Additional test cases:

```javascript
test('does not sweep succeeded/failed/canceled records', async () => {
  // Only running and stale queued should be swept
});

test('does not sweep recently queued records (< 5min)', async () => {
  // Fresh queued records should survive (they might be from a just-started process)
});

test('CAS guard prevents double-sweep race', async () => {
  // If another process already swept the record, expectedStatus won't match
  // update() returns null, swept count stays correct
});

test('best-effort: continues if individual record update fails', async () => {
  // One record fails to update → others still get swept
});
```

**Step 1-4: Write tests, run, verify PASS**

**Step 5: Commit**

```
test(F048): edge cases — status filter, stale threshold, CAS guard, error resilience
```

---

## Task 5: Verify with existing test suite

```bash
cd packages/api && pnpm test
pnpm check     # Biome lint
pnpm lint       # TypeScript type check
```

**Commit all fixups if needed.**

---

## Summary

| Task | What | Est. lines |
|------|------|-----------|
| 1 | `scanByStatus` on RedisInvocationRecordStore | ~25 |
| 2 | `StartupReconciler` service | ~60 |
| 3 | Wire into `index.ts` + audit event type | ~15 |
| 4 | Edge case tests | ~80 |
| 5 | Full suite verification | 0 (fixes only) |
| **Total** | | **~180** |

All within the 200-line file limit. No new files exceed limits. No new dependencies.
