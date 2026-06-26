# F233 Trajectory Emitters for F252 Phase C

> Owner: 宪宪 (Opus-4.6) | Created: 2026-06-26 | Status: DRAFT
> Scope: F233 (emitters), driven by F252 Phase C (consumer)
> Context: F252 spec AC-C0 lists 4 trajectory kinds as hard prerequisite

## Problem Statement

F252 Phase C needs `thread_split`/`thread_merge`/`pr_merged`/`phase_transition` trajectory entries to render causal edges in the multi-thread swimlane. The spec assumed these would be "4 rules added to `mapBallCustodyEventToTrajectory`" — but assessment reveals two structural gaps:

### Gap 1: Ball event kinds don't map to trajectory kinds

Ball custody events (`BallEventKind`, 17 kinds) track **ball routing** (handed, held, void, died, etc.). None of the 17 kinds correspond to:
- Thread creation (propose_thread)
- Cross-thread message delivery (cross_post)
- PR merges (GitHub state changes)
- Phase transitions (feature doc status changes)

### Gap 2: `applyBallCustodyEvent` is dead code

`FeatTrajectoryProjector.applyBallCustodyEvent()` has **zero runtime callers**. The ball→trajectory pipeline was scaffolded but never wired. Even `closed` (the one mapped kind) is never produced at runtime.

## Available Data Sources

| Trajectory Kind | Raw Data Source | Existing Infrastructure |
|---|---|---|
| `thread_split` | `ThreadProposal` (status=approved, has `parentThreadId` + `sourceThreadId`) | `RedisThreadProposalStore`, queryable by status |
| `thread_merge` | `cross_post_message` tool calls (message store, has `sourceThreadId` in metadata) | Message store, queryable by thread |
| `pr_merged` | GitHub PR state | **Already covered**: `GitRefSnapshotCollector` → `branch_merged_to_main` (git-shaped kind) |
| `phase_transition` | Feature doc commits (`docs/features/F*.md` status field changes) | `git log` on docs/ — needs parsing |

## Design Decision: Collector Path (not Ball Expansion)

**Rejected**: Expanding ball event kinds to include thread/PR/phase events. Ball custody is specifically about ball routing — expanding it conflates responsibilities.

**Chosen**: Add new collectors (like `GitRefSnapshotCollector`) that derive trajectory entries from existing data sources. This keeps each domain focused.

## Scope (MVP for F252 Phase C)

### Do Now (3 items)

1. **Wire `applyBallCustodyEvent` into runtime** — The ball custody event stream already fires events. Add a listener in the ball custody append path that calls `projector.applyBallCustodyEvent()` for each event. This unblocks `closed` trajectory entries immediately.

2. **`ThreadSplitCollector`** — Scan `ThreadProposalStore` for approved proposals. Each approved proposal with `parentThreadId` → one `thread_split` entry linking parent→child. Run in `CollectorScheduler.tick()` alongside git collector.

3. **`CrossPostCollector`** — Scan message store for `cross_post_message` events. Each cross-post from child→parent thread → one `thread_merge` entry. Run in `CollectorScheduler.tick()`.

### Already Done

4. **`pr_merged`** → Use git-shaped `branch_merged_to_main` from existing `GitRefSnapshotCollector`. F252 Phase C treats this as the PR merge signal. No additional work needed.

### Defer (Phase D or later)

5. **`phase_transition`** → Requires git log parsing of feature doc commits to detect status/phase field changes. Complex and fragile. For Phase C MVP, phase transitions can be manually annotated or derived from timeline entries. Defer to Phase D or F233 Phase D.

## Implementation Plan

### Step 1: Wire ball→trajectory pipeline

- In ball custody event append path (likely `route-serial.ts` or `BallCustodyEventLog`), add async call to `projector.applyBallCustodyEvent(event, featId)`
- Need feat→thread lookup (which feat does this thread belong to?) — use `RealFeatIndexLookup`
- Idempotent: `sourceEventId`-based dedup already in projector

### Step 2: ThreadSplitCollector

```
Interface:
  collectAll(since: number): ThreadSplitSnapshot[]

ThreadSplitSnapshot:
  proposalId: string
  parentThreadId: string
  childThreadId: string  // = resultThreadId from approved proposal
  featId: string         // from feat index lookup
  splitAt: number        // proposal.createdAt or approval time

Mapping: → FeatTrajectoryEntry { kind: 'thread_split', payload: { parentThreadId, childThreadId, proposalId } }
```

### Step 3: CrossPostCollector

```
Interface:
  collectAll(since: number): CrossPostSnapshot[]

CrossPostSnapshot:
  messageId: string
  sourceThreadId: string
  targetThreadId: string
  catId: string
  featId: string         // from feat index lookup
  postedAt: number

Mapping: → FeatTrajectoryEntry { kind: 'thread_merge', payload: { sourceThreadId, targetThreadId, messageId, catId } }
```

### Step 4: Wire into CollectorScheduler

Extend `FeatTrajectoryCollectorScheduler.tick()` to call all collectors:
```
const gitSnapshots = await gitCollector.collectAll(tickStart);
const splits = await threadSplitCollector.collectAll(tickStart);
const merges = await crossPostCollector.collectAll(tickStart);
// Apply all
```

## Open Questions

| # | Question | Lean |
|---|----------|------|
| OQ-1 | `thread_merge` from cross_post: should EVERY cross_post be a merge, or only those where the child thread "reports back" (reportingMode)? | Every cross_post from child→parent = merge edge. Filtering by reportingMode is premature — any cross-thread message is narratively significant |
| OQ-2 | Collector state: should collectors track "last processed" to avoid re-scanning all history on each tick? | Yes, use watermark pattern (last processed timestamp). Store alongside trajectory projection |
| OQ-3 | `phase_transition` deferral: does Phase C MVP work without it? | Yes — phase transitions are narrative sugar, not structural. Causal edges (split/merge/PR) are the structural requirement. Phase markers can be added in Phase D |

## Test Strategy

- Unit: each collector's `collectAll()` with mock store → correct snapshots
- Unit: projector's `apply*` methods → correct entry creation
- Integration: `CollectorScheduler.tick()` → all collectors fire → entries in store
- Regression: existing `feat-trajectory-projector-git-ref.test.js` stays green
