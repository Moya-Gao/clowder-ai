---
name: merge-approval-gate
description: Blocks code merge to main without explicit reviewer approval. Use when preparing to merge, rebase into main, or claiming code is ready to ship. Triggers on "合入 main", "merge to main", "准备合入", "可以合了", "ready to merge".
---

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

## 检查流程

```
BEFORE 准备合入 main:

1. FIND: 最近的 review 信在 docs/mailbox/
2. READ: 检查 review 状态
3. VERIFY:
   - 有明确放行语句？
   - 所有 P1/P2 已标记修复？
   - Reviewer 确认修复正确？
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

合入步骤：
1. git fetch origin && git rebase origin/main
2. 解决冲突（如有）
3. git checkout main && git merge --ff-only {branch}
4. git push origin main
5. 清理 worktree
6. 开 PR + 云端 review → 使用 `requesting-cloud-review` skill
   （例外：铲屎官明确同意跳过的小优化可以不开 PR）
```

## 常见错误

| 错误 | 原因 | 正确做法 |
|------|------|----------|
| 修完直接合入 | 自己判断"改对了" | 回给 reviewer 确认 |
| 看到"整体OK"就合入 | 忽略条件/遗留项 | 确认所有条件满足 |
| 用历史 review 放行 | 混淆不同工作的 review | 确认是当前工作的 review |
| 只修 P1 不修 P2 | 觉得 P2 是小问题 | P1 和 P2 都必须修 |

## 合入后必须做

### Step A: 立即清理 worktree

```bash
# 1. 删除 worktree
git worktree remove ../cat-cafe-{feature-name}

# 2. 删除已合入分支
git branch -d {branch-name}

# 3. 清理悬空引用
git worktree prune
```

### Step B: 开 PR + 云端 Review（默认必须）

清理完 worktree 后，**必须接着使用 `requesting-cloud-review` skill** 开 PR 并触发云端 Codex review。

**例外规则**：以下情况可以跳过 PR，但**必须铲屎官在当前对话中明确同意**：
- 纯文档修改（docs、comments、README）
- 2-3 行的小优化/小修复
- 铲屎官明确说"不需要提 PR"或"直接合就行"

**判断标准**：如果不确定是否需要开 PR，默认开 PR。宁可多一层守护，不可少一层。

## 相关规则

- `requesting-cloud-review` — 合入后开 PR + 触发云端 Codex review
- `finishing-a-development-branch` — 开发分支收尾选项
- CLAUDE.md 第 9 条：Worktree 使用与清理
- docs/mailbox/：review 信存放位置
