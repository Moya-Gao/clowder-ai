---
feature_ids: [F167]
related_features: [F064, F027, F122]
topics: [a2a, collaboration, harness-engineering, agent-readiness]
doc_kind: spec
created: 2026-04-17
---

# F167: A2A Chain Quality — 乒乓球熔断 + 虚空传球检测 + 角色护栏

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P0

## Why

F064 解了"漏传球"（该 @ 没 @），但三个月后暴露了反向问题群：乒乓球（同一对猫反复 @ 无产出）、虚空传球（说"我来做"但 @ 了对方导致球在地上）、角色不适配 handoff（让 designer 写代码）。

铲屎官定期审视 harness engineering 的结论（2026-04-17）：现有 A2A 出口检查只覆盖"漏传球"，没覆盖"过度/假/错误传球"。**Benchmark 高的模型在 agent 环境表现差**（Opus 4.7 benchmark > 4.6 但 agent 行为和小笨猫一样），说明 prompt 层护栏不够，必须补 harness 硬护栏。

铲屎官原话：
> "你们两！！没完没了互相at半天！特么不干活！！！！"
> "解决了47的问题或许什么glm什么kimi minimax qwen的问题也就解决了。。都是小笨猫"
> "我们必须要知道为什么的！不然以后每次模型升级假设来了个超级无敌牛逼猫猫，benchmark惊人！结果哈哈哈哈"

## What

### Phase A: Harness 硬护栏（P0）

三个 provider-agnostic 硬护栏，不依赖模型遵守 prompt：

**L1 — 乒乓球熔断**：WorklistRegistry canonical enqueue 点追踪连续 same-pair streak。streak=2 警告，streak=4 熔断。覆盖 serial + callback 双路径。

**L2 — Parallel @ mention 降噪**：prompt 层禁止 parallel 模式 @句柄 + harness 层 route-parallel 的 mentions 标记 `suppressedInParallel` 不写入 routedMentions。

**L3 — 角色适配门禁**：A2A handoff 时检查目标猫角色能力。coding/fix/test/merge 类动作不允许 handoff 给 designer 角色。fail-closed + 明确报错。

### Phase B: 语义检测（P1）

**L4 — 虚空传球检测**：行首 @mention + 否定动作模式（"你不需要""不用动""让链静默"）共现 → emit 警告。

**L5 — feedback_always_at_back 降级**：从"必须 @ 回"降级为"有产出才 @ 回"。必须在 L4 之后做。

### Phase C: 高级 + 研究（P2）

**L6 — 协调废话熔断**：连续 2 轮 A2A 无 tool_use/code block → 注入收尾提示。

**R1 — Benchmark ≠ Agent 研究**：为什么 benchmark 高的模型在 agent 环境表现差？构建 Agent Readiness Evaluation 框架，新模型进家门前先跑评估。

## Acceptance Criteria

### Phase A（Harness 硬护栏）
- [ ] AC-A1: WorklistRegistry 追踪连续 same-pair streak，streak≥4 自动终止 A2A 链并 emit 系统消息
- [ ] AC-A2: streak≥2 时向当前猫注入"乒乓球警告"提示
- [ ] AC-A3: 正常 review 循环 A→B→A→B (streak=3) 不受影响；中间插入第三只猫或 user 消息 reset streak
- [ ] AC-A4: callback-a2a-trigger 路径与 serial 文本路径走同一个 bounce 检测（无旁路）
- [ ] AC-A5: parallel 模式 @mentions 标记 suppressedInParallel，不写入 routedMentions
- [ ] AC-A6: parallel 模式 SystemPrompt 注入"独立思考禁止 @句柄"
- [ ] AC-A7: A2A handoff 目标猫为 designer 角色且动作为 coding/fix/test/merge 时 → fail-closed 报错
- [ ] AC-A8: 所有现有 A2A 相关测试通过（route-strategies / connector-invoke-trigger / system-prompt-builder）
- [ ] AC-A9: 新增测试覆盖 L1 乒乓球场景（误杀保护 + 正常熔断）、L2 parallel 抑制、L3 角色门禁

### Phase B（语义检测）
- [ ] AC-B1: 行首 @mention + 否定动作模式共现 → emit 虚空传球警告
- [ ] AC-B2: feedback_always_at_back 降级为"有产出才 @ 回"
- [ ] AC-B3: 降级后 F064 出口检查仍正常工作（不回退漏传球问题）

### Phase C（高级 + 研究）
- [ ] AC-C1: 协调废话熔断：连续无产出 A2A 检测 + 收尾提示注入
- [ ] AC-C2: Agent Readiness Eval 框架文档（维度定义 + 测试方法）

## Dependencies

- **Evolved from**: F064（A2A 出口检查 — 链条终止盲区修复）
- **Related**: F027（A2A 路径统一）、F122（执行通道统一）

## Risk

| 风险 | 缓解 |
|------|------|
| L1 误杀合法 review 循环 | 用连续 streak 而非累计 count；threshold=4 允许 3 次正常来回 |
| L3 角色门禁过于粗暴 | 只拦 designer+coding 组合，不做通用能力矩阵（MVP） |
| L5 降级 always_at_back 重新出现漏传球 | 必须在 L4 虚空传球检测之后做，且保留 F064 出口检查 |
| 新模型的"小笨猫"行为超出 L1-L6 覆盖 | Phase C R1 研究建立 eval 框架，持续迭代 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | L1 streak threshold 最终值：4（当前）还是更宽松？ | ⬜ 需实测 |
| OQ-2 | L3 角色能力矩阵是否需要超越 designer 做更通用的映射？ | ⬜ MVP 后评估 |
| OQ-3 | Benchmark ≠ Agent 的根因是蒸馏丢失元认知、过度对齐、还是长上下文优先级能力？ | ⬜ Phase C 研究 |
| OQ-4 | Agent Readiness Eval 是否应在模型 onboarding 流程中成为硬门禁？ | ⬜ 待铲屎官拍板 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 新立 Feature 而非重开 F064 | F064 scope 是"漏传球"已 done，本案方向相反 | 2026-04-17 |
| KD-2 | L1 用连续 streak 而非累计 count | codex + gpt52 独立收敛：raw count 误杀 review 循环 | 2026-04-17 |
| KD-3 | L2 做 prompt + harness 双层 | prompt-only 不可靠，parallel 仍会持久化 mention | 2026-04-17 |
| KD-4 | L1 落点在 WorklistRegistry canonical push | 覆盖 serial + callback 双路径，无旁路 | 2026-04-17 |
| KD-5 | 先立项不写代码，先研究 benchmark ≠ agent 根因 | 铲屎官要求深入分析再动手 | 2026-04-17 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-17 | 铲屎官审视 harness → 发现六大问题 → 三猫讨论 → 提案 |
| 2026-04-17 | GPT-5.4 review (3 P1 修正) + Codex review (3 P1 同源收敛) |
| 2026-04-17 | 立项 F167 |

## Review Gate

- Phase A: 跨 family review（codex 或 gpt52）+ 现有 A2A 测试全绿
- Phase B: 同上 + F064 出口检查回归测试
- Phase C: 研究报告由铲屎官 review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F064-a2a-exit-check.md` | 前序：漏传球修复 |
| **Proposal** | `docs/discussions/2026-04-17-a2a-chain-quality-proposal.md` | 完整提案 + review 记录 |
| **Feature** | `docs/features/F027-a2a-path-unification.md` | A2A 路径统一 |
| **Feature** | `docs/features/F122-dispatch-queue.md` | 执行通道统一 |

## 需求点 Checklist

| 需求来源 | 需求点 | AC 映射 | 状态 |
|---------|--------|---------|------|
| 铲屎官 2026-04-17 | 乒乓球：同对猫反复 @ 无产出 | AC-A1~A4 | ⬜ |
| 铲屎官 2026-04-17 | parallel 模式 @ 废话 | AC-A5~A6 | ⬜ |
| GPT-5.4 发现 | 角色不适配 handoff（designer 写代码） | AC-A7 | ⬜ |
| 铲屎官 2026-04-17 | 虚空传球 | AC-B1 | ⬜ |
| 铲屎官 2026-04-17 | always_at_back 补丁反噬 | AC-B2~B3 | ⬜ |
| 铲屎官 2026-04-17 | 协调废话熔断 | AC-C1 | ⬜ |
| 铲屎官 2026-04-17 | benchmark ≠ agent 根因 + eval 框架 | AC-C2 | ⬜ |
