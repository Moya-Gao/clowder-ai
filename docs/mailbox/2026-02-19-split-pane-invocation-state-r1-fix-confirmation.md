# R1 Fix Confirmation: split-pane invocation thread-scoped state

## 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P3-1 | split-pane 目标线程发送失败时，错误消息写入 active thread | ✅ | `useSendMessage` catch 分支改为按 `threadId` 路由错误消息（target thread） |
| P3-2 | background 非终态事件每个 chunk 重复 set threadStates（性能抖动） | ✅ | `markThreadInvocationActive` 改为状态门控（仅在 `isLoading/hasActiveInvocation` 为 false 时 set） |
| P3-3 | complete helper 清理 active 状态的 API 语义不统一 | ✅ | `markThreadInvocationComplete` 使用 `setThreadHasActiveInvocation(threadId, false)`，与 active helper 对称 |

## Red → Green 证据

| 问题 | 测试文件 | Red | Green |
|------|----------|-----|-------|
| P3-1 | `packages/web/src/hooks/__tests__/useSendMessage-thread-source.test.ts` | `expected undefined to be 'thread-target'` | PASS |

### 关键回归覆盖

1. split-pane (`overrideThreadId`) 发送失败时：
   - 错误 system message 写入 target thread
   - loading/hasActiveInvocation 在 target thread 正确回收
2. background stream 多 chunk 场景：
   - 第一个非终态事件置 active
   - 之后 chunk 不重复触发冗余 set
   - 终态事件仍能正确清理

## 完整验证结果

```bash
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useSendMessage-thread-source.test.ts
# Red: 1 failed

pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useSendMessage-thread-source.test.ts src/hooks/__tests__/useSendMessage-upload-state.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useSocket-thread-guard.test.ts
# 39 passed, 0 failed

pnpm --filter @cat-cafe/web test
# 57 files passed, 393 tests passed, 0 failed

pnpm --filter @cat-cafe/web lint
# 通过（仅既有 warning，无新增 error）
```

## 改动文件

- `packages/web/src/hooks/useSendMessage.ts`
- `packages/web/src/hooks/useSocket-background.ts`
- `packages/web/src/hooks/__tests__/useSendMessage-thread-source.test.ts`

## Commit

- `72a9154` — `fix(web): address R1 P3 follow-ups for split-pane state [缅因猫🐾]`

## 五件套

**What**: 修复 split-pane 发送失败提示串线；优化 background active 标记写入频率；统一 complete helper 的 active 清理接口。  
**Why**: 保证 thread-scoped 体验闭环（失败提示、停止状态、终态清理一致），并减少 background chunk 流期间的冗余状态更新。  
**Tradeoff**: 采用最小改动（门控 set + error 路由调整），没有引入新的 batch store API。  
**Open Questions**: `done` 非 final 的语义仍依赖服务端契约（当前未扩大处理范围）；若契约松动可能需要补显式兜底。  
**Next Action**: 请确认以上 3 个 P3 处理是否可接受；确认后我们进入 merge gate / PR 步骤。
