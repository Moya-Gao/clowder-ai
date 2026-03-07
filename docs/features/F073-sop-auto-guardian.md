---
feature_ids: [F073]
related_features: [F046, F067, F038, F042]
topics: [sop, automation, flow-control, context-compression, self-closing, governance]
doc_kind: spec
created: 2026-03-07
---

# F073: SOP Auto-Guardian — 流程自闭环守护

> **Status**: spec
> **Owner**: 布偶猫
> **Created**: 2026-03-07
> **Priority**: P1

---

## Why

铲屎官反复手动提醒猫猫 SOP 步骤，这是系统设计缺陷，不是管理问题。

**核心痛点**（铲屎官原话 2026-03-07）：

> "你看你们很多时候需要我一次次的提醒。如果不唠叨你们很容易走错，特别是上下文压缩之后。"
> "布偶猫的 hook 似乎也不怎么好使，压缩后提醒他的那个是不是也得拉出来看看为什么呢？"

**反复出现的手动提醒场景**：

1. **冷启动守护**：铲屎官要手动告诉猫"加载 feat skill，判断能不能 close"，并协调跨线程通知
2. **愿景守护**：铲屎官要手动提醒"先做愿景守护再 close feat"
3. **Worktree 前置检查**：铲屎官要提醒"先 commit push main 再开 worktree，不然文档不一致"
4. **SOP 全链路自驱**：猫猫每步都停下来问"可以继续吗？"，铲屎官期望的是全链路自驱只在 close 时通知
5. **压缩后遗忘**：上下文压缩后猫猫忘记当前阶段和规则，hook 提醒不够可靠

**本质问题**：SOP 规则存在于 prompt/MEMORY 中（软约束），压缩后丢失。需要系统级机制（硬约束）来替代人肉提醒。

## What

通过三层机制实现 SOP 流程自闭环，让铲屎官只在最终交付时介入：

### Layer 1: Hook 可靠性修复

**目标**：诊断并修复压缩后 hook 不生效的问题。

- 调查 Claude Code 的 hook 机制（`.claude/hooks/`）在 context compaction 后的行为
- 确认 hook 是否在压缩后被正确触发
- 如果 hook 机制本身有限制，设计 workaround

### Layer 2: SOP 阶段感知注入

**目标**：SystemPromptBuilder 根据 thread/task 当前状态，自动注入对应阶段的 SOP 提醒。

- 利用现有 thread metadata 或 task 状态记录"当前 SOP 阶段"（如 `sop_stage: worktree | dev | quality-gate | review | merge | completion`）
- 每次 invocation 时 SystemPromptBuilder 读取阶段，注入对应的关键提醒（如 worktree 阶段提醒"确认 main 是最新的"）
- 压缩后此信息不丢失（存在 thread metadata 中，不依赖上下文历史）

### Layer 3: 流程门禁自动化

**目标**：关键流程节点的自动检查，不需要铲屎官提醒。

- **Worktree 门禁**：开 worktree 前自动检查 main 是否已 push 最新文档
- **Feat Close 门禁**：close feat 前自动触发跨猫愿景守护（而非等铲屎官手动协调）
- **全链路自驱**：完成开发后自动走 quality-gate → review → merge → completion，只在遇到阻塞或最终 close 时通知铲屎官

### 明确不做

| 方案 | 不做原因 |
|------|---------|
| 常用话术编辑器 | 治标不治本——让铲屎官唠叨得更快不如让系统替他唠叨 |
| 向量化 SOP 偏离检测 | 过度工程 |
| 强制每步人工审批 | 与"自闭环"目标矛盾 |

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "压缩后提醒他的那个是不是也得拉出来看看为什么呢" — hook 压缩后不生效的诊断修复 | AC-1 | 诊断报告 + 修复验证 | [ ] |
| R2 | "提醒你们要先更新 feat 或者 backlog md 在 main 上 commit push 然后才能开 worktree" — worktree 前置检查 | AC-2 | test | [ ] |
| R3 | "feat close 是需要其他猫猫帮你在 pr 合入之后再做一次愿景守护的吧" — close 前自动触发跨猫守护 | AC-3 | 流程验证 | [ ] |
| R4 | "写完之后自己守护愿景然后修改跑偏然后找 codex 然后他过了你开 pr...通知我你合入了就行" — 全链路自驱不问铲屎官 | AC-4 | 端到端流程验证（本 Feature 本身即为试点） | [ ] |
| R5 | "特别是上下文压缩之后" — 压缩后 SOP 阶段不丢失 | AC-5 | test | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求->证据映射表（若适用）— 本 Feature 无前端 UI

## Acceptance Criteria

- [ ] AC-1: Hook 压缩后行为诊断完成，问题修复或 workaround 就位
- [ ] AC-2: Worktree skill 开 worktree 前自动检查 main 文档是否最新（warn/block）
- [ ] AC-3: Feat-lifecycle completion skill 自动触发跨猫愿景守护（不需铲屎官手动协调）
- [ ] AC-4: 本 Feature 从立项到 close 全程自驱，铲屎官只在最终 close 时被通知
- [ ] AC-5: Thread/task metadata 记录 SOP 阶段，SystemPromptBuilder 注入阶段提醒，压缩后不丢失

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Related** | [F046](F046-anti-drift-protocol.md) | 愿景守护流程（本 Feature 自动化其执行） |
| **Related** | [F067](F067-cold-start-verifier.md) | 冷启动验证器（互补：F067 验交付物，F073 验流程） |
| **Related** | [F042](F042-prompt-engineering-audit.md) | 三层信息架构（本 Feature 利用 Skills 按需加载） |
| **Related** | [F038](F038-skills-discovery.md) | Skills 发现机制（本 Feature 依赖 skill 自动加载） |

## Key Decisions

| 决策 | 选择 | 放弃的方案 | 理由 |
|------|------|-----------|------|
| 解决方式 | 系统级硬约束 | 常用话术编辑器 | 软约束压缩后丢失，硬约束不依赖上下文 |
| 阶段存储 | Thread/task metadata | 上下文内标记 | Metadata 不受压缩影响 |
| 自驱程度 | 全链路自驱，阻塞时才问 | 每步确认 | 铲屎官明确要求 |

## Dependencies

| Feature | 关系 | 说明 |
|---------|------|------|
| **F046** | Related | 愿景守护流程定义 |
| **F038** | Related | Skill 发现和加载机制 |

## Risk / Blast Radius

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| Hook 机制是 Claude Code 内部的，可能无法修复 | 中 | Layer 2 (metadata 注入) 作为独立于 hook 的 workaround |
| SOP 阶段注入增加 prompt token 消耗 | 低 | 仅注入当前阶段的关键提醒（<50 tokens） |
| 自动触发跨猫守护可能被误触发 | 低 | 只在 feat completion 路径触发，有明确条件判断 |

## Open Questions

1. Hook 机制在 context compaction 后的具体行为是什么？（需调查）
2. 现有 thread metadata 是否已支持自定义字段？还是需要扩展 schema？
3. 跨猫愿景守护的自动触发：用 A2A mention 还是 MCP 工具？

## Review Gate

| 轮次 | Reviewer | 结果 | 日期 |
|------|----------|------|------|

## Timeline

- 2026-03-07: 铲屎官提出需求（流程自闭环、hook 不生效、压缩后遗忘）
- 2026-03-07: F073 立项
