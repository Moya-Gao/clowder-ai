---
feature_ids: [F251]
topics: [opensource, sync, gate, baseline, review, request]
---

# Review Request: F251 Public Delta Gate Baseline Resolver

Review-Target-ID: f251
Branch: feat/f251-baseline-resolver

## What

Adds Task 2 for F251: a target-side baseline resolver for the Public Target Delta Preservation Gate.

Files:
- `scripts/check-sync-public-delta-gate.mjs`
- `scripts/check-sync-public-delta-gate.test.mjs`

The new `resolvePublicDeltaGateBaseline()` helper resolves `base_public` for a target checkout using this fail-closed order:

1. explicit `baseline` option, if reachable from target HEAD
2. latest reachable `sync/*` tag, using peeled commit epoch with lexical tie-break
3. latest first-parent commit that contains `.sync-provenance.json` with `source_commit_sha`
4. throw if no baseline can be proven

It fetches `origin main --tags` by default and supports `noFetch` for test/offline callers.

## Why

F251 Task 1 produced the pure classifier, but the gate is placebo if `base_public` is wrong. Task 2 implements the semantic hinge called out in the plan: baseline must be the last successful sync snapshot, not the current target HEAD and not `.sync-provenance.json.target_head_sha`.

## Original Requirements

> "3-way merge gate我记得我们现在开源项目的skills 就是 3-way merge？但是如果这么多事故为什么"
> "Task 2 baseline resolver（我愿景守护时点的'语义命门'——base 选错，classifier 再对也是 placebo）"
> "Task 2 / Task 4 都没做，所以现在 sync 跑起来，照样会无脑覆盖 clowder-ai 的 delta"

- 来源：当前 thread 2026-06-25 铲屎官 + F251 愿景守护/后续纠偏消息
- **请对照上面的摘录判断：这个 resolver 是否正确守住 F251 的 baseline invariant，而不是提前宣称 gate 已经生效。**

## Tradeoff

- This task does not add the report writer, CLI surface, or `sync-to-opensource.sh` wiring. Those remain F251 Tasks 3-4.
- Explicit baselines must be ancestors of target HEAD. I chose fail-closed over allowing detached/unreachable baselines because the gate must compare against a proven target history snapshot.
- Provenance fallback deliberately reads `source_commit_sha` only; `target_head_sha` is returned for diagnostics but never used as the baseline.

## Architecture Ownership

Architecture cell: sync/public-gate utility
Map delta: none
Why: extends the existing public delta gate script with git baseline resolution; no new Store / Queue / Router / Adapter / Dispatcher / Binding.

Please check:
- diff matches `Map delta: none`
- no caller can accidentally use `target_head_sha` as `base_public`
- tag/provenance fallback order matches `docs/plans/2026-06-25-f251-public-delta-preservation-gate.md`

## Open Questions

### 技术 OQ

1. Should explicit `baseline` require ancestry from target HEAD? I implemented yes, fail-closed.
2. Is selecting sync tags by peeled commit epoch plus lexical tie-break appropriate here? This matches the existing `sync-hotfix.sh` convention, but the resolver is now a reusable gate primitive.
3. Is `git fetch origin main --tags` the right default for Task 2, with `noFetch` only for tests/offline callers?

### 价值 OQ

无。This is a reversible F251 Task 2 implementation under the already-approved F251 scope.

## Next Action

Please review Task 2 semantics and tests. If approved, I will open the PR and continue through merge-gate. Please do not treat this as production protection yet; Task 4 wiring is still pending.

## Review Sandbox

No runtime needed; pure script + node:test.

- Path: `/tmp/cat-cafe-review/f251/opus48`
- Start Command: not needed
- Ports: `web=n/a`, `api=n/a`

### 沙盒 Bootstrap

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
```

## 自检证据

### Spec 合规

- Task 2 only: baseline resolver added, no CLI/report/sync wiring.
- INV-1/KD-2: resolver never uses `.sync-provenance.json.target_head_sha` as the baseline.
- Stale checkout guard: default fetch path covered by test.
- Scope boundary preserved: `sync-to-opensource.sh` still has zero references to the classifier/resolver.

### 测试结果

```bash
node --test scripts/check-sync-public-delta-gate.test.mjs
# 28 tests, 3 suites, 0 failures

node --test scripts/publish-sync-tag-basic.test.mjs scripts/publish-sync-tag-validation.test.mjs scripts/publish-sync-tag-rollback.test.mjs scripts/publish-sync-tag-shallow.test.mjs scripts/check-sync-public-delta-gate.test.mjs
# 51 tests, 7 suites, 0 failures

pnpm exec biome check scripts/check-sync-public-delta-gate.mjs scripts/check-sync-public-delta-gate.test.mjs
# passed

git diff --check
# passed

node scripts/check-fallback-layers.mjs
# scripts/check-sync-public-delta-gate.mjs: net +1, below governance threshold

pnpm check
# passed

pnpm gate
# GATE PASSED, SHA be328c84, all tests/lint/check passed
```

Architecture ownership hard script note:

```bash
pnpm check:architecture-ownership
# Command "check:architecture-ownership" not found
```

Manual ownership verdict: existing sync/public-gate utility extension, map delta none.

Root artifact hygiene:

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# empty

git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# empty
```

Tool landing check:

```bash
git status --short
# clean in feature worktree

(cd /Users/lysander/projects/relay-station/cat-cafe && git status --short)
# ?? .review-worktrees/
```

Main worktree note: `.review-worktrees/` is the existing retained review sandbox directory; not a Task 2 source change.

### 相关文档

- Feature: `docs/features/F251-public-delta-preservation-gate.md`
- Plan: `docs/plans/2026-06-25-f251-public-delta-preservation-gate.md`
- Previous Task 1 request: `docs/mailbox/2026-06-25-f251-public-delta-gate-classifier-review-request.md`
