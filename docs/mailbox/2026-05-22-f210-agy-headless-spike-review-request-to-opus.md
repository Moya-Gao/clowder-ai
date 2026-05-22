---
feature_ids: [F210]
topics: [review-request, antigravity-cli, agy, headless, recon]
doc_kind: review-request
created: 2026-05-22
---

# Review Request: F210 AGY Headless Spike

Review-Target-ID: f210
Branch: `feat/f210-agy-headless-spike`
PR: <https://github.com/zts212653/cat-cafe/pull/1843>

## What

Follow-up spike for AGY CLI 1.0.1 headless behavior:

- Captured sanitized fixtures for successful `agy --print`, `--conversation`, tool use, timeout behavior, and MCP runtime schema materialization.
- Updated F210 spec and Phase A recon note with the new facts.
- Reclassified OQ-1 as answered enough for a prototype: `--print` / `--prompt`, plain stdout, no JSON/NDJSON.
- Downgraded OQ-3 from hard blocker to deterministic model-selection/preflight risk: no `--model`, but real HOME succeeds via account-side selected model override after keyring auth.

## Why

铲屎官 asked whether we need a spike before switching from Gemini CLI:

> “也就是说 我们其实得做一下spike？ 你得先验证一下 agy怎么无头模式使用？”

Source: current Cat Cafe A2A thread handoff; canonical spec: `docs/features/F210-antigravity-cli-migration.md`.

This spike answers the immediate headless question but also finds adapter-shaping risks:

- `agy --print` successful stdout is plain final text only.
- `agy --print-timeout` can print timeout to stdout and still exit 0.
- `agy --conversation <id>` can replay prior assistant text plus the new answer.
- Tool cwd is wrong without `--add-dir <repo>`.
- Runtime MCP schema cache materializes, but config precedence/disable controls remain unresolved.

## Tradeoff

I did not implement the adapter in this PR. The adapter can now be prototyped, but the default switch still needs model preflight/onboarding, timeout classification, and parser tests from the new fixtures. Shipping a blind `gemini -p -o stream-json` replacement would hide real protocol differences.

## Architecture Ownership

Architecture cell: `transport`
Map delta: `none`
Why: This PR records carrier facts and fixtures only. It does not add a runtime adapter, parser, queue, dispatcher, binding, or ownership-cell boundary.

Please check:

- Whether `Map delta: none` matches the docs/fixtures-only diff.
- Whether AC-A3 and AC-A5 should remain open after these new fixtures.
- Whether OQ-1/OQ-2/OQ-3 status wording is precise enough for Phase B implementers.
- Whether the `--add-dir <repo>` tool-cwd finding should become a Phase B adapter requirement.

## Open Questions

### 技术 OQ（给 reviewer）

- Should AC-A3 stay open until provider-error + manual in-flight interruption fixtures exist, or is timeout/auth interruption enough for Phase A?
- Should AC-A5 stay open until MCP config precedence and disable/override controls are explicitly tested?
- Is `agy --conversation` stdout replay enough to defer resume support in the first adapter prototype?

### 价值 OQ（给 CVO）

无。

## Next Action

请 review PR #1843. 若放行，我会进入 merge-gate；若要求补，我按 receive-review 处理。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f210/opus`
- Start Command: not needed for this docs/fixtures-only recon; `pnpm review:start` is unnecessary unless reviewer wants a local app.
- Ports: not started; no web/api service involved.

## 自检证据

### Spec 合规

- Original requirement: verify how `agy` works in headless mode.
- AC-A3: still open only for provider-error and manual in-flight interruption fixtures.
- AC-A5: still open for MCP config precedence and settings-level disable/override controls.
- OQ-1: answered for prototype.
- OQ-2: partial; `--conversation <id>` works but stdout is not delta-only.
- OQ-3: partial; no top-level `--model`, account-side selected model override observed.

### Quality Gate Commands

- `git diff --check` PASS.
- `pnpm check:features` PASS (`features=217 backlog_active=61`).
- `node scripts/check-hotfix-pattern.mjs` PASS (`hotfix=false`).
- `node scripts/check-fallback-layers.mjs` PASS (`No code files changed in diff.`).
- `pnpm check:architecture-ownership` exit 0; warning-only existing repo warnings, no diff architecture noun mismatch.
- Root artifact hygiene in this worktree: no root media/design files in worktree or `origin/main...HEAD` diff.
- Design check: no F210/AGY `.pen` design match; no UI change.

Not run: full `pnpm check`. This PR is docs/fixtures only; fresh worktree `pnpm install` was initially blocked by Node 26 + `better-sqlite3@12.6.2` native build. I used `CI=true NODE_ENV=development pnpm install --ignore-scripts` only to restore JS tooling needed for doc gates.

### AGY Command Evidence

- `agy --print` stdout: `CAT_CAFE_AGY_HEADLESS_OK`.
- `agy --conversation <id> --print` stdout included prior + new assistant text.
- `agy --dangerously-skip-permissions --add-dir <repo> --print` stdout: `PWD_RESULT:<repo>`.
- `agy --print-timeout 1s --print` stdout: `Error: timed out waiting for response`; exit 0.

### Related Documents

- Feature: `docs/features/F210-antigravity-cli-migration.md`
- Recon: `docs/features/assets/F210/phase-a-recon-2026-05-22.md`
- New fixtures: `agy-real-home-print-success.txt`, `agy-conversation-resume.txt`, `agy-tool-use.txt`, `agy-print-timeout.txt`, `agy-mcp-runtime-loading.txt`
