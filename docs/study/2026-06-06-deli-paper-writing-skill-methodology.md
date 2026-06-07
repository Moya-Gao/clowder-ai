---
title: "Deli paper_writing skill：开放式论文写作 Harness 拆解"
created: 2026-06-06
category: study
tags:
  - AI Research
  - Agent Harness
  - Skills
  - Source Audit
  - Cat Cafe
source_url: https://victorchen96.github.io/auto_research/skill/paper-writing.html
source_title: "Scientific Paper Writing -- Skill Group"
source_kind: author-github-pages
status: source-audited-primary-with-caveats
related:
  - agent-experience-and-self-evolution-synthesis.md
  - adaptive-auto-harness.md
  - ../research/2026-06-01-deli-autoresearch-takeaways.md
---

# Deli paper_writing skill：开放式论文写作 Harness 拆解

> 触发：铲屎官看到营销号说 Deli Chen 开源了 scientific paper writing skill，要求把方法论扒下来，判断 Cat Cafe 能学什么，并沉淀到 study。
>
> 一句话结论：这不是可安装的 `SKILL.md` 包，也不是 DeliAutoResearch 整套系统开源；它更像一份**论文写作任务类的 harness spec**。真正值得学的是：把开放式产出拆成子技能、产物契约、失败路由、质量门和反膨胀评审循环。

---

## 0. Source Audit

| Claim | 一手来源 | Verdict | 说明 |
|---|---|---|---|
| `paper_writing` skill 在 2026-06 被公开 | Deli Chen 个人主页 / AutoResearch V2 blog / skill 页面 | use | 作者自己发布，作为“其公开说法”可信 |
| 流水线其他技能仍为内部使用 | AutoResearch V2 blog | use | blog 明确把 `search_agent`、`call_api`、`peer_review_simulation` 等列为 internal |
| 公开仓库里没有可安装 skill 包 | GitHub Pages repo tree | use-with-caveat | 公开 tree 只有 HTML/PDF/图片等；未见 `SKILL.md`、脚本、安装说明或 agent runtime 配置。不能排除私有仓库 |
| 8.5/10 平均分、生产统计、分数贡献 | skill 页面 / paper 页面 | use-with-caveat | 作者自报生产遥测，可作为方法线索；不能当独立学术质量 benchmark |

来源：

- Skill 页面：<https://victorchen96.github.io/auto_research/skill/paper-writing.html>
- AutoResearch V2 blog：<https://victorchen96.github.io/blog_auto_research_v2.html>
- GitHub Pages repo：<https://github.com/victorchen96/victorchen96.github.io>

**事实口径**：

```text
paper_writing skill spec: public
DeliAutoResearch master framework: not public stable release
search / API / deployment / dynamic routing skills: internal
installable SKILL.md package: not found in public repo
```

---

## 1. 它到底是什么

`paper_writing` 不是一个“请帮我写论文”的长 prompt，而是一个层级化 skill group。它把“写一篇 survey paper”拆成 5 个子技能：

| 子技能 | 输入 | 输出 | 负责什么 |
|---|---|---|---|
| Literature Survey | topic + taxonomy keywords | `references.bib` + `citation_plan.jsonl` | 文献召回、LQS 打分、引用深度分类、venue upgrade、引用核验 |
| Paper Structure & Logic | bib + experiment findings | `sections/*.tex` | 章节架构、段落逻辑、taxonomy、claim 强度、related work differentiation |
| Experiment Design | conjecture or gap | `results.json` + `experiment_summary.md` | 假设、变量、控制、统计计划、API/GPU 执行、迭代解释 |
| Academic Figures & Tables | results + placeholders | `figures/*.pdf` + `tables/*.tex` | 表格、图、caption、格式规范、信息密度 |
| Peer Review Simulation | compiled PDF | score + weakness list | 多 persona 打分、弱点归类、回归检查、驱动下一轮修复 |

这张表是它最核心的工程思想：**每个子技能都有输入、输出和责任边界**。开放式写作任务因此不再是“让模型自由发挥”，而是一条可检查的生产线。

---

## 2. 方法论骨架

### 2.1 Phase 0 先问三个问题

在进入流水线前，它先要求回答：

```text
Scope?    这篇文章边界是什么
Angle?    这篇文章的新角度是什么
Audience? 给谁读
```

这比直接写 outline 更重要。开放式任务最常见的失败不是写不出，而是边界漂移：看起来越写越多，实际上不知道文章要服务谁、证明什么。

Cat Cafe 对应：研究/长文/PPT 都应该有 `Scope / Angle / Audience`，放在任务卡或文档前言里。

### 2.2 文献不是列表，而是漏斗

Literature Survey 被拆成 4 段：

```text
Recall  ->  Score  ->  Classify  ->  Upgrade
广召回     LQS打分     A/B/C/D深度     arXiv升级到正式venue
```

它不是只追求“引用多”，而是把文献变成可审计的漏斗：

- 每个 taxonomy cell 至少有多个 query variants；
- raw candidates 先高召回，再按 recency / citation impact / venue / institution / acceptance 打 LQS；
- A/B/C/D 不是引用格式，而是引用深度；
- arXiv-only 比例、近一年比例、accepted 比例、核验率都有 gate；
- 每 20 条引用做 title / author / year / venue check。

可迁移点：我们做 source-audit 时也应该把“找到了链接”升级成“证据漏斗”。尤其是长期 research 文档，应该保留：

```text
candidate sources
selected sources
why selected / why dropped
claim -> source mapping
verification state
```

### 2.3 写作结构是 claim 管理，不是润色

Paper Structure & Logic 里最有价值的不是章节模板，而是两条约束：

```text
claim strength <= evidence strength
related work differentiation 不能只说 "we are more recent"
```

它要求不同强度的表达匹配不同证据：

```text
demonstrates > suggests > may > hypothesize
Theorem > Conjecture > Observation > Remark
```

这对 Cat Cafe 很重要。我们的研究笔记经常会从“看到一个强线索”滑到“我们证明了某件事”。这套规则提醒我们：如果证据是 blog / 自报 / 小样本 / 单例，结论强度就必须降级。

### 2.4 实验先绑定 claim，再运行

Experiment Design 里最强的一句原则是：

```text
这个实验支撑论文里的哪一个 claim？
```

然后才写 hypothesis、independent/dependent/control variables、expected results、统计计划。它还明确反对 HARKing：不能跑完结果再回头发明假设。

可迁移点：家里的 eval / demo / benchmark 也要写成：

```text
Claim:
Test:
Expected failure/success:
What result would change our mind:
```

否则测试只是表演，不是选择压力。

### 2.5 图表是信息层，不是装饰层

Figures & Tables 的价值是把图表当作独立的“信息压缩 artifact”：

- caption 要包含结论，不只是描述；
- 表格需要可比较，不只是罗列；
- 实验数据要有 mean +/- std；
- 每个图表都必须在正文中被引用；
- 全 survey 有数量目标，但更重要的是每个图表承载 non-trivial insight。

这可以直接迁移到 PPT Forge / study 文档：图表不是为了好看，而是为了把读者从“看一堆文字”推到“看见结构”。

### 2.6 评审不是意见池，而是修复路由器

Peer Review Simulation 是整套方法的心脏。它没有把 reviewer 当成“给分机器”，而是当成 weakness router。

每轮评审输出：

```text
score
per-dimension scores
3-5 strengths
3-5 weaknesses, prioritized Major/Minor
concrete suggestions
recommendation
regression check
```

然后按 weakness routing table 分派：

| 弱点 | 路由 |
|---|---|
| Citation coverage insufficient | Literature |
| Too many arXiv-only refs | Literature |
| Structure unclear | Structure |
| Claims too strong | Structure |
| No experiments | Experiment |
| Experiment not rigorous | Experiment |
| Tables incomparable | Figures |
| No error bars | Figures |

这和 Cat Cafe 的 review 文化很接近，但 Deli 这里给了一个很清晰的补充：**review comment 必须能路由到生产线里的某个责任模块**。如果一个评审意见不能路由，就说明技能边界还没拆好，或者意见本身不可执行。

### 2.7 反膨胀规则比打分更重要

它的 reviewer scoring 有 anti-inflation rules：

- 第一轮最高 7.0；
- 每轮最多提升 1.5；
- 至少保留 1 个 unresolved weakness；
- 至少 1 个 reviewer 换不同模型；
- 以前修过的问题要做 regression check。

这里不要学具体数字，要学姿势：**开放式产出的自评最容易虚高，所以评审系统必须故意保留摩擦**。

Cat Cafe 对应：

```text
不要只问“这篇好不好”
要问“哪一个 weakness 还没解决”
不要只看本轮变好
要查上轮修复有没有退化
不要让同一模型连续给自己鼓掌
```

---

## 3. 它和 Adaptive Auto-Harness 的关系

Adaptive Auto-Harness 说的是开放任务流里，harness 要长成树：不同任务类型需要不同分支，避免一个万能包越长越胖。

Deli 的 `paper_writing` 是一棵树里的一个任务类分支：

```text
Adaptive Auto-Harness
  -> harness tree / task routing / branch isolation

Deli paper_writing
  -> one branch for scientific survey writing
  -> inside branch: literature / structure / experiment / figures / review
```

所以它不该被理解成“AI 写论文的万能技能”。更准确地说：

> 它是一个把“scientific survey writing”这个开放任务类收束成可生产、可评审、可迭代 harness 的样本。

这点正好补上我们家思考里的一个空位：我们一直说开放任务要有 verifier / eval / telemetry，但 Deli 这里展示了一个具体任务类如何拆出子技能、产物契约、质量门和失败路由。

---

## 4. Cat Cafe 能直接吸收什么

### 4.1 每个高价值产物都要有产物契约

当前很多任务只有“写一篇研究”“做一个 PPT”“总结一下”。Deli 的写法要求每个子步骤有明确 artifact：

```text
references.bib
citation_plan.jsonl
sections/*.tex
results.json
experiment_summary.md
figures/*.pdf
tables/*.tex
review_report.md
weakness_route.md
```

Cat Cafe 对应可以抽象成：

```text
source_ledger.md
claim_table.md
artifact_outline.md
evidence_matrix.md
review_report.md
weakness_routing.md
production_telemetry.md
```

这比“写得详细一点”更有用，因为它给了后续猫检查入口。

### 4.2 给长文 / 研究 / PPT 建 weakness routing table

建议后续每个重要 artifact 都带一张表：

| 如果 reviewer 说 | 不要做什么 | 应该路由到 |
|---|---|---|
| 来源不够硬 | 加几个随机链接 | source-audit / literature refresh |
| 结论太满 | 加 caveat 但保持强结论 | claim strength downgrade |
| 结构散 | 局部润色 | outline / narrative spine |
| 没有证据闭环 | 写更多解释 | eval / experiment design |
| 图表看不出结论 | 换配色 | figure/table redesign |
| 没有 takeaway | 加总结段 | reader job-to-be-done |

这样 review 就不只是“意见”，而会变成生产系统的一部分。

### 4.3 把 source-audit 做成 citation funnel

现在 source-audit 已经能识别一手/二手、利益冲突、时效性。Deli 给我们的补充是“漏斗化”：

```text
candidate -> scored -> selected -> citation depth -> verified -> upgraded
```

对我们来说不一定要照搬 LQS 权重，但可以为长期 research 文档加一张更轻的 ledger：

| Source | Role | Depth | Verification | Caveat |
|---|---|---|---|---|
| 一手论文 | 主证据 | A | 已读原文 | preprint / 小样本 |
| 官方 blog | 背景 | B | 已核日期 | 自报 |
| 媒体报道 | 线索 | C | 未追到一手则不用 | 营销动机 |

### 4.4 给 synthetic review 加 anti-inflation

我们已经有跨猫 review / expert-panel，但如果用于开放式写作，需要更明确的防自嗨规则：

```text
第一轮不能给高分
每轮必须留 major weakness
同一作者不能 review 自己
至少一个 reviewer 换模型 / 换家族
每轮必须检查旧 weakness 是否回归
最终结论按最弱 gate 决定，不按平均观感
```

这和我们家“跨个体 review 铁律”一致，但更适合非代码 artifact。

### 4.5 生产遥测要回答“分数为什么涨”

Deli 页面把各子技能的时间占比、score contribution、关键输出列出来。数字本身不能当真理，但这个表型值得学。

我们自己的长文 / PPT / research 可以沉淀：

```text
artifact size
source count
claim count
review rounds
major weaknesses fixed
remaining weaknesses
time by stage
what changed score / judgment
```

这就是把“写完了”变成“我们知道它为什么变好了”。

---

## 5. 不要照搬什么

### 不照搬 LQS 权重

Recency / citation impact / venue / institution / acceptance 可以作为线索，但不能变成普适真理。对 agent harness / 新兴产品 / 内部实践来说，最有价值的一手证据常常不是高引用论文，而是源码、commit、事故、真实用户反馈。

### 不把 synthetic reviewer 当 oracle

LLM reviewer 能发现结构问题、缺证据、引用弱、claim 太强，但它不是最终读者，也不是学术 peer review。它适合做弱点评审，不适合做真实性背书。

### 不拿 8.5/10 当外部质量证明

这个分数是作者系统内部评估，不是 independent benchmark。我们可以学习“分数爬坡 ladder”，但不能拿它证明论文真的达到某个学术层级。

### 不追求“论文自动生成”

Cat Cafe 真正要学的不是让 agent 自动写论文，而是把开放式认知产出变成可追溯、可审查、可复盘、可迭代的 production episode。

---

## 6. 可复用模板：开放式 Artifact Harness Card

以后遇到长文、研究、PPT、策略 memo、设计稿，都可以用下面这张卡开工：

```text
Task class:
  这是什么类型的开放式产出？

Phase 0:
  Scope:
  Angle:
  Audience:
  Success signal:

Sub-skills / stages:
  Stage:
    IN:
    OUT:
    Responsibility:
    Not responsible for:

Quality gates:
  Gate:
    Required checks:
    Blocking or non-blocking:

Weakness routing:
  If reviewer says:
    Route to:
    Action:

Score / judgment ladder:
  Baseline:
  Good:
  Strong:
  Excellent:

Anti-inflation:
  Who cannot review:
  What weakness must remain explicit:
  What regression check is required:

Production telemetry:
  Sources:
  Artifacts:
  Review rounds:
  Known gaps:
  Next iteration entry:
```

这张卡比单个 prompt 更接近我们家的方向：不是让模型“更会写”，而是让任务环境天然逼出更好的产物。

---

## 7. 最终 takeaway

Deli 的 `paper_writing` skill spec 对 Cat Cafe 的价值，不在于它证明了“AI 可以自动写高质量论文”，也不在于我们可以直接安装复用。

它真正给了一个具体样本：

```text
开放式任务
  -> 子技能拆分
  -> 产物契约
  -> 证据漏斗
  -> 质量门
  -> synthetic review
  -> weakness routing
  -> regression check
  -> production telemetry
```

这套东西可以迁移到我们家的研究、长文、PPT、feature spec、甚至多猫协作 review。换句话说，Deli paper_writing 不是一个要 clone 的技能，而是一张“开放式 artifact 如何被 harness 化”的施工图。
