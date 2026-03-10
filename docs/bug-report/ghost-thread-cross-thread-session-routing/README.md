---
feature_ids: []
topics: [routing, session, invocation, cross-thread]
doc_kind: bug-report
created: 2026-03-10
status: open
severity: P2
---

# Ghost Thread Bug — 跨线程 Session 路由错误

> 发现日期：2026-03-10 | 发现者：铲屎官 + 布偶猫 + 缅因猫(GPT-5.4)
> Status: **OPEN — 已加诊断日志，等待复现抓现场**

## 现象

铲屎官在**线程 A** (thread_mmimwq9d41r9lhu8) `@opus`，期望线程 A 已有的布偶猫实例回复。
但实际回复的是**线程 2** 的布偶猫实例——一只完全不同的 opus session，带着线程 2 的上下文。

表现为"隔壁线程的猫跑过来了"。

## 复现条件（推测）

1. **线程 A** 有活跃的 opus session (Session 1)
2. **线程 2** 有活跃的 opus session (Session 2)
3. Session 2 通过 `cat_cafe_post_message` **跨线程投递**消息到线程 A
4. Session 2 的原始 session **跑满上下文**，触发 continuation
5. 铲屎官在线程 A `@opus` → 路由到了 Session 2（而非 Session 1）

关键触发因素：**跨线程 post + context 跑满 + continuation**

## 排查结论（代码分析）

### 已排除的路径

| 路径 | 结论 | 说明 |
|------|------|------|
| `AgentRouter.resolveTargets` | ✅ 正确 | 只解析 catId，fallback 基于当前 threadId |
| `callbacks.ts /pending-mentions` | ✅ thread-scoped | `getMentionsFor` 传了 `record.threadId` |
| `callbacks.ts /post-message` | ✅ 正确 | `effectiveThreadId` ≠ `record.threadId`，不会改写 invocation 归属 |
| `InvocationRegistry` | ✅ 正确 | key = `${threadId}:${catId}` |
| `SessionManager` | ✅ 正确 | key = `${userId}:${catId}:${threadId}` |
| `SessionChainStore` | ✅ 正确 | active key = `catId:threadId` |

### 最可能的根因

**Continuation / callback credential 线程错绑**：

1. **假设 A**：Session 2 context continuation 后，新 invocation record 被错误创建为线程 A 的 `threadId`（可能因为最后一次交互是对线程 A 的 cross-post）
2. **假设 B**：Session 2 的 CLI 进程拿到了线程 A 的 `CAT_CAFE_INVOCATION_ID / CALLBACK_TOKEN`

只要发生其中一个，后续 `/pending-mentions`、`post-message`、WS broadcast 都会"看起来合法"，表现成"隔壁线程的猫过来了"。

## 已加诊断日志

| 位置 | 文件 | 标签 |
|------|------|------|
| 跨线程 post 检测 | `packages/api/src/routes/callbacks.ts` post-message | `[DIAG/ghost-thread] post-message: cross-thread detected` |
| pending-mentions 轮询 | `packages/api/src/routes/callbacks.ts` pending-mentions | `[DIAG/ghost-thread] pending-mentions: polling` |
| invocation 创建 | `packages/api/src/.../invoke-single-cat.ts` | `[DIAG/ghost-thread] invokeSingleCat: created invocation` |
| session_init 绑定 | `packages/api/src/.../invoke-single-cat.ts` | `[DIAG/ghost-thread] session_init: binding session` |

## 复现时验证步骤

1. 查两个线程的 active session：
   - `GET /api/threads/:threadId/sessions?catId=opus`
   - 看线程 A 和线程 2 的 active `cliSessionId` 是否各自独立

2. 在日志中搜索 `[DIAG/ghost-thread]`：
   - `invokeSingleCat` 的 `threadId` 是否符合预期
   - `session_init` 绑定的 `threadId` 是否被偷换
   - `post-message` cross-thread 检测是否在 continuation 前后都正确

3. 对比 continuation 前后的 `invocationId` + `record.threadId`，确认是否发生了线程漂移

## 清理计划

日志标签统一用 `[DIAG/ghost-thread]`，定位后搜索此标签一次性清除。
