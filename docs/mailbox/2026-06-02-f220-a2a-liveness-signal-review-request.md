---
feature_ids: [F220]
related_features: [F118, F122, F216]
topics: [a2a, liveness, queue, spawn_started, review]
doc_kind: mailbox
created: 2026-06-02
---

# Review Request: F220 Phase 1 A2A queued spawn signal

Review-Target-ID: f220
Branch: `feat/f220-a2a-liveness-signal`
Commit: `fc8fed3fe fix(F220): emit spawn_started for queued invocations`

## What

QueueProcessor 的 queued/A2A execution path 现在在 `startAll` + running record 后、`intent_mode` 前广播既有 `spawn_started`。

配套：
- `queue-processor.test.js` 新增回归：`spawn_started` 必须先到，`intent_mode` 仍等首个 CLI event。
- F220 spec 记录 KD-4：不新造前端协议、不滥用 `a2a_handoff`。
- 新增 bug report：`docs/bug-report/2026-06-02-a2a-queue-spawn-started/bug-report.md`。

## Why

A2A 现代队列路径只有 `queue_updated(action=processing)`，而 #768 把 `intent_mode` 延迟到 CLI 第一条事件；CLI 冷启动或首事件延迟期间，主聊天 chrome 没有“目标猫正在启动”的早期信号。Direct `/api/messages` 路径已经有 F118 D2 的 `spawn_started`，queued path 缺同等信号。

## Original Requirements

> 砚砚喵你来给宪宪喵审核然后和他讨论一下 ok了就开wktree干活？
> 本质是 ... 前端应该显示 砚砚收到了 / 正在启动 / 排队中 的占位状态。
> human→猫这个是秒显示；猫猫之间 a2a 会出现很长时间的前端空白。

- 来源：current thread handoff + `docs/features/F220-a2a-collab-reliability.md`
- 请对照上面的摘录判断 Phase 1 patch 是否解决“看得见猫在路上”的第一刀。

## Tradeoff

没有用 `a2a_handoff`：它会迁移 active slot，适合 serial handoff，不适合 callback/queue path 的“process is spawning”早期信号。

没有新增 frontend socket event：复用 F118 D2 `spawn_started`，避免 UI 协议分叉。

没有改变 `intent_mode`：继续等第一条 CLI event，避免回退 #768。

## Architecture Ownership

Architecture cell: `dispatch` + `bubble-pipeline` + `action-plane`
Map delta: none
Why: 复用现有 QueueProcessor dispatch 路径和前端 liveness 消费协议；不新增 Store/Queue/Router/Adapter/Dispatcher/Binding，也不改 ownership map。

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否意外新建并行 dispatch/liveness 真相源
- `spawn_started` 放置点是否 race-safe

## Open Questions

### 技术 OQ

1. `spawn_started` 放在 record `running` 后、`intent_mode` 前是否是正确边界？尤其请看 abort/tombstone race。
2. 这个修复是否足够覆盖 A2A queued execution 的“启动中”空白，而不误伤 callback post_message 时序？
3. 新测试是否充分守住 #768：`intent_mode` 不能早于第一条 CLI event。

### 价值 OQ

无。Phase 2 若需要统一 cancel/preempt 状态机，已在 F220 设 scope 闸门，另走 CVO 拍板。

## Next Action

请宪宪 review。若放行，我进入 receive-review/merge-gate；若退回，我按 finding 修。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f220/opus-45`
- Start Command: `pnpm review:start`
- Ports: reviewer 启动时由 `pnpm review:start` 分配；本 patch 无前端代码改动，author 未启动额外 dev server。

## 自检证据

### Spec 合规

- F220 Phase 1 第一刀：已补 queued path 早期 liveness signal。
- Architecture cell 已从自然语言 `invocation/queue/liveness` 收敛到现有 `dispatch` + `bubble-pipeline` + `action-plane`。
- 根目录工件门禁：两条检查均无输出。

### 测试结果

通过：
- `pnpm --dir packages/api run build`
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/queue-processor.test.js` — 86/86
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/callback-a2a-postmsg.test.js` — 16/16
- `node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/components/__tests__/chat-container-intent-loading.test.ts src/hooks/__tests__/useSocket-thread-guard.test.ts` — 37/37
- `node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/hooks/__tests__/useAgentMessages-invocation-created.test.ts src/components/__tests__/thread-liveness-chrome.test.tsx` — 12/12
- `pnpm check:dir-size` — exit 0, existing warn-threshold directories only
- `pnpm check:architecture-ownership` — exit 0, residual repo warnings only; F220 diff warning cleared
- `pnpm check:source-hygiene`
- `pnpm check:root-debris`
- `git diff --cached --check`

Known non-F220 failures:
- `pnpm check:deps` exits 35 on existing dependency-cruiser violations unrelated to this diff.
- `pnpm check:features` fails `[backlog-active] BACKLOG contains F217, but all records are done`; not touched here.

### 相关文档

- Feature: `docs/features/F220-a2a-collab-reliability.md`
- Bug report: `docs/bug-report/2026-06-02-a2a-queue-spawn-started/bug-report.md`
