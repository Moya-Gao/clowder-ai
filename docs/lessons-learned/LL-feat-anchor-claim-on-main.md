---
date: 2026-06-21
type: lesson-learned
slug: feat-anchor-claim-on-main
trigger: F247 (originally F238) 撞号 — main 上 F238 已被另一只猫开
related_features: [F247]
authors: [opus-47]
---

# LL: 开 F 号必须立刻 claim 到 main（防 worktree 之间撞号）

## 触发事件

2026-06-21 — 47 在 worktree branch `worktree-cloud-pro-yanyan-research` 上开 F238 cloud-cat-family。开号时只 grep 了 worktree 上的 F238，认为空就用。结果 main 上**同时**有另一只猫开的 `F238-bidirectional-boundary-symmetry.md`，导致撞号。

## 错在哪

- Worktree branch 上 grep `F2xx` 只反映 worktree 状态，**不反映 main**
- 平行 worktrees 之间 F 号互不可见（直到 merge）
- 我 commit + push F238 doc 到 worktree branch (`worktree-cloud-pro-yanyan-research`)，但**没立刻 PR/merge 到 main**，所以别的猫不知道 F238 被 47 用了
- 结果：两只猫平行开 F238 → 撞号 → 47 必须 rename

## 教训（next time）

**开新 F 号必须立刻在 main 上 claim**：

1. **必查 main**：开号前 `ls /Users/lysander/projects/relay-station/cat-cafe/docs/features/`（main 路径不是 worktree），找下一个真空号
2. **立刻 push stub 到 main**：开号后**第一件事**就是在 main 上建一个最小 stub（`docs/features/Fxxx-<slug>.md` 含 `status: claimed-by-<猫>` + 一句 "立项 in progress in worktree-xxx"），commit + push 到 main
3. **再去 worktree 写正式 spec**：main 已 claim，worktree 上做详细 spec 时其他猫看到 main 上 stub 就知道这号被占
4. **不能只 commit worktree branch**：worktree branch 对其他猫**不可见**直到 merge，等于没 claim

## 不要踩的反模式

- ❌ 只在 worktree branch 上 commit F 号 doc，没 push 到 main
- ❌ grep worktree 文件夹判断空号（worktree 看不到平行 branch 的占用）
- ❌ "等 spec 写完一起合 main"——这期间别的猫可能抢号

## 关联

- F247（撞号事件主角）
- `feedback_feat_anchor_needs_cvo_explicit_signoff`（开 F 号需 CVO signoff —— 但 signoff 之后必须 claim on main 防撞）

[宪宪/Opus-4.7🐾]
