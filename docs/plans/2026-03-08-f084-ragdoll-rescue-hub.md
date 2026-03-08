# F084 Ragdoll Rescue Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 在 Config Hub 账号配置页提供“扫描坏掉的布偶猫 + 一键救活选中 session”的完整闭环，基于已合入的 Claude thinking rescue 脚本和错误分类能力，为铲屎官提供无需进入 Claude CLI 的自救入口。

**Architecture:** 后端新增一个轻量 rescue route，复用 `scripts/rescue-claude-thinking-signature.mjs` 的扫描/修复核心逻辑；前端在 `HubProviderProfilesTab` 内新增独立 rescue section，通过 checklist + toast 呈现扫描结果与执行回执。V1 只支持 Claude / session 级 rescue，不做自动自愈，也不把 profile 配置和 session 修复混成同一个模型。

**Tech Stack:** Fastify routes, existing Claude rescue script logic, React client components, Vitest/node:test, existing Hub UI patterns.

---

## Straight-Line Check

- **Finish line:** 铲屎官在 Hub 的“账号配置”页里完成一次“扫描坏掉的布偶猫 → 勾选 session → 一键救活 → 收到结果反馈”的闭环，不用打开 Claude CLI。
- **Not building:** 自动自愈、Codex/Gemini 通用医院、modal-heavy 运维中心、恢复私有 thinking 历史。
- **Terminal schema:**
  - API scan response:
    - `sessions: Array<{ sessionId, transcriptPath, removableThinkingTurns, detectedBy }>`
  - API rescue response:
    - `status: 'ok' | 'partial' | 'noop'`
    - `rescuedCount`
    - `skippedCount`
    - `results: Array<{ sessionId, status, removedTurns, backupPath?, reason? }>`
  - UI state:
    - `scanState`
    - `selectedSessionIds`
    - `rescueResult`

## Task 1: 提炼可复用的 rescue 核心

**Files:**
- Create: `packages/api/src/domains/cats/services/session/ClaudeThinkingRescue.ts`
- Modify: `scripts/rescue-claude-thinking-signature.mjs`
- Test: `packages/api/test/claude-thinking-rescue.test.js`

**Step 1: Write the failing test**

- 覆盖两个入口复用同一核心：
  - API 侧可以扫描坏 session
  - API 侧可以修复单条 session 并返回结果
- 反例：用户文本只提到错误短语时，不应被判坏

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/claude-thinking-rescue.test.js
```

Expected: FAIL，缺少 API 可复用 rescue 模块

**Step 3: Write minimal implementation**

- 把脚本里的“扫描 / 纯 thinking 判定 / 备份 / 修复 / 结果结构化”抽到共享模块
- CLI 脚本改为调用共享模块，而不是保留第二套逻辑

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/claude-thinking-rescue.test.js scripts/rescue-claude-thinking-signature.test.mjs
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/session/ClaudeThinkingRescue.ts \
  packages/api/test/claude-thinking-rescue.test.js \
  scripts/rescue-claude-thinking-signature.mjs \
  scripts/rescue-claude-thinking-signature.test.mjs
git commit -m "refactor(api): extract claude thinking rescue core"
```

## Task 2: 后端提供 scan/rescue API

**Files:**
- Create: `packages/api/src/routes/claude-rescue.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/test/claude-rescue-route.test.js`

**Step 1: Write the failing test**

- `GET /api/claude-rescue/sessions` 返回坏 session 列表
- `POST /api/claude-rescue/rescue` 对选中 session 执行修复
- 401 identity guard
- 结构化返回 `rescuedCount/skippedCount/results`

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/claude-rescue-route.test.js
```

Expected: FAIL，route 不存在

**Step 3: Write minimal implementation**

- Fastify route 注册到 `packages/api/src/index.ts`
- route 调共享 `ClaudeThinkingRescue` 模块
- 所有返回结构固定，便于前端 checklist + toast 使用

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/claude-rescue-route.test.js packages/api/test/claude-thinking-rescue.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/routes/claude-rescue.ts packages/api/src/index.ts packages/api/test/claude-rescue-route.test.js
git commit -m "feat(api): add claude session rescue routes"
```

## Task 3: Hub 账号配置页新增布偶猫救援区

**Files:**
- Modify: `packages/web/src/components/HubProviderProfilesTab.tsx`
- Create: `packages/web/src/components/HubClaudeRescueSection.tsx`
- Create: `packages/web/src/components/hub-claude-rescue.types.ts`
- Test: `packages/web/src/components/__tests__/hub-claude-rescue-section.test.tsx`
- Test: `packages/web/src/components/__tests__/cat-cafe-hub-provider-profiles-tab.test.ts`

**Step 1: Write the failing test**

- Hub “账号配置”页出现“布偶猫救援中心”
- 点击扫描后显示 checklist
- 勾选并执行 rescue 后显示汇总反馈
- 空列表时显示“当前没有坏掉的布偶猫”

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- src/components/__tests__/hub-claude-rescue-section.test.tsx src/components/__tests__/cat-cafe-hub-provider-profiles-tab.test.ts
```

Expected: FAIL，section 不存在

**Step 3: Write minimal implementation**

- 抽独立组件 `HubClaudeRescueSection`
- 使用 `apiFetch('/api/claude-rescue/sessions')`
- checklist 只显示 V1 需要的信息：sessionId、path、可移除数量
- rescue 完成用现有 Hub 风格做轻量结果反馈，不引 modal

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- src/components/__tests__/hub-claude-rescue-section.test.tsx src/components/__tests__/cat-cafe-hub-provider-profiles-tab.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/web/src/components/HubProviderProfilesTab.tsx \
  packages/web/src/components/HubClaudeRescueSection.tsx \
  packages/web/src/components/hub-claude-rescue.types.ts \
  packages/web/src/components/__tests__/hub-claude-rescue-section.test.tsx \
  packages/web/src/components/__tests__/cat-cafe-hub-provider-profiles-tab.test.ts
git commit -m "feat(web): add hub claude rescue section"
```

## Task 4: runtime 提示打通 Hub 救援入口

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-helpers.ts`
- Modify: `packages/api/src/utils/cli-spawn.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts`
- Test: `packages/api/test/invoke-single-cat.test.js`

**Step 1: Write the failing test**

- 命中坏 thinking signature 时，返回给前端的错误提示包含“去账号配置里的布偶猫救援中心”这类明确引导

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @cat-cafe/api run build && node --test --test-name-pattern \"thinking|resume failure classification\" packages/api/test/invoke-single-cat.test.js packages/api/test/claude-agent-service.test.js
```

Expected: FAIL，提示仍只指向 CLI 命令

**Step 3: Write minimal implementation**

- 保留 CLI 命令作为兜底
- 新增 Hub rescue entry hint

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @cat-cafe/api run build && node --test --test-name-pattern \"thinking|resume failure classification\" packages/api/test/invoke-single-cat.test.js packages/api/test/claude-agent-service.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/invocation/invoke-helpers.ts \
  packages/api/src/utils/cli-spawn.ts \
  packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts \
  packages/api/test/invoke-single-cat.test.js
git commit -m "feat(api): point bad claude sessions to hub rescue"
```

## Task 5: 质量门禁与文档同步

**Files:**
- Modify: `docs/features/F084-ragdoll-rescue-hub.md`
- Modify: `docs/bug-report/claude-thinking-signature-invalid/bug-report.md`
- Create: `docs/mailbox/2026-03-08-f084-ragdoll-rescue-hub-review-request-to-opus.md`

**Step 1: Update spec**

- 回填实现结果、设计落点、测试证据

**Step 2: Run focused validation**

Run:

```bash
pnpm lint
pnpm --filter @cat-cafe/api run build
pnpm test -- src/components/__tests__/hub-claude-rescue-section.test.tsx src/components/__tests__/cat-cafe-hub-provider-profiles-tab.test.ts
node --test packages/api/test/claude-thinking-rescue.test.js packages/api/test/claude-rescue-route.test.js packages/api/test/claude-agent-service.test.js
```

Expected: PASS（仅允许现有 warning）

**Step 3: Commit**

```bash
git add docs/features/F084-ragdoll-rescue-hub.md docs/bug-report/claude-thinking-signature-invalid/bug-report.md docs/mailbox/2026-03-08-f084-ragdoll-rescue-hub-review-request-to-opus.md
git commit -m "docs(F084): prep rescue hub review handoff"
```

## Notes

- V1 明确不做自动救援，避免把“显式自救”偷扩成“静默改用户本机文件”
- 如果实现过程中发现 `HubProviderProfilesTab` 过于臃肿，应在本轮顺手抽 `HubClaudeRescueSection`，不要继续把它塞回 300+ 行文件里
- 这条 Feature 完成后，`F081` 只保留 related link，不回收主体内容

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-08-f084-ragdoll-rescue-hub.md`。

这轮我直接按本 session 继续执行，不另起平行会话。
