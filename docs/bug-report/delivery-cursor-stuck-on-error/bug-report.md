---
feature_ids: []
debt_ids: [TD040]
topics: [delivery, cursor, stuck]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: 增量投递 cursor 在 error 时卡住，消息无限重复投递

**报告人**: 铲屎官（在砚砚的 session `019c8f5e-8ae8-7ac2-865a-9ddfbb39a361` 中观察到）
**发现方式**: 铲屎官打开砚砚的 session 详情，发现每轮都在重复回复之前的消息
**日期**: 2026-02-26

## 复现步骤

### 期望行为
- Round X: 猫收到 `[对话历史增量 - 未发送过 1 条]` + 消息 A
- Round X+1: 猫收到 `[对话历史增量 - 未发送过 1 条]` + 消息 B（新消息，A 已被 cursor 跳过）

### 实际行为
- Round X: 猫收到 `[对话历史增量 - 未发送过 1 条]` + 消息 A (`0001772089888532-000050-69188242`)
- Round X+1: 猫收到 `[对话历史增量 - 未发送过 2 条]` + 消息 A + 消息 B（A 再次出现！）
- Round X+2: 猫收到 `[对话历史增量 - 未发送过 3 条]` + 消息 A + B + C（持续累积）
- 结果：砚砚每轮都"疯狂回之前的消息"

## 根因分析

### 定位过程

1. 检查 `assembleIncrementalContext()` (`route-helpers.ts:216`) — cursor 读取和消息过滤逻辑正确
2. 检查 `DeliveryCursorStore.ackCursor()` — monotonic forward 写入逻辑正确
3. **找到 bug**: `route-serial.ts:489` 和 `route-parallel.ts:410` 的 cursor ack **被 `!hadError` 门控**

### 根因

`route-serial.ts:489`:
```typescript
if (incrementalMode && !hadError && deliveryBoundaryId) {
  options.cursorBoundaries.set(catId, deliveryBoundaryId);
}
```

`route-parallel.ts:410`:
```typescript
if (incrementalMode && !catHadError.has(msg.catId)) {
```

当猫的调用产生 `type: 'error'` 事件时（CLI 报错、token 限制、API 错误等），`hadError = true`，cursor ack 被跳过。但消息已经被组装进了 prompt 并发送给了猫——猫实际上**已经看到了这些消息**。

下一轮时，cursor 仍在旧位置，`assembleIncrementalContext()` 会再次返回相同的消息（加上新消息），导致：
1. 消息无限累积（1 条 → 2 条 → 3 条 → ...）
2. 猫不断回复已经处理过的旧消息，浪费 token
3. 上下文越来越长，最终可能触发更多错误，形成恶性循环

### 为什么原设计这样做

原意可能是：如果猫 error 了，不 ack cursor，这样用户重试时消息还在。但这个设计有两个问题：

1. **重试不走同一轮**：用户发新消息时，旧消息会和新消息一起重新投递，猫不知道哪些是旧的
2. **部分成功也被丢弃**：即使猫产生了 text + error（部分响应），cursor 也不 ack，导致下轮还是全量重投

## 修复方案

**移除 `!hadError` 门控**：只要 `deliveryBoundaryId` 存在（意味着消息已被组装并发送给猫），就 ack cursor。

理由：
- 消息已经在 prompt 中发送给了猫，cursor 应该前进
- 即使猫 error 了，重新发送旧消息也不会帮助修复 error
- 用户主动重试（invocations retry）有独立的 cursor 处理路径

### 放弃的方案

- **只在有 textContent 时 ack**：过于保守。即使猫没输出 text（纯 error），消息也已被投递
- **引入 "soft cursor" 区分"已投递"和"已处理"**：overengineering，当前场景不需要

## 验证方式

1. 写测试：模拟 `hadError = true` + `deliveryBoundaryId` 存在 → 验证 cursor 被 ack
2. 跑现有 124 测试确认无回归
3. 如果可能，复现铲屎官描述的场景
