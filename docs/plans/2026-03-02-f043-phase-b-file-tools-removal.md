---
feature_ids: [F043]
topics: [mcp, tools, cleanup]
doc_kind: plan
created: 2026-03-02
---

# F043 Phase B File Tools Removal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Remove redundant MCP file tools (`read_file`, `write_file`, `list_files`) from server registration so Cat Café MCP focuses on collaboration/memory/signal tooling and no longer duplicates host CLI filesystem capabilities.

**Architecture:** Keep `packages/mcp-server/src/tools/file-tools.ts` in-repo for now (non-exported, non-registered) to minimize blast radius, but remove all registration/export edges so runtime tool surface no longer exposes file tools. Guard this through registration tests and callback tool regression tests. Update F043 spec timeline/AC to record this Phase B sub-delivery.

**Tech Stack:** Node.js, TypeScript, MCP SDK (`McpServer`), Node test runner.

---

### Task 1: Lock Red Test for Removed Tool Surface

**Files:**
- Modify: `packages/mcp-server/test/tool-registration.test.js`

**Step 1: Write failing test expectations**

- Remove file tools from `EXPECTED_TOOLS`.
- Add explicit negative assertion that `read_file`, `write_file`, `list_files` are not registered.

**Step 2: Run test to verify it fails (Red)**

Run: `node --test packages/mcp-server/test/tool-registration.test.js`
Expected: FAIL because current `createServer()` still registers file tools.

**Step 3: Commit checkpoint (optional, only if useful for debugging)**

No commit at red stage unless debugging needs isolation.

### Task 2: Remove File Tool Registration/Exports

**Files:**
- Modify: `packages/mcp-server/src/index.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`

**Step 1: Minimal implementation**

- In `src/index.ts`:
  - Remove file tool schema/handler imports.
  - Remove `server.tool()` registrations for `read_file`/`write_file`/`list_files`.
- In `src/tools/index.ts`:
  - Remove re-exports for file tool schemas/handlers/tool list.

**Step 2: Run registration test to verify Green**

Run: `node --test packages/mcp-server/test/tool-registration.test.js`
Expected: PASS.

**Step 3: Run callback tool regression**

Run: `node --test packages/mcp-server/test/callback-tools.test.js`
Expected: PASS (ensures collaboration tools unaffected).

### Task 3: Spec Drift Sync + Full Gate

**Files:**
- Modify: `docs/features/F043-mcp-unification.md`

**Step 1: Spec updates**

- Mark AC item `file tools 已移除` as completed for this sub-delivery.
- Add timeline entry for this PR scope (Phase B sub-step: file tools removal).
- Keep server split (`1→3`) and other Phase B/P2 items as pending.

**Step 2: Run gate commands**

Run:
- `pnpm --filter @cat-cafe/mcp-server run build`
- `node --test packages/mcp-server/test/tool-registration.test.js packages/mcp-server/test/callback-tools.test.js`
- `pnpm --filter @cat-cafe/api run build`

Expected:
- All commands exit 0.

### Task 4: Commit + Review Request Prep

**Files:**
- Modify/create: `docs/mailbox/2026-03-02-f043-phase-b-file-tools-removal-review-request-to-gpt52.md`

**Step 1: Commit**

Run:
```bash
git add packages/mcp-server/src/index.ts \
  packages/mcp-server/src/tools/index.ts \
  packages/mcp-server/test/tool-registration.test.js \
  docs/features/F043-mcp-unification.md

git commit -m "refactor(F043): remove redundant MCP file tool registrations"
```

**Step 2: Write structured review request (五件套)**

- Include: What/Why/Tradeoff/Open Questions/Next Action.
- Include fresh gate evidence.
- Explicitly request @gpt52 review before merge-gate.

**Step 3: Push branch**

Run:
```bash
git push -u origin feat/f043-phase-b-tools-audit
```
