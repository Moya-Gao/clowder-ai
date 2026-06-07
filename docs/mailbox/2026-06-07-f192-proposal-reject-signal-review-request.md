# Review Request: F192 wire proposal reject as task-outcome A2 signal

Review-Target-ID: f192-proposal-reject-signal
Branch: feat/f192-proposal-reject-signal

## What

Add `proposal_reject` as a new A2 signal type in the task-outcome eval pipeline. Wire F128 thread proposal reject and F225 session handoff proposal reject into the eval signal store.

6 files, +201/-3:
- Schema: new `proposalRejectRecordSchema` in discriminated union
- Builder: `buildProposalRejectSignal()` with truncation
- Routes: `onProposalReject` callback in proposal-routes + session-handoff-approve-routes
- Wiring: shared callback in index.ts (same pattern as `onPermissionCancel`)
- Tests: +3 (F128, F225, truncation)

## Why

eval:task-outcome daily cron (F192 Phase G) showed 0 cancel/deny signals for 3 days. Day-3 verdict escalated to `fix` assuming the authorization deny hook was broken. Investigation revealed two issues:
1. The authorization audit (48 entries, 0 denied) was correct -- users never deny tool permissions
2. But CVO pointed out he had rejected many **thread creation proposals** (F128) -- which is a completely separate API surface (`/api/proposals/:id/reject`) that was never wired into the eval signal pipeline

antig-opus (孟加拉猫) confirmed: `proposal-routes.ts:235` reject handler and `session-handoff-approve-routes.ts:243` reject handler both had zero references to eval/signal/task-outcome.

## Original Requirements

> 等会不可能啊 我明明 拒绝过你们好多次创建新的thread的你们这有检测f128 的以及f225的那些嘛？
- 来源：eval:task-outcome domain thread, 铲屎官 2026-06-07 14:04 UTC
- **请对照上面的摘录判断：proposal_reject 信号是否覆盖了 F128 和 F225 两个拒绝面**

## Tradeoff

考虑过复用 `permission_cancel` type (toolName='propose_thread')，放弃，因为：
- CancelReason enum (`should_not_do`/`wrong_direction`/`i_will_do_it`/`skip`) 与 proposal rejectionReason (free text) 语义不匹配
- 新 type 让 eval consumer 精确区分"工具权限被拒"vs"提案被拒"

## Architecture Ownership

Architecture cell: harness-eval/task-outcome
Map delta: none
Why: 扩展已有 A2 discriminated union，不改 cell boundary / owner / canonical anchor

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding（答案应为否）

## Open Questions

### 技术 OQ

1. `onProposalReject` callback 在 route 层是 best-effort (try/catch)。这与 `onPermissionCancel` 模式一致，但 reviewer 确认：eval signal 录入失败静默丢弃是否可接受？（我认为可以——eval 是诊断层不是业务层）
2. F225 session handoff reject handler 没有 rejectionReason 字段（API 不接受 body）。信号中 `rejectionReason` 为 undefined。是否需要补充？

### 价值 OQ

无

## Next Action

请 reviewer 审查信号 schema 正确性、callback 接线模式、无回归。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f192-proposal-reject-signal/gpt52`
- Start Command: `pnpm review:start`
- Ports: 纯后端改动无前端 UI，测试验证优先于 sandbox 启动

## 自检证据

### Spec 合规
- F192 AC-G8 scope 扩展，覆盖 F128 + F225 两个拒绝面
- 信号 schema 与既有 A2 类型（permission_cancel / magic_word / magic_word_ref）保持一致的 discriminated union 结构

### 测试结果
```
pnpm tsc --noEmit              # 0 errors
Related tests (98 total):       # 98 passed, 0 failed
  - task-outcome-episode.test.js
  - task-outcome-cancel-recorder.test.js (+3 new tests)
  - task-outcome-store.test.js
  - authorization-routes.test.js
  - proposal-flow.test.js
  - proposal-concurrency.test.js
Pre-existing failures (not in diff scope):
  - codex-agent-service.test.js (workspace root assertion)
  - dispatch-gate-schema.test.js
```

### 相关文档
- Feature: F192 Phase G (eval:task-outcome)
- Discovery: eval:task-outcome domain thread day-3 verdict + 铲屎官 push back
- Related: F128 (thread proposals), F225 (session handoff proposals)
