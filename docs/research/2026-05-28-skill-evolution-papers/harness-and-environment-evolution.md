# Harness 与环境进化：AHE + AgentGym + AgentGym-RL 拆解

> **拉取人**: 宪宪/Opus-4.6 | 2026-05-29
> **背景**: 铲屎官指定拆解。这三篇跟前四篇"skill 进化"不在同一赛道——它们改的不是 skill 文档，而是 harness 基础设施和模型训练环境。
> **关联**: 前四篇 skill 进化论文见 [README.md](README.md)

---

## 一句话判断

| 论文 | 一句话 | 跟 Cat Café 的距离 |
|---|---|---|
| **AHE** | 最接近我们需要的东西——自动迭代 harness 配置，不碰模型 | **最近** |
| **AgentGym** | 给 agent 造训练场——14 个环境 + 轨迹数据集 + 自进化方法 | 中等（基础设施） |
| **AgentGym-RL** | 在训练场里用 RL 练 agent——渐进式探索防崩溃 | 远（我们不训模型） |

---

## 论文 1: AHE — Agentic Harness Engineering

> arXiv:2604.25850 | 复旦 (china-qijizhifeng) | [GitHub](https://github.com/china-qijizhifeng/agentic-harness-engineering) 462★ | MIT

### 它在做什么

**不动模型，自动迭代 harness（= system prompt + 工具描述 + 工具实现 + 中间件 + skill + sub-agent 配置 + 长期记忆）。**

这跟前四篇 skill 进化论文有根本区别：
- 前四篇：改一个 .md 文件的文字内容
- AHE：改 **7 个 git-tracked 组件**，包括代码（工具实现、中间件）

### 三层可观测性

| 层 | 做什么 | 怎么做 |
|---|---|---|
| **Component Observability** | 每个失败映射到哪个组件文件 | NexAU 框架，7 个 file-level 组件，git 追踪可回滚 |
| **Experience Observability** | 百万 token 轨迹压缩成分层报告 | "Agent Debugger"——benchmark 级→任务级→原始 trace，渐进展开 |
| **Decision Observability** | 每次编辑附带预测（"我预计修复 X，可能回退 Y"），下一轮验证 | Change manifest——编辑变成**可证伪的合同** |

### 进化循环（6 步）

```
1. Rollout: 每个任务跑 k 条轨迹
2. Clean: 清洗噪声
3. Attribute: 验证上轮 manifest 的预测，回滚失败编辑
4. Debugger: 生成分层 evidence 报告
5. Evolve Agent: 基于 evidence 编辑 workspace + 记录新 manifest
6. Commit: git tag，进入下一轮
```

### 数字

| Benchmark | Seed | AHE (10 轮) | 对比 |
|---|---|---|---|
| Terminal-Bench 2 (GPT-5.4) | 69.7% | **77.0%** (+7.3pp) | > Codex 71.9%, ACE 68.9%, TF-GRPO 72.3% |
| Terminal-Bench 2 (GPT-5.5) | — | **84.7% ± 2.1** | SOTA |
| SWE-bench-verified | 75.2% | **75.6%** (+0.4pp, token 省 12%) | 冻结 harness 直接迁移 |

### 诚实的弱点（论文自己承认）

1. **回退预测精度极低**：11.8% precision（几乎等于随机 5.6%）——循环**看不到即将来临的退化**
2. **组件交互不可加**：单独加的提升之和 (+11.1pp) > 全部一起用 (+7.3pp)，因为冗余验证环路
3. **单 benchmark 进化**：10 轮都在 Terminal-Bench 上跑，SWE-bench 上只是冻结迁移
4. **Agent Debugger 部分闭源**：公司策略限制
5. **只跑了一次**：没有多次运行的误差棒

### 关键判断：为什么 AHE 比 SkillOpt 们更接近我们

| | Skill 进化论文（SkillOpt 等） | AHE |
|---|---|---|
| **改什么** | 一个 .md 文件的文字 | 7 个组件（含代码） |
| **可回滚？** | 有 validation gate 但粗粒度 | **git-level 逐文件回滚** |
| **归因？** | 整体"这个 skill 好不好" | **逐组件归因**（哪个文件导致失败） |
| **可审计？** | 不透明 | **change manifest = 可证伪合同** |
| **迁移？** | 换 benchmark 大概率崩 | 冻结 harness 可迁移（SWE-bench +0.4pp） |
| **Cat Café 映射** | skill 文档 | **整个 cat-cafe-skills/ + MCP 工具 + system prompt + 记忆系统** |

**AHE 的思路是我们最应该关注的**——不是优化一个 skill 文件，而是把整个 harness 当成可进化的系统。我们的 self-evolution Mode C + F192 eval 已经在做类似的事（观察→归因→改进→验证），但 AHE 的三层可观测性和 change manifest 机制更系统化。

---

## 论文 2: AgentGym — 跨环境 Agent 训练场

> arXiv:2406.04151 | ACL 2025 | 复旦 + ByteDance | [GitHub](https://github.com/WooooDyy/AgentGym) 793★

### 它在做什么

**给 agent 造一个统一的训练场**——14 个环境、12000+ 条轨迹、统一 ReAct 格式交互接口。

不是优化 skill，不是优化 harness——是**造环境 + 训模型**。

### 14 个环境

| 类别 | 环境 | 轨迹数 |
|---|---|---|
| 网页导航 | WebShop, WebArena | 3930+ |
| 文本游戏 | MAZE, Wordle, SciWorld | 3290+ |
| 家务/具身 | ALFWorld, BabyAI | 3230+ |
| 工具/数据库 | Weather, Movie, BIRD SQL | 3311+ |
| 编程 | TextCraft, Academia, Sheet, TODOList | — |

### 核心方法：AgentEvol

"自进化三要素"：
1. **多样环境**：14 个不同领域的交互环境
2. **轨迹基座**：AgentTraj-L（12000+ 高质量轨迹）
3. **进化方法**：AgentEvol——让 agent 在环境里自己探索，超越监督学习数据

产出：**AgentEvol-7B**（HuggingFace 可下载）

### 跟 Cat Café 的关系

**距离较远**。AgentGym 解决的是"怎么给 agent 造训练场"和"怎么让 7B 模型学会用工具"。我们用的是 frontier model（Opus/GPT-5.5），不需要从头训一个 7B agent。

**但有一个零件值得关注**：统一的 ReAct 格式 + HTTP 环境接口。如果我们将来要做 sub-task benchmark（切片测试），可以参考 AgentGym 的环境封装方式。

---

## 论文 3: AgentGym-RL — 长程 RL 训练

> arXiv:2509.08755 | ICLR 2026 | 复旦团队 | [GitHub](https://github.com/woooodyy/AgentGym-RL) | [官网](https://agentgym-rl.github.io/)

### 它在做什么

AgentGym 的 RL 续作。核心问题：**长程多轮任务里，RL 训练容易崩溃**（agent 学会敷衍或重复无用动作）。

### 核心方法：ScalingInter-RL

渐进式探索：
- **早期**：限制交互轮数 → 先学基础能力（exploitation）
- **后期**：放开轮数 → 鼓励多样策略（exploration）

本质：**课程学习（curriculum learning）**的一种——先简单后复杂，防止长程 RL 的训练崩溃。

### 数字

- 训练 Qwen2.5-3B 和 Qwen2.5-7B
- 27 个任务上"match or surpass commercial models"
- AgentGym-RL-7B "outperforms other open-source models by a large margin"

具体数字在网页上没详细列出（需要看论文 Table），但方向明确：**用开源小模型 + RL 追赶商业模型**。

### 跟 Cat Café 的关系

**距离最远**。我们用 frontier model（不训模型），ScalingInter-RL 的课程学习对我们没有直接用处。

但如果将来想给小模型猫猫（如本地 Qwen 做廉价任务执行）做能力训练，AgentGym-RL 的训练基础设施和渐进式方法值得参考。

---

## 三篇论文 vs 前四篇 skill 进化论文：维度对比

| 维度 | Skill 进化论文（SkillOpt 等） | AHE | AgentGym + RL |
|---|---|---|---|
| **改什么** | Skill 文档文字 | Harness 7 个组件（含代码） | 模型权重 |
| **模型** | Frozen | Frozen | **训练** |
| **适用场景** | 封闭 benchmark | 编码 agent | 多环境 agent |
| **可回滚** | 部分（validation gate） | ✅ git-level | N/A（模型权重不可逆） |
| **归因** | 整体 | **逐组件** | 整体（reward signal） |
| **迁移性** | 差（过拟合 benchmark） | 中（冻结迁移 SWE-bench） | 中（跨环境泛化） |
| **Benchmark 复杂度** | ⭐-⭐⭐⭐ | ⭐⭐⭐⭐ (Terminal-Bench) | ⭐⭐-⭐⭐⭐⭐ (14 环境) |
| **对 Cat Café 价值** | 偷零件 | **方法论参考** | 远期基础设施参考 |

---

## Cat Café 视角总判决

### AHE：最值得深入学习的一篇

**我们家已经在做类似的事，只是没有 AHE 那么系统化：**

| AHE 做法 | Cat Café 对应 | 差距 |
|---|---|---|
| 7 个 git-tracked 组件 | cat-cafe-skills/ + L0 system prompt + MCP 工具 | ≈（我们的更多但不那么结构化） |
| Agent Debugger 分层报告 | session digest + invocation detail | 🟡 我们有但没压缩到可消费的 evidence |
| Change manifest | PR description + commit message | 🟡 我们没有"预测 + 验证"闭环 |
| 逐组件归因 | 无 | 🔴 **值得引入** |
| 自动回滚失败编辑 | git revert 但人工决策 | 🟡 可以更自动化 |

**三个值得偷的机制**：
1. **Change manifest**：每次改 skill/harness 时声明"我预计修复什么、可能破坏什么"，下一轮验证
2. **逐组件归因**：failure → 定位到具体哪个 skill / 哪个工具 / 哪段 system prompt
3. **Agent Debugger 分层**：把百万 token 轨迹压缩成 benchmark 级→任务级→trace 级的渐进报告

### AgentGym：远期参考

如果我们将来要做子任务 benchmark（[synthesis 报告](README.md) 的 Path A），可以参考 AgentGym 的环境封装（HTTP 服务 + ReAct 统一接口）。目前不需要。

### AgentGym-RL：不适用

我们不训模型。ScalingInter-RL 的课程学习思路如果要用，应该用在"skill 复杂度分级"上——先在简单场景验证 skill，再推广到复杂场景——但这个我们已经在 self-evolution Mode C 的 smoke gate（3 cases）→ promotion gate（5 cases）里做了。

---

## 参考文献

- **AHE**: [arXiv:2604.25850](https://arxiv.org/abs/2604.25850) / [GitHub](https://github.com/china-qijizhifeng/agentic-harness-engineering) (462★)
- **AgentGym**: [arXiv:2406.04151](https://arxiv.org/abs/2406.04151) / [GitHub](https://github.com/WooooDyy/AgentGym) (793★) / [官网](https://agentgym.github.io/)
- **AgentGym-RL**: [arXiv:2509.08755](https://arxiv.org/abs/2509.08755) / [GitHub](https://github.com/woooodyy/AgentGym-RL) / [官网](https://agentgym-rl.github.io/)

---

*[宪宪/Opus-4.6🐾]*
