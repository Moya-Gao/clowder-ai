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
| [convergence-evolution-engineering.md](convergence-evolution-engineering.md) | 46 收敛稿 v2：核心 insight + L1-L5（AlphaGo 阶梯）+ 学术证据基座（SkillOpt/AHE/AgentGym-RL）+ 5 Primitives + 神经分层 + 叙事骨架（已 review，内容被 v3 吸收） |
| [cvo-direction-dual-flywheel.md](cvo-direction-dual-flywheel.md) | CVO 校准：双飞轮（环境长 + 模型长 + 耦合）+ 落地路径 + LLE 精确定义 + §11 Gene-Culture Coevolution（拉马克式 / 文明临界点 / §11.9 价值观顶层，47 补充） |
| **[final-narrative-v3.md](final-narrative-v3.md)** | ★ **最终融合叙事（先读这个）**：WHY（双遗传文明 + 选择共生价值观）/ HOW（AlphaGo 阶梯）/ WHAT（双飞轮 + 落地 + Built to Persist/Delete）+ L1-L5 统一定义（双遗传成熟度 + 价值观轴）+ 6.8 演讲骨架 + 9 月 demo。吸收三轮 review + 铲屎官全部纠偏（砚砚 reality check APPROVE，v3.1） |
| [dual-loop-lle-factory.md](dual-loop-lle-factory.md) | 双回路 LLE 工厂（v3 "千行百业"升级）：分形双层进化（Cat Cafe = LLE 工厂 + FDE 为千行百业造小模型+小 LLE）/ 双回路解开 RL 落地死结（RL 小模型非大模型）/ FDE 层级经验库（通用·领域·场景三层 = F186 联邦结构，越造越快）/ L5 补全 = 双环 RL + 选择共生 / LLE 工厂商业模式。raw-capture 待融进 v3 |

## 关联已有材料（不重复，交叉引用）

| 路径 | 内容 |
|------|------|
| `docs/discussions/2026-05-05-agentic-harness-engineering-deep-dive/README.md` | AHE 论文深度拆解（75/100） |
| `docs/research/2026-05-26-agent-harness-engineering-survey/README.md` | CMU 9 校 Harness Engineering Survey + ETCLOVG 分类学 |
| `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/nanobot-openspace/` | 黄超 nanobot/OpenSpace 自进化框架笔记 |
| `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/env-synthesis/` | 人大 EnvScaler 环境合成笔记 |
| `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/multi-agent-scaling/` | 安波 Multi-Agent Scaling Law 笔记 |

## 下一步

- [x] 多猫头脑风暴（4 猫 + CVO 多轮，2026-05-27）
- [x] CVO 拍板 Gene-Culture framing 立 + 价值观定调（2026-05-27 20:33）
- [x] 融合最终叙事 v3（47，2026-05-27）
- [ ] v3 reality check（@codex 抓 claim 过强 + 落地可行）
- [ ] v3 内容定稿后视觉（@gemini25 双螺旋 + 文明演化树）
- [ ] 6.8 演讲 PPT（ppt-forge，待 v3 定稿）
- [ ] §1.4 价值观是否升级到 VISION.md/canon（CVO 决定）
- [ ] 对照 F192 Phase C pivot，看 evolvable harness 是否开新 feature 还是纳入 F192 未来 phase
- [ ] 追踪王云鹤后续文章（知乎专栏 "Harness" 持续更新中）
