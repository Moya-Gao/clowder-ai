---
name: merge-gate
description: >
  合入 main 的完整流程：门禁检查 → PR → 云端 review → squash merge → 清理。
  Use when: reviewer 放行后准备合入、开 PR、触发云端 review、准备 merge。
  Not for: 开发中、review 未通过、自检未完成。
  Output: PR merged + worktree cleaned。
triggers:
  - "合入 main"
  - "merge"
  - "准备合入"
  - "开 PR"
  - "cloud review"
  - "gh pr create"
---

# Merge Gate

合入 main 的完整流程：门禁检查 → PR → 云端 review → squash merge → 清理。

## 核心知识

### 门禁 4 硬条件（全部满足才能开 PR）

1. Reviewer 有**明确放行信号**（"放行"/"LGTM"/"通过"/"可以合入"）
2. **所有 P1/P2** 已修复且经 reviewer 确认
3. Review 针对**当前分支/当前工作**（不是历史 review）
4. BACKLOG 涉及条目已在 feature branch 上标 `[x]`

### 合入方式（唯一正确做法）

```bash
# 1. Push feature branch
git push origin {branch}

# 2. 开 PR（读 refs/pr-template.md 获取 body 模板，用 HEREDOC 填写）
gh pr create --title "feat(xxx): ..." --body "$(cat <<'EOF'
... 按 refs/pr-template.md 模板填写 ...
EOF
)"

# 3. 注册 PR tracking（必做，Email Watcher / review 通知路由依赖）
# → 调用 MCP: cat_cafe_register_pr_tracking(repoFullName, prNumber, catId)

# 4. PR body 防呆检查（禁止任何 @句柄出现在 body）
PR_BODY="$(gh pr view {PR_NUMBER} --json body --jq '.body')" || \
  { echo "❌ 无法读取 PR body，停止流程"; exit 1; }
printf '%s\n' "$PR_BODY" | rg -q '@[A-Za-z0-9_-]+ review' && \
  { echo "❌ 不合规：云端 review 触发句柄只能写在 comment，不能写在 body"; exit 1; }
printf '%s\n' "$PR_BODY" | rg -q '@(codex|chatgpt-codex-connector|gpt52|opus|sonnet|gemini)\b' && \
  { echo "❌ 不合规：PR body 禁止出现任何 @句柄（含 HTML 注释中的签名）"; exit 1; }

# 5. 触发云端 review（在 PR comment 中，不是 body！）
HEAD_SHA="$(gh pr view {PR_NUMBER} --json headRefOid --jq '.headRefOid')" || \
  { echo "❌ 无法读取 PR head sha，停止流程"; exit 1; }
SHORT_SHA="${HEAD_SHA:0:8}"

# 5.1 去重防呆（同一 commit 只允许触发一次；新 commit 允许再次触发）
TRIGGER_URL="$(gh pr view {PR_NUMBER} --json comments | jq -r --arg sha "$SHORT_SHA" '
  .comments[]
  | select(.body | contains("Please review latest commit \($sha) for P1/P2 only."))
  | .url
' | head -n 1)"
[ -n "$TRIGGER_URL" ] && \
  { echo "❌ 已对 commit ${SHORT_SHA} 触发过 cloud review: ${TRIGGER_URL}"; exit 1; }

TRIGGER_COMMENT_BODY="$(cat <<EOF
{按 refs/pr-template.md 的“云端 Review 触发 Comment 模板”填写}
EOF
)"
gh pr comment {PR_NUMBER} --body "$TRIGGER_COMMENT_BODY"
# ⚠️ 完整模板见 refs/pr-template.md「云端 Review 触发 Comment 模板」

# 6. 等云端 review 通过（0 P1/P2）

# 7. Squash merge（GitHub 处理，禁止本地 squash！）
gh pr merge {PR_NUMBER} --squash --delete-branch

# 8. 更新本地 + 清理
git checkout main && git pull origin main
git worktree remove ../cat-cafe-{feature-name}
git branch -d {branch-name} && git worktree prune
```

### 云端 review 处理规则

| 结果 | 处理 |
|------|------|
| 0 P1/P2 | 通过，执行 Step 7 |
| P1/P2 有复现证据 | 在 feature branch 修 → push → **re-trigger review** → 等通过 |
| P1/P2 无复现证据 | 降级 P3，留 comment，视为通过 |
| 误报 | 留 comment 解释，视为通过 |

## Quick Reference

| 条件 | 检查方式 |
|------|---------|
| Reviewer 放行？ | 搜索明确信号词 |
| P1/P2 清零？ | 检查 review 记录 |
| BACKLOG 更新？ | `grep '\[x\]' docs/BACKLOG.md` |
| 云端通过？ | `gh pr checks {PR}` |

## Common Mistakes

| 错误 | 正确 |
|------|------|
| PR body 里写了云端 review 触发句柄 | 在 PR **comment** 里写（body 里写会触发代码修改权限而非 review） |
| PR body 或 HTML 注释里写了 `@句柄`（例如签名） | **PR body 禁止任何 @句柄**，签名改为纯文本（如 `codex` / `gpt52`） |
| 同一个 commit 连续发多条触发 comment | 先做 Step 5.1 去重检查；只有新 commit 才 re-trigger |
| 修了 P1 不 re-trigger review | 修完 push 后**必须重新触发**云端 review |
| 本地 `git rebase -i` 手动 squash | 用 `gh pr merge --squash`（GitHub 处理） |
| 本地 merge 后 `gh pr close` | `gh pr close` = 放弃，`gh pr merge` = 合入 |
| 不等云端 review 直接合入 | 必须等 0 P1/P2 |

### **⚠️⚠️ 反面案例（PR #160）— 必须记住**

**错误行为**：
- PR description 里签名写了 `(@句柄)`（在 HTML 注释里）
- 后续说明评论又写了 `@句柄`

**后果**：
- 触发了 `chatgpt-codex-connector` 的“Create an environment”自动回复
- 云端 review 没有实际执行，流程被噪声污染

**硬规则（加粗执行）**：
- **PR body（含 HTML 注释）禁止出现任何 `@句柄`**
- **只允许在专用触发 comment 里使用标准触发模板（见 refs/pr-template.md）**

## 和其他 skill 的区别

- `quality-gate`: 自检（在 review 之前）
- `request-review` / `receive-review`: review 循环（在 merge 之前）
- **本 skill**: review 通过后的合入全流程

## 下一步

合入后 → `feat-lifecycle`（完成验证 + 真相源同步）
