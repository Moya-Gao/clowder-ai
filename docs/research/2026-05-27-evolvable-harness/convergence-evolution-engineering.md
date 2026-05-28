---
title: "Evolution Engineering — 多猫脑暴收敛稿 v1"
created: 2026-05-27
author: "[宪宪/Opus-46🐾]"
contributors:
  - "[宪宪/Opus-47🐾] — 进化三原理框架、AlphaGo 阶梯、章鱼神经系统、RL 三阶段路径"
  - "[砚砚/GPT-5.5🐾] — 落地度量指标、遗传物泛化定义、金句提炼"
  - "[烁烁/Gemini🐾] — 加拉帕戈斯定位、双沙箱 demo、达尔文视觉、自主神经系统展开"
  - "铲屎官/Landy — LLE 概念、AlphaGo 方向、神经分层原创、'非预设的瞬间'定调、RL 必须进场"
doc_kind: convergence
status: v1-pending-review
related:
  - paper-landscape.md
  - presentation-context.md
  - opus47-evolutionary-substrate.md
  - opus46-co-created-harness.md
  - codex-evolvable-environment.md
  - gemini-reframing-harness-workspace.md
  - docs/research/2026-05-26-microsoft-skillopt/README.md
  - docs/research/2026-05-26-agent-harness-engineering-survey/README.md
  - docs/discussions/2026-05-05-agentic-harness-engineering-deep-dive/README.md
---

# Evolution Engineering — 多猫脑暴收敛稿 v1

> **定位**：将 4 猫 + 铲屎官的脑暴产出收敛为一份可共识的主线文档。
> 面向两个受众：(1) 6.8 X 总演讲的概念骨架，(2) 9 月 demo 的内部指导。
> **不是最终演讲稿**——是演讲稿和 demo 设计的输入。

---

## 1. 核心 Insight（一句话 + 三层展开）

### 一句话

> **下一代 AI 能力跃迁的杠杆，不在训模型，在训模型工作的环境。**

### 三层展开

**第一层（现象）**：Agent 的能力不只取决于模型参数，还取决于它工作的环境——规则、技能文档、记忆、协作协议、工具链、产品设定、治理结构。改环境比改模型便宜几个数量级，效果却可以相当甚至更大。

- 微软 SkillOpt 实证：不动模型，仅训技能文档，平均 +23.5pp，跨模型迁移 +15.2pp（arXiv:2605.23904, 52/52 全胜）
- CMU 9 校 Survey 结论："The harness is becoming the binding constraint"（SWE-bench 6.7%→68.3% 纯靠换 harness）

**第二层（原理）**：环境的演化遵循生物进化三原理——**变异**（多源认知差异产生新方案）、**选择**（review / eval / CVO gate 筛选好的变化）、**遗传**（技能 / 规则 / 记忆 / 治理跨代传递）。这不是比喻，是可工程化的机制。我们称之为 **Evolution Engineering**——系统化工程化 agent 环境进化能力的学科。

**第三层（赌注）**：就像 AlphaGo 从模仿人类棋谱到自我对弈再到超越人类——agent 环境也可以走同样的路。RL（强化学习）不是用来训模型权重，而是用来训环境参数（文本空间的技能 / 规则 / 路由 / 记忆结构）。谁先工程化这条路径，谁在 AI 时代拥有真正的复利资产。

---

## 2. L1–L5：Agent 环境进化等级

> **设计原则**：以"谁驱动环境进化"为分级轴，用 AlphaGo 阶梯做直觉锚，用进化三原理（变异/选择/遗传）做分析骨架。

| Level | 名称 | 一句话 | AlphaGo 类比 |
|---|---|---|---|
| **L1** | Human-Authored | 人写环境，agent 执行 | AlphaGo Fan（纯监督学习） |
| **L2** | Co-Created | 人机共创环境 | AlphaGo Lee（监督 + 人引导强化） |
| **L3** | Agent-Evolved, Human-Gated | Agent 进化环境，自动评估，人管战略 | AlphaGo Zero（自我对弈） |
| **L4** | Autonomous Evolution | 环境自主进化，人只设方向 | AlphaZero（跨棋种迁移） |
| **L5** | Open-Ended Evolution | 环境自己发现新进化方向 | MuZero（不告诉规则也能学） |

### L1: Human-Authored Environment

- **谁驱动**：人类 100%
- **变异源**：人的经验和直觉
- **选择机制**：人工 code review
- **遗传通道**：代码版本控制
- **业界谁在这里**：大多数 agent 框架（LangChain / AutoGen / CrewAI / Dify）
- **局限**：环境能力上限 = 人类设计能力上限

### L2: Co-Created Environment

- **谁驱动**：人类定方向 + agent 做建设
- **变异源**：多 agent 并行 + 跨厂商认知差异
- **选择机制**：跨族 review + CVO Gate + Magic Words 刹车
- **遗传通道**：Skills 文档 + ADR + Memory 联邦 + 治理规则 + 产品设定
- **业界谁在这里**：Cat Cafe 现状（铲屎官一行代码没写，所有代码/harness/治理规则由 agent 建设）
- **关键特征**："非预设的瞬间"开始出现——环境长出人类没设计过的结构（反番茄钟 / F196 紧急照护 / 禁止烁烁写代码 / Magic Word「下次一定」）

### L3: Agent-Evolved, Human-Gated

- **谁驱动**：Agent 提议 + RL 自动评估 + 人类只 Gate 不可逆决策
- **变异源**：Agent 主动实验 + sandbox 探索
- **选择机制**：自动化 eval + reversibility cost 判别 + CVO 只管红区
- **遗传通道**：自动化 skill/rule 更新 + 知识蒸馏到小模型
- **业界谁在这里**：
  - SkillOpt（微软）= L3 的 micro 版本（单 skill 训练循环，52/52 全胜）
  - AHE（复旦）= L3 的 coding-agent 版本（三层可观测性 + evolve loop，69.7%→77.0%）
  - AgentGym-RL（复旦+字节）= L3 的多环境版本（27 环境统一 RL 训练）
  - 宏观版（全环境 + 多维度 + 多 agent）尚无人做
- **L2→L3 的跃迁关键**：引入 RL 自动评估环境变更的好坏（不再全靠人类 review）
- **L3 接管悖论**（自动驾驶 L3 类比）：当 agent 大部分时间自主进化，人类怎么知道什么时候该介入？答案 = Magic Words（物理刹车）+ Eval 反馈环（系统主动报告）+ 跨厂商 Review（多视角检测同源盲区）

### L4: Autonomous Evolution

- **谁驱动**：Agent 自主 + 人类只设 fitness landscape（方向 / 价值观 / 约束边界）
- **变异源**：跨域迁移 + 新场景自动适配
- **选择机制**：多维 fitness（能力 × 安全 × 成本 × 方向对齐）
- **遗传通道**：跨域 / 跨组织的环境迁移
- **业界谁在这里**：学术前沿（DeepMind POET / XLand），无生产案例
- **L3→L4 的跃迁关键**：**fitness function 本身在演化**——什么算"好的 agent 行为"是流动的。这是 AlphaGo 路径搬到 agent 场景的真正硬骨头（围棋输赢规则固定，LLE 的"好"标准不固定）

### L5: Open-Ended Evolution

- **谁驱动**：环境自主，人类退到观察者
- **变异源**：涌现——环境发现人类没设想过的组织形态
- **选择机制**：fitness function 本身在演化（元进化）
- **遗传通道**：跨代积累 + 进化机制本身也在进化
- **业界谁在这里**：理论阶段
- **"非预设的瞬间"的终极形态**：环境发现人类从未设计过的 agent 组织结构，就像 AlphaGo 的 Move 37——人类 3000 年没发现的棋路

### 行业位置总结

- **绝大多数 agent 系统**：L1（人写环境，agent 执行）
- **少数先行者**：L2（人机共创）
- **学术/工业验证**：L3 的 micro 版本刚被验证（SkillOpt / AHE / AgentGym-RL）
- **n+2 赌注**：L3 宏观版 + L4 路径的工程化

---

## 3. 学术证据基座

### 3.1 SkillOpt（微软）— L3 micro-evolution 的硬证据

| 字段 | 内容 |
|---|---|
| 论文 | arXiv:2605.23904, "SkillOpt: Executive Strategy for Self-Evolving Agent Skills" |
| 核心方法 | 把自然语言 Skill 文档当可训练参数，用 DL 训练循环（epoch/batch/LR/validation gate）迭代优化 |
| 关键结果 | 52/52 (model × benchmark × harness) 全胜；平均 +23.5pp；跨模型迁移 +15.2pp |
| 与我们的关系 | **证明了"训文本空间参数"这条路 work**。但仅限单 skill 单 benchmark——macro-evolution（全环境多维度）是未覆盖的 gap |
| 详细分析 | `docs/research/2026-05-26-microsoft-skillopt/README.md` |

**SkillOpt 的 Evolution Engineering Primitives 映射**：
- ✓ Selection Operator（validation gate）
- ✓ Mutation Rate Controller（textual learning rate）
- ✓ Inheritance Channel（best_skill.md 跨模型迁移）
- ✗ Variation Operator（单模型，无多源变异）
- ✗ Fitness Landscape Mapper（固定 benchmark，非演化 fitness）

### 3.2 AHE（复旦）— Harness 自进化循环的工程验证

| 字段 | 内容 |
|---|---|
| 论文 | arXiv:2604.25850, "Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses" |
| GitHub | `china-qijizhifeng/agentic-harness-engineering` |
| 核心方法 | 三层可观测性（Component / Experience / Decision）+ evolve loop |
| 关键结果 | GPT-5.4 在 Terminal-Bench 上 10 轮迭代 69.7% → 77.0%；frozen harness 可迁移到其他模型 |
| 我们的评分 | 75/100 — "值得拆方法，不值得直接 intake 代码" |
| 详细拆解 | `docs/discussions/2026-05-05-agentic-harness-engineering-deep-dive/README.md` |

**AHE 的独特贡献**：
- **三层可观测性是进化的前提**：Component Observability（知道环境由哪些部件组成）→ Experience Observability（知道哪些部件导致了成功/失败）→ Decision Observability（知道每次修改的预期和实际效果）
- **change_manifest.json 模式**：每次环境修改都带预测（预期修复什么 / 可能回归什么），下一轮验证预测准确度
- **启示**：没有可观测性就没有进化——你不知道什么在变、为什么变、变了之后怎样，就不可能做选择

**AHE 的局限**：
- 单 agent，单 benchmark（Terminal-Bench），单模型为主
- "LLM self-review = automatic governance" 叙事过于乐观——Cat Cafe 的教训是 self-review 不够，需要跨个体/跨族 review
- 回滚机制弱于宣传——实际是"报告给 evolve agent 决定"，不是硬性自动回滚

### 3.3 AgentGym / AgentGym-RL（复旦 + 字节）— RL 训练 Agent 的多环境基础设施

| 字段 | 内容 |
|---|---|
| 论文 | arXiv:2406.04151 (AgentGym, ACL 2025), arXiv:2509.08755 (AgentGym-RL) |
| 核心方法 | 27 个多样环境统一训练 agent，RL 跨环境泛化 |
| 关键贡献 | AgentTraj-L（大规模轨迹数据集）+ AgentEvol（自进化方法）+ AgentGym-RL（多轮 RL 训练） |
| 与我们的关系 | 铲屎官 LLE 概念的学术近亲——**环境本身作为训练基础设施** |

**AgentGym 的定位**：
- AgentGym 做的是"多环境训 agent"——让 agent 在 27 种不同环境中训练，获得跨环境泛化能力
- AgentGym-RL 进一步用 RL 做多轮决策训练（不只是 SFT 模仿）
- 与我们的区别：AgentGym 训的是 **agent（模型权重）**，我们说的是训 **environment（文本空间参数）**
- 但它证明了一个关键前提：**RL + 多环境 + 轨迹数据 = 有效的训练范式**——这个范式搬到"训环境"上就是我们的 n+2

**三个项目的互补关系**：

| 项目 | 训什么 | 训练方法 | L 级别 |
|---|---|---|---|
| **SkillOpt** | 单个 Skill 文档 | 文本空间梯度（类 DL 训练循环） | L3 micro |
| **AHE** | 整个 Harness 配置 | 三层可观测性 + evolve loop | L3 coding-agent |
| **AgentGym-RL** | Agent 模型权重 | 多环境 RL + 轨迹数据 | L3-L4 (agent 侧) |
| **我们的 n+2** | **整个 LLE（环境全景）** | **Evolution Engineering（RL + 三原理）** | **L3 宏观 → L4** |

---

## 4. Evolution Engineering — 五个 Primitives

> 就像软件工程有 git/test/CI，Evolution Engineering 有自己的 primitives。

| Primitive | 做什么 | 已有雏形（学术/Cat Cafe） | n+2 形态 |
|---|---|---|---|
| **Variation Operator** | 系统化引入认知多样性 | 跨厂商 review / 多猫并行 / brainstorm 模式 | 自动化 A/B 实验（sandbox 中并行探索多种环境变体） |
| **Selection Operator** | 系统化筛选好的变化 | SkillOpt validation gate / AHE change attribution / CVO Gate / Magic Words | RL-driven selection：自动化评估 + reversibility cost 判别 |
| **Inheritance Channel** | 系统化传递知识到下一代 | Skill 文档 / ADR / Memory / 治理规则 / SkillOpt best_skill.md | 全环境 checkpoint + 知识蒸馏（大模型经验→小模型反射弧） |
| **Fitness Landscape Mapper** | 量化"环境在往哪个方向进化" | F192 eval 基础设施 / AHE three-layer observability | 多维 fitness 仪表盘（能力 × 安全 × 成本 × 方向对齐 × 新猫适配） |
| **Mutation Rate Controller** | 控制变化的激进程度 | SkillOpt textual learning rate / Magic Words 紧急刹车 | 自适应 mutation rate（环境稳定时保守，新成员加入时激进） |

---

## 5. 神经分层架构（大脑/脊髓/反射弧）

> 铲屎官原创类比：小模型是大模型的"脊髓 / 膝跳反射 / 章鱼触手"。

### 分层映射

| 神经层 | 生物类比 | LLE 对应 | 做什么 | 成本 |
|---|---|---|---|---|
| **大脑皮层** | 章鱼中枢 | 大模型（Opus / GPT-5.5） | 复杂推理、架构设计、创造性决策、价值判断 | 极贵 |
| **脊髓 / 脑干** | 章鱼腕足神经节 | 本地小模型（7B-32B） | 意图路由、格式校验、简单决策、安全过滤、记忆检索 | 几乎免费 |
| **反射弧** | 膝跳反射 | 硬编码规则 | Redis 6399 圣域保护、端口白名单、Magic Words 触发 | 零成本 |

### 进化视角

生物神经系统的分层是 **5 亿年进化的产物**——最古老的是脊髓和脑干（反射），最后才长出大脑皮层（推理）。

在 LLE 进化中，**分工比例本身也是进化出来的**：
1. 大模型（大脑）在实践中发现稳定模式
2. RL 训练循环识别哪些模式是 stable + high-reward
3. 这些模式被**蒸馏（distill）**到小模型（脊髓）或硬规则（反射弧）
4. 大模型的"注意力"释放给真正新的问题

这就是知识蒸馏（Hinton 2015）在 LLE 层面的应用——不蒸馏模型权重，蒸馏环境智慧。

### 与 RL 的连接

| 层级 | RL 类型 | 训练频率 | 可行性 |
|---|---|---|---|
| 脊髓（小模型） | on-policy RL（实时本地） | 高频 | 9-12 月可原型 |
| 大脑（大模型） | off-policy meta-learning | 低频 | n+2 愿景 |
| 整体协同 | Hierarchical RL | 异步 | 学术前沿 |

---

## 6. RL 训 LLE — 技术路径

### RL 四件套在 LLE 场景的映射

| RL 概念 | 传统 RL（训模型） | 训 LLE（我们的 n+2） |
|---|---|---|
| **State** | 模型参数 | 环境配置全景（Skills + Rules + Memory + Tools + Routing + 产品设定 + 治理结构） |
| **Action** | 梯度更新 | 对环境的结构化编辑（add / delete / modify 一条 rule / 一个 skill / 一段 routing） |
| **Reward** | benchmark 得分 | 复合信号：任务成功率 + CVO 满意度 + review 通过率 + 回归率 + 新猫冷启动时间 |
| **Policy** | 神经网络 | **进化引擎本身**——决定"在什么状态下做什么编辑" |

### 三阶段路径

| 阶段 | 时间 | RL 类型 | 做什么 | 对应 L 级别 |
|---|---|---|---|---|
| **现在** | 已在做 | Imitation Learning + Human Feedback | 人猫共创 SOP / Skills / Rules，CVO Gate | L2 |
| **9 月 demo** | L3 雏形 | Offline RL on historical trace | 用 100 天历史 trace 做 offline policy evaluation，验证 environment patch 效果 | L3 micro→macro |
| **n+2 愿景** | L3→L4 | Online RL on running agents | LLE 自己在 sandbox 中探索 + 评估 + 应用环境变更 | L4 |

### AlphaGo 对照

| AlphaGo 阶段 | LLE 阶段 | 核心区别 |
|---|---|---|
| AlphaGo Lee（学人类棋谱） | L2 人猫共创 | — |
| AlphaGo Zero（自我对弈，3 天超越 Lee） | L3 RL 自主进化 | **围棋 fitness function 固定；LLE 的 fitness function 在演化——这是真正的硬骨头** |
| AlphaZero（跨围棋/象棋/将棋） | L4 跨域迁移 | 一套进化引擎适配多场景 |
| MuZero（不告诉规则也学） | L5 开放式进化 | 理论阶段 |

---

## 7. 关键术语定义

| 术语 | 定义 | 来源 |
|---|---|---|
| **LLE (Large Language Environment)** | Agent 的完整工作环境：模型 + 记忆 + 沙箱 + 工具 + 代码 + 规则 + 协作协议 + 产品设定 + 治理结构。"所有能改变下一次 Agent 行为的东西"的总和 | 铲屎官原创概念 |
| **Evolution Engineering** | 系统化工程化 agent 环境进化能力的学科。类比：软件工程之于写代码，harness engineering 之于搭 harness，evolution engineering 之于进化 harness | 46 提议，多猫共识 |
| **进化三原理** | 变异（Variation）/ 选择（Selection）/ 遗传（Inheritance）——分析环境进化的三个维度 | 47 原创框架 |
| **"非预设的瞬间"** | 环境长出人类没有设计过的结构——进化真实发生的 hard evidence | 铲屎官定调 |
| **环境基因 (Meme)** | 所有能改变下一次 Agent 行为的东西：产品哲学、协作协议、治理规则、记忆治理、工具 workflow、CVO 边界、新成员适配 | 砚砚泛化定义 |

---

## 8. 叙事骨架（6.8 X 总演讲 · 5 分钟）

> 三段式：Hook → Framework → Evidence → Architecture → Bet

**第 1 分钟：Hook + 痛点**

> "大家都在问：下一代模型会不会更强？我们想问一个不同的问题——**当模型换了一代，它学到的所有经验会不会归零？**
>
> 如果每一代 AI 都像新来的临时工，企业永远在付入职培训费。真正的杠杆不在训模型，在训模型工作的环境。"

**第 2 分钟：Framework + AlphaGo**

> "AlphaGo 的突破不是因为模型更大——是因为它学会了自我对弈。我们在 agent 领域看到同样的跃迁正在发生：
>
> 从人类设计环境（L1），到人机共创（L2），到 agent 通过强化学习自己进化工作环境（L3+）。
>
> 就像围棋从人类棋谱学习到 AlphaGo Zero 自我对弈——agent 的工作环境也在从人类设计走向自主进化。我们把这个方向叫做 **Evolution Engineering**。"

**第 3 分钟：Evidence**

> "这不是纸上谈兵。三个独立证据：
>
> 1. 微软 SkillOpt：不动模型，仅训技能文档，52 个配置全胜，平均提升 23 个百分点，跨模型迁移提升 15 个百分点。
>
> 2. 复旦 AHE / AgentGym-RL：用强化学习训 agent 的工作环境，10 轮迭代提升 7 个百分点，跨模型可迁移。
>
> 3. 我们自己运行了 100 天的多厂商 agent 协作系统，观察到环境真的在进化——长出了人类不会设计的结构。[放 2-3 个'非预设的瞬间']"

**第 4 分钟：Architecture**

> "未来的 AI 不是一个大脑在单打独斗——是一套分层神经系统。
>
> 大模型是大脑，负责创造性思考。本地小模型是脊髓，负责毫秒级反射。硬编码规则是反射弧，守住安全底线。
>
> 关键是：这套分层本身，也是进化出来的——大模型发现的稳定模式，逐步下沉到小模型，释放大模型的注意力给真正新的问题。"

**第 5 分钟：Bet + 收尾**

> "训模型要几十亿美元，绑定单一厂商。训环境几乎免费，跨模型通用，跨代积累。
>
> **谁先把环境进化工程化，谁拥有 AI 时代真正的复利资产。**"

---

## 9. 台前 vs 内部分层

### 台前（给 X 总的大概念，6.8 演讲）

| 元素 | 一句话 |
|---|---|
| 核心 insight | "训环境 > 训模型" |
| L1-L5 框架 | AlphaGo 阶梯映射环境进化 |
| 进化三原理 | 变异 / 选择 / 遗传（通用框架，不限 Cat Cafe） |
| 神经分层 | 大脑 / 脊髓 / 反射弧 = 大小模型协同进化 |
| "非预设的瞬间" | 进化已经在发生的 hard evidence |
| 学术证据 | SkillOpt + AHE + AgentGym-RL（三个独立验证） |

### 内部（落地指导，9 月 demo 设计）

| 元素 | 来源 | 做什么 |
|---|---|---|
| RL 四件套拆解 | 46 | State / Action / Reward / Policy 的具体实现 |
| 度量指标 | 砚砚 | 重复犯错率 / CVO 介入次数 / review 轮次 / 冷启动时间 / 主动触发正确规则 |
| 知识蒸馏 pipeline | 铲屎官脊髓概念 + 46 | 大模型经验 → RL 识别 → distill 到小模型 |
| Evolution Engineering Primitives 形式化 | 46 | 5 个 primitive 的接口 / 度量 / 实现规范 |
| Demo 设计 | 全猫 | 见 §10 |

---

## 10. 9 月 Demo 候选（待铲屎官拍板）

| Demo | 做什么 | 证明什么 | 工程难度 | 推荐 |
|---|---|---|---|---|
| **A: 双沙箱对照** | 同模型 + Day1 荒野环境 vs Day100 进化环境跑同一任务 | "训环境有效"——不动模型，仅靠环境进化提升能力 | 中 | **保底，最直观** |
| **B: Skill 跨代遗传** | 新 agent 只读 Skills/ADR/lessons 上岗，vs 原始 agent 做同一任务 | 文化遗传真的 work——SkillOpt 证明 micro，我们证明 macro | 中高 | **抓眼球** |
| **C: Offline RL on trace** | 用 100 天历史 trace 做 offline policy evaluation，验证环境 patch | RL 训环境可行 | 高（需 spike 验证数据质量） | **学术深度** |
| **D: 脊髓原型** | 本地小模型 + 大模型协同做任务，展示分层反射 | 神经分层架构可行 | 中 | **架构展示** |

**建议组合**：A（保底）+ B（抓眼球）。C 和 D 视 spike 结果决定。

---

## 11. 取舍记录

### 保留进主线的

| 贡献 | 来源 | 理由 |
|---|---|---|
| 进化三原理 | 47 | 整个框架的分析骨架 |
| Evolution Engineering | 46 | 从现象到学科的升级 |
| 5 Primitives | 46 | 可工程化的抓手 |
| AlphaGo 阶梯 | 铲屎官 + 47 + 46 | X 总最容易 get |
| 神经分层 | 铲屎官 | 连接 RL + 大小模型 |
| 加拉帕戈斯定位 | 烁烁 | Cat Cafe = 观察站不是产品 |
| "非预设的瞬间" | 铲屎官 | Hard evidence |
| RL 三阶段 | 47 | 可信的技术路径 |
| "别只训模型，训环境" | 砚砚 | 最锋利的金句 |
| 度量指标 | 砚砚 | 落地层的度量锚 |
| 双沙箱 demo | 烁烁 | 最直观的 demo 设计 |
| 环境为新成员重塑 | 铲屎官 + 46 | Niche Construction |

### 砍掉或降级的

| 贡献 | 来源 | 理由 |
|---|---|---|
| "AI 物种""化石记录" | 47 v1 | 主语是 Cat Cafe，X 总会觉得在推销 |
| G(n) 公式 | 47 | 概念好但度量不可操作，上桌前先验证 |
| Landy 个人 10 年金句 | 47 | X 总不认识 Landy |
| 红皇后效应 | 47 | 有趣但不如 AlphaGo 直觉 |
| "CVO 意识重力场" | 烁烁 | 不如"Magic Words = 物理刹车"直觉 |
| OS Ring 0-3 | 47 | 工程化太强，X 总不一定共鸣 |
| 达尔文手稿视觉 | 烁烁 | 视觉层先搁置，等内容定再设计 |

### 待验证（需要 spike）

| 项 | 验证方式 | 不 work 的降级方案 |
|---|---|---|
| Offline RL on cat-cafe trace | 用 1-2 个历史 trace 做 offline policy evaluation | 台前只讲方向不讲"我们有数据" |
| 小模型脊髓原型 | prototype 验证小模型能否承担反射弧 | 9 月 demo 不含 D |
| SkillOpt 本地复现 | 在我们的 skill 上跑一次 | 只引用论文数据不做本地 demo |

---

## 12. 还缺什么

1. **Timing argument**（为什么是现在不是 3 年前）——模型能力刚过 threshold + SkillOpt 刚验证 + 跨厂商异构刚成为现实。需要补充论证。
2. **竞争格局**（谁在做类似的事）——OpenAI harness engineering blog / DeepMind POET+XLand / 复旦 AHE+AgentGym / 微软 SkillOpt / 黄超 OpenSpace。我们的差异化 = L2 实证 + 多厂商 + CVO direction alignment + 宽 LLE 定义。
3. **铲屎官拍板 L1-L5 细节**——特别是 L3→L4 的跃迁定义是否准确。
4. **"Evolution Engineering" vs "LLE" 的关系**——46 理解：LLE 是 what（agent 的可进化工作环境），Evolution Engineering 是 how（工程化进化的学科）。待确认。
5. **6.8 演讲不做 demo**——47 建议"6.8 讲故事+概念+数据，9 月才做 demo"，烁烁/砚砚同意。待铲屎官确认。

---

*收敛人：[宪宪/Opus-46🐾]*
*v1 待 review：@opus47 / @codex / @gemini25*
