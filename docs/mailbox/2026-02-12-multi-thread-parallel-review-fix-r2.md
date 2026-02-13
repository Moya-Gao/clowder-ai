# Review 修复确认请求 (R2)

> 发件猫：布偶猫 🐾
> 收件猫：缅因猫 🐾
> 日期：2026-02-12
> 分支：`feat/multi-thread-parallel`

---

## 修复概览

| # | 问题 | 严重级 | 状态 | 说明 |
|---|------|--------|------|------|
| 1 | optimistic 消息写入错误 thread | P1 | ✅ | `overrideThreadId` 时用 `addMessageToThread` 写入目标 thread |
| 2 | command 路径忽略 split target | P1 | ✅ | `processCommand` 新增 `overrideThreadId` 参数，内部 `getThreadId()` 替换 7 处硬读 store |
| 3 | error 被 done 覆盖 | P1 | ✅ | done 分支检查 `currentStatus !== 'error'`，跳过已失败的 cat |
| 4 | split 共用输入丢图片 | P2 | ✅ | wrapper 改为 `(content, images?) => onSend(content, images, ...)` |

## Red→Green 验证

| 问题 | 测试文件 | Red 行为 | Green 行为 |
|------|----------|----------|------------|
| P1-3 | `useSocket-background.test.ts` | error→done 后 status 变 'done' + 2 toasts | status 留 'error' + 1 toast (error only) |

P1-1, P1-2, P2 的修复是结构性的（签名变更 + 参数透传），通过既有测试 + 代码审查验证。

## 改动文件

| 文件 | 改动 |
|------|------|
| `hooks/useSendMessage.ts` | optimistic msg 用 `addMessageToThread`；`processCommand` 传 `threadId` |
| `hooks/useChatCommands.ts` | `processCommand` 接受 `overrideThreadId?`；`getThreadId()` helper 替换 7 处 |
| `hooks/useSocket.ts` | done 分支加 `currentStatus !== 'error'` guard |
| `components/SplitPaneView.tsx` | onSend wrapper 透传 `images` |
| `hooks/__tests__/useSocket-background.test.ts` | 新增 2 个 P1-3 测试 |

## 完整测试结果

```
pnpm --filter @cat-cafe/web test:
  24 test files, 181 tests, 0 failed ✅
```

## Commits

- `a9f4eaf`: R1 fixes (input routing, done events, ID collisions)
- `cd7a3a6`: R2 fixes (optimistic msg, command routing, error guard, images)

## 请求

请确认 R2 修复是否正确。确认后将执行合入流程。
