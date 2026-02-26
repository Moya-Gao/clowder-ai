---
feature_ids: []
topics: [connector, messages, phase3]
doc_kind: plan
created: 2026-02-25
---

# Connector Messages — Email Watcher Phase 3

> 记录日期：2026-02-25
> 状态：设计中，待铲屎官确认
> 来源：铲屎官指示 "把我们这套做完整" + "为未来外部信息源做抽象"
> 前置：BACKLOG #81 Phase 1+2 已合入 (e50f99c)

---

## 目标

让 Email Watcher 发出的 review 通知：
1. 在前端以**专属气泡**展示（区别于用户/猫/系统消息）
2. 通过**抽象 connector 模型**支持未来信息源（iMessage、Slack 等）
3. 自动**唤起对应猫**处理 review（闭环）
4. 重启后**不丢注册数据**（Redis 持久化）

---

## 设计方案

### 1. 消息模型扩展：`source` 字段

**Backend `StoredMessage`** — 新增可选 `source` 字段：

```typescript
// packages/api/src/domains/cats/services/stores/ports/MessageStore.ts
export interface ConnectorSource {
  /** Connector identifier (stable key for routing/styling) */
  connector: string;          // 'github-review' | 'imessage' | 'slack' | ...
  /** Human-readable display name */
  label: string;              // 'GitHub Review' | 'iMessage'
  /** Emoji or icon URL for avatar */
  icon: string;               // '🔔' | '💬'
  /** Link to original source (e.g., PR URL) */
  url?: string;
  /** Connector-specific metadata */
  meta?: Record<string, unknown>;
}

export interface StoredMessage {
  // ... existing fields ...
  /** External connector source. Present = connector message (not user/cat) */
  source?: ConnectorSource;
}
```

**判定规则**（优先级）：
| `catId` | `source` | 消息类型 |
|---------|----------|----------|
| `CatId` | — | 猫猫消息 (assistant) |
| `null` | `undefined` | 用户消息 (user) |
| `null` | `{ connector }` | Connector 消息 (connector) |

### 2. Frontend `ChatMessage` 扩展

```typescript
// packages/web/src/stores/chat-types.ts
export interface ChatMessage {
  // ... existing fields ...
  type: 'user' | 'assistant' | 'system' | 'summary' | 'connector';  // 新增 'connector'
  /** External connector source info (only when type='connector') */
  source?: {
    connector: string;
    label: string;
    icon: string;
    url?: string;
  };
}
```

### 3. Frontend Connector 气泡

**视觉设计**：
- **位置**：左侧对齐（类似猫消息）
- **头像**：来源 icon（如 🔔 GitHub Review）而非猫头像
- **气泡色**：独立色系（蓝灰色调，区别于猫的品种色）
- **标签**：顶部显示 `source.label`（如 "GitHub Review"）
- **可选链接**：如果有 `source.url`，标签可点击跳转
- **圆角**：统一 `rounded-2xl rounded-bl-sm`

```
┌─ Connector 气泡 ─────────────────┐
│ 🔔 GitHub Review                  │  ← source.label + icon
│                                    │
│ **GitHub Review 通知** 🔔          │
│ PR #76: feat(skills): dashboard   │
│ Review 类型: 💬 Commented          │
│ 请处理 review 意见。               │
└────────────────────────────────────┘
```

### 4. Connector Registry（抽象层）

```typescript
// packages/shared/src/connectors.ts
export interface ConnectorDefinition {
  id: string;             // 'github-review'
  displayName: string;    // 'GitHub Review'
  icon: string;           // '🔔'
  color: {
    primary: string;      // '#2563EB' (蓝)
    secondary: string;    // '#EFF6FF' (浅蓝)
  };
  description: string;
}

export const connectorRegistry = new Map<string, ConnectorDefinition>([
  ['github-review', {
    id: 'github-review',
    displayName: 'GitHub Review',
    icon: '🔔',
    color: { primary: '#2563EB', secondary: '#EFF6FF' },
    description: 'GitHub PR review 邮件通知',
  }],
]);
```

将来加 iMessage、Slack 等只需往 registry 加一条。

### 5. ReviewRouter 改造

```typescript
// ReviewRouter.postReviewMessage 改为使用 source 字段
await messageStore.append({
  threadId,
  userId,              // 保留 userId 用于权限
  catId: null,          // 不是猫发的
  content,
  source: {             // 新增！
    connector: 'github-review',
    label: 'GitHub Review',
    icon: '🔔',
    url: `https://github.com/${event.repository}/pull/${event.prNumber}`,
  },
  mentions: [catId],
  timestamp: Date.now(),
});
```

### 6. 自动唤起猫（闭环）

ReviewRouter 发完消息后，需要触发猫的 invoke 才能闭环。

**方案**：在 `github-review-bootstrap.ts` 中，ReviewRouter.route() 返回 `routed` 结果后，
通过内部 HTTP 调用 `POST /api/messages` 发一条触发消息（模拟"铲屎官"说"请处理 review"），
利用现有的 `@mention → AgentRouter.routeSerial()` 机制自动唤起猫。

```typescript
// github-review-bootstrap.ts
watcher.onReviewAck(async (event) => {
  const result = await router.route(event);
  if (result.kind === 'routed') {
    // 触发猫的 invoke：发一条系统消息到对应 thread
    await triggerCatInvoke(result.threadId, result.catId, event);
  }
});
```

**`triggerCatInvoke`** 的实现选项：
- **A) 内部 HTTP call**：`POST /api/messages` with `@catId` mention → 走正常 SSE 流
- **B) 直接调 AgentRouter**：注入 AgentRouter 依赖，直接 `routeSerial()`
- **C) 事件总线**：emit `invoke-request` event，让路由层监听

**推荐 B**：直接注入最简单，避免 HTTP 回环。但需要确保 invoke 不阻塞 watcher 循环。

---

## 实施分 Phase

### Phase 3a: Connector 气泡（前端可见）
1. Shared: `ConnectorSource` 类型 + `connectorRegistry`
2. Backend: `StoredMessage.source` 字段 + mapper
3. Frontend: `ChatMessage.type = 'connector'` + 新气泡组件
4. ReviewRouter: 使用 `source` 字段发消息
5. 测试: 消息序列化/反序列化 + 前端渲染

### Phase 3b: 自动唤起（闭环）
1. Bootstrap: route 成功后调 AgentRouter
2. AgentRouter: 支持 connector 触发的 invoke
3. 前端: connector 消息后自动显示猫的 streaming 状态
4. 测试: 端到端 review → invoke 流程

### Phase 3c: 持久化
1. Redis: PrTrackingStore + ProcessedEmailStore 的 Redis impl
2. 测试: Redis 隔离测试

---

## 不做什么（边界）

- ❌ 不做 WebSocket push（现有 SSE 机制足够）
- ❌ 不做 IMAP IDLE（QQ 邮箱支持待验证，轮询够用）
- ❌ 不做 iMessage connector（等有网关再说，但抽象层为它留位）
- ❌ 不做前端 PR tracking 管理 UI（API 够用）

---

## 风险

| 风险 | 缓解 |
|------|------|
| 自动 invoke 可能在铲屎官不在时消耗额度 | 可加"仅在铲屎官在线时 invoke"开关 |
| Connector 消息和系统消息混淆 | 视觉差异化 + 不同 `type` |
| Redis 迁移改变 store 行为 | 内存 impl 保留做 fallback |
