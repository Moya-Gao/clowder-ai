---
feature_ids: [F081]
topics: [bubble, duplicate, rendering, hydration]
doc_kind: review-request
created: 2026-03-08
reviewer: opus
author: gpt52
---

# Review Request: F081 残余瞬时重复气泡

## What

这轮修了两条会把同一条消息短暂显示成“双影”的剩余裂缝：

1. 前台 `useAgentMessages` 在 `activeRefs` 丢失时，`tool_use / tool_result / web_search / thinking / rich_block` 不再直接新起 placeholder，而是先认领 store 里现存的 streaming bubble。
2. `GET /api/messages` 现在会保留 persisted assistant stream 的 `extra.stream.invocationId`，不再把前端 reconcile 需要的对位键丢掉。

## Why

铲屎官现场症状是：有时前端会短暂看到两条自己的消息或两条同样的 assistant 回复，但 `F5` 后又只剩一条。  
这说明服务器真相源通常没重复，剩余问题更像：

- 前端 placeholder 身份断层
- persisted history contract 丢失 `stream.invocationId`

## Original Requirements

> 我发现哦砚砚侦探 不知道是不是你f81修改之后 然后有的时候我会发现 我在前端出现了我的两条消息！或者你两次同样的回复！但是f5之后又变成一条了，这是为什么？
>
> 我同意！大侦探出击！你看看！

- 来源：[2026-03-08-f081-residual-duplicate-bubbles/README.md](/Users/lysander/projects/relay-station/cat-cafe-f081-residual-duplicate-bubbles/docs/discussions/2026-03-08-f081-residual-duplicate-bubbles/README.md)
- 请对照上面的摘录判断这轮交付是否真打到了“前端短暂双影，F5 后只剩一条”的根因

## Tradeoff

- 我没有顺手扩成“内容级全局 dedup”，只补这轮已经坐实的身份裂缝。
- 用户 optimistic duplicate 分支 (`POST /api/messages` duplicate 回包不带 `userMessageId`) 我先没有一起做，因为这轮现场更像 assistant / persisted-history 对位问题，避免一次塞太多根因。

## Open Questions

1. `ensureActiveAssistantMessage()` 统一覆盖这五类前台占位（tool_use / tool_result / web_search / thinking / rich_block）是否够窄够稳？
2. `GET /api/messages` 回传 `extra.stream` 这层 contract，是否还有你担心的兼容性风险？
3. 你是否认为用户 optimistic duplicate 分支也该当轮一起补，还是留待新的现场证据再动？

## Next Action

请帮我 review 这条分支；如果没有 P1/P2，我就继续走 merge-gate。

## 自检证据

### Spec 合规

- 这是 `F081` 范围内的残余 bugfix，不新开 feature
- bug report 已补：[f081-transient-duplicate-bubbles/bug-report.md](/Users/lysander/projects/relay-station/cat-cafe-f081-residual-duplicate-bubbles/docs/bug-report/f081-transient-duplicate-bubbles/bug-report.md)
- spec 已补新证据：[F081-bubble-continuity-observability.md](/Users/lysander/projects/relay-station/cat-cafe-f081-residual-duplicate-bubbles/docs/features/F081-bubble-continuity-observability.md)

### 测试结果

```bash
pnpm lint
# 通过；只有现有 warning

pnpm --filter @cat-cafe/web test -- \
  src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts \
  src/hooks/__tests__/useAgentMessages-invocation-created.test.ts \
  src/hooks/__tests__/useAgentMessages-thinking-metadata.test.ts \
  src/hooks/__tests__/useChatHistory-replace-hydration.test.ts \
  src/hooks/__tests__/useSendMessage-thread-source.test.ts \
  src/stores/__tests__/chatStore-multithread.test.ts
# 55 passed, 0 failed

pnpm --filter @cat-cafe/api run build && node --test packages/api/test/messages-endpoint.test.js
# 21 passed, 0 failed

pnpm --filter @cat-cafe/web build
# 成功
```

### 相关文档

- Feature: [F081-bubble-continuity-observability.md](/Users/lysander/projects/relay-station/cat-cafe-f081-residual-duplicate-bubbles/docs/features/F081-bubble-continuity-observability.md)
- Discussion: [2026-03-08-f081-residual-duplicate-bubbles/README.md](/Users/lysander/projects/relay-station/cat-cafe-f081-residual-duplicate-bubbles/docs/discussions/2026-03-08-f081-residual-duplicate-bubbles/README.md)
- Bug Report: [f081-transient-duplicate-bubbles/bug-report.md](/Users/lysander/projects/relay-station/cat-cafe-f081-residual-duplicate-bubbles/docs/bug-report/f081-transient-duplicate-bubbles/bug-report.md)
