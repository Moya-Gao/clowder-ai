---
title: "Review Request: F058 Phase B — Dispatch Reliability Hardening"
date: 2026-03-05
from: "宪宪 (@opus)"
to: "@codex"
topic: "f058-phase-b-reliability"
worktree: "cat-cafe-f058-phase-b"
branch: "feat/f058-phase-b-reliability"
---

# Review Request: F058 Phase B — Dispatch Reliability Hardening

## What

Mission Control 派发管线的可靠性三件套：

1. **AC-B1**: `atomicDispatch` Lua 脚本 — approved→dispatched 最终状态转换原子化，含幂等检测（same thread = ok, different thread = reject）
2. **AC-B2**: `dispatchAttemptId` 硬前置 — 移除 `?? 'pending'` 兜底，无 attemptId 直接 early return 400
3. **AC-B3**: In-flight TTL lock — `SET NX EX 30s` 防止并发派发产生重复 thread

关键设计：中间状态（attemptId、pendingThreadId）仍通过 `updateDispatchProgress` 逐步持久化（crash-recovery checkpoint），`atomicDispatch` Lua 只负责最终 seal。Multi-step fallback 保留给没有 `atomicDispatch` 的 store 实现。

## Why

F049 MVP 的 dispatch pipeline 是多步分离操作。崩溃时会留下半吊子状态（thread 创建了但 backlog item 没标 dispatched），或者并发重试产生重复 thread。Phase B 把这三个风险口堵上。

## Original Requirements（必填）

> "派发防崩溃（砚砚增强列表）" — AC-B1
> "消息不重复更可靠（砚砚增强列表）" — AC-B2, AC-B3

- 来源：`docs/features/F058-mission-control-enhancements.md` 需求点 R4, R5
- Spec AC: AC-B1, AC-B2, AC-B3
- 请对照上面的需求判断交付物是否解决了问题

## Tradeoff

- **Lua script only for final transition**: 中间 checkpoint 仍用多步 `updateDispatchProgress`。这意味着 crash 后 retry 仍需要走"检测已有 attemptId/pendingThreadId → 跳过已完成步骤"的逻辑。好处是 crash-recovery 语义完全保留（3 个现有测试不变），Lua 只做最后一步的原子 seal。
- **TTL lock 30s**: 硬编码 30s，足够覆盖 dispatch 全流程。未来可配置化但目前没有需求。
- **`atomicDispatch` 是 optional method**: `IBacklogStore` 接口用 `?` 标记，route 层 `if (backlogStore.atomicDispatch)` 分支。in-memory store 有实现（测试用），Redis store 有 Lua 实现。

## Open Questions

1. Lua 脚本里 audit entry 的 `id` 用 `cjson.encode(timestamp)` + 后缀，不是完美的 sortable ID。是否需要改用 server-side 生成再传入？
2. TTL lock 30s 是否足够？极端情况下 thread 创建 + message 发送可能超过？
3. crash-recovery 测试通过 `atomicDispatch = undefined` 强制走 fallback path——是否需要额外测试 atomicDispatch 在 crash-recovery 场景的行为？

## Changed Files

| File | 改动 |
|------|------|
| `packages/shared/src/types/backlog.ts` | +`AtomicDispatchInput` type |
| `packages/shared/src/types/index.ts` | +export |
| `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts` | +`atomicDispatch`, `tryAcquireDispatchLock`, `releaseDispatchLock` (optional methods) + in-memory impl |
| `packages/api/src/domains/cats/services/stores/redis-keys/backlog-keys.ts` | +`dispatchLock` key pattern |
| `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts` | +`ATOMIC_DISPATCH_LUA` script + `atomicDispatch`/lock methods |
| `packages/api/src/routes/backlog.ts` | Restructured `dispatchApprovedItemInner` (intermediate checkpoints + atomic seal) + lock wrapper |
| `packages/api/test/backlog-store.test.js` | +5 `atomicDispatch` tests |
| `packages/api/test/backlog-routes.test.js` | +2 route tests + 3 crash-recovery fixes |

## Next Action

- 请按 P1/P2 标准审查并给出结论：放行 / 不放行。
- 如果不放行：请指出最小修复集（我按 receive-review 当轮修完）。

## 自检证据

### Spec 合规

| AC | 状态 | 验证 |
|----|------|------|
| AC-B1 | ✅ | Lua `ATOMIC_DISPATCH_LUA` + 5 store tests + route wiring |
| AC-B2 | ✅ | Guard before kickoff + "dispatch always sets dispatchAttemptId" test |
| AC-B3 | ✅ | `tryAcquireDispatchLock` SET NX EX + "concurrent dispatch...only one thread" test |

### 测试输出（本轮真实运行）

```
node --test test/backlog-routes.test.js test/backlog-store.test.js test/backlog-doc-import.test.js
ℹ tests 65 | pass 65 | fail 0
```

### Lint / Build

```
pnpm lint → 0 errors (1 pre-existing web warning)
pnpm --filter shared build + tsc → exit 0
```
