---
feature_ids: [F078]
related_features: [F032, F042, F046]
topics: [routing, mentions, ux]
doc_kind: spec
created: 2026-03-07
---

# F078: Smart Routing & Group Mentions

## Status: spec

## Why

When users send messages without @mention, the system currently routes to ALL thread participants (activity-sorted). This causes unexpected multi-cat responses when users just want to continue talking to the cat they were chatting with. Additionally, there's no way to broadcast to all cats, a specific breed, or all thread participants without manually @mentioning each one.

## What

Four routing improvements:

1. **Default to last replier** -- When no @mention is present and the thread has participants, route only to the most recent replier (not all participants). No participants -> default to opus.

2. **@all / @全体** -- Route to all available cats.

3. **@全体{breed}** -- Route to all variants of a breed (e.g. @全体布偶猫 -> opus, sonnet, opus-45).

4. **@thread / @本帖 / @全体参与者** -- Route to all current thread participants.

## Acceptance Criteria

- [ ] AC-1: Message without @mention routes to the cat that most recently replied in the thread
- [ ] AC-2: New thread without participants defaults to opus (unchanged)
- [ ] AC-3: `@all` or `@全体` routes to all available cats
- [ ] AC-4: `@全体布偶猫` / `@all-ragdoll` routes to all ragdoll variants
- [ ] AC-5: `@全体缅因猫` / `@all-maine-coon` routes to all maine-coon variants
- [ ] AC-6: `@全体暹罗猫` / `@all-siamese` routes to all siamese variants
- [ ] AC-7: `@thread` / `@本帖` / `@全体参与者` routes to all thread participants
- [ ] AC-8: Group mentions respect cat availability (skip unavailable cats)
- [ ] AC-9: Existing individual @mention behavior unchanged
- [ ] AC-10: All new patterns use longest-match-first to avoid collisions

## Links

- AgentRouter: `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts`
- Cat config: `cat-config.json`
- A2A mentions: `packages/api/src/domains/cats/services/agents/routing/a2a-mentions.ts`

## Key Decisions

- Group mentions are parsed BEFORE individual mentions (they are longer patterns)
- `@thread` requires ThreadStore access; if no participants, treated as @all fallback
- Breed group patterns derived from `cat-config.json` breeds array (not hardcoded)

## Dependencies

- Evolved from: F032 (thread-level cat selection), F046 (A2A mention simplification)
- Related: F042 (prompt engineering audit -- routing policy)

## Risk

- Low. Changes are localized to AgentRouter.parseMentions + peekTargets.
- Backward compatible: existing @mention behavior untouched.

## Open Questions

- (none currently)

## Review Gate

- Reviewer: @codex (cross-family)
- Tests: agent-router.test.js extended with group mention cases

## Timeline

- 2026-03-07: Kickoff

## Requirements Checklist

| # | Requirement | Source | AC | Status |
|---|------------|--------|-----|--------|
| R1 | Default to last replier when no @mention | Interview | AC-1 | pending |
| R2 | New thread defaults to opus | Interview | AC-2 | pending |
| R3 | @all broadcasts to all cats | Interview | AC-3 | pending |
| R4 | Per-breed group mentions | Interview | AC-4,5,6 | pending |
| R5 | @thread mentions all participants | Interview | AC-7 | pending |
| R6 | Availability filtering | Derived | AC-8 | pending |
| R7 | No regression on individual mentions | Derived | AC-9,10 | pending |
