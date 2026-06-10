---
doc_kind: review-request
topics: [runtime, worktree-sync]
created: 2026-06-09
---

# Review Request: Runtime Sync Blocker Diagnostics

Review-Target-ID: runtime-sync-diagnostics
Branch: fix/runtime-sync-diagnostics

## What

Changed `scripts/runtime-worktree.sh` so an `origin/main` ff-only merge failure reports the actual untracked files that would be overwritten by incoming tracked files. The message now marks exact-byte matches as `same bytes as incoming` and removes the stale `.claude/skills` quick-fix suggestion.

Added regression tests in `packages/api/test/runtime-worktree-script.test.js` covering both an incoming tracked avatar colliding with an identical untracked local copy, and an incoming tracked file replacing a local untracked directory.

## Why

The observed runtime startup failure was caused by untracked avatar placeholders colliding with newly tracked incoming avatar files, but the script told the user to clean `.claude/skills/`. That diagnosis was wrong and sent the user to the wrong directory.

## Original Requirements

> 铲屎官让咱俩一起修一个 runtime 启动卡死的根因。
> 真凶根本不是 skills，是两张 untracked 占位图跟 origin/main 新提交撞名挡住 ff。
> hook 修复方向认不认？动态报真凶 OK，但"自动 trash 安全占位"会不会太激进？

- 来源：当前 thread A2A handoff，2026-06-09 06:35 UTC
- 请 reviewer 对照判断：启动脚本是否不再误导用户去清 `.claude/skills/`，且是否避免过度删除 runtime 本地文件。

## Tradeoff

I did not implement automatic trash/removal for identical blockers. Runtime worktree sync is a high-trust path; reporting exact blockers plus same-byte safety is enough for this fix and keeps deletion as an explicit human action.

## Architecture Ownership

Architecture cell: runtime-worktree script
Map delta: none
Why: This changes diagnostics in an existing launcher/sync script and does not introduce a new store, queue, router, adapter, dispatcher, or binding.

## Open Questions

### Technical OQ

1. Should the blocker detector compare with `origin/main` only, or should it use the fetched merge target ref if this script later supports non-main sync targets?
2. Is the `same bytes as incoming` wording strong enough, or should it print an exact `rm -- <path>` command? I intentionally avoided printing bulk `clean` commands.

### Value OQ

None.

## Next Action

Please review the shell diagnostic logic and regression test. Focus on quoting/path safety, `set -euo pipefail` behavior, and whether avoiding automatic trash is the right boundary for runtime sync.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/runtime-sync-diagnostics/opus48`
- Start Command: not needed; script/test-only review
- Ports: none

## Self-Check Evidence

### Spec Compliance

- Reports actual blocker path: covered by regression test.
- Removes stale `.claude/skills` advice: covered by regression test.
- Same-byte incoming copy gets a safety note: covered by regression test.
- Does not auto-delete runtime files: implementation only prints diagnostics.

### Test Results

```bash
node --test packages/api/test/runtime-worktree-script.test.js
# 18 passed, 0 failed

bash -n scripts/runtime-worktree.sh
# exit 0

pnpm check -- scripts/runtime-worktree.sh packages/api/test/runtime-worktree-script.test.js
# All 22 checks passed

git diff --check
# exit 0
```

### Related Files

- `scripts/runtime-worktree.sh`
- `packages/api/test/runtime-worktree-script.test.js`

[砚砚/GPT-5.5🐾]
