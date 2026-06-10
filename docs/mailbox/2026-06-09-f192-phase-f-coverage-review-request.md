---
feature_ids: [F192]
topics: [review-request, capability-wakeup, harness-eval, phase-f]
doc_kind: mailbox
created: 2026-06-09
---

# Review Request: F192 Phase F capability-wakeup coverage expansion

Review-Target-ID: f192
Branch: feat/f192-phase-f-coverage
PR: https://github.com/zts212653/cat-cafe/pull/2180

## What

This PR closes the code side of F192 Phase F coverage expansion:

- expands `eval:capability-wakeup` Tier 1 coverage to all 13 L0 §8 capability entries
- adds Tier 1 tool-use evidence mapping, including `cat_cafe_publish_verdict` -> `eval-verdict`
- supports omitted `sessionIds` by scanning runtime sessions inside the requested window
- carries cat family into capability trials and emits live verdict `components[].byFamily`
- syncs F192 feature doc and BACKLOG to the current truth

## Why

F192 Phase F had a working v1 path, but the data was still biased: only 3/13 Tier 1 capabilities had rules and eval-cat instructions still implied hand-picked `sessionIds`.
This PR makes the next re-eval pass meaningful while keeping `F192-sop-wiring` and Phase G writeback out of scope.

## Original Requirements

> "f192的f 我们是不是需要按照实际的情况更新一下md？ 然后看看f192还有什么没完成？这里指的是真实的！ 你得看看文档漂移的情况了，记得更新文档"
> "PR-A + PR-B 可以合成一个 PR... PR-C（sop-wiring）完全独立... PR-D（G writeback）很小，可以单独一个快速 PR -〉这个是人家phase g 那个thread你可以不管，其他的让砚砚开搞？ 砚砚喵 你觉得两个pr可以吗？"

- 来源：当前 A2A thread，铲屎官消息 `0001781020137389-000085-30a09be4` / `0001781028474916-000194-ab24b035`
- Please verify the PR matches this split: PR-1 = Phase F coverage/window scan; PR-2 = sop-wiring; Phase G writeback excluded.

## Tradeoff

- AC-F8 is implemented as runtime-session window scanning plus per-family snapshot split, not a durable trial store with stable trial IDs.
- Missing runtime-session metadata is not backfilled in this PR; sessions without `threadId` are skipped and missing family becomes `unknown`.
- `F192-sop-wiring` remains a separate PR because it restores `eval:sop` trace producer/file-writer/publish registration and does not share the capability-wakeup selector/rule scope.

## Architecture Ownership

Architecture cell: harness-eval
Map delta: none
Why: This extends the existing harness-eval capability-wakeup rule/provider/generator path. It does not add a parallel Store, Queue, Router, Adapter, Dispatcher, or Binding, and it does not change architecture ownership boundaries.

Please check:

- diff matches `Map delta: none`
- `runtimeSessionStore.listRecent({ limit: 500 })` is an acceptable first window enumerator for AC-F8 v1
- `components[].byFamily` belongs in snapshot JSON rather than attribution JSON

## Open Questions

### 技术 OQ（给 reviewer）

- Is `lifecycle.lastObservedAt` the right first unbiased runtime-session window boundary, or should this scan eventually use a separate persisted trial index?
- Is `unknown` the right family bucket for sessions whose cat metadata is unavailable?
- Does the new family-breakdown helper keep the 350-line generator limit without hiding important verdict semantics?

### 价值 OQ（给 CVO）

无。两个-PR切法已按铲屎官当前指令执行。

## Next Action

Please review PR #2180 in code-review mode. If approved, I will move to PR-2 (`F192-sop-wiring`) separately.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f192/opus`
- Start Command: `pnpm review:start`
- Ports: `web=n/a`, `api=n/a` (backend harness/provider/generator PR; no frontend runtime slice)

## 自检证据

### Spec 合规

- F192 doc updated for AC-F7/AC-F8 truth and remaining AC-F9 re-eval closure.
- BACKLOG F192 row updated from Phase F coverage to Phase F re-eval closure.
- Dogfood scope: internal harness/provider/generator path; no frontend/user-visible runtime slice.
- Architecture ownership: `pnpm check:architecture-ownership` exits 0; diff architecture nouns are OK, remaining warnings are pre-existing stale anchors / feature declarations.
- Fallback layer check: exits 0; final diff has no per-file ≥3 new fallback trigger and net fallback change is +2. Cumulative warning remains because touched files already have high historical fallback counts; new fallbacks are limited to runtime-session window bound check, unknown-family bucket, and tool summary success guard.
- Artifact hygiene: root-level media/design worktree check and committed diff check both have 0 matches.
- Pen check: no F192/capability/harness `.pen` design file matched.

### 测试结果

```bash
pnpm --dir packages/api build
# pass

git diff --check
# pass

pnpm check:features
# PASS check-feature-truth: features=235 backlog_active=61

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/harness-eval/capability-wakeup-rules.test.js test/harness-eval/capability-wakeup-trial-provider-window-scan.test.js test/harness-eval/capability-wakeup-tool-use-mapping.test.js test/harness-eval/publish-verdict-capability-wakeup-strict-validation.test.js test/harness-eval/capability-wakeup-trial-provider-impl.test.js test/harness-eval/capability-wakeup-trial-provider.test.js test/harness-eval/eval-capability-wakeup-trace.test.js test/harness-eval/eval-capability-wakeup-classify.test.js test/harness-eval/eval-capability-wakeup-live-verdict.test.js test/harness-eval/capability-wakeup-generator-adapter.test.js test/harness-eval/publish-verdict-capability-wakeup.test.js
# tests 72, pass 72

pnpm biome check <changed files>
# exit 0; warnings are pre-existing index.ts / publish-verdict.ts complexity, non-null, and node: import warnings
```

### 相关文档

- Feature: `docs/features/F192-socio-technical-harness-eval.md`
- BACKLOG: F192
- PR: https://github.com/zts212653/cat-cafe/pull/2180

[砚砚/GPT-5.5🐾]
