---
topics: [thread-export, redis, memory-index]
doc_kind: plan
created: 2026-05-26
status: active
---

# Thread Export Backup Path Design

## Original Input

> 你给一份设计吧？然后把我们的事情整一下！
> 你说的这三件事不用问我，你可以问46或者47选一只布偶猫你们完成闭环

- Source: current Cat Café A2A thread, Landy message at 2026-05-25 21:45 PT.

**Goal:** Keep Redis as the live thread source while preserving markdown exports as local/offsite recovery artifacts outside the curated docs corpus.

**Acceptance Criteria:**
- Thread sidebar and thread selection continue to use Redis-backed `/api/threads`.
- `threads:export:redis`, `threads:sync`, and autosave default to `.cat-cafe/thread-exports/repo/`.
- `docs/discussions/exported-threads/` is ignored and treated as legacy generated output.
- CatCafeScanner does not index `exported-threads` under current or archived discussion trees.
- Existing offsite snapshots remain valid; local cleanup can move current dumps into `.cat-cafe/thread-exports/repo/`.

**Architecture cell:** `memory`

**Map delta:** none

**Map delta why:** This narrows generated artifact placement and scanner exclusions without adding a new store, router, queue, or ownership boundary.

**Design:** Redis remains the single source of truth for thread metadata and messages. Markdown exports are backup material only, written to ignored local state and then copied offsite. The evidence scanner keeps indexing curated `docs/discussions` files, but treats `exported-threads` directories as generated dumps and skips them everywhere.

## Implementation Steps

1. Add failing tests for the default export path and scanner exclusion.
2. Move script defaults from `docs/discussions/exported-threads` to `.cat-cafe/thread-exports/repo`.
3. Add `.gitignore` protection for legacy `docs/discussions/exported-threads/`.
4. Exclude `exported-threads` directories in `CatCafeScanner`.
5. Update the Redis data safety runbook.
6. Move the current untracked dump directory into `.cat-cafe/thread-exports/repo` after preserving backups.
