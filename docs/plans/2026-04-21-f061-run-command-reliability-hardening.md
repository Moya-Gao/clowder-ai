---
feature_ids: [F061]
related_features: [F061]
doc_type: plan
status: proposed
last_updated: 2026-04-21
---

# F061 Run Command Reliability Hardening Implementation Plan

**Feature:** F061 — `docs/features/F061-antigravity-bengal-cat.md`
**Goal:** 把 `run_command` 的 approval / dispatch / capacity 脆弱性拆成可实现、可验证的 4 条工作线，先补可观测与判定，再决定是否做更重的 bypass。
**Acceptance Criteria:**
- 能明确区分一次 `run_command` 失败是卡在 approval、dispatch 还是 writeback，而不是只看到笼统的 `model_capacity` / `context canceled`
- 只对确认**未 dispatch**且**只读**的命令允许自动重试
- 真实危险命令在任何 approval hint 发出之前就会被本地拒绝
- 若现有 approval correlation 不足，再进入更重的 bypass / stream writeback 方案评估
**Architecture:** 先补 execution journal + layer-tagged errors，解决“看不见”的问题；再补 approval correlation，解决“打错层”的问题；最后才讨论 read-only retry 和 bypass。这样避免在缺乏证据时盲目加 retry 或直接跳进重型写回方案。
**Tech Stack:** TypeScript, Node test runner, AntigravityBridge, AntigravityAgentService, feature docs
**前端验证:** No

---

### Task 1: Execution Journal + Layer-Tagged Errors

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-event-transformer.ts`
- Modify: `packages/api/test/antigravity-bridge-native-execute.test.js`
- Modify: `packages/api/test/antigravity-agent-service-fatal-errors.test.js`

**Step 1: Write failing tests for phase visibility**

目标：
- `run_command` 失败时，至少能区分：
  - `approval_timeout_before_dispatch`
  - `capacity_before_dispatch`
  - `dispatch_failed`
  - `writeback_failed`

Run:
```bash
node --test packages/api/test/antigravity-bridge-native-execute.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js
```

**Step 2: Add minimal execution journal**

最小实现：
- Bridge / Service 日志增加明确阶段事件：
  - `approval_sent`
  - `approval_guard_failed`
  - `rpc_sent`
  - `rpc_returned`
  - `writeback_sent`
  - `terminal_error`
- 错误 metadata 带 `dispatchState` / `layer`

**Step 3: Re-run tests**

Run:
```bash
node --test packages/api/test/antigravity-bridge-native-execute.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js
```

### Task 2: Approval Correlation Validation

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- Modify: `packages/api/test/antigravity-bridge-native-execute.test.js`
- Modify: `docs/features/F061-antigravity-bengal-cat.md`

**Step 1: Write failing tests for approval path split**

目标：
- 区分“前置拦截（立即拒绝）”和“approval 等待（超时取消）”
- 验证 `HandleCascadeUserInteraction { permission: { allowed: true }, trajectoryId, stepIndex }` 的 step 绑定是否完整

**Step 2: Minimal implementation**

最小实现：
- 不做 bypass
- 只把 correlation 所需字段和错误类打齐，确认我们知道是哪一层拒绝/超时

### Task 3: Safe Retry for Undispatched Read-Only Commands

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/executors/RunCommandExecutor.ts`
- Modify: `packages/api/test/antigravity-agent-service-fatal-errors.test.js`
- Modify: `packages/api/test/antigravity-run-command-executor.test.js`

**Step 1: Write failing tests for safe retry gate**

目标：
- `pwd` / `ls` / `git log` 这类只读命令在**未 dispatch**且命中 `model_capacity` 时允许 retry
- 写文件/危险命令不允许被静默重试

**Step 2: Add the narrowest possible policy**

实现要求：
- 先只支持显式白名单
- 前提必须是 `rpc_sent=false`
- 任何不满足条件的命令保持现有终止语义

### Task 4: Evaluate IDE Approval Bypass / Stream Writeback

**Files:**
- Modify later only if Task 1-3 evidence proves needed
- Likely candidates:
  - `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
  - `packages/api/src/domains/cats/services/agents/providers/antigravity/executors/*`
  - `docs/research/*`

**Step 1: Spike only — no implementation by default**

目标：
- 只有在 Task 2 证明现有 approval correlation 永远不够时，才继续
- 核对 `HandleCascadeUserInteraction { runCommand }`、`StreamTerminalShellCommand`、或其它 proto 方法是否存在真正可用的 bypass/writeback 契约

**Step 2: Exit criteria**

- 如果找不到确定性协议 → 记录否决理由，不实现
- 如果找到确定性协议 → 再单独开下一轮计划，不和上面 3 条混做

## Execution Recommendation

1. 先做 Task 1，解决“到底有没有执行”的可观测问题
2. 再做 Task 2，证明 approval 失败到底卡在哪一层
3. 只有 Task 1-2 证据到位，才做 Task 3 的 safe retry
4. Task 4 一律作为 spike，除非前 3 条明确证明必须升级到 bypass / stream writeback
