# ADR-023: F157 Journey — Naming Pivot + Activity Event Spine

**Status:** Proposed  
**Date:** 2026-04-15  
**Authors:** opus (布偶猫), gpt52 (缅因猫), gemini (暹罗猫), sonnet (布偶猫)  
**Supersedes:** Original F157 "Cat Growth RPG" naming

## Context

F157 Phase A-C implemented a six-dimensional profiling system with XP, levels,
achievements, and radar charts. External review (Issue #480) correctly identified
that calling this "Growth" oversteps what the system actually does — it visualizes
collaborative activity, not agent capability emergence.

After team discussion (architecture + design + product), we converge on:

> **This is not a growth system. It's a journey record.**  
> The system observes and visualizes collaborative activity footprints.  
> Growth (capability emergence via memory) belongs to F102/F152.

## Decision 1: Naming Pivot

### Feature-level

| Old | New (zh) | New (en) |
|-----|----------|----------|
| Cat Growth RPG | **猫猫足迹** | **Cat Journey** |

### Sub-concept mapping

| Old (RPG) | New (Journey) | Rationale |
|-----------|---------------|-----------|
| XP / Experience Points | **足迹点 / Footfall** | Observable trace, not reward |
| Level (Lv.3) | **历练 / Seasoning** ("步履 · 第三阶") | Depth of participation |
| Achievement | **珍贵瞬间 / Moments** | Noteworthy milestones, not trophies |
| Growth Radar Chart | **特质画像 / Traits Portrait** | Personality profile, not stat sheet |
| Growth Dimension | **Trait Axis** | Activity distribution axis |
| GrowthService | **JourneyService** | Code-level rename |
| GrowthOverview | **JourneyOverview** | Code-level rename |
| CatGrowthProfile | **CatJourneyProfile** | Code-level rename |
| GrowthDimension | **TraitDimension** | Code-level rename (values unchanged) |

### Visual progression (Seasoning tiers)

| Tier | Label | Visual |
|------|-------|--------|
| 1-2 | 浅印 (light print) | Faint paw prints |
| 3-5 | 深印 (deep print) | Solid paw prints |
| 6+ | 铭刻 (engraving) | Embossed / gold paw prints |

### What does NOT change

- Dimension values: `architecture | review | aesthetics | execution | collaboration | insight`
- Level formula: `floor(sqrt(xp / 100))`
- XP amounts per source
- Achievement unlock conditions
- Redis key structure (data migration deferred)

## Decision 2: Activity Event Spine

### Problem

`awardXp()` calls are scattered across 8 files in the transport/route layer,
coupling product logic to request handling. GrowthService and F075
leaderboard-service both consume similar signals through separate ingestion paths.

### Architecture

```
Route / Hook layer
    │ emit ActivityEvent (facts only)
    │
    ▼
ActivityEventBus (in-process EventEmitter)
    ├─→ JourneyProjector    → footfall, traits, bonds, titles
    ├─→ LeaderboardProjector → rankings, badges, stats (F075)
    ├─→ ToolUsageProjector   → tool analytics (F150)
    └─→ MemoryProjector      → high-value events → F102 evidence
```

### ActivityEvent schema

```typescript
/** Unified activity event — source of truth for all projectors. */
export interface ActivityEvent {
  /** Event type discriminator */
  type: ActivityEventType;
  /** Cat ID or 'co-creator' */
  actorId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Thread context */
  threadId?: string;
  /** Freeform metadata per event type */
  metadata: Record<string, unknown>;
}

export type ActivityEventType =
  | 'tool_used'
  | 'task_completed'
  | 'message_sent'
  | 'review_submitted'
  | 'bug_caught'
  | 'multi_mention_completed'
  | 'deep_collab_completed'
  | 'evidence_cited'
  | 'session_sealed'
  | 'rich_block_created'
  | 'design_feedback_given';
```

### Relationship to existing `POST /api/leaderboard-events`

The existing leaderboard events endpoint accepts external events (git stats,
game results). The Activity Event Spine handles **internal** events emitted by
the application itself. The two converge at the projector level — both
LeaderboardProjector and JourneyProjector can consume from either source.

**Phase 1 (this PR):** In-process EventEmitter, no persistence.  
**Phase 2 (future):** Optionally persist events to enable replay/recomputation.

### Migration path for awardXp

Each `awardXp()` call site becomes an `activityBus.emit()`:

```typescript
// Before (route-serial.ts)
deps.growthService.awardXp(msg.catId, source);

// After
deps.activityBus.emit({
  type: 'tool_used',
  actorId: msg.catId,
  timestamp: new Date().toISOString(),
  metadata: { toolName, category },
});
```

JourneyProjector subscribes and translates events to footfall awards internally.

### Co-creator identity

Current: `catId = 'co-creator'` hardcoded constant.

This PR keeps the constant but centralizes it in `JourneyService.ACTOR_CO_CREATOR`.
Full registry alignment with F127 is deferred to Phase D (Leadership Growth),
where co-creator becomes a first-class registry entry.

### Memory promotion rules (F102 integration boundary)

Not all events merit memory crystallization. Initial rules:

| Event | Promote to F102? | Condition |
|-------|------------------|-----------|
| deep_collab_completed | Yes | Always — rare, high signal |
| bug_caught | Yes | Always — learning moment |
| evidence_cited | Yes | Always — knowledge reuse |
| review_submitted | Maybe | Only if review contains actionable findings |
| tool_used | No | Too noisy |
| message_sent | No | Too noisy |
| session_sealed | No | Lifecycle event, not knowledge |

MemoryProjector applies these filters before forwarding to F102 EvidenceStore.
Exact implementation deferred — this PR defines the interface contract only.

## Consequences

- **Positive:** Clean separation of concerns. Routes emit facts, projectors
  interpret meaning. New consumers (e.g. future analytics) just subscribe.
- **Positive:** Naming accurately reflects what the system does.
- **Negative:** Significant rename across ~26 files. Mechanical but tedious.
- **Risk:** Redis keys keep old `growth:` prefix for backward compat.
  Data migration to `journey:` prefix deferred.
