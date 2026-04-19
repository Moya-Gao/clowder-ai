# Review Request: F148 Phase F — Baton Context + Navigation Data

Review-Target-ID: f148-phase-f
Branch: feat/f148-phase-f

## What
New `navigation-context.ts` module with 3 pure functions:
- `extractBatonContext`: scans messages for last @ mention, extracts speaker/excerpt, detects stale hold contradiction
- `summarizeActiveTasks`: top 3 non-done tasks sorted by recency
- `formatNavigationHeader`: renders data as `[导航]...[/导航]` block — no intent labels (KD-8)

Wired into `route-helpers.ts` assembleIncrementalContext: navigation header injected BEFORE cold/warm fork (KD-7 — all paths get navigation).

Extended `format-briefing.ts` briefing card to include baton + active tasks in bodyMarkdown.

## Why
F148 Phase A-E solved compression (80% token reduction). Phase F starts the "navigation axis" — giving cats situation awareness on cold/warm start. Core insight: cats ARE LLMs, give them raw data (@ original text + baton events + task list), let them reason.

## Original Requirements
> 铲屎官（2026-04-19）："给足够猫猫需要的数据，猫猫自己就是LLM甚至是带着猫猫身子爪子的LLM，给了足够证据猫猫自己去搜去扒拉在猫爬架自由探索就行了？好像没必要非搞一个什么小模型甚至可能误导你们？"
> 
> 铲屎官 also identified the ball deadlock case: codex says "别动", then @opus → opus reads stale "别动" → deadlock.
- 来源: 本 session 对话 + `docs/plans/2026-04-19-f148-phase-f-intent-baton-context.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- Deleted intent classifier (Task 1 in original plan) per KD-8: regex/LLM labels = cognitive scaffolding = anti-pattern
- Navigation header is lightweight text (not rich block) for warm path — briefing card only extends cold path

## Open Questions
1. `HOLD_PATTERNS` regex covers 中/英 hold phrases — is coverage sufficient?
2. Stale hold only checks same-speaker's immediately preceding message. Should it scan further back?
3. Navigation header prepended to contextText — should it be a separate field consumed differently by SystemPromptBuilder?

## Next Action
P1/P2 review. Focus on: correctness of baton extraction logic, stale hold detection edge cases, and whether navigation header injection point is safe for both paths.

## Review Sandbox
- Path: `/tmp/cat-cafe-review/f148-phase-f/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: assigned by review:start (no frontend changes, API-only review)

## Self-check Evidence

### Spec Compliance
| AC | Status |
|----|--------|
| F1: Intent classifier DELETED (KD-8) | N/A (not built) |
| F2: Baton context extraction | 9 tests |
| F3: Active tasks from TaskStore | 3 tests |
| F4: Navigation header ALL paths (KD-7) | wired before fork |
| F5: Briefing card with baton + tasks | 4 tests |
| F6: Stale hold contradiction | 2 tests |

### Test Results
```
pnpm --filter @cat-cafe/api test → 8722 tests, 8721 pass, 0 fail
pnpm lint → 0 errors (warnings pre-existing)
pnpm check → 0 errors
pnpm --filter @cat-cafe/api build → exit 0
```

### Related Docs
- Plan: `docs/plans/2026-04-19-f148-phase-f-intent-baton-context.md`
- Feature: `docs/features/F148-hierarchical-context-transport.md`
- KD-7: Navigation layer independent of smart window
- KD-8: No intent classifier — give data not conclusions
