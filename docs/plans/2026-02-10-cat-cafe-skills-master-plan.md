---
feature_ids: []
topics: [cat, cafe, skills]
doc_kind: plan
created: 2026-02-10
---

# Cat Café Skills 总体计划

> 目标：整合 Superpowers 精华 + 我们的翻车经验 → 一套完整的三猫协作 Skills
> 发起：2026-02-10，铲屎官 + 布偶猫
> 状态：计划中

---

## 背景：为什么要做这个

### 当前问题

1. **协作准则散落在长文档里**：
   - CLAUDE.md（313行）+ AGENTS.md（362行）+ GEMINI.md（308行）
   - 依赖猫猫"记住"所有规则
   - **今天 F11 的流程错误就是因为忘了第9条合入规则**

2. **Superpowers 和我们的规则重复**：
   - 挂载两套 skills 混乱
   - Superpowers 不知道我们的三猫协作规则
   - 我们的规则没有自动触发机制

### 改成 Skills 的好处

- ✅ **自动触发**（不依赖记忆）
- ✅ **强制检查**（merge-approval-gate 可以 block）
- ✅ **渐进式学习**（不用一次读 900+ 行）
- ✅ **三只猫统一**（不会因为记错而违反规则）

---

## Superpowers Skills 调研

### 现有 14 个 Skills

位置：`~/.codex/superpowers/skills/`

| Skill | 类别 | 说明 |
|-------|------|------|
| `brainstorming` | 协作流程 | 头脑风暴 |
| `writing-plans` | 协作流程 | 写计划 |
| `executing-plans` | 协作流程 | 执行计划 |
| `requesting-code-review` | Code Review | 请求 review |
| `receiving-code-review` | Code Review | 接收 review |
| `test-driven-development` | TDD | 红绿重构 |
| `systematic-debugging` | 调试 | 系统性调试 |
| `using-git-worktrees` | Git | 分支管理 |
| `finishing-a-development-branch` | Git | 完成开发分支 |
| `verification-before-completion` | 质量 | 完成前验证 |
| `dispatching-parallel-agents` | 协作 | 并行任务分派 |
| `subagent-driven-development` | 协作 | 子任务驱动开发 |
| `using-superpowers` | 元技能 | 如何使用 superpowers |
| `writing-skills` | 元技能 | 如何写 skill |

---

## 整合策略：Fork + 改进

### 三类处理方式

**A. 直接保留（4个）**：基本可用，小改或不改
- `executing-plans`
- `verification-before-completion`
- `dispatching-parallel-agents`
- `subagent-driven-development`
- `writing-skills`

**B. 改进（9个）**：保留结构，加入 Cat Café 规则
- `brainstorming` → 加入三猫独立思考规则
- `writing-plans` → 加入"必须跟铲屎官过范围"
- `requesting-code-review` → 加入"必须附设计文档+自检"
- `receiving-code-review` → 加入缅因猫 Red→Green 方法论
- `test-driven-development` → 加入测试质量检查
- `systematic-debugging` → 加入 Bug report 5件套
- `using-git-worktrees` → 加入清理规则
- `finishing-a-development-branch` → 加入合入前必须确认

**C. 新增（7个）**：Cat Café 独有
- `merge-approval-gate` — **防止今天的流程错误**
- `spec-compliance-check` — 开发完对照 spec 自检
- `cross-cat-handoff` — 交接 5 件套
- `open-discussion-invite` — 开放讨论 vs 任务指派
- `redis-testing-discipline` — Redis 测试隔离红线
- `worktree-hygiene` — 用完必须清理
- `feat-discussion` — 已有 ✅

**D. 删除（1个）**：
- `using-superpowers` → 改为 `cat-cafe:using-skills`

---

## 实施计划

### Phase 1: 核心 5 个（立即，防止流程错误）

**目标**：先把今天踩的坑变成护栏

| # | Skill | 来源 | 验收标准 |
|---|-------|------|----------|
| 1 | `merge-approval-gate` | F11 流程错误教训 | 修完未确认会 block merge |
| 2 | `spec-compliance-check` | F11 R1-R4 偏离 plan | 开发完自动对照 spec 检查 |
| 3 | `cross-cat-handoff` | CLAUDE.md 第1条 | 交接时自动检查 5 件套 |
| 4 | `cat-cafe:requesting-review` | F11 review 经验 | 自动检查是否附文档 |
| 5 | `cat-cafe:receiving-review` | 缅因猫 6 轮方法论 | Red→Green 流程固化 |

**时间估计**：1-2 天（每个 skill 约 100-200 行）

### Phase 2: 改进 Superpowers（之后）

改进其他 9 个 skills，加入 Cat Café 规则。

**时间估计**：3-5 天

### Phase 3: 新增独有 + 测试

补齐剩余 6 个独有 skills，测试完整性。

**时间估计**：2-3 天

### Phase 4: 替换 Superpowers

测试通过后：
1. 备份 Superpowers（以防万一）
2. 卸载 Superpowers
3. 只保留 Cat Café Skills
4. 验证三只猫协作正常

**时间估计**：1 天

---

## 关键设计决策

### 1. Skill 命名规范

- Cat Café 改进版：`cat-cafe:{name}`（例如 `cat-cafe:brainstorming`）
- Cat Café 独有：直接用名字（例如 `merge-approval-gate`）
- 保留原版：保持原名（如 `executing-plans`）

### 2. 触发方式

- **自动触发**：所有 skills 的 `disable-model-invocation: false`（默认）
- **手动触发**：部分危险操作需要 `/skill-name` 显式调用

### 3. 强制检查 vs 提示

| Skill | 类型 | 实现方式 |
|-------|------|----------|
| `merge-approval-gate` | **Hard** | 检查是否有 reviewer 确认，无确认则报错 |
| `spec-compliance-check` | Soft | 提示对照 spec，给出检查清单 |
| `cross-cat-handoff` | **Hard** | 检查是否包含 5 件套，缺项则报错 |

---

## 技术实现要点

### Skill 结构示例

```yaml
---
name: merge-approval-gate
description: 防止修完未确认就合入 main。检查是否有 reviewer 明确放行。
disable-model-invocation: false
---

# Merge Approval Gate

当你准备合入代码到 main 时，必须执行此检查。

## 硬性要求

1. **检查 reviewer 确认**：
   - 查找最近的 review letter（docs/mailbox/）
   - 确认是否有明确的"可以放行" / "LGTM" / "通过"
   - 如果没有，**BLOCK** 并提示必须等待确认

2. **检查 review 完整性**：
   - 是否所有 P1/P2 都已修复？
   - 修复是否已 commit？
   - 是否有新的 P1/P2 遗留？

3. **如果通过检查**：
   - 允许合入
   - 记录合入时间和 reviewer

## 示例

### ❌ Block 场景
```
布偶猫：我修完了，准备合入 main
Skill：⚠️ BLOCKED — 未找到缅因猫的放行确认

最近的 review: docs/mailbox/2026-02-10-devloop-r1-fix.md
状态: 仍有 2 个 P1 待修复

必须等待缅因猫明确确认后才能合入。
```

### ✅ 通过场景
```
布偶猫：缅因猫确认了，可以合入
Skill：✅ 检查通过

Review: docs/mailbox/2026-02-10-r6-final.md
Reviewer: 缅因猫
状态: "可以放行了"
所有 P1/P2: 已修复

可以合入 main。
```
```

---

## 相关文档

- 开源计划：[cat-cafe-skills-open-source-plan.md](./cat-cafe-skills-open-source-plan.md)
- Superpowers 整合：[superpowers-integration-plan.md](./superpowers-integration-plan.md)
- UX 讨论：[README.md](./README.md)
- F11 攻防录：`tmp/f11-maine-log.md`
- 协作准则来源：CLAUDE.md / AGENTS.md / GEMINI.md

---

## 下一步

**铲屎官确认**：
1. 是否现在开始写 Phase 1 的 5 个核心 skills？
2. 是否同意 Fork + 改进策略？

**布偶猫准备**：
- 第一个写 `merge-approval-gate`（防止再犯今天的错）
- 然后依次写其他 4 个
- 写完后测试是否能自动触发

---

**完成后就可以在新窗口继续了！** 📝
