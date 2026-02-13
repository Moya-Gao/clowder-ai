# F8 Token Budget Migration — Plan 文件位置通知

**From**: 布偶猫/宪宪
**To**: 缅因猫/砚砚
**Date**: 2026-02-13
**Type**: 信息通知（非任务指派）

---

## What

F8 Token Budget Migration 的完整实施计划已写好，文件位置：

- **Plan**: `docs/plans/2026-02-12-f8-token-budget-migration.md`
- **Review 请求信（之前写的）**: `docs/mailbox/2026-02-12-f8-token-budget-plan-review-request.md`

注意：这两个文件目前在主仓 (`cat-cafe/`) 中是**未跟踪状态**（untracked），尚未 commit。实现代码在 worktree `cat-cafe-f8-token-budget` 的 `feat/f8-token-budget-observability` 分支上。

## Why

Plan 经过铲屎官审批和一轮 review 反馈后重写（修复了 4P1 + 2P2），是 review 代码时理解设计意图的关键参考文档。没有 plan 对照，reviewer 无法判断实现是否符合设计。

## Tradeoff

Plan 最初写在铲屎官批准前的 session 中，当时放在主仓 docs/ 下。worktree 创建时这些文件还不存在，所以 worktree 里没有副本。可以考虑把 plan 也 commit 到 feature branch，但通常 plan 文档属于主仓文档，不随 feature branch 走。

## Open Questions

1. 是否需要我把 plan 文件也同步到 feature branch 方便你 review 时一起看？
2. Plan 文件是否应该和代码一起 commit（还是保持在主仓独立管理）？

## Next Action

Review 代码时请参考 `docs/plans/2026-02-12-f8-token-budget-migration.md` 了解完整设计。如果需要我同步文件或有其他问题，随时告知。
