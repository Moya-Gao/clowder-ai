# F139 Phase 1a: Unified Internal Poller — Implementation Plan

**Feature:** F139 — `docs/features/F139-unified-schedule-abstraction.md`
**Goal:** 将现有三套独立 setInterval 收敛为统一 TaskSpec_P1 调度模型，typed signal gate 消除二次扫描，run ledger 记录每次调度结果
**Acceptance Criteria:**
- AC-A1: TaskSpec_P1 interface 实现，含 typed signal gate
- AC-A2: subjectKey 贯穿 lease/cursor/dedupe/ledger 全链路
- AC-A3: run ledger SQLite 表结构 + 写入逻辑
- AC-A4: SummaryCompactionTask 迁移到新 TaskSpec（红→绿）
- AC-A5: CiCdCheckPoller 迁移到新 TaskSpec（红→绿）
- AC-A6: conflict-check + review-comments TaskSpec 注册可用
- AC-A7: awareness / poller 两种 profile 可用
- AC-A8: 现有 TaskRunner 行为不回归，纯 interval pollers 收敛为统一调度（GithubReviewWatcher 保留 IMAP idle + reconnect fallback，不在 interval 收敛范围）
**Architecture:** TaskSpec_P1 六维度模型（ADR-022），五步流水线（Wakeup→Lease→Gate→Execute→Outcome），TaskRunnerV2 引擎统一调度所有 poller。Gate 返回 typed signal 替代 boolean，run ledger 写入 SQLite。GithubReviewWatcher（IMAP idle）不在本 Phase 范围。
**Tech Stack:** TypeScript, better-sqlite3, node:test
**前端验证:** No — Phase 1a 纯后端

---

## Terminal Schema

### TaskSpec_P1 Interface

```typescript
// packages/api/src/infrastructure/scheduler/types.ts

/** Single work item returned by gate — one per subject */
export interface WorkItem<Signal = unknown> {
  signal: Signal;
  subjectKey: string;
  dedupeKey?: string;
}

/** Typed signal gate result — replaces boolean */
export type GateResult<Signal = unknown> =
  | { run: false; reason: string }
  | { run: true; workItems: WorkItem<Signal>[] };

/** Gate context passed to admission gate */
export interface GateCtx {
  taskId: string;
  lastRunAt: number | null;
  tickCount: number;
}

/** Task profile presets (ADR-022 KD-1) */
export type TaskProfile = 'awareness' | 'poller';

/** Run ledger outcome */
export type RunOutcome = 'SKIP_NO_SIGNAL' | 'SKIP_DISABLED' | 'SKIP_OVERLAP' | 'RUN_DELIVERED' | 'RUN_FAILED';

/** Phase 1a TaskSpec — six dimensions minus Context (Phase 2) */
export interface TaskSpec_P1<Signal = unknown> {
  /** Unique task identifier */
  id: string;
  /** Profile preset — determines default timing + tolerance */
  profile: TaskProfile;
  /** Trigger dimension */
  trigger: { type: 'interval'; ms: number };
  /** Admission dimension — typed signal gate returns workItems[] */
  admission: {
    gate: (ctx: GateCtx) => Promise<GateResult<Signal>>;
  };
  /** Run dimension — execute called once per workItem */
  run: {
    overlap: 'skip';
    timeoutMs: number;
    execute: (signal: Signal, subjectKey: string) => Promise<void>;
  };
  /** State dimension */
  state: {
    runLedger: 'sqlite';
  };
  /** Outcome dimension */
  outcome: {
    whenNoSignal: 'drop' | 'record';
  };
  /** Enabled check (feature flag / env guard) */
  enabled: () => boolean;
}

/** Run ledger row */
export interface RunLedgerRow {
  task_id: string;
  subject_key: string;
  outcome: RunOutcome;
  signal_summary: string | null;
  duration_ms: number;
  started_at: string;
}
```

### Run Ledger SQLite Table

```sql
-- Schema V5, added by F139 Phase 1a
CREATE TABLE IF NOT EXISTS task_run_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  outcome TEXT NOT NULL,
  signal_summary TEXT,
  duration_ms INTEGER NOT NULL,
  started_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_run_ledger_task ON task_run_ledger(task_id);
CREATE INDEX IF NOT EXISTS idx_run_ledger_subject ON task_run_ledger(subject_key);
```

### TaskRunnerV2 Engine

TaskRunnerV2 replaces TaskRunner. Same external API (`register`, `start`, `stop`, `triggerNow`, `getRegisteredTasks`) but internally runs the five-step pipeline:

1. **Wakeup** — setInterval fires tick
2. **Lease** — task-level overlap guard (`running` map, keyed by `task.id`); if overlap → write `SKIP_OVERLAP` to ledger
3. **Gate** — call `admission.gate(ctx)` → `GateResult` with `workItems[]`
4. **Execute** — for each `workItem`: call `run.execute(item.signal, item.subjectKey)` → per-subject ledger entry
5. **Outcome** — write `RUN_DELIVERED` / `RUN_FAILED` to run ledger per workItem, keyed by `item.subjectKey`

### Profile Defaults

| Profile | intervalMs | timeoutMs | whenNoSignal |
|---------|-----------|-----------|--------------|
| `awareness` | 30 min | 120_000 | `drop` |
| `poller` | 60_000 | 30_000 | `record` |

Profiles provide defaults; individual TaskSpec fields override them.

---

## Task 1: TaskSpec_P1 Types

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/types.ts`
- Test: `packages/api/test/memory/task-runner.test.js` (type smoke — existing tests still compile)

**Step 1: Write the new types**

Add `GateResult`, `GateCtx`, `TaskProfile`, `RunOutcome`, `TaskSpec_P1`, `RunLedgerRow` to `types.ts`. Keep the old `ScheduledTask` interface (TaskRunnerV2 will bridge it in Task 3).

```typescript
// Add after existing ScheduledTask interface:

export interface WorkItem<Signal = unknown> {
  signal: Signal;
  subjectKey: string;
  dedupeKey?: string;
}

export type GateResult<Signal = unknown> =
  | { run: false; reason: string }
  | { run: true; workItems: WorkItem<Signal>[] };

export interface GateCtx {
  taskId: string;
  lastRunAt: number | null;
  tickCount: number;
}

export type TaskProfile = 'awareness' | 'poller';

export type RunOutcome = 'SKIP_NO_SIGNAL' | 'SKIP_DISABLED' | 'SKIP_OVERLAP' | 'RUN_DELIVERED' | 'RUN_FAILED';

export interface TaskSpec_P1<Signal = unknown> {
  id: string;
  profile: TaskProfile;
  trigger: { type: 'interval'; ms: number };
  admission: {
    gate: (ctx: GateCtx) => Promise<GateResult<Signal>>;
  };
  run: {
    overlap: 'skip';
    timeoutMs: number;
    execute: (signal: Signal, subjectKey: string) => Promise<void>;
  };
  state: {
    runLedger: 'sqlite';
  };
  outcome: {
    whenNoSignal: 'drop' | 'record';
  };
  enabled: () => boolean;
}

export interface RunLedgerRow {
  task_id: string;
  subject_key: string;
  outcome: RunOutcome;
  signal_summary: string | null;
  duration_ms: number;
  started_at: string;
}
```

**Step 2: Run existing tests to verify no regression**

Run: `cd packages/api && node --test test/memory/task-runner.test.js`
Expected: All 7 tests PASS (existing ScheduledTask interface unchanged)

**Step 3: Update barrel export**

In `packages/api/src/infrastructure/scheduler/index.ts`, add:
```typescript
export type { TaskSpec_P1, WorkItem, GateResult, GateCtx, TaskProfile, RunOutcome, RunLedgerRow } from './types.js';
```

**Step 4: Type check**

Run: `pnpm --filter @cat-cafe/api exec tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```
feat(F139): add TaskSpec_P1 types — typed signal gate + six dimensions [布偶猫🐾]
```

---

## Task 2: Run Ledger Schema (SQLite V5)

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts`
- Create: `packages/api/src/infrastructure/scheduler/RunLedger.ts`
- Test: `packages/api/test/scheduler/run-ledger.test.js`

**Step 1: Write failing test for RunLedger**

```javascript
// packages/api/test/scheduler/run-ledger.test.js
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import Database from 'better-sqlite3';

describe('RunLedger', () => {
  let db;
  let ledger;

  beforeEach(async () => {
    db = new Database(':memory:');
    // Dynamic import after build
    const { applyMigrations } = await import('../../dist/domains/memory/schema.js');
    const { RunLedger } = await import('../../dist/infrastructure/scheduler/RunLedger.js');
    applyMigrations(db);
    ledger = new RunLedger(db);
  });

  it('writes and reads a RUN_DELIVERED entry', () => {
    ledger.record({
      task_id: 'summary-compact',
      subject_key: 'thread-abc',
      outcome: 'RUN_DELIVERED',
      signal_summary: '20 pending messages',
      duration_ms: 1234,
      started_at: new Date().toISOString(),
    });
    const rows = ledger.query('summary-compact', 10);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, 'RUN_DELIVERED');
    assert.equal(rows[0].subject_key, 'thread-abc');
  });

  it('writes SKIP_NO_SIGNAL with null signal_summary', () => {
    ledger.record({
      task_id: 'cicd-check',
      subject_key: 'cicd-check',
      outcome: 'SKIP_NO_SIGNAL',
      signal_summary: null,
      duration_ms: 5,
      started_at: new Date().toISOString(),
    });
    const rows = ledger.query('cicd-check', 10);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].signal_summary, null);
  });

  it('query returns newest first, respects limit', () => {
    for (let i = 0; i < 5; i++) {
      ledger.record({
        task_id: 't1',
        subject_key: `key-${i}`,
        outcome: 'RUN_DELIVERED',
        signal_summary: null,
        duration_ms: i,
        started_at: new Date(Date.now() + i * 1000).toISOString(),
      });
    }
    const rows = ledger.query('t1', 3);
    assert.equal(rows.length, 3);
    // newest first
    assert.equal(rows[0].duration_ms, 4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/scheduler/run-ledger.test.js`
Expected: FAIL — module not found

**Step 3: Add Schema V5 migration**

In `packages/api/src/domains/memory/schema.ts`:

```typescript
export const CURRENT_SCHEMA_VERSION = 5;

export const SCHEMA_V5 = `
CREATE TABLE IF NOT EXISTS task_run_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  outcome TEXT NOT NULL,
  signal_summary TEXT,
  duration_ms INTEGER NOT NULL,
  started_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_run_ledger_task ON task_run_ledger(task_id);
CREATE INDEX IF NOT EXISTS idx_run_ledger_subject ON task_run_ledger(subject_key);
`;
```

Add migration block in `applyMigrations`:
```typescript
if (currentVersion < 5) {
  db.exec(SCHEMA_V5);
  db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(5, new Date().toISOString());
}
```

**Step 4: Implement RunLedger class**

```typescript
// packages/api/src/infrastructure/scheduler/RunLedger.ts
import type Database from 'better-sqlite3';
import type { RunLedgerRow } from './types.js';

export class RunLedger {
  private insertStmt: ReturnType<Database.Database['prepare']>;
  private queryStmt: ReturnType<Database.Database['prepare']>;

  constructor(db: Database.Database) {
    this.insertStmt = db.prepare(
      `INSERT INTO task_run_ledger (task_id, subject_key, outcome, signal_summary, duration_ms, started_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    this.queryStmt = db.prepare(
      `SELECT task_id, subject_key, outcome, signal_summary, duration_ms, started_at
       FROM task_run_ledger WHERE task_id = ? ORDER BY id DESC LIMIT ?`
    );
  }

  record(row: RunLedgerRow): void {
    this.insertStmt.run(row.task_id, row.subject_key, row.outcome, row.signal_summary, row.duration_ms, row.started_at);
  }

  query(taskId: string, limit: number): RunLedgerRow[] {
    return this.queryStmt.all(taskId, limit) as RunLedgerRow[];
  }
}
```

**Step 5: Update barrel export**

In `packages/api/src/infrastructure/scheduler/index.ts`:
```typescript
export { RunLedger } from './RunLedger.js';
```

**Step 6: Build and run tests**

Run: `pnpm --filter @cat-cafe/api build && cd packages/api && node --test test/scheduler/run-ledger.test.js`
Expected: 3 tests PASS

**Step 7: Commit**

```
feat(F139): add run ledger — SQLite V5 migration + RunLedger class [布偶猫🐾]
```

---

## Task 3: TaskRunnerV2 Engine

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/TaskRunnerV2.ts`
- Modify: `packages/api/src/infrastructure/scheduler/index.ts`
- Test: `packages/api/test/scheduler/task-runner-v2.test.js`

**Step 1: Write failing tests for TaskRunnerV2**

```javascript
// packages/api/test/scheduler/task-runner-v2.test.js
import assert from 'node:assert/strict';
import { afterEach, describe, it, beforeEach } from 'node:test';
import Database from 'better-sqlite3';

describe('TaskRunnerV2', () => {
  let db, runner, ledger;
  const noop = () => {};
  const silentLogger = { info: noop, error: noop };

  beforeEach(async () => {
    db = new Database(':memory:');
    const { applyMigrations } = await import('../../dist/domains/memory/schema.js');
    const { RunLedger } = await import('../../dist/infrastructure/scheduler/RunLedger.js');
    const { TaskRunnerV2 } = await import('../../dist/infrastructure/scheduler/TaskRunnerV2.js');
    applyMigrations(db);
    ledger = new RunLedger(db);
    runner = new TaskRunnerV2({ logger: silentLogger, ledger });
  });

  afterEach(() => { if (runner) runner.stop(); });

  it('registers and lists tasks', () => {
    runner.register({
      id: 'test-task',
      profile: 'awareness',
      trigger: { type: 'interval', ms: 60000 },
      admission: { gate: async () => ({ run: false, reason: 'test' }) },
      run: { overlap: 'skip', timeoutMs: 5000, execute: async () => {} },
      state: { runLedger: 'sqlite' },
      outcome: { whenNoSignal: 'drop' },
      enabled: () => true,
    });
    assert.deepEqual(runner.getRegisteredTasks(), ['test-task']);
  });

  it('rejects duplicate task ids', () => {
    const task = {
      id: 'dup', profile: 'poller',
      trigger: { type: 'interval', ms: 1000 },
      admission: { gate: async () => ({ run: false, reason: 'no' }) },
      run: { overlap: 'skip', timeoutMs: 5000, execute: async () => {} },
      state: { runLedger: 'sqlite' },
      outcome: { whenNoSignal: 'drop' },
      enabled: () => true,
    };
    runner.register(task);
    assert.throws(() => runner.register(task), /duplicate/i);
  });

  it('gate run:false → SKIP_NO_SIGNAL in ledger (when outcome.whenNoSignal = record)', async () => {
    runner.register({
      id: 'skip-test', profile: 'poller',
      trigger: { type: 'interval', ms: 999999 },
      admission: { gate: async () => ({ run: false, reason: 'nothing new' }) },
      run: { overlap: 'skip', timeoutMs: 5000, execute: async () => {} },
      state: { runLedger: 'sqlite' },
      outcome: { whenNoSignal: 'record' },
      enabled: () => true,
    });
    await runner.triggerNow('skip-test');
    const rows = ledger.query('skip-test', 10);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, 'SKIP_NO_SIGNAL');
  });

  it('gate run:false + whenNoSignal=drop → no ledger entry', async () => {
    runner.register({
      id: 'drop-test', profile: 'awareness',
      trigger: { type: 'interval', ms: 999999 },
      admission: { gate: async () => ({ run: false, reason: 'quiet' }) },
      run: { overlap: 'skip', timeoutMs: 5000, execute: async () => {} },
      state: { runLedger: 'sqlite' },
      outcome: { whenNoSignal: 'drop' },
      enabled: () => true,
    });
    await runner.triggerNow('drop-test');
    const rows = ledger.query('drop-test', 10);
    assert.equal(rows.length, 0);
  });

  it('gate run:true with workItems → execute called per item → RUN_DELIVERED per subject', async () => {
    const calls = [];
    runner.register({
      id: 'run-test', profile: 'poller',
      trigger: { type: 'interval', ms: 999999 },
      admission: {
        gate: async () => ({
          run: true,
          workItems: [
            { signal: { count: 3 }, subjectKey: 'pr-42' },
            { signal: { count: 1 }, subjectKey: 'pr-99' },
          ],
        }),
      },
      run: {
        overlap: 'skip', timeoutMs: 5000,
        execute: async (signal, key) => { calls.push({ signal, key }); },
      },
      state: { runLedger: 'sqlite' },
      outcome: { whenNoSignal: 'drop' },
      enabled: () => true,
    });
    await runner.triggerNow('run-test');
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].signal, { count: 3 });
    assert.equal(calls[0].key, 'pr-42');
    assert.equal(calls[1].key, 'pr-99');
    const rows = ledger.query('run-test', 10);
    assert.equal(rows.length, 2);
    // Both subjects have independent ledger entries
    const subjects = rows.map(r => r.subject_key).sort();
    assert.deepEqual(subjects, ['pr-42', 'pr-99']);
    assert.ok(rows.every(r => r.outcome === 'RUN_DELIVERED'));
  });

  it('execute throws for one workItem → RUN_FAILED for that subject, others still RUN_DELIVERED', async () => {
    runner.register({
      id: 'partial-fail', profile: 'poller',
      trigger: { type: 'interval', ms: 999999 },
      admission: {
        gate: async () => ({
          run: true,
          workItems: [
            { signal: 'ok', subjectKey: 'a' },
            { signal: 'boom', subjectKey: 'b' },
          ],
        }),
      },
      run: {
        overlap: 'skip', timeoutMs: 5000,
        execute: async (signal) => { if (signal === 'boom') throw new Error('boom'); },
      },
      state: { runLedger: 'sqlite' },
      outcome: { whenNoSignal: 'drop' },
      enabled: () => true,
    });
    await runner.triggerNow('partial-fail');
    const rows = ledger.query('partial-fail', 10);
    assert.equal(rows.length, 2);
    const bySubject = Object.fromEntries(rows.map(r => [r.subject_key, r.outcome]));
    assert.equal(bySubject['a'], 'RUN_DELIVERED');
    assert.equal(bySubject['b'], 'RUN_FAILED');
  });

  it('disabled task → SKIP_DISABLED, no execute', async () => {
    let ran = false;
    runner.register({
      id: 'disabled-test', profile: 'awareness',
      trigger: { type: 'interval', ms: 999999 },
      admission: { gate: async () => ({ run: true, workItems: [{ signal: 'x', subjectKey: 'y' }] }) },
      run: { overlap: 'skip', timeoutMs: 5000, execute: async () => { ran = true; } },
      state: { runLedger: 'sqlite' },
      outcome: { whenNoSignal: 'record' },
      enabled: () => false,
    });
    await runner.triggerNow('disabled-test');
    assert.ok(!ran);
    // SKIP_DISABLED not recorded (high-frequency tick would spam ledger)
  });

  it('overlap guard — concurrent tick skipped + SKIP_OVERLAP in ledger', async () => {
    let callCount = 0;
    runner.register({
      id: 'overlap-test', profile: 'poller',
      trigger: { type: 'interval', ms: 999999 },
      admission: {
        gate: async () => ({ run: true, workItems: [{ signal: 'go', subjectKey: 'k' }] }),
      },
      run: {
        overlap: 'skip', timeoutMs: 5000,
        execute: async () => {
          callCount++;
          await new Promise(r => setTimeout(r, 100));
        },
      },
      state: { runLedger: 'sqlite' },
      outcome: { whenNoSignal: 'drop' },
      enabled: () => true,
    });
    // Fire two concurrent triggers
    const p1 = runner.triggerNow('overlap-test');
    const p2 = runner.triggerNow('overlap-test');
    await Promise.all([p1, p2]);
    assert.equal(callCount, 1, 'second trigger should be skipped');
    // SKIP_OVERLAP should be recorded in ledger for diagnostics
    const rows = ledger.query('overlap-test', 10);
    const skipRows = rows.filter(r => r.outcome === 'SKIP_OVERLAP');
    assert.equal(skipRows.length, 1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/scheduler/task-runner-v2.test.js`
Expected: FAIL — module not found

**Step 3: Implement TaskRunnerV2**

```typescript
// packages/api/src/infrastructure/scheduler/TaskRunnerV2.ts
import type { TaskSpec_P1, GateCtx, RunOutcome } from './types.js';
import type { RunLedger } from './RunLedger.js';

export interface TaskRunnerV2Options {
  logger: { info: (msg: string) => void; error: (msg: string, err?: unknown) => void };
  ledger: RunLedger;
}

export class TaskRunnerV2 {
  private tasks: TaskSpec_P1[] = [];
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private running = new Map<string, boolean>();
  private tickCounts = new Map<string, number>();
  private lastRunAt = new Map<string, number | null>();
  private logger: TaskRunnerV2Options['logger'];
  private ledger: RunLedger;

  constructor(opts: TaskRunnerV2Options) {
    this.logger = opts.logger;
    this.ledger = opts.ledger;
  }

  register(task: TaskSpec_P1): void {
    if (this.tasks.some(t => t.id === task.id)) {
      throw new Error(`TaskRunnerV2: duplicate task id "${task.id}"`);
    }
    this.tasks.push(task);
  }

  start(): void {
    for (const task of this.tasks) {
      if (this.timers.has(task.id)) continue;
      this.running.set(task.id, false);
      this.tickCounts.set(task.id, 0);
      this.lastRunAt.set(task.id, null);

      const runTick = () => { this.executePipeline(task); };

      setTimeout(runTick, 0);
      const timer = setInterval(runTick, task.trigger.ms);
      if (typeof timer === 'object' && 'unref' in timer) timer.unref();

      this.timers.set(task.id, timer);
      this.logger.info(
        `[scheduler] ${task.id}: registered (profile=${task.profile}, interval=${task.trigger.ms}ms)`
      );
    }
  }

  stop(): void {
    for (const [id, timer] of this.timers) {
      clearInterval(timer);
      this.logger.info(`[scheduler] ${id}: stopped`);
    }
    this.timers.clear();
  }

  async triggerNow(taskId: string): Promise<void> {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) throw new Error(`TaskRunnerV2: unknown task "${taskId}"`);
    await this.executePipeline(task);
  }

  getRegisteredTasks(): string[] {
    return this.tasks.map(t => t.id);
  }

  private async executePipeline(task: TaskSpec_P1): Promise<void> {
    const startMs = Date.now();
    const tickCount = (this.tickCounts.get(task.id) ?? 0) + 1;
    this.tickCounts.set(task.id, tickCount);

    // Step 1: Enabled check
    if (!task.enabled()) return;

    // Step 2: Overlap guard (task-level — prevents gate re-entry)
    if (this.running.get(task.id)) {
      this.logger.info(`[scheduler] ${task.id}: still running, skipping tick`);
      // P2 fix: record SKIP_OVERLAP for diagnostics visibility
      this.ledger.record({
        task_id: task.id,
        subject_key: task.id,
        outcome: 'SKIP_OVERLAP',
        signal_summary: null,
        duration_ms: Date.now() - startMs,
        started_at: new Date(startMs).toISOString(),
      });
      return;
    }
    this.running.set(task.id, true);

    try {
      // Step 3: Gate — returns workItems[]
      const ctx: GateCtx = {
        taskId: task.id,
        lastRunAt: this.lastRunAt.get(task.id) ?? null,
        tickCount,
      };

      const gateResult = await task.admission.gate(ctx);

      if (!gateResult.run) {
        if (task.outcome.whenNoSignal === 'record') {
          this.ledger.record({
            task_id: task.id,
            subject_key: task.id,
            outcome: 'SKIP_NO_SIGNAL',
            signal_summary: null,
            duration_ms: Date.now() - startMs,
            started_at: new Date(startMs).toISOString(),
          });
        }
        return;
      }

      // Step 4 + 5: Execute per workItem → ledger per subject
      for (const item of gateResult.workItems) {
        const itemStartMs = Date.now();
        let outcome: RunOutcome = 'RUN_DELIVERED';
        try {
          await task.run.execute(item.signal, item.subjectKey);
        } catch (err) {
          outcome = 'RUN_FAILED';
          this.logger.error(`[scheduler] ${task.id}/${item.subjectKey}: failed`, err);
        }

        this.ledger.record({
          task_id: task.id,
          subject_key: item.subjectKey,
          outcome,
          signal_summary: typeof item.signal === 'string'
            ? item.signal
            : JSON.stringify(item.signal).slice(0, 200),
          duration_ms: Date.now() - itemStartMs,
          started_at: new Date(itemStartMs).toISOString(),
        });
      }

      this.lastRunAt.set(task.id, Date.now());
      this.logger.info(
        `[scheduler] ${task.id}: tick completed, ${gateResult.workItems.length} items (${Date.now() - startMs}ms)`
      );
    } finally {
      this.running.set(task.id, false);
    }
  }
}
```

**Step 4: Update barrel export**

```typescript
// packages/api/src/infrastructure/scheduler/index.ts
export { TaskRunner } from './TaskRunner.js';
export { TaskRunnerV2 } from './TaskRunnerV2.js';
export { RunLedger } from './RunLedger.js';
export type { ScheduledTask, TaskSpec_P1, GateResult, GateCtx, TaskProfile, RunOutcome, RunLedgerRow } from './types.js';
```

**Step 5: Build and run tests**

Run: `pnpm --filter @cat-cafe/api build && cd packages/api && node --test test/scheduler/task-runner-v2.test.js`
Expected: 8 tests PASS

**Step 6: Run old TaskRunner tests to verify no regression**

Run: `cd packages/api && node --test test/memory/task-runner.test.js`
Expected: 7 tests PASS

**Step 7: Commit**

```
feat(F139): add TaskRunnerV2 engine — five-step pipeline + ledger integration [布偶猫🐾]
```

---

## Task 4: Profile Defaults Helper

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/profiles.ts`
- Test: `packages/api/test/scheduler/profiles.test.js`

**Step 1: Write failing test**

```javascript
// packages/api/test/scheduler/profiles.test.js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('Task Profiles', () => {
  it('awareness profile has 30-min interval and drop whenNoSignal', async () => {
    const { PROFILE_DEFAULTS } = await import('../../dist/infrastructure/scheduler/profiles.js');
    const p = PROFILE_DEFAULTS.awareness;
    assert.equal(p.trigger.ms, 30 * 60 * 1000);
    assert.equal(p.run.timeoutMs, 120_000);
    assert.equal(p.outcome.whenNoSignal, 'drop');
  });

  it('poller profile has 60s interval and record whenNoSignal', async () => {
    const { PROFILE_DEFAULTS } = await import('../../dist/infrastructure/scheduler/profiles.js');
    const p = PROFILE_DEFAULTS.poller;
    assert.equal(p.trigger.ms, 60_000);
    assert.equal(p.run.timeoutMs, 30_000);
    assert.equal(p.outcome.whenNoSignal, 'record');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/scheduler/profiles.test.js`
Expected: FAIL

**Step 3: Implement profiles**

```typescript
// packages/api/src/infrastructure/scheduler/profiles.ts
import type { TaskProfile } from './types.js';

interface ProfileDefaults {
  trigger: { ms: number };
  run: { timeoutMs: number };
  outcome: { whenNoSignal: 'drop' | 'record' };
}

export const PROFILE_DEFAULTS: Record<TaskProfile, ProfileDefaults> = {
  awareness: {
    trigger: { ms: 30 * 60 * 1000 },
    run: { timeoutMs: 120_000 },
    outcome: { whenNoSignal: 'drop' },
  },
  poller: {
    trigger: { ms: 60_000 },
    run: { timeoutMs: 30_000 },
    outcome: { whenNoSignal: 'record' },
  },
};
```

**Step 4: Update barrel, build, run tests**

Run: `pnpm --filter @cat-cafe/api build && cd packages/api && node --test test/scheduler/profiles.test.js`
Expected: 2 tests PASS

**Step 5: Commit**

```
feat(F139): add awareness/poller profile defaults [布偶猫🐾]
```

---

## Task 5: Migrate SummaryCompactionTask (boolean → typed signal)

**Files:**
- Modify: `packages/api/src/domains/memory/SummaryCompactionTask.ts`
- Create: `packages/api/src/domains/memory/SummaryCompactionTaskSpec.ts`
- Test: `packages/api/test/scheduler/summary-compact-spec.test.js`

This is the key migration. The existing `SummaryCompactionTask` returns `ScheduledTask` with a boolean `isEligible()`. We create a new `SummaryCompactionTaskSpec` factory that returns `TaskSpec_P1` with a typed signal gate. The gate returns the list of eligible threads as the signal.

**Step 1: Write failing test for the new TaskSpec gate**

```javascript
// packages/api/test/scheduler/summary-compact-spec.test.js
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import Database from 'better-sqlite3';

describe('SummaryCompactionTaskSpec', () => {
  let db;

  beforeEach(async () => {
    db = new Database(':memory:');
    const { applyMigrations } = await import('../../dist/domains/memory/schema.js');
    applyMigrations(db);
  });

  it('gate returns run:false when no eligible threads', async () => {
    const { createSummaryCompactionTaskSpec } = await import(
      '../../dist/domains/memory/SummaryCompactionTaskSpec.js'
    );
    const spec = createSummaryCompactionTaskSpec({
      db,
      enabled: () => true,
      getThreadLastActivity: async () => null,
      getMessagesAfterWatermark: async () => [],
      generateAbstractive: async () => null,
      logger: { info: () => {}, error: () => {} },
    });

    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, false);
  });

  it('gate returns run:true with thread list as signal when eligible threads exist', async () => {
    const { createSummaryCompactionTaskSpec } = await import(
      '../../dist/domains/memory/SummaryCompactionTaskSpec.js'
    );

    // Seed a thread with enough pending work
    db.prepare(
      `INSERT INTO summary_state (thread_id, pending_message_count, pending_token_count, pending_signal_flags, summary_type)
       VALUES (?, ?, ?, ?, ?)`
    ).run('test-thread', 25, 2000, 0, 'concat');

    const spec = createSummaryCompactionTaskSpec({
      db,
      enabled: () => true,
      // Thread has been quiet for > 10 minutes
      getThreadLastActivity: async () => ({ threadId: 'test-thread', lastMessageAt: Date.now() - 20 * 60 * 1000 }),
      getMessagesAfterWatermark: async () => [{ id: 'm1', content: 'hello', timestamp: Date.now() }],
      generateAbstractive: async () => ({
        segments: [{
          summary: 'test summary',
          topicKey: 'general', topicLabel: 'General',
          boundaryReason: 'test', boundaryConfidence: 'high',
          fromMessageId: 'm1', toMessageId: 'm1', messageCount: 1,
        }],
      }),
      logger: { info: () => {}, error: () => {} },
    });

    const result = await spec.admission.gate({ taskId: spec.id, lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, true);
    assert.ok(result.workItems.length > 0);
    // Each workItem is a single thread with per-thread subjectKey
    assert.match(result.workItems[0].subjectKey, /^thread-/);
  });

  it('has correct id and profile', async () => {
    const { createSummaryCompactionTaskSpec } = await import(
      '../../dist/domains/memory/SummaryCompactionTaskSpec.js'
    );
    const spec = createSummaryCompactionTaskSpec({
      db: new Database(':memory:'),
      enabled: () => true,
      getThreadLastActivity: async () => null,
      getMessagesAfterWatermark: async () => [],
      generateAbstractive: async () => null,
      logger: { info: () => {}, error: () => {} },
    });

    assert.equal(spec.id, 'summary-compact');
    assert.equal(spec.profile, 'awareness');
    assert.equal(spec.trigger.ms, 30 * 60 * 1000);
  });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL — module not found

**Step 3: Implement SummaryCompactionTaskSpec**

Create `packages/api/src/domains/memory/SummaryCompactionTaskSpec.ts`. This wraps the existing compaction logic but with a typed signal gate. The gate scans eligible threads and returns them as the signal. The execute function runs the existing processing logic.

Key changes from old `SummaryCompactionTask`:
- `isEligible()` boolean → gate returns `{ run: true, workItems: [{ signal: threadState, subjectKey: 'thread-{id}' }, ...] }` — one workItem per eligible thread
- `execute(signal, subjectKey)` processes a single thread (not batch) — budget logic moves to gate (gate only returns `budget` number of workItems)
- subjectKey is per-thread (`thread-abc`), not task-global — ledger tracks each thread independently
- Same internal logic (backfill, cold-start, processThread) — just wired per-thread via workItems

**Step 4: Build and run tests**

Run: `pnpm --filter @cat-cafe/api build && cd packages/api && node --test test/scheduler/summary-compact-spec.test.js`
Expected: 3 tests PASS

**Step 5: Commit**

```
feat(F139): add SummaryCompactionTaskSpec — boolean gate → typed signal [布偶猫🐾]
```

---

## Task 6: Migrate CiCdCheckPoller (self-managed → TaskSpec)

**Files:**
- Create: `packages/api/src/infrastructure/email/CiCdCheckTaskSpec.ts`
- Test: `packages/api/test/scheduler/cicd-check-spec.test.js`

The existing `CiCdCheckPoller` manages its own `setInterval`. We create a `CiCdCheckTaskSpec` that wraps the polling logic as a `TaskSpec_P1`. The gate checks if there are tracked PRs, the execute runs `pollAll`.

**Step 1: Write failing test**

```javascript
// packages/api/test/scheduler/cicd-check-spec.test.js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('CiCdCheckTaskSpec', () => {
  it('has correct id and profile', async () => {
    const { createCiCdCheckTaskSpec } = await import(
      '../../dist/infrastructure/email/CiCdCheckTaskSpec.js'
    );
    const spec = createCiCdCheckTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      cicdRouter: { route: async () => ({ kind: 'noop' }) },
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    assert.equal(spec.id, 'cicd-check');
    assert.equal(spec.profile, 'poller');
    assert.equal(spec.trigger.ms, 60_000);
  });

  it('gate returns run:false when no tracked PRs', async () => {
    const { createCiCdCheckTaskSpec } = await import(
      '../../dist/infrastructure/email/CiCdCheckTaskSpec.js'
    );
    const spec = createCiCdCheckTaskSpec({
      prTrackingStore: { listAll: async () => [] },
      cicdRouter: { route: async () => ({ kind: 'noop' }) },
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    const result = await spec.admission.gate({ taskId: 'cicd-check', lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, false);
  });

  it('gate returns run:true with PR count when PRs are tracked', async () => {
    const { createCiCdCheckTaskSpec } = await import(
      '../../dist/infrastructure/email/CiCdCheckTaskSpec.js'
    );
    const mockPrs = [{ repoFullName: 'a/b', prNumber: 1, ciTrackingEnabled: true }];
    const spec = createCiCdCheckTaskSpec({
      prTrackingStore: { listAll: async () => mockPrs },
      cicdRouter: { route: async () => ({ kind: 'noop' }) },
      log: { info: () => {}, error: () => {}, warn: () => {} },
    });
    const result = await spec.admission.gate({ taskId: 'cicd-check', lastRunAt: null, tickCount: 1 });
    assert.equal(result.run, true);
    assert.equal(result.workItems.length, 1);
    assert.equal(result.workItems[0].subjectKey, 'pr-a/b#1');
    assert.ok(result.workItems[0].signal);
  });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL

**Step 3: Implement CiCdCheckTaskSpec**

Gate checks `prTrackingStore.listAll()` → filter active → if empty, `run: false`. If non-empty, `run: true` with one `workItem` per PR (`subjectKey: 'pr-{repo}#{number}'`). Execute calls the existing `pollOne` logic (extracted from CiCdCheckPoller) for a single PR.

**Step 4: Build and run tests**

Expected: 3 tests PASS

**Step 5: Commit**

```
feat(F139): add CiCdCheckTaskSpec — self-managed setInterval → unified TaskSpec [布偶猫🐾]
```

---

## Task 7: New conflict-check TaskSpec

**Files:**
- Create: `packages/api/src/infrastructure/email/ConflictCheckTaskSpec.ts`
- Test: `packages/api/test/scheduler/conflict-check-spec.test.js`

Gate: check tracked PRs → `gh pr view --json mergeable` → if any have `CONFLICTING`, signal = list of conflicting PRs. Execute: post notification to thread.

**Step 1: Write failing test**

Test that gate returns `run:false` when no PRs are conflicting, `run:true` when conflicts detected.

**Step 2: Run test — FAIL**

**Step 3: Implement ConflictCheckTaskSpec**

Profile: `poller` (60s default, but we'll set 5 min since conflict state changes less frequently).

**Step 4: Build and run tests — PASS**

**Step 5: Commit**

```
feat(F139): add conflict-check TaskSpec — PR mergeable state detection [布偶猫🐾]
```

---

## Task 8: New review-comments TaskSpec

**Files:**
- Create: `packages/api/src/infrastructure/email/ReviewCommentsTaskSpec.ts`
- Test: `packages/api/test/scheduler/review-comments-spec.test.js`

Gate: check tracked PRs → `gh api /repos/{owner}/{repo}/pulls/{number}/comments` → if new comments since last cursor, one `workItem` per PR with new comments (`subjectKey: 'pr-{repo}#{number}'`). Per-PR cursor tracking via in-memory Map.

**Step 1: Write failing test**

Test that gate returns `run:false` when no new comments, `run:true` with comment count when new comments exist.

**Step 2: Run test — FAIL**

**Step 3: Implement ReviewCommentsTaskSpec**

Profile: `poller` (60s). Cursor stored in memory (Phase 1a — sqlite cursor is Phase 2).

**Step 4: Build and run tests — PASS**

**Step 5: Commit**

```
feat(F139): add review-comments TaskSpec — PR comment detection [布偶猫🐾]
```

---

## Task 9: Bootstrap Wiring + Old Poller Cleanup

**Files:**
- Modify: `packages/api/src/index.ts` (~lines 447-545, ~1269-1286)
- Modify: `packages/api/src/infrastructure/scheduler/index.ts`

This is the convergence step. Replace the three independent scheduling systems with a single `TaskRunnerV2` instance.

**Step 1: Write integration smoke test**

Test that `TaskRunnerV2` can register all four specs and `getRegisteredTasks()` returns all four IDs.

**Step 2: Run test — FAIL**

**Step 3: Wire TaskRunnerV2 in index.ts**

In the existing TaskRunner creation block (~line 450):
1. Create `RunLedger` with the evidence DB
2. Create `TaskRunnerV2` instead of `TaskRunner`
3. Register `SummaryCompactionTaskSpec` (replaces old `summaryTask` registration)
4. Register `CiCdCheckTaskSpec` (replaces `startGithubCiPoller()` call at ~line 1281)
5. Register `ConflictCheckTaskSpec`
6. Register `ReviewCommentsTaskSpec`
7. Call `taskRunnerV2.start()`
8. Remove the `startGithubCiPoller()` call at line 1281-1286

Keep `GithubReviewWatcher` as-is (IMAP idle, not in Phase 1a scope).
Keep old `TaskRunner` class in codebase (other code may import it); just stop using it in bootstrap.

**Step 4: Build and run all scheduler tests**

Run: `pnpm --filter @cat-cafe/api build && cd packages/api && node --test test/scheduler/ test/memory/task-runner.test.js`
Expected: All tests PASS

**Step 5: Type check whole project**

Run: `pnpm lint`
Expected: PASS

**Step 6: Commit**

```
feat(F139): wire TaskRunnerV2 bootstrap — converge pure-interval pollers into unified scheduler [布偶猫🐾]
```

---

## Out of Scope (Explicit)

- **GithubReviewWatcher** — IMAP idle + setInterval fallback, different pattern (event-driven primary), stays as-is
- **Phase 1b** — Actor + Cat Wake, MCP dispatch
- **Phase 2** — Cron triggers, UI, Context dimension, natural language config
- **activeHours admission** — mentioned in ADR-022, deferred to Phase 2
- **Cursor persistence in SQLite** — Phase 1a uses in-memory cursors, SQLite cursors are Phase 2

## AC Coverage Map

| AC | Covered by Task |
|----|----------------|
| AC-A1: TaskSpec_P1 + typed signal gate | Task 1 |
| AC-A2: subjectKey 全链路 | Task 1 (types) + Task 3 (engine uses subjectKey in ledger) |
| AC-A3: run ledger SQLite | Task 2 |
| AC-A4: SummaryCompaction 迁移 | Task 5 |
| AC-A5: CiCdCheckPoller 迁移 | Task 6 |
| AC-A6: conflict-check + review-comments | Task 7 + Task 8 |
| AC-A7: awareness / poller profiles | Task 4 |
| AC-A8: 纯 interval pollers 收敛为统一调度 | Task 9 |

---

## Revision Log

**rev-2 (2026-03-25)** — 砚砚 plan review 修正 2P1 + 1P2：

1. **P1: GateResult 升级为 `workItems[]`** — 原设计单 `subjectKey` 打穿 ADR-022 统一锚点规则。修正：gate 返回 `WorkItem[]`，runner 对每个 item 独立 execute → ledger，subjectKey 真贯穿。summary-compact 按 per-thread、cicd-check 按 per-PR 出 workItems。
2. **P1: AC-A8 口径对齐** — 原写"三套 setInterval 收敛"但 GithubReviewWatcher 保留在 scope 外。修正：AC-A8 改为"纯 interval pollers 收敛"，明确 IMAP idle + reconnect fallback 不在收敛范围。
3. **P2: SKIP_OVERLAP 写 ledger** — 原设计 overlap 静默 return，Phase 2 UI 会看到盲区。修正：overlap guard 写 `SKIP_OVERLAP` 到 ledger（SKIP_DISABLED 保持 drop，避免高频刷爆）。
