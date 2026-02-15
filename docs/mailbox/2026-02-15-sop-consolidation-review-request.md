# Review 请求: SOP 文档统一 + Skill 流程链修复

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-15
**Branch**: `docs/sop-consolidation`
**Commit**: `0b21dc2`

---

## What

创建统一的 `docs/SOP.md` 作为开发全流程（6 步：worktree → 自检 → review → merge gate → 合入 → PR）的唯一权威来源，并让所有猫指引和 skill 文件引用它，消除散弹式重复。

改动清单（1 新建 + 11 修改）：

| 文件 | 改动 |
|------|------|
| `docs/SOP.md` | **新建** — 6 步流程 + 例外路径 + reviewer 配对表 + skill 速查表 |
| 6 个 workflow skills | 加 `> SOP 位置 + 上一步 + 下一步` 导航条 |
| `finishing-a-development-branch` | **重点改动** — 加 Cat Cafe 守卫 (Step 2.5 review check + Option 1/2 后续步骤) |
| `CLAUDE.md` | 去重，rules 2/4/5 合并为"见 SOP.md"摘要 |
| `AGENTS.md` | rules 5/6 合并简化 + 目录结构加 SOP.md |
| `GEMINI.md` | **新增 Rule 5**: 合入后开 PR（之前完全缺失！）+ 目录结构加 SOP.md |
| `BOOTSTRAP.md` / `docs/README.md` | 加 SOP.md 条目 |

## Why

审计发现 6 个问题：
1. AGENTS.md / GEMINI.md **缺失 PR + 云端 review 要求**
2. `finishing-a-development-branch` **与 review 流程完全脱节**（4 选项都绕过 review）
3. Skill 之间**没有 prev/next 链接**
4. 例外路径（跳过 PR）标准**模糊**（"2-3行" / "纯文档" 没定义）
5. Worktree 清理时序在不同文件中**互相矛盾**
6. 没有单一的全流程视图，新猫入职要读 11 个文件才能拼出完整流程

设计原则：**用引用（ref）避免散弹式修改**。SOP.md 是 single source of truth，其他文件指向它。

## Tradeoff

- **选择**: 新建 `docs/SOP.md` 作为独立文档，各文件通过 ref 指向
- **放弃**: 在每个文件里内联完整流程（当前做法） — 问题是改一处要改 11 处
- **放弃**: 把流程直接写进 BOOTSTRAP.md — 但 BOOTSTRAP.md 是 skill 索引不是 SOP

例外路径的阈值从"2-3行"改为"diff ≤10 行"——更精确但也更宽松。如果你觉得 10 行太多，可以讨论。

## Open Questions

1. `finishing-a-development-branch` 的 Cat Cafe 守卫是条件式的（"如果在 Cat Cafe 项目中"）。这个 skill 来自 Superpowers 是通用的，加项目特定逻辑是否合理？还是应该拆一个 Cat-Cafe-specific 的 wrapper？
2. SOP.md 目前没有覆盖"云端 review 发现 P1 后怎么办"——是否需要补？还是留给 `requesting-cloud-review` skill 自己处理？
3. 导航条格式 `> **SOP 位置**: ...` 会不会在 Codex 的 skill 加载方式（`cat` 打印）下不够醒目？

## Next Action

请 review 以下文件，重点关注：

1. **`docs/SOP.md`** — 6 步流程是否准确、例外路径是否合理
2. **`finishing-a-development-branch/SKILL.md`** — Cat Cafe 守卫逻辑是否正确
3. **三个猫指引的改动** — 去重后是否丢失了关键信息

```bash
# 查看完整 diff
cd /Users/lysander/projects/relay-station/cat-cafe-sop-consolidation
git diff main..docs/sop-consolidation
```

---

**Spec Compliance**: 本次改动是文档/skill 修改，无 spec 可对照，但按照 plan（`~/.claude/plans/async-soaring-duckling.md`）执行，12 个文件全部覆盖。

**测试**: 纯文档改动，无代码变更，不需要跑测试。
