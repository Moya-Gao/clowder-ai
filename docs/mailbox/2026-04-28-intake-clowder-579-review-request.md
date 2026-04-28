# Review Request: intake clowder-ai#579 F153 trace persistence

Review-Target-ID: intake-clowder-ai-579
Branch: intake/clowder-ai-579
PR: https://github.com/zts212653/cat-cafe/pull/1449
Author: codex
Reviewer: opus

## What

Absorb merged upstream PR `zts212653/clowder-ai#579` into cat-cafe for F153 Phase F trace persistence via pointer association.

- Persist `extra.tracing` pointers for route/user and assistant messages.
- Compact tracing serialization to `t/s/p` while parsing back to `{ traceId, spanId, parentSpanId }`.
- Hydrate `LocalTraceStore` from recent Redis `msg:timeline` messages on cold start.
- Add F153 trace persistence regression tests.
- Update `docs/features/F153-observability-infra.md` and regenerate `docs/features/index.json`.

## Why

Landy asked us to merge the accepted community PR if it was safe, then run the open-source intake flow back into cat-cafe. The maintainer concern was release safety: this should not perturb unrelated intake/runtime behavior before ledger completion.

## Original Requirements

> 如果你觉得可以合入了，那你走intake 回家的流程吧，merge 然后读sop 走流程回家
> 记得一定要好好看看intake skills 大多数猫猫都会犯错

- 来源：当前 thread 导航原文；intake intent issue: https://github.com/zts212653/cat-cafe/issues/1448
- 请对照上面的摘录判断：是否按 inbound intake SOP 保守吸收、是否没有提前动 ledger。

## Tradeoff

- Ledger is intentionally not recorded/advanced in this PR. Per inbound intake SOP, `docs/ops/opensource-intake-ledger.json` waits for formal review proof against the cat-cafe PR HEAD.
- `test:public` has unrelated baseline failures in A2A/MCP config/cat count/system prompt areas. I did not widen scope to fix those in this intake branch.
- `docs/features/index.json` includes generator drift for F179 because `pnpm check:features` requires the generated index to match current docs.

## Open Questions

- Confirm the high-risk route files preserve existing `rich`, `stream.invocationId`, `toolEvents`, and serial parent invocation semantics.
- Confirm `index.ts` hydration remains fail-open and does not block startup.
- Confirm `updateExtra()` merge semantics preserve existing extra subfields while adding `tracing`.
- Confirm the ledger should remain untouched until review proof exists.

## Next Action

Please review PR #1449. If accepted, leave a formal review/proof comment covering the current PR HEAD, then this branch can proceed to ledger `--record` and `--advance-ledger`.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/intake-clowder-ai-579/opus`
- Start Command: `pnpm review:start`
- Ports: N/A for this review unless reviewer chooses runtime validation; this PR has no frontend UI changes.

## 自检证据

### Spec 合规

- F153 AC-F1 through AC-F7 marked complete in `docs/features/F153-observability-infra.md`.
- AC-F8 remains unchecked because tool-use span persistence is explicitly deferred.
- Source PR and accepted issue are linked from the feature doc.

### 测试结果

Passed:

```bash
bash scripts/intake-from-opensource.sh --validate-inbound
git diff --cached --check
pnpm --dir packages/api lint
pnpm --filter @cat-cafe/api build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test test/telemetry/trace-persistence.test.js
pnpm check:features
```

Known scope-out failures:

```text
pnpm check
```

Fails on existing Biome formatting in `packages/api/src/config/cat-catalog-store.ts`, outside this intake diff.

```text
pnpm --dir packages/api run test:public
```

Ran 8737 tests: 8728 pass, 7 fail. Failing areas are A2A prompt injection, MCP config env expectations, cat count, and system prompt length; none of those files are modified by this intake PR.

### Artifact Hygiene

No root-level media/design artifacts in the target worktree or committed diff.

### 相关文档

- Source PR: https://github.com/zts212653/clowder-ai/pull/579
- Source issue: https://github.com/zts212653/clowder-ai/issues/592
- Intake issue: https://github.com/zts212653/cat-cafe/issues/1448
- Feature: `docs/features/F153-observability-infra.md`
