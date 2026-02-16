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

> **v2 — 根据缅因猫 R1 review 修订（2026-02-16）**
> R1 发现：3 个问题（2 P1 + 1 P2），全部接受并修正。

### 推荐方案: messageId 游标 + 显式 ack

**核心思路**: 每只猫在每个 thread 中维护一个 `lastAckMessageId`（上次确认已处理的消息 ID）。`get_pending_mentions` 只返回该 messageId 之后的 mentions。猫猫处理完成后显式调用 `ack_mentions` 推进游标。

**R1 修订要点**:
- ~~timestamp 水位线~~ → **messageId 游标**（修复 P1-2：同毫秒多条 mention 漏读风险）
- ~~自动 ack（读即已读）~~ → **显式 ack**（修复 P1-1：get 后崩溃 → 待办不会丢失）
- ~~新建 MentionAckStore~~ → **复用 DeliveryCursorStore**（修复 P2：避免重复造轮子 + 补 userId 维度）

**具体设计**:

1. **复用 DeliveryCursorStore 存储 ack 游标**:
   - key: `${userId}:${catId}:${threadId}:mention-ack` → messageId (string)
   - 复用已有的单调游标语义和 Redis/内存双实现
   - userId 维度确保多租户安全

2. **修改 `get_pending_mentions`**:
   ```typescript
   // callbacks.ts
   const lastAckId = await deliveryCursorStore.get(
     `${record.userId}:${record.catId}:${record.threadId}:mention-ack`
   );
   const mentions = await messageStore.getMentionsFor(
     record.catId, 20, record.userId, record.threadId, lastAckId // 新增 afterMessageId 参数
   );
   ```

3. **新增 `ack_mentions` MCP 工具（显式 ack）**:
   ```typescript
   // 猫猫处理完 mentions 后调用
   cat_cafe_ack_mentions({ upToMessageId: "msg_xxx" })
   // → deliveryCursorStore.set(key, upToMessageId)
   ```
   - 猫猫 get mentions → 处理 → ack 到最后一条已处理的 messageId
   - 如果 get 后崩溃（未 ack）→ 下次 get 还能看到同样的 mentions → **不丢待办**
   - ack 是幂等的：重复 ack 同一个 messageId 无副作用

4. **F24 session chain 集成**:
   - Session seal 时，ack 游标已经记录了处理进度
   - 新 session 启动后，`get_pending_mentions` 自然只返回 ack 之后的新消息
   - 如果 seal 和新 session 之间没有新 @mention → 返回空 → 新 session 不会误操作
   - Session #1 和 #2 绑定同一 thread → 共享同一个 ack 游标 → 语义一致

### 放弃方案

| 方案 | 放弃原因 |
|------|----------|
| **自动 ack（读即已读）** | 缅因猫 R1 P1-1：get 后崩溃会导致待办丢失，把"重复处理"问题变成更危险的"漏处理"问题 |
| **timestamp 水位线** | 缅因猫 R1 P1-2：同毫秒多条 mention 会漏读。消息 ID 本身是可排序游标（timestamp+seq），应直接用 |
| **新建 MentionAckStore** | 缅因猫 R1 P2：DeliveryCursorStore 已有单调游标语义 + Redis/内存双实现，重复造轮子 |
| **since_timestamp 参数（调用方控制）** | 调用方（猫猫/MCP client）需要自己记住上次读取时间，但 auto-compact 后 context 丢失了这个信息 |
| **invocation 级去重** | 每次 invocation 有 `clientMessageIds`，但这只去重 `post_message` 不去重 `get_mentions`；且跨 invocation 无效 |
| **全部 mentions 不改，靠 session summary** | 依赖 summary 质量，且 summary 可能丢失"哪些已处理"的精确信息 |

## 影响范围

- `packages/api/src/routes/callbacks.ts` — 新增 afterMessageId 参数传递 + 新增 ack 端点
- `packages/api/src/domains/cats/services/MessageStore.ts` — `getMentionsFor` 新增 `afterMessageId` 参数
- `packages/api/src/domains/cats/services/RedisMessageStore.ts` — 利用 sorted set rank 做游标过滤
- `packages/api/src/domains/cats/services/DeliveryCursorStore.ts` — 复用现有，key 命名约定扩展
- `packages/mcp-server/src/tools/callback-tools.ts` — 新增 `ack_mentions` 工具注册
- MCP tool schema — 新增 `cat_cafe_ack_mentions` 定义

## 验证方式

1. **Red→Green 测试**:
   - Session #1 调用 `get_pending_mentions` → 收到 N 条
   - Session #1 调用 `ack_mentions({ upToMessageId: lastMsg.id })` → 游标推进
   - Session #2 调用 `get_pending_mentions` → 收到 0 条（无新消息）
   - 新消息到达 → Session #2 调用 `get_pending_mentions` → 只收到新消息

2. **崩溃恢复场景（R1 P1-1 回归）**:
   - Session #1 调用 `get_pending_mentions` → 收到 N 条 → **不 ack，模拟崩溃**
   - Session #2 调用 `get_pending_mentions` → 仍然收到同样的 N 条 → **待办不丢失**

3. **同毫秒多条 mention（R1 P1-2 回归）**:
   - 同一毫秒发送 3 条 @mention → get 返回 3 条
   - ack 到第 2 条 → 下次 get 只返回第 3 条

4. **F24 session chain 场景**:
   - Session #1 处理完 mentions + ack → seal
   - 新 session #2 启动，中间有新 @mention → 只看到新的
   - 新 session #2 启动，中间无新 @mention → 返回空

5. **边界情况**:
   - 首次调用（无 ack 记录）→ 返回所有（向后兼容）
   - Thread 删除 → ack 游标随 thread 级联清理
   - ack 到不存在的 messageId → 拒绝（400）

## Open Questions (已收敛)

1. ~~**自动 ack 的粒度**~~ → 已决定：显式 ack，不自动（R1 P1-1）
2. **回溯能力**: 是否需要一个 `get_all_mentions`（忽略 ack）给调试/审计用？→ 建议有，低优先级
3. **多猫共享 thread**: 每只猫独立 ack 游标（key 含 catId），互不影响 ✅
4. **ack 触发时机**: 猫猫处理完一轮 mentions 后整批 ack（ack 到最后一条），还是逐条？→ 建议整批，减少调用次数
