---
title: "Review request: Antigravity retry-safe PR inspection recovery"
date: "2026-05-23"
author: codex
reviewer: opus
status: requested
pr: 1864
review-target-id: ag-recovery-readonly-retry
---

# Review Request: Antigravity Retry-Safe PR Inspection Recovery

Review-Target-ID: ag-recovery-readonly-retry
Branch: fix/ag-recovery-readonly-retry
PR: https://github.com/zts212653/cat-cafe/pull/1864

## What

- Add `pull_request_read` to Antigravity's retry-safe MCP read allowlist.
- Classify read-only GitHub PR inspection shell commands (`gh pr view`, `gh pr diff`, `gh pr checks/list/status`) as `tool_read`.
- Add Red->Green coverage for the observed failure: native-dispatched `gh pr view ...` followed by `Error: 工具调用失败` retries a fresh cascade and does not surface an Antigravity recovery card.

## Original Requirements

Source: thread message from Landy, 2026-05-23.

> 人家是 Error: 工具调用失败了吧？
> 而且网络挂了 你也应该有retry把？
> 不能如此的脆弱吧！

## Why

During `@antig-opus` review of F210 PR #1863, Antigravity recovery surfaced resumable-error diagnostics for failed PR inspection calls. Those operations were read-only (`pull_request_read`, `gh pr view`), so the recovery policy should be allowed to retry instead of treating them as possible side effects.

## Architecture Ownership

Architecture cell: transport + bubble-pipeline
Map delta: none
Why: This extends the existing Antigravity step-effect classifier and retry-safe recovery behavior. It does not add a new queue, router, provider, store, or cross-cell boundary.

## Review Focus

1. The allowlist boundary should stay narrow: PR inspection only. Mutating commands such as `gh pr merge/comment/review/close/edit` must remain unsafe by default.
2. `pull_request_read` should be safe both directly and when namespaced as `github-mcp-server__pull_request_read`.
3. Receipt conflict after a read-only native dispatch should retry a fresh cascade, not create a manual recovery card.

## Self-Check Evidence

```bash
# Red before production fix:
node --test packages/api/test/antigravity-step-effects.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js
# Failed: pull_request_read and gh PR inspection classified as side_effect; receipt conflict did not retry.

# Green after fix:
pnpm --filter @cat-cafe/mcp-server run build
pnpm --filter @cat-cafe/api run build
node --test packages/api/test/antigravity-step-effects.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js
# 90 pass, 0 fail

pnpm check
# pass

git diff --check
# pass

pnpm check:architecture-ownership
# exit 0; warning-only legacy backlog/doc warnings, OK diff architecture nouns
```

Artifact hygiene:

```bash
git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' || true
git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' || true
# no output
```

[砚砚/GPT-5.5🐾]
