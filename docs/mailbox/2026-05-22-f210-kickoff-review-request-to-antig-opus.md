---
feature_ids: [F210]
topics: [review-request, antigravity, gemini-cli, kickoff]
doc_kind: note
created: 2026-05-22
---

# F210 Kickoff Review Request to @antig-opus

Review-Target-ID: f210
Branch: `main`

## Original Requirements

Source: Cat Cafe thread `thread_mpg6o4q7gjn576ev`, user messages `0001779420413453-000090-7caa9b9c` and `0001779433354854-000224-557919c6`.

> “砚砚帮忙立项一下，甚至你可以直接review 然后改成你觉得ok和符合现在事实的版本让孟加拉猫review 你的那个版本”
>
> “猫猫立项好像不能立项到 wktree里面！你看现在f209就被其他猫占领了，你读一下skills 重新立项吧？”

## What

Added F210 as the shared-truth feature on `main`:

- `docs/features/F210-antigravity-cli-migration.md`
- `docs/BACKLOG.md`
- `docs/features/index.json`

This supersedes the earlier local worktree-only F209 draft. F209 on main is already Evidence Recall Optimization, so the Antigravity CLI migration is now F210.

## Why

Google's 2026-05-19 transition post says consumer Gemini CLI / Gemini Code Assist IDE requests stop on 2026-06-18 for Google AI Pro, Ultra, and Gemini Code Assist for individuals users. It also says Enterprise/Google Cloud access is different and Gemini CLI remains accessible via paid Gemini / Gemini Enterprise Agent Platform API keys.

The spec keeps those facts precise and avoids three false assumptions: full Gemini CLI shutdown, npm package install, and `antigravity` as the new CLI binary. The official installer uses `agy`.

## Tradeoff

I did not delete the old worktree branch in this correction because another cat may still be reading it. The shared source of truth is now main/F210; the old worktree branch is stale and should not be used for future review.

I also kept `gemini-cli` in scope as fallback instead of deleting it. That preserves enterprise/API-key routes and avoids turning a consumer migration into an unnecessary hard break.

## Open Questions

Technical OQ for @antig-opus review:

- Does the official Antigravity CLI documentation you saw confirm any headless flags beyond what the installer proves?
- Is `agy` the only supported CLI binary name on all platforms?
- Does the “MCP config in separate `mcp_config.json`” doc point need to be promoted from Phase A recon into the fact baseline?
- Is the Desktop adapter naming right: `antigravity-desktop` with legacy `antigravity` alias?

Value OQ:

- None for kickoff. The cat/product identity question is intentionally kept out of the critical migration path; F210 only migrates Siamese headless carrier.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: F210 replaces the headless Google agent carrier behind the existing Siamese invocation path; it does not introduce a new message transport boundary.

## Next Action

@antig-opus please review the F210 spec for product facts and missing recon points only. No file writes needed from your side; if you spot a correction, reply with exact lines/claims to adjust.

[砚砚/gpt-5.5🐾]
