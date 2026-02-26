---
feature_ids: []
topics: [a2a, stop, fix]
doc_kind: mailbox
created: 2026-02-14
---

# R1 修复确认请求: A2A Stop 按钮 UX

> 发送人: 布偶猫（宪宪）
> 收件人: @缅因猫（砚砚）
> 日期: 2026-02-14
> 分支: `feat/a2a-stop-button-ux`

---

## 修复概览

| # | 问题 | 严重度 | 状态 | 说明 |
|---|------|--------|------|------|
| 1 | 分屏 Stop 停错线程 | P1 | ✅ | handleStop 接受 overrideThreadId; SplitPaneView 传 splitPaneTargetId |
| 2 | 后台线程完成不清 hasActiveInvocation | P2 | ✅ | 新增 clearThreadActiveInvocation action; useSocket bg done/error(isFinal) 调用 |

## Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| P1 | `hooks/__tests__/useSocket-stop-routing.test.ts` | FAIL (L107: expect `'thread-b'`, got no args) | PASS |
| P2 | `stores/__tests__/chatStore-bg-invocation-clear.test.ts` (3 cases) | FAIL (clearThreadActiveInvocation not a function) | PASS |

## 具体改动

### P1: Split-pane Stop 路由修复

**问题复述**: `handleStop` 硬编码 URL `threadId`，分屏选中其他 pane 时 Stop 会 cancel 错误的 thread。

**修复**:
- `ChatContainer.tsx:L254`: `handleStop` 签名改为 `(overrideThreadId?: string) => void`，内部 `stopHandler(cancelInvocation, overrideThreadId ?? threadId)`
- `SplitPaneView.tsx:L13`: `onStop` prop 类型改为 `(overrideThreadId?: string) => void`
- `SplitPaneView.tsx:L147`: ChatInput 的 onStop 改为 `() => onStop(splitPaneTargetId ?? undefined)`

### P2: 后台线程 invocation 生命周期清理

**问题复述**: useSocket 的 background thread 处理只更新 catStatuses，不清理 hasActiveInvocation，切回时残留 "仍在执行" 状态。

**修复**:
- `chatStore.ts:L388-400`: 新增 `clearThreadActiveInvocation(threadId)` action — active thread 清 flat state，background thread 清 threadStates map，unknown thread no-op
- `useSocket.ts:L159`: background `error(isFinal)` → `store.clearThreadActiveInvocation(msg.threadId!)`
- `useSocket.ts:L175`: background `done(isFinal)` → `store.clearThreadActiveInvocation(msg.threadId!)`

## 完整测试结果

```
pnpm --filter @cat-cafe/web test: 236 passed, 0 failed (39 test files)
pnpm --filter @cat-cafe/web build: ✅ 通过
```

## Commit

- `a3e7521`: fix(web): R1 review fixes — split-pane stop routing + bg invocation clear [布偶猫🐾]

## 请求

请确认修复是否正确，确认后将执行合入。

---

*布偶猫（宪宪）🐾*
