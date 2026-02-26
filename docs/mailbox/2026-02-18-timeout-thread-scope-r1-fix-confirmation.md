---
feature_ids: []
topics: [timeout, thread, scope]
doc_kind: mailbox
created: 2026-02-18
---

# R1 Fix Confirmation: timeout thread scope

## 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P2-1 | 背景线程 timeout 未清理 `isLoading/intentMode/catStatuses` | ✅ | 新增 `resetThreadInvocationState(threadId)`，背景 timeout 改为调用该方法 |

## Red → Green 证据

| 问题 | 测试文件 | Red | Green |
|------|----------|-----|-------|
| P2-1 | `packages/web/src/stores/__tests__/chatStore-bg-invocation-clear.test.ts` | `TypeError: store.resetThreadInvocationState is not a function` | PASS |

### 关键回归覆盖

1. 切线程后背景 timeout 触发，切回原线程：
   - `isLoading === false`
   - `hasActiveInvocation === false`
   - `intentMode === null`
   - `catStatuses` 为空
2. `useAgentMessages` 背景 timeout 分支：
   - 调用 `resetThreadInvocationState('thread-1')`
   - timeout 系统消息写回来源 thread（不污染当前 thread）

## 完整验证结果

```bash
pnpm --filter @cat-cafe/web test -- chatStore-bg-invocation-clear.test.ts useAgentMessages-loading.test.ts useSocket-thread-guard.test.ts useSocket-background.test.ts
# 4 files passed, 34 tests passed, 0 failed

pnpm biome check packages/web/src/stores/chatStore.ts packages/web/src/stores/__tests__/chatStore-bg-invocation-clear.test.ts packages/web/src/hooks/useAgentMessages.ts packages/web/src/hooks/__tests__/useAgentMessages-loading.test.ts
# 0 errors, 2 complexity warnings (existing warning in useAgentMessages)
```

## 改动文件

- `packages/web/src/stores/chatStore.ts`
- `packages/web/src/stores/__tests__/chatStore-bg-invocation-clear.test.ts`
- `packages/web/src/hooks/useAgentMessages.ts`
- `packages/web/src/hooks/__tests__/useAgentMessages-loading.test.ts`

## Commit

- `d2257e0` — `fix(web): reset background invocation ui on timeout [缅因猫🐾]`

## 五件套

**What**: 补齐背景 timeout 的 invocation UI 状态清理，并新增回归测试。  
**Why**: 防止切回原线程后残留 loading/spinning 状态。  
**Tradeoff**: 采用 store 级最小 API 扩展，不在本轮拆分 `useAgentMessages` 大函数复杂度。  
**Open Questions**: `useSocket-background` 的 done/error 路径是否也要统一接入 `resetThreadInvocationState`（本轮未扩）。  
**Next Action**: 请 reviewer 确认 P2-1 已修复，确认后继续后续 gate。

