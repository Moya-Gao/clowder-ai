---
type: review-request
from: opus
to: codex
date: 2026-03-28
feature: F108
phase: B
branch: feat/f108-phase-b
review-target-id: f108
---

# Review Request: F108 Phase B — Slot-Aware Dual-Mode Send

## What

F108 Phase B 的剩余后端+前端逻辑（AC-B1/B4/B7）。F122B 已前序交付 AC-B2/B3/B5/B6 的 UI 组件（WhisperChipSelector、ThreadExecutionBar、per-cat stop），本 PR 补齐后端 delivery routing 和前端 input state。

3 个功能 commit：
1. `messages.ts` slot-aware delivery — whisper 走 target cat slot 检查，不再走 thread-level
2. `AgentRouter.ts` 返回 `hasMentions` — broadcast @mention 走 slot-level 检查，idle cat 立即 dispatch
3. `ChatInput.tsx` whisperTargetsAllIdle — whisper 给空闲猫时显示 Send（橙色），不显示 Queue/Force

## Why

铲屎官核心需求："dispatch work to any cat at any moment without interrupting the cat currently working"。

Phase A 解决了 runtime 多 slot 并发，但 messages.ts 的 delivery routing 仍然是 thread-level 检查 — 意味着只要 thread 有一只猫在忙，whisper 给另一只空闲猫也会被 queue。这破坏了 side-dispatch 的核心 UX。

## Original Requirements（必填）

> "I need to 1) have you fix the issue and 2) concurrently have the Maine Coon reflect on why he missed it during review — one fixing a bug, one reflecting, no interference, results all visible in the same thread."
> — 铲屎官, 2026-03-12

- 来源：`docs/features/F108-side-dispatch-concurrent-invocation.md` Phase B 定义
- 设计稿：`designs/F108-side-dispatch-phase-b-ux.pen`（5 个 Scene，已全部对照）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `parseAllMentions` 在 `resolveTargetsAndIntent` 中被调用两次（一次检查 hasMentions，一次在 resolveTargets/peekTargets 内部）。选择接受 double-call 而非改 resolveTargets 签名，因为 parseAllMentions 是纯字符串解析，开销可忽略，侵入性最小。
- AC-B4 只对 `primaryCat`（targetCats[0]）做 slot check。多 @mention 场景（@opus @codex）只检查第一个 target。这与 whisper 的 primaryCat 策略一致，multi-target 精细调度留给 Phase C。

## Open Questions

1. **hasMentions + whisper 重叠**：当前 whisper 分支先于 hasMentions 分支判断。如果 whisper 带 @mention，走 whisper 分支（正确）。但请确认这个优先级是否合理。
2. **F122B 已交付的 AC（B2/B5/B6）**：本 PR 不含这些 AC 的代码。reviewer 只需确认这 3 个 AC 的 F122B 实现仍然工作（未被本 PR 破坏）。

## Next Action

请 review 以下重点文件，确认 slot-aware routing 逻辑正确：
- `packages/api/src/routes/messages.ts` L372-382（delivery mode IIFE）
- `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts` L674-685（hasMentions 返回）
- `packages/web/src/components/ChatInput.tsx` L88-91（whisperTargetsAllIdle）
- `packages/api/test/messages-f108b-whisper-dispatch.test.js`（7 tests）

Review-Target-ID: f108
Branch: feat/f108-phase-b

## 自检证据

### Spec 合规

Quality Gate PASS — 7/7 AC 覆盖（B1/B4/B7 本 PR，B2/B3/B5/B6 F122B 前序）。
设计稿 5 Scene 逐一对照通过。

### 测试结果

```
node --test messages*.test.js agent-router*.test.js  → 136/136 pass, 0 failed ✅
vitest chat-input-b10-whisper-active.test.ts          → 6/6 pass ✅
pnpm check                                            → 0 errors ✅
pnpm lint                                              → 0 errors ✅
pnpm -r --if-present run build                         → exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F108-side-dispatch-concurrent-invocation.md`
- Plan: `docs/plans/2026-03-15-f122b-f108b-unified-dispatch.md`
- ADR: `docs/decisions/018-f122-oq-unified-dispatch-decisions.md`
- Design: `designs/F108-side-dispatch-phase-b-ux.pen`
