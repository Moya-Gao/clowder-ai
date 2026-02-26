---
feature_ids: [F080]
topics: [streaming, draft, persistence]
doc_kind: plan
created: 2026-02-20
---

# #80 流式草稿持久化（Streaming Draft Persistence）

> 作者：布偶猫 | 日期：2026-02-20
> 状态：R1 修复完成，等 R2
> R1 review: 2026-02-20 缅因猫 — 阻塞（2×P1）→ 已修复

## 问题

猫猫 streaming 期间消息只存在前端内存（WebSocket 推送）。以下场景消息丢失：

1. **F5 刷新**：前端从 Redis 拉历史，streaming 消息未落盘 → 消失
2. **浏览器崩溃/关闭**：同上
3. **铲屎官原始复现**：猫猫 streaming → 切 thread → 切回 → F5 → 消息没了 → 猫完成后恢复

根因：`route-serial.ts:224` 累积 `textContent += msg.content`，仅在流结束后调 `messageStore.append()`（L274）一次性写入。

## 方案：后端 Draft 周期落盘

### 核心设计

```
streaming 中:
  CLI → route-serial for-await 循环
    → textContent += msg.content (L224)
    → 每 2s 或 2000 chars → draftStore.upsert(userId, threadId, invocationId, partialContent)
    → 非 text 消息（tool_use/tool_result）也 touch TTL 续期（防长工具调用过期）
    → WebSocket 广播 (不变)

streaming 结束:
  → messageStore.append(fullContent, { invocationId }) (L274, 新增 invocationId 持久化)
  → draftStore.delete(userId, threadId, invocationId)

前端 GET /api/messages:
  → Redis 正式消息 (不变)
  → + draftStore.getByThread(userId, threadId) → 仅首屏（无 before cursor）合并
  → 后端去重：按 invocationId 过滤已有正式消息对应的 draft
```

### Redis 数据结构

```
# Draft hash — 一个 invocation 一条 draft（带 userId 隔离）
cat-cafe:draft:{userId}:{threadId}:{invocationId}
  catId:      "opus"
  content:    "部分内容..."
  toolEvents: "[...]"  (JSON 序列化)
  updatedAt:  1771659000000
  TTL:        300s (5 分钟自动过期，防止僵尸 draft)

# Draft 索引 — 按 user+thread 查找活跃 draft
cat-cafe:draft:idx:{userId}:{threadId}  →  Set { invocationId1, invocationId2, ... }
  TTL: 300s
```

**为什么 key 带 userId**（R1 P1-1 修复）：现有 `GET /api/messages` 按 userId 过滤（`messages.ts:458`），draft 必须保持相同的隔离粒度。否则用户 A 能看到用户 B 的 streaming draft。虽然当前是单用户（铲屎官），但架构上不能留这个洞。

**为什么用 invocationId 不用 catId**：并行模式下同一 thread 可以有多只猫同时 streaming。invocationId 唯一标识一次调用。

**为什么 5 分钟 TTL**：正常调用 < 3 分钟完成（有 budget 超时兜底）。5 分钟足够覆盖最长调用，又不会让僵尸 draft 永久占空间。猫正常完成会显式 delete；异常退出靠 TTL 自然淘汰。

**TTL 续期机制**：每次 flush 时 `EXPIRE` 重置 TTL。非 text 消息（tool_use/tool_result 等）也触发 `EXPIRE` 续期（不写 content，只续 TTL），防止长工具调用（如 Read 大文件）期间 draft 过期。

### 文件改动清单

#### 1. 新增：`DraftStore` 接口 + Redis 实现

**文件**：`packages/api/src/domains/cats/services/stores/ports/DraftStore.ts`

```typescript
export interface DraftRecord {
  userId: string;         // R1 P1-1: 隔离维度
  threadId: string;
  invocationId: string;
  catId: string;
  content: string;
  toolEvents?: unknown[];
  updatedAt: number;
}

export interface IDraftStore {
  /** 写入/更新 draft（upsert 语义），同时重置 TTL */
  upsert(draft: DraftRecord): Promise<void>;
  /** 仅续期 TTL，不更新 content（工具调用期间保活） */
  touch(userId: string, threadId: string, invocationId: string): Promise<void>;
  /** 按 user+thread 查询活跃 draft */
  getByThread(userId: string, threadId: string): Promise<DraftRecord[]>;
  /** 删除单条 draft */
  delete(userId: string, threadId: string, invocationId: string): Promise<void>;
  /** 删除 thread 下所有 draft（thread 删除时调用） */
  deleteByThread(userId: string, threadId: string): Promise<void>;
}
```

**文件**：`packages/api/src/domains/cats/services/stores/redis/RedisDraftStore.ts`

- `upsert()`: pipeline: `HSET` draft hash + `SADD` index + `EXPIRE` 两个 key 300s
- `touch()`: pipeline: `EXPIRE` draft hash 300s + `EXPIRE` index 300s（不写 content）
- `getByThread(userId, threadId)`: `SMEMBERS` index → 批量 `HGETALL` draft hashes → 过滤 stale（hash 已过期但 index 残留）
- `delete(userId, threadId, invocationId)`: `DEL` draft hash + `SREM` index
- `deleteByThread(userId, threadId)`: `SMEMBERS` → 批量 `DEL` + `DEL` index

#### 2. 修改：`route-serial.ts` — 循环内加 draft 落盘

**位置**：L201-226 的 `for await` 循环内

```typescript
// 新增：draft flush 逻辑（fire-and-forget，不阻塞热路径）
let lastFlushTime = Date.now();
let lastFlushLen = 0;
const FLUSH_INTERVAL_MS = 2000;
const FLUSH_CHAR_DELTA = 2000;

for await (const msg of invokeSingleCat(...)) {
  // ... existing accumulation (L224-226) ...
  if (msg.type === 'text' && msg.content) {
    textContent += msg.content;
  }

  const now = Date.now();

  // Draft content flush (fire-and-forget: .catch(noop) 不 await)
  const charDelta = textContent.length - lastFlushLen;
  if (charDelta > 0 && (now - lastFlushTime >= FLUSH_INTERVAL_MS || charDelta >= FLUSH_CHAR_DELTA)) {
    deps.draftStore.upsert({
      userId, threadId, invocationId, catId,
      content: textContent,
      toolEvents: collectedToolEvents.length > 0 ? collectedToolEvents : undefined,
      updatedAt: now,
    }).catch(noop);  // P2: fire-and-forget，不阻塞 streaming 热路径
    lastFlushTime = now;
    lastFlushLen = textContent.length;
  }
  // TTL touch for non-text events (tool_use/tool_result): 防长工具调用期间 draft 过期
  else if (msg.type === 'tool_use' || msg.type === 'tool_result') {
    if (now - lastFlushTime >= FLUSH_INTERVAL_MS) {
      deps.draftStore.touch(userId, threadId, invocationId).catch(noop);
      lastFlushTime = now;
    }
  }

  // ... existing broadcast logic ...
}

// 流结束后：正式 append（含 invocationId）+ 清除 draft
await deps.messageStore.append({
  ...,
  extra: { ...(existing extra), stream: { invocationId } },  // P1-2: 持久化 invocationId
});
await deps.draftStore.delete(userId, threadId, invocationId);
```

**flush 频率**：每 2 秒 或 每 2000 字符，取先到者。避免高频写 Redis，同时保证合理的恢复粒度。

**fire-and-forget**（R1 P2 修复）：`upsert().catch(noop)` 不 await，不阻塞 streaming 热路径。最坏情况：一次 flush 丢失，2 秒后下次 flush 会覆盖全量 content。对用户体验无影响。

#### 3. 修改：`route-parallel.ts` — 同样加 draft 落盘

对称修改。parallel 模式下每只猫独立 streaming，各自维护 draft。

#### 4. 修改：GET `/api/messages` route — 合并活跃 draft

**位置**：`packages/api/src/routes/messages.ts` L457-517

```typescript
// 现有逻辑不变：从 messageStore 拉正式消息
const messages = await opts.messageStore.getByThread(...);

// 新增：仅首屏（无 before cursor）时查活跃 draft
if (!query.before) {
  const drafts = await opts.draftStore.getByThread(userId, resolvedThreadId);

  // P1-2 去重：收集正式消息中已有的 invocationId，过滤对应 draft
  const formalInvocationIds = new Set(
    chatItems
      .map(m => m.extra?.stream?.invocationId)
      .filter(Boolean)
  );
  const activeDrafts = drafts.filter(d => !formalInvocationIds.has(d.invocationId));

  // P2：按 updatedAt 排序，保证多猫并行时顺序稳定
  activeDrafts.sort((a, b) => a.updatedAt - b.updatedAt);

  const draftItems: TimelineItem[] = activeDrafts.map(d => ({
    id: `draft-${d.invocationId}`,
    type: 'assistant' as const,
    catId: d.catId,
    content: d.content,
    timestamp: d.updatedAt,
    isDraft: true,  // 前端用来显示 streaming 指示器
    toolEvents: d.toolEvents ?? [],
  }));

  chatItems.push(...draftItems);
}

return {
  messages: chatItems,
  hasMore,
};
```

**为什么只在首屏合并**（R1 P2 修复）：分页请求（带 `before` cursor）拉的是历史消息，streaming draft 只存在于"当前时刻"，追加到分页结果末尾会打乱时间线。首屏请求（无 cursor）天然对应"最新消息 + 活跃 draft"的语义。

**invocationId 去重**（R1 P1-2 修复）：流结束后 `messageStore.append()` 和 `draftStore.delete()` 之间有极短窗口，GET 可能同时拿到正式消息和对应 draft。通过 `extra.stream.invocationId` 匹配过滤，保证不重复。

#### 5. 修改：前端 `useChatHistory.ts` — 处理 draft 消息

```typescript
// 识别 isDraft 标记的消息，添加 streaming 视觉效果
const historyMsgs = (data.messages ?? []).map(m => ({
  ...mapToChatMessage(m),
  isStreaming: m.isDraft === true,  // 恢复 streaming 动画
}));
```

#### 6. 清理路径

| 场景 | Draft 清理方式 | 集成位置 |
|------|---------------|----------|
| 猫正常完成 | `draftStore.delete()` 显式清除 | `route-serial.ts` L274 后 / `route-parallel.ts` 对应位置 |
| 猫超时/错误 | `draftStore.delete()` 在 error handler 中清除 | `route-serial.ts` catch block |
| 进程崩溃 | TTL 300s 自动过期 | 无需代码（Redis 机制） |
| Thread 删除 | `draftStore.deleteByThread(userId, threadId)` | `routes/threads.ts` DELETE handler（R1 P2 修复：随 thread 一起清理） |
| 取消调用 | `draftStore.delete()` 在 cancel handler 中清除 | `InvocationTracker.cancel()` 回调 |

### 不做什么（Scope 约束）

1. **不做前端本地缓存**：不用 localStorage/IndexedDB，只靠后端 Redis
2. **不做增量 diff**：每次 flush 写全量 content，简单可靠（draft 通常 < 50KB）
3. **不做实时 WebSocket draft 推送**：刷新后从 GET /api/messages 恢复，不额外加 WebSocket 事件
4. **不改 messageStore 接口**：draft 是独立 store，不污染正式消息时间线

### 测试计划

1. **DraftStore 单元测试**：upsert/get/delete/TTL/deleteByThread
2. **route-serial draft 集成**：mock draftStore，验证 flush 时机和 cleanup
3. **GET /api/messages draft 合并**：有 draft + 无 draft 场景
4. **端到端场景**：streaming 中 → 模拟 F5（重新 GET messages）→ 验证 draft 出现在响应中

### 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| Redis 写入延迟影响 streaming 性能 | 低 | flush 是 fire-and-forget（`.catch(noop)` 不 await），2s 间隔足够宽松 |
| Draft 和正式消息时间窗口重叠（最后一次 flush 和 append 之间） | 中 | GET 响应合并时，如果 draft.invocationId 对应的正式消息已存在，过滤掉 draft |
| 内存 DraftStore 在测试中的行为 | 低 | 提供 MemoryDraftStore 实现，和 Redis 版本接口一致 |

### 工作量估计

| 组件 | 估计 |
|------|------|
| DraftStore 接口 + Redis + Memory 实现 | 小（~150 行） |
| route-serial / route-parallel 插入 | 小（~30 行 × 2） |
| GET messages 合并 draft | 小（~20 行） |
| 前端 isDraft 处理 | 小（~10 行） |
| 清理路径（cancel/error/thread-delete） | 中（~50 行，需找到所有出口） |
| 测试 | 中（~200 行） |
| **总计** | ~500 行新增/修改 |

## Open Questions（R1 后已解决）

1. **flush 是否需要 await？** → **不 await**。fire-and-forget + `.catch(noop)`，下次 flush 写全量覆盖。最坏丢 2 秒内容，对用户无感。
2. **Draft/正式消息去重窗口** → **后端 GET 端去重**。按 `extra.stream.invocationId` 匹配，正式消息已有对应 invocationId 则过滤 draft。不靠前端（前端不知道 invocationId 对应关系）。
3. **并行模式排序** → **按 `updatedAt` 升序排**。多猫 draft 按最后更新时间排列，和 WebSocket 推送顺序一致。
4. **TTL 300s 是否合理？** → **合理**。当前 budget 超时上限约 3 分钟。TTL touch 机制保证长工具调用期间不过期（每次 tool_use/tool_result 续 TTL）。极端情况：猫用满 budget 也不会超 5 分钟。
