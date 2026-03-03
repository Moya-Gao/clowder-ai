---
feature_ids: [F043]
topics: [mcp, server-split, capability-center, reliability]
doc_kind: plan
created: 2026-03-03
---

# F043 Phase B Server Split + Probe Reliability Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Close F043 Phase B by delivering 1→3 MCP server split and fixing Capability Center false-negative probe confusion around external MCP services.

**Architecture:** Keep `feat-index`/callback business logic unchanged, and split MCP exposure at registration/entrypoint layer: `cat-cafe-collab`, `cat-cafe-memory`, `cat-cafe-signals`. In capabilities/orchestrator, migrate legacy `cat-cafe` single-server entries to the three-server model and regenerate CLI configs. Improve probe reliability with adaptive timeout so `npx`-based servers (e.g. playwright) are less likely to be marked disconnected incorrectly.

**Tech Stack:** TypeScript, Fastify routes, MCP SDK, Node test runner, smol-toml.

---

### Task 1: MCP Server Split Entry Points (TDD)

**Files:**
- Modify: `packages/mcp-server/src/index.ts`
- Create: `packages/mcp-server/src/collab.ts`
- Create: `packages/mcp-server/src/memory.ts`
- Create: `packages/mcp-server/src/signals.ts`
- Test: `packages/mcp-server/test/tool-registration.test.js`

**Step 1: Write failing tests for split registration**
- Add tests asserting:
  - `createCollabServer()` only has collab tools.
  - `createMemoryServer()` only has memory tools.
  - `createSignalsServer()` only has signal tools.

**Step 2: Run tests to verify RED**
- Run: `node --test packages/mcp-server/test/tool-registration.test.js`
- Expected: missing export/registration failures.

**Step 3: Implement minimal split entrypoints**
- Add three entry files that each create/register only the intended tool groups.
- Keep current `createServer()` (full aggregate) for compatibility/tests.

**Step 4: Run tests to verify GREEN**
- Run: `pnpm --filter @cat-cafe/mcp-server run build && node --test packages/mcp-server/test/tool-registration.test.js`
- Expected: all registration tests pass.

**Step 5: Commit**
- `git commit -m "feat(F043): split mcp server entrypoints into collab memory signals"`

### Task 2: Capability Orchestrator Migration to 1→3 (TDD)

**Files:**
- Modify: `packages/api/src/config/capabilities/capability-orchestrator.ts`
- Modify: `packages/api/src/routes/capabilities.ts`
- Test: `packages/api/test/capability-orchestrator.test.js`
- Test: `packages/api/test/capabilities-route.test.js`

**Step 1: Write failing tests for 1→3 bootstrap/migration**
- Add tests asserting:
  - bootstrap creates `cat-cafe-collab`, `cat-cafe-memory`, `cat-cafe-signals`.
  - existing config with legacy `cat-cafe` is migrated to split entries.

**Step 2: Run tests to verify RED**
- Run: `node --test packages/api/test/capability-orchestrator.test.js packages/api/test/capabilities-route.test.js`
- Expected: descriptor count/id mismatch failures.

**Step 3: Implement migration + descriptor split**
- Replace single descriptor builder with multi-descriptor builder.
- Add migration helper to normalize legacy config to split model.
- Ensure route path persists migrated config and regenerates CLI configs.

**Step 4: Run tests to verify GREEN**
- Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/capability-orchestrator.test.js packages/api/test/capabilities-route.test.js`
- Expected: all pass.

**Step 5: Commit**
- `git commit -m "feat(F043): migrate capabilities orchestrator to 1-to-3 cat-cafe servers"`

### Task 3: MCP Probe Reliability Fix for External Servers (TDD)

**Files:**
- Modify: `packages/api/src/routes/mcp-probe.ts`
- Test: `packages/api/test/mcp-probe.test.js` (create if missing)
- Optional docs note: `docs/features/F043-mcp-unification.md`

**Step 1: Write failing test for adaptive timeout policy**
- Add test covering timeout policy decision:
  - default probes use baseline timeout.
  - `npx` command probes use higher timeout budget.

**Step 2: Run tests to verify RED**
- Run: `node --test packages/api/test/mcp-probe.test.js`

**Step 3: Implement adaptive timeout**
- Add command-aware timeout helper (e.g. `npx` > default).
- Keep upper bound reasonable to avoid UI hang.

**Step 4: Run tests to verify GREEN**
- Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/mcp-probe.test.js`

**Step 5: Commit**
- `git commit -m "fix(F043): improve mcp probe reliability for npx-backed servers"`

### Task 4: Spec Sync + Final Gates

**Files:**
- Modify: `docs/features/F043-mcp-unification.md`
- Modify: `docs/BACKLOG.md` (if status index changes)

**Step 1: Update F043 spec timeline/status**
- Mark server split delivery status and probe fix note.
- Keep acceptance criteria aligned with actual merged scope.

**Step 2: Run quality gates**
- Run:
  - `pnpm --filter @cat-cafe/mcp-server run build`
  - `node --test packages/mcp-server/test/tool-registration.test.js`
  - `pnpm --filter @cat-cafe/api run build`
  - `node --test packages/api/test/capability-orchestrator.test.js packages/api/test/capabilities-route.test.js packages/api/test/mcp-probe.test.js`

**Step 3: Prepare review request artifacts**
- Save review note to `docs/mailbox/` with evidence and command outputs.

**Step 4: Commit**
- `git commit -m "docs(F043): sync phase-b server split and probe reliability progress"`

---

Plan complete and saved to `docs/plans/2026-03-03-f043-phase-b-server-split-and-probe-fix.md`. I will execute it directly in this session with TDD.
