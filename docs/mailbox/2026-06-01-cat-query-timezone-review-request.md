---
doc_kind: review-request
feature_ids: []
topics: [prompt-context, timezone, navigation, runtime-bug]
author: codex
reviewer: opus
created: 2026-06-01
---

# Review Request: Cat Query Timezone Context

Review-Target-ID: fix-cat-query-timezone
Branch: fix/cat-query-timezone

## What

Fixes a cat-visible prompt context bug where handoff/navigation timestamps showed UTC only, without Landy's timezone.

Changed:

- Adds `coCreator.timeZone` to `cat-template.json`, shared config types, config snapshots, and runtime co-creator updates.
- Validates timezone values as IANA timezone strings at template load and `/api/config/co-creator` patch time.
- Formats navigation and briefing baton timestamps as co-creator local time plus UTC.
- Keeps generic message history timestamps UTC-only so context lines stay compact.
- Adds regression coverage for LA cross-midnight rendering, invalid timezone rejection, and config snapshot exposure.

## Why

Cats were using UTC-only query timestamps for time-of-day reasoning. In the reported case, `06:20 UTC` looked like early morning to Opus 4.8, while Landy was actually at `2026-05-31 23:20 America/Los_Angeles`.

## Original Requirements

> "所有时间包括给你们query的都是utc 但是 ！ 没写landy到底在什么时区"
> "导致布偶猫一直以为现在凌晨了，但是其实不是"

- 来源：`docs/bug-report/2026-06-01-cat-query-no-timezone/bug-report.md` + 当前 thread 原始传球。
- 请 reviewer 对照判断：query/navigation prompt now gives cats enough local-time context to avoid UTC-as-local mistakes.

## Tradeoff

Chose configurable `coCreator.timeZone = "America/Los_Angeles"` as the first reliable source. This does not auto-follow travel or client timezone changes, but avoids client protocol work and fixes the current harness-level ambiguity.

I deliberately did not change every prompt timestamp to local+UTC. Early implementation showed that doing so lengthened ordinary history lines and broke compact context assumptions. This patch scopes local+UTC to baton/navigation/briefing timestamps where time-of-day semantics matter.

## Architecture Ownership

Architecture cell: `thread-navigation`
Map delta: none
Why: This extends existing prompt navigation/context formatting and runtime config metadata. It adds no new Store, Queue, Router, Adapter, Dispatcher, Binding, or ownership boundary.

Please reviewer check:

- `formatPromptTime()` default remains UTC-only for compact history.
- Only baton/navigation/briefing call sites opt into co-creator-local rendering.
- Runtime config patch validates timezone before persisting bad data.
- The static timezone tradeoff is acceptable as the first fix.

## Open Questions

### Technical OQ

1. Should `coCreator.timeZone` live in co-creator config long-term, or should a future client message envelope provide a per-message timezone override?
2. Is `铲屎官本地 YYYY-MM-DD HH:mm America/Los_Angeles / HH:mm UTC` clear enough for all cat prompts, or should we prefer timezone abbreviations too?

### Value OQ

无。This is a correctness fix for a reported cat-visible context bug; client auto-timezone can be a later enhancement.

## Next Action

Please review branch HEAD. If approved, I will continue to merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-cat-query-timezone/opus`
- Start Command: N/A for API/config unit review
- Ports: N/A

## 自检证据

### Spec 合规

- Original bug says query/navigation had UTC-only time and no Landy timezone: fixed by `coCreator.timeZone` and baton local+UTC rendering.
- Bug report suggested configurable CVO timezone as the stable first source: implemented.
- Regression includes cross-midnight LA case: `2026-06-01 06:20 UTC` renders as `2026-05-31 23:20 America/Los_Angeles / 06:20 UTC`.
- Dogfood output for the reported handoff shape:
  `传球: 铲屎官 → 你 (铲屎官本地 2026-05-31 23:41 America/Los_Angeles / 06:41 UTC)`.

### 测试结果

- `pnpm biome check <changed files> --diagnostic-level=error`: pass.
- `pnpm --dir packages/api run build && ... format-time/navigation/context/config/briefing tests`: 139 pass, 0 fail.
- `pnpm --dir packages/api run lint`: pass.
- `node scripts/check-hotfix-pattern.mjs`: no hotfix.
- `node scripts/check-fallback-layers.mjs`: one new helper file fallback boundary, no threshold trigger.
- `pnpm check:architecture-ownership`: exit 0; repo-existing warnings only, diff architecture nouns OK.
- Root artifact hygiene checks: no root media/design artifacts.
- `pnpm --dir packages/api test`: 13008 pass, 0 fail, 4 skipped.
- `pnpm check`: all 20 checks passed.
