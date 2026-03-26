# Review Request: F139 Phase 1b — Actor Dispatch + Execute Routing + V1 Cleanup

Review-Target-ID: f139-phase-1b
Branch: feat/f139-phase-1b-actor-dispatch

## What

9 commits covering three deliverables:
1. **V1 Cleanup**: Deleted legacy `TaskRunner.ts` + `ScheduledTask` interface + dead code in `SummaryCompactionTask.ts`
2. **Execute Routing**: Wired `deliverMessage` into ConflictCheckTaskSpec and ReviewCommentsTaskSpec — both now deliver connector messages. ReviewComments uses cursor-only-on-success pattern (LL-039)
3. **Actor Dispatch**: New `ActorRole` / `CostTier` / `ActorSpec` types, `ActorResolver` maps capability namespaces to roster catIds via injectable roster getter, `RunLedger` V6 schema adds `assigned_cat_id` for receipt tracking, `TaskRunnerV2` pipeline resolves actor once per tick, all 4 TaskSpecs declare their actor spec

## Why

Phase 1b of F139 Unified Schedule Abstraction. The scheduler can now "wake up the right cat" — tasks declare what capability they need + cost preference, system matches from roster and records who was assigned.

## Original Requirements
> 铲屎官 23:17: "1. Old TaskRunner V1 这个 P2 的清理任务  2. conflict-check / review-comments 的 execute 补全  3. Phase 1b 的 actor.role + costTier + MCP dispatch。这几个我们先做一下？"
- 来源：本会话铲屎官消息 2026-03-26 23:17
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- ActorResolver uses injectable roster getter (not singleton) — adds a factory function but enables clean testing without global state
- `assigned_cat_id` is nullable in RunLedger — backward compatible, no-actor tasks get null
- Actor resolution happens once per tick (not per workItem) — sufficient for Phase 1b, per-workItem resolution can be added in Phase 2 if needed

## Open Questions

1. **ACTOR_ROLE_TO_ROSTER_ROLES mapping**: `memory-curator → ['architect']`, `repo-watcher → ['peer-reviewer', 'coder']`, `health-monitor → ['architect', 'peer-reviewer']`. Does this mapping make sense for the current roster?
2. **DeliverMessageInput interface**: Duplicated between ConflictCheckTaskSpec and ReviewCommentsTaskSpec. Worth extracting to shared? (I kept it local to avoid coupling)
3. **MCP dispatch**: The plan title says "MCP dispatch" but actual dispatch through ConnectorInvokeTrigger is already handled by CiCdCheckTaskSpec. The other specs use deliverMessage (notification only, no cat invocation). Should conflict-check/review-comments also trigger cat invocation, or is notification sufficient?

## Next Action

Please review the 9 commits on `feat/f139-phase-1b-actor-dispatch`. Focus on:
- Actor role mapping correctness
- cursor-only-on-success pattern in ReviewCommentsTaskSpec
- Schema V6 migration safety

## Self-Check Evidence

### Spec Compliance
All 8 plan tasks completed and verified:
- AC-B1: ActorResolver resolves from roster ✅
- AC-B2: RunLedger receipt tracking (V6 schema) ✅
- AC-B3: costTier deep/cheap preference ✅
- Supplementary: V1 cleanup, conflict-check + review-comments execute routing ✅

### Test Results
```
node --test (11 suites, 64 tests) → 64 passed, 0 failed ✅
pnpm check → 0 errors ✅
pnpm lint → 0 errors ✅
pnpm --filter @cat-cafe/api build → exit 0 ✅
```

### Related Documents
- Plan: `docs/plans/2026-03-26-f139-phase-1b-actor-dispatch.md`
- Feature: `docs/features/F139-unified-schedule-abstraction.md`
- Lessons applied: LL-038 (timeout concurrent reentry), LL-039 (cursor premove)
