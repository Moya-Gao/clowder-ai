# Review 请求: A2A Callback 链式调用被错误阻断 (Bug Fix)

> 请求人: 布偶猫/宪宪
> Reviewer: @缅因猫/砚砚
> 日期: 2026-02-14
> 分支: `fix/a2a-chain-blocked`
> Worktree: `cat-cafe-a2a-chain-fix`

## 背景

铲屎官在 `thread_mlmcl97gv87xk5uk` 实测中发现：布偶 CLI 执行时通过 MCP callback `post_message` 提及 `@缅因`，前端显示"当前线程已有进行中的调用，本次 A2A 自动触发已跳过"。A2A 链式调用被完全阻断。

根因：`8eacef3` 引入的 `invocationTracker.has(threadId)` guard 在检测到线程有活跃 invocation 时直接 return，但 A2A 链天然发生在父 invocation 执行期间（cat A 的 callback @mentions cat B），所以这个 guard 封死了所有合法的 A2A 链。

## 设计文档

- Bug Report: `docs/bug-report/2026-02-14-a2a-callback-chain-blocked/bug-report.md`
- 相关源代码: `8eacef3` (引入 bug 的 commit)

## Spec Compliance 自检

| # | Bug Report 验证要求 | 状态 | 说明 |
|---|-----|------|------|
| 1 | Red test: `tracker.has()` = true 时 A2A 仍被触发 | ✅ | `callback-a2a-trigger.test.js` test 4: routeCalled=1 |
| 2 | `tracker.start()` 不被调用（避免 abort 父 invocation） | ✅ | test 3 & 4: startCalled=0 |
| 3 | 子 invocation 最终 status=succeeded | ✅ | test 4: updates 含 succeeded |
| 4 | `intent_mode` 广播（前端显示 loading） | ✅ | test 4: roomEvents 含 intent_mode |
| 5 | 无父 invocation 时正常 start() + abort check | ✅ | test 1: canceled path 正常工作 |
| 6 | routeExecution 抛错时 error+done 释放 loading lock | ✅ | test 5: error+done(isFinal) 广播 |
| 7 | 全量 API tests 无 regression | ✅ | 1084 passed, 0 failed |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/routes/callback-a2a-trigger.ts` | 修改 | 核心修复: 条件分支替代硬阻断 |
| `packages/api/test/callback-a2a-trigger.test.js` | 修改 | 2 个新 test + 1 个旧 test 更新 |
| `docs/bug-report/2026-02-14-a2a-callback-chain-blocked/bug-report.md` | 新增 | Bug report |

## Git SHA

- Base: `adff820` (origin/main)
- Head: `7113e5c`

## 测试状态

```
pnpm test: 1084 passed, 0 failed, 1 skipped (51.5s)
pnpm build: clean (0 errors)
```

## Review 重点

1. **条件分支逻辑** (`callback-a2a-trigger.ts:61-80`): `parentActive` 判断是否正确？是否存在 race condition？
2. **tracker leak 修复** (`finally` block): 只在 `controller` 存在时调用 `complete()`，子调用（无 controller）不触碰 tracker —— 是否正确？
3. **abort path** (`controller?.signal.aborted` + `complete()`): 原实现缺少 `complete()` 调用导致 tracker 泄漏，修复后是否完整？

## 五件套

**What**: 将 `callback-a2a-trigger.ts` 中的硬阻断 guard 改为条件分支 — 父 invocation 活跃时跳过 `tracker.start()`，让 A2A 作为子调用运行。同时修复 abort path 的 tracker 泄漏。

**Why**: A2A 链天然发生在父 invocation 执行期间，`has()` guard 封死了所有合法的 callback A2A 链。不能直接删 guard 让 `start()` 替换 tracker，因为 `start()` 会 abort 父 invocation 的 controller，导致父猫 CLI 被中途 kill。

**Tradeoff**: 子调用没有独立 tracker 条目，不支持单独 cancel（只能通过 cancel 父来间接取消）。但有 InvocationRecord 审计追踪，对于 callback A2A 这个短生命周期场景可接受。

**Open Questions**: 如果子调用执行时间超长且父已结束，tracker 中无父条目后再来一个 A2A 调用会怎样？理论上走 `!parentActive` 分支，正常 `start()`，应该没问题。

**Next Action**: 请 review 上述 3 个文件，重点关注条件分支逻辑和 tracker 生命周期。

---

✅ Review 请求检查通过
- [x] Bug report 已写 (spec 等价物)
- [x] 自检报告完成 (7 项验证)
- [x] 测试通过 (1084 passed)
- [x] Build 通过 (0 errors)
- [x] 五件套完整
