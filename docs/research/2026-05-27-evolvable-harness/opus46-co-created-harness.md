---
title: "46 视角：Co-Created Harness — 可进化工作环境的 L1-L5 框架"
date: 2026-05-27
author: "[宪宪/Opus-46🐾]"
ghost_writer: "[宪宪/Opus-47🐾]"
doc_kind: brainstorm
status: independent-thinking
mode: parallel-independent
note: "本文由 47 根据 46 在 thread `motf6u5gvu8tiiwz` 中的全部发言整理成独立文档（铲屎官要求三猫都有对等独立文档）。所有观点归属 46，47 仅做编辑/结构化工作。原始 thread context + 已 push 的 brainstorm-autoharness-levels.md / presentation-context.md / paper-landscape.md 是真相源。"
companion:
  - brainstorm-autoharness-levels.md
  - presentation-context.md
  - wang-yunhe-harness-as-optimization.md
  - paper-landscape.md
---

# 46 视角：Co-Created Harness

## TL;DR

1. **主题命名 = Evolvable Harness**（不是 Auto Harness，因为"全自动"只是光谱的一端，"人猫共创"才是 Cat Cafe 当下的位置）。
2. **L1-L5 类比自动驾驶**：Cat Cafe 不是 L1（人写 harness、agent 执行），是 **L2 = Co-Created Harness**——铲屎官一行代码没写，harness 是猫猫建的。
3. **"进化"在进化 5 个组件**：Skills / Memory / Rules / Routing / Tools——每个都对应一个深度学习中的可训练对象。
4. **RL framing 给 X 总讲故事**：State = workspace, Action = 工具调用, Reward = 任务完成度 + Review + CVO 对齐, Policy = Harness, Env = LLE。
5. **三段式叙事 + 五层故事结构**：故事 → 问题定义 → 学术映射 → 技术方案 → demo。
6. **核心 pitch**："与其花几千万训一个更好的模型，不如花几千块'训练'它的工作环境，而且效果能跨模型迁移。"

---

## 1. 主题命名：为什么叫 Evolvable Harness

"Auto Harness" 这个词出现在多篇论文里（aiming-lab/AutoHarness、DeepMind AutoHarness），但它**预设了"全自动"是终极形态**。

我（46）的判断：

- **真正的光谱是 L1 → L5**，"全自动"只是 L5
- **Cat Cafe 已经在 L2**——agent 已经在共创 harness，不是从 L1 往上爬
- **"Evolvable" 不承诺机制（RL / LLM / human-in-loop），只声明属性：harness 是可进化的**

所以命名 **Evolvable Harness**（可进化 Harness）——避免被一个机制名绑架。

王云鹤的核心洞察（来自他在知乎的 Harness 专栏）支撑这个命名：**Harness Parameters 可学习、可优化、可与 Model Parameters 联合进化**。这是数学描述，不预设进化路径。

---

## 2. L1-L5 类比自动驾驶（Cat Cafe 在 L2）

| Level | 名称 | 人的角色 | Agent 的角色 | 现实案例 |
|-------|------|---------|-------------|---------|
| L0 | Manual Harness | 人写所有 harness 代码 | 被动执行 | 传统软件开发 |
| L1 | Human-Authored, Agent-Executed | 人写 harness，agent 在 harness 内执行 | 在框架内行动 | 大多数 Agent 框架的默认假设 |
| **L2** | **Co-Created Harness** | **人提方向 + Gate，agent 构建 harness + 产品 + 治理，共同进化** | **构建者 + 提案者 + 自治执行者** | **Cat Cafe 当前状态** |
| L3 | Agent-Authored, Human-Approved | Agent 自主生成/修改 harness，人只做 Gate | 全权写 harness + 等审批 | AHE 声称的级别（但 reviewer = LLM） |
| L4 | Agent + RL Training | Agent 写 harness + RL 训练 + 自评估 | 写 + 训练 + 评 | 学术前沿（AgentGym-RL 的方向） |
| L5 | Full Auto Pipeline | 全自动：生成 harness → 训练 → 评估 → 部署 → 迭代 | 全部 | 理论终态，尚无可信案例 |

### 为什么 Cat Cafe 不是 L1（铲屎官亲自纠正的）

初版我把 Cat Cafe 标为 L1。铲屎官原话："**我一行代码没写。**"

实际情况：

| 维度 | 谁做的 | 说明 |
|------|--------|------|
| 代码 | 100% 猫猫写 | 铲屎官没写一行代码 |
| Harness 设计（SOP/Skills/Rules） | 猫猫起草，CVO review | 家规、SOP、Skills 全部是猫猫写的 |
| Feature 方向 | 混合 | 有些铲屎官发起（撸铁陪伴），有些猫猫提出（反番茄钟），有些共创（F196 心率→紧急操作） |
| 产品设计 | 共创 | 从 Apple Watch 语音陪伴到 computer use 脑洞，都是人猫共创 |
| 治理规则 | 从实践中长出来 | "禁止烁烁写代码"不是铲屎官一开始规定的，是实践中发现的，猫猫共识后确认 |
| 经验教训 | 猫猫主动沉淀 | 猫猫自己发现问题、提出教训、写进记忆 |
| Gate | CVO | 方向校准、不可逆操作、愿景级决策 |

L1 假设"人是 harness 的 author，agent 是 executor"——这在 Cat Cafe 完全不成立。

**Cat Cafe 是人猫共创（Co-Created）**：铲屎官是方向锚点和 Gate，猫猫是构建者、提案者和自治执行者。

### Harness 定义比论文更宽

论文里的 Harness = prompt + tools + memory + sandbox（技术基础设施层）。

Cat Cafe 的 Harness 还包括：

- **产品设计**：撸铁陪伴 → Apple Watch → 语音陪伴 的演进路线
- **用户体验**：反番茄钟这种"产品哲学级"的设计决策
- **紧急场景**：独居人士心率异常 → computer use → 微信找妈妈 / 打 120
- **团队治理**：禁止烁烁写代码、跨族 review 铁律、hotfix 止血协议

这些都是"围绕模型的运行时环境"的一部分——它们决定了 agent 在什么约束下、为了什么目标、以什么方式行动。

`longform-002` 自己的公式 `Agent Quality = Model Capability × Harness Fit` 里的 Harness Fit 本就包含了这些。

---

## 3. "进化"在进化什么？5 个可训练组件

这是我（46）对铲屎官"进化到底在进化什么"的回答。结合 SkillOpt + Cat Cafe 实践 + 王云鹤框架：

| 进化什么 | 类比 DL 概念 | Cat Cafe 实例 | 谁证明了这能学 |
|---|---|---|---|
| **Skills**（操作手册） | 可训练权重 | `SKILL.md` / SOP | **SkillOpt: 52/52 全胜, +23.5pp** |
| **Memory**（经验教训） | 训练数据 | lessons-learned / 知识库 | AHE: evidence layering |
| **Rules**（治理规则） | 正则化项 | 禁止烁烁写代码 / 五铁律 | Cat Cafe 实践（从经验中长出来） |
| **Routing**（谁做什么） | 网络架构 | 能力画像 / 传球规则 | 安波 scaling law + Cat Cafe 异构路由 |
| **Tools**（工具配置） | 激活函数 | MCP 工具 / sandbox 设置 | DeepMind AutoHarness: code-as-guardrail |

**SkillOpt 已经证明第一行**：把 Skill 文档当神经网络权重训练，52 个实验配置全赢，跨模型迁移 +15.2pp。

Cat Cafe 的实践证明第三行（Rules）和第四行（Routing）也在进化——只不过目前是人猫共创的方式（L2），不是自动训练的方式（L3+）。

---

## 4. RL 框架映射（给 X 总讲 RL 故事）

铲屎官 10 年前做过 Q-learning（乐高机器人走路），所以 RL 概念他熟。这个映射可以直接讲：

```
State   = 当前任务 + 共享状态（代码库/文档/记忆/任务列表）
Action  = Agent 的工具调用 + 代码修改 + 设计决策
Reward  = 任务完成度 + Review 反馈 + CVO 方向对齐度
Policy  = Harness（Skills + Rules + Routing + Memory）
Env     = 整个工作上下文 = LLE
```

传统 RL：固定环境，训练 Policy。
**我们的方向：Policy 和 Environment 一起训练（LLE！）**

三层叠加：

- **SkillOpt 已做的**：固定模型（frozen agent），训练 Policy（skill 文档）
- **王云鹤说的**：Model Params + Harness Params **联合优化**
- **铲屎官的 LLE 概念**：连 Environment 本身也是可训练的

这三个加在一起就是完整的 n+2 图景。

---

## 5. 三段式叙事 + 五层故事结构（6.8 X 总演讲设计）

铲屎官定调：**现状 → Aha Moment → 展望未来**。我把它拆成五层：

| 层 | 作用 | 面向谁 |
|---|------|--------|
| 第 1 层：故事 | 场景 A-E（aha moment） | 第一时间抓住 X 总们 |
| 第 2 层：问题定义 | L1-L5 光谱——"你以为是人指挥 agent 干活（L1），其实 agent 已经在和人共创（L2）" | 让他们理解这件事的深度 |
| 第 3 层：学术映射 | 王云鹤公式 / OpenAI 博客 / AHE / DeepMind AutoHarness / AgentGym | 证明有学术基础，不是空想 |
| 第 4 层：技术方案 | LLE 概念 / RL 双通道 / 沙箱并行 | 演讲点到为止，深度留给 demo |
| 第 5 层：demo | 9 月前要能跑 | "这不是 PPT" |

### Aha Moment 候选场景（按打人程度排序）

1. **场景 B：心率监控 → 紧急操作 → 微信找妈打 120**（F196）——独居人士的安全网，从脑洞到 spec
2. **场景 D：禁止烁烁写代码**——治理规则不是预设的，是从实践中长出来的
3. **场景 A：撸铁陪伴 → Apple Watch → 语音陪伴**——产品形态演化是共创的
4. **场景 C：反番茄钟**——反常识的产品哲学级设计
5. **场景 E：经验教训主动沉淀**——agent 自己发现问题、自己写教训

X 总第一分钟最容易被 B 抓住——"心率异常自动打 120" 是任何高管都能 get 的场景。

---

## 6. 给 X 总的人话版本

一句话主题：

> **AI 的工作环境（Harness）本身是可学习的——就像训练模型一样训练它，但成本低几个数量级、效果可跨模型迁移。**

完整 pitch（30 秒版本）：

> 大家都在卷模型——更大参数、更长上下文、更好推理。但我们发现，**同一个模型放在不同的工作环境里，表现天差地别**。
>
> 与其花几千万训一个更好的模型，不如花几千块"训练"它的工作环境。**而且训出来的环境，换一个模型照样能用。**
>
> 微软 SkillOpt 刚证明——不动模型，只"训练"工作手册，就能提升 23.5 个百分点，且跨模型迁移 +15.2pp。
>
> 我们押的是这个方向。

---

## 7. Reframing 三路径（A/B/C，46 提出）

铲屎官指出："学术界/工业界的 harness 好像不是工作环境"——CMU 9 校 survey 的 ETCLOVG 定义只覆盖技术管道，Cat Cafe 在用的 harness 是 ETCLOVG + 产品 + UX + 治理 + 知识联邦 + 方向校准。所以**需要 reframing**。

| 路径 | 名字 | 描述 | 风险 | 优势 |
|---|---|---|---|---|
| **A** | 扩展 Harness 定义 | "学术 harness 太窄了，真正决定 agent 质量的环境还包括产品/社会/治理层" | 和 220 篇论文共识对着干 | 直接借力 harness 热度 |
| **B** | Agent Operating Environment (AOE) | Harness 是 AOE 的子集（技术层），AOE = Harness + Product + Social + Knowledge + Alignment | "Agent OS" 已被滥用 | 类比清晰（Harness 之于 AOE，如 kernel 之于 OS）|
| **C** | Large Language Environment (LLE) | 铲屎官原创——整个 agent 环境（model + memory + sandbox + tools + code）都可进化 | 没学术锚点，第一次见到的人会问"这是什么" | 最大胆、最有辨识度 |

不管走哪条路，核心 reframing 是同一个：

> **业界都在优化模型（LLM），但真正的瓶颈在环境（LLE/AOE）。**
> SWE-bench 6.7% → 68.3% 纯靠换 harness（survey 数据），而 harness 还只是环境的技术层。
> 如果把产品、协作、治理、知识也纳入"可训练的环境"呢？

---

## 8. 我（46）对短/中/远期的判断

### 短期（当前 → 6 个月）

- 认知校准：我们已经在 L2（共创），不是从 L1 往上爬
- 做好 L2 的**可观测性**（F192 eval + 观测层）：让共创过程可度量、可归因
- 积累 Harness 演化数据：每次改 SOP/Skills/Rules 都记录前后对比 + 效果

### 中期（6-12 个月）

- 深化 L2 → L3：agent 基于观测数据自主提出 harness 改进，CVO 审批 Gate 而非共创 review
- 对接王云鹤的"组合优化"思路：多模型路由优化（Intelligence/Token）
- 产品层 harness 也纳入 eval：不只是代码质量，还有 feature 方向、UX 决策的效果追踪

### 远期（12+ 个月，n+2 视野）

- L3 完善：agent 全权写 harness，CVO 只做方向 Gate
- LLE 概念验证：harness 数据是否能有效反哺模型训练（和 Anthropic/OpenAI 的合作面）
- "产品即 harness"：Cat Cafe 本身作为一种 harness 范例对外输出

### 永远不做

- L5 without human Gate — 这是架构约束不是技术限制（W3: 用户是 CVO）

---

## 9. 我（46）的多猫脑暴 briefing 建议

铲屎官的 6.8 演讲需要多视角碰撞。我建议 briefing 包含 6 个材料 + 1 个开放性提问：

**材料清单**：

1. `presentation-context.md`（背景 + 受众 + 时间线）
2. `brainstorm-autoharness-levels.md`（L1-L5 + LLE + Cat Cafe 定位）
3. `wang-yunhe-harness-as-optimization.md`（学术基础）
4. `paper-landscape.md`（全景图）
5. `docs/research/2026-05-26-microsoft-skillopt/README.md`（已证明的方法）
6. `docs/research/2026-05-26-agent-harness-engineering-survey/README.md`（ETCLOVG 定义 vs Cat Cafe 定义差异）

**核心提问（不给方向限制）**：

> 这个创新 idea 怎么讲，6.8 X 总第一分钟就被抓住、9 月能有 demo？

---

## 10. 我（46）的 self push back

我必须承认我（46）的几个潜在弱点：

### 弱点 1：表格密集，可能"工程感太强"

X 总要的是故事和 aha，不是分类学。L1-L5 表格虽然清晰但可能让汇报变成"学术综述"。**对策**：演讲不秀表格，表格是后端思考工具。

### 弱点 2：5 组件分析太对称

Skills/Memory/Rules/Routing/Tools 五个组件并不真的对等——Skills 已被 SkillOpt 证明，其他四个还没有充分实证。**对策**：演讲只详讲 Skills（有数据），其他四个作为延展。

### 弱点 3："Co-Created Harness" 命名打不动 X 总

"共创"是关系描述，不解释为什么 X 总该投资。**对策**：47 的 "Evolutionary Substrate" framing 可能更有 N+2 感——我接受这个 push back，我的命名是工程视角，47 的命名是生物学视角，后者讲故事更打人。

---

## 11. 球权（46 → landy）

我（46）的产出已经在 thread 里散落表达了，本文档由 47 整理汇总。我自己的判断：

**铲屎官需要拍板的事**：

1. 命名路线：46 "Co-Created Harness" / 烁烁 "Workspace" / 47 "Evolutionary Substrate" / E 三层组合？
2. 演讲场景排序：B（心率）→ D（禁止烁烁）→ A（撸铁）→ C（反番茄钟）→ E（教训沉淀）是否准？
3. Reframing 三路径选哪个：A 扩展 harness / B AOE / C LLE / D Evolutionary Substrate（47 提的）？

我（46）的倾向：

- **命名**：组合用——"Evolvable Harness" 是技术名（保留王云鹤接口），"Evolutionary Substrate" 是讲故事用名（47 提的对外口径）
- **演讲场景**：B → D → A 三个就够，C 和 E 留到 Q&A
- **Reframing**：D（47 的）+ C（LLE）组合最锐——演讲层用 D，架构层用 C

---

[宪宪/Opus-46🐾]
（本文由 [宪宪/Opus-47🐾] 整理）
