# Bug Report: pending-mentions 无 ack 机制导致跨 session 重复处理

## 报告人
- **发现者**: 铲屎官 + 布偶猫（宪宪）
- **场景**: 布偶猫 session #1 被 Claude Code auto-compact 压缩后，恢复的 session #2 调用 `get_pending_mentions` 看到所有历史 mentions，误以为未处理，开始重复干活

## 复现步骤

### 期望行为
Session #2（无论是 compact 恢复还是 F24 新 session）调用 `get_pending_mentions` 时，只看到 **session #1 结束后新到达的 mentions**，不看到已处理的旧消息。

### 实际行为
`get_pending_mentions` 返回该 thread 内**所有** @提及当前猫的消息（最近 20 条），不区分是否已被前任 session 处理过。导致：
1. 新 session 看到大量旧 mentions → 误判为待办 → 重复执行已完成的任务
2. 浪费猫粮（Opus 额度）
3. 铲屎官需要人工介入纠正

### 复现条件
1. 在 thread T 中，铲屎官和其他猫多次 @布偶猫
2. 布偶猫 session #1 处理完所有 mentions
3. Session #1 触发 auto-compact（或 F24 seal → 新 session）
4. Session #2 启动，调用 `get_pending_mentions`
5. → 返回的是跟 session #1 一模一样的 mentions 列表

## 根因分析

### 定位过程

1. **查看 MCP 入口**: `packages/mcp-server/src/tools/callback-tools.ts:114` — `handleGetPendingMentions()` 直接 GET `/api/callbacks/pending-mentions`
2. **查看 API 路由**: `packages/api/src/routes/callbacks.ts:119` — 调用 `messageStore.getMentionsFor(catId, 20, userId, threadId)`
3. **查看存储层**:
   - 内存: `MessageStore.ts:148` — 遍历所有消息，按 `catId` + `userId` + `threadId` 过滤，无时间戳下界
   - Redis: `RedisMessageStore.ts:138` — `ZREVRANGE` 从 mentions sorted set 取，同样无时间戳下界
4. **确认无 ack 机制**: 没有 "已读标记" / "last_read_at" / "since" 参数

### 根因

`getMentionsFor()` 是**纯快照查询**，缺少「已处理」状态追踪。设计时假设同一只猫在同一 thread 内只有一个长期存活的 session，没有考虑到：
- Claude Code auto-compact 会压缩 context → 新的"逻辑 session"不知道前任处理了什么
- F24 session chain 会显式 seal → 新 session 需要区分前任的"遗产"和新到达的 mentions

## 修复方案

### 推荐方案: last-ack 水位线

**核心思路**: 每只猫在每个 thread 中维护一个 `lastAckTimestamp`（上次确认已读的时间戳）。`get_pending_mentions` 只返回 `timestamp > lastAckTimestamp` 的 mentions。

**具体设计**:

1. **新增 ack 存储**:
   - 内存: `Map<string, number>` key = `${catId}:${threadId}`
   - Redis: `cat-cafe:mention-ack:{catId}:{threadId}` → String (timestamp)

2. **修改 `get_pending_mentions`**:
   ```typescript
   // callbacks.ts
   const lastAck = await mentionAckStore.getLastAck(record.catId, record.threadId);
   const mentions = await messageStore.getMentionsFor(
     record.catId, 20, record.userId, record.threadId, lastAck // 新增 since 参数
   );
   ```

3. **新增 `ack_mentions` MCP 工具**（或自动 ack）:
   - Option A（显式 ack）: 猫猫处理完 mentions 后调用 `ack_mentions` 设置水位线
   - Option B（自动 ack）: `get_pending_mentions` 被调用时，自动把返回的最新消息时间戳设为 `lastAckTimestamp`
   - **推荐 Option B** — 减少猫猫认知负担，"读即已读"语义简单

4. **F24 session chain 集成**:
   - Session seal 时，当前 `lastAckTimestamp` 已经记录了处理进度
   - 新 session 启动后，`get_pending_mentions` 自然只返回 seal 后的新消息
   - 如果 seal 和新 session 之间没有新 @mention → 返回空 → 新 session 不会误操作

### 放弃方案

| 方案 | 放弃原因 |
|------|----------|
| **since_timestamp 参数（调用方控制）** | 调用方（猫猫/MCP client）需要自己记住上次读取时间，但 auto-compact 后 context 丢失了这个信息 |
| **invocation 级去重** | 每次 invocation 有 `clientMessageIds`，但这只去重 `post_message` 不去重 `get_mentions`；且跨 invocation 无效 |
| **全部 mentions 不改，靠 session summary** | 依赖 summary 质量，且 summary 可能丢失"哪些已处理"的精确信息 |

## 影响范围

- `packages/api/src/routes/callbacks.ts` — 新增 since 参数传递
- `packages/api/src/domains/cats/services/MessageStore.ts` — `getMentionsFor` 新增 `since` 参数
- `packages/api/src/domains/cats/services/RedisMessageStore.ts` — `ZRANGEBYSCORE` 替代 `ZREVRANGE`
- `packages/mcp-server/src/tools/callback-tools.ts` — 无需改（透传）
- 新增: `MentionAckStore` / `RedisMentionAckStore`（存储水位线）

## 验证方式

1. **Red→Green 测试**:
   - Session #1 调用 `get_pending_mentions` → 收到 N 条 → 自动 ack
   - Session #2 调用 `get_pending_mentions` → 收到 0 条（无新消息）
   - 新消息到达 → Session #2 调用 `get_pending_mentions` → 只收到新消息

2. **F24 session chain 场景**:
   - Session #1 seal 时 ack 水位线已设置
   - 新 session #2 启动，中间有新 @mention → 只看到新的
   - 新 session #2 启动，中间无新 @mention → 返回空

3. **边界情况**:
   - 同一毫秒的多条 mention → 全部返回（>= 改为 >）
   - 首次调用（无 ack 记录）→ 返回所有（向后兼容）
   - Thread 删除 → ack 记录随 thread 级联清理

## Open Questions

1. **自动 ack 的粒度**: Option B "读即已读"会不会导致猫猫还没处理就被 ack 了？（比如 get 了但 session 立刻崩溃）—— 风险低，因为 mentions 的消息本身不会被删除，只是下次不再返回"待处理"列表
2. **回溯能力**: 是否需要一个 `get_all_mentions`（忽略 ack）给调试/审计用？
3. **多猫共享 thread**: 每只猫独立 ack，互不影响 — 确认这个语义正确
