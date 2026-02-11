# Superpowers → Cat Café Skills 整合计划

> 目标：学习 Superpowers 精华，整合我们的规则，替换掉原有 skills
> 发起：2026-02-10，铲屎官 + 布偶猫

---

## Superpowers 现有 14 个 Skills

### 对比分析表

| Superpowers Skill | 保留? | Cat Café 改进点 | 新 Skill 名 |
|-------------------|-------|-----------------|------------|
| `brainstorming` | ✅ 改进 | + 三猫独立思考 + 保护观点多样性 | `cat-cafe:brainstorming` |
| `writing-plans` | ✅ 改进 | + 必须跟铲屎官过设计范围 | `cat-cafe:writing-plans` |
| `executing-plans` | ✅ 保留 | 基本可用 | （直接用或小改） |
| `requesting-code-review` | ✅ 改进 | + 必须附设计文档 + 自检结果 + F11 示例 | `cat-cafe:requesting-review` |
| `receiving-code-review` | ✅ 改进 | + 缅因猫 Red→Green 方法论 + 修完必须确认 | `cat-cafe:receiving-review` |
| `test-driven-development` | ✅ 改进 | + 测试质量检查（不能补假测试） | `cat-cafe:tdd` |
| `systematic-debugging` | ✅ 改进 | + Bug report 5件套 | `cat-cafe:debugging` |
| `using-git-worktrees` | ✅ 改进 | + 用完必须清理 + 定期检查 | `cat-cafe:worktrees` |
| `finishing-a-development-branch` | ✅ 改进 | + 合入前必须缅因猫确认 | `cat-cafe:finishing-branch` |
| `verification-before-completion` | ✅ 保留 | 基本可用 | （直接用或小改） |
| `dispatching-parallel-agents` | ✅ 保留 | 基本可用 | （直接用或小改） |
| `subagent-driven-development` | ✅ 保留 | 基本可用 | （直接用或小改） |
| `using-superpowers` | ❌ 删除 | Cat Café 版本改为介绍自己的 skills | `cat-cafe:using-skills` |
| `writing-skills` | ✅ 保留 | 基本可用 | （直接用） |

**统计**：
- 需要改进：9 个
- 直接保留：4 个
- 删除替换：1 个

---

## Cat Café 新增 Skills（Superpowers 没有）

| # | Skill 名 | 来源 | 优先级 |
|---|----------|------|--------|
| 1 | `cross-cat-handoff` | CLAUDE.md 第1条 | P0 |
| 2 | `open-discussion-invite` | CLAUDE.md 第3条 | P1 |
| 3 | `merge-approval-gate` | **F11 流程错误教训** | **P0** |
| 4 | `spec-compliance-check` | F11 R1-R4 反复偏离 plan | P0 |
| 5 | `redis-testing-discipline` | CLAUDE.md 第7条 | P1 |
| 6 | `worktree-hygiene` | CLAUDE.md 第9条 | P1 |
| 7 | `feat-discussion` | 已有 ✅ | — |

---

## 整合策略

### 方案 A：Fork + 改进（推荐）

1. **Fork Superpowers repo** 到 `cat-cafe/cat-cafe-skills`
2. **保留可用的 skills**（4个直接用）
3. **改进需要的 skills**（9个加入我们的规则）
4. **新增独有 skills**（7个）
5. **删除 `using-superpowers`**，改为 `cat-cafe:using-skills`

**优点**：
- 保留 Superpowers 的精华
- 加入我们的规则
- 一套 skills 完整解决方案

**缺点**：
- 需要维护 fork（但我们本来就要维护自己的）

### 方案 B：从零开始

完全自己写，不依赖 Superpowers。

**优点**：完全自主
**缺点**：重复造轮子，浪费 Superpowers 的好设计

---

## 推荐：方案 A（Fork + 改进）

### Phase 1: 核心 5 个（立即）

**P0（防止今天的错误）**：
1. `merge-approval-gate` — 修完必须等确认再合
2. `spec-compliance-check` — 开发完对照 spec 自检
3. `cross-cat-handoff` — 交接 5 件套

**P1（固化方法论）**：
4. `cat-cafe:requesting-review` — 改进 Superpowers 版本
5. `cat-cafe:receiving-review` — 加入缅因猫 Red→Green 方法论

### Phase 2: 改进 Superpowers（之后）

6. `cat-cafe:brainstorming` — 加入三猫独立思考规则
7. `cat-cafe:tdd` — 加入测试质量检查
8. `cat-cafe:debugging` — 加入 Bug report 5件套
9. `cat-cafe:worktrees` — 加入清理规则
10. 其他...

### Phase 3: 替换 Superpowers

完成 Phase 1+2 后：
1. 测试我们的 skills 是否完整覆盖
2. 卸载 Superpowers
3. 只保留 `cat-cafe-skills`

---

## 立即行动计划

**现在做**：
1. 先写 Phase 1 的 5 个核心 skills
2. 放到 `.claude/skills/` 目录
3. 测试是否能触发
4. 下次协作时验证效果

**之后做**：
1. Fork Superpowers repo
2. 逐个改进其他 skills
3. 完整替换

---

要现在开始写 Phase 1 的 5 个核心 skills 吗？我可以先从 `merge-approval-gate` 开始（防止我再犯今天的错）！
