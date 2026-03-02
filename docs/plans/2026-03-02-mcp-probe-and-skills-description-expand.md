---
feature_ids: [F041]
topics: [capability-dashboard, mcp, skills, ux]
doc_kind: plan
created: 2026-03-02
updated: 2026-03-02
---

# F041 MCP Probe + Skills Description Expand Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 在能力中心支持 MCP 探活与 tools 列表展示，并让 Skills 描述可点击展开完整内容。

**Architecture:** 后端在 `GET /api/capabilities` 增加可选 `probe=true` 分支，按 MCP 配置进行短超时探测并回填 `connectionStatus/tools`。前端请求探活结果并渲染状态，同时在卡片内增加描述展开/收起交互。

**Tech Stack:** Fastify, TypeScript, MCP SDK (stdio client), Next.js, React, Vitest, Node test.

---

### Task 1: Probe API contract (Red)

**Files:**
- Modify: `packages/api/test/capabilities-route.test.js`

**Step 1: Write failing test**
- 增加 `GET /api/capabilities?probe=true` 用例：断言 MCP item 包含 `connectionStatus`，当可探测时返回 `connected/disconnected` 且 `tools` 为数组。
- 增加 `GET /api/capabilities`（不带 probe）用例：断言不强制返回 probe 字段（避免默认慢查询）。

**Step 2: Run test to verify it fails**
- Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/capabilities-route.test.js`
- Expected: FAIL（缺少 probe 字段填充逻辑）。

### Task 2: MCP probe implementation (Green)

**Files:**
- Create: `packages/api/src/routes/mcp-probe.ts`
- Modify: `packages/api/src/routes/capabilities.ts`
- Modify: `packages/api/package.json`

**Step 1: Write minimal implementation**
- 新建 `mcp-probe.ts`：
  - 提供 `probeMcpServer()`：用 stdio 连接 MCP server，调用 `listTools()`。
  - 返回 `{ connectionStatus, tools }`，失败时返回 `disconnected`。
  - 设置短超时，防止阻塞请求。
- `capabilities.ts` 解析 `query.probe`；当 `probe=true` 时并发探测每个 MCP capability 并写回 item。
- `package.json` 显式声明 `@modelcontextprotocol/sdk` 依赖。

**Step 2: Run test to verify it passes**
- Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/capabilities-route.test.js`
- Expected: PASS。

### Task 3: Skills 描述展开交互 (Red→Green)

**Files:**
- Create: `packages/web/src/components/__tests__/capability-board-ui-description-expand.test.tsx`
- Modify: `packages/web/src/components/capability-board-ui.tsx`
- Modify: `packages/web/src/components/HubCapabilityTab.tsx`

**Step 1: Write failing test**
- 新增组件测试：
  - Skills 描述默认截断。
  - 点击“展开”显示完整描述。
  - 再次点击“收起”恢复截断。

**Step 2: Run test to verify it fails**
- Run: `pnpm --filter @cat-cafe/web test -- capability-board-ui-description-expand.test.tsx`
- Expected: FAIL（当前无描述展开控件）。

**Step 3: Write minimal implementation**
- `capability-board-ui.tsx` 在卡片中增加 `descriptionExpanded` 状态与按钮。
- 长描述显示 `展开/收起`；点击按钮不触发卡片折叠。
- MCP tools 描述同样支持完整展示（避免工具描述继续被硬截断）。
- `HubCapabilityTab.tsx` 请求 API 时带 `probe=true`，让 MCP tools/状态直接可见。

**Step 4: Run test to verify it passes**
- Run: `pnpm --filter @cat-cafe/web test -- capability-board-ui-description-expand.test.tsx`
- Expected: PASS。

### Task 4: Regression checks + quality evidence

**Files:**
- None (verification only)

**Step 1: Run targeted regressions**
- `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/capabilities-route.test.js`
- `pnpm --filter @cat-cafe/web test -- capability-board-ui-description-expand.test.tsx`

**Step 2: Run project quality checks**
- `pnpm test`
- `pnpm lint`

**Step 3: Collect review evidence**
- 记录命令输出摘要与关键截图位置，用于 `quality-gate` + `request-review`。

### Task 5: Review handoff to GPT-5.2 reviewer

**Files:**
- Create: `docs/mailbox/2026-03-02-mcp-probe-and-skill-description-review-request.md`

**Step 1: Prepare review request**
- 按 `request-review` 模板写五件套（What/Why/Evidence/Open Questions/Next）。
- 只在真正交接时单次 `@gpt52`，避免无意义 A2A 循环触发。

**Step 2: Wait for review feedback**
- 收到意见后进入 `receive-review` 流程逐项处理。

