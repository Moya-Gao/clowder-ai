---
title: "Review Request: intake clowder-ai#276 ghost-message fix"
doc_kind: review-request
created: 2026-03-30
date: 2026-03-30
type: review-request
feature: intake-clowder-276
status: sent
---

# Review Request: intake clowder-ai#276 ghost-message fix

## What

Absorbed 3 frontend fixes from community PR clowder-ai/clowder-ai#276:

1. **Callback cascade** (`useAgentMessages.ts:435`): Changed ternary to `strict ?? placeholder` — when invocationId exists but strict match fails (lost `invocation_created`), falls back to invocationless placeholder instead of creating duplicate bubble.

2. **Unconditional catch-up** (`useAgentMessages.ts:654`): Removed `sawStreamDataRef` guard so `done(isFinal)` with no active bubble always triggers `requestStreamCatchUp`. Covers ghost-message scenario where ALL events lost during disconnect.

3. **Reconnect catch-up** (`useSocket.ts:197`): Integrated into existing `reconcileInvocationStateOnReconnect` — when server finished during disconnect (no active invocations but local had active state), triggers `requestStreamCatchUp` to fetch missed messages.

## Why

clowder-ai#290 (our outbound sync) overwrote community fix #276, causing regression reported in clowder-ai#266. This intake restores the fix using our new Intake Vision Guard process (Intent Issue #876).

## Original Requirements（必填）

> intake 愿景守护得怎么说呢 比如 intake 之前在 cat cafe 记录 issue 然后 link 别人的 issue pr 然后好好看看当时 intake 的决定要修改别人的什么要保留什么 最后实现完 review 猫要对照这个 cat cafe 的 issue
- 来源：铲屎官 2026-03-29 对话（clowder-ai#266 regression discussion）
- **请对照 Intake Intent Issue #876 的 per-file decision table 判断：所有 ABSORB 项是否已实现，所有 SKIP 项是否有合理理由**

## Tradeoff

- Reconnect catch-up: 社区用独立 `isLoading` 检查（即时），我们集成到现有 `reconcileInvocationStateOnReconnect`（延迟 2s 但基于 server truth）。选择准确性优先于即时性。
- `sawStreamDataRef` guard 移除: 可能导致纯 callback 流也触发 catch-up（多一次无害的 history fetch），但覆盖了所有 ghost-message 场景。

## Open Questions

1. `sawStreamDataRef` 移除后，纯 callback 流的 catch-up 频率是否可接受（理论上无害但多一次 API call）
2. Reconnect catch-up 的 2s 延迟是否足够覆盖用户感知（社区方案是即时的）

## Next Action

请 review 代码变更，对照 Intake Intent Issue #876 逐项检查。

Review-Target-ID: intake-clowder-276
Branch: fix/intake-clowder-276

## 自检证据

### Spec 合规

Intake Intent Issue #876 per-file decision table:
- Item #1 callbacks.ts: SKIP (already absorbed) ✅
- Item #2 useAgentMessages callback cascade: ABSORB → implemented ✅
- Item #3 useAgentMessages sawStreamDataRef: ABSORB → implemented ✅
- Item #4 useSocket reconnect catch-up: ABSORB WITH ADAPTATION → implemented ✅
- Item #5 bubble-merge test: ABSORB → 1 new test ✅
- Item #6 stream-catchup test: ABSORB → 2 tests changed/added ✅

### 测试结果

```
pnpm --filter @cat-cafe/web test    # 260 files, 1815 passed, 0 failed
pnpm lint                           # 0 errors (warnings only, pre-existing)
pnpm check (biome)                  # 0 errors (check:features pre-existing on main)
```

API test failure is pre-existing (Redis isolation guard on workflow-sop-store.test.js), same on main. Zero API files changed in this PR.

### 相关文档

- Intake Intent Issue: zts212653/cat-cafe#876
- Community PR: clowder-ai/clowder-ai#276
- Community Issue: clowder-ai/clowder-ai#266
