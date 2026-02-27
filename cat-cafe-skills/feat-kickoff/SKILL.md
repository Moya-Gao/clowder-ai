---
name: feat-kickoff
description: "创建新 Feature 时使用。触发词：新功能、new feat、开个 feature、F0xx、立项。在讨论收敛后决定立项时触发，而非完成后补录。"
---

# Feat Kickoff — 新 Feature 立项

## Overview

**在 Feature 开始时就建立聚合文件，而非完成后补录。**

4.6 观点："如果只在完成时才补聚合文件，信息已经散落了。应该一开始就建。"

这个 skill 确保每个新 Feature 从诞生之初就有：
- 唯一 ID（`F041`、`F042`...）
- 聚合文件（`docs/features/Fxxx-name.md`）
- BACKLOG 索引条目
- 相关文档的正向链接

## When to Use

- 铲屎官说"开个新功能"、"new feature"、"做个 Fxxx"、"立项"
- 讨论收敛后确认要做一个新 Feature
- brainstorming 结束后决定立项
- 从 Tech Debt 升级为 Feature（如 TD101 → F041）

**When NOT to use:**
- 小修补、文档同步、重构 → 记为 Tech Debt，不是 Feature
- 还在探索阶段，不确定是否要做 → 先用 `brainstorming` skill
- 只是记录一个想法 → 先写 research/discussion，确认要做再立项

## Feature vs Tech Debt 判断标准

| 类型 | 特征 | 示例 |
|------|------|------|
| **Feature** | 新功能、新能力、用户可感知的变化 | 能力看板、Session Chain 可配置化 |
| **Tech Debt** | 重构、补文档、修已有功能的边角 | SessionBootstrap 同步、文档参数修正 |

**判断口诀**：
- "铲屎官/用户能感知吗？" → Feature
- "只有开发者知道变了？" → Tech Debt
- 不确定 → 先记 Tech Debt，确认后再升级

## 立项流程（5 步）

### Step 1: 确定 Feature ID

```bash
# 查看当前最大 ID
grep -E "^\| F[0-9]+" docs/BACKLOG.md | tail -1
```

新 ID = 最大 ID + 1，三位数固定宽度：`F040` → `F041`

**命名**：`Fxxx-kebab-case-name.md`
- 用小写连字符
- 简短但能表达核心
- 例：`F041-capability-dashboard.md`

### Step 2: 创建聚合文件

路径：`docs/features/Fxxx-name.md`

**Frontmatter（必须）**：

```yaml
---
feature_ids: [F041]
topics: [capability, dashboard]
doc_kind: note
created: 2026-02-26
---
```

**模板结构**：

```markdown
# Fxxx: 名称

> **Status**: idea | spec | in-progress | review | done
> **Owner**: 布偶猫 | 缅因猫 | 暹罗猫
> **Created**: YYYY-MM-DD
> **Priority**: P0-P3

---

## Why
一句话：为什么要做（铲屎官痛点）

## What
一句话：做什么（交付物）

## Acceptance Criteria
- [ ] 验收条件 1
- [ ] 验收条件 2

## Links
| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | [链接](../discussions/...) | 决策来源 |
| **Research** | [链接](../research/...) | 调研证据 |
| **Plan** | （待创建） | 实现计划 |

## Key Decisions
为什么这样设计？放弃了什么？

## Risk / Blast Radius
- 影响范围：...
- 回滚方案：...

## Dependencies
- **Blocked by**: Fxxx（如有）
- **Blocks**: Fxxx（如有）
- **Evolved from**: Fxxx（如果是演进）

## Open Questions
1. 待决问题 1
2. 待决问题 2

## Review Gate
| 轮次 | Reviewer | 结果 | 日期 |
|------|----------|------|------|
| — | — | — | — |

## Test Evidence
（待开发）

## Timeline
- YYYY-MM-DD: Spec written
```

### Step 3: 更新 BACKLOG 索引

在 `docs/BACKLOG.md` 表格末尾添加：

```markdown
| F041 | 能力看板 — Hub MCP/Skills 统一管理 | spec | 布偶猫 | [F041](features/F041-capability-dashboard.md) |
```

**Status 枚举**：`idea` | `spec` | `in-progress` | `review` | `done`

### Step 4: 关联已有文档（正向链接）

**关键！** 找出所有与此 Feature 相关的已有文档（research、discussion 等），在聚合文件的 `## Links` 中列出。

同时，更新这些文档的 frontmatter：

```yaml
# 原来
feature_ids: []

# 改为
feature_ids: [F041]
```

**搜索相关文档**：
```bash
# 搜索可能相关的文档
grep -r "能力看板\|capability\|MCP 管理" docs/research docs/discussions --include="*.md" -l
```

### Step 5: Commit

```bash
git add docs/features/F041-*.md docs/BACKLOG.md
git commit -m "docs(F041): kickoff 能力看板 feature [布偶猫🐾]

What: 创建 F041 聚合文件 + BACKLOG 索引
Why: 新 Feature 立项，建立追溯链入口
"
```

## 检查清单（每次必过）

- [ ] `docs/features/Fxxx-name.md` 已创建
- [ ] Frontmatter 包含 `feature_ids` + `topics` + `doc_kind` + `created`
- [ ] `docs/BACKLOG.md` 已添加索引行
- [ ] 相关的 research/discussion 已在 Links 中列出
- [ ] 相关文档的 `feature_ids` 已更新
- [ ] 已 commit

## 从 Tech Debt 升级

如果一个 TD 条目实际是 Feature：

1. 创建新的 Feature 聚合文件（上述流程）
2. 在 `docs/TECH-DEBT.md` 原条目留重定向：
   ```
   | TD101 | ~~能力看板~~ → **已升级为 [F041](features/F041-capability-dashboard.md)** | — | — | 详见 F041。|
   ```
3. 不删除原 TD 条目（保留追溯）

## 后续开发中

Feature 开发过程中，持续更新聚合文件：

| 事件 | 更新内容 |
|------|----------|
| 新的 plan/discussion 产生 | 添加到 Links |
| 状态变化 | 更新 Status + Timeline |
| Review 通过 | 更新 Review Gate 表格 |
| 完成 | Status → done，从 BACKLOG 移除（聚合文件永久保留） |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| 完成后才补聚合文件 | 立项时就建，不是完成后 |
| 不更新相关文档的 `feature_ids` | 双向链接：聚合文件 Links + 源文档 frontmatter |
| 忘了在 BACKLOG 加索引 | 检查清单第三项 |
| Status 只写了一个词就不管了 | 开发中持续更新 Status + Timeline |
| Tech Debt 误记为 Feature（或反之） | 用判断标准：铲屎官能感知吗？ |
| 文件名用 camelCase 或下划线 | 统一用 kebab-case |

## 与其他 Skill 的关系

| Skill | 关系 |
|-------|------|
| `brainstorming` | **前置** — 探索阶段用 brainstorming，确认要做再用本 skill 立项 |
| `discussion-convergence` | **后置** — 讨论收敛时检查是否需要立项，需要则触发本 skill |
| `writing-plans` | **后置** — 立项后用 writing-plans 写实现计划 |
| `spec-compliance-check` | **后置** — 开发完用 spec-compliance-check 验收 |

## 追溯链架构

```
docs/BACKLOG.md（热层 — 活跃 Feature 索引）
    └→ docs/features/Fxxx.md（温层 — 聚合文件，单一入口）
        ├→ docs/discussions/（冷层 — 决策来源）
        ├→ docs/research/（冷层 — 调研证据）
        ├→ docs/plans/（冷层 — 实现计划）
        └→ docs/mailbox/（冷层 — review 记录）
```

**原则**：顺藤摸瓜。从 BACKLOG 一步到聚合文件，聚合文件有所有冷层链接。

---

*教训来源：2026-02-26 BACKLOG 整理讨论。原有机制导致"F21 有 85 个散落文件，没有统一入口"的蜘蛛网问题。*
