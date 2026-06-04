---
doc_kind: review-request
feature_ids: [F223]
topics: [capability-surface, hub-action-surface, mcp, workspace-navigator, browser-preview]
created: 2026-06-04
author: codex
reviewer: opus47
branch: feat/f223-phase-b1
review_target_id: f223
---

# F223 Phase B1 Review Request

**Review-Target-ID:** f223  
**Branch:** `feat/f223-phase-b1`  
**Base:** `origin/main` at `75869f09f`  
**Implementation commit:** `a9d0b3f92d1714d49b2167423cf49b981a935ee2`  
**Author:** 砚砚 / GPT-5.5  
**Requested reviewer:** 宪宪 / Opus 4.7

## Original Requirements

Source: current F223 capability-surface thread, 2026-06-03.

> "workspace-navigator skill 不再让猫手写 curl 对的 或者直接提供mcp之类的也ok"
> "不能让他藏着得把他变成skills 然后skills 不要让喵手写，该变成mcp变mcp"
> "别一个pr切太碎 能合并就合并"

请对照上面的摘录判断 Phase B1 是否解决了 workspace/browser 两条第一方 Hub 能力的暴露度和执行稳定性问题。

## What

Implemented F223 Phase B1 as one combined workspace + browser-preview slice:

- Added typed MCP tools `cat_cafe_workspace_navigate` and `cat_cafe_preview_open`.
- Registered both tools in the collab MCP toolset and tool registration tests.
- Updated workspace-navigator and browser-preview skills so their main paths no longer handwrite first-party `curl localhost` calls.
- Canonicalized `/api/workspace/navigate` event/audit/response `worktreeId` after resolving the requested root.
- Forced `WorkspacePanel` back to Files view when a workspace open-file navigation arrives after Browser Preview auto-open.
- Updated F223 inventory/spec, `hub-action-surface` ownership anchors, and the env-port drift gate for the new typed-MCP invariant.

## Why

The 2026-06-03 incident was not just "a cat operated badly": the capability existed but was exposed as a fragile hidden HTTP recipe. Phase B1 makes the two highest-friction first-party Hub actions typed, discoverable, tested, and harder to misuse.

## Tradeoff

- Did not implement Phase B2 rich-messaging alignment in this PR. That path crosses F192 trigger/predicate wording and is intentionally separate per Phase A review.
- Kept the existing Hub HTTP endpoints as the execution backend. The new MCP tools are the typed cat-facing surface, not a parallel action service.
- Did not add Phase D hard checks yet. AC-D1 still needs Design Gate / CVO accept under F192 Phase F AC-F9.

## Architecture Ownership

Architecture cell: `hub-action-surface + harness-eval`  
Map delta: `update required`  
Why: first-party Hub user-visible workspace/preview actions now have typed MCP execution surfaces; eval/predicate ownership stays in F192 / `harness-eval`.

Please check:

- diff matches `Map delta: update required`;
- no parallel Store / Queue / Router / Adapter / Dispatcher / Binding was introduced;
- `hub-action-surface` anchors/canonical features reflect this slice without swallowing F192 eval scope.

## Open Questions

### Technical OQ

1. Are the MCP schemas and descriptions precise enough to prevent future cats from reverting to raw first-party `curl`?
2. Is the workspace `worktreeId` canonicalization correct for git worktrees, linked roots, and registry aliases?
3. Does the `WorkspacePanel` effect switch to Files on new open-file navigation without locking the user out of Browser mode afterward?
4. Is it acceptable that frontend validation is component-level rather than live Hub screenshot for this state-only UI change?

### Value OQ

None. This is within the approved F223 Phase B1 scope and keeps AC-B4 for the next B2 batch.

## Next Action

Please review branch `feat/f223-phase-b1`. If approved, I will handle feedback and then enter merge gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f223/opus47`
- Start Command: `pnpm review:start`
- Ports: reviewer-run `pnpm review:start` should allocate from `web=3201`, `api=3202` upward and print the actual pair.

I did not start a live review sandbox as author. The frontend change is a state transition covered by component regression; no visual layout was modified.

## Quality Gate Report

### Spec Compliance

| AC | Status | Evidence |
|---|---:|---|
| AC-B1 | met | `cat_cafe_workspace_navigate`; `packages/mcp-server/test/hub-action-tools.test.js`; `cat-cafe-skills/workspace-navigator/SKILL.md` |
| AC-B2 | met | `packages/api/test/workspace-navigate.test.js`; `packages/web/src/components/__tests__/workspace-panel-reveal-in-tree.test.ts` |
| AC-B3 | met | `cat_cafe_preview_open`; `packages/mcp-server/test/hub-action-tools.test.js`; `cat-cafe-skills/browser-preview/SKILL.md` |
| AC-B4 | intentionally pending | Phase B2 rich-messaging batch |

### Verification Commands

Passed:

```bash
pnpm check
pnpm test
pnpm lint
pnpm -r --if-present run build
pnpm --dir packages/mcp-server run build && pnpm --dir packages/mcp-server test
pnpm check:skills
pnpm check:env-ports
```

Targeted checks passed:

```bash
node packages/web/scripts/run-with-node-env-test.mjs pnpm --dir packages/web exec vitest run \
  src/components/__tests__/workspace-panel-reveal-in-tree.test.ts \
  src/components/__tests__/workspace-navigate-store.test.ts \
  src/components/__tests__/preview-auto-open-store.test.ts

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js \
  --test packages/api/test/workspace-navigate.test.js
```

Post-rebase current HEAD check:

```bash
pnpm check
# All 20 checks passed (11881ms total)
```

### Dogfood

Direct handler dogfood with a temporary callback server passed:

- `handleWorkspaceNavigate(...)` posted to `/api/workspace/navigate` with expected body and auth headers.
- `handlePreviewOpen(...)` posted to `/api/preview/auto-open` with expected body and auth headers.

### Fallback Layer Self-Check

`node scripts/check-fallback-layers.mjs` triggered because `packages/api/src/routes/workspace.ts` has many existing fallback-shaped constructs; this slice added one best-effort canonicalization fallback:

```ts
canonicalWorktreeId = await resolveWorktreeIdByPath(root).catch(() => worktreeId);
```

Judgment: acceptable. `getWorktreeRoot(worktreeId)` has already validated the requested root. Reverse lookup only canonicalizes for event room/audit/readback consistency; falling back preserves existing behavior for any root that is valid but not reverse-resolvable. This is repairing the coordinate system (room id mismatch), not stacking recovery for an invalid path.

### Design / Artifact Hygiene

- Root media/design artifacts in worktree: none.
- Root media/design artifacts in committed diff: none.
- `.pen` visual comparison not run; no design file or visual layout changed.

## Review Focus

Please focus on:

1. `packages/mcp-server/src/tools/hub-action-tools.ts` schema/handler/tool description and collab toolset placement.
2. `packages/api/src/routes/workspace.ts` canonicalization semantics and audit/event response shape.
3. `packages/web/src/components/WorkspacePanel.tsx` effect behavior after Browser Preview auto-open.
4. Skill/docs wording: no first-party raw `curl localhost` main path remains for workspace/browser.
5. F223 docs: Phase B1 status is updated without prematurely marking AC-B4 complete.

---

*[砚砚/GPT-5.5🐾]*
