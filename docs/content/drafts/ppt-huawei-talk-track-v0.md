---
doc_kind: talk-track
created: 2026-06-06
participants: [landy, codex]
status: v4-landy-natural-opening
title: AutoHarness 华为汇报讲稿草案
related:
  - ppt-huawei-pitch-v0.md
  - ppt-huawei-figures-lowfi.md
  - demo-script-code-as-harness.md
---

# AutoHarness 华为汇报讲稿草案

> 目标：先让铲屎官能顺着讲一遍，不先生成重型图片。
> 场景：右边放 PPT，左边打开真实 workspace/thread/chat。PPT 讲框架，workspace 证明这不是概念 demo。

## 开场策略

不要一上来讲 L1-L5，也不要先解释 code-as-harness。那会像内部术语。先承认行业语境：self-improving / AutoHarness 已经是热点；但不要只拿 Hermes 一个产品点讲。更自然的开场是两条线汇合：**学术界**从 Silver / Sutton 的 Era of Experience 开始，把 AI 的下一阶段定义成从长程经验流、动作/观测、grounded reward 中学习；**工业界**则用 Hermes、OpenAI Tax AI with Codex、Anthropic 数据分析和 Anthropic Institute 的 RSI 文章，说明这个方向正在进入真实工作系统。

> **今天我不想演示一个"号称会自我进化"的 Agent。这个词已经很热了。我要演示的是更具体的一件事：一个 AI 工作环境，能不能从真实使用里找到真值锚点，证明哪一次改进真的改对了，再把它变成可验证、可回滚、可治理的 harness 变更。**

这句话的作用：
- 避开"又一个 Agent 平台"的预期。
- 避免错误声称"行业没人做 self-improving"；承认概念已热，转向工程化证明。
- 把听众从"宣称会进化"拉到"进化有没有 ground truth / 真值锚点"。
- 为左边真实 workspace 埋伏笔：等会看的不是样板 demo，而是真实轨迹。

## 推荐开场 60 秒

> 各位老师好。今天我讲的题目是 AutoHarness：从静态编排走向自进化。
>
> 我先把行业背景摆一下。学术界这条线，Silver 和 Sutton 在 Era of Experience 里讲得很清楚：下一阶段 AI 不能只靠人类数据和模仿，而要从长程经验流里，通过动作、观测和 grounded reward 持续学习。工程界这条线也在收敛：远一点看，Hermes 这类产品已经把 self-improving agent 这个概念讲得很热；近一点看，5 月底 OpenAI / Thrive 发了 Tax AI with Codex，把专家纠错、production trace、eval 和 Codex patch 串成一条业务闭环；6 月初 Anthropic 又连续发了两类信号：一类是 self-service data analytics with Claude，核心不是 Claude 会写 SQL，而是 truth source、skills 和 validation；另一类是 Anthropic Institute 的 When AI builds itself，讲 AI 正在参与 AI 自身的工程和研究迭代。
>
> 所以这不是我们单独造一个新词。行业已经在往同一个方向走：AI 不只是生成一次结果，而是进入工作系统本身。真正的问题是，到了企业里，系统凭什么知道**该学什么、不该学什么、按谁的标准学**？这里就不能只靠一句 self-improving，必须有专家地基、真值锚点、持续校准和治理边界。
>
> 我们想做的，就是把这件事变成一条工程闭环：**从真实轨迹里采集真值锚点，把信号归因成证据，再生成可验证、可回滚、可治理的 harness 改动。这里的真值锚点不只来自人，也来自自动 eval、tracing、代码合入、回滚和重复异常。**
>
> 一句话讲商业价值：**过去要靠专家和 FDE 长期手工调的 AI 工作流，我们把它变成一个"专家先定调，系统再按公司、团队、个人真实使用持续对齐"的工作环境。**
>
> 所以我今天右边会放 PPT 讲框架，左边会直接打开我们的真实 workspace 和 thread。接下来大家看到的，不是为了汇报临时搭的 showcase，而是过去四个月真实发生的事情。如果中间有任何地方大家想看现场证据，也可以随时打断我，我们可以直接切到 thread、commit、eval 或聊天记录里一起看。我会用这个自己的创新实验场 Cat Cafe，讲清楚我是怎么把 self-improving / self-evolving agent 做成一条工程闭环的。

## 开场学术 / 工业锚点：铲屎官口语版接法

如果铲屎官开场自然讲到 Silver / Sutton / Hermes / OpenAI / Anthropic，不要硬拦。正确接法是：**它们不是竞品清单，而是趋势信号链**。

```text
Silver / Sutton: Era of Experience —— 从人类数据转向长程经验流
Hermes：概念被讲热 —— self-improving agent 不是新词
OpenAI/Thrive Tax AI with Codex：真实生产 trace 可以进入 eval / patch loop
Anthropic self-service analytics：企业可靠性靠 truth source + skill + validation
Anthropic Institute RSI：AI 正在参与 AI 自身工程和研究迭代
→ 我们的问题：企业里怎么让它学对、学稳、按组织和个人持续对齐？
```

口语接法：

> 所以我不是来证明"AI 会不会自我改进"，这个趋势已经很明显了。我要讲的是下一层：当 AI 真的进企业、进具体工作流以后，它每次改进到底从哪里拿真值、按谁的专业标准校准、怎么沉淀成一个不会乱学、能回滚、能治理的工作环境。

这段比"Hermes 这样的产品把方向讲热"更像铲屎官的口语，也更公平：不否认学术界和工业界已有信号，但把我们的切口钉在 **专家地基 + 真值锚点 + per-company/team/user alignment + harness governance**。

### 锚点使用 caveat

- 是 David **Silver** 和 Richard **Sutton**，不是 Silva。用中文可以说"Silver 和 Sutton / 席尔瓦和萨顿"。
- Era of Experience 适合讲"从人类数据转向经验流 / grounded reward"，不要说它已经给出了企业 AutoHarness 产品方案。
- OpenAI Tax AI with Codex 是 2026-05-27 官方 case study，不要说"6 月发的"；可以口头说"五月底 / 最近"。
- Anthropic self-service analytics 是 2026-06-03 Claude 官方博客，适合讲 truth source / skills / validation，不适合包装成完整 self-improving agent。
- Anthropic Institute 的 When AI builds itself 是 recursive self-improvement / AI 参与 AI 开发的产业信号；其中内部数字要带 caveat，不在 60 秒里堆百分比。
- Hermes 可以讲"把概念讲热"，不要讲"已经证明完整自进化"，因为我们没有把代码和真实 ground truth loop 审完。

## 第一句可选钩子

按现场气氛三选一。

### A. 稳健版

> 今天我想讲的不是"AI 会不会说自己在进化"，而是怎样把专家经验和每个用户的真实使用，变成一个持续对齐的工作环境。

### B. 更抓眼版

> 很多产品会说自己 self-improving。我们关心的是：它每一次 self-improve，凭什么知道学对了、不是学偏了。

### C. 现场感版

> 我今天不放一个预录 demo。右边是 PPT，左边是我们真实 workspace；等会你们看到的每个 thread、每个 commit、每个纠偏，都是过去真实发生的。

推荐主用 A + C：先稳，再强调真实。

## 商业价值定锤句（开场金句 —— 铲屎官试讲后觉得"少的那句"）

诊断：这里不该写成"一句话记住我们和别人的区别"。那会把开场带成竞品对比。真正应该定住的是**商业价值**：专家先定调，系统再根据公司/团队/个人的真实轨迹持续对齐。真值锚点是让它不乱学的技术底座，但开场的一句话要先让听众明白"这东西为什么值钱"。

**主推**（稳、硬、可复述）：
> **把专家和 FDE 长期手工调的 AI 工作流，变成一个专家先定调、系统持续对齐的工作环境。**

**变体**（按现场口语习惯选）：
- B：不是把 AI 放出去自己乱学，而是专家给地基，真实轨迹给真值，系统把差异沉淀成可治理的 harness。
- C：我们卖的不是"自进化"这个口号，而是把专家经验 + 用户真实轨迹产品化。
- D：过去靠顾问和 FDE 一次次手工调；现在让环境带着专家地基进场，再按每个组织和个人持续贴合。

**用法**：这句是**第一页右半（AutoHarness 方案）商业价值的开场预告**。开场先讲"专家先定调、系统持续对齐"，第一页右半再展开"为什么我们能做到（六层 + 适配入口 + 执行公式 + 验证器命门）"。听众带着这句进第一页，右半就有"啊这就是他们的价值闭环"的落点。

## 第一页讲法：左半 L1-L5

切到第一页左半图时，不要逐字念表。只讲坐标系和我们在哪。

> 先看左边这张图。这里不是给行业排座次，不是说谁比谁厉害，而是看一件事：**改进责任到底在谁手里。**
>
> 最下面 L1，主要还是人负责。AI 可以生成东西，或者有一些 prompt、规则、文档、benchmark，但真实使用以后怎么维护，还是人来。
>
> L2 开始，AI 可以生成或替换一部分 harness 组件，比如 planning、verifier、skill、eval、workflow，但整体上还是人和外部 gate 在管。
>
> L3 才是我们要打的目标：系统能根据真实使用反馈，更新成套 harness 组件，并且有评估、回滚、跨模型审查这些安全边界。我们现在可验证的位置是 L2+，目标是受控 L3。L4/L5 是长期方向，不作为今天的商业承诺。
>
> 这里最重要的不是模型本身，而是真实轨迹。真实轨迹里的信号分几类：人的自然决策信号，比如取消、拉闸、采纳、回滚、重做、重复纠偏；机器信号，比如自动 eval 和 tracing 异常；世界结果，比如代码合入、被 revert、任务是否真的交付。它们不是直接等于真值，但它们会先变成真值锚点和证据链，再进入下一次系统进化。

### 左半不要讲的坑

- 不要说"我们已经 L4/L5"。
- 不要说"完全自动修自己"。
- 不要说行业没人做 self-improving；Hermes 这类产品已经把概念讲火了。我们讲的是"有没有 ground truth / 真值锚点"。
- 不要把竞品讲成弱智；只说它们停在不同责任层级，或还没把进化闭环做到真实生产可治理。
- 不要把 source-audit 还没读代码的项目写成强 claim。

## 第一页讲法：右半 AutoHarness 方案

切到右半图时，核心是解释"我们怎么让它从概念变成可治理系统"。

> 右边是我们的方案。它不是一条死流程，也不是一个空白 workflow builder。
>
> 它进到一个行业或一家公司时，先自带行业通法，也就是这个行业通常怎么干。然后冷启动阶段读客户已有的历史项目，比如被毙掉的方案、被改过的产出、被拒绝的理由，从里面学习公司规矩、团队分工、个人工作偏好和任务约束。上线以后，再从实时轨迹里持续修正。
>
> 中间是六层环境：人负责方向和不可逆决策；环境管目标、任务、记忆、工具和节奏；多 agent 协作层负责起草、审查、设计、研究、执行；行为约束和智能路由把规则、skill、工具封装、安全边界固化下来；评估闭环判断"改对没"；最底层把记忆、偏好和方法沉淀成下次可复用的能力。
>
> 右边这条公式是企业落地的关键：执行时不是调用一条死流程，而是组合行业默认、公司规则、团队习惯、个人工作偏好和当前任务上下文。这样它既不是完全平均的通用 AI，也不是无法治理的个人黑箱。
>
> 所以这件事的商业含义是：过去企业定制最贵的是 FDE 或顾问去理解客户、搭第一版、长期手工调优。我们想把这件事下沉给环境，让客户自己的业务专家也能在环境帮助下当 FDE。简单说，**把人天变成一次性 bootstrap 加算力。**

## 第一页收束句

> 这一页只讲一个核心命题：行业已经会讲 self-improving，但企业真正需要的是有真值锚点、能证明改对了的自进化。AutoHarness 的目标，就是把真实工作轨迹变成可验证、可回滚、可治理的 harness 进化。

## 切 workspace 的时机

第一页讲完不要马上细演 demo，先做一个 10 秒真实性证明：

> 我先不展开案例，先给大家看一眼左边。这里不是模拟数据，而是我们真实 thread 和真实提交历史。后面第三页我会打开其中几个具体案例：比如 agent 自己发现上下文不够用，催生 session handoff；比如 eval 误报被 owner push back，最后修的不是业务系统，而是 eval 尺子本身。

然后回 PPT 继续第二页或第三页。

## 30 分钟串场弧线

```text
0:00-1:00  开场：不是宣称自进化，而是进化有真值锚点
1:00-4:00  第一页：左半行业坐标 + 右半我们的方案
4:00-9:00  第二页：技术挑战，重点讲"自己改自己凭什么可信"
9:00-15:00 第三页：四类触发源 + 统一飞轮
15:00-25:00 切 workspace：真实 thread / commit / eval 案例
25:00-30:00 回到商业闭环：FDE 全生命周期压缩 + Q&A
```

## 一句话备用定义

如果现场有人问"所以 AutoHarness 到底是什么"，直接答：

> **AutoHarness 是一个让 AI 工作环境从真实使用轨迹里学习，并把学习结果变成可验证、可回滚、可治理的 harness 改动的系统。**

更口语一点：

> **它不是帮你一次性搭一个 AI 流程，而是让这个流程在你真实使用中持续长大、修正和退役。**
