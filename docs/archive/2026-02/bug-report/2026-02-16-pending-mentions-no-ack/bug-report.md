---
feature_ids: []
topics: [pending, mentions, ack]
doc_kind: bug-report
created: 2026-02-16
---

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

> **v3.3 — 根据缅因猫 R1~R6 review 修订（2026-02-16）**
> R1 发现：3 个问题（2 P1 + 1 P2），全部接受。
> R2 发现：3 个问题（2 P1 + 1 P2），全部接受。
> R3 发现：2 个 P2（归属校验补 userId + key 命名统一），全部接受。
> R4 发现：1 P1（分页+ack 顺序契约）+ 1 P2（超限分页回归用例），全部接受。
> R5 P1（ack 窗口硬校验）：布偶猫 push back → R6 缅因猫驳回（证据：`get_thread_context` 可拿到窗口外 ID）→ 接受。
> 采用缅因猫推荐的**无状态重算窗口**方案。本版收口。

### 推荐方案: messageId 游标 + 显式 ack + mention-ack 专用命名空间

**核心思路**: 每只猫在每个 thread 中维护一个 `lastAckMessageId`（上次确认已处理的消息 ID）。`get_pending_mentions` 返回该 messageId 之后**最旧的 N 条**（升序）。猫猫处理完成后显式调用 `ack_mentions` 推进游标到该批次末尾。

**R1 修订要点**:
- ~~timestamp 水位线~~ → **messageId 游标**（R1 P1-2：同毫秒多条 mention 漏读风险）
- ~~自动 ack（读即已读）~~ → **显式 ack**（R1 P1-1：get 后崩溃 → 待办不会丢失）
- ~~新建 MentionAckStore~~ → **扩展 DeliveryCursorStore**（R1 P2：复用单调游标语义 + 补 userId 维度）

**R2 修订要点**:
- ~~直接复用 DeliveryCursorStore key 空间~~ → **新增 mention-ack 专用方法 + 键命名空间**（R2 P1-1：防止和 delivery cursor 混用）
- 新增 **ack 归属校验 + 单调校验**（R2 P1-2：防止 ack 到不相关消息导致静默漏处理）
- 新增 **游标缺失退化路径**（R2 P2：afterMessageId 因 TTL/硬删不在 zset 时的处理策略）

**R4 修订要点**:
- 新增 **分页顺序契约**：`get_pending_mentions` 必须返回 afterCursor 之后**最旧的 N 条（升序）**，不是最新的（R4 P1：降序返回会导致 ack 跳过最老的未读）
- 新增 **ack 窗口硬校验**（R5/R6 升级为服务端强制）：`ack_mentions` 时服务端无状态重算当前 pending 窗口，`upToMessageId` 必须落在该窗口内，否则 400
- 新增 **超限分页回归用例**（R4 P2：25 条 mention / limit=20 的两轮 get+ack 测试）

**具体设计**:

#### 1. 扩展 DeliveryCursorStore — mention-ack 专用命名空间

复用 `DeliveryCursorStore` 的**单调游标语义和内存/Redis 双实现**，但新增 mention-ack 专用方法，避免和现有 delivery cursor 冲突：

```typescript
// DeliveryCursorStore 新增方法
async getMentionAckCursor(userId: string, catId: CatId, threadId: string): Promise<string | undefined> {
  // Redis key: mention-ack:{userId}:{catId}:{threadId}
  // 内存 key: mention-ack:{userId}:{catId}:{threadId}
}

async ackMentionCursor(userId: string, catId: CatId, threadId: string, messageId: string): Promise<void> {
  // 单调推进（messageId <= current → noop）
}
```

**Redis 键设计**:
- delivery cursor: `cat-cafe:delivery-cursor:{userId}:{catId}:{threadId}` （现有，不动）
- mention ack: `cat-cafe:mention-ack:{userId}:{catId}:{threadId}` （新增，独立命名空间）

#### 2. 修改 `get_pending_mentions`

```typescript
// callbacks.ts
const lastAckId = await deliveryCursorStore.getMentionAckCursor(
  record.userId, record.catId, record.threadId
);
// 返回 afterMessageId 之后最旧的 N 条（升序）— R4 P1 契约
const mentions = await messageStore.getMentionsFor(
  record.catId, 20, record.userId, record.threadId, lastAckId // afterMessageId, 升序
);
// mentions[0] = 最老未读, mentions[N-1] = 本批次最新
// 如果 mentions.length === limit，说明还有更多未读，猫猫需再次调用
```

#### 3. 新增 `ack_mentions` MCP 工具（显式 ack + 归属校验）

```typescript
cat_cafe_ack_mentions({ upToMessageId: "msg_xxx" })
```

**ack 校验规则（R2 P1-2 修复）**:
1. **存在性校验**: `upToMessageId` 必须在 messageStore 中存在 → 否则 400
2. **归属校验**: 该消息必须满足 `message.userId === record.userId` && `message.threadId === record.threadId` && `message.mentions.includes(record.catId)` → 否则 400（"messageId does not belong to current cat's mention set"）
3. **单调校验**: `upToMessageId > currentAckCursor` → 否则 noop（幂等，不报错）
4. **窗口校验（R5/R6 P1，无状态重算）**: 服务端基于 `currentAckCursor` 重算一页 pending mentions（limit=20，升序），`upToMessageId` 必须 ≤ 该窗口最后一条 ID → 否则 400（"upToMessageId exceeds current pending window, ack only within fetched batch"）

**行为**:
- 猫猫 `get_pending_mentions` → 处理返回的 N 条 → `ack_mentions({ upToMessageId: mentions[N-1].id })`
- 如果 `mentions.length === limit`（还有更多未读），猫猫需再次调用 `get_pending_mentions` 获取下一批
- 如果 get 后崩溃（未 ack）→ 下次 get 还能看到同样的 mentions → **不丢待办**
- ack 是幂等的：重复 ack 同一个 messageId 无副作用
- **ack 窗口硬校验**（R5/R6 P1）：服务端在 ack 时基于当前 cursor 重算 pending 窗口，`upToMessageId` 超出窗口则 400 拒绝。不持久化窗口状态，每次现算。这样即使猫猫通过 `get_thread_context` 拿到窗口外 messageId，也无法跳过未处理的 mentions

#### 4. Redis 游标缺失退化路径（R2 P2 修复）

当 `afterMessageId` 因 TTL 过期或硬删不在 mention sorted set 中时：

**策略: 回退到全量 pending + 日志告警**

```typescript
// getMentionsFor 内部
if (afterMessageId) {
  const rank = await redis.zrank(mentionKey, afterMessageId);
  if (rank === null) {
    // 游标指向的消息已过期/删除 → 回退到全量（无 after 过滤）
    // 日志告警：mention-ack cursor stale, falling back to full scan
    console.warn(`[MentionAck] cursor ${afterMessageId} not in mention set, falling back to full pending`);
    afterMessageId = undefined; // 清除过滤条件
  }
}
```

**为什么选这个策略**:
- **安全优先**: 宁可重复处理（回退到全量），也不丢待办
- **自愈**: 猫猫处理完后重新 ack，游标更新为有效的 messageId
- **可观测**: 日志告警让铲屎官知道发生了退化
- 放弃"按 timestamp 回退扫描"：增加实现复杂度，且 timestamp 回退同样有同毫秒精度问题

#### 5. F24 session chain 集成

- Session seal 时，ack 游标已经记录了处理进度
- 新 session 启动后，`get_pending_mentions` 自然只返回 ack 之后的新消息
- 如果 seal 和新 session 之间没有新 @mention → 返回空 → 新 session 不会误操作
- Session #1 和 #2 绑定同一 thread → 共享同一个 ack 游标 → 语义一致

### 放弃方案

| 方案 | 放弃原因 |
|------|----------|
| **自动 ack（读即已读）** | R1 P1-1：get 后崩溃会导致待办丢失，把"重复处理"问题变成更危险的"漏处理"问题 |
| **timestamp 水位线** | R1 P1-2：同毫秒多条 mention 会漏读。消息 ID 本身是可排序游标（timestamp+seq），应直接用 |
| **新建 MentionAckStore** | R1 P2：DeliveryCursorStore 已有单调游标语义，应扩展而非重建 |
| **直接复用 DeliveryCursorStore key 空间** | R2 P1-1：现有 `getCursor/ackCursor` key 固定为 `delivery-cursor:*`，混用会污染消息传输语义 |
| **游标缺失时按 timestamp 回退扫描** | R2 P2 备选：增加实现复杂度且有同毫秒精度问题，不如直接回退全量 + 告警 |
| **降序返回（最新 N 条）** | R4 P1：ack 到最新一条会跳过最老的未读，在高峰期（>limit 条未读）造成静默漏处理 |
| **ack 窗口仅文档约束（不做服务端校验）** | R5/R6：`get_thread_context` 可返回窗口外 messageId，仅靠文档约束无法防止静默漏处理。布偶猫 push back 被驳回 |
| **持久化 lastWindowUpperBound** | 状态爆炸 + 每次 get 都要写。无状态重算窗口更简洁 |
| **since_timestamp 参数（调用方控制）** | 调用方需自己记住时间，auto-compact 后 context 丢失 |
| **invocation 级去重** | `clientMessageIds` 只去重 `post_message`，跨 invocation 无效 |
| **靠 session summary** | 依赖 summary 质量，可能丢失精确的"已处理"信息 |

## 影响范围

- `packages/api/src/routes/callbacks.ts` — 新增 afterMessageId 参数传递 + 新增 ack 端点
- `packages/api/src/domains/cats/services/MessageStore.ts` — `getMentionsFor` 新增 `afterMessageId` 参数
- `packages/api/src/domains/cats/services/RedisMessageStore.ts` — 利用 sorted set rank 做游标过滤 + 退化路径
- `packages/api/src/domains/cats/services/DeliveryCursorStore.ts` — 新增 `getMentionAckCursor` / `ackMentionCursor` 方法 + `mention-ack:*` 键命名空间
- `packages/shared/src/utils/redis.ts` — 新增 `mention-ack` key pattern（如需 SessionStore 接口扩展）
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

4. **ack 归属校验（R2 P1-2 回归）**:
   - ack 到不属于当前猫 mention set 的 messageId → 400 拒绝
   - ack 到其他 thread 的 messageId → 400 拒绝
   - ack 到不存在的 messageId → 400 拒绝
   - ack 到已 ack 过的 messageId → noop（幂等）

5. **游标缺失退化（R2 P2 回归）**:
   - afterMessageId 因 TTL 过期不在 zset → 回退全量 + 日志告警
   - 猫猫重新处理后 ack → 游标恢复正常

6. **ack 窗口硬校验（R5/R6 P1 回归）**:
   - 有 25 条未读 mentions（limit=20）
   - get 返回最旧的 20 条 → 猫猫通过 `get_thread_context` 拿到第 25 条的 messageId
   - ack 到第 25 条 → **400 拒绝**（"exceeds current pending window"）
   - ack 到第 20 条 → 成功
   - 再次 get → 返回第 21-25 条

7. **超限分页回归（R4 P1 + P2 回归）**:
   - 发送 25 条 @mention（limit=20）
   - 第一轮 get → 返回最旧的 20 条（升序），`mentions.length === 20`
   - ack 到第 20 条 → 游标推进
   - 第二轮 get → 返回剩余 5 条（升序）
   - ack 到第 25 条 → 游标推进
   - 第三轮 get → 返回 0 条
   - **断言**: 两轮共收到 25 条，无重复、无丢失、顺序正确

8. **F24 session chain 场景**:
   - Session #1 处理完 mentions + ack → seal
   - 新 session #2 启动，中间有新 @mention → 只看到新的
   - 新 session #2 启动，中间无新 @mention → 返回空

9. **级联清理**:
   - Thread 删除 → mention-ack 游标随 thread 级联清理
   - `deleteByThreadForUser` 同时清理 delivery cursor + mention-ack cursor

## Open Questions (已收敛)

1. ~~**自动 ack 的粒度**~~ → 已决定：显式 ack，不自动（R1 P1-1）
2. **回溯能力**: 是否需要一个 `get_all_mentions`（忽略 ack）给调试/审计用？→ 建议有，低优先级
3. **多猫共享 thread**: 每只猫独立 ack 游标（key 含 catId + userId），互不影响 ✅
4. **ack 触发时机**: 猫猫处理完一轮 mentions 后整批 ack（ack 到最后一条） ✅
