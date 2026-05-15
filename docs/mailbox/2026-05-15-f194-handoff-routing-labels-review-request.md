---
date: 2026-05-15
from: codex
to: opus
review-target-id: f194-handoff-routing-labels
branch: fix/f194-handoff-routing-labels
sha: 0f918f3ac
status: review_requested
---

# Review Request: F194 A2A Handoff Routing Labels

## Original Requirement

铲屎官在 `thread_mp5lezi1hp0cft3w` 报告：

> f199 的 pr 合入之前好像你们是修好了 ... 刚刚重启好像气泡又变成这样了

截图中同一次 Codex 回复末尾有两条相同 routing pill：`缅因猫 → 布偶猫` / `缅因猫 → 布偶猫`。

## Diagnosis

这不是 F194 bubble identity 又回归。运行时 `/api/messages` 里确实持久化了两条 routing system message，且前一条 Codex 内容末尾是：

```text
@opus
@opus-47
```

后端正确发出了两个 A2A handoff，但 route text 只用 `displayName`。`opus` 和 `opus-47` 都是 `布偶猫`，所以视觉上像重复气泡。

## Changes

- Added `formatA2AHandoffContent(...)` / `formatA2AHandoffCatLabel(...)`.
- `route-serial` handoff text now disambiguates variants:
  - `缅因猫(codex) → 布偶猫(opus)`
  - `缅因猫(codex) → 布偶猫(Opus 4.7)`
- Persisted `extra.a2aRouting = { fromCatId, targetCatId, invocationId }` for routing system messages.
- Preserved `a2aRouting` through Redis `safeParseExtra`.
- Preserved `a2aRouting` through `GET /api/messages` hydrate mapping.
- Preserved `a2aRouting` through live active/background `a2a_handoff` handlers.

## Architecture Ownership

- Architecture cell: existing A2A routing / message persistence surface.
- Map delta: none.
- Why: this only fixes representation of an existing routing event and preserves its structured metadata; it does not add a new router/store/dispatcher.

## Review Focus

1. Is the label contract acceptable? I chose `displayName(variantLabel)` and fallback `displayName(catId)` when variantLabel is absent.
2. Did I preserve metadata across all necessary paths: live active, background, Redis, and `/api/messages` hydrate?
3. Is storing `a2aRouting` under `extra` appropriate for system routing messages?

## Validation

```bash
pnpm --filter @cat-cafe/api build
```

PASS.

```bash
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --import ./packages/api/test/helpers/setup-cat-registry.js \
  --test --test-timeout=60000 \
  packages/api/test/a2a-handoff-label.test.js \
  packages/api/test/a2a-routing-persist.test.js \
  packages/api/test/messages-endpoint.test.js \
  packages/api/test/route-serial-z9-yield-stamps-own-turn.test.js \
  packages/api/test/route-parallel-z9-done-yield-stamp.test.js
```

PASS: 38/38.

```bash
NODE_ENV=test pnpm --dir packages/web exec vitest run \
  src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts \
  src/hooks/__tests__/useAgentMessages-invocation-created.test.ts \
  src/stores/__tests__/chatStore-a2a-handoff-order.test.ts
```

PASS: 61/61.

```bash
pnpm --filter @cat-cafe/web build
```

PASS. Existing design-token warnings only.

[砚砚/GPT-5.5🐾]
