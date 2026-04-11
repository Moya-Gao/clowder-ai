---
title: Community Reconciliation v0.6.1
date: 2026-04-11
sync_pr: clowder-ai#443
source_range: 9e548555..b07d6705b
---

# Community Reconciliation: v0.6.1

## Synced Content

### Bug Fixes (P0/P1)
- fix(resolver): deterministic runtime account binding (502 hardening)
- fix: Redis DEFAULT_TTL → 0 + thread self-healing (LL-048)
- fix: legacy account migration skips conflicts instead of crashing startup
- fix(anthropic): keep seed cats on builtin claude
- fix: session chain badge shows catId instead of ambiguous breed name
- fix: use ANTHROPIC_MODEL env var for third-party model override
- fix(F088): persist contentBlocks in messageStore for queue replay
- fix(a2a): inline mention follow-ups — UX hint, integration test, brand guard

### Features
- feat(F152): Expedition Memory — Phase B + Phase C
- feat(F156): WebSocket Security Hardening — D-1 through D-6
- feat(F158): Kimi CLI first-class cat (clowder-ai#361)

## Community Issue Review

Reviewed all 23 open bugs. 1 issue closed:

| Issue | Title | Verdict | Reason |
|-------|-------|---------|--------|
| **#438** | **F340 regression: seed cats drift to installer-anthropic** | **closed** | **Fixed by `fix(anthropic): keep seed cats on builtin claude`** |
| #441 | Community PR: remove runtime seed-cat accountRef suppression | keep open | Deeper refactor of same root cause; kept for intake evaluation |
| #300 | Gemini 会话丢失 after restart | keep open | Gemini CLI exit code 42, not Redis TTL related |
| #310 | 无法选取模型认证 | keep open | Cat editor UI auth dropdown, not resolver related |
| #289 | 会话无法正常选择猫猫 | keep open | Thread cat dropdown missing, UI issue |
| #424 | 初始化治理无响应 | keep open | Governance init, not related to this sync |

Other open bugs (#440, #427, #386, #338, #263, #260, #236, #234, #200, #181, #169, #137, #133, #131, #95, #94, #74, #63) reviewed — none addressed by v0.6.1 content.

## Actions Taken

- Closed #438 (F340 regression: seed cats drift to installer-anthropic) — fixed by `fix(anthropic): keep seed cats on builtin claude`
- Commented on #441 (community PR fixing same root cause with deeper refactor) — kept open for intake evaluation

## Deferred to Next Sync

- `6c338c563` fix(sync): ensure_runtime_clean checks staged+unstaged files before lock drift stash
  - Dev tooling guard fix (not user-facing application change)
  - Reviewed by 砚砚, merged to main after sync snapshot cutoff (`b07d6705b`)
  - Will be included in next outbound sync cycle

## CVO Sign-off

- Approved by @lysander on 2026-04-11
- Release tag `v0.6.1` → `7687701e6ec7f5111875c2bca22051a3ca326c04` published to clowder-ai
