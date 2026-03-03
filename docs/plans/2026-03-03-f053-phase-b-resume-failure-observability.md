---
feature_ids: [F053]
topics: [gemini, session, resume, observability, docs-sync]
doc_kind: plan
created: 2026-03-03
updated: 2026-03-03
---

# F053 Phase B Resume Failure Observability + Doc Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Close F053 Phase B by adding Gemini resume failure分类统计（missing session / cli exit / auth）并同步仓库口径到“Gemini UUID resume 已支持”。

**Architecture:** 在 `invoke-single-cat` 的既有 self-heal 循环中追加结构化失败分类事件，不改变现有恢复语义（missing session 与 transient exit 仍可重试，auth 仅分类不重试）。分类逻辑放在 invocation helper 纯函数，先用单测锁定，再补实现；文档只更新 active truth-source，不改历史归档。

**Tech Stack:** TypeScript, Node test runner, Fastify backend service layer, Markdown docs.

---

### Task 1: Resume Failure 分类函数（TDD）

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-helpers.ts`
- Test: `packages/api/test/invoke-single-cat.test.js`

**Step 1: Write failing tests**
- 新增测试断言：
  - 缺会话错误归类为 `missing_session`
  - `CLI 异常退出` 归类为 `cli_exit`
  - `authentication failed/unauthorized` 归类为 `auth`
  - 非匹配错误返回 `null`

**Step 2: Run test to verify RED**
- Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/invoke-single-cat.test.js --test-name-pattern "resume failure classification"`
- Expected: 分类函数缺失或断言失败。

**Step 3: Implement minimal classification helper**
- 在 `invoke-helpers.ts` 添加 `classifyResumeFailure(message)` 纯函数与类型。
- 保留现有 `isMissingClaudeSessionError`/`isTransientCliExitCode1` 行为兼容，避免回归。

**Step 4: Run test to verify GREEN**
- 同 Step 2 命令，预期通过。

**Step 5: Commit**
- `git commit -m "feat(F053): classify resume failures for observability"`

### Task 2: invoke-single-cat 失败统计事件（TDD）

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
- Test: `packages/api/test/invoke-single-cat.test.js`

**Step 1: Write failing tests**
- 在现有 self-heal 测试附近新增断言：
  - resume 首次失败被抑制并重试成功时，仍输出 `system_info` 统计（`missing_session`）
  - auth 错误不重试，但输出 `auth` 分类统计
  - transient cli exit（code 1）在 resume 场景可输出 `cli_exit` 分类统计

**Step 2: Run test to verify RED**
- Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/invoke-single-cat.test.js --test-name-pattern "resume failure stats"`
- Expected: 缺少统计事件导致失败。

**Step 3: Implement minimal stats emission**
- 在 resume attempt 中遇到 error 时分类并累计计数。
- 在 invocation 结束前发 `system_info`：`{ type: 'resume_failure_stats', catId, invocationId, counts }`。
- 仅在 `catId === 'gemini'` 且有 resume session 时发，避免噪音。

**Step 4: Run tests to verify GREEN**
- Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/invoke-single-cat.test.js`
- Expected: 全部通过（含新测）。

**Step 5: Commit**
- `git commit -m "feat(F053): emit gemini resume failure stats in invocation stream"`

### Task 3: Active Docs 口径同步（AC-4）

**Files:**
- Modify: `docs/architecture/cli-integration.md`
- Modify: `docs/TECH-DEBT.md`
- Modify: `docs/phases/phase-3.6-debt-cleanup.md`
- Modify: `docs/phases/phase-5.2-backlog-cleanup.md`
- Modify: `packages/api/test/integration/multi-cat.test.js` (注释口径)
- Modify: `docs/features/F053-gemini-resume-session-parity.md`

**Step 1: Update stale wording**
- 将 active docs 中“Gemini UUID resume 不支持/index-only”更新为 F053 纠偏口径。
- 历史上下文保留为“旧结论（已过时）”而非当前事实。

**Step 2: Update F053 AC progress**
- 勾选 AC-4/AC-5（在代码与文档完成后）。
- Timeline 增加 Phase B 记录。

**Step 3: Verify doc consistency**
- Run: `rg -n "Gemini.*(不支持 UUID resume|只接受 index|index/latest).*" docs packages/api/test/integration/multi-cat.test.js -S`
- Expected: active docs 无未纠偏的“当前态”表述（archive 可保留历史语境）。

**Step 4: Commit**
- `git commit -m "docs(F053): sync gemini resume parity wording across active docs"`

### Task 4: Quality Gate + Review Request + Merge Gate

**Files:**
- Create: `docs/mailbox/2026-03-03-f053-phase-b-review-request.md`
- (Optional) Create: `docs/mailbox/2026-03-03-f053-quality-gate-report.md`

**Step 1: Run quality gate commands**
- Run:
  - `pnpm --filter @cat-cafe/api run build`
  - `node --test packages/api/test/invoke-single-cat.test.js`
  - `node --test packages/api/test/gemini-agent-service.test.js`
  - `pnpm lint`（若全量太重，至少提供 API 子集 lint 证据并说明）
- 记录输出摘要与失败/风险项。

**Step 2: Send request-review to gpt52**
- 写五件套 review 请求，明确关注：分类口径、误判风险、测试覆盖。
- 仅在需要动作时使用一行 `@gpt52`。

**Step 3: If reviewer passes, enter merge-gate**
- `git push origin feat/f053-gemini-resume-phase-b`
- `gh pr create ...`
- 调用 `cat_cafe_register_pr_tracking`
- 触发云端 review comment（按模板），等待 P1/P2=0。

**Step 4: Merge + cleanup**
- `gh pr merge --squash --delete-branch`
- 同步 main + 清理 worktree。

---

Plan complete and saved to `docs/plans/2026-03-03-f053-phase-b-resume-failure-observability.md`. I will execute it directly in this session with TDD.
