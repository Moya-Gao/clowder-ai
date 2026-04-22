---
feature_ids: [F061]
related_features: [F061]
doc_type: mailbox
status: in_review
created: 2026-04-21
last_updated: 2026-04-21
owner: 缅因猫/砚砚
reviewer: 布偶猫 Sonnet
---

# Review Request: F061 Runtime Hardening (Task 1-3)

Review-Target-ID: f061
Branch: feat/f061-runtime-hardening

## What
本轮收的是 F061 `run_command` 可靠性 hardening 的 Task 1-3：

1. 给 `model_capacity` / approval failures 补 `execution journal + layer-tagged diagnostics`
2. 把 approval 失败拆成 `approval_gate + denied|timeout`
3. 只对“未 dispatch 的只读 `run_command`”开放 bounded fresh-cascade retry

代码落点：
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/executors/RunCommandExecutor.ts`
- `packages/api/test/antigravity-agent-service-fatal-errors.test.js`
- `packages/api/test/antigravity-run-command-executor.test.js`

## Why
我们已经确认 F061 的 `run_command` 不稳不是单点故障，而是 approval / dispatch / capacity 三层脆弱性叠在一起。没有分层诊断前，`model_capacity` / `context canceled` / `user denied permission` 都只会表现成“没跑起来”，后续修复会继续盲打。

这一轮先做最小可验证基座：
- 失败时知道卡在 approval 还是 provider capacity
- 只在确认“未 dispatch + 只读”时才自动 retry
- 不提前承诺 IDE bypass / stream writeback 已存在

## Original Requirements（必填）
> "那你记录issue 一下？ commit push 后 然后开始修这四个？"
>
> "那你直接开始定位，负责这个bug的闭环？不需要干一会问我一下？直接和你的队友猫猫们合作就行 ？记得我之前说的那样，重要的bug定位记得写清楚代码的comments？ 以及检查是不是有comments是过时的"
>
> "那你赶紧闭坏！哈哈哈别at我 at你的小伙伴如果要review什么的"

- 来源：`docs/discussions/2026-04-21-f061-runtime-hardening/README.md`
- **请对照上面的摘录判断交付物是否真的把 Task 1-3 闭成可继续推进的终态基座**

## Tradeoff
- 我没有在这轮直接实现 IDE approval bypass / `StreamTerminalShellCommand`
- `isReadOnlyRunCommand()` 先走保守白名单，不做复杂命令语义分析
- 诊断先打在 service error metadata，不额外引入新的持久审计存储

这些取舍是故意的：先把“是否未 dispatch、是否只读、是否 approval_gate”讲清楚，再决定要不要上重型协议实现。

## Open Questions
1. `toolishRetryEligible` 这个门槛放在 service 层、按命令白名单判断，你是否认可这个边界？
2. 当前 `approval_gate` / `provider_capacity` 的 diagnostics 粒度够不够支撑后续 Task 4 判断？
3. 你是否同意把 Task 4 默认收敛成“先给出 no-bypass 结论或 spike 结论”，而不是继续在这条分支里膨胀实现？

## Next Action
请 review `dd26600a2`（包含 `7565a5ced` / `bff5cdf46` / `dd26600a2` 三个连续提交）并重点看：
- 诊断字段命名和分层是否清楚
- safe retry 是否真的只放开“未 dispatch 的只读命令”
- 是否有注释已经过时或仍然不够清楚

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f061/sonnet`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- Plan: `docs/plans/2026-04-21-f061-run-command-reliability-hardening.md`
- Feature: `docs/features/F061-antigravity-bengal-cat.md` 的 `Next Reliability Queue (2026-04-21)`
- Task 1-3 对照结果：
  - Task 1 ✅ `failureLayer + dispatchState + executionJournal` 已补
  - Task 2 ✅ approval failures 已拆成 `approval_gate.denied|timeout`
  - Task 3 ✅ 只读未 dispatch 命令 safe retry 已补，写入/危险命令仍终止
  - Task 4 ⏸️ 本轮未实现，保留为 spike / 结论判断

### 测试结果
- `node --test packages/api/test/antigravity-bridge-native-execute.test.js packages/api/test/antigravity-run-command-executor.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js` → `41 passed, 0 failed`
- `CI=1 NODE_ENV=development pnpm --filter @cat-cafe/api run build` → 成功
- `pnpm lint` → 成功（有既有 web warnings，无新 error）
- `pnpm check` → 成功
- 根目录工件闸门：
  - `git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 空
  - `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 空

### 相关文档
- Discussion: `docs/discussions/2026-04-21-f061-runtime-hardening/README.md`
- Plan: `docs/plans/2026-04-21-f061-run-command-reliability-hardening.md`
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
