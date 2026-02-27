---
feature_ids: [F039]
topics: [review, frontend, queue, ui]
doc_kind: review-request
created: 2026-02-27
---

# Review 请求: F39 Phase B — 前端队列 UI

## 背景

F39 消息排队投递的前端部分。Phase A（后端队列核心）已合入 main（`99fc5c5`），本 Phase B 实现前端 UI：猫在跑时启用输入、排队/强制发送按钮、队列可视化面板、WebSocket 事件监听。

## 设计文档

- **Plan**: `docs/plans/2026-02-26-message-queue-delivery-plan.md` (Phase B: Tasks 7-10)
- **PRD**: `docs/plans/2026-02-26-message-queue-delivery.md`
- **UI 设计稿**: `pencil-new.pen`（4 frames: ChatInput 常态/排队态、QueuePanel 活跃/暂停）

## Spec Compliance 自检

| # | Spec 要求 | 状态 | 代码位置 |
|---|-----------|------|----------|
| T7-1 | `queue: QueueEntry[]` in ThreadState | ✅ | chat-types.ts:259 |
| T7-2 | `queuePaused` + `queuePauseReason` | ✅ | chat-types.ts:261-263 |
| T7-3 | `queueFull` + `queueFullSource` | ✅ | chat-types.ts:265-267 |
| T7-4 | `setQueue` / `setQueuePaused` / `setQueueFull` actions | ✅ | chatStore.ts |
| T7-5 | Socket: `queue_updated` / `queue_paused` / `queue_full_warning` | ✅ | useSocket.ts:286-304 |
| T8-1 | textarea 猫在跑时不 disabled | ✅ | ChatContainer.tsx `disabled={false}` |
| T8-2 | 排队发送按钮 (purple, queue mode) | ✅ | ChatInputActionButton.tsx |
| T8-3 | 强制发送按钮 (small red lightning) | ✅ | ChatInputActionButton.tsx |
| T8-4 | Stop 按钮保留 | ✅ | ChatInputActionButton.tsx |
| T9-1 | QueuePanel 展示队列条目 (source icon + content) | ✅ | QueuePanel.tsx:141-148 |
| T9-2 | 重排序 ↑↓ 按钮 | ✅ | QueuePanel.tsx:152-170 |
| T9-3 | 撤回按钮 → DELETE /queue/:entryId | ✅ | QueuePanel.tsx:174-180 |
| T9-4 | 暂停时「继续处理」→ POST /queue/next | ✅ | QueuePanel.tsx:75-79 |
| T9-5 | 暂停时「清空队列」→ DELETE /queue | ✅ | QueuePanel.tsx:81-85 |
| T9-6 | 队列为空不渲染 | ✅ | QueuePanel.tsx:42-46 |
| T10-1 | useSendMessage `deliveryMode` 参数 | ✅ | useSendMessage.ts |
| T10-2 | queue sends 不 reset refs/loading | ✅ | useSendMessage.ts |
| T10-3 | deliveryMode in JSON + multipart body | ✅ | useSendMessage.ts |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `chat-types.ts` | 修改 | QueueEntry 类型 + ThreadState queue fields |
| `chatStore.ts` | 修改 | queue state/actions + snapshotActive/flattenThread |
| `useSocket.ts` | 修改 | queue_updated/queue_paused/queue_full_warning 监听 |
| `useSendMessage.ts` | 修改 | deliveryMode 参数，queue sends 跳过 loading |
| `ChatInput.tsx` | 修改 | queue status bar + doSend 拆分 3 handler |
| `ChatInputActionButton.tsx` | 修改 | 状态机扩展：queueSend/forceSend 按钮 |
| `QueuePanel.tsx` | **新增** | 队列可视化面板 (~183 lines) |
| `ChatContainer.tsx` | 修改 | 挂载 QueuePanel + disabled={false} + deliveryMode 透传 |
| 4 test files | 修改 | ThreadState mock 补 queue fields + assertion 更新 |

## Git SHA

- **Base**: `99fc5c5` (main)
- **Head**: `d906bc4` (feat/f39-phase-b)
- **Branch**: `feat/f39-phase-b`
- **Worktree**: `/Users/lysander/projects/relay-station/cat-cafe-f39b`

## 测试状态

```
packages/web vitest: 83 files, 530 tests passed, 0 failed
packages/web next build: clean (no errors)
```

## Review 重点

1. **ChatInputActionButton 状态机**：优先级链 (disabled+stop → recording → transcribing → queueMode → send → mic) 是否有遗漏组合？
2. **QueuePanel API 调用**：直接用 fetch 调后端 REST API (DELETE/PATCH/POST)，没有走 apiFetch 封装——是否需要统一？
3. **setQueue 中 queueFull 清除逻辑**：`queue.length < 5` 硬编码了 MAX_QUEUE_DEPTH——是否应该从后端获取或定义常量？
4. **useSendMessage queue sends 的返回值处理**：queue sends 目前不处理 202 response 的 body——是否需要？

## 五件套

**What**: F39 Phase B 前端队列 UI — 4 个 Task (store state/WS listeners + ChatInput 三模式 + QueuePanel + useSendMessage deliveryMode)

**Why**: Phase A 后端队列已就绪，前端需要对应的 UI 让铲屎官在猫在跑时能继续输入、管理队列

**Tradeoff**:
- QueuePanel 直接用 fetch 而非 apiFetch：简单直接，但如果后续需要 auth header 统一则需要改
- `disabled={false}` 而非条件判断：最简方案，但需要在 ChatInputActionButton 内处理所有 state 组合

**Open Questions**:
- MAX_QUEUE_DEPTH 前端硬编码 vs 从后端配置获取？
- QueuePanel 的 fetch 是否需要迁移到 apiFetch？

**Next Action**: 请 review 上述 12 个文件，重点关注状态机完备性和 API 调用规范

---

@codex
请帮我 review F39 Phase B 前端队列 UI。Worktree 在 `/Users/lysander/projects/relay-station/cat-cafe-f39b`，branch `feat/f39-phase-b`，base `99fc5c5`..head `d906bc4`。
