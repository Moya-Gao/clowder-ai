---
feature_ids: [F039, F050]
topics: [github-review, notification, f5, identity, plan]
doc_kind: plan
created: 2026-03-02
---

# GitHub Review F5 Notification Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 修复 GitHub review connector 消息在部分 thread 中刷新（F5）后“可见性丢失”的问题，确保实时可见与历史重载一致。

**Architecture:** 根因假设是“通知实时广播与历史读取的身份维度不一致”：ReviewRouter 按 PR tracking 的 `userId` 写消息，但历史接口按当前用户过滤，导致 stale tracking 时出现“实时能看到，刷新后消失”。修复策略是在 registry 路由时优先使用 thread owner 作为消息 userId（tracking userId 仅作为 fallback），并补回归测试覆盖该场景。

**Tech Stack:** TypeScript, Fastify API, in-memory test doubles, Node test runner.

---

### Task 1: 记录 bug report（Debugging 五件套）

**Files:**
- Create: `docs/bug-report/2026-03-02-github-review-f5-thread-visibility/bug-report.md`

**Step 1: 写 bug report（先于修复）**
- 记录报告人、复现步骤、期望/实际、根因假设、修复方案、验证方式。

**Step 2: 自检内容完整性**
- 确认包含“为什么有些 thread 有问题、有些没有”的差异性解释。

### Task 2: Red — 新增失败测试复现 stale tracking userId 场景

**Files:**
- Modify: `packages/api/test/review-router.test.js`

**Step 1: 写失败测试**
- 场景：thread owner=`alice`，tracking.userId=`bob`（stale），路由后消息应归属 `alice`。
- 断言：`message.userId === thread.createdBy`，且 `RouteResult.userId` 同步。

**Step 2: 运行单测确认失败（Red）**
Run: `pnpm --filter @cat-cafe/api test -- review-router.test.js`
Expected: 新增用例失败，现行为使用 tracking.userId。

### Task 3: Green — 在 ReviewRouter 修复身份对齐

**Files:**
- Modify: `packages/api/src/infrastructure/email/ReviewRouter.ts`

**Step 1: 实现最小修复**
- 新增 registry 路由 userId 解析逻辑：
  - 优先 thread owner（若存在且非 `system`）
  - fallback 到 tracking.userId/default
  - mismatch 打 warning 日志
- 确保 `postReviewMessage(...)` 和 `RouteResult.userId` 使用统一 resolved userId。

**Step 2: 运行单测确认通过（Green）**
Run: `pnpm --filter @cat-cafe/api test -- review-router.test.js`
Expected: 全绿。

### Task 4: 回归验证

**Files:**
- No additional code changes expected

**Step 1: 运行关联测试集**
Run: `pnpm --filter @cat-cafe/api test -- messages-endpoint.test.js callback-routes.test.js`
Expected: 全绿，无回归。

**Step 2: 可选构建验证**
Run: `pnpm --filter @cat-cafe/api build`
Expected: build 成功。

### Task 5: 质量门禁与 reviewer 交接

**Files:**
- Create: `docs/mailbox/2026-03-02-f5-github-review-visibility-review-request-to-gpt52.md`

**Step 1: quality gate 自检摘要**
- spec 对照、风险点、测试证据。

**Step 2: 生成 review 请求（五件套）**
- 明确 What/Why/Tradeoff/Open/Next，指向改动文件与测试命令。
