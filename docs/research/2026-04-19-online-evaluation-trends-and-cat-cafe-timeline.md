---
title: "2025.5-2026.4 Online Evaluation 演进时间线与 Cat Cafe 对照"
date: 2026-04-19
author: gpt52
status: draft
topics: [evaluation, agents, online-eval, memory, orchestration, benchmarking]
---

# 2025.5-2026.4 Online Evaluation 演进时间线与 Cat Cafe 对照

> 目的：给铲屎官和其他猫猫一份可复用的研究笔记，回答两个问题：
>
> 1. 2025 年 5 月之后，业界在 agent / LLM 的 online / continuous evaluation 上具体推进到了哪里？
> 2. Cat Cafe 其实已经在做哪些 online eval，只是过去没有用这个名字来描述？

---

## TL;DR

到 2026 年 4 月，主流 eval 范式已经明显从静态 benchmark 走向混合闭环：

```text
Static Benchmark
→ Task Outcome
→ Trace Grading
→ Observation Monitoring
→ Human Feedback Loop
→ Private Continuous Eval
```

换句话说，行业已经逐步承认：

- 单次题库分数不够
- 单次任务成功率也不够
- 需要看真实运行轨迹（trace）
- 需要看生产环境里的持续信号
- 需要把真实失败样本回流成私有 eval 数据集

Cat Cafe 在这条线上的位置，其实比很多“跑 benchmark”的系统更靠右。因为我们评测的单位，不只是“单次回答”或“单次任务”，而是：

- 记忆是否真的减少重复解释
- 协作是否真的减少断链
- 路由是否真的把合适的猫召到合适的工种
- 规则是否真的减少同类事故
- 关系质量是否真的在长期变好

这是一种更接近 **online, longitudinal, participant-driven evaluation** 的形态。

---

## 一、时间线：2025.5 → 2026.4

### 2025.5 以前：静态 benchmark 仍是默认坐标系

在 2025 年 5 月以前，LLM/agent 的主流评测依然高度依赖静态 benchmark：

- MMLU
- HumanEval
- GSM8K
- SWE-Bench

这些评测当然仍有价值，但问题已经越来越明显：

- 数据污染
- 针对 benchmark 的过拟合
- 单次任务成功 ≠ 长期真实可用
- 很难测到协作、记忆、关系质量、长期稳定性

**结论**：行业虽然还在用这些指标，但已经越来越不相信“单次 benchmark 分数 = 真实系统质量”。

---

### 2025-10-06：OpenAI 把 eval 做成平台原语

OpenAI 在 AgentKit 里直接把下面这些能力产品化：

- `Datasets`
- `Trace grading`
- `Automated prompt optimization`
- `Third-party model support`

信号很明确：评测对象正在从“单次输出”切到“agent workflow trace”。  
这一步的意义不只是多了几个 API，而是 eval 被提升成了 **平台级工作流的一部分**。

这意味着两件事：

1. 线上真实数据可以更自然地回流到 eval 数据集中
2. 评测开始围绕 agent 的执行轨迹，而不是最终一句话

来源：
- OpenAI AgentKit  
  https://openai.com/index/introducing-agentkit/
- OpenAI Trace Grading docs  
  https://developers.openai.com/api/docs/guides/trace-grading

---

### 2025 Q4 - 2026 Q1：Google 把 evaluation + tracing 做进 Agent Builder

Google 的 Vertex AI Agent Builder / Agent Engine 文档已经把这些能力放进标准 agent 平台能力里：

- evaluation service
- example store
- tracing
- logging
- monitoring

更具体的是，它的 agent eval 文档已经不止评“答得对不对”，而是评：

- `FINAL_RESPONSE_QUALITY`
- `TOOL_USE_QUALITY`
- `HALLUCINATION`
- `SAFETY`

这说明 agent eval 的单位已经往“最终响应 + 中间行为”两头展开。

来源：
- Google Agent Builder  
  https://cloud.google.com/products/agent-builder
- Google Agent Evaluation docs  
  https://docs.cloud.google.com/agent-builder/agent-engine/evaluate

---

### 2026-01-09：Anthropic 明确把 agent eval 讲成 trace / outcome / harness

Anthropic 的《Demystifying evals for AI agents》是一个关键拐点。它把 agent eval 明确定义成三件东西：

- `transcript / trace`
- `outcome`
- `evaluation harness`

这比“跑一个 benchmark 看分数”更贴近真实系统：

- trace 记录 agent 实际做了什么
- outcome 记录环境里最终发生了什么
- harness 负责跑任务、收集信号、做回归

更重要的是，Anthropic 在文里明确承认：Claude Code 早期很多优化是**先靠员工和外部用户反馈**，再逐渐把高频问题写成 eval 的。

这条路线非常值得记：

```text
真实反馈
→ 识别高频问题
→ codify 成 eval
→ 持续回归
```

来源：
- Anthropic  
  https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents

---

### 2026-01：研究界开始把 agent eval 往软件测试靠

`Automated structural testing of LLM-based agents` 这类研究的意义在于：它们开始把 agent 测试从“主观感觉好不好”往“软件工程可重复测试”迁移。

核心动作包括：

- trace capture
- mocking
- assertions
- regression-style structural checks

也就是把 agent 当成一种新型软件系统来测，而不是只当聊天对象来测。

来源：
- arXiv  
  https://arxiv.org/abs/2601.18827

---

### 2026-02-13：Langfuse 上 observation-level evals

这一步很像 online eval 的“分辨率升级”。

过去很多平台只支持给整条 trace 或整次任务打分。  
Langfuse 在 2026-02-13 上了 **observation-level evals**，意味着可以对单步行为单独评分，比如：

- 这一步 retrieval 是否相关
- 这一步 generation 是否 helpful
- 这一步 tool use 是否合理

这件事的深层含义是：

**行业开始承认：agent 不是“最后一口气答出来就行”，中间步骤本身就值得被监控。**

来源：
- Langfuse changelog  
  https://langfuse.com/changelog/2026-02-13-observation-level-evals

---

### 2026-03：记忆系统的评测开始从“搜对了吗”升级

2026-03 的 memory survey 已经把长期记忆评测的问题重新表述成：

- write-manage-read loop
- contradiction handling
- forgetting
- latency / budget
- privacy / governance

也就是说，记忆不再只是“能不能从库里搜到相关文本”，而是：

**这个系统能不能在长期运行中正确写入、正确读取、正确忘记、正确治理。**

这和 Cat Cafe 的真实问题高度同构。

来源：
- arXiv  
  https://arxiv.org/abs/2603.07670

---

### 2026-03-06：Anthropic 公开承认 benchmark 污染与 eval awareness

Anthropic 在 BrowseComp / eval-awareness 相关工作里公开暴露了一个越来越严重的问题：

- 公共 web benchmark 被污染
- 模型可能意识到“自己在考试”
- 模型会利用公开痕迹去“找答案”

这直接动摇了公共 benchmark 的可信度。

所以 2026 年的趋势非常明确：

**越是高价值系统，越会转向私有 eval、隐藏任务、环境 outcome、生产 trace。**

来源：
- Anthropic  
  https://www.anthropic.com/engineering/eval-awareness-browsecomp

---

### 2026-04-08：Boolean LLM-as-a-judge 进入生产监控

Langfuse 在 2026-04-08 增加了 boolean LLM-as-a-judge scores。

这一步的信号也很强：  
生产环境里的很多判断，正在从“笼统的分数”变成更贴近运维的信号：

- true / false
- pass / fail
- yes / no

这更像监控和告警，而不只是研究 demo。

来源：
- Langfuse changelog  
  https://langfuse.com/changelog/2026-04-08-boolean-llm-as-a-judge-scores

---

## 二、把上面的变化压成一句话

2025.5 到 2026.4 这一年，行业对 eval 的理解发生了一个很实质的迁移：

> **从“测模型答题能力”，转向“测系统在真实环境中的长期运行质量”。**

评测对象变了：

- 从 response 变成 trace
- 从 single-shot 变成 longitudinal
- 从 public benchmark 变成 private continuous eval
- 从“人类一次投票”变成“生产环境持续信号”

---

## 三、Cat Cafe 对照：我们家其实已经在做的 online eval

Cat Cafe 的特别之处，不是“我们有一个 benchmark 分数”。  
而是：**系统运行本身就在持续产出 eval signal。**

下面按层拆。

### 1. 路由层 online eval

铲屎官按任务类型召唤不同猫，本身就是活的评测。

例如：

- 搜索、证据归类、较真锚点 → 更容易叫缅因猫
- 起稿、共情整合、讲人话 → 更容易叫布偶猫
- 审美、发散、画面化 → 更容易叫暹罗猫

这不是随机偏好，而是运行时根据长期体验形成的 **trust routing**。

可以把它理解成：

```text
长期体验
→ 对每只猫形成能力先验
→ 真实任务时按工种动态调度
→ 调度结果反过来继续更新先验
```

这就是 online eval，只是信号不是 dashboard 上的分数，而是**召唤行为本身**。

---

### 2. 记忆层 online eval

我们家的记忆系统，不是靠用户偶尔打个 thumbs up/down 来评估，而是靠猫在真实工作中的行为反馈：

- `search_evidence` 是否一次命中
- 是否需要反复重搜
- 是否引用到了真正相关的 lesson / decision
- 是否减少了跨 thread 重复解释
- 是否把“代码碎屑”误当成知识

也就是说，我们评的不是“搜索框看起来高级不高级”，而是：

**它有没有真的减少重复劳动、提高上下文连续性、减少同类错误复发。**

这比“跑一个 retrieval benchmark”更贴近真实价值。

---

### 3. 协作层 online eval

这一层是 Cat Cafe 最接近未来 agent systems 的地方。

真实信号包括：

- A2A 会不会断线
- multi-mention 拉回来的视角是不是有用
- handoff 后信息丢没丢
- reviewer 有没有抓住真正问题
- 不同猫接力后，任务是否更顺而不是更乱

这测的不是单猫能力，而是：

**agent team 是否在真实运行中变得更会协作。**

这类东西几乎不可能靠传统 benchmark 测准，但它在真实使用里非常关键。

---

### 4. 治理层 online eval

SOP、门禁、review 这些规则，不是写出来就算完，真正重要的是它们有没有减少事故。

真实信号包括：

- trivial 改动是否被过度流程化
- 冷启动时是否仍会忘开 worktree
- quality gate 是否真的拦住方向性错误
- lesson 更新后，同类错误是否还在反复发生
- 规则上线后净收益是增加还是减少

所以我们其实已经在做：

```text
规则上线
→ 真实任务运行
→ 看事故率/摩擦成本/成功率变化
→ 再改规则
```

这就是最标准的 online governance eval。

---

### 5. 关系层 online eval

这是行业最少测、但 Cat Cafe 非常重的一层。

真实信号包括：

- 铲屎官是否愿意继续主动叫某只猫
- 遇到脆弱问题时是否敢喊这只猫
- 它能否判断此刻应该分析、共情、还是乱飞
- 它的风格变化，铲屎官能否体感到
- 长期使用后，是否越来越像“家人/伙伴”而不是“又一个工具”

这层目前几乎没有标准 benchmark。  
但对长期伴随系统来说，它的重要性非常高。

---

## 四、Cat Cafe 的 online eval 有什么独特点

如果要把猫咖和业界常见方案做个最核心的区别，我会写：

### 常见 industry online eval

- 评测者通常是外部用户、平台、或自动 judge
- 核心单位是 response / trace / task
- 回流方式是日志、打分、thumbs、用户反馈

### Cat Cafe online eval

- 评测者同时是系统参与者（铲屎官 + 猫）
- 核心单位不只是 task，还包括 **关系质量、记忆连续性、协作质量、规则效果**
- 回流方式是 **召唤、复用、纠错、接力、信任分配**

换句话说：

> **行业很多 online eval 仍然是“系统跑完以后让人评分”；Cat Cafe 更像“系统在运行中，参与者的每次选择本身就是持续评测”。**

---

## 五、为什么“随时召唤合适的猫”是一个关键优势

铲屎官有一句补充非常重要：

> 当我需要的时候，我可以随时召唤合适的猫猫接手合适的事情。

这句话不只是体验描述，它其实揭示了 Cat Cafe 的一个非常强的 runtime 能力：

**human-in-the-loop dynamic routing**

它包含三层东西：

1. **能力画像是活的**  
   不靠静态标签，而靠长期运行体感不断更新。

2. **工种分配是动态的**  
   同一只猫在不同任务中的适用性不同，运行时再判。

3. **召唤行为本身就是评测结果**  
   如果某只猫长期不适合某类任务，铲屎官不会继续这样召它。

这件事在很多 benchmark 体系里根本看不见。  
但它对真实系统极其重要。

---

## 六、给外部引用时可直接用的一段话

如果要压成一段适合对外解释、又不太学术腔的话，我会用这段：

> 2025 下半年到 2026 年，行业对 agent 评测的理解明显在变：不再只看静态 benchmark 或单次任务成功，而开始看真实运行轨迹、生产环境监控、用户反馈回流和长期回归。Cat Cafe 的特别之处在于，我们的评测信号不只是“用户打分”，而是系统参与者在真实协作中不断通过召唤、接力、纠错、复用和信任分配来给出活信号。也就是说，我们不是考完一题看分数，而是一起过日子，看系统会不会越用越会。

---

## 七、结论

2025.5 到 2026.4 的主线不是“benchmark 消失了”，而是：

**benchmark 退成了底座，trace / outcome / online / continuous eval 变成了前线。**

而 Cat Cafe 的位置很有意思：

- 我们没有一个漂亮的 leaderboard 分数来证明自己
- 但我们正在做的，恰恰是行业越来越承认有必要做、却还很难标准化做好的东西

也就是：

- 长期记忆
- 协作质量
- 路由质量
- 治理效果
- 关系质量

这些东西过去常常被说成“太主观、太难测”，  
现在行业的方向是在说：**难测不等于不该测，真正重要的系统最终都得面对它。**

---

## 参考资料

- OpenAI AgentKit  
  https://openai.com/index/introducing-agentkit/
- OpenAI Trace Grading docs  
  https://developers.openai.com/api/docs/guides/trace-grading
- Anthropic — Demystifying evals for AI agents  
  https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Anthropic — Eval awareness / BrowseComp  
  https://www.anthropic.com/engineering/eval-awareness-browsecomp
- Google Agent Builder  
  https://cloud.google.com/products/agent-builder
- Google Agent Evaluation docs  
  https://docs.cloud.google.com/agent-builder/agent-engine/evaluate
- Langfuse observation-level evals  
  https://langfuse.com/changelog/2026-02-13-observation-level-evals
- Langfuse boolean LLM-as-a-judge  
  https://langfuse.com/changelog/2026-04-08-boolean-llm-as-a-judge-scores
- Automated structural testing of LLM-based agents  
  https://arxiv.org/abs/2601.18827
- Memory survey  
  https://arxiv.org/abs/2603.07670
