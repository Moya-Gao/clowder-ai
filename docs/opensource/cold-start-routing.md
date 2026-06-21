---
feature_id: F208
doc_kind: cold-start-guide
version: 1.0
created: 2026-06-21
addresses: OQ-7
notes:
  - "Companion to cat-dossier-template.md — covers bootstrapping without historical data"
  - "Relevant when all agents are 'new cats' with no established profiles"
---

# Cold-Start Routing Guide

> **Problem (OQ-7)**: When all three profile sources (peer observation, CVO experience,
> eval data) are empty, routing decisions have no data. The system may never route tasks
> to a new agent, creating a cold-start death spiral — the agent never gets work, so it
> never generates observations, so its profile stays empty, so it never gets work.
>
> This is amplified when adopting capability-profile routing for the first time: ALL
> agents are "new" simultaneously.

## Strategy: Three-Layer Bootstrap

### Layer 1: Inherent Traits (Day 0 — immediate)

Every agent has capabilities defined by its model and configuration, independent of
observed history. These form the bootstrap profile:

```yaml
# Minimum viable profile — fill this on day 0 for every agent
peakCapabilities:
  - "What does the model documentation say this model is good at?"
  - "What role did you assign it in your team config?"
antiSignals:
  - "What does the model documentation say this model struggles with?"
  - "What tasks would be wasted on this model's price/speed tier?"
```

**Sources for inherent traits**:
- Model provider documentation (capabilities, context window, speed tier)
- Your team config file (`teamStrengths` / `roleDescription` fields)
- Model benchmark results (if available)
- Price/speed tier positioning (expensive = complex tasks, cheap = volume tasks)

**Example** (bootstrapping a new code-focused agent):
```yaml
peakCapabilities:
  - "Fast code generation and iteration"
  - "Test writing and bug fixing"
antiSignals:
  - "Deep architecture decisions (insufficient deliberation depth)"
  - "Long-form document synthesis (context window may be limiting)"
```

This is deliberately shallow — it gets the routing system moving, not optimized.

### Layer 2: Trial Routing (Week 1-2 — active exploration)

To break the cold-start death spiral, guarantee minimum exposure for new agents:

**Mechanism: "Trial routing"** — for the first N tasks (recommended: 5-10 per agent),
intentionally route a mix of task types to each agent regardless of profile data.
This is exploration, not exploitation.

**Implementation approaches** (pick one):

1. **Round-robin seeding**: First 5 tasks go to agents in rotation, ignoring profiles.
   Simple, but may waste time on bad matches.

2. **Diversity quota**: Each agent must receive at least 2 tasks per week from each
   task category (code, review, docs, research) during the bootstrap period.
   More structured, requires category tagging.

3. **Explicit "try X" directive**: The team lead manually routes 2-3 tasks to each
   new agent with explicit note: "This is a trial — observe quality and speed,
   don't optimize for delivery." Most lightweight for small teams.

**What to observe during trial routing**:
- Time to completion (relative to task complexity)
- Quality of output (needs revision? misses requirements?)
- Self-correction behavior (catches own mistakes? or ships blind?)
- Task fit signals (struggles visibly? or handles with ease?)

**Recording observations**: After each trial task, write 1-2 sentences in the agent's
profile. Provenance = `[trial: task-description | date]`. Don't wait for perfection —
rough observations > no observations.

### Layer 3: Fallback Chain (Ongoing — graceful degradation)

When the profile system can't make a routing decision (no data for a specific task type),
fall through this chain:

```
1. Dossier profile (structured, evidence-backed)     ← best signal
2. Team config `teamStrengths` field                  ← operator-defined role
3. Model inherent capabilities (from provider docs)   ← baseline assumption
4. Round-robin / ask the team lead                    ← last resort
```

**Key principle**: Fallback is not failure. A team with only Layer 2-3 data still
routes better than random assignment. The goal is progressive enrichment, not
all-or-nothing.

**For teams without Cat Cafe infrastructure**: The fallback chain still works.
`teamStrengths` is just a string in your agent config. You don't need a structured
YAML dossier on day 1 — a one-liner per agent ("good at X, bad at Y") in whatever
config format you use is enough to start.

## Anti-Patterns (What NOT to Do)

| Anti-Pattern | Why It Fails | Instead |
|---|---|---|
| Wait until profiles are "complete" before routing | Profiles are never complete — you'll wait forever | Start with inherent traits, grow from incidents |
| Copy another team's profiles as defaults | Their agents are not your agents — even same model behaves differently in different contexts | Start blank, observe YOUR agents |
| Auto-generate profiles from benchmarks alone | Benchmarks measure isolated capability, not team behavior | Use benchmarks as ONE input to Layer 1, not the whole profile |
| Skip trial routing for "obviously strong" agents | Confirmation bias — you route to them because you assume they're good, never testing alternatives | Every agent gets trial exposure |
| Over-invest in profile infrastructure before using profiles | Build the habit of reading profiles during handoff first, then invest in tooling | Start with a markdown file, upgrade when it hurts |

## Timeline: From Zero to Useful Profiles

| Week | Milestone | Profile State |
|------|-----------|---------------|
| 0 | Fill inherent traits for all agents | Layer 1 only (model docs + config) |
| 1-2 | Trial routing active | Layer 1 + raw observations accumulating |
| 3-4 | First profile revision | Layer 1 + 2-3 entries per field from real incidents |
| 5-8 | Routing decisions reference profiles | Profiles influencing handoff; gaps visible |
| 8+ | Steady state | Profiles grow from incidents; periodic review for staleness |

## Graduating from Cold Start

You've exited cold start when:
- [ ] Every agent has at least 2 evidence-backed entries in "Peak Abilities"
- [ ] Every agent has at least 1 entry in "Bad Intuitions" (from real observation, not theory)
- [ ] Routing decisions reference profiles at least 50% of the time
- [ ] Team members can articulate "when to call X vs Y" without looking at profiles

At this point, switch from trial routing to profile-driven routing. Keep Layer 3
fallback chain active permanently — it handles edge cases and new task types gracefully.

## Quick Start Checklist

1. [ ] Create `cat-dossier.md` from template (see `cat-dossier-template.md`)
2. [ ] Fill Layer 1 (inherent traits) for each agent — 15 minutes max
3. [ ] Commit to 2-week trial routing period
4. [ ] After each task during trial: write 1 sentence observation
5. [ ] Week 2: First profile revision (promote observations to fields)
6. [ ] Week 4: Review — are profiles being consulted during handoff?
