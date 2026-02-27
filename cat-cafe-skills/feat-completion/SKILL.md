---
name: feat-completion
description: "Feature 完成时使用。触发词：feature 完成、F0xx done、完成了、可以关闭、验收通过。确保真相源同步、演化关系记录、BACKLOG 更新。"
---

# Feat Completion — Feature 收尾

## Overview

**Feature 完成时的收尾检查，确保真相源同步、演化关系记录完整。**

与 `feat-kickoff` 对应：
- `feat-kickoff`：开始时建立追溯链入口
- `feat-completion`：完成时闭环，更新状态 + 记录演化关系

这个 skill 确保每个完成的 Feature：
- Acceptance Criteria 全部打勾
- 聚合文件 Status=done + Completed 日期
- 演化关系已记录（从哪来、往哪去）
- 从 BACKLOG 移除（聚合文件永久保留）
- 关联文档 frontmatter 正确

## When to Use

- 铲屎官说"这个 Feature 完成了"、"F0xx done"、"可以收尾了"
- 所有 Acceptance Criteria 都打勾了
- PR 合入且云端 review 通过
- 功能已上线且验收通过

**When NOT to use:**
- 只是 Phase 完成，Feature 还有后续 Phase → 更新 Timeline 即可
- 只是一轮 review 通过 → 更新 Review Gate 即可
- 临时暂停 → 保持 Status=in-progress，加说明

## 完成流程（6 步）

### Step 1: 检查 Acceptance Criteria

```bash
# 查看聚合文件
cat docs/features/Fxxx-name.md | grep -A 10 "## Acceptance Criteria"
```

**检查项**：
- [ ] 所有 `- [ ]` 都变成 `- [x]` 了吗？
- [ ] 如果有未完成项，是否真的不影响 "done" 判定？

**如果有未完成项**：
- 向铲屎官确认："还有 N 项未完成，确认要标记 done 吗？"
- 选项 A：完成剩余项再收尾
- 选项 B：把未完成项转为后续 Tech Debt / 新 Feature
- 选项 C：确认这些项不再需要，直接删除

### Step 2: 更新聚合文件

编辑 `docs/features/Fxxx-name.md`：

```yaml
# 更新 Status
> **Status**: done                    # ← 改为 done

# 添加 Completed 日期
> **Completed**: 2026-02-27           # ← 新增这一行
```

**Timeline 章节**添加收尾记录：
```markdown
- 2026-02-27: Feature completed, PR #XX merged
```

### Step 3: 记录演化关系

**这是 feat-completion 的核心差异化价值！**

#### 3a. 检查"从哪来"

查看 `Dependencies` 章节的 `Evolved from` 字段：

```markdown
## Dependencies
- **Evolved from**: F024 (Session Blindness)  # 这个 Feature 是从 F024 演化来的
```

**如果为空**，问自己：
- 这个 Feature 是独立的新功能吗？
- 还是从某个已完成 Feature 演化出来的？

**参考演化图**（在 F40 文档中）：
- 语音栈：F020 → F022 → F010 → F034
- 记忆栈：F024 → F025 → F040
- Agent 架构栈：F032 → F033 → F037 → F038 → F041
- 信息源栈：F021 → F039
- 会话基建栈：F014 → F015 → F036

#### 3b. 规划"往哪去"

问铲屎官或自己：
- 这个 Feature 完成后，是否会自然演化出下一个 Feature？
- 如果是，是否需要现在立项？

**如果有明确的后续 Feature**：
- 触发 `feat-kickoff` 立项
- 在新 Feature 的 `Evolved from` 填写当前 Feature

**如果没有或不确定**：
- 不需要做什么
- 演化关系可以在后续立项时回填

### Step 4: 更新 BACKLOG

从 `docs/BACKLOG.md` **移除**该 Feature 的行：

```bash
# 先确认当前状态
grep "F041" docs/BACKLOG.md

# 编辑移除（使用 Edit 工具）
```

**注意**：
- 只从 BACKLOG（热层）移除
- 聚合文件（温层）**永久保留**，不删除
- `docs/features/README.md` 会列出所有 Feature（含 done）

### Step 5: 真相源同步检查

检查所有关联文档的 frontmatter 是否正确：

```bash
# 搜索关联文档
grep -r "F041" docs/ --include="*.md" -l
```

**每个关联文档检查**：
- [ ] `feature_ids: [F041]` 包含此 Feature
- [ ] `doc_kind` 正确（plan/discussion/research/bug-report）
- [ ] `created` 日期正确

**聚合文件 Links 章节检查**：
- [ ] 所有关联的 plan/discussion/research 都列出了
- [ ] 没有遗漏的重要文档

### Step 6: Commit

```bash
git add docs/features/Fxxx-name.md docs/BACKLOG.md
git commit -m "docs(Fxxx): mark feature as done [布偶猫🐾]

What: F041 能力看板完成
Why: 所有 Acceptance Criteria 通过，PR #XX 合入
Evolved from: F032 (Agent Plugin Architecture)
"
```

## 检查清单（每次必过）

- [ ] Acceptance Criteria 全部 `[x]` 或已处理未完成项
- [ ] 聚合文件 `Status: done` + `Completed: YYYY-MM-DD`
- [ ] `Dependencies.Evolved from` 已填写（如适用）
- [ ] 演化关系已考虑（往哪去？是否需要立项后续 Feature？）
- [ ] `docs/BACKLOG.md` 已移除该行
- [ ] 聚合文件 `Links` 章节完整
- [ ] 关联文档 `feature_ids` 正确
- [ ] `Timeline` 章节有收尾记录
- [ ] 已 commit

## 演化关系维护原则

### 演化 vs 依赖

| 类型 | 含义 | 示例 |
|------|------|------|
| **Evolved from** | 功能演进，A 做完后自然产生 B 的需求 | F024 (Session Blindness) → F025 (Session Chain) |
| **Blocked by** | 硬依赖，B 必须等 A 完成才能开始 | F010 (Mobile) blocked by F020 (TTS) |
| **Related** | 松耦合，有关联但不阻塞 | F032 (Plugin Arch) related to F033 (Strategy Config) |

### 何时记录演化关系

| 时机 | 做什么 |
|------|--------|
| **kickoff 时** | 如果知道从哪个 Feature 演化来的，填 `Evolved from` |
| **completion 时** | 确认 `Evolved from` 正确；考虑是否要立项后续 Feature |
| **回溯时** | 发现漏填的演化关系，补充到聚合文件 |

### 演化图在哪里

- **主图**：`docs/features/F40-backlog-reorganization.md` 的 "Feature 演化图" 章节
- **逐个**：每个聚合文件的 `Dependencies.Evolved from` 字段
- **不需要单独的 graph.md 文件**（4.6 建议：用分布式记录，不做中心化图）

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| 忘了更新 BACKLOG | 检查清单第 5 项 |
| Acceptance Criteria 有未完成项就标 done | Step 1 要先确认或处理 |
| 不记录演化关系 | Step 3 是核心，必须思考 |
| 删了聚合文件 | 聚合文件永久保留！只从 BACKLOG 移除 |
| 关联文档 frontmatter 没更新 | Step 5 真相源同步检查 |
| 收尾后发现要加东西 | 可以 re-open Feature 或新开 TD |

## 与其他 Skill 的关系

| Skill | 关系 |
|-------|------|
| `feat-kickoff` | **对偶** — kickoff 建追溯链，completion 闭环 |
| `spec-compliance-check` | **前置** — 完成前先用 spec-compliance-check 验收 |
| `merge-approval-gate` | **前置** — PR 合入是 completion 的前提条件之一 |
| `discussion-convergence` | **关联** — 收敛后如果决定关闭 Feature，触发本 skill |

## Re-open Feature

如果已标记 done 的 Feature 需要重新打开：

1. 编辑聚合文件：`Status: done` → `Status: in-progress`
2. 移除 `Completed:` 行
3. 在 `docs/BACKLOG.md` 重新添加索引行
4. Timeline 添加："YYYY-MM-DD: Re-opened due to ..."

**什么情况下 re-open**：
- 发现重大遗漏（如 F21++ 未完成）
- 铲屎官要求扩展范围
- 发现严重 bug 需要大改

**什么情况下开新 Feature/TD**：
- 小 bug 修复 → TD
- 新需求虽然相关但是独立功能 → 新 Feature

---

*教训来源：2026-02-26 F021 错误标 done（F21++ 未完成）。演化关系记录来自铲屎官 Mermaid 图。*
