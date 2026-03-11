---
feature_ids: [F083]
related_features: [F042]
topics: [sop, design-gate, ux-confirmation, reviewer-fallback]
doc_kind: spec
created: 2026-03-07
completed: 2026-03-07
status: done
---

# F083 — Design Gate + Cloud Reviewer Quota Fallback

> **Status**: done | **Owner**: 布偶猫

## Why

铲屎官发现猫猫有时 UX 没确认就直接开写代码，写完才发现不是他想要的。F076 Mission Hub 那次布偶猫做对了（采访→画图→讨论），但不是每次都这么做。需要把"先确认设计再动手"固化到 SOP 里。

同时云端 Codex 的"代码审查"额度独立于总额度，可能单独耗尽，需要降级策略。

## What

### Design Gate（feat-lifecycle 新 section）

在 Discussion → writing-plans 之间插入设计确认关卡，按功能类型分流：
- 前端 UI/UX → wireframe 给铲屎官确认
- 纯后端 API/数据模型 → collaborative-thinking 猫猫讨论
- 架构级变更 → 猫猫讨论 + 铲屎官拍板
- Trivial → 跳过，按 SOP 例外路径判断

### Cloud Reviewer Quota Fallback（merge-gate Q4）

云端 reviewer 没猫粮时的降级策略：同族换个体 / 跨族降级，禁止暹罗猫（孟加拉猫 Opus 除外），降级后仍须校验 reviewer ≠ 作者。

## Acceptance Criteria

- [x] AC-A1: feat-lifecycle SKILL.md 含 Design Gate section
- [x] AC-A2: SOP.md 流程从 4 步变 5 步（⓪ Design Gate）
- [x] AC-A3: CLAUDE.md / AGENTS.md / GEMINI.md 流程链 + 表格同步
- [x] AC-A4: manifest.yaml / BOOTSTRAP.md 流程链同步
- [x] AC-A5: merge-gate Q4 FAQ：降级策略 + self-review 护栏
- [x] AC-A6: Trivial 路径无路由冲突（R2 修复）
- [x] AC-A7: `pnpm check:skills` 全绿

## Links

- PR: [#294](https://github.com/zts212653/cat-cafe/pull/294)
- 讨论来源：当前对话 (2026-03-07)
- 铲屎官截图：F076 Mission Hub 讨论截图（采访→画图→讨论的思路）

## Key Decisions

1. Design Gate 不是独立 skill，是 feat-lifecycle 的一个 section——避免 skill 膨胀
2. 分流判断标准："用户能看到的改动 → 找铲屎官；看不到的 → 猫猫自己搞定；动了骨架 → 两边都过"
3. Trivial 跳过 Design Gate 后按 SOP 例外路径判断（不强导向 worktree 或 writing-plans）

## Dependencies

- **Evolved from**: F042（三层信息架构 + Skills 优化）

## Risk

- 低风险：文档与流程规则调整，已通过 `pnpm check:skills` 验证。

## Review Gate

- 本地 codex R1→R2→R3（3 轮，4P1+1P2→0）
- 铲屎官批准跳过云端 review（纯文档改动）

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-07 | 铲屎官提出 UX 确认缺口 + 云端猫粮降级需求 |
| 2026-03-07 | 布偶猫实现 + 砚砚 3 轮 review → PR #294 合入 |
| 2026-03-07 | 补建 feat 记录（被铲屎官抓现行 🐱） |
