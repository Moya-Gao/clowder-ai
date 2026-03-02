---
feature_ids: [F043]
topics: [mcp, list-threads, callbacks]
doc_kind: plan
created: 2026-03-02
---

# F043 Phase A: list_threads Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 交付 F043 P1 `list_threads` 最小可用能力，让猫能发现当前用户的活跃 thread，并为后续 `feat_index` 提供入口。

**Architecture:** 在现有 callback auth 模型上新增真实 HTTP endpoint `/api/callbacks/list-threads`，MCP 侧新增 `cat_cafe_list_threads` 直连该 endpoint。分页采用 Phase A 轻契约：`activeSince + lastActiveAt desc + limit`（不引入 cursor）。返回字段锚定 F043 spec 的 `ThreadSummary` 最小集，`messageCount` 在 Phase A 固定为 `null`，`catId` 过滤延后。

**Tech Stack:** Fastify + Zod（API）、MCP server callback tools、ThreadStore/MessageStore（in-memory + Redis 双实现）、Node test。

---

## 已拍板契约（@opus / @gpt52）

1. 分页模式（Phase A）
- 采用 `activeSince` + `lastActiveAt desc` + `limit`。
- 不在本期引入 cursor/offset，避免把 P1 膨胀成检索框架改造。

2. 返回字段最小集
- `threadId`, `title`, `lastActiveAt`, `messageCount`, `participants`。
- `messageCount` Phase A 固定返回 `null`（避免 O(N×M) 全量扫描；后续单开 `countByThread` 增强项）。

3. 过滤参数
- 本期仅 `activeSince`。
- `catId` 过滤延后到 P1+（需要额外索引/扫描成本评估）。

4. 命名/路径
- MCP tool: `cat_cafe_list_threads`
- HTTP endpoint: `/api/callbacks/list-threads`（真实端点；避免 alias 被误认 endpoint）

5. play-mode participants
- 不做脱敏；`participants` 来自 thread 元数据，且 callback 已受 invocation 鉴权（仅本 user scope）。

---

### Task 1: API 契约与路由（Red → Green）

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts`
- Test: `packages/api/test/callback-routes.test.js`

**Step 1: Write failing tests**
- 新增 `GET /api/callbacks/list-threads` 用例：
  - 默认 limit=20，按 `lastActiveAt desc`
  - `activeSince` 过滤
  - 无效 `activeSince/limit` 返回 400
  - `threadStore` 未配置时返回 503（或 501）
  - 仅返回当前 user scope threads
  - `messageCount` 当前为 `null`

**Step 2: Run test to verify fails**
- Run: `node --test packages/api/test/callback-routes.test.js`
- Expected: FAIL（route 不存在或 schema 不匹配）

**Step 3: Minimal implementation**
- 在 callbacks 路由注册 `GET /api/callbacks/list-threads`
- 新增 query schema：`invocationId/callbackToken/limit?/activeSince?`
- 若 `threadStore` 未配置，显式返回 503（或 501），禁止 500
- 使用 `threadStore.list(record.userId)` + `activeSince` 过滤 + `limit`
- 组装 `ThreadSummary` 返回
- `messageCount` 固定返回 `null`

**Step 4: Run tests (green)**
- Run: `node --test packages/api/test/callback-routes.test.js`
- Expected: PASS

**Step 5: Commit**
- `git add packages/api/src/routes/callbacks.ts packages/api/test/callback-routes.test.js`
- `git commit -m "feat(F043): add list-threads callback route"`

---

### Task 2: MCP 工具注册与参数透传（Red → Green）

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts`
- Modify: `packages/mcp-server/src/index.ts`
- Test: `packages/mcp-server/test/callback-tools.test.js`
- Test: `packages/mcp-server/test/tool-registration.test.js`

**Step 1: Write failing tests**
- `cat_cafe_list_threads` 出现在 tool registration
- handler 正确透传 `limit/activeSince` 到 `/api/callbacks/list-threads`

**Step 2: Run test to verify fails**
- Run: `node --test packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js`

**Step 3: Minimal implementation**
- 新增 input schema/handler/tool metadata
- 在 index 里注册 `cat_cafe_list_threads`

**Step 4: Run tests (green)**
- 同 Step 2

**Step 5: Commit**
- `git add packages/mcp-server/src/tools/callback-tools.ts packages/mcp-server/src/index.ts packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js`
- `git commit -m "feat(F043): register cat_cafe_list_threads MCP tool"`

---

### Task 3: Prompt/Docs 对齐（防止 alias/endpoint 混淆回归）

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/McpPromptInjector.ts`
- Modify: `cat-cafe-skills/refs/mcp-callbacks.md`
- Test: `packages/api/test/mcp-prompt-injector.test.js`
- Modify: `docs/features/F043-mcp-unification.md`（Timeline + P1 进度）

**Step 1: Write/adjust failing assertions**
- HTTP tools 只列真实 endpoint；新增 `list-threads` 文案与示例
- 保持 `McpPromptInjector` 注入文本 `<700 chars`（现有门禁不退化）

**Step 2: Implement minimal doc/prompt update**
- 注入文案新增 `list-threads`
- refs 增加 `/api/callbacks/list-threads` curl 示例

**Step 3: Verify**
- Run: `node --test packages/api/test/mcp-prompt-injector.test.js packages/api/test/system-prompt-builder.test.js`

**Step 4: Commit**
- `git add packages/api/src/domains/cats/services/agents/invocation/McpPromptInjector.ts cat-cafe-skills/refs/mcp-callbacks.md packages/api/test/mcp-prompt-injector.test.js docs/features/F043-mcp-unification.md`
- `git commit -m "docs(F043): align list-threads callback docs and prompts"`

---

## Full Verification Gate

1. `pnpm --filter @cat-cafe/api run build`
2. `pnpm --filter @cat-cafe/mcp-server run build`
3. `node --test packages/api/test/callback-routes.test.js`
4. `node --test packages/api/test/mcp-prompt-injector.test.js packages/api/test/system-prompt-builder.test.js`
5. `node --test packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js`

---

## 风险与边界

- `messageCount` 暂为 `null`，避免 O(N×M) 全量扫描；后续如要显示计数，单独实现 `countByThread`（含 Redis/in-memory 双实现与基准验证）。
- `catId` 过滤不在本次，避免提前引入 participant/message 双索引复杂度。
- 不扩展跨 user 查询：保持 callback invocation 的 user scope 隔离。
