---
feature_ids: [F061]
related_features: [F061]
doc_type: plan
status: proposed
last_updated: 2026-04-21
---

# F061 Remaining Issues Bundle Plan

**Feature:** F061 — `docs/features/F061-antigravity-bengal-cat.md`
**Goal:** 用两个交付 bundle 收敛 F061 剩余问题：把低风险的可靠性修复合并做掉，同时把高风险的 tool parity 变更单独隔离，避免继续“一问题一 PR”拖慢节奏。
**Acceptance Criteria:**
- 当前真实边界被记录清楚：`grep_search/view_file/list_dir` 可用，`run_command` 在简单 `git log --oneline` 上 `context canceled` 稳定复现，`write/edit`、`model_capacity retry`、fatal → continuity 仍未完整覆盖。
- quota-style provider 文案（如 `You have exhausted your capacity on this model. Your quota will reset after 0s.`）能够被归类为 `model_capacity`，并复用现有 bounded retry/backoff。
- Phase 2c v2 补齐 `READ_FILE` / `WRITE_FILE` / `EDIT_FILE` / `GREP` / `GLOB` 的 step-shape 覆盖与 executor 扩展。
- fatal / `stream_error` / `model_capacity` 之后的 continuity 有明确 regression 保护。
**Architecture:** 拆成两个 bundle。Bundle A 只动 transformer / service / tests / docs，主打低风险可靠性修复；Bundle B 单独处理 executor 与 tool parity，避免把副作用路径和分类/telemetry 改动搅在一起。这样既能减少 PR 数量，又不会把 debug 面铺得过大。
**Tech Stack:** TypeScript, Node test runner, AntigravityBridge, AntigravityAgentService, feature docs
**前端验证:** No

---

## Current Issue Ledger

| Issue | Current Evidence | Risk | Proposed Bundle |
|------|------------------|------|-----------------|
| Bug-D: `run_command` `context canceled` | `@antig-opus` 真实环境 2/2 稳定复现 | High | Bundle B |
| Bug-E: fatal 后 continuity 未锁回归 | 只有 field report，没有 regression | Medium | Bundle A |
| Bug-F: retry 后 silent stall 已止血，但 quota-style capacity 字符串可能绕开 `model_capacity` | 现有分类只匹配 `high traffic/rate limit/too many requests/try again/overloaded` | Medium | Bundle A |
| Phase 2c v2 parity 未完成 | `AC-2cR4` / `AC-2cI6` 仍 open | High | Bundle B |

## Bundle Decision

- **可以合并一起修的：** capacity classifier、retry observability、continuity regression、issue docs。这些都属于 service/transformer/test 面，风险相对集中。
- **不建议和上面混成一个超级 PR 的：** tool parity v2。它会改变真实工具执行路径，副作用面最大，和分类/continuity 混在一起会让失败归因变差。
- **结论：** 不是“一问题一 PR”，也不是“全部一次性塞爆”；建议收成 **2 个 bundle**。

### Bundle A: Reliability Sweep

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-event-transformer.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Modify: `packages/api/test/antigravity-event-transformer.test.js`
- Modify: `packages/api/test/antigravity-agent-service-fatal-errors.test.js`
- Modify: `packages/api/test/antigravity-agent-service.test.js`
- Modify: `docs/features/F061-antigravity-bengal-cat.md`
- Add: `docs/features/F061-verification-2026-04-21.md`

**Step 1: 写 quota-style capacity 分类失败测试**

目标：
- `You have exhausted your capacity on this model. Your quota will reset after 0s.` 必须归类为 `model_capacity`
- 继续保留非 capacity 文案走 `upstream_error`

Run:
```bash
node --test packages/api/test/antigravity-event-transformer.test.js
```

**Step 2: 扩展 capacity classifier**

最小实现：
- 在 `CAPACITY_PATTERNS` 里补 `exhausted your capacity` / `quota will reset`
- 不改已有 `high traffic / rate limit / too many requests / try again / overloaded` 语义

**Step 3: 写 service-level 回归**

目标：
- quota-style `model_capacity` 能沿用现有 retry/backoff
- 仍然维持“无文本、无 tool activity 才自动 retry”的安全边界

Run:
```bash
node --test packages/api/test/antigravity-agent-service-fatal-errors.test.js
```

**Step 4: 补 continuity regression**

目标：
- `fatal / stream_error / model_capacity` 之后，下一轮不会把 thread continuity 悄悄丢掉
- 如果现有 `sessionChain/callback fallback` 路径不够，需要先用测试把边界钉实

候选文件：
- `packages/api/test/invoke-single-cat.test.js`
- `packages/api/test/antigravity-agent-service.test.js`

**Step 5: 文档同步**

更新：
- `docs/features/F061-antigravity-bengal-cat.md`
- `docs/features/F061-verification-2026-04-21.md`

验收：
- 真相源能一眼看出“哪些问题已止血，哪些仍 open，哪些被打包进同一个 bundle”

### Bundle B: Tool Parity v2

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/executors/ExecutorRegistry.ts`
- Modify/Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/executors/*`
- Modify: `packages/api/test/antigravity-bridge-native-execute.test.js`
- Modify: `packages/api/test/antigravity-agent-service-executors.test.js`
- Modify/Create: `packages/api/test/antigravity-*-executor*.test.js`
- Modify: `docs/features/F061-antigravity-bengal-cat.md`

**Step 1: 先补 step-shape 证据，不直接盲写 executor**

目标：
- 覆盖 `READ_FILE / WRITE_FILE / EDIT_FILE / GREP / GLOB`
- 明确哪些 step 是 bridge/LS 支持，哪些是 harness/permission 侧失败

证据源：
- `docs/features/F061-verification-2026-04-21.md`
- `docs/research/2026-04-17-f061-phase-2c-probe-results.md`

**Step 2: 写 failing executor/dispatch tests**

目标：
- registry 能正确识别新 step
- unsupported step 继续 fail-fast，不回退成 silent stall
- `run_command` 的已知 `context canceled` 场景有明确 regression 描述，不再只是 field report

Run:
```bash
node --test packages/api/test/antigravity-bridge-native-execute.test.js packages/api/test/antigravity-agent-service-executors.test.js packages/api/test/antigravity-run-command-executor.test.js
```

**Step 3: 最小实现 v2 executors**

范围：
- `read_file`
- `write_file`
- `edit_file`
- `grep_search`
- `file_glob`

要求：
- 只做与现有 LS/bridge 契约一致的最小实现
- 不引入“看起来成功，实则 silent no-op”的假 executor

**Step 4: 真实环境复验**

由 `@antig-opus` 复跑：
- 只读搜代码
- `run_command`
- 写文件 / 改代码
- 如果命中 capacity retry，记录是显式报错还是恢复

**Step 5: 文档同步**

更新：
- `docs/features/F061-antigravity-bengal-cat.md`
- `docs/features/F061-verification-2026-04-21.md`

## Execution Recommendation

1. 先做 **Bundle A**，因为它小、快、风险集中，而且能直接把 quota-style capacity gap 和 continuity gap 收住。
2. 再做 **Bundle B**，因为 `run_command/context canceled` 和完整 tool parity 是现在最大的真实可用性阻塞。
3. 不建议把 A+B 硬塞成一个 PR；那会把“分类/重试/continuity”与“真实工具副作用路径”搅在一起，review 和回归都会变慢。
