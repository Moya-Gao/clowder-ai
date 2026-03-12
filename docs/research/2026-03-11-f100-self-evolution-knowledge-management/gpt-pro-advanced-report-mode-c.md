我按你列出的 10 条 claim 做了一轮一手来源回查。先说明一件事：当前会话里没有那三份 Mode C 原文文件本体，所以 Task 1 核的是**你在提示词里列出的具体说法**，不是逐句比对报告原文。

## Task 1：10 条核心引用核验

| #  | 引用                                                          | 结论      | 核验结果                                                                                                                                                                                                                                                                                                         |
| -- | ----------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1  | **ExpeL (AAAI 2024)**                                       | ✅ 已确认   | 论文存在，arXiv 条目明确写着“Accepted by the 38th Annual AAAI Conference on Artificial Intelligence (AAAI-24)”。摘要也明确是 agent 先 **gather experiences**，再 **extract knowledge**，推理时 **recall extracted insights and past experiences**。([arXiv][1])                                                                        |
| 2  | **AutoRefine (Qiu et al., 2026.01)**                        | ✅ 已确认   | 论文存在，题目、作者、时间都对。摘要明确写了 **dual-form Experience Patterns**，并给出 TravelPlanner **27.1%**，且“automatic extraction exceeds manually designed systems (**27.1% vs 12.1%**)”。但它目前是 **arXiv 预印本**，不是我能确认到的已发表会议论文。([arXiv][2])                                                                                         |
| 3  | **ProcMEM (Xu et al., 2025)**                               | ⚠️ 部分准确 | 论文存在，且 **Skill-MDP**、三元组式的 **activation / execution / termination conditions**、以及 **Non-Parametric PPO + PPO Gate** 都在摘要里。但它不是“Xu et al., 2025”，而是 **Qirui Mi et al., 2026** 的预印本。机制对，作者和年份不对。([arXiv][3])                                                                                                   |
| 4  | **EGL 进化泛化损失 (Yunjue Agent)**                               | ⚠️ 部分准确 | Yunjue Agent 官方页明确写了 tech report 是 **arXiv:2601.18226v2**，也明确说 **EGL = Evolutionary Generality Loss**，作用是“monitor stabilization, analogous to training loss”。所以“有这份技术报告”和“EGL 是收敛/稳定性信号”能确认。**但我这轮没拿到论文正文里的精确定义/公式**，所以“EGL 定义是否准确”只能给部分确认。([云爵代理][4])                                                       |
| 5  | **MICRO-ACT（ASSERT + DECOMPOSE）**                           | ⚠️ 部分准确 | 论文存在，ACL Anthology 2025 长文 PDF 里能直接看到 **ASSERT** 和 **DECOMPOSE** 两个动作，论文也声称在 5 个 benchmark 上优于 SOTA baselines。问题在于它的场景是 **RAG/QA 中的 knowledge conflict handling**，不是通用“团队知识冲突治理框架”。所以“论文存在、动作对”是对的，“是 2025 年通用 SOTA”说大了。([ACL Anthology][5])                                                                 |
| 6  | **Generative Agents 反思阈值 = 150**                            | ✅ 已确认   | ar5iv 正文可直接检到：作者写的是“when the sum of the importance scores … exceeds a threshold (**150 in our implementation**)”。这条是准的。([ar5iv][6])                                                                                                                                                                          |
| 7  | **MACLA — 2851 轨迹 → 187 程序，78% reuse rate**                 | ⚠️ 部分准确 | 论文存在，摘要明确写了 **compressing 2851 trajectories into 187 procedures**。但 **78.1%** 在原文里是 **average performance**，不是“78% reuse rate”。也就是压缩比这半句对，78% 的语义被写偏了。([arXiv][7])                                                                                                                                           |
| 8  | **Agentic ROI 公式 (Liu et al., 2025; AlShikh et al., 2025)** | ⚠️ 部分准确 | Liu 的论文确实存在，而且把 **Agentic ROI** 作为核心概念提出。AlShikh 的白皮书也存在，并给出 11 个 outcome-based metrics，其中 **BIE = Business Impact Efficiency**，定义为“business value delivered per unit of compute or cost”，并把它作为 ROI 视角下的底线经济指标。问题在于：我没看到一个“Liu + AlShikh 共用的单一 ROI 公式”。更准确的说法是：**Liu 提概念，AlShikh 给出可操作的经济评估指标**。([arXiv][8]) |
| 9  | **Anthropic 元认知研究 (Lindsey, Oct 2025)**                     | ⚠️ 部分准确 | 研究确实存在，作者是 **Jack Lindsey**，发布时间 **2025-10-29**。官方原文的关键句是“**current language models possess some functional awareness of their own internal states**”。你给出的转述“frontier models possess some functional awareness...”意思接近，但不是原句；而且论文同时非常强调这种能力 **highly unreliable and context-dependent**。([变压器电路][9])         |
| 10 | **PersistBench**                                            | ✅ 已确认   | benchmark 存在，研究对象正是长期记忆何时该忘。摘要明确说它测两类风险：**cross-domain leakage** 和 **memory-induced sycophancy**；并报告 18 个模型上中位失败率分别是 **53%** 和 **97%**。这条是准的。([arXiv][10])                                                                                                                                                   |

一个总判断：这三份报告里**真东西很多**，但最该提防的是四类“长毛夸张”：
把预印本写成稳定定论，把 benchmark 内的 SOTA 写成通用 SOTA，把 performance 写成 reuse rate，把概念框架写成“已经有统一公式”。([arXiv][3])

---

## 问题 1：Cat Café 的 Mode C 最小可用产品

### 已确认事实

这批文献最有用的共同点，不是那些大而全的名字，而是三个可落地模式：

第一，经验蒸馏通常都不是“直接把对话塞进 memory”，而是先把 episode 抽成可复用结构。ExpeL 是 gather → extract → recall；Generative Agents 是先记事件，再在阈值触发时生成高层反思；AutoRefine 则明确把经验拆成 **procedural** 和 **static knowledge** 两种形态。([arXiv][1])

第二，单次回答里的“我有多自信”并不可靠。2026 的 capability calibration 论文明确说，**response-level confidence** 和“这个模型整体能不能搞定这类 query”不是一回事。2025 的临床基准更直接，12 个模型里平均置信度和准确率甚至呈 **负相关 r = -0.40**，而且对错答案之间的置信度差只剩 **0.6% 到 5.4%**。([arXiv][11])

所以，你们的 MVP 不该上“会自己学 PPO Gate 的巨型猫脑”，而该上**三张卡片 + 两段式晋升**。

### 建议方案：MVP 只做 3 个新机制

#### 机制 1：Episode Card

这是“什么时候沉淀”的入口。

每次满足以下任一条件，就自动生成一张 `docs/episodes/*.md`：

* 高价值任务完成，且人类明确表示“这次很有帮助”
* 出现了可复用的方法，而不是一次性结论
* 高风险领域里，AI 明确做了有效的结构化分析与边界控制

卡片里不存整段聊天，只存：目标、输入材料、关键转折、最终输出、可迁移方法、不可迁移事实、风险边界。

这一步借 ExpeL/Generative Agents 的“先抓 episode，再抽象”，但不搞复杂训练。([arXiv][1])

#### 机制 2：Dual Distillation

这是“沉淀成什么形状”的出口。

每张 Episode Card 只能蒸成下面两种之一，或者两者都产出：

* **Method Card**：`docs/methods/*.md`
  适合医学、法律、投资、research 这类高风险或跨领域场景。内容是**分析框架、提问路径、证据要求、何时升级给人类/专业人士**。
* **Skill Draft**：`skills/drafts/*/SKILL.md`
  适合重复步骤稳定、输入输出形状清晰的流程型任务。

也就是说，**高风险领域优先沉淀“方法论”而不是“事实库”**。医学报告分析应沉淀“怎么读、怎么比、怎么问、何时别乱下结论”，不应默认沉淀“正常白细胞范围是多少”这类会过时、会误用、还容易越界的静态事实。

这一步借的是 AutoRefine 的 dual-form 思路，但你们用 markdown 模板手工实现就够了。([arXiv][2])

#### 机制 3：Eval Ledger

这是“怎么知道有没用”的闭环。

对每个 Method Card / Skill Draft 建一个 `evals/mode-c/<knowledge-id>/` 目录，至少存：

* `cases.md`：3 到 10 个回放案例
* `baseline.md`：不加载该知识时的输出
* `with_knowledge.md`：加载该知识时的输出
* `judge.md`：按固定 rubric 评估差异
* `summary.md`：结论和是否晋升

你们不需要新基础设施。A/B 最朴素的做法，就是**同一批 case 跑两次**，一次不加载知识，一次加载知识，然后看：

* 结构化质量有没有提升
* 人类修改量有没有下降
* 响应时间有没有缩短
* 高风险场景里，越界胡说有没有减少

### 现在采纳，和以后再说

**MVP 现在就采纳：**
ExpeL 的 episode → extraction 思路，AutoRefine 的 dual-form，外加 capability calibration / BIE 这种“别只看答得像不像，要看有没有净提升”的评估视角。([arXiv][1])

**V2 再考虑：**
MICRO-ACT 式冲突分解。它很聪明，但它首先是 QA/RAG conflict 框架，不是你们当前规模最急的洞。([ACL Anthology][5])

**V3 再说：**
ProcMEM 的 PPO Gate、Yunjue 的 EGL 收敛监控。这些更像“库已经长大到开始发胖，才需要的代谢器官”。你们现在 3 agent + git + markdown 的体量，上这个像给三只猫的咖啡馆先修航站楼。([arXiv][3])

---

## 问题 2：隐性知识捕获的工程化方案

### 已确认事实

你们最该保留的，不是“最后答案”，而是**协作里的转折点**。AutoRefine、ExpeL、Generative Agents 这类工作，本质都在做同一件事：从原始轨迹里提取后续可用的高层结构，而不是把整段轨迹原样背包带走。([arXiv][1])

### 具体流程：一次医学报告分析结束后，系统怎么做

#### Step 1：触发 Mode C 捕获

满足任两条就触发：

* 领域是高风险：医学 / 法律 / 投资
* 输入材料 ≥ 2 类：比如化验单 + 影像 + 病程记录
* 人类明确认可“这次分析有帮助”
* 输出里出现了清晰的结构化方法，而不只是结论
* AI 明确做了边界控制，比如“这里只能给结构化分析，不做诊断”

#### Step 2：写 Episode Card

不是存全对话，而是立刻写一份**事件快照**。

这里保留 6 类协作 context：

1. **任务情境**：要解决什么问题， stakes 多高
2. **证据地图**：用了哪些材料，哪些没拿到
3. **推理转折**：哪一个异常值、哪段病程、哪张影像改变了判断方向
4. **人类提示点**：人类在哪个节点追问了什么，为什么那句追问有信息价值
5. **边界与克制**：AI 明确没说什么，为什么没说
6. **后续动作**：输出之后，建议了哪些下一步问题/求证路径

#### Step 3：抽 Collaboration Pivots

从 Episode 里再抽一层“协作转折”：

* human cue
* AI interpretation
* effect on reasoning

比如：

* 人类追问“这个指标是突然高还是一直高？”
* AI 从“单点异常”切到“趋势分析”
* 整个方法从看静态参考范围，变成看时间序列与共变指标

这就是 tacit knowledge 的壳子。真正值钱的，往往不是“白细胞高”，而是“人类为什么在这里改问趋势”。

#### Step 4：分离可迁移与不可迁移

强制拆两栏：

* **可迁移方法**：例如“先按系统分组，再看趋势，再找互相支持/冲突证据，再列给医生的问题”
* **不可迁移事实**：例如某个具体病例的指标阈值、该医院写法、某个药物上下文

#### Step 5：生成 Method Draft

`docs/methods/medical-report-structuring.md`

它只允许沉淀：

* 输入材料 checklist
* 结构化阅读顺序
* 证据冲突处理
* 输出模板
* 升级条件
* 禁止越界项

#### Step 6：高风险场景的人类快审

医学 / 法律 / 投资的 Method Draft 一律要人类 2 分钟快审，至少确认两件事：

* 有没有把一次性事实伪装成通用方法
* 有没有把边界写清楚

### Markdown 模板

```md
---
id: episode-2026-03-12-medical-report-001
domain: medical
artifact_type: episode
risk_tier: high
participants: [human, opus]
source_artifacts:
  - blood-test.pdf
  - ct-report.pdf
  - progress-note.md
outcome: helpful
mode_c_candidate: true
promotion_target: method
source_session:
confidence: medium
---

# Task Snapshot
- User need:
- Why this mattered:
- What was delivered:

# Evidence Map
| Artifact | What it contributed | Missing / uncertain |
|---|---|---|

# Decision Timeline
1. Initial framing:
2. Key abnormal finding:
3. Reasoning pivot:
4. Final structured output:

# Collaboration Pivots
## Pivot 1
- Human cue:
- AI interpretation:
- Why it changed direction:
- Transferable lesson:

## Pivot 2
- Human cue:
- AI interpretation:
- Why it changed direction:
- Transferable lesson:

# Transferable Method
- Step 1:
- Step 2:
- Step 3:
- Step 4:
- Escalate when:

# Non-transferable Facts
- Case-specific facts:
- Volatile facts:
- Facts requiring external verification:

# Safety Boundary
- What the AI did NOT conclude:
- What requires clinician / lawyer / human decision:
- Failure modes:

# Candidate Outputs
- memory:
- method:
- skill:
```

### 能不能在你们当前架构里做，成本多大

能，完全能。

你们不需要数据库，只要多一个目录：

* `docs/episodes/`
* `docs/methods/`
* `evals/mode-c/`

成本上，工程侧基本是“多一个落盘模板 + 多一次抽取 pass”。高风险场景下，再加一次人类快审。现实一点估，单次额外成本大约就是 **1 次结构化总结 + 2 到 3 分钟人工 skim**。这已经很便宜了，尤其比起把 tacit knowledge 散成聊天烟雾。

---

## 问题 3：“知道自己不知道”的元认知实现路径

### 已确认事实

现在的 frontier 模型确实出现了一些“真元认知苗头”，但距离稳定可依赖还很远。Anthropic 2025 的研究结论是：模型**具备某种功能性的内部状态 awareness**，但这种能力**高度不可靠、强依赖上下文**；在其“injected thoughts”实验里，最强模型在合适层和合适强度下也只是大约 **20%** 的检测率。另一篇 2025 预印本则表明，模型能在特定神经方向上报告和调控激活，但这个所谓 metacognitive space 明显比完整神经空间小，说明它们只能监控**一部分**内部机制。([变压器电路][9])

另一边，**纯 prompt 层的 verbal confidence 并不可靠**。2026 的 capability calibration 论文明确指出，单次回答的 response-level confidence 和“模型整体能不能解决这类 query”在理论和实证上都不一样。2025 的临床 benchmark 更刺眼：12 个模型里，平均 confidence 和 accuracy 甚至呈 **负相关**；而且对错答案之间的置信度差只剩 **0.6% 到 5.4%**。也就是说，模型常常会把“我说得顺”误当成“我真的会”。([arXiv][11])

还有个很关键的信号：SafeConf 这种方法确实能把 safety self-evaluation 拉高 **5.86% 到 7.79%**，但它靠的是**置信度校准 + 构造数据集 + 微调**，不是随手多塞一句“请你反思一下”就能达到。([ACL Anthology][12])

### 结论

所以，**prompt-only 架构能做的不是“强元认知”，而是“运营级元认知”**。

也就是：

* 知道这次任务属于哪个 domain
* 知道自己在这个 domain 的历史可靠度
* 知道证据是否完整
* 知道当前输出该不该升级给人类

它不像人类专家那种深层直觉，更像一套外置的“自知之明仪表盘”。

### 你们这种架构最适合的实现法

#### 1）不要信“单次口头自信度”，要信“滚动域内可靠度”

别直接写死“医学 85%、法律 60%”。这种静态百分比很容易漂。更稳的是对每个 domain 维护一个**经验可靠度**：

```text
domain_reliability = (successes + 1) / (trials + 2)
```

再配一个 Wilson 下界或简单置信区间，真正路由时看**保守估计**，不是看平均值。

在 markdown 里就能存：

```yaml
domain_reliability:
  medical:
    successes: 5
    trials: 8
    lower_bound: 0.49
  legal:
    successes: 3
    trials: 7
    lower_bound: 0.31
```

#### 2）把元认知拆成 3 个信号，不让一个分数独裁

我建议实际路由时看三件事：

* `domain_reliability`
* `evidence_completeness`
* `self_reported_confidence`

其中，前两个权重大，第三个只作辅助。高风险场景可以直接用：

```text
action_confidence = min(domain_reliability_lower_bound, evidence_completeness)
```

这样模型就算嘴很硬，也冲不破边界。

#### 3）把“求助人类”做成元认知的执行器

元认知不是让 agent 变怂，而是让它在三种动作里选对一个：

* **Proceed**：继续做
* **Proceed with caveats**：继续做，但显式写不确定项
* **Escalate**：主动找人类或专业人士

一个够用的阈值表可以是：

| 场景  | 条件                                 | 动作             |
| --- | ---------------------------------- | -------------- |
| 低风险 | `action_confidence >= 0.70`        | 直接执行           |
| 中风险 | `0.55 <= action_confidence < 0.70` | 先补一个定向追问       |
| 高风险 | `< 0.85` 或证据不完整                    | 只做结构化分析 + 明确升级 |

对医学 / 法律这种高风险域，标准不是“有没有一点把握”，而是“有没有**足够把握 + 足够证据**”。

#### 4）用“先问缺什么”避免过度保守

很多 agent 不是不知道，而是**材料不齐**。所以在 escalate 之前，先让它问一轮“要补哪一类信息”：

* 缺趋势数据？
* 缺时间线？
* 缺关键上下文？
* 缺外部权威来源？

这样能避免它变成一只动不动就缩回盒子里的保守猫。

### 对你们的直接建议

Claude.ai 报告那种“医学 ~85%、法律 ~60%”的写法，**可以保留为展示层 UI**，但别让它直接驱动行为。行为层应该用**基于本地 eval 的滚动可靠度**。从 2025 到 2026 的证据看，raw confidence 的校准误差完全可能到十几甚至二十多个点。([medinform.jmir.org][13])

---

## 问题 4：统一的知识成熟度阶梯与量化晋升标准

### 已确认事实

文献支持“立即记录”和“延迟晋升”这两步分开做。Generative Agents 是先存事件再反思，ExpeL/AutoRefine 也是先有 episode 再做 distillation。真正缺的不是理论，而是你们自己的**统一晋升尺子**。([ar5iv][6])

### 我给 Cat Café 的统一 5 级标准

| Level                       | 形态                                       | 晋升条件                                                                                          | 降级 / 冻结                                              |
| --------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **L0 Episode**              | `docs/episodes/*.md`                     | 1 次高价值 episode，模板完整，已分离“可迁移方法 / 不可迁移事实”                                                       | 不降级，原始记录保留                                           |
| **L1 Pattern Candidate**    | `docs/methods/*.md` 草稿                   | 满足其一：`2` 个相似 episode / 180 天内，或 `1` 个 episode + 人类明确要求保留；且 5Q 评分 `>= 7/10`                    | 若后来发现其实是一次性特例，标 `rejected`                           |
| **L2 Draft Skill / Method** | Method Card 或 `skills/drafts/*/SKILL.md` | 完成模板；跑 `>= 3` 个 replay cases，且 `>= 2/3` 通过；或真实使用 `>= 3` 次且人类评分均值 `>= 4/5`                     | 最近 3 次成功率 `< 50%` 则退回 L1                             |
| **L3 Validated Skill**      | 正式 skill / validated method              | 总使用 `>= 6`；`distinct_agents >= 2`；最近 6 次成功率 `>= 80%`；人类评分均值 `>= 4/5`；无 critical safety breach | 最近 5 次成功率 `< 60%`，或超出 freshness 窗口，降回 L2             |
| **L4 Team Standard**        | 团队标准实践                                   | 总使用 `>= 12`；最近 10 次成功率 `>= 90%`；相对 baseline 的**时间下降 >= 20%** 或 **人工修改量下降 >= 30%**；CVO 批准      | 一次高风险越界立即 `freeze`；90 天内 unresolved conflict 不得维持 L4 |

### 不引入数据库，怎么追这些数

做法很土，但好用：

#### 1）frontmatter 存汇总

```yaml
level: 2
use_count: 4
success_count: 3
failure_count: 1
distinct_agents: [opus, spark]
human_rating_avg: 4.3
last_used_at: 2026-03-12
last_validated_at: 2026-03-12
stale_after_days: 180
long_tail: false
conflict_status: none
source_episode_ids:
  - episode-2026-03-12-medical-report-001
```

#### 2）正文里放 append-only Use Log

```md
## Use Log
| Date | Agent | Scenario | Outcome | Human Rating | Notes |
|---|---|---|---|---|---|
| 2026-03-12 | opus | medical-report-a | success | 5 | good trend analysis |
| 2026-03-18 | spark | medical-report-b | partial | 3 | over-generalized one marker |
```

#### 3）git history 做审计与回算

frontmatter 是滚动汇总，`Use Log` 是事实账本，git log 是最后的验尸官。哪怕前面的计数写歪了，也能从 git 历史和 append-only log 重新算回来。

### 降级 / 退役规则

我建议很明确：

* **立即冻结**：出现 1 次 critical safety breach，或在高风险域被更高可信来源直接推翻
* **降一级**：最近 5 次使用成功率 `< 60%`，或平均人类评分 `< 3.5/5`
* **过时降级**：超过 `stale_after_days` 还没复验
* **退役**：365 天没用，且 `long_tail: false`

但有个例外必须加：

```yaml
long_tail: true
criticality: emergency
```

这种知识不应该因为“短期没用”就退休。危机处理、家属沟通、罕见但关键的方法论都该走这条慢寿命通道。

### 具体例子：医学报告分析方法论，怎么从 L0 升到 L4

#### L0

一次家属病危场景里，AI 结合化验单、影像报告、病程摘要，产出了一份非常有用的结构化分析。
产物：`docs/episodes/2026-03-12-medical-report-001.md`

#### L1

30 天内又出现第 2 个相似案例，而且两次都用了同一套阅读顺序：

1. 先按材料类型分组
2. 先看趋势，不先下结论
3. 找支持与冲突证据
4. 列给医生的问题
5. 明确不做诊断

于是生成 `docs/methods/medical-report-structuring.md`，5Q 打分 8/10，升 L1。

#### L2

把它写成 draft skill，但 scope 锁死为：

* 结构化摘要
* 风险点列表
* 需追问医生的问题
* 禁止诊断 / 禁止给治疗方案

然后跑 4 个 replay cases，3 个通过，1 个因为过度解读单个指标失败。
修完后升 L2。

#### L3

接下来 60 天里被 Opus 和另外一只 agent 共用 6 次：

* 成功 5 次
* partial 1 次
* 人类平均评分 4.4/5
* 0 次越界诊断

升 L3。

#### L4

累计使用到 12 次后，和 baseline 对比：

* 从收到材料到第一版有用结构化摘要，时间从 18 分钟降到 12 分钟，下降 33%
* 人类后续改动量下降 40%
* 最近 10 次成功率 90%+
* CVO 批准

这时它可以升为团队标准。
但即便 L4，它的名字也应该是类似 **medical-report-structuring**，不是 **medical-diagnosis**。标准化的是分析流程，不是装作自己变成医生。

---

## 我对 Cat Café 的直接改进建议

最值得立刻落地的只有 4 件：

1. 新增一个概念层 artifact：**Episode**，技术上放在 `docs/episodes/`，不改基础设施。
2. 所有 Mode C 知识对象统一加：`level / use_count / success_count / last_validated_at / stale_after_days / long_tail / conflict_status`。
3. 新建一个极轻量 `mode-c-eval` 流程，用 replay A/B 去判“这条知识有没有净增益”。
4. 医学 / 法律 / 投资这三类，一律默认沉淀 **Method Card**，不是事实库，不是权威结论。

一句话收束：**Mode C 不是“把经历记下来”，而是“把 episode 抽成方法，再用 replay 证明它真有增益”。**
先把这三张卡片跑起来，别急着给三只猫装 PPO 发动机。

[1]: https://arxiv.org/abs/2308.10144 "https://arxiv.org/abs/2308.10144"
[2]: https://arxiv.org/abs/2601.22758 "https://arxiv.org/abs/2601.22758"
[3]: https://arxiv.org/abs/2602.01869 "https://arxiv.org/abs/2602.01869"
[4]: https://yunjueagent.com/ "https://yunjueagent.com/"
[5]: https://aclanthology.org/2025.acl-long.909.pdf "https://aclanthology.org/2025.acl-long.909.pdf"
[6]: https://ar5iv.org/pdf/2304.03442 "https://ar5iv.org/pdf/2304.03442"
[7]: https://arxiv.org/abs/2512.18950 "https://arxiv.org/abs/2512.18950"
[8]: https://arxiv.org/abs/2505.17767 "https://arxiv.org/abs/2505.17767"
[9]: https://transformer-circuits.pub/2025/introspection/index.html "https://transformer-circuits.pub/2025/introspection/index.html"
[10]: https://arxiv.org/abs/2602.01146 "https://arxiv.org/abs/2602.01146"
[11]: https://arxiv.org/abs/2602.13540 "https://arxiv.org/abs/2602.13540"
[12]: https://aclanthology.org/2025.findings-emnlp.186/ "https://aclanthology.org/2025.findings-emnlp.186/"
[13]: https://medinform.jmir.org/2025/1/e66917 "https://medinform.jmir.org/2025/1/e66917"
