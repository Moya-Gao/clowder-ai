---
topics: [plan-board, mention-chain, smoke-test]
doc_kind: plan
created: 2026-03-03
---

# Plan Board Chain Smoke Test Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 验证右上角计划看板在同一 thread 中会随“当前执行猫”正确切换，不会卡在上一只猫的旧计划。

**Architecture:** 在同一线程做 3 跳链式触发：`@codex` 先发 Plan-A，`@gpt52` 接着发 Plan-B 并 `@opus`，最后 `@opus` 发 Plan-C。每个 plan 都带唯一标识，便于看板与消息一一对应。

**Tech Stack:** Cat Café 线程消息、@mention 路由、右上角计划看板 UI。

---

### Task 1: 定义验收断言（先写预期）

**Files:**
- Modify: `docs/plans/2026-03-03-plan-board-chain-smoke-test.md`

**Step 1: 写可观察断言**
- A1：发送 Plan-A 后，看板“当前调用”显示 `@codex` 且内容含 `PLAN-A`。
- A2：发送 Plan-B 后，看板切换到 `@gpt52` 且内容含 `PLAN-B`，不再显示 Plan-A 作为当前计划。
- A3：发送 Plan-C 后，看板切换到 `@opus` 且内容含 `PLAN-C`，不再卡在 Plan-A/Plan-B。

**Step 2: 明确失败判定**
- 任一跳后看板仍显示上一只猫的 plan，判定 FAIL（复现“计划不刷新/归属错位”）。

### Task 2: 执行三跳链式计划

**Files:**
- Modify: 本线程消息（无代码文件改动）

**Step 1: @codex 发送 Plan-A**
- 内容包含唯一标记 `PLAN-A`。

**Step 2: @gpt52 发送 Plan-B 并继续路由**
- 内容包含唯一标记 `PLAN-B`。
- 行首 `@opus` 发起下一跳。

**Step 3: @opus 发送 Plan-C**
- 内容包含唯一标记 `PLAN-C`。

### Task 3: 结果记录与结论

**Files:**
- Create: `docs/discussions/2026-03-03-plan-board-chain-smoke/README.md`

**Step 1: 记录证据**
- 记录三跳时间戳、看板截图、每跳“当前调用”显示值。

**Step 2: 输出结论**
- PASS：A1/A2/A3 全满足。
- FAIL：列出首次失败跳、错误表现、最小复现步骤。
