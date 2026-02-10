# F16 Codex OAuth + 记忆闭环 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让缅因猫在 Cat Cafe 内稳定使用 Codex OAuth（ChatGPT Pro 额度）并具备可用的 Hindsight 记忆回调闭环能力（检索/反思/沉淀）。

**Architecture:** 本实现分两层推进。第一层是 OAuth 稳定化：调整 Codex CLI 隔离 HOME 策略，保证 `auth.json` 与真实 HOME 同步，并默认避免 `OPENAI_API_KEY` 干扰 OAuth 路径。第二层是记忆闭环：在 callback API 上新增 invocation-token 保护的 evidence/reflect/retain 端点，并在 MCP callback tools 与 prompt 注入说明中暴露，形成“查记忆→反思→写入记忆”的最小闭环。

**Tech Stack:** TypeScript, Fastify, Zod, Node test runner (`node --test`), MCP tool wrappers.

### Task 1: OAuth 稳定化（隔离目录 + 环境策略）

**Files:**
- Modify: `packages/api/src/utils/cli-config-isolation.ts`
- Modify: `packages/api/src/domains/cats/services/CodexAgentService.ts`
- Modify: `packages/api/test/cli-config-isolation.test.js`
- Modify: `packages/api/test/codex-agent-service.test.js`

**Step 1: Write the failing tests**
- `cli-config-isolation.test.js`：断言隔离目录中的 `auth.json` 是 symlink（而不是 copy）。
- `codex-agent-service.test.js`：断言默认调用时 child env 会移除 `OPENAI_API_KEY`（OAuth-first）。
- `codex-agent-service.test.js`：断言设置 `CODEX_AUTH_MODE=api_key` 时保留 `OPENAI_API_KEY`。

**Step 2: Run tests to verify RED**
Run:
```bash
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/api test -- test/cli-config-isolation.test.js test/codex-agent-service.test.js
```
Expected: 新增断言失败。

**Step 3: Write minimal implementation**
- `cli-config-isolation.ts`：`auth.json` 改为 symlink 到真实 HOME（失败时降级 copy），并处理 stale 文件替换。
- `CodexAgentService.ts`：引入 `CODEX_AUTH_MODE`（`oauth` 默认，支持 `api_key`、`auto`），在 `oauth` 模式清理 `OPENAI_API_KEY` 等 key-based 环境变量。

**Step 4: Run tests to verify GREEN**
Run same targeted tests, expect pass.

**Step 5: Commit**
```bash
git add packages/api/src/utils/cli-config-isolation.ts packages/api/src/domains/cats/services/CodexAgentService.ts packages/api/test/cli-config-isolation.test.js packages/api/test/codex-agent-service.test.js
git commit -m "feat(api): codex oauth-first isolation and env guard [缅因猫🐾]" -m "Why: F16 需要让缅因猫稳定走 OAuth 额度并避免 API key 路径干扰长会话连续性。"
```

### Task 2: Hindsight callback 记忆闭环（search/reflect/retain）

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `packages/api/test/callback-routes.test.js`
- Modify: `packages/mcp-server/src/tools/callback-tools.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`
- Modify: `packages/mcp-server/src/index.ts`
- Modify: `packages/mcp-server/test/callback-tools.test.js`
- Modify: `packages/api/src/domains/cats/services/McpPromptInjector.ts`

**Step 1: Write the failing tests**
- callback route tests:
  - `GET /api/callbacks/search-evidence` 正常返回结构。
  - `POST /api/callbacks/reflect` 正常返回 reflection。
  - `POST /api/callbacks/retain-memory` 调用 retain 并返回 ok。
- MCP callback tools tests:
  - 新 handler 构造 URL/Body 正确且携带 invocation 鉴权参数。

**Step 2: Run tests to verify RED**
Run:
```bash
pnpm -r --if-present run build
pnpm --filter @cat-cafe/api test -- test/callback-routes.test.js
pnpm --filter @cat-cafe/mcp-server test -- test/callback-tools.test.js
```
Expected: 新增端点/handler 缺失导致失败。

**Step 3: Write minimal implementation**
- 在 callbacks 路由新增受 callback token 保护的三类端点：
  - `/api/callbacks/search-evidence`
  - `/api/callbacks/reflect`
  - `/api/callbacks/retain-memory`
- 在 `index.ts` 注入 `hindsightClient + sharedBank` 给 callbacksRoutes。
- 在 `callback-tools.ts` 新增 3 个工具 schema + handler + tool definition；并注册到 MCP server。
- 更新 `McpPromptInjector` 注入说明，教缅因猫通过 callback 方式调用三类记忆能力。

**Step 4: Run tests to verify GREEN**
Run same targeted tests, expect pass.

**Step 5: Commit**
```bash
git add packages/api/src/routes/callbacks.ts packages/api/src/index.ts packages/api/test/callback-routes.test.js packages/mcp-server/src/tools/callback-tools.ts packages/mcp-server/src/tools/index.ts packages/mcp-server/src/index.ts packages/mcp-server/test/callback-tools.test.js packages/api/src/domains/cats/services/McpPromptInjector.ts
git commit -m "feat(callback): add hindsight memory loop tools for codex [缅因猫🐾]" -m "Why: F16 需要让缅因猫在调用期可检索/反思/沉淀记忆，形成最小可用闭环。"
```

### Task 3: 验证、文档、收尾

**Files:**
- Modify: `docs/BACKLOG.md`
- Optional Modify: `docs/phases/README.md`（仅在阶段状态需要更新时）

**Step 1: Run verification suite**
Run:
```bash
pnpm -r --if-present run build
pnpm test
```
Expected: 全绿；若有历史噪音需在交付说明中注明。

**Step 2: Update backlog status/context**
- 更新 F16 行为为进行中/已完成（按实际交付范围）。
- 若有延后项（例如 retain 治理深水区）写入已知限制与触发条件。

**Step 3: Final commit**
```bash
git add docs/BACKLOG.md docs/plans/2026-02-10-f16-codex-oauth-memory-loop.md
git commit -m "docs(backlog): track F16 oauth-memory-loop MVP status [缅因猫🐾]" -m "Why: 将本轮交付边界与后续触发条件显式化，避免闭环能力散落。"
```

**Step 4: Handoff summary**
- What / Why / Tradeoff / Open Questions / Next Action 五段式交接。
