---
feature_ids: []
topics: [split, pane, invocation]
doc_kind: mailbox
created: 2026-02-19
---

# R1 Deep Review Fix Confirmation: split-pane stop leakage

## 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P1 | `handleStop` 对 background target 使用 flat setter，误清 active thread invocation 状态 | ✅ | `useAgentMessages.handleStop` 按 `threadId === currentThreadId` 分支处理；background 走 thread-scoped 清理 |
| P2 | `onIntentMode` 在 thread 切换窗口可能写错 flat state | ⏸ 暂不改 | 复现窗口极窄且需更大改造（事件路由语义变更）；本轮先记录为后续优化议题 |

## Red → Green 证据

| 问题 | 测试文件 | Red | Green |
|------|----------|-----|-------|
| P1 | `packages/web/src/hooks/__tests__/useAgentMessages-loading.test.ts` | `expected mockResetThreadInvocationState to be called`（未调用） | PASS |

### 新增回归断言（P1）

- stop 目标为 background thread 时：
  - `cancelInvocation(targetThreadId)` 仍正确发往目标线程
  - 调用 `setThreadMessageStreaming(targetThreadId, ...)` 关闭目标线程的 streaming message
  - 调用 `resetThreadInvocationState(targetThreadId)` 清理目标线程 invocation UI
  - **不会**调用 active thread 的 flat 清理：`setLoading(false)` / `setHasActiveInvocation(false)` / `setIntentMode(null)` / `clearCatStatuses()` / `setStreaming(...)`

## 完整验证结果

```bash
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useAgentMessages-loading.test.ts src/components/__tests__/stop-event-payload.test.ts src/components/__tests__/mid-invocation-inject.test.ts
# 14 passed, 0 failed

pnpm --filter @cat-cafe/web test
# 57 files passed, 394 tests passed, 0 failed

pnpm --filter @cat-cafe/web lint
# 通过（仅既有 warning，无新增 error）
```

## 改动文件

- `packages/web/src/hooks/useAgentMessages.ts`
- `packages/web/src/hooks/__tests__/useAgentMessages-loading.test.ts`

## 五件套

**What**: 将 `handleStop` 从全局 flat 清理改为 active/background 分支；background stop 仅清目标线程状态，不污染 active thread。  
**Why**: 修复 split-pane 下“停 B 误伤 A”的 P1 泄漏路径，避免 active thread Stop 消失与状态错乱。  
**Tradeoff**: background stop 采用现有 `resetThreadInvocationState + setThreadMessageStreaming`，不引入新 store API；保持改动面最小。  
**Open Questions**: `onIntentMode` 切换窗口竞态仍存在理论风险，建议后续评估是否统一改为 thread-scoped 事件写入。  
**Next Action**: 请确认 P1 修复可放行；如认可 P2 暂缓策略，我们继续 merge gate / PR。
