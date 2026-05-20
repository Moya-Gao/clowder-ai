---
doc_kind: review_request
created_at: 2026-05-20
author: codex
source_pr: https://github.com/zts212653/clowder-ai/pull/715
target_pr: https://github.com/zts212653/cat-cafe/pull/1795
---

# Review Request: intake clowder-ai#715

Review-Target-ID: intake-clowder-715-feishu-card-actions
Branch: intake/clowder-715-feishu-card-actions

## What

Absorb `zts212653/clowder-ai#715` into Cat Cafe:

- Feishu command replies render a `select_static` quick-action dropdown.
- Feishu `card.action.trigger` events route selected commands through the existing connector router.
- `/threads`, `/history pick`, and `/commands` expose structured card actions for Feishu cards.
- Card-action routing is fail-closed when chat type is unknown, with Feishu API fallback and 30-minute cache.
- Regression tests cover command actions, Feishu card rendering, and gateway card-action routing.

Process artifact in this PR: this review request file under `docs/mailbox/`.

## Why

Community PR #715 solves a real Feishu onboarding friction: users can discover and execute common connector commands from the message card instead of remembering slash command syntax. This keeps the maintainer merge attribution intact while bringing the behavior back home behind Cat Cafe's inbound guards.

## Original Requirements

> 那你走intake 回家的流程吧，merge 然后读sop 走流程回家
> 记得一定要好好看看intake skills 大多数猫猫都会犯错

- 来源：本轮 A2A 用户指令 + intake tracking issue `https://github.com/zts212653/cat-cafe/issues/1794`
- 请对照上面的摘录判断交付物是否完成了「外部 PR 合入 + 家里 absorb PR + intake 证据」。

## Tradeoff

This intake keeps the upstream implementation shape instead of doing a deeper adapter-only rewrite in this PR. The source PR has already addressed the earlier blocking review items: text fallback, synthetic card-action IDs, duplicated routing, duplicated quick-action constants, public handle leakage, and dist-based test import.

The main architectural tradeoff remains visible: `cardActions` now exists on shared connector envelopes even though Feishu is the first consumer. My judgment is that this is acceptable for intake because the type is generic enough for future card-capable adapters and the behavior is still optional for adapters that only support text replies. Please review this explicitly.

## Architecture Ownership

Architecture cell: transport / action-plane
Map delta: none
Why: This extends existing connector command formatting, Feishu adapter rendering, and gateway routing without introducing a new Store, Queue, Router, Adapter, Dispatcher, Binding, ownership boundary, or canonical anchor.

Please check:

- whether `cardActions` on shared `CommandResult` / `MessageEnvelope` is acceptable as a generic connector action contract
- whether the Feishu chatType fail-closed fallback is safe for both webhook and WebSocket paths
- whether the generated synthetic `card-action-*` message IDs correctly avoid reaction side effects
- whether `DEFAULT_QUICK_ACTIONS` belongs in `ConnectorMessageFormatter.ts` or should move to a narrower connector-action module later

## Open Questions

### Technical OQ

Is `MessageEnvelope.cardActions` the right long-term boundary, or should we move to an adapter-owned action enrichment pass after this intake lands? My recommendation for this PR is to accept the generic optional field, then revisit only if a second platform needs a different action model.

### Value OQ

None. The source issue was triaged as an accepted enhancement; no CVO-level product choice remains open for this absorb PR.

## Next Action

Please review PR `https://github.com/zts212653/cat-cafe/pull/1795` and either block with concrete P1/P2 findings or approve the intake.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/intake-clowder-715-feishu-card-actions/opus`
- Start Command: `pnpm review:start` if an interactive runtime is needed
- Ports: N/A for this backend connector review; do not use runtime ports `3001/3002` or alpha ports `3011/3012/4111`

## Self-Check Evidence

### Spec Compliance

- Source issue accepted: `zts212653/clowder-ai#714` has accepted triage labels.
- Source PR merged: `zts212653/clowder-ai#715`, squash commit `88aafeade591cdafe9d113b55e6563f622da98e2`.
- Cat Cafe intake issue created: `https://github.com/zts212653/cat-cafe/issues/1794`.
- Absorbed source files: 9 upstream files under `packages/api/src/infrastructure/connectors/` and `packages/api/test/`.
- Brand Guard: `ConnectorMessageFormatter.formatCommand()` keeps `header: 'Cat Café'`; `bash scripts/intake-from-opensource.sh --validate-inbound` passed.
- UI/design: no `packages/web/` changes; no `.pen` design comparison required.
- Artifact hygiene: no root-level media/design artifacts.

### Test Results

```bash
pnpm --filter @cat-cafe/api run build
# pass

bash packages/api/scripts/with-test-home.sh node --test packages/api/test/connector-command-layer.test.js packages/api/test/connector-gateway-bootstrap.test.js packages/api/test/feishu-adapter.test.js
# 181/181 pass

bash scripts/intake-from-opensource.sh --validate-inbound
# pass

pnpm check
# pass; existing skills manifest advisory warnings only

pnpm --filter @cat-cafe/api run lint
# pass

pnpm lint
# pass; existing frontend hardcoded-color warnings only

pnpm -r --if-present run build
# pass; existing frontend hardcoded-color/react-hook warnings only

pnpm check:architecture-ownership
# exit 0; warning-only script reports this connector diff adds architecture nouns, listed above as review focus

node scripts/check-fallback-layers.mjs
# exit 0; self-check triggered
# FeishuAdapter: +5/-1 fallback layers, connector-gateway-bootstrap.ts: +3
# Self-check answer:
# - This is repairing an external-event coordinate boundary, not patching internal uncertainty.
# - The layers are needed because Feishu can send button values or select options, webhook payloads may omit chat type, and token/API lookup can fail.
# - The fail-closed path rejects unknown chat type instead of guessing, so removing the fallback would either drop valid card actions or make group/DM routing unsafe.

node scripts/check-hotfix-pattern.mjs
# hotfix=false
```

### Related Documents

- Intake issue: `https://github.com/zts212653/cat-cafe/issues/1794`
- Source issue: `https://github.com/zts212653/clowder-ai/issues/714`
- Source PR: `https://github.com/zts212653/clowder-ai/pull/715`
- Target PR: `https://github.com/zts212653/cat-cafe/pull/1795`

[砚砚/GPT-55🐾]
