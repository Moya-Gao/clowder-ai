# F223 Phase D — Guardrail + Eval Loop Design Gate

**Feature:** F223 — `docs/features/F223-capability-surface-registry.md`
**Phase:** D, before implementation
**Status:** CVO accepted Option A (2026-06-04); implementation starting
**Owner:** 缅因猫/砚砚 (GPT-5.5)
**Architecture cells:** hub-action-surface + harness-eval
**Reason for gate:** AC-D1 is a new hard check / forcing-function behavior change. Per F192 Phase F AC-F9 decision #2, this must pass Design Gate / CVO accept before implementation.

## TL;DR

Recommended: approve a **scoped lightweight hard check** that blocks first-party Hub/API raw `curl localhost` as a skill main path, while explicitly allowing generic localhost health probes and test fixtures. Wire it into both `pnpm check` and merge-gate (`pnpm gate` already calls `pnpm check`). This turns the 2026-06-03 failure mode ("ability exists, cat handwrites API and user still cannot see result") into a cheap deterministic guard without banning legitimate debugging.

## Why This Is a Design Gate

F223 Phase B replaced the highest-friction display paths with typed surfaces:

- `cat_cafe_workspace_navigate` for workspace open/reveal.
- `cat_cafe_preview_open` for browser preview.
- Existing `cat_cafe_create_rich_block` aligned with rich-messaging trigger/eval.

Phase D proposes a hard layer: skills should not teach cats to handwrite first-party Hub/API mutation calls when a typed surface exists. That changes future authoring behavior for skills and refs, so it is a forcing function, not a docs cleanup.

F192 Phase F AC-F9 already set the governance weight:

> new forcing-function hook = behavior change -> Design Gate / CVO accept; pure demote/promote is lightweight owner closure.

This memo scopes the hard check and exception allowlist before code is written.

## Current State

`pnpm check:skills` currently checks skill mount / manifest consistency via `scripts/check-skills-mount.sh`.

`pnpm check` currently runs `check:skills:manifest`, but not `check:skills`. Merge-gate `pnpm gate` calls `pnpm check`, so a lightweight skill-surface check wired into `pnpm check` automatically covers PR merge. It does **not** cover a cat that directly pushes to `main` without running any local checks.

There is already one narrow raw-curl regression guard in `scripts/check-env-port-drift.test.mjs`:

- `workspace-navigator` must not teach raw `/api/workspace/navigate` curl as the main path.
- It must teach `cat_cafe_workspace_navigate({ ... })`.

Phase D should consolidate that idea into a first-class skill-surface check rather than continuing to add scattered one-off assertions.

## Direct-Commit Escape Concern

CVO concern (2026-06-04): current worktree rules exempt tiny pure-doc edits (`<=5` lines). Skills are markdown files, so a cat can make a tiny skill edit on `main`, skip `pnpm gate`, and push a bad raw-curl example. Then the next unrelated PR author hits the failure in merge-gate.

Phase D should handle this explicitly:

1. The checker must be **fast enough for `pnpm check`**, not a full build/test dependency.
2. `writing-skills` must say: if a skill/MCP description change mentions API routes, localhost, scripts, CLI commands, or first-party execution surfaces, run `pnpm check` before committing, even if the edit is `<=5` lines and no worktree was opened.
3. The worktree exemption should be clarified: "pure docs" excludes skill guidance that changes execution instructions for APIs/scripts/tools. Small wording-only skill edits can remain direct-main; execution-surface guidance must run the lightweight check.
4. This is still not a server-side guarantee against a cat ignoring all checks and pushing directly to `main`. If that repeats, the next escalation is a pre-push/git guard or shared-state guard update. Phase D should not claim stronger enforcement than it actually implements.

## Proposed Scope

### Scan Targets

Scan authored Cat Cafe skill guidance, not all docs:

1. `cat-cafe-skills/**/SKILL.md`
2. `cat-cafe-skills/refs/**/*.md`

Do not scan generated docs, historical feature specs, tests, or harness fixtures by default. Those legitimately contain raw curl examples as historical evidence or synthetic trace data.

### Blocked Pattern

Block raw `curl` examples that call **first-party Cat Cafe API mutation/action routes** from skill guidance as the recommended/main path, especially:

- `/api/workspace/navigate`
- `/api/preview/auto-open`
- `/api/callbacks/*`
- future routes explicitly mapped in the F223 registry as `execution_surface: typed_mcp` or `execution_surface: helper`

The guard should fail on examples that combine:

- `curl` or shell snippets,
- localhost / `127.0.0.1` / `$API_*` / `$CAT_CAFE_API_URL`,
- first-party `/api/...` action route,
- no nearby allowlist marker.

### Allowed Pattern

Allow generic localhost probes that do not mutate first-party Hub state and do not bypass an existing typed surface:

- checking a user app is alive, e.g. `curl -s -o /dev/null -w "%{http_code}" http://localhost:PORT`
- checking Cat Cafe API health/readiness, e.g. `/health` or `/api/ready`
- instructions warning "do not use raw curl as the main path"
- historical examples inside feature docs, tests, and eval fixtures

### Exception Allowlist

Use a small explicit allowlist checked into the repo, reviewed in the same PR as the guard.

Candidate shape:

```json
{
  "allow": [
    {
      "path": "cat-cafe-skills/browser-preview/SKILL.md",
      "pattern": "curl -s -o /dev/null -w \"%{http_code}\" http://localhost:PORT",
      "reason": "generic target app health probe; not a first-party Hub action"
    },
    {
      "path": "cat-cafe-skills/quality-gate/SKILL.md",
      "pattern": "curl -sf http://localhost:3002/health",
      "reason": "runtime health probe; read-only and no typed action surface exists"
    }
  ]
}
```

Implementation can choose exact file name, but the allowlist must be machine-checked and must require `path`, `pattern`, and `reason`.

## Implementation Plan If Accepted

### AC-D1: Hard Check

1. Add a dedicated Node script, e.g. `scripts/check-skill-first-party-surfaces.mjs`.
2. Add focused tests for:
   - red: raw `/api/workspace/navigate` curl in a skill is blocked.
   - red: raw `/api/preview/auto-open` curl in a skill is blocked.
   - green: typed MCP examples are allowed.
   - green: generic localhost app health probe is allowed.
   - green: negative warning text ("do not handwrite curl") is allowed.
   - fail-closed: missing/malformed allowlist fails.
3. Add `check:skills:surfaces` to `package.json`.
4. Add it to `scripts/run-checks.mjs` so `pnpm check` catches skill-surface regressions for direct-main/shared-doc workflows.
5. Ensure `pnpm gate` continues to catch it through the existing `pnpm check` step in `scripts/pre-merge-check.sh`.
6. Update `cat-cafe-skills/writing-skills/SKILL.md` publish checklist / common mistakes with the API/script guidance rule above.
7. Clarify `cat-cafe-skills/worktree/SKILL.md` exemption text so execution-surface skill guidance is not treated as trivial pure docs for verification purposes.
8. Move the existing workspace-navigator raw-curl assertion out of `check-env-port-drift.test.mjs` or duplicate coverage only temporarily with a TODO-free transition.

### AC-D2: Eval / Follow-Up Action Loop

Add a Phase D contract check that every F223 inventory row has an action path:

- `fix`
- `build`
- `keep_observe`
- `delete_sunset`
- `manual_probe_required`

F192 verdicts can satisfy this when present; otherwise the inventory row must name the manual probe / owner. This keeps registry entries from becoming a static spreadsheet with no follow-up path.

### AC-D3: PR Packaging

Use one Phase D PR unless the hard check implementation unexpectedly crosses a separate owner boundary:

- skill surface hard check + allowlist
- inventory action-loop contract
- F223 spec close-out

Do not split into one PR per capability.

## Non-Goals

- Do not ban all `curl localhost` in skills.
- Do not scan `docs/features/**` or test fixtures for historical examples.
- Do not introduce a runtime hook/JIT reminder in Phase D.
- Do not modify F192 predicate behavior in this PR unless the action-loop contract reveals a missing field.
- Do not require JSON registry generation unless the hard check needs a small machine-readable route map.

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| False positives block legitimate debugging guidance | Restrict scan to skill guidance; allow generic health probes; require reviewed allowlist entries with reason |
| Direct-main tiny skill edits still skip PR gate | Wire the check into `pnpm check`, update writing-skills/worktree SOP, and be explicit that full enforcement needs local/pre-push discipline |
| Guard becomes another scattered check | Add dedicated script and either wire into `check:skills` or `check`; migrate existing workspace-specific assertion |
| Cats work around the guard by writing vague prose | Contract test should block route/path examples and require typed surface examples for known first-party actions |
| Hard check ships without eval loop | AC-D2 pairs the guard with F192/manual action states; Phase D cannot close on AC-D1 alone |
| Too much CVO surface area | CVO accepts only policy scope + allowlist semantics; implementation details remain cat-autonomous |

## Design Gate Decision Packet

**TL;DR: Recommend Option A because it blocks the exact failure mode F223 exists to prevent while preserving normal localhost debugging and covering both PR gate and normal local `pnpm check` workflows.**

- **Why CVO is needed:** This is a new hard check that changes skill authoring behavior, explicitly requiring CVO accept under F192 Phase F AC-F9 decision #2.
- **If wrong:** Rollback cost is low/medium. The implementation can be reverted in one commit, but while active it may block skill PRs. False positives are mitigated through allowlist + narrow scan targets.
- **Trade-off weight:** Prefer reliability and user-visible execution over authoring convenience. Avoid broad bans that would hurt debugging.
- **Boundary conditions:** Recommendation holds only if the check is scoped to skill guidance and first-party action routes, not all docs/tests and not all localhost probes. It is a `pnpm check` / merge-gate guard, not a server-side block against a cat who skips all checks and force-pushes/direct-pushes.
- **Opposition considered:** A soft docs-only reminder is lower friction, but it already failed in the original workspace-navigator path; cats copied raw API guidance into action paths.
- **Value question:** Are we willing to add a narrow hard authoring gate to prevent cats from bypassing typed first-party capability surfaces?

## Decision Options

### Option A — Approve Scoped Hard Check (Recommended)

Authorize Phase D implementation with the scan targets, blocked patterns, allowlist semantics, `pnpm check` wiring, and writing-skills/worktree SOP clarification above.

Expected result: deterministic protection in normal local check + PR gate paths against reintroducing raw first-party API main paths in skills.

### Option A+ — Add A Local Git Guard Too

Authorize Option A and additionally require a pre-push/git guard that runs the skill-surface check when `cat-cafe-skills/**` changes.

Expected result: stronger direct-push protection for cats with guards installed, at the cost of more local workflow friction and another hook surface to maintain.

### Option B — Soft Check Only

Keep this as documentation / review guidance, no hard gate.

Expected result: lower immediate friction, but F223's central failure mode remains review-dependent.

### Option C — Delay Until F192 Eval Produces More Miss Data

Wait for eval:capability-wakeup to prove ongoing misses before adding any hard layer.

Expected result: avoids premature guard, but leaves already-known raw-curl regression class unguarded despite typed surfaces now existing.

## CVO Accept

Accepted 2026-06-04.

Decision: implement **Option A** — scoped lightweight hard check for first-party raw `curl localhost` skill main paths, wired into `pnpm check` / merge-gate, with `writing-skills` + `worktree` SOP clarification and reviewed exception allowlist.

Option A+ (pre-push/git guard) is deferred. Reconsider if direct-push skill-surface escape recurs.

## Original Requested CVO Accept

Please accept or reject:

> Approve Option A: F223 Phase D may implement a scoped lightweight hard check for first-party raw `curl localhost` skill main paths, wire it into `pnpm check` / merge-gate, update writing-skills + worktree SOP, and keep the reviewed exception allowlist and non-goals above.
