---
feature_ids: [F188]
doc_kind: plan
created: 2026-05-06
---

# F188 Phase A: 运行期维护入口 — Implementation Plan

**Feature:** F188 — `docs/features/F188-library-stewardship.md`
**Goal:** 铲屎官/猫猫能在不重启服务的情况下触发全量重建索引，并看到进度
**Acceptance Criteria:**
- AC-A1: `POST /api/evidence/rebuild` 触发全量 rebuild，返回 task id
- AC-A2: `GET /api/evidence/rebuild/:taskId` 返回 status / progress / error / result
- AC-A3: Hub Memory 面板有 "重建索引" 按钮，点击后显示进度
- AC-A4: rebuild 运行期间，search 仍可用（不阻塞读）
**Architecture:** 后台 async rebuild + 内存 job tracker + 前端轮询进度。IndexBuilder.rebuild() 增加 onProgress 回调报告阶段进度；RebuildJobTracker 追踪 job 状态；evidence routes 新增 rebuild POST/GET；IndexStatus 组件加按钮+进度条。
**Tech Stack:** node:test (backend) / vitest (frontend) / Fastify routes / React
**前端验证:** Yes — 重建按钮 + 进度条需浏览器实测

---

## Terminal Schema

```typescript
// RebuildJobTracker — in-memory, no SQLite (KD-3: minimal, not full Ledger)
interface RebuildJob {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  phase: string;        // 'scanning' | 'indexing' | 'embedding' | 'cleanup'
  percent: number;       // 0-100
  error?: string;
  result?: RebuildResult; // { docsIndexed, docsSkipped, durationMs }
  startedAt: number;
  completedAt?: number;
}

// Progress callback shape for IndexBuilder
type RebuildProgressCallback = (phase: string, percent: number) => void;
```

## Task 1: RebuildJobTracker

**Files:**
- Create: `packages/api/src/domains/memory/RebuildJobTracker.ts`
- Test: `packages/api/test/memory/rebuild-job-tracker.test.js`

**Step 1: Write failing tests**

```javascript
// test/memory/rebuild-job-tracker.test.js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('RebuildJobTracker', () => {
  it('creates a job with pending status', async () => {
    const { RebuildJobTracker } = await import('../../dist/domains/memory/RebuildJobTracker.js');
    const tracker = new RebuildJobTracker();
    const id = tracker.create();
    const job = tracker.get(id);
    assert.equal(job.status, 'pending');
    assert.equal(job.percent, 0);
  });

  it('updates progress', async () => {
    const { RebuildJobTracker } = await import('../../dist/domains/memory/RebuildJobTracker.js');
    const tracker = new RebuildJobTracker();
    const id = tracker.create();
    tracker.updateProgress(id, 'scanning', 50);
    const job = tracker.get(id);
    assert.equal(job.status, 'running');
    assert.equal(job.phase, 'scanning');
    assert.equal(job.percent, 50);
  });

  it('marks done with result', async () => {
    const { RebuildJobTracker } = await import('../../dist/domains/memory/RebuildJobTracker.js');
    const tracker = new RebuildJobTracker();
    const id = tracker.create();
    const result = { docsIndexed: 42, docsSkipped: 3, durationMs: 1200 };
    tracker.complete(id, result);
    const job = tracker.get(id);
    assert.equal(job.status, 'done');
    assert.deepEqual(job.result, result);
  });

  it('marks error', async () => {
    const { RebuildJobTracker } = await import('../../dist/domains/memory/RebuildJobTracker.js');
    const tracker = new RebuildJobTracker();
    const id = tracker.create();
    tracker.fail(id, 'disk full');
    const job = tracker.get(id);
    assert.equal(job.status, 'error');
    assert.equal(job.error, 'disk full');
  });

  it('returns null for unknown id', async () => {
    const { RebuildJobTracker } = await import('../../dist/domains/memory/RebuildJobTracker.js');
    const tracker = new RebuildJobTracker();
    assert.equal(tracker.get('nonexistent'), null);
  });

  it('rejects concurrent rebuild', async () => {
    const { RebuildJobTracker } = await import('../../dist/domains/memory/RebuildJobTracker.js');
    const tracker = new RebuildJobTracker();
    tracker.create();
    tracker.updateProgress(tracker.create(), 'scanning', 0); // first is running
    // Actually: create sets pending, need to start it
    const tracker2 = new RebuildJobTracker();
    const id1 = tracker2.create();
    tracker2.updateProgress(id1, 'scanning', 10);
    assert.throws(() => tracker2.create(), /rebuild already running/i);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/api && pnpm build && node --test test/memory/rebuild-job-tracker.test.js`
Expected: FAIL — module not found

**Step 3: Implement RebuildJobTracker**

```typescript
// packages/api/src/domains/memory/RebuildJobTracker.ts
import { randomUUID } from 'node:crypto';
import type { RebuildResult } from './interfaces.js';

export interface RebuildJob {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  phase: string;
  percent: number;
  error?: string;
  result?: RebuildResult;
  startedAt: number;
  completedAt?: number;
}

export class RebuildJobTracker {
  private jobs = new Map<string, RebuildJob>();

  create(): string {
    // Reject if any job is pending or running
    for (const job of this.jobs.values()) {
      if (job.status === 'pending' || job.status === 'running') {
        throw new Error('Rebuild already running');
      }
    }
    const id = randomUUID();
    this.jobs.set(id, {
      id,
      status: 'pending',
      phase: '',
      percent: 0,
      startedAt: Date.now(),
    });
    return id;
  }

  get(id: string): RebuildJob | null {
    return this.jobs.get(id) ?? null;
  }

  updateProgress(id: string, phase: string, percent: number): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'running';
    job.phase = phase;
    job.percent = Math.min(100, Math.max(0, percent));
  }

  complete(id: string, result: RebuildResult): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'done';
    job.percent = 100;
    job.result = result;
    job.completedAt = Date.now();
  }

  fail(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'error';
    job.error = error;
    job.completedAt = Date.now();
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/api && pnpm build && node --test test/memory/rebuild-job-tracker.test.js`
Expected: PASS

**Step 5: Commit**

```
feat(F188): add RebuildJobTracker for async rebuild status tracking
```

---

## Task 2: IndexBuilder.rebuild() progress callback

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts` (add callback type to IIndexBuilder)
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts` (wire callback into rebuild phases)
- Test: `packages/api/test/memory/index-builder-progress.test.js`

**Step 1: Write failing test**

```javascript
// test/memory/index-builder-progress.test.js
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

describe('IndexBuilder rebuild progress callback', () => {
  it('reports scanning and indexing phases', async () => {
    const { IndexBuilder } = await import('../../dist/domains/memory/IndexBuilder.js');
    const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');

    const dir = mkdtempSync(join(tmpdir(), 'idx-prog-'));
    const docsDir = join(dir, 'docs');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(docsDir, 'features'), { recursive: true });
    writeFileSync(join(docsDir, 'features', 'F001-test.md'), [
      '---', 'feature_ids: [F001]', 'doc_kind: spec', '---',
      '# F001: Test', 'Summary text.'
    ].join('\n'));

    const dbPath = join(dir, 'evidence.sqlite');
    const store = new SqliteEvidenceStore(dbPath);
    await store.initialize();
    const builder = new IndexBuilder(store, docsDir);

    const phases = [];
    await builder.rebuild({
      onProgress: (phase, percent) => phases.push({ phase, percent }),
    });

    assert.ok(phases.length > 0, 'should report at least one progress update');
    assert.ok(phases.some(p => p.phase === 'scanning'), 'should report scanning phase');
    assert.ok(phases.some(p => p.phase === 'indexing'), 'should report indexing phase');
    const last = phases[phases.length - 1];
    assert.equal(last.percent, 100);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm build && node --test test/memory/index-builder-progress.test.js`
Expected: FAIL — onProgress not accepted

**Step 3: Modify interfaces.ts — add onProgress to rebuild options**

In `interfaces.ts`, update `IIndexBuilder`:

```typescript
export interface IIndexBuilder {
  rebuild(options?: { force?: boolean; onProgress?: (phase: string, percent: number) => void }): Promise<RebuildResult>;
  incrementalUpdate(changedPaths: string[]): Promise<void>;
  checkConsistency(): Promise<ConsistencyReport>;
}
```

**Step 4: Modify IndexBuilder.rebuild() — wire progress callback**

Insert progress calls at each major phase boundary in the existing `rebuild()` method:

```typescript
async rebuild(options?: { force?: boolean; onProgress?: (phase: string, percent: number) => void }): Promise<RebuildResult> {
  const report = options?.onProgress ?? (() => {});
  const start = Date.now();
  // ...existing code...

  // Phase: scanning
  report('scanning', 0);
  const scannedItems = this.scanner.discover(this.scanRoot, this.buildScanOptions());
  report('scanning', 20);

  // Phase: indexing (docs)
  report('indexing', 20);
  // ...existing upsert loop...
  report('indexing', 40);

  // Phase: indexing (edges + sessions + threads + passages)
  // ...existing edge extraction...
  report('indexing', 50);
  // ...existing session/thread/passage indexing...
  report('indexing', 70);

  // Phase: embedding
  report('embedding', 70);
  await this.embedIndexedItems(indexedItems);
  report('embedding', 90);

  // Phase: cleanup
  report('cleanup', 90);
  // ...existing stale anchor removal...
  report('cleanup', 100);

  return { docsIndexed: indexed, docsSkipped: skipped, durationMs: Date.now() - start };
}
```

**Step 5: Run test to verify it passes**

Run: `cd packages/api && pnpm build && node --test test/memory/index-builder-progress.test.js`
Expected: PASS

**Step 6: Commit**

```
feat(F188): add onProgress callback to IndexBuilder.rebuild()
```

---

## Task 3: POST /api/evidence/rebuild + GET status routes

**Files:**
- Modify: `packages/api/src/routes/evidence.ts` (add routes + inject RebuildJobTracker)
- Test: `packages/api/test/memory/evidence-rebuild-route.test.js`

**Step 1: Write failing tests**

```javascript
// test/memory/evidence-rebuild-route.test.js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('POST /api/evidence/rebuild', () => {
  it('returns taskId on success', async () => {
    // Uses Fastify inject pattern (same as evidence-route.test.js)
    // POST /api/evidence/rebuild → { taskId: string }
    // ... test body ...
  });

  it('rejects non-localhost', async () => {
    // POST from non-localhost → 403
  });

  it('rejects concurrent rebuild', async () => {
    // POST while another rebuild running → 409
  });
});

describe('GET /api/evidence/rebuild/:taskId', () => {
  it('returns job status', async () => {
    // GET /api/evidence/rebuild/:id → { id, status, phase, percent, ... }
  });

  it('returns 404 for unknown taskId', async () => {
    // GET /api/evidence/rebuild/unknown → 404
  });
});
```

**Step 2: Implement routes**

Add to `evidence.ts` EvidenceRoutesOptions:

```typescript
export interface EvidenceRoutesOptions {
  docsRoot?: string;
  evidenceStore: IEvidenceStore;
  indexBuilder?: IIndexBuilder;
  knowledgeResolver?: IKnowledgeResolver;
  rebuildJobTracker?: RebuildJobTracker; // new
}
```

Add POST route:

```typescript
app.post('/api/evidence/rebuild', async (request, reply) => {
  // localhost guard
  const ip = request.ip;
  if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
    reply.status(403);
    return { error: 'Forbidden: localhost only' };
  }
  if (!opts.indexBuilder || !opts.rebuildJobTracker) {
    reply.status(503);
    return { error: 'rebuild not available' };
  }

  let taskId: string;
  try {
    taskId = opts.rebuildJobTracker.create();
  } catch (e) {
    reply.status(409);
    return { error: (e as Error).message };
  }

  // Fire and forget — rebuild runs in background (AC-A4: non-blocking)
  const tracker = opts.rebuildJobTracker;
  const builder = opts.indexBuilder;
  void (async () => {
    try {
      const result = await builder.rebuild({
        force: true,
        onProgress: (phase, percent) => tracker.updateProgress(taskId, phase, percent),
      });
      tracker.complete(taskId, result);
    } catch (err) {
      tracker.fail(taskId, String(err));
    }
  })();

  return { taskId };
});
```

Add GET route:

```typescript
app.get<{ Params: { taskId: string } }>('/api/evidence/rebuild/:taskId', async (request, reply) => {
  if (!opts.rebuildJobTracker) {
    reply.status(503);
    return { error: 'rebuild not available' };
  }
  const job = opts.rebuildJobTracker.get(request.params.taskId);
  if (!job) {
    reply.status(404);
    return { error: 'Task not found' };
  }
  return job;
});
```

**Step 3: Wire RebuildJobTracker into app factory**

Find where `evidenceRoutes` is registered (likely `factory/index.ts` or similar DI setup) and create + inject a `RebuildJobTracker` instance.

**Step 4: Run tests**

Run: `cd packages/api && pnpm build && node --test test/memory/evidence-rebuild-route.test.js`
Expected: PASS

**Step 5: Commit**

```
feat(F188): add POST/GET /api/evidence/rebuild routes with async job tracking
```

---

## Task 4: Frontend — 重建索引 button + progress in IndexStatus

**Files:**
- Modify: `packages/web/src/components/memory/IndexStatus.tsx` (add rebuild button + progress)
- Test: `packages/web/src/__tests__/index-status.test.ts` (add rebuild state tests)

**Step 1: Write failing test**

```typescript
// Add to packages/web/src/__tests__/index-status.test.ts
describe('rebuild button state', () => {
  it('parseRebuildJob parses running job', () => {
    const raw = { id: 'abc', status: 'running', phase: 'scanning', percent: 42 };
    const job = parseRebuildJob(raw);
    expect(job.status).toBe('running');
    expect(job.percent).toBe(42);
    expect(job.phase).toBe('scanning');
  });

  it('parseRebuildJob parses done job', () => {
    const raw = { id: 'abc', status: 'done', phase: 'cleanup', percent: 100,
      result: { docsIndexed: 50, docsSkipped: 10, durationMs: 3000 } };
    const job = parseRebuildJob(raw);
    expect(job.status).toBe('done');
    expect(job.result?.docsIndexed).toBe(50);
  });
});
```

**Step 2: Implement**

Add to `IndexStatus.tsx`:

1. `parseRebuildJob()` pure function (exported for testing)
2. `RebuildButton` sub-component:
   - Idle state: "重建索引" button
   - Running state: progress bar + phase label + percent
   - Done state: result summary (docs indexed / skipped / duration) + "完成" badge
   - Error state: error message + retry button
3. State management: `useState` for rebuild job, `useEffect` poll interval (1s when running)
4. POST `/api/evidence/rebuild` on click → store taskId → start polling GET
5. Stop polling when status is `done` or `error`

**Step 3: Run tests**

Run: `cd packages/web && pnpm test -- --grep "rebuild"`
Expected: PASS

**Step 4: Browser verification**

- Open Hub Memory → Status tab
- Click "重建索引"
- Verify progress updates in real time
- Verify search still works during rebuild (AC-A4)

**Step 5: Commit**

```
feat(F188): add rebuild button with progress tracking to IndexStatus
```

---

## Verification Checklist

| AC | How to verify |
|----|--------------|
| AC-A1 | `curl -X POST localhost:3001/api/evidence/rebuild` returns `{ taskId }` |
| AC-A2 | `curl localhost:3001/api/evidence/rebuild/$TASK_ID` returns status/progress/result |
| AC-A3 | Browser: Hub Memory → Status → 重建索引 button shows progress |
| AC-A4 | During rebuild, `curl localhost:3001/api/evidence/search?q=test` still returns results |

## What We're NOT Building

- Full Durable Job Ledger (KD-3: wait until job types ≥3)
- Collection-level rebuild from this button (collections already have `/api/library/:id/rebuild`)
- Persistent job state across server restarts (in-memory is sufficient for Phase A)
- Auto-scheduled rebuilds / cron
