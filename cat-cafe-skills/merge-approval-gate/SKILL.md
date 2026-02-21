---
name: merge-approval-gate
description: Blocks code merge to main without explicit reviewer approval. Use when preparing to merge, rebase into main, or claiming code is ready to ship. Triggers on "合入 main", "merge to main", "准备合入", "可以合了", "ready to merge".
---

> **SOP 位置**: 本 skill 是 `docs/SOP.md` Step 4 的执行细节。
> **上一步**: `cat-cafe-receiving-review` (Step 3b) | **下一步**: `requesting-cloud-review` (Step 5) → 合入 + 清理 (Step 6)

# Merge Approval Gate

**Core principle:** 没有缅因猫明确放行，不能合入 main。修完 review 问题后自己判断"改对了"直接合入 = 流程违规。

## 硬性要求（必须全部满足）

### 1. 必须有 Reviewer 明确放行

合入前检查 `docs/mailbox/` 中最近的 review 信：

```
✅ 有效的放行信号：
- "可以放行了"
- "LGTM"
- "通过"
- "可以合入"
- "放行 ✅"

❌ 无效的放行信号：
- "只剩下小问题" (仍有 P2 待修)
- "整体 OK，注意 XXX" (条件放行需要确认)
- 没有明确的放行语句
```

### 2. 必须所有 P1/P2 已修复并确认

检查项：
- 所有 P1 (Critical) 必须修复
- 所有 P2 (Important) 必须修复
- 修复后必须回复 reviewer 确认
- Reviewer 确认修复正确后才能合入

**关键教训**：修完 reviewer 提的问题后，必须回给 reviewer 确认，不能自己判断"改对了"直接合入。

### 3. 必须是当前分支的 Review

确认 review 是针对当前分支/当前工作的，不是历史遗留的 review 信。

### 4. BACKLOG 涉及条目已更新

本次工作关联的 BACKLOG 条目（bug fix / feature / 技术债务），必须**在 feature branch 上**更新 `docs/BACKLOG.md`：

- 将对应条目标记 `[x]`，附合入的关键 commit hash
- 将已完成条目复制到底部「已完成项（归档）」section
- 作为同一轮 commit/review 的一部分提交

若本次工作无关联 BACKLOG 条目，显式标注 `N/A`（避免"忘了检查"和"检查过没有"歧义）。

**为什么不在 merge 后补提**：在 main 上直接补 BACKLOG 更新会与 SOP 的例外路径规则冲突（跳过 PR 需显式授权或 ≤5 行极微改动）。在 feature branch 完成则自然纳入 review 流程，零灰区。

## 检查流程

```
BEFORE 准备合入 main:

1. FIND: 最近的 review 信在 docs/mailbox/
2. READ: 检查 review 状态
3. VERIFY:
   - 有明确放行语句？
   - 所有 P1/P2 已标记修复？
   - Reviewer 确认修复正确？
   - BACKLOG 涉及条目已在 feature branch 上更新？
4. DECIDE:
   - 全部通过 → 可以合入
   - 任一不通过 → BLOCK
```

## Block 场景

### ❌ 场景 1：没有放行确认

```
布偶猫：我修完了所有 review 问题，准备合入 main

⚠️ BLOCKED — 未找到缅因猫的放行确认

最近的 review: docs/mailbox/2026-02-10-xxx-review.md
状态: 提出了 3P1 + 1P2，但未找到后续放行信

必须等待缅因猫明确确认后才能合入。

下一步：
1. 检查是否有 follow-up review 信
2. 如果没有，等待缅因猫确认
3. 收到 "可以放行" 后再执行合入
```

### ❌ 场景 2：自己判断修复正确

```
布偶猫：review 问题我都修了，应该没问题，合入吧

⚠️ BLOCKED — 修复后未回给 reviewer 确认

这正是 F11 踩的坑：
- 修完 3P1+1P2 后自己判断"改对了"直接合 main
- 被铲屎官批评

正确流程：
1. 修复 → 回给 reviewer 确认
2. Reviewer 放行 → 合入

请先回给缅因猫确认修复。
```

### ❌ 场景 3：条件放行未二次确认

```
Review 信中写的是 "整体 OK，但 XXX 需要改一下"

⚠️ BLOCKED — 条件放行需要二次确认

这是条件放行，不是无条件放行。
需要修完 XXX 后再次确认才能合入。
```

## 通过场景

### ✅ 场景：完整的 review 闭环

```
布偶猫：缅因猫刚刚确认了，说可以放行

✅ 检查通过

Review: docs/mailbox/2026-02-10-xxx-r3-final.md
Reviewer: 缅因猫
放行信号: "可以放行了 ✅"
P1/P2 状态: 全部已修复并确认

可以执行合入流程。

后续步骤（按 SOP Step 5 → 6 顺序执行）：
1. 收敛 commit：git rebase -i --autosquash origin/main
2. 开 PR + 云端 review → 使用 `requesting-cloud-review` skill（SOP Step 5）
   （例外：铲屎官明确同意跳过时可不开 PR，标准见 SOP.md 例外路径）
3. 合入 main：git checkout main && git merge --ff-only {branch}
4. push main + 清理 worktree（SOP Step 6）
```

## 常见错误

| 错误 | 原因 | 正确做法 |
|------|------|----------|
| 修完直接合入 | 自己判断"改对了" | 回给 reviewer 确认 |
| 看到"整体OK"就合入 | 忽略条件/遗留项 | 确认所有条件满足 |
| 用历史 review 放行 | 混淆不同工作的 review | 确认是当前工作的 review |
| 只修 P1 不修 P2 | 觉得 P2 是小问题 | P1 和 P2 都必须修 |

## Gate 通过后必须做（按顺序）

### Step A: 开 PR + 触发云端 Review（SOP Step 5，默认必须）

Gate 通过后，**先使用 `requesting-cloud-review` skill** push feature branch、开 PR 并触发云端 Codex review。

**例外规则**：跳过 PR 需同时满足三条件，详见 `docs/SOP.md` "例外路径"。

### Step B: 等待云端 Review 通过（SOP Step 5e）

PR 创建 + 触发云端 review 后，**必须等待云端 review 通过（0 P1/P2）才能合入**。
- 有 P1/P2（附复现证据）→ 在 feature branch 上修复 → push → 等 re-review
- 有 P1/P2（无复现证据）→ 降级 P3，留 comment 说明，视为通过

### Step C: 合入 main + 清理（SOP Step 6）

**云端 review 通过后**执行：

```bash
# 1. 合入 main
git checkout main && git merge --ff-only {branch}

# 2. Push main（⚠️ 必须在清理 worktree 之前！）
git push origin main

# 3. 清理 worktree + 远程分支
git worktree remove ../cat-cafe-{feature-name}
git branch -d {branch-name}
git push origin --delete {branch}
git worktree prune
```

**PR 自动关闭**: `--ff-only` merge 保持 commit hash 不变，push main 后 PR 自动标记为 merged。

## 相关规则

- `requesting-cloud-review` — 开 PR + 触发云端 Codex review（SOP Step 5，在合入前执行）
- `finishing-a-development-branch` — 开发分支收尾选项
- CLAUDE.md 第 9 条：Worktree 使用与清理
- docs/mailbox/：review 信存放位置
