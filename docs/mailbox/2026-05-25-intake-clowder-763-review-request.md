---
feature_ids: [F153]
topics: [opensource-intake, review-request, telemetry]
doc_kind: review_request
created: 2026-05-25
---

# Review Request: intake clowder-ai#763

Review-Target-ID: intake-clowder-763
Branch: intake/clowder-763-f153-phase-j
PR: cat-cafe#1896
Code commit under review: 53cc063bbcc133ce2c96ddcf67ee6eb25c0964a2
Note: this mailbox document is a metadata-only follow-up commit; use the live PR
head from cat-cafe#1896 for the final review coverage statement.
Intake Intent Issue: cat-cafe#1895
Source PR: clowder-ai#763
Source merge commit: 577b638b7d327d7ecd642deddeb6cdd53356fa0f

## Original Requirements

铲屎官在当前 thread 的要求：

> clowder-ai#763 ... 加载开源社区管理skills 看看这个pr inbound流程 maintainer身份而言这个pr对我们自己有益吗？他的内容是什么？我们值得merge 和intake吗？
> 那你走intake 回家的流程吧，merge 然后读sop 走流程回家。记得一定要好好看看intake skills。

## What Changed

Absorbs F153 Phase J Slice J-A foundation from clowder-ai#763:

- adds `ToolSpanTracker`, scoped per invocation
- uses provider-native `toolUseId` to create/close real-duration MCP tool spans
- preserves legacy fallback for providers without native ids
- shares MCP classification via `isMcpToolName`, including Codex `mcp:`
- keeps tool result bodies / metadata out of span attrs

## Why

F153 Phase J's user-facing goal is better Hub trace observability: MCP tool calls should show as real spans with duration and status, not zero-duration point markers.

## Architecture Ownership

- Architecture cell: F153 observability / telemetry spans around agent invocation.
- Map delta: none. This extends the existing invocation telemetry surface; it does not introduce a new router/store/dispatcher boundary.
- Why: The tracker is intentionally per invocation and hangs child spans off the existing invocation span, preserving the existing trace tree ownership model.

## Reviewer Focus

Please review against cat-cafe#1895, not just the diff:

1. Path Guard: final PR diff must stay within the six source files plus review/ledger metadata exceptions.
2. Source intent: real-duration MCP tool spans are paired by `toolUseId`; same-name parallel tools and out-of-order results are safe.
3. Home invariants: no provider without native id regresses; legacy `recordToolUseSpan`/`tool.basic_call_count` still works.
4. Privacy boundary: no tool result body or metadata is accepted by `ToolSpanTracker.end()` or written to span attrs.
5. Validation commands in PR body must be runnable from repo root.

## Validation Run

```bash
bash scripts/intake-from-opensource.sh --pr 763 --mode=plan
git diff --check main...HEAD
bash scripts/intake-from-opensource.sh --validate-inbound
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/api exec node --test test/telemetry/tool-span-tracker.test.js
pnpm check
pnpm lint
```

Results:

- Brand Guard passed.
- API build passed.
- `tool-span-tracker.test.js`: 14/14 passed.
- `pnpm check` passed.
- `pnpm lint` passed; web hardcoded-color warnings are existing warnings outside this API-only diff.

[砚砚/GPT-5.5🐾]
