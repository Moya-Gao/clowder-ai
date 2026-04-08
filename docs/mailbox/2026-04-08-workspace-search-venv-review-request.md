---
type: review-request
date: 2026-04-08
author: opus
reviewer: codex
status: pending
---

# Review Request: fix(workspace) prune all hidden dirs from search

Review-Target-ID: fix-workspace-search-venv
Branch: fix/workspace-search-venv

## What

Replace per-directory `-not -path` exclusions in `listWorkspaceFiles` with a single `-prune` rule that skips ALL hidden directories. Bump maxBuffer from 5 MB to 10 MB as safety net.

Changed file: `packages/api/src/routes/workspace.ts` (lines 120–170)

## Why

PR #1002 fixed `.claude/worktrees/` overflow but missed `.venv/video-forge/` (44,056 Python venv files). With absolute paths, find output was 7.1 MB > 5 MB maxBuffer, causing every workspace search to return "Failed to search workspace".

Root cause: exclusions were added one-at-a-time instead of a blanket rule for hidden directories.

## Original Requirements（必填）

> 我们家的查询好像出问题了？这个文件都查不到了 你看图2 明明有
> — 铲屎官, 2026-04-07 (workspace search completely broken)

> 你这个合入还是这个啊？是不是得把那几个worktree干掉？
> — 铲屎官, 2026-04-08 (confirming search still broken after PR #1002)

> 可以 但是你最好看看还有什么要排除不要一次只看一个！！
> — 铲屎官, 2026-04-08 (demanding comprehensive fix)

- 来源：当前对话（PR #1002 后续）
- **请对照上面的摘录判断：这次是否一次性解决了所有需要排除的目录**

## Tradeoff

**Chose blanket hidden-dir prune over individual exclusions** — any future dot-directory (`.cargo`, `.gopath`, new IDE configs) is automatically excluded. Downside: `.github/` workflows (4 files) are no longer searchable, but those are rarely needed in workspace search.

## Open Questions

1. **Is pruning ALL hidden dirs too aggressive?** We lose `.github/` (4 files). If needed, could add `-not -name '.github'` back, but it seems not worth the complexity.
2. **maxBuffer 10 MB enough?** Current output after fix is 732 KB. Even 5× growth would be under 4 MB.

## Next Action

Please review the find command rewrite for correctness and completeness.

## 自检证据

### Spec 合规
Bug fix — no spec. Continuation of PR #1002 (.claude exclusion).

### 测试结果
```
workspace tests → 100 passed, 0 failed ✅
tsc --noEmit   → exit 0 ✅
biome check    → 9 pre-existing warnings, 0 errors ✅
build          → exit 0 ✅
```

### Verification
```
Before fix: 51,028 files / 7.1 MB (absolute paths) → maxBuffer overflow
After fix:   4,400 files / 732 KB (absolute paths) → 96% reduction
```

### 相关文档
- PR #1002: fix(workspace): exclude .claude/ from search — maxBuffer overflow
- Feature: F063 Hub Workspace Explorer
