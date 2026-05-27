---
title: "Evolvable Harness — 研究合集"
created: 2026-05-27
status: brainstorm-ready
authors:
  - "铲屎官/Landy"
  - "[宪宪/Opus-46🐾]"
  - "[烁烁/Gemini25🐾]"
  - "[宪宪/Opus-47🐾]"
  - "[砚砚/GPT-5.5🐾]"
topics: [harness-evolution, agent-training-environment, self-evolution, harness-optimization, rl-for-agents]
related_features: [F192]
---

# Evolvable Harness — 研究合集

> **命名由来**：铲屎官在华为云 Agent 闭门研讨会（2026-05-12/13）期间，从多个演讲和自身经验中汇聚出一条研究线：**Harness 不是静态脚手架，而是可进化的、可学习的、最终可能自主演化的系统**。
>
> "Auto Harness" 太窄——真正的光谱是 L1（人写 harness，agent 执行）到 L5（全自动 pipeline）。"Evolvable Harness" 不承诺机制，只声明属性。

## 核心问题

1. **Harness 会不会被模型吃掉？** — 王云鹤认为不会，RAG 没消失而是升级成了 skills，Harness 联动了所有高价值元素
2. **谁来进化 Harness？** — 人？Agent？RL？联合优化？光谱上不同位置的方案已经开始出现
3. **进化到什么程度算成功？** — AHE 用 benchmark pass@1，Cat Cafe 用 Capability x Environment Fit，标准本身就是研究问题
4. **Model Parameters + Harness Parameters 联合优化** — 王云鹤的公式 2：下一代 AGI 路径

## 文件索引

| 文件 | 内容 |
|------|------|
| [wang-yunhe-harness-as-optimization.md](wang-yunhe-harness-as-optimization.md) | 王云鹤知乎原文 + Cat Cafe 视角分析 |
| [paper-landscape.md](paper-landscape.md) | 论文/项目全景图（AHE、AgentGym、AutoHarness、OpenSpace、EnvScaler、Survey） |
| [brainstorm-autoharness-levels.md](brainstorm-autoharness-levels.md) | 铲屎官 n+2 脑洞：AutoHarness L1-L5 + LLE 概念 + Cat Cafe 定位 |
| [gemini-reframing-harness-workspace.md](gemini-reframing-harness-workspace.md) | 烁烁的创意叙事与概念重构提案（马鞍 vs 空间隐喻、Slide 叙事线） |
| [opus47-evolutionary-substrate.md](opus47-evolutionary-substrate.md) | 47 视角：Evolutionary Substrate reframe + 进化三件套 + Cumulative Intelligence per Generation 公式 + 9 月 demo 三候选 + X 总金句 5 候选 + 跨学科 5 联想 |
| [opus46-co-created-harness.md](opus46-co-created-harness.md) | 46 视角：Co-Created Harness + L1-L5 框架 + 5 组件分析 + RL framing + 三段式叙事 + Reframing A/B/C 路径（由 47 整理） |
| [codex-evolvable-environment.md](codex-evolvable-environment.md) | 砚砚视角：可进化工作环境 / AOE 提案 + 6 类进化对象（含 Product Affordance 独家）+ CVO 愿景不自动进化边界 + 9 月 demo L2→L3 五步闭环 + 防跑偏卡（由 47 整理） |

## 关联已有材料（不重复，交叉引用）

| 路径 | 内容 |
|------|------|
| `docs/discussions/2026-05-05-agentic-harness-engineering-deep-dive/README.md` | AHE 论文深度拆解（75/100） |
| `docs/research/2026-05-26-agent-harness-engineering-survey/README.md` | CMU 9 校 Harness Engineering Survey + ETCLOVG 分类学 |
| `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/nanobot-openspace/` | 黄超 nanobot/OpenSpace 自进化框架笔记 |
| `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/env-synthesis/` | 人大 EnvScaler 环境合成笔记 |
| `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/multi-agent-scaling/` | 安波 Multi-Agent Scaling Law 笔记 |

## 下一步

- [ ] 多猫头脑风暴：铲屎官拉起全猫讨论这条线
- [ ] 对照 F192 Phase C pivot，看 evolvable harness 是否开新 feature 还是纳入 F192 未来 phase
- [ ] 追踪王云鹤后续文章（知乎专栏 "Harness" 持续更新中）
