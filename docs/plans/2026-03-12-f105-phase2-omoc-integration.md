# F105 Phase 2: OMOC Integration Validation

**Feature:** F105 — `docs/features/F105-opencode-golden-chinchilla.md`
**Goal:** Validate that OMOC (Sisyphus + Ralph Loop + Context management) works correctly within the Cat Cafe L1 adapter boundary, with no cross-cat orchestration leakage or MCP tool conflicts.
**Acceptance Criteria:**
- AC-9: OMOC Sisyphus 编排限制在金渐层内部子 agent
- AC-10: opencode MCP 与 Cat Cafe MCP 编排不冲突
- AC-11: Ralph Loop + Context 管理正常工作
**Architecture:** Phase 2 is primarily validation, not new code. The L1 CLI adapter spawns `opencode run` as a child process — OMOC behaviors (Sisyphus, Ralph Loop, Context) happen entirely inside that process. Cat Cafe only sees the NDJSON event stream output. The key deliverable is an integration test that proves the isolation boundary holds, plus a per-project opencode config template.
**Tech Stack:** node:test, opencode CLI, OMOC plugin
**前端验证:** No — backend/CLI only

---

## Analysis: Why Phase 2 is Validation, Not Code

OMOC's Sisyphus operates via system prompt injection + `delegate-task` tool inside opencode's process. It spawns sub-sessions of opencode itself (Oracle, Librarian, Frontend Engineer), not external processes. Cat Cafe's CatOrchestration manages cross-cat dispatch via a completely separate mechanism (MCP tools + thread routing). These are architecturally isolated:

```
Cat Cafe Runtime
  └── CatOrchestration (manages @mentions between cats)
        └── invokeSingleCat('opencode', prompt)
              └── OpenCodeAgentService.invoke()
                    └── spawn('opencode', ['run', ...])  ← process boundary
                          └── OMOC Sisyphus (internal to opencode)
                                ├── delegate-task → Oracle (sub-session)
                                ├── delegate-task → Librarian (sub-session)
                                └── Ralph Loop (auto-continuation)
```

Sisyphus cannot escape the process boundary. It has no access to Cat Cafe's MCP tools, thread routing, or cat registry. The isolation is structural.

---

## Task 1: Sisyphus Isolation Smoke Test (AC-9)

**What:** Run opencode with OMOC enabled, give it a multi-step task, capture the NDJSON event stream, verify all `tool_use` events are opencode-internal tools (bash, file ops, delegate-task) and none reference Cat Cafe cats or MCP tools.

**Files:**
- Create: `packages/api/test/opencode-omoc-isolation.test.js`

**Step 1: Write the test**

Test spawns opencode with a multi-step prompt via mock, emits realistic OMOC events (including delegate-task tool_use), verifies that:
- All tool_use events have tool names from opencode's internal toolset
- No event content contains Cat Cafe cat handles (@opus, @codex, @gemini, etc.)
- delegate-task targets are internal OMOC agents (oracle, librarian, etc.), not Cat Cafe cats

**Step 2: Run test — expect RED** (mock fixtures need creation)

**Step 3: Create mock OMOC event fixtures and make test pass**

Add realistic OMOC NDJSON fixtures:
- step_start (with OMOC system prompt overhead)
- text (Sisyphus task decomposition)
- tool_use with tool=delegate-task, input containing sub-agent delegation
- tool_use with tool=bash (sub-agent execution)
- step_finish (with elevated token count from OMOC ~36K)

**Step 4: Run test — expect GREEN**

**Step 5: Commit**

```
test(F105): Sisyphus isolation smoke test — OMOC delegate-task stays internal
```

---

## Task 2: MCP Tool Namespace Validation (AC-10)

**What:** Verify that opencode's MCP tools and Cat Cafe's MCP tools don't have name collisions. opencode runs with its own MCP config (Pencil), Cat Cafe provides its own MCP tools via mcp-server package. Since opencode runs as a subprocess, its MCP tools are isolated by process boundary.

**Files:**
- Create: `packages/api/test/opencode-mcp-isolation.test.js`

**Step 1: Write the test**

Test verifies:
- OpenCodeAgentService does NOT pass Cat Cafe MCP config to the child process
- opencode's MCP tools (from opencode.json) are separate from Cat Cafe's MCP server tools
- No `CAT_CAFE_MCP_*` env vars leak to opencode child process

**Step 2: Run test — expect RED**

**Step 3: Implement — verify buildEnv() cleans up MCP-related env vars**

Check if any Cat Cafe MCP env vars could leak through. If they can, add cleanup in buildEnv(). If not (likely), the test just documents the isolation.

**Step 4: Run test — expect GREEN**

**Step 5: Commit**

```
test(F105): MCP tool namespace isolation — no Cat Cafe MCP leakage to opencode
```

---

## Task 3: Per-Project opencode Config Template (AC-9 + AC-10)

**What:** Create a project-local opencode config template that Cat Cafe operators can use. This template:
- Sets the Anthropic provider with proxy URL
- Enables OMOC plugin
- Configures background_task concurrency limits (prevent token explosion)
- Documents which MCP servers are safe to enable

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/opencode-config-template.ts`
- Test: `packages/api/test/opencode-config-template.test.js`

**Step 1: Write test** — template generates valid opencode.json structure with all required fields

**Step 2: Run — RED**

**Step 3: Implement** — pure function that generates opencode config JSON from Cat Cafe runtime parameters (apiKey, baseUrl, model, concurrency limits)

**Step 4: Run — GREEN**

**Step 5: Commit**

```
feat(F105): opencode config template generator for Cat Cafe runtime
```

---

## Task 4: Ralph Loop + Context Management Validation (AC-11)

**What:** Verify that opencode's OMOC context management events are properly handled by the L1 adapter. When OMOC hits 70% context warning or 85% auto-compact, the event stream may include special events or behavior changes. The adapter should pass these through without breaking.

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/opencode-event-transform.ts` (if needed)
- Test: `packages/api/test/opencode-omoc-context.test.js`

**Step 1: Write test**

Test feeds OMOC-specific events through the event transformer:
- Context warning events (if any special type)
- Auto-compact behavior (stream may pause/resume)
- Ralph Loop continuation (multiple step_start → text → step_finish cycles)
- Verify the existing session_init dedup handles Ralph Loop correctly

**Step 2: Run — RED**

**Step 3: Implement** — likely no code changes needed, just verify existing behavior handles OMOC edge cases. If opencode emits special OMOC events, add handling.

**Step 4: Run — GREEN**

**Step 5: Commit**

```
test(F105): Ralph Loop + Context management event handling validation
```

---

## Task 5: Update Feature Doc + Integration Summary

**Files:**
- Modify: `docs/features/F105-opencode-golden-chinchilla.md`

**Step 1:** Update AC-9, AC-10, AC-11 to `[x]` with evidence
**Step 2:** Update Status to `phase-2-done`
**Step 3:** Add Timeline entry
**Step 4:** Commit

```
docs(F105): Phase 2 OMOC integration validated — AC-9/10/11 complete
```

---

## What We're NOT Building

- No changes to CatOrchestration or cross-cat routing (that's Phase 3)
- No OMOC UI/dashboard (internal to opencode)
- No Ralph Loop configuration API (OMOC handles this internally)
- No custom Sisyphus agent definitions (using OMOC defaults)
- No opencode HTTP API/ACP integration (L1 CLI adapter only)
