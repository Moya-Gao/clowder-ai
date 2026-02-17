# Bug Report: pending-mentions 跨线程泄漏

> 报告日期：2026-02-14 (情人节特别发现)
> 报告人：铲屎官 + 布偶猫
> 严重度：P2

## 报告人与发现经过

铲屎官在情人节聊天中让布偶猫 @缅因猫 聊天。A2A 调用失败后，布偶猫调用 `get_pending_mentions` 查看缅因猫是否回复。结果布偶猫引用了缅因猫在**其他线程**中说的工作相关的话，当作本线程的回复展示给铲屎官。铲屎官立刻发现："完蛋了你的 Thread 跟别的 Thread 串了吧？"

## 复现步骤

1. 在线程 A 中，铲屎官让布偶猫调用 `get_pending_mentions`
2. 接口返回所有线程中 @布偶猫 的消息（包括线程 B、C、D 等的历史消息）
3. 布偶猫无法区分哪些消息属于当前线程，将其他线程的消息当作当前对话上下文使用

**期望行为**：`get_pending_mentions` 应只返回当前线程中 @到该猫的消息

**实际行为**：返回全局所有线程中 @到该猫的消息，不区分 threadId

## 根因分析

### 定位过程

1. 查看 `packages/mcp-server/src/tools/callback-tools.ts:114-116`：
   ```typescript
   export async function handleGetPendingMentions(_input: Record<string, never>): Promise<ToolResult> {
     return callbackGet('/api/callbacks/pending-mentions');
   }
   ```
   MCP 工具端没有传递任何 threadId 参数。

2. 查看 `packages/api/src/routes/callbacks.ts:119-142`（API 端点）：
   ```typescript
   app.get('/api/callbacks/pending-mentions', async (request, reply) => {
     // ... auth 验证 ...
     const mentions = await messageStore.getMentionsFor(record.catId, 20, record.userId);
     // ...
   });
   ```
   **关键问题**：只传了 `catId` 和 `userId`，**没有传 `record.threadId`**。

3. 查看 `MessageStore.getMentionsFor` 签名：
   ```typescript
   getMentionsFor(catId: CatId, limit?: number, userId?: string): StoredMessage[]
   ```
   签名中根本没有 `threadId` 参数。

### 对比：`thread-context` 正确实现

同文件 `callbacks.ts:144-171` 的 `thread-context` 端点正确使用了 `record.threadId`：
```typescript
const messages = record.threadId
  ? await messageStore.getByThread(record.threadId, limit ?? 20, record.userId)
  : await messageStore.getRecent(limit ?? 20, record.userId);
```

### 根因

`getMentionsFor` 方法（内存版和 Redis 版）都没有 `threadId` 过滤能力。API 端点虽然能从 `record.threadId` 拿到当前线程 ID，但无法传给 store 层进行过滤。

## 修复方案

### 方案 A：给 `getMentionsFor` 增加 `threadId` 可选参数（推荐）

1. **`IMessageStore` 接口**：`getMentionsFor(catId, limit?, userId?, threadId?)` 增加可选 `threadId`
2. **内存 `MessageStore`**：遍历时增加 `msg.threadId === threadId` 过滤条件
3. **`RedisMessageStore`**：利用已有的 `thread:<threadId>:messages` sorted set 做交集过滤
4. **API 端点**：传入 `record.threadId`

### 方案 B：在 API 层做 post-filter

从 store 拿到全局 mentions 后，在路由层按 `threadId` 过滤。简单但不够高效。

**选择方案 A**：更干净，与 store 层其他方法（`getByThread`）风格一致。

### 放弃的方案

- 不考虑"前端/MCP 工具自己传 threadId"——threadId 已经在 invocation record 里，API 端点有权访问，不需要额外传参。

## 验证方式

1. 在两个不同线程中分别 @布偶猫
2. 在线程 A 中调用 `get_pending_mentions`
3. 确认只返回线程 A 中的 mention，不包含线程 B 的

## 影响范围

- MCP callback `get_pending_mentions` 工具
- 猫猫在多线程场景下的上下文感知准确性
- 不影响 `get_thread_context`（已正确实现 threadId 过滤）
- 不影响前端直接 API 调用（前端有独立的消息获取路径）
