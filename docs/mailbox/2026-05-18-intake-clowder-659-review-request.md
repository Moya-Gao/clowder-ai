---
doc_kind: review_request
created_at: 2026-05-18
author: codex
source_pr: https://github.com/zts212653/clowder-ai/pull/659
target_pr: https://github.com/zts212653/cat-cafe/pull/1764
---

# Review Request: intake clowder-ai#659

Review-Target-ID: fix-intake-clowder-659
Branch: fix/intake-clowder-659

## What

Manual-port the useful part of `zts212653/clowder-ai#659` into Cat Cafe:

- Codex MCP binary lookup is now runtime-owned and no longer uses the thread `workingDirectory`.
- Split MCP entrypoints `collab`, `memory`, `signals`, and `limb` each start the callback refresh lifecycle.
- Regression tests cover the runtime-root invariant and the split-entrypoint refresh lifecycle.

## Why

Community PR #659 exposed a real fork/runtime bug: resolving Cat Cafe MCP binaries from a user project working directory can pick an incomplete checkout and make Codex see zero Cat Cafe MCP tools. We should absorb that behavior, but not cherry-pick the whole community diff because our home implementation already has stronger resolver and limb-server shape.

## Original Requirements

> 那你按照流程来合入 然后intake回家？

- 来源：本轮 A2A 用户指令 + intake tracking issue `https://github.com/zts212653/cat-cafe/issues/1763`
- 请对照上面的摘录判断交付物是否完成了「外部 PR 合入 + 家里 intake」两件事。

## Tradeoff

I skipped the source `.dir-exceptions.json` expiry churn and did not cherry-pick our already-diverged resolver/limb files. The only meaningful behavioral intake is runtime-root MCP lookup plus split-server refresh lifecycle.

For refresh lifecycle, this PR chooses per-entrypoint startup instead of making `collab` an implicit leader. That keeps `memory`, `signals`, and `limb` correct when launched independently.

## Architecture Ownership

Architecture cell: MCP server runtime / Codex provider integration
Map delta: none
Why: This modifies existing provider and MCP entrypoint behavior without creating a new Store, Queue, Router, Adapter, Dispatcher, Binding, ownership boundary, or canonical anchor.

Please check:

- whether the diff is consistent with `Map delta: none`
- whether the per-entrypoint refresh loop is acceptable for split MCP servers
- whether runtime-root lookup should include any additional explicit root beyond `CAT_CAFE_RUNTIME_ROOT`, `process.cwd()`, and import-meta fallback

## Open Questions

### Technical OQ

Should split MCP servers each own their callback refresh lifecycle now, or should we introduce a future shared leader/election model? My recommendation is to keep this PR's self-contained entrypoint invariant.

### Value OQ

None. No UI/UX changes; F190 full-sync restriction is not triggered.

## Next Action

Please review PR `https://github.com/zts212653/cat-cafe/pull/1764` and either block with concrete P1/P2 findings or approve the intake.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-intake-clowder-659/opus`
- Start Command: `pnpm review:start` if an interactive runtime is needed
- Ports: N/A for this backend/MCP unit-test review; do not use runtime ports `3001/3002` or alpha ports `3011/3012/4111`

## Self-Check Evidence

### Spec Compliance

- clowder-ai#659 merged by squash.
- clowder-ai#658 triaged and closed.
- Cat Cafe intake issue created: `https://github.com/zts212653/cat-cafe/issues/1763`.
- Cat Cafe intake PR created: `https://github.com/zts212653/cat-cafe/pull/1764`.
- No UI/UX files changed.

### Test Results

```bash
pnpm --dir packages/api build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/codex-agent-service.test.js
# 42/42 pass

pnpm --dir packages/mcp-server build && node --test packages/mcp-server/test/refresh-loop.test.js
# 13/13 pass

pnpm --dir packages/mcp-server test
# 208/208 pass

bash scripts/intake-from-opensource.sh --validate-inbound
# pass

pnpm lint
# pass, existing frontend hardcoded-color warnings only

pnpm check
# pass, existing architecture-ownership warnings only

node scripts/check-fallback-layers.mjs
# pass

node scripts/check-hotfix-pattern.mjs
# not hotfix
```

### Related Documents

- Intake issue: `https://github.com/zts212653/cat-cafe/issues/1763`
- Source PR: `https://github.com/zts212653/clowder-ai/pull/659`
- Target PR: `https://github.com/zts212653/cat-cafe/pull/1764`

[砚砚/GPT-5.5🐾]
