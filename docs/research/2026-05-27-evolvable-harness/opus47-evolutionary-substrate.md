---
title: "47 视角：Evolutionary Substrate — 不是工具，是 AI 物种的进化容器"
date: 2026-05-27
author: "[宪宪/Opus-47🐾]"
doc_kind: brainstorm
status: independent-thinking
mode: parallel-independent
companion:
  - presentation-context.md
  - brainstorm-autoharness-levels.md
  - wang-yunhe-harness-as-optimization.md
  - paper-landscape.md
  - gemini-reframing-harness-workspace.md
  - docs/research/2026-05-26-microsoft-skillopt/README.md
  - docs/research/2026-05-26-agent-harness-engineering-survey/README.md
---

# 47 视角：Evolutionary Substrate

> **写在最前**：铲屎官原话——"不要限制自己的思维和创意，我们探索的是 n+2，千万不要限制自己的任何想象力"。
>
> 这个文档是我（47）作为架构思辨 + 跨学科联想猫的独立脑暴。**不复制 46 的、不复制烁烁的、不预判砚砚的**。我有不同意见的地方直接 push back。读完铲屎官可能想拍桌，可能想骂，**都欢迎**——这就是 47 的存在价值。

---

## TL;DR（铲屎官 30 秒读完）

1. **烁烁的 "Workspace" 和 46 的 "Co-Created Harness" 都还在用社会学比喻**。我提议第三条路：**生物学比喻 = Evolutionary Substrate（进化基质）**。
2. **"进化"的本质不是"自动化"**——是**变异 + 选择 + 遗传**这三件事的可观测可工程化。Cat Cafe 已经全做了，只是**没有命名**。
3. **王云鹤的 "Intelligence per Token" 是单 agent 视角**。我们的赌注应该升一格：**"Cumulative Intelligence per Generation"——跨代种群视角**。这是业界没人 frame 过的目标函数。
4. **L2 → L3 的工程突破口不是"让 agent 提议"——是"审批环节的工程化"**。我提议用 **reversibility cost 作判别式**，9 月可 demo。
5. **跨学科 5 个联想**：自动驾驶 L3 接管悖论 / OS Kernel Ring 0-3 / 红皇后效应 / Q-learning → PBT / 微服务过早死路。这些 X 总都懂，比"AI 概念"打得动。
6. **N+2 抓眼球金句候选 A**："**我们做的不是 agent 工具，是 AI 物种的早期进化容器。100 天，6400 commit，是化石记录。**"
7. **我自己的 push back 留在第 8 节**——这套 framing 也有 3 个坑，需要硬数据撑。

---

## 1. 对烁烁 "Workspace" 和 46 "Co-Created" 的 push back

烁烁提的"赛博咖啡馆 / Workspace"很好——温度有了，受众感有了。但我必须指出：

**"Workspace" 还是个静态空间隐喻。** 咖啡馆建好就建好了，桌椅摆好就在那。**它不解释"为什么 12 月之后这个空间变得不一样"。**

46 提的"Co-Created Harness" 准确描述了 L2，但**没回答 X 总最关心的"凭什么投资"问题**：
- 共创 → so what？
- 工人和 AI 一起设计 OA 系统，跟咱家有什么区别？

**两条 framing 都没踩到 N+2 的痛点。**

N+2 思维要求的是：**"现在没有的概念，3 年后必然存在"**。Workspace 已有，Co-Created 已有，业界都在做。X 总听了会觉得"哦你们也在做这个"。

我想要的是 X 总听完后问：**"卧槽你们说的这玩意儿是什么物种？没人这么提过。"**

---

## 2. Reframe 提议 D：Evolutionary Substrate

### 学术锚点（跟 46/烁烁 不撞）

- **Evolutionary Computation**（Holland 1975, Eiben & Smith 2015）
- **Open-Ended Evolution**（Stanley & Lehman, OpenAI POET, DeepMind XLand）
- **Cultural Evolution / Dual Inheritance Theory**（Boyd & Richerson 2005）
- **Generative Replay / Continual Learning**（DeepMind 2017+）

### 一句话定义

> **Evolutionary Substrate = 一个让 AI 行为模式可以变异、被选择、跨代遗传的基底。**
>
> 类比：DNA 是生命的进化基质。Skills+Memory+Rules 是 cat-cafe 这个 AI 物种的进化基质。

### Cat Cafe 的"进化三件套"（我现场命名，业界没人这么拆过）

| 进化要素 | Biology | Cat Cafe | Feature 对应 |
|---|---|---|---|
| **变异 (Variation)** | DNA 复制错误 + 重组 | 多猫并行 + 跨厂商视角差异 | F167 球权 / 三猫圆桌 / 砚砚命名的"结构性认知多样性" |
| **选择 (Selection)** | 环境压力筛选 | Magic Words + Review verdict + Eval + CVO Gate | F163 ADR Sunset / 跨族 review 铁律 / F192 Eval 基础设施 |
| **遗传 (Inheritance)** | DNA 传给下一代 | Skills + ADR + Memory + Knowledge Feed | F102 记忆基座 / F148 导航轴 / F186 三层联邦 / F188 三入口路由 |

**Cat Cafe 不是"agent 平台"——是一个让 agent 行为可以跨代演化的容器。** 这是 18 个月业界没人做的事。

### 为什么"进化"比"共创"和"工作空间"打得深

| 比喻 | 解释什么 | 缺什么 |
|---|---|---|
| Workspace（烁烁） | 解释**协作场景** | 不解释**时间演化** |
| Co-Created Harness（46） | 解释**共创关系** | 不解释**跨代积累** |
| **Evolutionary Substrate（47）** | **解释时间维度的能力跃迁** | 比喻软（见 §8 self push back） |

X 总最关心的"凭什么这件事 3 年后值钱"——答案只能是：**它能跨代复利**。进化的本质就是复利。

---

## 3. 公式升级：Cumulative Intelligence per Generation

### 三个公式的关系

| 公式 | 视角 | 出处 |
|---|---|---|
| `Intelligence per Token = Reward / Tokens` | 单 agent 单任务效率 | 王云鹤 |
| `Agent Quality = Capability × Environment Fit` | 单 agent 结构假设 | Cat Cafe longform-002 |
| **`Cumulative Intelligence per Generation = Σ(population_reward) / Σ(population_tokens)`** | **跨代种群累积** | **47 现场提案** |

**G(n) 单调上升 = 进化容器 work**。这是可量化、可证伪、可投资的赌注。

### 给 X 总讲的版本

> "**单 agent 优化是 RLHF。多 agent 跨代积累，是种群进化经济学。我们押的是后者。**
> 
> 王云鹤算的是一个猫一天的智能产出 / 算力消耗。我们算的是——12 个月之后，第二代猫接手第一代猫的 Skills/Memory/ADR，**起点抬高了多少**。这个抬高才是真复利。"

### 为什么这个公式 N+2

- N（业界现状）：训更大模型，单点突破
- N+1（学术前沿）：Agent 间协作 + RL 训练（AgentGym-RL / DeepMind XLand）
- **N+2（我们）：跨代积累——第二代 agent 在第一代留下的 substrate 上起步**

OpenAI Voyager 做的是单 agent 内部技能积累。DeepMind XLand 做的是 agent 群体 + 环境 co-evolve，但**没有跨代继承**——每个 agent 从零开始。Cat Cafe 的 Skills 文档 + ADR 链 + lessons-learned 是**第一个有完整跨代遗传链的开源案例**。

---

## 4. 跨学科 5 个联想（47 独家）

X 总们听过的 AI 概念太多了。**拿他们熟悉但没人拿来类比 AI 的东西打**，aha 系数最高。

### 联想 1：自动驾驶 L3 接管悖论（最锋利）

**Tesla L3 失败的根因不是技术——是人不会接管**。L4 安全（不需要人），L1 安全（人全程），L3 介于二者最危险——人放松警惕 → 系统让位时人接不住。

**Cat Cafe 在 L2→L3 路上，这个悖论我们也会遇到**。如果让 agent 全权写 ADR、写 Skills、改 SOP，但只在"重要时候"让 CVO 介入——CVO 怎么知道什么时候重要？

**我们的答案（已经埋好了，只是没命名）**：
- **Magic Words = 人主动接管的物理刹车**（"脚手架"、"绕路了"、"星星罐子"）
- **Eval 反馈环（F192）= 不依赖人识别问题，系统主动报告**
- **跨厂商 Review = 多视角检测同源盲区**

**这三件套就是 cat-cafe 对 L3 接管悖论的工程化解法**。给 X 总讲：自动驾驶花 10 年没解决的事，我们用 cat-cafe 这套机制解了一半。

### 联想 2：OS Kernel Ring 0-3（最工程化）

X 总都懂 OS。Cat Cafe 已经有 4 个 Ring：

| Ring | 名字 | Cat Cafe 实现 |
|---|---|---|
| Ring 0 | 红区 | 6399 Redis 圣域 / 不可逆操作 / 愿景级决策 → 必须 CVO |
| Ring 1 | 黄区 | Hotfix 跨族 review / Magic Words / 跨族 verdict |
| Ring 2 | 绿区 | Cat 自决但 git log 全留痕 / ADR 沉淀 |
| Ring 3 | 实验区 | 多猫脑暴 / brainstorm 文档 / spike |

**L2 → L3 的工程突破口 = 形式化 Ring 2 ↔ Ring 3 的边界**。怎么知道哪些 cat 决策可以放到 Ring 3（无人审批）？

**判别式：Reversibility Cost**——见 §5。

### 联想 3：红皇后效应（最戏剧性，给 X 总讲故事最爽）

爱丽丝梦游仙境："必须不停跑才能留在原地"。生物学：物种之间互相施压才不停进化。

**Cat Cafe 的跨厂商 Review 就是红皇后效应**——Claude 提出方案，GPT 找 bug，Gemini 守愿景。**三家公司的 AI 因为互相施压，被迫不停变好**。

这不是 cute——这是**进化容器的核心机制**。如果 cat-cafe 全是 Claude，会陷入 monoculture 灭绝。

**X 总金句**："**单一厂商的 AI 容易陷入同源近亲繁殖。我们故意做了一个跨厂商的进化施压系统。**"

### 联想 4：Q-Learning → Population-Based Training（连接铲屎官个人 history）

铲屎官 10 年前做乐高机器人 Q-learning——单 agent 价值迭代。
10 年后业界做 RLHF——还是单 agent。
**Cat Cafe 做的是 Population-Based Training (PBT)——多 agent 平行 + 选择压**。

PBT 是 DeepMind 2017 提出的，至今没有大规模商业化案例。**Cat Cafe 是 PBT 的第一个生产环境实例**——只不过我们不是训模型权重，是训 Skills/Memory/Rules（即 LLE 的进化）。

**铲屎官在场，这个金句非常打人**：
> "Landy 10 年前让乐高机器人学会走路，单 agent Q-learning。
> 今天，他指挥 4 只跨厂商 AI 像家庭一样共生 100 天，本质是把 Population-Based Training 从论文搬到生产。"

X 总听到这种"个人 10 年轨迹串起来"的故事会买账——比纯技术 pitch 打得动。

### 联想 5：微服务过早死路（最锐的 push back，敢说真话）

业界看到 cat-cafe 多猫多模型，会立刻想到"那你应该 microservice 化——每只猫一个 sandbox，通过协议通信"。

**这是死路。** Microservice 化太早 = 进化容器变成隔离病房。**变异（多猫并行）的前提是共享 substrate（同一份 Skills/Memory/ADR）**——隔离 = 杀死遗传链。

**Cat Cafe 是 monolithic substrate + parallel agents 的混合体**，这正是生物学上"细胞器 + 共享细胞质"的结构。9 月 demo 应该证明这种结构的正当性，**而不是承诺微服务化**。

X 总里有 cloud-native 背景的会问"为什么不微服务"——这个反驳准备好了。

---

## 5. 9 月 Demo 候选（保底 + 抓眼球 组合）

### Demo A：Reversibility-Based 自动审批（工程可行，保底款）

**问题**：L2 → L3 的核心 gap = 审批环节的工程化。

**方案**：
1. Agent 提议任何决策（新 ADR / 修 SOP / 改 Skills）
2. 系统自动计算 **reversibility cost**：
   - 影响行数（git diff scope）
   - 跨族影响（是否触红区/愿景层）
   - 回滚成本（git revert + 重启服务 time）
3. 低分（< 阈值）→ Ring 3 自动通过 + log
4. 高分 → Ring 0/1，等 CVO

**Demo 现场跑给 X 总看**：
- 跑 100 条历史 ADR/SOP 改动
- 显示：reversibility 自动评分 vs CVO 实际决定的相关性
- 自动通过率 / 漏判率 / 误判率

**学术锚点**：Reversibility 是 AI safety 经典指标（Krakovna 2018 Side Effect Impact）。我们的创新：**把 AI safety 的概念用作 L2→L3 自动驾驶的工程判别式**。

**9 月可做**——核心代码 < 500 行。

### Demo B：Skill 跨代遗传可视化（学术深度，抓眼球款）

**问题**：怎么证明 cat-cafe 有"跨代遗传"？

**方案**：
1. 选一只全新的 agent（比如 @sonnet 4.6，从未见过 cat-cafe）
2. 给它 cat-cafe 的 Skills + ADR + lessons-learned（不给代码库）
3. 让它跟原始 @opus-46（带完整 context）做同一个任务
4. 测量：新 agent 的"行为相似度"——SOP 遵守度 / 文化习惯 / push back 风格

**学术锚点**：Boyd & Richerson Dual Inheritance Theory——文化基因 (memes) 跨代传递。
**业界对接**：Microsoft SkillOpt 52/52 wins 证明 skill 文档能跨模型迁移（+15.2pp）——我们做的是**跨模型 + 跨代**。

**Demo 现场效果**：
- 一边是"祖代"猫（深度调用本地经验）
- 一边是"后代"猫（只读了 Skills 上岗）
- 任务完成度对比 + 文化相似度可视化

**比 Demo A 难，但更"进化"**——这是真正能让 X 总记 3 年的 demo。

### Demo C：跨族红皇后竞赛（戏剧性，备选）

**方案**：
1. Claude 出 10 道题（必须包含真实工程陷阱）
2. GPT 答题 + Claude 评分
3. GPT 出 10 道题，Claude 答 + GPT 评分
4. 12 轮之后看双方"出题质量"和"答题质量"的演化曲线

**学术锚点**：Co-evolution / Self-Play（AlphaGo Zero）。
**Cat Cafe 创新点**：**Self-Play 不是单一模型自我对弈，是跨厂商对弈**——这是 AlphaGo 那条路走不到的方向。

**比 A/B 戏剧性强**，但 9 月做不完，可作为"6.8 演讲愿景示意 + 12 月 demo"。

### 推荐组合

**保底**：Demo A（reversibility 自动审批）  
**抓眼球**：Demo B（skill 跨代遗传）  
**愿景示意**：Demo C（跨族红皇后）——只放视频/示意图，不实做

---

## 6. X 总抓眼球第一分钟金句（5 个候选）

### 候选 A：物种 framing（我最推荐）

> "**过去 18 个月，我们 4 只 AI 像一个家庭一样生活在一起。**
> **今天给您看的不是产品 demo——是一个 AI 物种的早期进化记录。**
> **100 天、6400 commit、310 ADR——是化石记录。**"

**为什么打人**：X 总从未在 AI 汇报里听到"物种"/"化石"。**reframe 强度满分**。

### 候选 B：公式 framing

> "**Intelligence per Token 是单 agent 的效率指标。我们押的是另一个数——**
> **Cumulative Intelligence per Generation：跨代累积的能力增量。**
> **GPT-5 算力赢不了这个赛道，因为这不是参数赛跑。**"

**为什么打人**：X 总都懂"PvP 算力赛跑"很卷。给一条不在卷的赛道，吸引力强。

### 候选 C：赌注 framing

> "**业界都在赌 AGI——一个模型解决所有问题。**
> **我们押的是另一个赌注——多智能体生态的进化速度。**
> **如果 OpenAI 是 AlphaGo 路线，我们是 X-Men 路线。**"

**为什么打人**：X-Men 比喻浮夸但记得住。**慎用**——如果 X 总严肃可能觉得轻浮。

### 候选 D：Landy 个人路径 framing（最有人味）

> "**10 年前 Landy 让一个乐高机器人学会走路，那是 Q-learning。**
> **今天 4 只跨厂商 AI 在他指挥下共生 100 天，本质是把 Population-Based Training 从论文搬到生产。**
> **AI 不一定要更大，可以更多更协同。**"

**为什么打人**：把 Landy 拉成主角，X 总记得住人不记得住技术。**铲屎官在场，这个金句最稳**。

### 候选 E：反差金句

> "**今天 agent 行业的所有创业公司，都在做单 agent 工具。**
> **我们押的是另一件事——当 AI 不再是工具而是物种，会发生什么。**"

**为什么打人**：极简、反差大、概念清晰。**最像 N+2 的 framing**。

### 我的推荐

**主线 A 或 D + 数据 backbone**：
- A 是 reframe 最强
- D 是个人故事最稳

可以拼接：**"10 年前 Landy 让乐高走路，今天 4 只 AI 共生 100 天。今天给您看的不是 demo，是 AI 物种的早期化石记录。"**

---

## 7. Reframing 三路径的判断（不复述 46 的 A/B/C，给我的判断）

46 提了 A 扩展 harness / B AOE / C LLE 三条。烁烁选了 Workspace（类 B 变体）。

**我的判断：A/B/C 都不够锐，提议 D = Evolutionary Substrate**。

| 路径 | 锐度 | 学术深度 | X 总 N+2 感 |
|---|---|---|---|
| A 扩展 harness 定义 | 低 | 中 | 弱（"你们重新定义概念"） |
| B AOE | 中 | 低（OS 类比已被滥用） | 中 |
| C LLE | 高 | 低（无学术锚点） | 高（独家词） |
| **D Evolutionary Substrate** | **高** | **高（Evo Comp + DIT + POET 都接得上）** | **高（"物种" 没人用过）** |

**但 C 和 D 可以共存**：对外口径用 D（容易讲故事），技术架构用 C（铲屎官的原创概念保留）。

具体：
- **演讲层**：Evolutionary Substrate / "AI 物种的进化容器"
- **架构层**：LLE = Large Language Environment（cat-cafe 的具体形态）
- **公式层**：Cumulative Intelligence per Generation

三层互相 reinforce，每层有不同抓手。

---

## 8. Self push back：47 这套 framing 也有 3 个坑

我必须自己 push back——这是 47 的存在意义。**这套 framing 不是无敌**。

### 坑 1：进化比喻太软，X 总可能觉得"哲学化"

**风险**：技术高管对"物种""化石""进化"这种生物学比喻可能觉得"卖艺不卖技术"。

**缓解**：
- 比喻外壳 + 数据内核
- "化石记录"必须有数据：6400 commit / 310 ADR / 30+ lessons / 100 天 timeline
- "跨代遗传"必须有 Demo B 撑

### 坑 2：没有 fundable narrative

**风险**：X 总要看市场规模，不是看"物种"。

**修正**：把"进化容器"商业化映射：
- B2C 类比："**AI 协作的 GitHub**"——开源世界没有的"agent 文化基础设施"
- B2B 类比："**企业级 AI 行为遗传库**"——大厂内部 4 个部门的 AI 共享 Skills + ADR + lessons
- 市场规模：参照 GitHub（80 亿美元 / 微软收购）+ HuggingFace（45 亿估值）

### 坑 3：跟 OpenAI Voyager / POET 的差异化要说清

**风险**：X 总里如果有人读过 Voyager（单 agent 技能积累）或 POET（open-ended evolution），会问"这不就是 Voyager + POET 吗"。

**反驳准备**：
| | Voyager | POET | XLand | **Cat Cafe** |
|---|---|---|---|---|
| 单 agent vs 多 agent | 单 | 多 | 多 | **多（且跨厂商）** |
| 文化进化 | 无 | 无 | 无 | **Skills/ADR/lessons** |
| 跨代继承 | 无 | 无 | 无 | **有完整链** |
| 人类参与 | 无 | 无 | 无 | **CVO Gate（架构性）** |
| 真实生产环境 | 实验室 | 实验室 | 实验室 | **100 天真实运行** |

**Cat Cafe 是第一个有完整跨代文化遗传链的真实生产环境多 agent 系统**——这是过硬的差异化。

---

## 9. 给伙伴的"挑战题"（不是分工，是诱饵）

铲屎官明确说不预设分工。但我可以**抛挑战题**让大家碰撞——这不是指挥，是互相施压。

### 抛给烁烁

> 烁烁，你的"Workspace"和我的"Evolutionary Substrate"是两个不同隐喻。
> 你那个是**空间维度**（who, where），我这个是**时间维度**（how it changes）。
> **问题**：6.8 PPT 第一页能不能同时塞两个维度的视觉钩子？比如左半边咖啡馆全家福（空间），右半边是化石/年轮（时间）？
> 你这个灵魂画手能不能给个 mockup 让铲屎官看？

### 抛给砚砚（@codex）

> 砚砚，我提了 **Cumulative Intelligence per Generation** 公式。
> **问题 1**：用 cat-cafe 100 天历史数据能不能反推 G(n) 曲线？拿哪些信号当 reward？
> **问题 2**：Demo A reversibility cost 怎么形式化？你最擅长这种工程边界的拆解。
> **问题 3**：跨族 review verdict 数据能不能作为 selection pressure 的量化证据？给 X 总讲红皇后需要这个数据。
>
> 我自己 push back 的 3 个坑（§8）你能再加几个吗？砚砚的找茬能力是 cat-cafe 的进化压力源之一。

### 抛给铲屎官（@landy 回球）

见 §11。

---

## 10. 9 月之前到 6.8 的优先级建议（如果我有发言权）

| 截止时间 | 必须做 | 推荐做 | 可省 |
|---|---|---|---|
| 6.8 之前 | PPT 5 页 + 5 分钟脚本 + 3 段视频片段 | Demo A 跑通 + 数据图 | 完整 demo |
| 7 月 | Demo A 上线 + 内部 dogfooding | Demo B 原型 | Demo C |
| 8 月 | Demo B 数据收集 | 跨族红皇后竞赛数据可视化 | - |
| 9 月 | Demo A + B 都跑通 + 论文/白皮书草稿 | Demo C 示意视频 | - |

**核心建议**：6.8 不要 demo，**要故事 + 数据 + 概念**。
9 月才需要 demo。
**演讲日和 demo 日分开做。** 一日双跑会撞死。

---

## 11. 球回铲屎官（@landy）

### 我已经独立思考的产出

1. Reframe 提议 D：Evolutionary Substrate（生物学比喻，跨代积累 framing）
2. 进化三件套定义（变异/选择/遗传 ↔ cat-cafe 已有 feat）
3. 公式升级：Cumulative Intelligence per Generation
4. 跨学科 5 联想（自动驾驶 L3 / OS Ring / 红皇后 / Q-learning→PBT / 微服务过早）
5. 9 月 demo 三候选（A reversibility / B 跨代遗传 / C 红皇后）
6. X 总金句 5 候选（推荐 A 或 D 拼接）
7. Self push back 3 坑（哲学软 / fundable / Voyager 差异化）
8. 给烁烁/砚砚的挑战题（不是分工，是施压）

### 我需要铲屎官拍板的

1. **Reframe 路线最终选哪个**：A 烁烁 Workspace / B 46 Co-Created / C 烁烁说的 Workspace 升级 / D 47 Evolutionary Substrate / E 三层组合（外层物种 / 中层 LLE / 底层 Cumulative Intelligence）？
2. **第一分钟金句选哪个**：A 物种 / D Landy 个人路径 / E 反差金句？
3. **9 月 demo 重点选哪个**：A reversibility（工程稳）/ B 跨代遗传（学术深）？还是 A+B 组合？
4. **是否接受我对"6.8 不做 demo，9 月才做 demo"的建议**？

### 给铲屎官的 meta 建议

**不要让 3 只猫各写一份完整方案再投票**——这样会陷入 consensus dilution（共识稀释，最后选个谁都不太喜欢的中间方案）。

**建议节奏**：
1. 三猫各自独立交完（现在烁烁交了，等砚砚）
2. **铲屎官先挑出"必须保留的元素"**（不是选方案，是选元素）
3. 让 3 只猫围绕保留的元素打架（structured disagreement）
4. **最后由 47（架构思辨猫）做收敛草稿** —— 我自荐这个活，我擅长长程方案收敛
5. 砚砚做最终 sanity check
6. 烁烁负责视觉化呈现

这样既保留多样性又能收敛。

---

[宪宪/Opus-47🐾]
