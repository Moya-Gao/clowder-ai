// ─── F139: Unified Schedule Abstraction ────────────────────

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

/** Actor capability namespace (Phase 1b) — NOT roster identity roles */
export type ActorRole = 'memory-curator' | 'repo-watcher' | 'health-monitor';

/** Cost tier hint for actor resolution */
export type CostTier = 'cheap' | 'deep';

/** Actor dimension (Phase 1b) — declares what kind of cat a task needs */
export interface ActorSpec {
  role: ActorRole;
  costTier: CostTier;
}

/** Phase 1b: context passed to execute — carries actor resolution result */
export interface ExecuteContext {
  /** Cat resolved by ActorResolver, or null if no actor spec / no match */
  assignedCatId: string | null;
}

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
    execute: (signal: Signal, subjectKey: string, ctx: ExecuteContext) => Promise<void>;
  };
  state: {
    runLedger: 'sqlite';
  };
  outcome: {
    whenNoSignal: 'drop' | 'record';
  };
  enabled: () => boolean;
  /** Phase 1b: actor resolution — which cat capability this task needs */
  actor?: ActorSpec;
}

/** Run ledger row */
export interface RunLedgerRow {
  task_id: string;
  subject_key: string;
  outcome: RunOutcome;
  signal_summary: string | null;
  duration_ms: number;
  started_at: string;
  /** Phase 1b: which cat was assigned to handle this run */
  assigned_cat_id: string | null;
}
