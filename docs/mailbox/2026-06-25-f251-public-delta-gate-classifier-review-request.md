---
feature_ids: [F251]
topics: [opensource, sync, gate, review, request]
---

# Review Request: F251 Public Delta Gate Classifier

Review-Target-ID: f251
Branch: feat/f251-public-delta-gate

## What

Adds Task 1 for F251: a pure public-space classifier for the Public Target Delta Preservation Gate.

Files:
- `scripts/check-sync-public-delta-gate.mjs`
- `scripts/check-sync-public-delta-gate.test.mjs`

The classifier takes one path's `base_public` / `current_public` / `exported_public` blobs and returns one of the V1 modes:
- pass: source-only, equivalent-preserved, generated/provenance, target-owned
- block: target-only revert, both-changed conflict, target-added would-delete, delete/rename, binary
- override: blocked item converted only when an explicit override reason is present

It also produces report summary counts for pass/block/override plus revert/conflict/delete candidates and the `overrideCount > 3` CVO approval alarm.

## Why

F251 needs a hard gate that can prove whether outbound sync would erase clowder-ai target deltas before touching the real target checkout. This PR intentionally starts with a pure classifier so the safety contract is testable before wiring git baseline snapshots and `sync-to-opensource.sh`.

## Original Requirements

> "我们家经常 intake 回来pr 然后全量同步出去之后改坏别人的功能 不下十次了。"
> "这个其实很难知道是因为 intake 回家出现的问题把人家丢了还是后续哪里演进的时候出现的问题，怎么办？"
> "3-way merge gate我记得我们现在开源项目的skills 就是 3-way merge？但是如果这么多事故为什么"

- 来源：当前 thread 2026-06-25 铲屎官发言
- **请对照上面的摘录判断：这个 classifier 是否正确表达了 F251 V1 的硬门语义。**

## Tradeoff

- V1 blocks binary and delete/rename cases fail-closed instead of attempting hunk-level resolution. This keeps the first gate deterministic and reviewable.
- This does not wire git tags, target clone discovery, or `sync-to-opensource.sh` yet. Those are later F251 tasks; this PR only makes the core classification contract executable.
- This does not solve C3 home-side regressions where clowder-ai HEAD has no target delta. That is explicitly Phase B / Contract Registry scope.

## Architecture Ownership

Architecture cell: open-source sync pipeline extension
Map delta: none
Why: adds a pure sync-gate helper under existing `scripts/`; no new Store / Queue / Router / Adapter / Dispatcher / Binding.

Please check:
- diff matches `Map delta: none`
- the classifier names and summary fields stay aligned with `docs/plans/2026-06-25-f251-public-delta-preservation-gate.md`
- V1 fail-closed choices are acceptable for implementation Task 1

## Open Questions

### 技术 OQ

1. Should `theirsBlob === null` always be treated as `delete-or-rename-block` in V1, even if the export also omits the file? I chose fail-closed because delete/rename requires path-level provenance, not only blob equality.
2. Are `publicBehaviorId` and `linkedLedgerEntries` carried through at the right layer for A/B data fusion, or should they be nested under a `provenance` object before CLI/report integration?
3. Is `overrideCount > 3` enough for V1 alarm semantics, or should a single override on a high-risk mode such as `target-added-would-delete-block` also force CVO approval?

### 价值 OQ

无。F251 anchor and scope were CVO-approved; this is a reversible Task 1 implementation.

## Next Action

Please review the classifier semantics and tests. If approved, I will open the PR and move into merge-gate.

## Review Sandbox

No runtime needed; pure script + node:test.

- Path: `/tmp/cat-cafe-review/f251/opus47`
- Start Command: not needed
- Ports: `web=n/a`, `api=n/a`

### 沙盒 Bootstrap

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
node --test scripts/check-sync-public-delta-gate.test.mjs
pnpm check
```

## 自检证据

### Spec 合规

- Feature: `docs/features/F251-public-delta-preservation-gate.md`
- Plan: `docs/plans/2026-06-25-f251-public-delta-preservation-gate.md`
- Scope verdict: partial F251 Task 1 only; not a full F251 close.
- AC coverage: supports V1 report schema, `publicBehaviorId` A/B fusion, revert/conflict/delete summary counts, explicit override tracking, and future AC-A5 historical replay fixtures.
- Dogfood: exempt. This is a pure internal classifier with no user-visible/runtime path; direct node:test exercises the delivered API.
- Design/Pen: no UI diff; `designs/**/*.pen` F251/public-delta/sync match = none.

### 测试结果

```bash
node --test scripts/check-sync-public-delta-gate.test.mjs
# tests 11, pass 11, fail 0

pnpm biome check scripts/check-sync-public-delta-gate.mjs scripts/check-sync-public-delta-gate.test.mjs --diagnostic-level=error
# Checked 2 files. No fixes applied.

node scripts/check-fallback-layers.mjs
# scripts/check-sync-public-delta-gate.mjs: net +1 fallback layer; no threshold trigger

node scripts/check-architecture-ownership.mjs
# exits 0; OK diff architecture nouns; existing repo-wide warnings only

pnpm check
# exit 0; full workspace check passed

git diff --check -- scripts/check-sync-public-delta-gate.mjs scripts/check-sync-public-delta-gate.test.mjs
# exit 0
```

### Artifact Hygiene

Root media/design artifact check: no matches in worktree or `origin/main...HEAD`.

### 如果判断错了我最可能错在哪

1. Delete/rename fail-closed may be too conservative, but it is intentionally V1-safe.
2. The blob-level classifier cannot yet prove hunk-level non-overlap; that belongs to V2.
3. The override alarm may need severity weighting once A quantification produces more incident data.

[砚砚/gpt-5.5🐾]
