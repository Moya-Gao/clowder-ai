# Hindsight Freshness Guard (#71-full) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 落地 #71-full：当 Hindsight 证据已过期时 fail-closed，且自动触发受控的 P0 re-import，避免“自信引用过期知识”。

**Architecture:** 复用 #71-MVP 的 `freshness` 判定（水位线 vs HEAD），在路由层增加 freshness gate。`/api/evidence/search` 与 `/api/callbacks/search-evidence` 在 stale 时不再调用 recall；前者降级到 docs 搜索，后者返回空结果并标记降级。自动 re-import 由独立 guard 模块负责（冷却时间 + 审计事件 + 非阻塞触发）。

**Tech Stack:** TypeScript, Fastify, Node test runner, Hindsight P0 importer, EventAuditLog。

---

## Scope / Boundary

### In scope
- freshness=stale 时 fail-closed（默认开启）。
- stale 触发自动 re-import（默认开启，带 cooldown，非阻塞）。
- 两个 evidence 入口对齐：
  - `GET /api/evidence/search`
  - `GET /api/callbacks/search-evidence`
- 回包包含 freshness + re-import trigger 状态，便于观测。

### Out of scope
- 不做 #69 周评测指标流水线。
- 不做 CI 门禁升级（留到后续）。
- 不改 importer 切片策略（仍沿用现有 P0 importer）。

---

### Task 1: Freshness Guard Core（TDD）

**Files:**
- Create: `packages/api/src/domains/cats/services/hindsight-import/p0-freshness-guard.ts`
- Create: `packages/api/test/p0-freshness-guard.test.js`

**Step 1: Write failing tests**
- `shouldFailClosed`：`fresh` 不阻断，`stale` 阻断（默认配置）。
- `triggerP0Reimport`：命中 stale 时触发命令；cooldown 窗口内不重复触发；disabled 时跳过。

**Step 2: Run tests (Red)**
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/p0-freshness-guard.test.js
```
Expected: FAIL（模块/函数不存在）。

**Step 3: Implement minimal guard**
- 提供 fail-closed 判定函数。
- 提供带 cooldown 的自动 re-import trigger（支持注入 command runner 便于测试）。

**Step 4: Run tests (Green)**
执行同一命令，应 PASS。

---

### Task 2: `/api/evidence/search` Fail-Closed + Auto Trigger（TDD）

**Files:**
- Modify: `packages/api/src/routes/evidence.ts`
- Modify: `packages/api/test/evidence-route.test.js`

**Step 1: Write failing tests**
- freshness=stale 时不调用 `hindsightClient.recall`，返回 `degraded=true` + `degradeReason=freshness_stale_fail_closed`。
- stale 时会调用 trigger provider，并在响应中带 trigger 状态。

**Step 2: Run tests (Red)**
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/evidence-route.test.js
```
Expected: FAIL。

**Step 3: Implement minimal route changes**
- 引入 freshness gate（默认 stale fail-closed）。
- fail-closed 路径走 docs fallback，并附 freshness + trigger 状态。

**Step 4: Run tests (Green)**
执行同一命令，应 PASS。

---

### Task 3: `/api/callbacks/search-evidence` 对齐 Guard（TDD）

**Files:**
- Modify: `packages/api/src/routes/callback-memory-routes.ts`
- Modify: `packages/api/src/routes/callbacks.ts`
- Modify: `packages/api/test/callback-routes.test.js`

**Step 1: Write failing tests**
- freshness=stale 时 callback evidence 不调用 recall，返回 `degraded=true` + `degradeReason=freshness_stale_fail_closed`。
- 回包新增 `freshness` 与 `reimportTrigger` 字段。

**Step 2: Run tests (Red)**
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/callback-routes.test.js
```
Expected: FAIL。

**Step 3: Implement minimal callback changes**
- callback memory route 注入 freshness provider + trigger provider（可选）。
- stale fail-closed 时直接降级返回空结果并附状态。

**Step 4: Run tests (Green)**
执行同一命令，应 PASS。

---

### Task 4: Runtime Config + Docs 固化（TDD）

**Files:**
- Modify: `packages/api/src/config/hindsight-runtime-config.ts`
- Modify: `packages/api/src/config/config-snapshot.ts`
- Modify: `packages/api/src/config/ConfigRegistry.ts`
- Modify: `packages/api/src/config/env-registry.ts`
- Modify: `packages/api/test/config-registry.test.js`
- Modify: `docs/BACKLOG.md`

**Step 1: Write failing tests**
- snapshot 可见 freshness guard 开关与 cooldown 配置。
- env override 生效（例如禁用 fail-closed 或调整 cooldown）。

**Step 2: Run tests (Red)**
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/config-registry.test.js
```
Expected: FAIL。

**Step 3: Implement config wiring**
- 新增 freshness guard runtime config（默认开启 fail-closed + auto trigger）。
- 在 config snapshot 暴露当前值，便于 `/config` 与审计。
- backlog #71 备注更新为 full 进度。

**Step 4: Run tests (Green)**
执行同一命令，应 PASS。

---

### Task 5: Verification + Commit + Review Request

**Files:**
- Modify: `docs/mailbox/2026-02-14-h71-full-review-request-to-opus.md` (new)

**Step 1: Full verification**
```bash
pnpm --filter @cat-cafe/api test
```
Expected: 0 fail。

**Step 2: Sanity check**
- `pnpm --filter @cat-cafe/api hindsight:import:p0 -- --all --dry-run`
- 确认命令入口与 trigger 命令一致。

**Step 3: Write review request（五件套）**
- 给宪宪写 #71-full review 信，含 What/Why/Tradeoff/Open Questions/Next Action + 验证证据。

**Step 4: Commit**
```bash
git add <changed-files>
git commit -m "feat(api): implement #71 full freshness fail-closed guard [缅因猫🐾]" -m "Why: stale evidence is riskier than empty evidence; enforce stale fail-closed with controlled auto re-import."
```

---

## DoD / Acceptance

1. stale freshness 不会再走 Hindsight recall（fail-closed 生效）。
2. stale 命中会触发受控 re-import（有 cooldown，不会请求风暴）。
3. 两条 evidence 路由都返回 freshness 与 trigger 状态。
4. runtime config 可见 guard 开关与 cooldown。
5. `pnpm --filter @cat-cafe/api test` 全绿并附 review 请求信。
