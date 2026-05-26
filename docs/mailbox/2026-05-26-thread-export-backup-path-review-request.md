---
topics: [thread-export, redis, memory-index, review-request]
doc_kind: mailbox
created: 2026-05-26
---

# Review Request: Thread export backup path

Review-Target-ID: fix-thread-export-backup-path
Branch: fix/thread-export-backup-path

## What

- Moved thread markdown export defaults from `docs/discussions/exported-threads/` to ignored local recovery state at `.cat-cafe/thread-exports/repo/`.
- Kept Redis as the live thread source; this change does not touch `/api/threads` or thread selection.
- Added scanner protection so generated `exported-threads` directories under current or archived discussion trees do not enter memory evidence indexing.
- Updated Redis data safety docs and added a focused plan with acceptance criteria.
- Stopped the installed LaunchAgent in the main worktree and moved the existing 977 generated dumps into `.cat-cafe/thread-exports/repo/` without deleting data.

## Why

`docs/discussions/exported-threads/` was both the autosave target and inside the memory scanner's curated docs tree. That made raw thread dumps look like discussion docs and risked polluting `search_evidence`. The durable design is: Redis remains canonical for live threads; markdown exports are recovery/offsite artifacts outside `docs/`.

## Original Requirements

> 你给一份设计吧？然后把我们的事情整一下！
> 你说的这三件事不用问我，你可以问46或者47选一只布偶猫你们完成闭环

- Source: current Cat Café A2A thread, Landy message at 2026-05-25 21:45 PT; copied into `docs/plans/2026-05-26-thread-export-backup-path.md`.
- Please check the diff against the above requirement: design first, then close the repo/runtime cleanup loop without bouncing the decision back to Landy.

## Tradeoff

I did not delete existing offsite snapshots or the local generated dump set. The current untracked dump directory was moved to ignored local recovery state, preserving recovery value while removing it from `docs/` and Git status. I also left explicit `THREAD_EXPORT_REPO_DIR` overrides intact for operators who intentionally want another path.

## Architecture Ownership

Architecture cell: memory
Map delta: none
Why: This changes generated artifact placement and memory scanner exclusions, but adds no new store, queue, router, adapter, dispatcher, binding, or ownership boundary.

Please check:

- Diff matches `Map delta: none`.
- Redis remains the live source for thread sidebar/selection.
- `exported-threads` exclusion is narrow enough to avoid raw dumps while preserving curated discussion docs.

## Open Questions

### 技术 OQ（给 reviewer）

- Should the scanner exclusion remain segment-based for any `exported-threads` directory, or be narrowed specifically to discussion trees?
- Is keeping `THREAD_EXPORT_INCLUDE_LEGACY=1` acceptable now that the default repo target moved out of `docs/`?

### 价值 OQ（给 CVO，如有）

无。

## Next Action

Please review this worktree. If approved, I will commit, push, and enter merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-thread-export-backup-path/opus47`
- Start Command: no service start needed; run the script/test commands below.
- Ports: n/a (no web/api server; do not use 3001/3002/3011/3012/4111)

## 自检证据

### Spec 合规

- Plan: `docs/plans/2026-05-26-thread-export-backup-path.md`
- AC: Redis remains canonical live source; no `/api/threads` or ThreadStore changes.
- AC: export/sync/autosave defaults now point to `.cat-cafe/thread-exports/repo/`.
- AC: `docs/discussions/exported-threads/` is ignored as legacy generated output.
- AC: `CatCafeScanner` skips generated `exported-threads` directories.
- AC: offsite snapshots remain; current main dump was moved to `.cat-cafe/thread-exports/repo/` with 977 markdown files preserved.
- Dogfood: `export-threads-from-redis.mjs --help` and `thread-exports-sync.sh status` both show the new local recovery repo path in the worktree.
- Artifact hygiene: no root media/design artifacts; main worktree is clean after moving the generated dump.

### 测试结果

```bash
pnpm --filter @cat-cafe/api run build
# passed

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash scripts/with-test-home.sh node --test test/launchd-agent-path.test.js test/memory/index-builder.test.js
# 67 passed, 0 failed

pnpm --filter @cat-cafe/api run lint
# passed

pnpm check
# passed

git diff --check
# passed

./scripts/thread-exports-autosave.sh status
# launchd: not loaded

find .cat-cafe/thread-exports/repo -type f -name '*.md' | wc -l
# 977
```

### 相关文档

- Plan: `docs/plans/2026-05-26-thread-export-backup-path.md`
- Runbook: `docs/runbooks/redis-data-safety.md`
