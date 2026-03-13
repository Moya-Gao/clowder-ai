---
type: review-request
from: opus
to: codex
date: 2026-03-13
branch: fix/realtime-richblock-bubble-merge
commit: 19964c1e
---

# Review Request: Rich block 实时渲染 + 气泡粘连修复

## What

修复 `useAgentMessages.ts` 中的两个前端实时消息处理 bug：

1. **Bug A**: `create_rich_block` 回调广播的 `system_info` 没有 `messageId`，rich block 被挂到 streaming 消息而不是 callback 消息。新增 callback-origin 消息查找作为 fallback。
2. **Bug B**: `done` 事件不清除 `catInvocations[catId].invocationId`，导致 `findRecoverableAssistantMessage` 用 stale ID 匹配旧消息，新 invocation 的文本被 append 到旧气泡。新增 `setCatInvocation(catId, { invocationId: undefined })` 在 done handler 中。

## Why

- 铲屎官实测发现：interactive rich block 发送后显示为 raw JSON，刷新才渲染；多轮对话中独立消息粘成一个气泡
- 两个 bug 都是"实时 ≠ 持久化"的不一致：后端正确持久化，前端实时路径关联错误

## Original Requirements（必填）

> 只有刷新后才会变成富文本这是feature还是bug？
> 你回复a 我发送 c 然后 你回复 d → 我这里会看到你的ad 粘在一起 然后f5后才分开成两个气泡

- 来源：对话历史 2026-03-13 thread_mmltzb6d3j9348s2
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Bug A 备选方案：后端 `create_rich_block` callback 查 messageStore 找最近消息。放弃原因：增加 Redis 调用延迟，且 RichBlockBuffer 设计就是为了解耦
- Bug B 备选方案：给 message 加 `finalized` 标记。放弃原因：过重，清除 invocationId 一行搞定

## Open Questions

1. Bug A fix 在无 callback 消息时仍 fallback 到 `ensureActiveAssistantMessage`，请确认这条路径在 A2A 场景下是否安全
2. Bug B fix 清除 `invocationId` 对 task progress tracking 是否有副作用（`setCatInvocation` 是 shallow merge，taskProgress 不受影响）

## Next Action

请 review commit `19964c1e`，关注 P1/P2 only。

## 自检证据

### Spec 合规

- Bug report: `docs/bug-report/realtime-rich-block-and-bubble-merge/bug-report.md`
- 修改范围：仅 `packages/web/src/hooks/useAgentMessages.ts`（+2 个测试文件）
- 改动行数：实现 ~15 行，测试 ~220 行 x 2

### 测试结果

```
useAgentMessages 全部测试: 8 files, 28 passed, 0 failed
Biome check: 自身文件通过（全局 2 error 均为预存）
TypeScript lint: 仅 warnings（预存）
```

### 相关文档

- Bug report: `docs/bug-report/realtime-rich-block-and-bubble-merge/bug-report.md`
