---
feature_ids: []
related_features: [F080, F081]
topics: [draft, keepalive, TTL, invocation, refresh, recovery, hotfix]
doc_kind: plan
created: 2026-03-14
community_issue: "https://github.com/zts212653/clowder-ai/issues/83"
---

# Issue #83 — 长时间工具调用刷新丢失：Draft Keepalive + Invocation Recovery

> 日期：2026-03-14
> 来源：社区 Issue [zts212653/clowder-ai#83](https://github.com/zts212653/clowder-ai/issues/83)
> 定位：布偶猫 + 缅因猫联合
> 性质：Bug hotfix（非新 Feature），关联 F080/F081 残留场景

---

## 1. 现象

猫猫正在执行长时间工具调用时（如代码执行、大规模文件搜索等），页面刷新后：

1. 右侧/输入区的"正在处理"状态消失
2. 聊天区进行中的工具调用气泡（streaming draft bubble）消失
3. 后端可能仍在执行，但 UI 看起来像"这只猫已经不在处理了"

**特别容易触发于**：长时间、低输出、tool-first 或 tool-only 的调用。

---

## 2. 证据

### 证据 A: Draft TTL 硬编码 300s

| 文件 | 行 | 值 |
|------|----|----|
| `DraftStore.ts` | L44 | `DEFAULT_DRAFT_TTL_MS = 300_000` |
| `RedisDraftStore.ts` | L16 | `DEFAULT_TTL = 300` |

### 证据 B: Draft 保活只在收到 stream event 时触发

`route-serial.ts:365-418` 的 draft flush 逻辑：

```
收到 text event → upsert（含 2s 间隔 + 2000 char delta 门控）
收到 tool_use/tool_result → touch 或 upsert（含 2s 间隔门控）
工具执行中（无事件） → 无任何 touch/upsert
```

**关键缺口**：`tool_use` 发出后到 `tool_result` 返回之间，如果超过 300s 没有新事件，draft 自然过期。`touch()` 方法本身会重置 TTL（`RedisDraftStore.ts:73`），但**没有独立的定时器驱动它被调用**。

`route-parallel.ts:376-404` 有完全相同的问题。

### 证据 C: `/queue` endpoint 不暴露 active invocation 状态

`queue.ts:92-96`:
```typescript
return {
  queue: invocationQueue.list(threadId, guard.userId),
  paused: queueProcessor.isPaused(threadId),
  pauseReason: queueProcessor.getPauseReason(threadId),
};
```

只有 queue/paused/pauseReason，**没有 active invocation 信息**。

但 `InvocationTracker` 已经有 `getActiveSlots(threadId)` 方法（`InvocationTracker.ts:144-153`），返回当前 thread 所有活跃 catId 列表。**数据源已存在，只是没暴露。**

### 证据 D: 前端恢复依赖 draft → draft 断 → 链路全断

`useChatHistory.ts` 用 `isDraft: true` 恢复 streaming 状态。Draft 过期 = 刷新后无进行中消息可恢复 = UI 不知道有猫在处理。

---

## 3. 根因

### 根因 A: Draft keepalive 只靠 stream event（事件驱动 vs 时间驱动）

F080 设计时假设"`tool_use/tool_result` 事件足够频繁来续 TTL"（见 `2026-02-20-f80-streaming-draft-persistence.md`）。

这个假设在以下场景失效：
- CLI 工具执行时间 > 5 分钟（常见于大仓 grep、长时间编译、复杂测试）
- tool-only invocation 产出极少 text event
- provider 侧长时间思考（thinking）后才开始输出

**本质**：事件驱动保活 vs 时间驱动保活的设计选择。当前只有事件驱动，缺少时间驱动兜底。

### 根因 B: 刷新后没有 active invocation 的独立恢复源

前端依赖两条链路：
1. Draft merge（`GET /api/messages` 合并 drafts）→ 被根因 A 打断
2. WebSocket 实时事件 → 刷新后重连，但没有 snapshot 补发机制

缺一个**独立于 draft 的 active invocation 查询**，让前端在刷新后立刻知道"哪些猫正在处理"。

---

## 4. 诊断策略

当用户报告"刷新后丢失进行中消息"时，诊断顺序：

1. **确认 invocation 是否仍在运行** — 查 `InvocationTracker.has(threadId)` / 后端日志
2. **确认 draft 是否仍存在** — 查 Redis `draft:{userId}:{threadId}:*` 的 TTL
3. **确认前端是否收到 draft** — `GET /api/messages` 响应中是否包含 `isDraft: true` 条目
4. **确认 `/queue` 响应** — 是否包含 active invocation 信息（修复后）

---

## 5. 修复设计

### 刀一：独立于 stream event 的 Draft Keepalive

**方案**：在 `route-serial.ts` 和 `route-parallel.ts` 的 streaming 循环中，启动一个**独立的 `setInterval` 定时器**，每 60s 调用一次 `draftStore.touch()`。

```
进入 streaming 循环 → 启动 keepalive timer (60s interval)
每次 timer 触发 → draftStore.touch(userId, threadId, invocationId)
streaming 结束 → clearInterval + draftStore.delete（现有逻辑不变）
```

**为什么是 60s**：TTL 是 300s，60s 续命给了 5 次机会（容忍 4 次失败），同时不会对 Redis 造成过高写压力。

**改动范围**：
- `route-serial.ts` — streaming for-await 循环外层加 `setInterval` + `clearInterval`
- `route-parallel.ts` — 同上

**不改**：
- Draft TTL 本身不改（300s 已经足够，问题不在 TTL 长度而在续命机制）
- `RedisDraftStore.touch()` 不改（它已经正确重置 TTL）

### 刀二：`/queue` endpoint 暴露 Active Invocation Snapshot

**方案**：在 `GET /api/threads/:threadId/queue` 响应中增加 `activeInvocations` 字段。

```typescript
return {
  queue: invocationQueue.list(threadId, guard.userId),
  paused: queueProcessor.isPaused(threadId),
  pauseReason: queueProcessor.getPauseReason(threadId),
  // 新增：当前正在执行的猫列表
  activeInvocations: invocationTracker.getActiveSlots(threadId),
};
```

**前端消费**：`useChatHistory.ts` 在刷新恢复时读取 `activeInvocations`，如果非空则恢复 processing 状态。

**改动范围**：
- `queue.ts` — 响应体加字段（1 行）
- `useChatHistory.ts` — 读取新字段，恢复 `hasActiveInvocation` 状态

---

## 6. 预警策略

**修复后的观测手段**：

1. **Draft TTL 到期但 invocation 仍存活** — 这在修复后不应该发生。如果发生了，说明 keepalive timer 未生效或被提前清理。可在 `RedisDraftStore.touch()` 加一条 debug 日志确认。
2. **刷新后 activeInvocations 返回空但实际有猫在跑** — 检查 `InvocationTracker` 是否因为 AbortController 提前触发而清理了 slot。

---

## 7. 前端恢复设计

刷新后恢复链路（修复后）：

```
F5 → 前端重建
  → GET /api/messages（含 draft merge，修复后 draft 不再过期）
  → GET /api/threads/:threadId/queue（含 activeInvocations）
  → 如果 activeInvocations 非空：
      → 恢复 hasActiveInvocation = true
      → 恢复 catStatuses 为 processing
  → 如果有 isDraft messages：
      → 恢复 streaming bubble（现有逻辑）
  → WebSocket 重连后继续接收实时事件
```

**双保险**：即使 draft 因极端情况过期，`activeInvocations` 仍能告诉前端"有猫在跑"，至少恢复 processing 状态指示器。

---

## 8. 验收与回归测试

### 必须通过的测试

| 编号 | 场景 | 预期 |
|------|------|------|
| T1 | 工具调用持续 > 300s（超过 draft TTL），期间无 text output | Draft 不过期，刷新后 bubble 恢复 |
| T2 | Tool-first invocation（只有 tool events，无 text），刷新 | Draft 存在，bubble 恢复 |
| T3 | 活跃 invocation 中刷新，检查 `/queue` 响应 | `activeInvocations` 包含正在处理的 catId |
| T4 | Invocation 完成后，检查 `/queue` 响应 | `activeInvocations` 为空 |
| T5 | 多猫并行处理时刷新 | 所有活跃猫都在 `activeInvocations` 中 |
| T6 | Keepalive timer 在 streaming 结束后被清理 | 无泄漏的 setInterval |

### 不改动的边界

- Draft 正常创建/删除流程不变
- 短时间工具调用（< 300s）行为不变
- Queue 其他字段（paused/pauseReason）不变
- 现有 draft merge 逻辑不变

---

## 签名

定位：布偶猫-opus4.6 + 缅因猫-gpt5.4
设计：布偶猫-opus4.6
