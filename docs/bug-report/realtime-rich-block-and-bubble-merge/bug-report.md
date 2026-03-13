---
title: "Rich block 实时渲染失败 + Callback 消息气泡粘连"
reporter: 铲屎官 + 布偶猫（自测发现）
date: 2026-03-13
severity: P2
status: confirmed
---

# Bug Report: Rich Block 实时渲染失败 + Callback 消息气泡粘连

## 1. 报告人

铲屎官在布偶猫发送 4 种 interactive rich block 测试时发现：
- Bug A：rich block 显示为原始 JSON，刷新后才渲染成富文本组件
- Bug B：两条独立的 callback 消息（中间夹着用户消息）粘在一个气泡里，刷新后才分开

## 2. 复现步骤

### Bug A: Rich block 实时渲染失败

1. 猫调用 `cat_cafe_post_message`（文字消息）
2. 猫调用 `cat_cafe_create_rich_block`（交互 block）
3. **期望**：文字消息下方立即渲染 interactive block 组件
4. **实际**：文字消息下方显示 raw JSON `{"type":"rich_block","block":{...}}`
5. **刷新后**：正确渲染为 interactive 组件

### Bug B: Callback 消息气泡粘连

1. 猫回复消息 A（callback origin）
2. 用户发送消息 C
3. 猫回复消息 D（callback origin）
4. **期望**：A 和 D 是两个独立气泡，中间隔着用户的 C
5. **实际**：A 和 D 粘在一个气泡里
6. **刷新后**：正确分成两个独立气泡

## 3. 根因分析

### Bug A 根因

**数据流追踪**：

```
Backend: create_rich_block callback
  → callbacks.ts:899 broadcastAgentMessage({ type: 'system_info', content: JSON.stringify({ type: 'rich_block', block }) })
  → ❌ 没有 messageId（对比 post_message 路径 callbacks.ts:391 有 messageId: storedMsg.id）

Frontend: useAgentMessages.ts:528-546
  → parsed.messageId === undefined（没带）
  → fallback: ensureActiveAssistantMessage(msg.catId)
  → 找到当前正在流式输出的 streaming 消息（布偶猫自己的响应）
  → appendRichBlock 把 block 挂到了 streaming 消息而不是 callback 消息
```

**对比工作路径**（post_message 内嵌 block）：
- `callbacks.ts:391`：`{ type: 'rich_block', block, messageId: storedMsg.id }`
- 前端通过 `messageId` 精确找到目标消息 → block 正确挂载

**刷新后正确的原因**：`RichBlockBuffer` 在 route-serial 持久化阶段通过 `consume()` 正确关联 block 到 StoredMessage，API 返回时 `extra.rich.blocks` 数据正确。

### Bug B 根因

**数据流追踪**：

```
消息 A (callback) 到达 → useAgentMessages.ts:259-274 → addMessage() 创建独立气泡
  → ❌ 不在 activeRefs 中追踪（callback origin 不设 activeRefs）

用户消息 C 到达 → 正常

消息 D (callback) 到达 → 如果此时有 streaming 消息，ensureActiveAssistantMessage 可能
  把 D 的内容 append 到现有 streaming 消息或恢复 A 的引用
```

**待精确确认**：Bug B 的确切触发路径需要在 worktree 中加诊断桩进一步确认。初步判断与 `findRecoverableAssistantMessage` 的 invocationId 匹配逻辑有关。

## 4. 修复方案

### Bug A 修复（确定）

**文件**：`packages/web/src/hooks/useAgentMessages.ts`，rich_block handler（~line 528）

在 `messageId` 查找失败后、`ensureActiveAssistantMessage` fallback 之前，加一层：查找该 cat 最近的 `callback` origin 消息作为目标。

```typescript
// 现有：messageId 精确匹配
// 新增：无 messageId 时，优先找最近的 callback 消息
// 保留：最终 fallback 到 ensureActiveAssistantMessage
```

**放弃的备选**：后端 create_rich_block 查 messageStore 找最近消息 → 增加 Redis 调用延迟，且 buffer 设计就是为了解耦。

### Bug B 修复（需进一步确认）

初步方向：callback origin 消息到达时的 bubble 分离逻辑需要加强。可能需要在 callback text handler 中确保每条 callback 消息都创建独立气泡，不复用 activeRefs。

## 5. 验证方式

- 写测试：模拟 post_message → create_rich_block 的 socket 事件序列，验证 block 挂载到 callback 消息
- 写测试：模拟 callback A → user C → callback D 序列，验证 A 和 D 是独立消息
- 手动验证：发送 interactive rich block，不刷新即可看到渲染组件
- 手动验证：多轮对话中 callback 消息不粘连
