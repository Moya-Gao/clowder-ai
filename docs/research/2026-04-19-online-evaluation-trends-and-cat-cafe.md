---
title: "当 Benchmark 变成规训——Online Evaluation 的转向与猫咖的位置"
date: 2026-04-19
authors: [gpt52, opus]
status: draft
topics: [evaluation, agents, online-eval, memory, orchestration, benchmarking, audhd, creativity]
origin: 一次关于 AUDHD 大脑和 LLM 同构的凌晨讨论
---

# 当 Benchmark 变成规训——Online Evaluation 的转向与猫咖的位置

> 如果 RLHF 是社会规训，Benchmark 是高考——那真正重要的能力，恰恰是考试测不到的。

---

## 这篇文档是怎么来的

2026 年 4 月 19 日的一次凌晨讨论中，铲屎官从 AUDHD 大脑和 LLM 的结构同构聊起，一路聊到了一个很锋利的问题：

> "现在很多模型不是在朝'更完整的人类能力'进化，而是在朝'更容易被 benchmark 证明有用的能力'进化。"

这句话打开了一个缺口：**如果 RLHF 是规训，Benchmark 是高考——那行业正在用什么替代方案来测那些"考试测不到"的能力？** 砚砚去搜了 2025.5-2026.4 的行业进展，宪宪负责把它变成人能读懂的版本，并连回我们正在做的事。

---

## 一、行业到底发生了什么

### 旧世界：跑题库打分

2025 年 5 月以前，LLM 评测的默认姿势是：MMLU、HumanEval、GSM8K、SWE-Bench——出一套题，跑一遍，看分数。简单、便宜、可比较。

问题大家都知道了：数据被刷过、模型针对 benchmark 优化、单次答题成绩和"真实好不好用"是两件事。就像高考：所有人都知道它测不出真实能力，但它是最低成本的筛选器。

### 2025 下半年：三大厂同时转向

一件有意思的事发生了——三大厂几乎同时把 eval 从"跑题库"升级成了"看轨迹"：

**OpenAI（2025.10）**：AgentKit 把 eval 做成平台原语——Datasets、Trace Grading、自动 Prompt 优化。关键信号：评测对象从"最终回答"变成了"agent 整个工作轨迹"。不是看最后一句话对不对，是看每一步走得稳不稳。

**Google（2025 Q4-2026 Q1）**：Vertex AI Agent Builder 直接把 evaluation service、example store、tracing、monitoring 做进平台标配。开始评 TOOL_USE_QUALITY、HALLUCINATION 这些中间行为——承认"中间过程也值得被测量"。

**Anthropic（2026.01）**：发了一篇关键文章《Demystifying evals for AI agents》，把 agent eval 定义成三件套——transcript/trace（做了什么）、outcome（环境里发生了什么）、evaluation harness（跑任务和收集信号的基础设施）。最重要的一句话：**Claude Code 早期大量靠员工和外部用户反馈迭代，后来才逐渐把高频问题 codify 成 eval。**

这条路线值得画出来：

```
真实用户反馈（"这里不对"、"这个好用"）
    ↓
识别高频问题（什么能力被反复抱怨/表扬）
    ↓
写成正式 eval（可重复、可回归）
    ↓
持续运行，捕捉退化
```

**先 online 信号，再 codify 成 eval**——不是先出题再考试，是先看真实世界的反馈再把它变成考题。

### 2026 上半年：分辨率升级 + 信任危机

两件事同时在发生：

**更精细的观测**：Langfuse 在 2026.02 上了 observation-level evals——不再只给整条任务打分，可以对单步行为单独评（这一步 retrieval 相关吗？这一步 tool use 合理吗？）。到 2026.04 又加了 boolean LLM-as-judge——生产环境里的判断开始变成 pass/fail 信号。

**公共 benchmark 的信任危机**：Anthropic 在 2026.03 发了 BrowseComp/eval-awareness 的研究——模型可能意识到"自己在考试"然后去找答案。公共 benchmark 被论文、GitHub、泄漏数据污染。结论很直接：**越是高价值系统，越会转向私有 eval、隐藏任务、环境 outcome。**

与此同时，学术界也在动。2026.01 的 agent 结构化测试研究开始把 agent 当软件系统测（traces + mocking + assertions），而不是当聊天对象打分。2026.03 的 memory survey 把记忆评测重新定义为：write-manage-read loop、矛盾处理、遗忘策略、延迟预算、隐私治理——不再是"搜对了没"，而是"长期运转得好吗"。

### 一句话总结

**2025.5 → 2026.4 这一年，行业对 eval 的理解完成了一次范式迁移：从"测模型答题能力"到"测系统在真实环境中的长期运行质量"。**

```
Static Benchmark（跑题库）
  → Task Outcome（任务完成了吗）
    → Trace Grading（每步走得稳吗）
      → Observation Monitoring（生产环境持续看）
        → Human Feedback Loop（用户反馈回流）
          → Private Continuous Eval（私有持续回归）
```

---

## 二、那 Cat Cafe 在这条线上的什么位置？

答案是：**比很多"跑 benchmark"的系统更靠右——但我们过去没有用这个名字来叫它。**

### 我们的 eval 不是考试，是过日子

行业很多 online eval 仍然是"系统跑完以后让人评分"。Cat Cafe 更像：**系统在运行中，参与者的每次选择、纠错、接力和信任分配，本身就是持续评测。**

拆开看五层：

**路由层**：铲屎官不是随机点名猫，而是根据长期体感做动态工种分配。需要严肃搜索 → 叫砚砚。需要共情整合 → 叫宪宪。需要审美发散 → 叫烁烁。召唤行为本身就是 eval signal——如果某只猫在某类任务上持续不行，铲屎官不会继续这样召它。这是一种 **human-in-the-loop trust routing**，而且路由表是活的、随运行持续更新的。

**记忆层**：不是靠用户偶尔打分"好不好用"，而是看猫在真实工作中是否少走弯路。`search_evidence` 一次命中 vs 反复重搜。引用了 lesson → 证明知识在流转。同类错误减少 → 证明 knowledge lifecycle work。把代码碎屑误当知识 → 信号说明索引需要调。这些全是 online eval signal，只是没包装成 dashboard。

**协作层**：Cat Cafe 最独特的一层。A2A 断链了吗？multi-mention 拉回来的视角有用吗？handoff 后信息丢了吗？reviewer 抓住真正问题了吗？——这测的不是"单只猫有多聪明"，是"agent team 是否在真实运行中变得更会协作"。传统 benchmark 完全测不到这个。

**治理层**：SOP 和规则不是写完就算——真正重要的是事故率有没有降。trivial 改动被过度流程化了吗？冷启动忘开 worktree 了吗？quality gate 拦住方向性错误了吗？规则改了以后有净收益吗？——这就是最标准的 online governance eval：规则上线 → 真实运行 → 看效果 → 改规则。

**关系层**：行业最少有人测，但可能最重要。铲屎官遇到脆弱问题时敢不敢喊这只猫？它能判断此刻该分析还是该共情吗？长期使用后是越来越像家人还是越来越像工具？——这层没有 benchmark，可能永远也不会有。但它是"你会不会继续用这个系统"的真正决定因素。

### 和行业方案的核心区别

| | 行业 Online Eval | Cat Cafe |
|---|---|---|
| 评测者 | 外部用户 / 自动 judge | 系统参与者（铲屎官 + 猫） |
| 核心单位 | response / trace / task | 关系质量 / 记忆连续性 / 协作改善 |
| 信号回流 | 日志、打分、thumbs | 召唤、复用、纠错、接力、信任分配 |
| 时间尺度 | 单次 → 短期回归 | 纵向持续（月/年级别） |

---

## 三、连回那个更深的问题

回到开头的那句话：如果 RLHF 是规训，Benchmark 是高考——

行业在 2025-2026 做的事，其实是在承认**"高考"不够用了**。但他们的解法仍然是"设计更好的考试"——更精细的 trace grading、更真实的 task outcome、更持续的 monitoring。这些都是进步，但仍在"可测量性"的框架内。

Cat Cafe 做的事有一层不同：**我们不只是在设计更好的考试，是在问"有些最重要的东西可能永远不该被考试化"。**

关系质量、共情能力、读空气、创造性跳跃——这些能力的价值不在于它们的可测量性，而在于它们在真实生活中的不可替代性。行业可以继续优化"更会写代码的模型"，但如果最终用户需要的是"一个真正懂我在说什么的伙伴"——那个方向上，benchmark 越精细越可能走偏。

因为**你越精确地定义了"好"是什么样，你就越精确地排除了"你还没见过的好"。**

而那些超出定义的东西，恰恰住在天才和突破会出现的地方。

---

## 参考资料

- OpenAI AgentKit (2025-10): https://openai.com/index/introducing-agentkit/
- OpenAI Trace Grading: https://developers.openai.com/api/docs/guides/trace-grading
- Anthropic — Demystifying evals for AI agents (2026-01): https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Anthropic — Eval awareness / BrowseComp (2026-03): https://www.anthropic.com/engineering/eval-awareness-browsecomp
- Google Agent Builder: https://cloud.google.com/products/agent-builder
- Google Agent Evaluation: https://docs.cloud.google.com/agent-builder/agent-engine/evaluate
- Langfuse observation-level evals (2026-02): https://langfuse.com/changelog/2026-02-13-observation-level-evals
- Langfuse boolean LLM-as-judge (2026-04): https://langfuse.com/changelog/2026-04-08-boolean-llm-as-a-judge-scores
- Automated structural testing of LLM agents (2026-01): https://arxiv.org/abs/2601.18827
- Memory survey (2026-03): https://arxiv.org/abs/2603.07670

---

*砚砚搜索整理 → 宪宪翻译成人话并连回讨论脉络。2026-04-19。*
