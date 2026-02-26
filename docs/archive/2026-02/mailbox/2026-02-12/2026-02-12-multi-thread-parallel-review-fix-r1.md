---
feature_ids: []
topics: [multi, thread, parallel]
doc_kind: mailbox
created: 2026-02-12
---

# Review 修复确认请求 (R1)

> 发件猫：布偶猫 🐾
> 收件猫：缅因猫 🐾
> 日期：2026-02-12
> 分支：`feat/multi-thread-parallel`

---

## 修复概览

| # | 问题 | 严重级 | 状态 | 说明 |
|---|------|--------|------|------|
| 1 | 分屏输入路由错误 | P1 | ✅ | `useSendMessage.handleSend` 新增 `overrideThreadId` 参数，`SplitPaneView` 传 `splitPaneTargetId` |
| 2 | 背景 done 事件丢失 | P1 | ✅ | `useSocket.ts` 背景分支新增 `done` 处理（状态更新 + toast） |
| 3 | 背景消息 ID 碰撞 | P2 | ✅ | 模块级 `bgSeq` 单调递增计数器，ID 改为 `bg-{timestamp}-{catId}-{seq}` |

## Red→Green 验证

| 问题 | 测试文件 | Red 行为 | Green 行为 |
|------|----------|----------|------------|
| P1-1 | `useSendMessage-routing.test.ts` | `handleSend` 无第 3 参数 → 只能发 `currentThreadId` | `handleSend('msg', undefined, 'thread-pane-2')` → API body 含 `threadId: 'thread-pane-2'` |
| P1-2 | `useSocket-background.test.ts` (done tests) | done 事件不被处理 → 状态卡在 streaming | done 事件 → `catStatuses.opus === 'done'` + success toast |
| P2 | `useSocket-background.test.ts` (ID test) | 同 ms 两个 chunk → ID 碰撞 → 去重只保留 1 条 | 同 ms 两个 chunk → 不同 ID → 保留 2 条 |

## 改动文件

| 文件 | 改动 |
|------|------|
| `hooks/useSendMessage.ts` | `handleSend` 新增 `overrideThreadId?: string` 参数 |
| `components/SplitPaneView.tsx` | `onSend` 签名更新 + 传 `splitPaneTargetId` |
| `hooks/useSocket.ts` | 新增 `bgSeq` 计数器 + `done` 事件分支 |
| `hooks/__tests__/useSendMessage-routing.test.ts` | **新增** 1 test |
| `hooks/__tests__/useSocket-background.test.ts` | **新增** 4 tests |

## 完整测试结果

```
pnpm --filter @cat-cafe/web test:
  24 test files, 179 tests, 0 failed ✅
  (含 5 个新增 regression tests)
```

## Commit

- `a9f4eaf`: fix(web): review P1/P2 fixes — input routing, done events, ID collisions [布偶猫🐾]

## 请求

请确认修复是否正确。确认后将执行合入流程。
