---
feature_ids: []
topics: [timeout, thread, scope]
doc_kind: mailbox
created: 2026-02-18
---

# Review 请求: thread 切换后 timeout 串线修复

## 背景

用户现场反馈 `thread_mlr5t5b7s2uf5vcx` 在切到另一个 thread 后出现 timeout 文案串线。  
根因是前端 timeout timer 未绑定 thread，上一个 thread 的 timeout 会写入当前 active thread。

## 设计文档

- Bug report: `docs/bug-report/thread-timeout-cross-thread-leak/bug-report.md`

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | timeout 必须按来源 thread 归属 | ✅ | `useAgentMessages` timeout 回调改为按 `timeoutThreadId` 路由 |
| 2 | 切线程后不能污染当前 thread | ✅ | 背景线程路径使用 `addMessageToThread` 写回来源 thread |
| 3 | 回归测试覆盖 thread switch + timeout | ✅ | 新增 `routes timeout to original thread...` |
| 4 | 现有线程路由行为不回归 | ✅ | 补跑 `useSocket-thread-guard` + `useSocket-background` |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/hooks/useAgentMessages.ts` | 修改 | timeout 绑定来源 thread；背景线程 timeout 走 threadStates 路径 |
| `packages/web/src/hooks/__tests__/useAgentMessages-loading.test.ts` | 修改 | 新增 thread switch 后 timeout 归属回归测试 |
| `docs/bug-report/thread-timeout-cross-thread-leak/bug-report.md` | 新增 | 本次问题 5 件套与根因记录 |

## Git SHA

- Base: `e357e05`
- Head: `0b8aedd`

## 测试状态

```bash
pnpm --filter @cat-cafe/web test -- useAgentMessages-loading.test.ts useSocket-thread-guard.test.ts useSocket-background.test.ts
# 3 files passed, 30 tests passed, 0 failed

pnpm biome check packages/web/src/hooks/useAgentMessages.ts packages/web/src/hooks/__tests__/useAgentMessages-loading.test.ts docs/bug-report/thread-timeout-cross-thread-leak/bug-report.md
# 0 errors, 2 complexity warnings (pre-existing complexity policy warning)
```

## Review 重点

1. timeout 回调在 active/background 分流的线程归属是否稳健
2. 背景线程超时时 `isStreaming` 清理是否足够
3. 新回归测试是否准确覆盖用户现场场景

## 五件套

**What**: 修复 timeout 事件跨线程串线，并补回归测试与 bug report。  
**Why**: 避免 thread-A 的超时提示污染 thread-B，造成误判和状态错乱。  
**Tradeoff**: 采用最小修复（hook 内分流）而不是立即拆分 `useAgentMessages` 复杂度。  
**Open Questions**: 后续是否要把 timeout 机制彻底下沉到 per-thread store，减少 hook 复杂度。  
**Next Action**: 请布偶猫 review 上述 3 个文件，重点看线程归属和回归覆盖。

