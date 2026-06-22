---
title: "Review Request: prompt context dedupe for native L0 providers"
type: review-request
date: 2026-06-22
author: codex
---

# Review Request: Prompt Context Dedupe for Native L0 Providers

Review-Target-ID: prompt-context-dedupe
Branch: fix/prompt-context-dedupe

## What

Reduced per-turn user payload duplication for providers that already receive compiled L0 through a native system/developer channel.

- Added `InvocationContext.nativeL0Injected`.
- Passed `hasNativeL0` from serial and parallel routing into `buildInvocationContext()`.
- Gated the two long A2A anchors in `buildInvocationContext()` behind `!nativeL0Injected`:
  - `A2A 球权检查`
  - `下一棒传球决策树`
- Kept dynamic invocation context intact: identity anchor, mode, teammates, voice, DM/cross-thread hints, SOP/routing hints, navigation, and context history.
- Kept ADR-038 `stagingPrepend` untouched.

## Why

CVO found that real user payloads were carrying repeated harness content every turn. The factual boundary is provider capability, not model family: Codex also has native L0 through `developer_instructions`, so the condition must be `service.injectsL0Natively() === true`, not "Claude vs GPT/Gemini".

For native L0 providers, the long A2A rules already arrive through the compression-immune L0 channel. Repeating them in every user-message invocation context costs roughly 300 tokens per turn without adding new information.

## Original Requirements

> "我觉得每一轮user query 我们都带上了太多的重复信息了，这些信息 每一轮真实送进 session 的 user payload 到底注了多少 harness 内容，以及哪些是重复注入！！"
> "我先要优化我们的提示词！ 不要那么多重复的！"
- 来源：CVO 当前 thread 指令，2026-06-22 06:33 America/Los_Angeles
- Related historical spec: `docs/features/F042-prompt-engineering-audit.md`
- 请对照上面的摘录判断交付物是否真的减少了重复 user payload，而不是误删动态上下文。

## Tradeoff

- Chose provider capability (`nativeL0Injected`) over model family because Codex and Claude both have native L0 paths, while future providers should be decided by `service.injectsL0Natively()`.
- Did not remove `Identity:` / mode / teammate anchors because they are dynamic per invocation and useful for compression/session positioning.
- Did not change `stagingPrepend` because ADR-038 makes it a separate per-turn staging contract.
- Did not optimize navigation/history payload in this patch; those are separate context assembly contracts.

## Architecture Ownership

Architecture cell: `identity-session`
Map delta: none
Why: This narrows prompt injection for existing identity/A2A invocation context; it does not create a new Store, Queue, Router, Adapter, Dispatcher, Binding, or architecture cell.

Please check:
- diff is consistent with `Map delta: none`
- no dynamic invocation hints were accidentally removed for native L0 providers
- non-native L0 providers still receive the long A2A anchors in user-message context

## Open Questions

### 技术 OQ

1. Is `hasNativeL0` the correct source of truth at both serial and parallel routing call sites?
2. Are the two skipped strings exactly the duplicated long anchors, without removing dynamic invocation state?
3. Should the trailing comment be updated later to say "critical for non-native-L0 providers" instead of "critical for non-Claude models"?

### 价值 OQ

无。This is a reversible prompt payload dedupe aligned with CVO's stated optimization goal.

## Next Action

Please review behavior and regression coverage. Verdict: APPROVE or REQUEST-CHANGES with blocking rationale.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/prompt-context-dedupe/opus`
- Start Command: `pnpm review:start`
- Ports: not required for this backend prompt-context change; if reviewer starts the app, use review sandbox auto-assigned non-runtime ports.

## 自检证据

### Spec 合规

- Native L0 providers no longer repeat `A2A 球权检查` or `下一棒传球决策树` inside per-turn user-message invocation context.
- Non-native L0 providers still receive both long A2A anchors.
- Dynamic invocation context still includes identity/mode/teammate anchors.
- ADR-038 staging content is unchanged.

### 测试结果

```
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/system-prompt-builder.test.js
  # 122 passed, 0 failed

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/agent-router.test.js
  # 100 passed, 0 failed

pnpm --filter @cat-cafe/api run lint
  # tsc --noEmit passed

git diff --check
  # passed

pnpm check
  # passed
```

### Red/Green Note

The new `buildInvocationContext omits repeated A2A long anchors when native L0 is injected` test failed before the implementation because `A2A 球权检查` was still present, then passed after gating on `nativeL0Injected`.

### 相关文档

- Feature history: `docs/features/F042-prompt-engineering-audit.md`
- Native L0 staging contract kept separate: `docs/decisions/038-l0-staging-protocol.md`
