# F200 Phase D: Full Trajectory Records — Implementation Plan

**Feature:** F200 — `docs/features/F200-memory-recall-eval.md`
**Goal:** Extend single-search telemetry (Phase A-C) to task-level trajectory tracking with outcome verification, enabling success/failure analysis and cross-cat diagnostics.
**Acceptance Criteria:**
- AC-D1: TaskTrajectory 按 invocation/thread 粒度聚合
- AC-D2: outputVerified 从候选信号源（PR merge / CI check / CVO accept / reviewer approval）自动推断
- AC-D3: 成功轨迹可被 list_recent 或 search_evidence 召回（scope="trajectories"）
- AC-D4: Cross-Cat Effort Variance 和 ConsumedButNotUsedRate 指标上线
**Architecture cell:** memory-recall
**Map delta:** none
**Map delta why:** extends existing recall domain with trajectory aggregation view over RecallEvents — no new architectural boundaries
**Tech Stack:** SQLite (evidence.sqlite V22), better-sqlite3, existing RecallEvent infrastructure
**前端验证:** No — pure backend/API

---

## Design Decisions (finalized at Design Gate)

### outputVerified Signal Sources (spec OQ-5, finalized here)

```
outputVerified = signal_or(
    invocation_succeeded,                   // InvocationRecord.status === 'succeeded'
    PR_merged_for_thread,                   // PrTrackingEntry with merged mergeState
    CVO_accept_keyword_in_thread,           // thread messages: "好"/"通过"/"merge"/"可以"
    reviewer_approval_no_followup,          // review feedback APPROVED + no subsequent code push
)
```

**Architecture**: Two-phase approach:
1. **Sync** (at invocation completion): create trajectory with `outputVerified=false`, aggregate searchChain/filesRead/filesModified/tokenCost/duration
2. **Async** (on-demand via API or periodic): scan unverified trajectories, check outcome signals via Redis stores, update

This avoids coupling the sqlite-only correlation hook to Redis stores.

### taskContext Inference

`taskContext` = deduplicated queries from the trajectory's search chain, joined by " → ". Gives a readable trace of what the cat was searching for. Null if no search events.

### ConsumedButNotUsedRate Definition

`ConsumedButNotUsedRate` = P(trajectory has consumed anchors BUT outputVerified=false AND trajectory abandoned or failed). This approximates "read stuff but it didn't help" without requiring commit-level reference tracking.

---

## Tasks

### Task 1: Types + Schema V22

**Files:**
- Modify: `packages/api/src/domains/memory/f200-types.ts`
- Modify: `packages/api/src/domains/memory/schema.ts`

**Step 1: Write failing test for V22 migration**

```typescript
// test: schema migration creates task_trajectories table
```

Test file: `packages/api/test/memory/f200-trajectory-schema.test.js`

**Step 2: Add TaskTrajectory type to f200-types.ts**

```typescript
export interface TaskTrajectory {
  trajectoryId: string;
  invocationId: string;
  threadId: string;
  catId: string;
  taskContext: string | null;
  searchChain: RecallEvent[];
  filesRead: string[];
  filesModified: string[];
  outputVerified: boolean;
  outputVerifiedSignals: string[];
  totalTokenCost: number;
  duration: number;
  createdAt: number;
  updatedAt: number;
}
```

**Step 3: Add V22 migration to schema.ts**

```sql
CREATE TABLE IF NOT EXISTS task_trajectories (
  trajectory_id TEXT PRIMARY KEY,
  invocation_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  cat_id TEXT NOT NULL,
  task_context TEXT,
  search_event_ids_json TEXT NOT NULL,  -- recall_id references
  files_read_json TEXT NOT NULL,
  files_modified_json TEXT NOT NULL,
  output_verified INTEGER NOT NULL DEFAULT 0,
  output_verified_signals_json TEXT NOT NULL DEFAULT '[]',
  total_token_cost INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_trajectories_inv ON task_trajectories(invocation_id);
CREATE INDEX idx_trajectories_thread ON task_trajectories(thread_id);
CREATE INDEX idx_trajectories_cat ON task_trajectories(cat_id);
CREATE INDEX idx_trajectories_verified ON task_trajectories(output_verified);
```

**Step 4: Run test, confirm green**
**Step 5: Commit** `feat(F200): add TaskTrajectory type + V22 schema migration`

---

### Task 2: TrajectoryAggregator

**Files:**
- Create: `packages/api/src/domains/memory/TrajectoryAggregator.ts`
- Test: `packages/api/test/memory/f200-trajectory-aggregator.test.js`

**Step 1: Write failing test**

Test cases:
- Aggregates RecallEvents by invocationId into a single trajectory
- Extracts filesRead from Read tool events
- Extracts filesModified from Edit/Write tool events
- Computes totalTokenCost from event token costs
- Computes duration from first→last event timestamp
- Infers taskContext from deduplicated search queries
- Returns null for invocations with no memory tool usage

**Step 2: Run test, confirm red**

**Step 3: Implement TrajectoryAggregator**

```typescript
export class TrajectoryAggregator {
  constructor(private db: Database.Database) {}

  aggregate(
    invocationId: string,
    threadId: string,
    catId: string,
    events: RawEvent[],
  ): TaskTrajectory | null {
    // 1. Fetch RecallEvents from sqlite for this invocation
    // 2. Extract filesRead (Read tool events → file_path from summary)
    // 3. Extract filesModified (Edit/Write tool events → file_path from summary)
    // 4. Sum tokenCost from recall events
    // 5. Duration = last event timestamp - first event timestamp
    // 6. taskContext = unique queries joined by " → "
    // 7. Return assembled TaskTrajectory
  }
}
```

**Step 4: Run test, confirm green**
**Step 5: Run full test suite**
**Step 6: Commit** `feat(F200): TrajectoryAggregator — invocation-level trajectory assembly`

---

### Task 3: Trajectory Persistence (extend correlation hook)

**Files:**
- Modify: `packages/api/src/domains/memory/recall-correlation-hook.ts`
- Test: `packages/api/test/memory/f200-trajectory-persistence.test.js`

**Step 1: Write failing test**

Test: after triggerRecallCorrelation, a task_trajectories row exists for the invocation with correct searchChain references, filesRead, filesModified.

**Step 2: Run test, confirm red**

**Step 3: Extend triggerRecallCorrelation**

After persisting RecallEvents and refreshing metrics, call TrajectoryAggregator to create and persist the trajectory:

```typescript
// After line 58 (metrics refresh):
const aggregator = new TrajectoryAggregator(db);
const trajectory = aggregator.aggregate(invocationId, threadId, catId, fullEvents);
if (trajectory) aggregator.persist(trajectory);
```

Note: the hook currently doesn't receive `threadId`. We need to either:
- Extract it from events (events already have threadId field per RawEvent)
- Pass it as a parameter

Decision: extract from events (non-breaking change).

**Step 4: Run test, confirm green**
**Step 5: Run full test suite**
**Step 6: Commit** `feat(F200): persist TaskTrajectory at invocation completion`

---

### Task 4: OutputVerifiedDetector

**Files:**
- Create: `packages/api/src/domains/memory/output-verified-detector.ts`
- Test: `packages/api/test/memory/f200-output-verified.test.js`

**Step 1: Write failing tests**

Test cases:
- Returns verified=true when invocation status is 'succeeded' AND PR merged for thread
- Returns verified=true when CVO accept keyword found in recent thread context
- Returns verified=false when invocation failed
- Returns verified=false when no outcome signals present
- Returns signal list indicating which signals triggered
- Handles missing PR tracking gracefully

**Step 2: Run tests, confirm red**

**Step 3: Implement OutputVerifiedDetector**

```typescript
export class OutputVerifiedDetector {
  constructor(
    private invocationStore: InvocationRecordStore,
    private prTrackingStore: PrTrackingStore,
  ) {}

  async detect(invocationId: string, threadId: string): Promise<{
    verified: boolean;
    signals: string[];
  }> {
    const signals: string[] = [];

    // 1. Check invocation status
    const invocation = await this.invocationStore.get(invocationId);
    if (invocation?.status === 'succeeded') signals.push('invocation_succeeded');

    // 2. Check PR merge state
    const prEntries = await this.prTrackingStore.findByThread(threadId);
    if (prEntries.some(e => e.mergeState === 'MERGED')) signals.push('pr_merged');

    // 3. CVO accept / reviewer approval — deferred to v1.1
    // (requires thread message scanning, adds Redis dependency)

    return {
      verified: signals.length >= 2 || signals.includes('pr_merged'),
      signals,
    };
  }
}
```

v1 scope: invocation_succeeded + pr_merged. CVO keyword + reviewer approval deferred (requires thread message content access which adds significant coupling).

**Step 4: Run tests, confirm green**
**Step 5: Commit** `feat(F200): OutputVerifiedDetector — async outcome signal detection`

---

### Task 5: Trajectory API + scope="trajectories"

**Files:**
- Modify: `packages/api/src/routes/recall-metrics.ts` — new endpoints
- Modify: `packages/api/src/domains/memory/interfaces.ts` — add 'trajectories' to scope
- Modify: `packages/api/src/domains/memory/RecallMetricsComputer.ts` — trajectory queries
- Test: `packages/api/test/memory/f200-trajectory-api.test.js`

**Step 1: Write failing tests**

Test cases:
- GET /api/recall/trajectories returns recent trajectories
- GET /api/recall/trajectories?verified=true filters to verified
- GET /api/recall/trajectories?catId=X filters by cat
- POST /api/recall/trajectories/verify triggers on-demand verification

**Step 2: Run tests, confirm red**

**Step 3: Add scope="trajectories" to SearchOptions**

```typescript
scope?: 'docs' | 'memory' | 'threads' | 'sessions' | 'trajectories' | 'all';
```

**Step 4: Add trajectory endpoints to recall-metrics.ts**

```typescript
// GET /api/recall/trajectories
app.get('/api/recall/trajectories', async (request, reply) => {
  // Query task_trajectories table with filters
  // Join with recall_events for searchChain hydration
  // Return paginated results
});

// POST /api/recall/trajectories/verify
app.post('/api/recall/trajectories/verify', async (request, reply) => {
  // Scan unverified trajectories from last 7 days
  // Run OutputVerifiedDetector on each
  // Update verified status
  // Return { updated: count }
});
```

**Step 5: Run tests, confirm green**
**Step 6: Run full test suite**
**Step 7: Commit** `feat(F200): trajectory API endpoints + scope="trajectories"`

---

### Task 6: Cross-Cat Metrics (AC-D4)

**Files:**
- Modify: `packages/api/src/domains/memory/RecallMetricsComputer.ts`
- Modify: `packages/api/src/routes/recall-metrics.ts`
- Test: `packages/api/test/memory/f200-cross-cat-metrics.test.js`

**Step 1: Write failing tests**

Test cases:
- CrossCatEffortVariance: std(reformulation_count) across cats for trajectories with similar taskContext
- ConsumedButNotUsedRate: ratio of trajectories with consumed anchors but outputVerified=false
- Both metrics filterable by time range

**Step 2: Run tests, confirm red**

**Step 3: Implement cross-cat metrics in RecallMetricsComputer**

```typescript
computeCrossCatMetrics(days: number): {
  crossCatEffortVariance: number;
  consumedButNotUsedRate: number;
  trajectoryCount: number;
  verifiedCount: number;
} {
  // CrossCatEffortVariance:
  // 1. Group trajectories by similar taskContext (first query word overlap)
  // 2. For each group, get reformulation_count per catId
  // 3. Compute std deviation across cats
  // 4. Average across groups

  // ConsumedButNotUsedRate:
  // 1. Count trajectories with consumed.length > 0 AND outputVerified=false
  // 2. Divide by total trajectories with consumed.length > 0
}
```

**Step 4: Add GET /api/recall/metrics/cross-cat endpoint**

**Step 5: Run tests, confirm green**
**Step 6: Run full test suite**
**Step 7: Commit** `feat(F200): Cross-Cat Effort Variance + ConsumedButNotUsedRate metrics`

---

### Task 7: Integration test + cleanup

**Files:**
- Create: `packages/api/test/memory/f200-phase-d-integration.test.js`

**Step 1: Write end-to-end test**

Simulates: tool events → correlation hook → trajectory created → verification → metrics computed

**Step 2: Run full test suite**
**Step 3: Commit** `test(F200): Phase D integration test`

---

## Open Questions

### Technical OQs (self-resolve during implementation)
1. **Thread message scanning for CVO accept**: deferred to v1.1 — requires reading thread content from Redis which adds coupling. v1 uses invocation_succeeded + pr_merged.
2. **TaskContext similarity for cross-cat grouping**: v1 uses first-query-word overlap (simple). If too noisy, upgrade to embedding similarity.

### No value OQs — all within existing spec boundaries.
