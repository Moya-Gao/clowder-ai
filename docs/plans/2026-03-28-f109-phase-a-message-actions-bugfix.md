# F109 Phase A: Message Actions Bug Fix — Implementation Plan

**Feature:** F109 — `docs/features/F109-message-actions-overhaul.md`
**Goal:** 修复消息操作的 4 个 bug：软删除前端不生效、hard delete 同步、restore 半残、branch 权限过严 + 错误提示缺失
**Acceptance Criteria:**
- AC-A1: 软删除后，当前 tab 的消息气泡立即消失
- AC-A2: 软删除后，其他已连接 client / 切线程后气泡也消失（WebSocket + threadState 同步）
- AC-A3: 刷新页面后，已软删除的消息不再出现（后端已正确，无需改动）
- AC-A4: hard delete 复用同一 thread-scoped remove，不回归
- AC-A5: restore 跨客户端同步（socket 到达后 refetch）
- AC-A6: 铲屎官可以在任何 thread 中 Branch From 任意消息（含 system thread）
- AC-A7: Branch/Delete 失败时前端显示 toast 错误提示
- AC-A8: 已有测试不回归 + 新增 5 个最小测试边界
**Architecture:** 已有 `removeThreadMessage(threadId, messageId)` 双路径基础设施，主要工作是把 socket callback 和 UI action 接上正确的 store method，补 toast 错误提示，修 branch 权限判断
**Tech Stack:** Zustand store, Vitest (前端), node:test (后端), Fastify
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测软删除 + branch

---

## 终态定义

修完后的数据流：

```
用户点删除 → API DELETE → 200 → 本地 removeThreadMessage(threadId, id)
                        → non-2xx → toast 错误
后端广播 → socket message_deleted/message_hard_deleted → onMessageDeleted
         → removeThreadMessage(threadId, messageId)  // 双路径：active=flat, background=threadStates
后端广播 → socket message_restored → onMessageRestored
         → refetch thread messages（低频，最简方案）
用户点 branch → API POST → 200 → navigate
                        → 403 → toast "无权创建分支"
后端 branch 权限 → createdBy === userId || createdBy === 'system'
```

## 不做的事

- Phase B1/B2（编辑分层、revision system）
- 新增 `participants` ACL 模型
- `getByThreadAfter` cursor 语义变更
- 删除占位符 UI（OQ-4 待确认）

---

### Task 1: 前端 socket 删除回调 — 接通 removeThreadMessage

**根因**：`useChatSocketCallbacks.ts:89` 调 `removeMessage(data.messageId)` 只删 flat messages，不删 background threadStates。而 `removeThreadMessage` 已实现双路径（chatStore.ts:1322）但未被使用。

**Files:**
- Modify: `packages/web/src/hooks/useChatSocketCallbacks.ts:39-41,89`
- Test: `packages/web/src/hooks/__tests__/useChatSocketCallbacks-delete.test.ts` (new)

**Step 1: Write failing test — socket delete removes message from background thread**

```typescript
// packages/web/src/hooks/__tests__/useChatSocketCallbacks-delete.test.ts
import { describe, expect, it, vi } from 'vitest';

const removeMessageMock = vi.fn();
const removeThreadMessageMock = vi.fn();

// Mock stores...
// Test: onMessageDeleted calls removeThreadMessage with (threadId, messageId)
// not the old removeMessage(messageId)
```

**Step 2: Run test — verify it fails** (removeThreadMessage not called)

**Step 3: Fix the callback**

Change `useChatSocketCallbacks.ts`:
- Destructure `removeThreadMessage` instead of `removeMessage` from store
- Line 89: `onMessageDeleted: (data) => removeThreadMessage(data.threadId, data.messageId)`

**Step 4: Run test — verify pass**

**Step 5: Commit** `fix(F109): wire socket delete callback to removeThreadMessage for thread-scoped removal`

**Covers:** AC-A1, AC-A2, AC-A4 (hard delete reuses same `onMessageDeleted` callback at useSocket.ts:363)

---

### Task 2: MessageActions 本地删除 — 接通 removeThreadMessage

**根因**：`MessageActions.tsx:61,77` 在 API 成功后调 `removeMessage(message.id)` — 同样只删 flat。需改为 `removeThreadMessage(threadId, message.id)`。

**Files:**
- Modify: `packages/web/src/components/MessageActions.tsx:6,27,61,77`
- Test: existing `message-actions-identity.test.ts` must not regress

**Step 1: Write failing test — confirmSoftDelete calls removeThreadMessage with threadId**

追加到现有 identity test 文件或新建 `message-actions-delete.test.ts`。

**Step 2: Run test — verify fail**

**Step 3: Fix MessageActions**

```diff
- const removeMessage = useChatStore((s) => s.removeMessage);
+ const removeThreadMessage = useChatStore((s) => s.removeThreadMessage);

- if (res.ok) removeMessage(message.id);
+ if (res.ok) removeThreadMessage(threadId, message.id);
```

两处：confirmSoftDelete (line 61) 和 confirmHardDelete (line 77)。

**Step 4: Run existing + new tests — verify pass**

**Step 5: Commit** `fix(F109): MessageActions local delete uses thread-scoped removal`

**Covers:** AC-A1 (local immediate removal after API success)

---

### Task 3: Delete/Branch 错误 toast

**根因**：`MessageActions.tsx` 的静默失败有**两层**（砚砚@gpt52 R3 指出）：
1. `res.ok === false`（403/400）→ 主路径，fetch 成功但业务失败，**不进 catch** — 这是主要漏洞
2. `catch` 块（网络错误）→ 次要路径，空注释

两层都需要处理，否则只补 catch 的话 403 还是静默。

**Files:**
- Modify: `packages/web/src/components/MessageActions.tsx`
- Test: `packages/web/src/components/__tests__/message-actions-error-toast.test.ts` (new)

**Step 1: Write failing test — soft delete non-2xx triggers toast**

```typescript
// Mock apiFetch to return { ok: false, status: 403, json: async () => ({ error: '无权删除' }) }
// Verify useToastStore.getState().addToast called with type: 'error'
// Also test: apiFetch rejects (network error) → catch block also toasts
```

**Step 2: Run test — verify fail**

**Step 3: Add toast error handling — both `!res.ok` and catch**

```typescript
import { useToastStore } from '@/stores/toastStore';

// Helper (file-local, not exported):
function showErrorToast(title: string, body?: Record<string, unknown>) {
  useToastStore.getState().addToast({
    type: 'error',
    title,
    message: (body?.error as string) ?? '操作未成功，请重试',
    duration: 4000,
  });
}

// In confirmSoftDelete:
if (res.ok) {
  removeThreadMessage(threadId, message.id);
} else {
  const body = await res.json().catch(() => ({}));
  showErrorToast('删除失败', body);
}
// catch block:
} catch {
  showErrorToast('删除失败');
}

// Same dual-layer pattern for confirmHardDelete, confirmBranch, confirmBranchDirect
```

**Step 4: Run test — verify pass**

**Step 5: Commit** `fix(F109): toast error feedback on delete/branch failure`

**Covers:** AC-A7

---

### Task 4: Branch 权限放宽 — system thread

**根因**：`thread-branch.ts:130` — `sourceThread.createdBy !== userId` 拒绝所有非 owner，包括 system thread。

**Files:**
- Modify: `packages/api/src/routes/thread-branch.ts:130`
- Test: `packages/api/test/thread-branch-permission.test.js` (new)

**Step 1: Write failing test — branch from system-created thread succeeds**

```javascript
// Create thread with createdBy: 'system'
// POST /api/threads/:id/branch with userId: 'user-1'
// Expect 200 (currently 403)
```

**Step 2: Run test — verify fail (403)**

**Step 3: Fix permission check**

```diff
- if (sourceThread.createdBy !== userId) {
+ if (sourceThread.createdBy !== userId && sourceThread.createdBy !== 'system') {
```

**Step 4: Run test — verify pass + run existing branch tests**

**Step 5: Commit** `fix(F109): allow branch from system-created threads (KD-2)`

**Covers:** AC-A6

---

### Task 5: Restore 回调 — 复用 requestStreamCatchUp

**根因**：`useChatSocketCallbacks.ts:90-92` — `onMessageRestored` 是空函数。

**设计决策**（砚砚@gpt52 R3 建议采纳）：不在 callback 里硬塞裸 refetch，复用已有的 `requestStreamCatchUp(threadId)` 机制。

**为什么更好**：
- `requestStreamCatchUp` 只是 bump 一个 monotonic counter + 设 target threadId（chatStore.ts:1155-1159）
- `useChatHistory` hook 监听 version 变化 → `fetchHistory(undefined, { replace: true })`（useChatHistory.ts:636-644）
- 天然 thread-scoped（只对 matching threadId 生效）
- 600ms 延迟给后端持久化留余量
- 不碰 draft/scroll/active invocation 状态（砚砚之前的担忧消解）
- background thread：不立即 refetch，切过去时 bootstrap 会自然 fetchHistory

**Files:**
- Modify: `packages/web/src/hooks/useChatSocketCallbacks.ts:33-41,90-92`
- Test: `packages/web/src/hooks/__tests__/useChatSocketCallbacks-restore.test.ts` (new)

**Step 1: Write failing test — onMessageRestored calls requestStreamCatchUp**

```typescript
// Mock useChatStore to track requestStreamCatchUp calls
// Trigger onMessageRestored with { messageId: 'msg-1', threadId: 'thread-1' }
// Verify requestStreamCatchUp('thread-1') called
```

**Step 2: Run test — verify fail**

**Step 3: Implement restore handler**

```typescript
// In useChatSocketCallbacks destructure:
const { ..., removeThreadMessage, requestStreamCatchUp } = useChatStore();

// In callbacks:
onMessageRestored: (data: { messageId: string; threadId: string }) => {
  requestStreamCatchUp(data.threadId);
},
```

**Step 4: Run test — verify pass**

**Step 5: Commit** `fix(F109): restore callback triggers catch-up refetch via requestStreamCatchUp`

**Covers:** AC-A5

---

### Task 6: 全量回归 + 已有测试不回归

**Step 1: Run all existing message-actions tests**

```bash
# 后端
cd packages/api && pnpm test -- --test-name-pattern="delete|restore|branch"

# 前端
cd packages/web && pnpm vitest run src/components/__tests__/message-actions
```

**Step 2: Run full gate check**

```bash
pnpm gate
```

**Step 3: Commit any fixes if needed**

**Covers:** AC-A8

---

## AC → Task 映射

| AC | Task | 验证方式 |
|---|---|---|
| AC-A1 | Task 1 + 2 | UT: removeThreadMessage called with threadId |
| AC-A2 | Task 1 | UT: background thread message removed via threadStates |
| AC-A3 | — (后端已正确) | 已有 soft-delete.test.js 覆盖 |
| AC-A4 | Task 1 | hard_deleted 复用 onMessageDeleted (useSocket.ts:363) |
| AC-A5 | Task 5 | UT: refetch on restore event |
| AC-A6 | Task 4 | UT: system thread branch returns 200 |
| AC-A7 | Task 3 | UT: toast on non-2xx |
| AC-A8 | Task 6 | 全量回归 |

## 关键发现（代码复读后更新）

1. **`removeThreadMessage` 已存在**（chatStore.ts:1322-1344）— 完整双路径 + blob URL 清理。Phase A 不需要新建 store method，只需接线。
2. **`useSocket.ts:363` hard_deleted 复用 `onMessageDeleted`** — 修一次覆盖两种删除。
3. **Toast 基础设施已就绪** — `useToastStore.addToast()` + `ToastContainer` 组件已在全局挂载。
4. **行号全部基于 2026-03-28 main HEAD**，不再引用 spec 中的旧行号。
5. **不删 `removeMessage`**（砚砚@gpt52 R3 提醒）— 只改 delete 相关调用点到 `removeThreadMessage`，`removeMessage` 本身留着给 active-thread optimistic 清理等其他用途。
6. **Toast 双层处理**（砚砚@gpt52 R3 指出）— `!res.ok`（403/400 主路径）和 `catch`（网络错误次路径）都需要 toast，不能只补 catch。
7. **Restore 用 `requestStreamCatchUp`**（砚砚@gpt52 R3 建议）— 复用已有 catch-up 机制，比裸 refetch 更安全，天然不碰 draft/scroll/invocation 状态。
