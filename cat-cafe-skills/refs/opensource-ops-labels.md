# 场景 E: Label & 归档管理

> 返回 → [opensource-ops SKILL.md](../opensource-ops/SKILL.md)

## 触发条件

- 需要整理标签体系
- 新标签需要创建
- Issue 需要归档/收口

## 标签真相源表

### GitHub 实际标签（可以直接打在 issue/PR 上）

这些是 clowder-ai 仓库里**真实存在的** GitHub labels：

| Label | 含义 | 打在 |
|-------|------|------|
| `bug` | 确认的 bug | Issue / PR |
| `enhancement` | 新功能请求或改进 | Issue |
| `duplicate` | 和已有 issue 重复 | Issue（关闭前打） |
| `feature:Fxxx` | 关联到具体 Feature（如 `feature:F113`） | Issue / PR |
| `help wanted` | 欢迎社区认领 | Issue |
| `good first issue` | 适合新手 | Issue |
| `question` | 纯咨询（非 bug/feature），回复后可关 | Issue |
| `needs-info` | 等报告者补充信息（保持 open） | Issue |
| `invalid` | 不是有效的 bug/feature 请求 | Issue |
| `wontfix` | 确认不会修/做 | Issue |

### 流程状态标签（与类型标签分开）

| Label | 含义 | 谁打 |
|-------|------|------|
| `triaged` | 猫已读 + 已回 + 已初判 | 猫猫 triage 完打 |
| `needs-maintainer-decision` | 已 triage 但需铲屎官拍板方向/边界 | 猫猫升级时打 |

**关键原则**：
- `triaged` 解决"我们处理过没有"
- `bug` / `enhancement` / ... 解决"它是什么"
- 两者分开打，不混用
- 类型不确定时可以打 `triaged` + `needs-info`，不要急着打类型标签
- `question` = 纯咨询（回复后可关），`needs-info` = 等补充信息（保持 open）

**过滤用法**：
- `-label:triaged` = 还没被我们碰过
- `label:needs-maintainer-decision` = 卡在等铲屎官拍板
- `label:triaged -label:needs-maintainer-decision -label:needs-info` = 基本处理完，不在等任何人

**创建流程状态标签：**

```bash
gh label create "triaged" --repo zts212653/clowder-ai \
  --description "已读、已回、已初判" --color "c5def5"
gh label create "needs-maintainer-decision" --repo zts212653/clowder-ai \
  --description "已 triage，需 maintainer 拍板方向" --color "d876e3"
gh label create "needs-info" --repo zts212653/clowder-ai \
  --description "等报告者补充信息（保持 open）" --color "fbca04"
```

**查看当前标签：**

```bash
gh label list --repo zts212653/clowder-ai
```

**创建缺失标签：**

```bash
# 创建 feature 标签（按需）
gh label create "feature:F{xxx}" --repo zts212653/clowder-ai \
  --description "Related to F{xxx}: {Feature Name}" --color "0E8A16"
```

### 概念分类（非 GitHub label，不要当标签打！）

这些是 **intake 决策类别**，记录在 `intake-from-opensource.sh` 和 ledger 中，**不是** GitHub label：

| 分类 | 含义 | 用在 |
|------|------|------|
| `safe-cherry-pick` | 文件无 outbound transform，可直接吸收 | intake plan 输出 |
| `manual-port` | 文件有 outbound transform，需手工对照 | intake plan 输出 |
| `public-only` | 只在开源仓有意义，不回流 | intake decision |
| `absorbed` | 已回流到 cat-cafe | intake decision |
| `rejected` | 开源仓已 merge 但明确不吸收 | intake decision |

**这些不是 GitHub label，不要在 GitHub 上创建或打标签。** 它们只存在于 intake 脚本和 ledger 中。

## 双仓标签归属

| 操作 | 在哪做 |
|------|--------|
| 给 issue 打 `bug` / `enhancement` / `duplicate` | `[clowder-ai]` |
| 给 issue/PR 打 `feature:Fxxx` | `[clowder-ai]` |
| 在 BACKLOG 加 Feature 条目 | `[cat-cafe]` |
| 在 feature doc 加 `community_issue` 字段 | `[cat-cafe]` |
| intake 决策记录 | `[cat-cafe]` ledger |

## 互链评论模板

见 [Issue Triage 文档](./opensource-ops-issue-triage.md) Step 4-5 的模板。

## 归档规则

| 情况 | 操作 |
|------|------|
| Issue 被另一个 issue 覆盖 | 打 `duplicate` → 发关单评论（ref 保留单号）→ 关闭 |
| Issue 对应的 PR 已 merge | 由 GitHub 自动关闭（PR body 写 `Fixes #N`——同仓 auto-close 语法，裸 `#N` 仅限 PR body） |
| Issue 长期无活动（> 30 天） | 评论询问是否仍需要 → 再 14 天无回应 → 关闭 |
| Issue 不可行 / 超出范围 | 评论说明理由 → 关闭 |
