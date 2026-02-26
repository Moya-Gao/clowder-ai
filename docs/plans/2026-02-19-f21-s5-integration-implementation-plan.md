---
feature_ids: [F021]
topics: [integration, implementation]
doc_kind: plan
created: 2026-02-19
---

# F21 S5 Cat Café Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver S5 integration end-to-end so API, MCP tools, and web slash commands can query and operate Signal Hunter data.

**Architecture:** Build API-first. Add a signal query service + `signals` route in `@cat-cafe/api`, then wire MCP signal tools to those endpoints, then wire `/signals` slash commands in web to the same API contract. Keep logic in domain service modules and keep route/tool layers thin.

**Tech Stack:** Fastify + Zod (`@cat-cafe/api`), MCP SDK tool handlers (`@cat-cafe/mcp-server`), React hook command dispatcher (`@cat-cafe/web`), Node test/Vitest.

---

### Task 1: API Signals Routes (TDD)

**Files:**
- Create: `packages/api/test/signals-route.test.js`
- Create: `packages/api/src/routes/signals.ts`
- Create: `packages/api/src/domains/signals/services/article-query-service.ts`
- Modify: `packages/api/src/routes/index.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `packages/api/src/domains/signals/config/sources-loader.ts`

**Step 1: Write failing tests**
- Add tests for:
  - `GET /api/signals/inbox`
  - `GET /api/signals/articles/:id`
  - `GET /api/signals/search`
  - `PATCH /api/signals/articles/:id`
  - `GET /api/signals/sources`
  - `PATCH /api/signals/sources/:id`
  - `GET /api/signals/stats`
  - identity guard (401)

**Step 2: Run Red**
- Run: `pnpm --filter @cat-cafe/api build && node --test packages/api/test/signals-route.test.js`
- Expected: FAIL (`Cannot find module .../routes/signals.js` or route/shape assertions failing)

**Step 3: Minimal implementation**
- Implement query service for reading/updating signal markdown + inbox records.
- Implement route plugin with zod validation and identity guard.
- Register route in API route exports and server startup.
- Add `saveSignalSources` helper for source enable/disable writes.

**Step 4: Run Green**
- Run: `pnpm --filter @cat-cafe/api build && node --test packages/api/test/signals-route.test.js`
- Expected: PASS

**Step 5: Commit checkpoint**
- `git add` + `git commit -m "feat(api): add signal query routes for s5 [缅因猫🐾]"`

### Task 2: MCP Signal Tools (TDD)

**Files:**
- Create: `packages/mcp-server/test/signals-tools.test.js`
- Create: `packages/mcp-server/src/tools/signals-tools.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`
- Modify: `packages/mcp-server/src/index.ts`
- Modify: `packages/mcp-server/test/tool-registration.test.js`

**Step 1: Write failing tests**
- Add tests for:
  - inbox list query encoding
  - get article by url/id endpoint selection
  - summarize flow (`GET article` + `PATCH summary`)
  - tool registration includes new signal tools

**Step 2: Run Red**
- Run: `pnpm --filter @cat-cafe/mcp-server test`
- Expected: FAIL (missing exports/handlers/tools)

**Step 3: Minimal implementation**
- Implement 5 tool handlers:
  - `signal_list_inbox`
  - `signal_get_article`
  - `signal_search`
  - `signal_mark_read`
  - `signal_summarize`
- Register schemas + handlers in tool index and MCP server bootstrap.

**Step 4: Run Green**
- Run: `pnpm --filter @cat-cafe/mcp-server test`
- Expected: PASS

**Step 5: Commit checkpoint**
- `git add` + `git commit -m "feat(mcp): add s5 signal tools [缅因猫🐾]"`

### Task 3: Web `/signals` Commands (TDD)

**Files:**
- Modify: `packages/web/src/config/command-registry.ts`
- Modify: `packages/web/src/hooks/useChatCommands.ts`
- Create or modify tests under:
  - `packages/web/src/config/__tests__/registries.test.ts`
  - `packages/web/src/hooks/__tests__/useChatCommands-signals.test.ts`

**Step 1: Write failing tests**
- Add tests for:
  - `/signals` and `/signals inbox`
  - `/signals search <query>`
  - `/signals sources`
  - `/signals stats`
  - optional source toggle command path (`/signals sources <id> on|off`)

**Step 2: Run Red**
- Run: `pnpm --filter @cat-cafe/web test -- useChatCommands-signals registries`
- Expected: FAIL (command not recognized / API not called)

**Step 3: Minimal implementation**
- Add command registry entries for `/signals*`.
- Implement `/signals` command dispatcher in hook using `apiFetch` and system message formatting.

**Step 4: Run Green**
- Run: `pnpm --filter @cat-cafe/web test -- useChatCommands-signals registries`
- Expected: PASS

**Step 5: Commit checkpoint**
- `git add` + `git commit -m "feat(web): add /signals chat commands for s5 [缅因猫🐾]"`

### Task 4: End-to-End Verification + Review Handoff

**Files:**
- Create/Modify mailbox note: `docs/mailbox/2026-02-19-f21-s5-integration-review-request.md`

**Step 1: Verify build/tests across touched packages**
- Run:
  - `pnpm --filter @cat-cafe/api test`
  - `pnpm --filter @cat-cafe/mcp-server test`
  - `pnpm --filter @cat-cafe/web test`

**Step 2: Capture output + risk notes**
- Note any non-s5 unrelated flake/failure explicitly.

**Step 3: Request review**
- Send five-part handoff (What/Why/Tradeoff/Open Questions/Next Action) and `@布偶猫`.

**Step 4: Final commit (if needed for docs/handoff)**
- `git add` + `git commit -m "docs(mailbox): request s5 review [缅因猫🐾]"`
