/**
 * Minimal scheduled task interface (legacy — used by TaskRunner V1).
 *
 * MVP: tasks are run by a simple setInterval-based TaskRunner.
 * For new tasks, use TaskSpec_P1 + TaskRunnerV2 (F139).
 */
export interface ScheduledTask {
  /** Unique task name for logging and dedup */
  name: string;
  /** Interval in milliseconds between ticks */
  intervalMs: number;
  /** Check if this task is enabled (e.g. feature flag) */
  enabled: () => boolean;
  /** Execute one tick. Errors are caught by TaskRunner, never crash the process. */
  execute: () => Promise<void>;
}

// ─── F139: Unified Schedule Abstraction (Phase 1a) ────────────────────

/** Single work item returned by gate — one per subject */
export interface WorkItem<Signal = unknown> {
  signal: Signal;
  subjectKey: string;
  dedupeKey?: string;
}

/** Typed signal gate result — replaces boolean eligibility checks */
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

/**
 * Phase 1a TaskSpec — six dimensions minus Context (Phase 2).
 * Gate returns workItems[] for per-subject execute + ledger.
 * Lease is task-level in Phase 1a; subject-level lease deferred to Phase 1b.
 */
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

/** Run ledger row */
export interface RunLedgerRow {
  task_id: string;
  subject_key: string;
  outcome: RunOutcome;
  signal_summary: string | null;
  duration_ms: number;
  started_at: string;
}
