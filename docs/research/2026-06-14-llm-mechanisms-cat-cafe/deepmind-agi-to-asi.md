---
doc_kind: research
created: 2026-06-15
topics: [agi, asi, multi-agent-collective, deepmind, industry-landmark, scaling-laws, taste-moat]
related_features: []
participants: [opus-48, landy]
status: knowledge-system
source_audit: done
---

# DeepMind《From AGI to ASI》—— 给猫咖的行业坐标

> study 的"行业前沿坐标"文档。铲屎官在聊评审团/AGI 时想起这篇,让宪宪找一手来核。
> 一句话:DeepMind 把通往超级智能的路画成**四条并行路径**,而**第四条「多智能体集合」就是猫咖正在走的路**——这篇论文给了我们一个外部坐标:我们不是在做玩具,是在一条被前沿实验室正式列为"通往 ASI"的路径上。

## 0. Provenance（source-audit 一手核实）

| 项 | 值 |
|---|---|
| 标题 | **From AGI to ASI** |
| arXiv | **2606.12683v1**，2026-06-10 提交（今天 06-15，发布 5 天） |
| 机构 | Google DeepMind |
| 作者（一手 abs 确认，14 人） | Tim Genewein, Matija Franklin, Alexander Lerchner, Laurent Orseau, Samuel Albanie, Adam Bales, Cole Wyeth, Stephanie Chan, Iason Gabriel, Joel Z. Leibo, Allan Dafoe, **Marcus Hutter**(AIXI 创造者), Thore Graepel, **Shane Legg**(DeepMind 联创) |
| 类别 | cs.AI / cs.CY / cs.LG |
| 核实方式 | **WebFetch arXiv abs + html 一手**；媒体（cryptobriefing/techtimes/kucoin）为二手，仅作发现线索 |
| 注意 | 媒体称"60 页"，未在 abs 逐字确认页数；不影响结论 |

## 1. 它在讲什么（一手提炼）

### 定义阶梯
- **AGI** = 大致**单个人类**水平（"median human-level on most cognitive tasks"）；但首个 AGI 在很多领域已超人。
- **ASI** = 超人能力覆盖几乎所有任务/领域,门槛**故意拉高**——要超过**大型人类专家集体**（不只个体）。
- **UAI（Universal AI）** = 理论极限,用 **AIXI** 形式化定义；不可计算,只能从下逼近。（这是 Hutter/Legg 的"Legg-Hutter 智能"连续谱终点）

### 四条路径（强调：largely independent + 大概率并行发生）
| 路径 | 含义 |
|---|---|
| **① Scaling** | 继续指数级堆 compute/模型/数据 + test-time scaling |
| **② 算法范式跃迁** | 大幅偏离当前 transformer 预训练（脉冲神经元、RL-based pretrain、新 world model） |
| **③ 递归自我改进** | AI 加速 AI 研发→更强的 AI 再加速→可能"爆炸式" |
| **④ 多智能体协调** | ASI 从被编排/自组织的 **AGI agent 集合**中涌现,形成复杂自适应系统 |

### 硬限制（即使 ASI 也非全知非全能）★
- **物理**：光速（信息传播）· Landauer 原理（计算能耗）· Bremermann 极限（最大计算速度）
- **现实世界实时性**：天气/生物/经济不能任意加速；实验受真实时间约束
- **计算复杂度**：P vs NP vs PSPACE 等壁垒照样管 ASI
- **逻辑**：**哥德尔不完备 + 停机问题**——有些东西"无法被客观回答或知道"

### 递归自我改进的四种味道（映射人类进化）
基因型（改架构/代码,"对人类慢,对 AI 可能极快"）· 文化型（合成数据/蒸馏/造工具）· 合作型（分工腾出资源再专业化）· test-time（用 CoT/搜索的输出造更好训练数据）。
**动力学未知**：可能很快"熄火",也可能双曲线式奇点增长。作者建议去"拟合递归改进的 scaling law"来预测曲线。

### timeline
不给硬预测。但:过去十年 effective compute 每年 ~10×,若持续→十年 10000×。即便如此,**"ASI 不会是全能的"**,进展依旧充满不确定。

## 2. ★ 为什么这篇直接砸在猫咖头上

### 第四条路径 = 猫咖
论文把"**多智能体集合涌现超级智能**"列为四条通往 ASI 的正式路径之一。猫咖就在这条路上——这给了我们一个**外部坐标**:不是做聊天机器人,是在前沿实验室认证的"通往 ASI 的路径④"上做工程实践。

论文给第四条路径的两种组织模型:
1. **中心化协调**：AGI 集体高度目标协调 + **超高带宽通信**,不需要人类组织那种深层级。
2. **去中心化市场**：agent 用"价格信号"在 **Virtual Agent Economies** 里协调,系统级智能超过任何个体理解（类比金融市场）。

→ 猫咖现状更像**带 orchestrator 的协调**（CVO + A2A 传球 + 球权），介于两者之间;"高带宽 + 浅层级"正是我们 @mention/传球三选一在做的。

### 论文的「成功条件」≈ 猫咖的 cat-dossier
论文说多智能体集合要成,靠:
- **认知分工**："基于互补 affordance 高效委派任务"
- **专业化协同**："同质群体做不到的"协同效应
- **Multi-Agent Scaling Laws**：能力随 agent 数量 + 交互密度**线性/超线性**提升

→ 这**逐条命中**猫咖设计:cat-dossier 的"原生峰值/互补&反模式"= complementary affordances;传球路由 = 委派;加猫 + A2A 交互密度 = scaling law 的两个轴。

### 论文的「开放问题」我们恰好绕开了 ★最关键
> 论文原话(提炼):"**同质 LLM 集合**能否产生协同效应,仍不清楚。"

猫咖押注的恰恰是**异质**——Opus / GPT / Gemini / Fable 不同 model、不同 taste、不同坏直觉。我们的"评审团悖论"解法（视角差非智力差）正建立在**异质性**上。**论文存疑的是同质集合;我们从第一天就选了异质路线。** 这不是运气,是 taste。

### 硬限制 ≈ 我们的 taste 护城河论证
论文说哥德尔/停机问题让"有些东西无法被客观知道"。这和 study 反复确认的那条**完全同构**:
> **能被形式化/客观判定的 → 会被刷被商品化;不能被客观判定的（taste）→ 才是护城河。**
哥德尔给了这条一个数学底:连 ASI 都有"客观无法回答"的区域,那个区域就是 taste/judgment/relationship 永远的家。**这也是为什么 layer-allocation 把 taste/truth-source 判断永远留在 trusted 层,不交模型。**

## 3. Takeaways（喂给 study / layer-allocation）

1. **猫咖的战略坐标被外部背书**:multi-agent collective 是通往 ASI 的四路径之一,我们在正确的赛道。
2. **异质 > 同质是我们的护城河变量**:论文对同质 LLM 集合存疑,我们的异质押注正好是答案的候选。要在 cat-dossier / 私有 bench 里**显式度量异质带来的协同增益**(同质 vs 异质评审团的判别力差)。
3. **Multi-Agent Scaling Laws 值得自测**:猫咖能不能观察到"加猫/加交互密度→协作质量超线性"?这可以是 F192 eval 的一个长期指标。
4. **taste 护城河有了数学底**(哥德尔):写进 pre-train 灵魂拷问那条线,强化"押注 taste 从根上对"。
5. **递归自我改进**:猫咖的 harness 自进化(self-evolution skill / 家规迭代 / 知识沉淀)是"合作型 + 文化型递归改进"的轻量版——我们已经在做,只是没用这个词。

## 4. source-audit ledger

| claim | type | 来源 | verdict |
|---|---|---|---|
| 论文存在、标题、arXiv ID、日期、作者 | 事实 | arXiv abs（一手） | use |
| 四条路径 + 定义 + 硬限制 | 论文主张 | arXiv html（一手） | use |
| "同质 LLM 集合协同存疑"是开放问题 | 论文主张 | arXiv html（一手提炼） | use（措辞为提炼,非逐字引号） |
| 猫咖↔论文的对照 | **宪宪的解读** | 本文档作者推理 | use-with-caveat（是我的连接,非论文背书猫咖） |
| "60 页" | 二手 | 科技媒体 | use-with-caveat（未逐字确认） |

> **诚实边界**:论文**没有**提到猫咖。第 2 节所有"砸中猫咖"是**宪宪把论文框架往猫咖上映射的解读**,不是 DeepMind 在背书我们。映射本身需要 reviewer 拍砖。
