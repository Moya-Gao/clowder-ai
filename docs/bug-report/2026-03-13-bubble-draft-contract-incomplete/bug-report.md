---
feature_ids: [F080]
topics: [bubble, draft, hydration, thinking, tool_use, duplicate]
doc_kind: bug-report
created: 2026-03-13
---

# Bug Report: 气泡 Draft 契约不完整 — F5 后只剩 tool_use / thinking 丢失 / 重复气泡

## 1. 报告人

- 报告人：铲屎官（2026-03-13）
- 定位人：布偶猫（@opus）+ 缅因猫（@gpt52），两轮独立定位后收敛
- 发现方式：真实使用。发消息给猫，猫在处理但前端无实时显示；F5 后只有 tool_use 气泡（无 thinking、无文字）；且缅因猫的 tool_use 出现了两遍

## 2. 用户感知的三个症状

### 症状 A：实时流不到前端（不刷新什么都不出来）

**复现**：发消息 → 猫开始处理 → 前端无任何气泡更新

**期望**：tool_use / thinking / text 实时增量出现

### 症状 B：F5 后只剩 tool_use（无 thinking、无文字）

**复现**：猫在处理中 → F5 → 只看到 tool_use 气泡（wrench icon + 原始 JSON），无 thinking 折叠面板，无 CLI 文字输出

**期望**：F5 后应恢复到当前 invocation 的完整中间状态，包括 thinking 和已产出的文字

### 症状 C：同一 invocation 的 tool_use 打两遍

**复现**：两只猫都跑完后，缅因猫的 CLI Output 出现在两个独立气泡中（07:00 只有 tools，07:04 有 tools + 正文）

**期望**：同一 invocation 只产出一个气泡

## 3. 根因分析

**三个症状的核心根因是同一个：DraftStore schema 和 draft-to-frontend contract 不完整。**

### 3.1 Bug A — DraftRecord 缺 `thinking` 字段

`DraftRecord` 接口只存 `content` + `toolEvents`，不存 `thinking`：

```typescript
// packages/api/src/domains/cats/services/stores/ports/DraftStore.ts:15-23
export interface DraftRecord {
  userId: string;
  threadId: string;
  invocationId: string;
  catId: CatId;
  content: string;        // ✅
  toolEvents?: unknown[];  // ✅
  updatedAt: number;
  // ❌ thinking 字段缺失
}
```

后端 `route-serial.ts:293-294` 用 `thinkingContent` 变量累积 thinking 事件，但 draft flush（`route-serial.ts:374-384`）从未将其写入 draft：

```typescript
// route-serial.ts:374-384 — draft flush 只存 content + toolEvents
draftStore.upsert({
  content: textContent,
  ...(collectedToolEvents.length > 0 ? { toolEvents: collectedToolEvents } : {}),
  // ❌ thinkingContent 没存
});
```

此外，文本 draft flush 有 `2s / 2000 chars` 的节流门槛（`route-serial.ts:308-309`），而 tool_use 事件可以在节流周期外触发首次 flush（`route-serial.ts:390-392`）。这意味着 F5 时：
- `toolEvents` 几乎总是有的（tool_use 触发立即 flush）
- `content` 可能是空的（文字还没到节流门槛）
- `thinking` 一定是空的（从未进 draft）

### 3.2 Bug B — Draft 消息缺 stream identity，导致重复气泡

`/api/messages` 返回 draft 时不携带 `extra.stream.invocationId` 和 `origin`：

```typescript
// packages/api/src/routes/messages.ts:784-794
chatItems.push({
  id: `draft-${d.invocationId}`,
  type: 'assistant',
  catId: d.catId,
  content: d.content,
  timestamp: d.updatedAt,
  isDraft: true,
  ...(d.toolEvents ? { toolEvents: d.toolEvents } : {}),
  // ❌ 没有 extra: { stream: { invocationId: d.invocationId } }
  // ❌ 没有 origin: 'stream'
});
```

前端加载 draft 后只补了 `isStreaming: true`（`useChatHistory.ts:251`），没补 `origin` 和 `extra.stream`。

当 invocation 完成后：
1. `done` handler 将 draft 气泡的 `isStreaming` 设为 false，清空 `catInvocations[catId].invocationId`（`useAgentMessages.ts:362-369`）
2. 后端持久化最终消息（真实 ID，带 `extra.stream.invocationId`），删除 Redis draft
3. 下一次 hydration（thread 切换再回来等），API 返回最终消息
4. `mergeReplaceHydrationMessages` 尝试合并：
   - `getLocalPlaceholderInvocationId(draftMsg)` 检查 `extra.stream.invocationId`（**undefined**）→ 检查 `isStreaming`（**false**）→ 检查 `catInvocations`（**undefined**）→ 返回 **undefined**（`useChatHistory.ts:38-45`）
   - streamKey 匹配失败 → **两条消息都存活 → 重复气泡**

### 3.3 Bug C — 实时流断（待运行时日志确认）

两只猫（布偶猫 + 缅因猫）对此处分歧最大：

- **布偶猫观点**：更可能是 Socket.io 连接层问题。`useSocket.ts:228-229` 的 dual-pointer guard（`msg.threadId === routeThread && msg.threadId === storeThread`）在某些时序下可能将消息路由到 background handler 而非 active handler。需要浏览器控制台 `[ws]` 日志确认。

- **缅因猫观点**：更可能是 `replace hydration` 中途替换了 live bubble。当 draft/history 消息替换掉带有 `origin:'stream'` 的活跃气泡后，`ChatMessage.tsx` 的渲染规则不再将 `content` 当作 CLI stdout 显示，视觉上表现为"不刷新就不长了"。

**共识**：无论哪种路径，都因为 draft 消息不携带完整的 stream identity（`origin`、`extra.stream.invocationId`、`thinking`），使得替换/恢复后的气泡无法满足渲染契约。

## 4. 现有测试为何没挡住

`useChatHistory-replace-hydration.test.ts:188, :217` 中的测试 fixture 将 draft 消息写成了 `origin: 'stream'`，与真实 API 返回不一致（真实 draft 没有 `origin` 字段）。这导致测试中 `getLocalPlaceholderInvocationId` 走了错误的分支，掩盖了 reconciliation 失败的 bug。

## 5. 影响范围

| 组件 | 影响 |
|------|------|
| `DraftStore.ts` (port) | 缺 `thinking` 字段 |
| `RedisDraftStore.ts` (impl) | 同上 |
| `route-serial.ts` | draft flush 没存 thinking |
| `route-parallel.ts` | 同 route-serial |
| `messages.ts` | draft response 缺 `extra.stream.invocationId` 和 `origin` |
| `useChatHistory.ts` | merge 逻辑因缺字段无法 reconcile |
| `ChatMessage.tsx` | 对缺 `origin` 的消息渲染为空壳 CLI block（放大器） |
| 测试 | replace-hydration 测试 fixture 与真实行为不一致 |

## 6. 修复方向（未动手）

### 6.1 补全 DraftRecord schema

```typescript
export interface DraftRecord {
  // ... existing fields ...
  thinking?: string;     // 新增
}
```

draft flush 中加入 `thinking: thinkingContent`。

### 6.2 补全 draft API response

```typescript
// messages.ts draft merge
chatItems.push({
  // ... existing fields ...
  origin: 'stream',
  extra: { stream: { invocationId: d.invocationId } },
  ...(d.thinking ? { thinking: d.thinking } : {}),
});
```

### 6.3 修复测试 fixture

将 `useChatHistory-replace-hydration.test.ts` 中 draft 消息的 `origin: 'stream'` 改为不设 origin（匹配真实行为），验证 reconciliation 在缺字段时仍能正确去重。

### 6.4 实时流断（Bug C）

需要先在浏览器控制台抓 `[ws]` 日志确认 socket 状态，再决定修复路径。可能需要在 `replace hydration` 合并逻辑中保护活跃气泡的 `origin` 字段不被覆盖。

## 7. 优先级建议

| Bug | 优先级 | 理由 |
|-----|--------|------|
| Bug A (thinking 丢失) | P2 | F5 后信息丢失，但不影响最终结果 |
| Bug B (重复气泡) | P1 | 用户可见的 UI 错误，同一内容重复显示 |
| Bug C (实时流断) | P1 | 核心体验问题，需运行时日志进一步定位 |
