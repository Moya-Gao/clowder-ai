---
date: 2026-03-16
type: review-request
feature: F121
author: opus
reviewer: codex
status: pending
---

# Review Request: F121 auto-fill replyTo for A2A-triggered invocations

## What
在 `callbacks.ts` 的 `post_message` handler 中，当猫没有显式传 `replyTo` 时，系统自动从 `InvocationRecordStore.userMessageId` 回溯触发消息 ID 填充 replyTo。

变更范围：
- `packages/api/src/routes/callbacks.ts` — 15 行改动（auto-fill 逻辑）
- `packages/api/test/auto-reply-to.test.js` — 新测试文件，4 个用例

## Why
之前 replyTo 需要猫主动传参数，但系统已经知道触发消息（`InvocationRecordStore.userMessageId`），让猫自己传 ID "太挫了"（铲屎官原话）。这导致 A2A mention 回复没有 ReplyPill threading 效果，多渠道渲染不统一。

## Original Requirements（必填）
> 但是，其实我理解，大家想要的是，无论你是怎么样传，是at还是post message有传apply to的参数，都应该有展示？不然的话，好像多个渠道的渲染的逻辑就不统一了。而且我发现你还要这个MCP，你还要让人家主动的传apply to的具体的invocation，这也太挫了吧？难道你的系统自己不能知道这只猫猫在是被什么东西给at的吗？

- 来源：铲屎官语音消息 2026-03-16 00:23（alpha 测试环境实测反馈）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- **方案 A（采纳）**：callback handler 里通过 `record.parentInvocationId → InvocationRecordStore.get() → userMessageId` 回溯。每次 post_message 多一次 InvocationRecordStore 查询（仅在无显式 replyTo 且有 parentInvocationId 时触发）。
- **方案 B（放弃）**：在 `InvocationRegistry`（内存）新增 `userMessageId` 字段，从 `invokeSingleCat` 一路穿透。改动面大（4+ 文件），且需要改动 InvocationParams 接口。

选择 A 的理由：改动最小（1 文件 15 行），查询开销可忽略（内存 Map），且 `invocationRecordStore` 已在 opts 中可用。

## Open Questions
1. **多消息场景**：猫在一次 A2A 触发中发多条 post_message，每条都会 auto-fill 同一个 replyTo。视觉上是否合理？（我认为合理——整个 invocation 都是对 trigger 的响应）
2. **cross-thread warn 静默**：auto-fill 失败（如跨 thread）不打 warn log，只有显式 replyTo 失败才 warn。这个降级策略是否合适？

## Next Action
请 review 代码 + 测试覆盖，关注以上两个 open questions。

## 自检证据

### Spec 合规
- 铲屎官需求：系统自动知道猫被什么 @ 的 → 已实现
- 显式 replyTo 优先 → 有测试覆盖
- 直接用户消息不受影响 → 有测试覆盖
- 跨 thread 安全 → 有测试覆盖

### 测试结果
```
node --test test/auto-reply-to.test.js    # 4 passed, 0 failed
node --test test/reply-to-threading.test.js test/callback-routes.test.js test/callback-a2a-postmsg.test.js
                                           # 98 passed, 0 failed
pnpm --filter @cat-cafe/api lint          # tsc --noEmit 通过
```

### 相关文档
- Feature: F121 (replyTo threading)
- Branch: `feat/auto-replyto`
