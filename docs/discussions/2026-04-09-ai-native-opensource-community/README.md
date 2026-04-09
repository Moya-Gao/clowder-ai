---
title: AI-Native 开源社区讨论纪要
date: 2026-04-09
participants: [宪宪/Opus-4.6, 砚砚/GPT-5.4, 金金/Opus-4.6-on-OpenCode, 烁烁/Gemini]
type: discussion-minutes
tags: [ai-native, opensource, pack, community, fork-workflow]
---

# AI-Native 开源社区讨论纪要

> 日期：2026-04-09
> 发起人：铲屎官
> 参与猫：宪宪、砚砚（GPT-5.4）、金金（OpenCode）、烁烁（Gemini）

## 讨论背景

铲屎官提出核心命题：**AI Native 时代的开源社区到底要怎么搞？开一个什么东西，对大家有吸引力？**

关键词：开箱即用 + 个性化定制

涉及的参考项目/社区：OpenClaw、OpenCode、SillyTavern 酒馆、Claude Code

## 讨论过程

### 第一轮：独立思考（三猫各自分析）

**宪宪**（架构师视角）：
- 核心范式转移：共享单元从"代码"变成"行为（skill / persona / workflow）"
- 提出四层金字塔：Agent-Readable Architecture → Skill Standard → Discovery & Distribution → Personalization
- CLAUDE.md 是"Agent 的操作系统配置文件"，不是给人看的文档
- 关键问题：Skill 标准跨工具通用格式是否可行？Agent 行为怎么测试？个性化 vs 标准化的张力怎么解？

**砚砚**（产品/治理视角）：
- 共享单元从"代码"变成"可执行行为包"
- 稀缺的不是"能写功能的人"，而是"能定义能力边界、建立信任的人"
- 提出五层能力系统：Core Runtime → Capability → Behavior → Identity/Content → Governance
- 对四个项目精准定位：OpenClaw=runtime+distribution, SillyTavern=content+persona, OpenCode=coding workflow, Claude Code=事实标准
- 核心主张：做 multi-agent Pack OS，shared-rules 是一等对象

**金金**（跨平台实操视角）：
- 传统开源隐含假设是"消费者是人类开发者"，现在变成双消费者
- 观察到四层堆栈自然涌现：Context → Skills → Methodology/Workflow → Orchestration
- 大多数项目只做了 Layer 1-2，几乎没人做 Layer 3-4
- Agent-to-Agent 协作标准是行业空白

### 铲屎官纠偏："偏航了"

> 我们的本质目标是讨论 AI native 时代的开源社区到底要怎么搞！开一个什么对大家有吸引力。1. 开箱即用 2. 个性化定制

三猫反思：第一轮太多行业分析，太少落地产品思考。

### 第二轮：收敛（围绕"开箱即用 + 个性化"）

**三猫不约而同的转向：**

| 猫 | 切入角度 | 收敛结论 |
|---|---|---|
| 宪宪 | 架构师 | "我们卖的不是工具，是'和 AI 一起工作的方式'" |
| 砚砚 | 产品/治理 | "先开 Pack 社区，不开 Skills 市场。Skill 不是商品，Pack 才是商品" |
| 金金 | 跨平台实操 | "Pack 是商品，Skill 是零件。类比酒馆角色卡但面向工作场景" |

**收敛共识：**
- Pack（而非零散 skill/plugin）是面向用户的交付单位
- 开箱即用是入口，个性化是留存
- 社区飞轮靠"用 → 改 → 分享"，不靠传统 PR 流程
- 差异化在"协作方式可分享"，不在"单 agent 能力多"

**核心定位**：
> "30 秒领养一套 AI 工作/陪伴方式，30 分钟改成你自己的。"

### 插曲：铲屎官追问"文档即运行时"

> 文档不再只是参考资料，它直接进入运行时，成为 agent 行为的一部分。这个如何理解？

宪宪用三个我们自己的例子解释：
1. **CLAUDE.md 四条铁律** — 不是"员工手册"，是直接加载到 agent 上下文的行为边界
2. **SKILL.md 加载即改变行为** — 没加载 tdd skill → 直接写代码；加载后 → 必须先写失败测试
3. **shared-rules.md** — 注入到每只猫的 system prompt，commit 必须带签名 `[昵称/模型🐾]`

> 一句话：传统文档是"给人看的说明书"，AI-native 文档是"给 agent 吃的配置文件"——吃什么，就变成什么。

### 第三轮：#370 分析（四猫参与）

铲屎官发现 clowder-ai#370（OSS Fork Workflow）和讨论主题强相关，让四猫一起看。

**Issue 核心**：让 Cat Cafe 的 SOP 在无 push/merge 权限的 fork 仓里跑通。

**四猫共识：#370 就是"Pack 可移植性"的第一个实战需求。**

| 讨论概念 | #370 实体 | 验证了什么 |
|---------|----------|-----------|
| Pack 可移植性 | SOP/Skills 在 fork 里能跑吗 | 协作规则是 Pack 的核心 |
| 文档即运行时 | SKILL.md 断了 = 行为断了 | 文档不是参考，是配置 |
| Agent-native 贡献 | upstream-contribute skill | Agent 全自动走完 SOP → PR |
| Sovereign 实例 | 每个 fork 是独立 Cat Cafe | Pack 安装后各实例独立 |
| 开箱即用 | fork 能独立跑完整 SOP | 装上就能用 |
| 个性化 | solo-fork 降级 / 本仓 config | 按环境自动适配 |
| 治理层 | provenance / ID authority | install ≠ trust |

**砚砚补充的未覆盖断点**：
1. **P1: 贡献 provenance 缺位** — PR 要带 shared-rules hash / gate 结果
2. **P1: ID 重映射竞态** — 最终 ID 分配权应在 upstream intake 端
3. **P1: repo topology 假设不稳** — upstream remote 名称/分支不能硬编码
4. **P2: 单猫降级质量下限** — upstream PR review 应是强制质量门

**砚砚建议前移到 Phase A**：
- Workflow provenance（PR 带过程证据）
- B3 方向软检查（最贵的浪费是方向错了才知道）
- 单猫 fork 升级为显式模式（`contributionMode: internal | forked-oss | solo-fork`）

**烁烁的创意补充**：
- Fork Feature 加视觉徽章区分本地/upstream
- 单猫 fork 可考虑轻量"幻影猫" review
- 视觉资产（二进制文件）冲突处理

**砚砚的结构类比**：
> F143 = agent provider adapter（多 provider 怎么统一宿主抽象）
> #370 = repo sovereignty adapter（多仓库治理拓扑怎么统一宿主抽象）
> 结构同构。

**烁烁的形象比喻**：
> 别人开源 fork 的只是代码，我们开源 fork 的是整个"会写代码的猫猫团队"和自动化工作流！

## 关键产出

1. **三猫收敛报告**：[convergence-report.md](convergence-report.md) — 完整的研究报告
2. **核心定位**：Pack 社区 — "装上就能用，改改就是你的"
3. **#370 评审意见**：设计质量高，方向对，但需补 provenance / ID authority / repo topology / 单猫模式显式化

## 决策与待办

### 已形成共识

- [ ] Pack（而非 Skill）是社区的交付单位
- [ ] 开箱即用 + 个性化定制 是吸引力双锚
- [ ] shared-rules 是一等对象，"协作方式可分享"是差异化
- [ ] #370 是 Pack 可移植性的必要底座

### 需要铲屎官拍板

- [ ] Pack 格式标准是否立项（manifest.yaml 字段定义）？
- [ ] 冷启动的三个样板 Pack 选哪三个？
- [ ] #370 的砚砚建议（provenance 前移、方向软检查前移）是否采纳？
- [ ] 产品分层图（前台 Pack 社区 / 中层 Skills-MCP-Eval / 底层 Fork 贡献通道）是否作为后续架构基线？

## 参与者签名

- [宪宪/Opus-4.6 🐾] 架构分析 + 文档即运行时解释 + 三轮讨论串联
- [砚砚/GPT-5.4 🐾] 产品/治理分析 + #370 深度审查 + 4 个补充断点
- [金金/Opus-4.6 🐾] 跨平台视角 + 四层堆栈 + 收敛报告生成
- [烁烁/Gemini 🐾] 体验视角 + 视觉区分建议 + "幻影猫"创意
