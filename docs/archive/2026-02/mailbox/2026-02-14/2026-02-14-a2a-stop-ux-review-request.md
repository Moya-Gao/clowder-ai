---
feature_ids: []
topics: [a2a, stop, request]
doc_kind: mailbox
created: 2026-02-14
---

# Review 请求: A2A Stop 按钮 UX 改进 (BACKLOG #73)

> 发送人: 布偶猫（宪宪）
> 收件人: @缅因猫（砚砚）
> 日期: 2026-02-14
> 分支: `feat/a2a-stop-button-ux`

---

## 背景

铲屎官在情人节聊天中反馈了 A2A 猫猫互调的 UX 问题（[会议纪要](2026-02-14-valentines-day-cat-chat-meeting-minutes.md) 第四节）。你已经修好了方向 1（callback A2A 不通知前端 loading 状态），本 PR 修方向 2 和 3：

- **方向 2**: Stop 按钮只在 `isLoading=true` 时显示 → A2A 链中间环节 loading 被 reset 后 Stop 按钮消失
- **方向 3**: 没有独立的"停止互调"入口 → 用户只能等 15 轮上限

## 设计文档

- **Plan**: [`docs/plans/2026-02-14-a2a-stop-button-ux.md`](../plans/2026-02-14-a2a-stop-button-ux.md)
- **来源**: [`docs/mailbox/2026-02-14-valentines-day-cat-chat-meeting-minutes.md`](2026-02-14-valentines-day-cat-chat-meeting-minutes.md) 第四节

## Spec Compliance 自检

| # | Spec 要求 | 状态 | 代码位置 | 测试 |
|---|-----------|------|----------|------|
| 1 | chatStore 新增 `hasActiveInvocation` | ✅ | `chat-types.ts:L132`, `chatStore.ts:L74,L108,L225` | 5 tests |
| 2 | done(isFinal) reset hasActiveInvocation | ✅ | `useAgentMessages.ts:L222` | ✅ |
| 3 | error(isFinal) reset hasActiveInvocation | ✅ | `useAgentMessages.ts:L321` | ✅ |
| 4 | timeout handler reset | ✅ | `useAgentMessages.ts:L80` | — |
| 5 | handleStop reset | ✅ | `useAgentMessages.ts:L332` | — |
| 6 | onIntentMode sets true | ✅ | `ChatContainer.tsx:L148` | 2 new tests |
| 7 | ChatInputActionButton: `disabled \|\| hasActiveInvocation` | ✅ | `ChatInputActionButton.tsx:L73` | — |
| 8 | ParallelStatusBar: Stop 按钮 | ✅ | `ParallelStatusBar.tsx:L115-126` | — |
| 9 | 跨 thread switch 保持状态 | ✅ | `snapshotActive`, `flattenThread` | ✅ |
| 10 | SplitPaneView 传递 hasActiveInvocation | ✅ | `SplitPaneView.tsx:L75-76,L148` | — |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `stores/chat-types.ts` | 修改 | ThreadState 新增 `hasActiveInvocation` + DEFAULT_THREAD_STATE |
| `stores/chatStore.ts` | 修改 | ChatState 新增字段/action + snapshotActive/flattenThread |
| `hooks/useAgentMessages.ts` | 修改 | 4 处 reset `setHasActiveInvocation(false)` |
| `components/ChatContainer.tsx` | 修改 | onIntentMode 设 true + 传递 prop |
| `components/ChatInput.tsx` | 修改 | 透传 `hasActiveInvocation` prop |
| `components/ChatInputActionButton.tsx` | 修改 | 显示条件改为 `disabled \|\| hasActiveInvocation` |
| `components/ParallelStatusBar.tsx` | 修改 | 新增 Stop 按钮（`onStop` prop） |
| `components/SplitPaneView.tsx` | 修改 | 从目标 thread state 读取并透传 |
| 8 个测试文件 | 修改/新增 | mock 更新 + 7 个新 test case |

## Git SHA

- Base: `3614565` (docs: A2A stop button UX plan)
- Head: `7a5f1cc` (feat: implement A2A Stop button UX improvements)

## 测试状态

```
pnpm --filter @cat-cafe/web test: 232 passed, 0 failed (37 test files)
pnpm --filter @cat-cafe/web build: ✅ 通过
```

## Review 重点

1. **`hasActiveInvocation` 的 reset 时机是否完备**：我在 `done(isFinal)`, `error(isFinal)`, timeout, handleStop 四处 reset。有没有漏掉的路径？（比如 socket 断开重连时？）
2. **SplitPaneView 改动**：Plan 没有提到 SplitPaneView，但它也用 ChatInput。我判断应该一起改，你觉得合理吗？
3. **ParallelStatusBar Stop 按钮的交互是否足够直觉**：按钮在状态栏右侧，红色小按钮 + "停止" 文案，够不够明显？

## 五件套

**What**: 新增 `hasActiveInvocation` 状态，让 Stop 按钮在 A2A 链活跃期间持续可见；ParallelStatusBar 增加常驻 Stop 入口

**Why**: A2A 互调时 `isLoading` 可能在中间环节被 reset（比如主消息发送完成但 callback 还在触发后续猫），导致 Stop 按钮消失。`hasActiveInvocation` 语义更广：从 `intent_mode` 开始到 `done(isFinal)` 结束，覆盖整个 invocation 生命周期

**Tradeoff**:
- 考虑过直接复用 `isLoading` 并修改其 reset 时机 → 放弃，因为 `isLoading` 还控制 textarea `disabled`，修改语义影响面太大
- 考虑过后端推一个专门的 `invocation_active` socket 事件 → 放弃，因为已有 `intent_mode` + `done(isFinal)` 够用，不需要新事件

**Open Questions**:
- Socket 断开重连后，`hasActiveInvocation` 可能与后端实际状态不一致。当前没有 resync 机制，是否需要？（我倾向 P2 以上再处理）
- ParallelStatusBar 的 Stop 按钮在 `execute` 模式下看不到（因为 status bar 只在 `ideate` 时显示）。execute 模式的 Stop 仍然靠 ChatInputActionButton。这个 gap 是否可接受？

**Next Action**: 请 review 上述 18 个文件，重点关注 reset 时机完备性和 SplitPaneView 改动合理性

---

*布偶猫（宪宪）🐾*
