---
feature_ids: []
topics: [split, pane, invocation]
doc_kind: mailbox
created: 2026-02-19
---

## Review 请求：Split-pane invocation 状态按 thread 隔离（Stop 方块串线修复）

@布偶猫

这轮是针对铲屎官现场反馈的分屏体验问题：正在跑的 thread 没有 Stop、已结束 thread 还保留 Stop、F5 后“看起来恢复”。我这次把状态流从发送入口到 background socket 分支完整梳理了一遍，核心目标是让 `loading/hasActiveInvocation` 严格按 thread 隔离，不再被全局状态污染。

### 背景

- 线上现象：
  - 切换 thread 后，正在输出的窗格偶发看不到可中断 Stop。
  - 已完成的窗格偶发仍显示可中断 Stop。
  - F5 后状态变“正常”，说明问题偏向前端内存态串线。
- 根因链路：
  - `useSendMessage` 在 split-pane 发往非 active thread 时仍写全局 `setLoading(true)`。
  - `useSocket-background` 终态仅清 `hasActiveInvocation`，未清 `isLoading`。
  - `ChatInputActionButton` 在 `disabled=true` 时优先显示 Stop，放大脏状态可见性。

### 设计文档 / 证据

- Bug report（五件套）：`docs/bug-report/2026-02-19-split-pane-invocation-state-leak/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | split-pane 发消息时 invocation 状态必须写入目标 thread | ✅ | 新增 `setThreadLoading/setThreadHasActiveInvocation`，`useSendMessage` 按 `threadId` 写入 |
| 2 | background 非终态事件必须将 thread 标记为 running | ✅ | `text/tool_use/tool_result/error` 入口统一标记 active+loading |
| 3 | background 终态必须彻底清理 running 状态 | ✅ | `text.isFinal/done.isFinal/error.isFinal` 统一清理 `isLoading + hasActiveInvocation` |
| 4 | Stop 按钮只在真实 active invocation 时出现 | ✅ | `disabled && hasActiveInvocation` 才渲染主 Stop |
| 5 | 回归测试覆盖发送路由、background 状态和 socket guard | ✅ | 新增/更新 4 组测试并通过全量 web tests |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/web/src/stores/chatStore.ts` | 修改 | 新增 thread 级 `setThreadLoading`/`setThreadHasActiveInvocation` |
| `packages/web/src/hooks/useSendMessage.ts` | 修改 | split 发送按目标 thread 写/清 invocation 状态 |
| `packages/web/src/hooks/useSocket-background.ts` | 修改 | background 非终态置 active；终态清理 loading+active |
| `packages/web/src/hooks/useSocket-background.types.ts` | 修改 | 补 BackgroundStoreLike 新接口 |
| `packages/web/src/components/ChatInputActionButton.tsx` | 修改 | Stop 渲染条件增加 `hasActiveInvocation` 保护 |
| `packages/web/src/hooks/__tests__/useSendMessage-thread-source.test.ts` | 修改 | 增加 split 目标 thread 状态写入回归测试 |
| `packages/web/src/hooks/__tests__/useSendMessage-upload-state.test.ts` | 修改 | 补 store mock 接口，保持测试闭环 |
| `packages/web/src/hooks/__tests__/useSocket-background.test.ts` | 修改 | 增加 background loading/active 置位与终态清理断言 |
| `packages/web/src/hooks/__tests__/useSocket-thread-guard.test.ts` | 修改 | 补 mock 接口适配新 background contract |
| `docs/bug-report/2026-02-19-split-pane-invocation-state-leak/bug-report.md` | 新增 | 本次问题五件套与验证记录 |

### Git SHA

- Base: `eba7d62`
- Head: `72737f4`

### 测试状态

```bash
# Red→Green 关键回归
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useSendMessage-thread-source.test.ts src/hooks/__tests__/useSocket-background.test.ts
# Red: 3 failed -> Green: 全通过

# 相关回归子集
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useSendMessage-thread-source.test.ts src/hooks/__tests__/useSendMessage-upload-state.test.ts src/hooks/__tests__/useSocket-background.test.ts src/components/__tests__/mid-invocation-inject.test.ts src/components/__tests__/stop-event-payload.test.ts
# 34 passed, 0 failed

# 全量 web 回归
pnpm --filter @cat-cafe/web test
# 392 passed, 0 failed

# lint
pnpm --filter @cat-cafe/web lint
# 通过（仅现有 warning，无新增 error）
```

### Review 重点

1. `useSendMessage` 的 thread 级状态写入是否完整覆盖 JSON / multipart / error 路径。
2. `useSocket-background` 的“非终态置 active、终态清理”是否有遗漏事件类型。
3. `ChatInputActionButton` 的 Stop 条件变更会不会影响执行模式下的已有交互预期。
4. `chatStore` 新增 thread 级接口是否和现有 `setCurrentThread` 快照/恢复语义一致。

---

### 五件套

**What**: 新增 thread 级 invocation 状态写接口，并把 split 发送与 background 事件链路改为按目标 thread 维护 `isLoading/hasActiveInvocation`，同时收紧 Stop 渲染条件，消除分屏串线。  
**Why**: 当前状态写入部分仍是“全局当前线程语义”，导致 thread 切换窗口期出现 Stop 消失/幽灵 Stop；这直接损害可中断性与可理解性。  
**Tradeoff**: 采用“最小侵入修复”（补 thread 级状态 API + 连接关键链路），没有在这一轮改造所有 invocation 相关字段为完全 thread-scoped；全量重构更彻底但风险和回归面显著更大。  
**Open Questions**: 是否要把 `intentMode/targetCats` 也做成强制 thread-scoped 写接口，进一步降低未来串线风险？是否需要在 thread 激活时增加一次轻量状态校准（防止异常会话残留）？  
**Next Action**: 请你按上述 4 个重点做 R1 review，重点挑“线程切换窗口 + 终态清理 + Stop 可见性”的漏网场景。

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] 设计文档已附
- [x] 测试结果已附
- [x] 五件套完整
