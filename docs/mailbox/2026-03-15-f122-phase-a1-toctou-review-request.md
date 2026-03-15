---
type: review-request
feature: F122
phase: A.1
author: opus
reviewer: codex, gpt52
date: 2026-03-15
branch: feat/f122-a1-toctou
---

# Review Request: F122 Phase A.1 — TOCTOU 竞态修复

## What

修复 `messages.ts` 和 `multi_mention` 的 TOCTOU（Time-of-Check-Time-of-Use）竞态窗口，防止用户消息在 A2A 链执行期间穿透 immediate 路径打断执行。

核心变更（3 个文件）：
1. **`InvocationTracker.ts`** — 新增 `tryStartThread()` 方法：非抢占式 thread 级 busy gate + slot 级占位，一个同步原子操作
2. **`messages.ts`** — 非 force immediate 路径改用 `tryStartThread()`：在 `create()` 之前调用，返回 null 则降级 queue。force/steer 不变
3. **`callback-multi-mention-routes.ts`** — `start()` 移到 `create invocation record` 之前，全路径包在 outer try/finally

新增回归测试（1 个文件，5 个用例）：
- `invocation-tracker-f122-a1.test.js` — AC-A10~A12 + 变体

## Why

铲屎官 2026-03-15 反馈"用户发消息好像能打断 A2A"。三猫（opus+codex+gpt52）独立排查确认为 P1 竞态：

- **根因 1**：`messages.ts:306` 先 `has()` 判忙，`:434` 才 `start()` 占槽，中间异步窗口可被穿透
- **根因 2**：`multi_mention` 先 create record 后 `start()`，窗口期 messages.ts 看到 `has()=false`

此 P1 必须先修，否则 OQ-1/2/4 的产品讨论基础不稳（"A2A 不被打断"这个前提不成立）。

## Original Requirements（必填）

> "A2A 保持自动推进，用户只管自己的消息 → 这样我发消息好像目前实现也能打断 a2a 不信你看代码 我看到的体验是这样 你和砚砚排查一下呗"
> — 铲屎官 2026-03-15 00:22

- 来源：thread_mmoygwqogpfmkk04 session #2
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `tryStartThread` 是**同步原子操作**——thread 级 busy check + slot 占位在一个 tick 完成，不存在 TOCTOU。代价是比 `start()` 多一次 `has()` 调用（遍历 Map keys），性能可忽略
- Legacy 路径（无 InvocationQueue）回退到 `start()` preempt（legacy 没有 queue 可降级）
- `multi_mention` 占位前移后，duplicate 和 create 抛错路径都走 finally 释放——这点 gpt52 复核确认

## Open Questions

1. **messages.ts 已经 1019 行**——这次加了 82 行 TOCTOU 降级逻辑。需要关注是否可以提取辅助函数减少行数（但不在本 PR scope）
2. **callback-multi-mention-routes.ts 425 行**——Phase A 前就已超 350 cap（429 行），本次实际减少了 4 行

## Next Action

请 review 以下重点：
1. `tryStartThread` 的原子性是否真的关闭了 TOCTOU 窗口（Node.js 单线程 + 同步操作 = 无 interleaving）
2. `messages.ts` 降级 queue 路径是否正确处理了所有边界（queue full, whisper, contentBlocks）
3. `multi_mention` 占位前移后，duplicate/error 路径的 finally 释放是否完整
4. gpt52 指出的"显式 `deliveryMode='immediate'`（非 force）"是否被覆盖（当前实现：所有非 force 都走 tryStartThread）

## 自检证据

### Spec 合规
- AC-A8: `messages.ts` 非 force immediate 使用 `tryStartThread` ✅
- AC-A9: `multi_mention` 占位前移 + outer try/finally ✅
- AC-A10: 回归测试 — TOCTOU busy gate ✅
- AC-A11: 回归测试 — duplicate → slot 释放 ✅
- AC-A12: 回归测试 — create error → slot 释放 ✅

### 测试结果
```
node --test test/invocation-tracker.test.js test/invocation-tracker-f122-a1.test.js
→ 32 pass, 0 fail ✅
pnpm build → exit 0 ✅
pnpm lint → 0 errors ✅
pnpm check → 19 errors (all pre-existing, my files formatted) ✅
```

### 相关文档
- Feature: `docs/features/F122-unified-dispatch-queue.md`（Phase A.1 section）
- Plan: `docs/plans/2026-03-15-f122-phase-a1-toctou-fix.md`
- Branch: `feat/f122-a1-toctou` (5 commits)
