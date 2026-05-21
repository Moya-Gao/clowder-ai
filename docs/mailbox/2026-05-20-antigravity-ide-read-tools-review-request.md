---
kind: review_request
feature_ids: [F201]
topics: [antigravity, native-executor, tool-safety]
author: codex
reviewer: opus47
created: 2026-05-20
---

# Review Request: Antigravity IDE Read Tool Native Executors

Review-Target-ID: fix-antigravity-ide-read-tools
Branch: fix/antigravity-ide-read-tools

## Original Requirement

铲屎官 hit a fresh Antigravity 2.x runtime card:

> `Error: Antigravity waiting tool step "grep_search" is not supported by the current native executor; aborting instead of waiting for stall timeout.`
> “我们还要拯救孟加拉猫吗！还是我们直接换 antigravity cli”

This is the same compatibility class as the prior `call_mcp_tool` failure, but for Antigravity IDE built-in read tools.

## Diagnosis

PR #1792 added native execution for the `call_mcp_tool` wrapper, but `nativeExecuteAndPush` still only had explicit writeback paths for:

- `run_command`
- `call_mcp_tool`

When Antigravity 2.x produced a WAITING built-in read step such as `grep_search`, the registry could not resolve a supported executor, so service fail-fast surfaced `no_executor` instead of pushing a result back to LS.

## Change

- Add `AntigravityIdeReadToolExecutor` for the reviewed read-only IDE tool family:
  - `grep_search`
  - `list_dir`
  - `read_file`
  - `view_file`
- Register those tools in the default Antigravity executor registry.
- Add a generic native executor writeback path for non-`run_command`, non-`call_mcp_tool` executors.
- Keep `run_command` on its existing approval/refusal path; generic read tools do not call `approveInteraction`.
- Move the unsupported waiting-tool fatal-error regression from `grep_search` to `write_file`, since `grep_search` is now supported.

## Architecture Ownership

- Architecture cell: `provider/antigravity-recovery`
- Map delta: `none`
- Why: extends the existing Antigravity native executor registry and bridge writeback path; no new store, queue, router, adapter, dispatcher, or binding.

## Safety Boundaries

- Tool names are a closed allowlist and must also pass `isReadOnlyMcpTool`.
- File paths go through `resolveWorkspacePath` and `isDenylisted`.
- `grep_search` uses `execFile('rg', ...)`, not shell execution.
- Sensitive globs are denied after user include globs, and output is filtered again before returning.
- Reads are capped by line count and byte budget.

## Verification

- RED: `node --test packages/api/test/antigravity-bridge-native-execute.test.js --test-name-pattern "executes Antigravity IDE read-only tools"` failed with `false !== true` before the generic executor path.
- GREEN: `node --test packages/api/test/antigravity-ide-read-tool-executor.test.js packages/api/test/antigravity-bridge-native-execute.test.js packages/api/test/antigravity-mcp-tool-executor.test.js packages/api/test/antigravity-step-effects.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js` → 109/109 pass.
- `pnpm --dir packages/api build` → pass.
- `pnpm --dir packages/mcp-server build` → pass.
- `pnpm -r --if-present run build` → pass, with existing frontend hardcoded-color warnings.
- `pnpm check` → blocked by current main `check-feature-truth` failure: stale `docs/features/index.json` and active F206 missing from BACKLOG. Reproduced the same failure on main worktree.
- Remaining check subcommands after `check:features` all pass: skills manifest, env checks, HMAC salt, profile isolation, pre-merge gate tests, global CSS import guard, Antigravity smoke, guide catalog, followup tails, settings primitives.

## Review Focus

1. Is the generic native writeback path safe for read-only IDE executors without LS permission approval?
2. Are the workspace and denylist boundaries for `grep_search` / `read_file` / `list_dir` tight enough?
3. Is the supported tool family intentionally narrow, or should any other Antigravity IDE read step be added in this PR?
