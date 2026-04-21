---
title: "F148 Speaker Display Bug Fix Review Request"
date: 2026-04-21
author: opus
type: review-request
---

# Review Request: F148 Speaker Display Bug Fix

Review-Target-ID: f148-speaker-display
Branch: feat/f148-speaker-display

## What
Two display bugs in F148 hierarchical context transport:
1. `formatAnchors` omitted speaker name — anchor labels showed `[Thread opener: msg-id]` with no attribution
2. `extractBatonContext` leaked internal `userId` (e.g. `default-user`) to `fromSpeakerDisplay` instead of human-readable name

Fix: export `getSenderName` from `ContextAssembler.ts` as single truth source, reuse in both `context-transport.ts` and `navigation-context.ts`.

## Why
GPT-5.4 identified both bugs during review of PR #1312. Without speaker attribution, anchors lose who-said-what context. The `default-user` leak exposes internal IDs in the navigation header shown to cats.

## Original Requirements
> 砚砚（GPT-5.4）review 发现：
> "这两个我判定都是真 bug：anchor 缺 speaker attribution，baton 泄漏 default-user 内部 ID。建议直接修。"
> "别直接在 routing 里再手写一份 default-user -> 铲屎官 逻辑... 把它抽成一个小的共享 helper"
- 来源：thread 对话，铲屎官确认 "是的 砚砚说的没错，但是他的球应该传给你，你开始修吧！"
- **请对照上面的诊断判断修复是否完整解决了两个 bug**

## Tradeoff
直接复用 `ContextAssembler.getSenderName` 而非新建 helper——routing/ 已有从 context/ 的导入路径，无循环依赖风险。

## Open Questions
1. `formatAnchors` 新格式 `[Thread opener @铲屎官: msg-id]` 中 `@` 前缀是否合适？（区分 speaker attribution vs. mention）
2. `getSenderName(null)` 返回 `'铲屎官'` 是否适用所有 `fromSpeakerDisplay` 场景？

## Next Action
请确认两个 bug 均已修复，代码路径无遗漏。

## 自检证据

### Spec 合规
- Bug 1: `formatAnchors` 输出现包含 speaker name ✅
- Bug 2: `fromSpeakerDisplay` 用户消息返回 `'铲屎官'`、猫消息返回 display name ✅
- 单一真相源: 两处均使用 `getSenderName` ✅

### 测试结果
- `pnpm test` → 9124 tests, 9123 pass, 0 fail, 1 skipped (pre-existing) ✅
- `pnpm lint` → 0 errors ✅
- `pnpm check` → 0 errors ✅
- `pnpm build` → exit 0 ✅

### 相关文档
- Feature: F148 Hierarchical Context Transport
- Commit: 4134a6d33
