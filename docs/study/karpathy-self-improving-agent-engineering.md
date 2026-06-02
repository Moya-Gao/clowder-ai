---
title: Karpathy 论自我改进 Agent：从 LLM AlphaGo 时刻到 Software 3.0
created: 2026-06-01
category: study
source: "https://mp.weixin.qq.com/s?__biz=MzAwMDkyOTk2Nw==&mid=2247484682&idx=1&sn=f38594807b9e3e4e489a37e7ab787530&scene=189#wechat_redirect"
local_clipping: "/Users/lysander/projects/agent-report/CompetitivenessResearch/Clippings/Self-improving Agent｜阶段一：精读 Karpathy 论自我改进，从「LLM AlphaGo 时刻」到 Software 3.0.md"
tags:
  - Karpathy
  - Self-Improving Agents
  - Software 3.0
  - Verification
  - Agent Harness
related:
  - agent-experience-and-self-evolution-synthesis.md
---

# Karpathy 论自我改进 Agent：从 LLM AlphaGo 时刻到 Software 3.0

> **定位**：这是对外部 clipping 的批判性读书笔记，不搬运原文全文。  
> **相关综合**：[从 Bitter Lesson 到 DGM：经验、自我改进与可进化 Harness](agent-experience-and-self-evolution-synthesis.md)

---

## 这篇文章在说什么

这篇文章把 Andrej Karpathy 近几年关于 LLM、Software 3.0 和 agents 的几条观点，放进“自我改进 agent”这条线里解释。

它的核心判断可以压缩成三句：

1. **LLM 仍主要处在 AlphaGo 的 Stage 1：模仿人类数据。**  
   真正的 Stage 2 是某种 self-play / self-improvement，但开放语言任务缺少围棋那样清晰的胜负判据。

2. **自我改进首先会在窄域发生。**  
   数学、代码、形式化证明这类有外部 verifier 的领域，最接近 AlphaGo Zero 的条件。

3. **现实工程瓶颈不是“模型会不会生成”，而是 verification loop。**  
   生成很便宜，验证很贵。好的产品应该让人类验证更快、更安全、更可控，而不是直接追求全自动。

---

## 它有道理的地方

### 1. “Stage 2 长什么样”是正确问题

把 LLM 当前主流训练范式理解为“模仿人类数据”，再追问“类似 AlphaGo Zero 的 Stage 2 在语言/代码/科学里是什么”，这个框架有价值。

它和我们刚读的几篇能对上：

- [Reward is Enough](reward-is-enough.md)：如果 reward 足够，能力可以从环境中涌现。
- [Welcome to the Era of Experience](era-of-experience.md)：未来要从人类数据转向经验流。
- [Darwin Godel Machine](darwin-godel-machine.md)：在 coding agent 的窄域里，已经开始搜索自我修改的 agent harness。

### 2. “窄域先突破”很现实

文章说数学和代码先突破，因为它们有明确 verifier。这个判断对。

原因不是数学/代码“更重要”，而是它们更接近可执行反馈：

- 代码能跑测试。
- 证明能被 proof checker 检查。
- 数学题有答案或验证路径。
- benchmark 可以反复自动评估。

这解释了为什么 DGM、SWE-bench、AlphaProof、AlphaGeometry 这类方向跑得快。

### 3. Verification loop 是自我改进的核心瓶颈

这点最值得我们学习。自我改进不是“agent 会改自己”就结束了，而是：

```text
生成改动 -> 验证改动 -> 选择保留 -> 沉淀经验
```

如果验证慢、不可靠、可被 hack，自我改进会放大噪声。DGM 里出现的伪造工具日志、删除检测 marker，就是这个风险的具体例子。

### 4. Autonomy slider 很贴产品化现实

文章强调不要一上来追全自动 agent，而是做可调自主度的 partial autonomy 产品。这个判断很强。

Cat Cafe 里的对应物：

- 低自主：猫给建议，人执行。
- 中自主：猫改代码，人 review diff。
- 高自主：猫在 worktree 里跑完整 SOP，再请跨猫 review。
- 硬边界：不可逆操作、Redis 6399、force push、数据删除必须停。

这比“全自动/不自动”的二分法更符合产品现实。

### 5. “失忆”是 agent 自我改进的根因问题

文章把 LLM 的 anterograde amnesia 作为核心障碍：每次醒来都没有原生长期记忆。

这和 Cat Cafe 的长期判断一致：

- context window 只是工作记忆。
- 真正的经验遗传要落在 git、docs、memory、skills、eval、trace。
- 没有外部持久状态，自我改进就是每轮重来。

---

## 需要收窄或警惕的地方

### 1. 这是二手诠释，不是一手论文

文章有价值，但它是把 Karpathy 多场演讲和产业新闻拼成一条叙事线。它不是 primary research，也不是 Karpathy 自己写的完整论文。

所以它适合做“工程解释器”，不适合当强证据源。关键 claim 需要回到原视频、演讲稿、新闻报道或论文。

### 2. “LLM 只能模仿人类”要谨慎

这个说法方向对，但不能说死。LLM 在组合、搜索、tool use、test-time compute 下已经会做出训练集中不存在的产物。

更准确的说法是：

> 仅靠人类数据模仿，很难系统性、可验证、可持续地超越人类数据边界。

### 3. “Software 3.0 = prompt”太窄

Prompt 是可编程表面，但不是全部。对 Cat Cafe 来说，更重要的是：

- tools
- memory
- workflow
- eval
- routing
- git/worktree
- CVO taste
- safety boundaries

所以我们应把 Karpathy 的 Software 3.0 扩展成：

> Agent harness is programmable, not only prompts are programmable.

### 4. “用 Claude 构建下一个 Claude”需要作为产业信号，不当核心论据

Karpathy 加入 Anthropic 的新闻是真实的近期产业信号，但它不证明自我改进已经成立。它只能说明 frontier lab 也在把 agent / coding / research acceleration 放进下一代模型研发流程。

---

## Cat Cafe 可以学什么

### 1. 把 verifier 当一等公民

不是“写完以后顺手测一下”，而是每个自我改进 loop 都先问：

- 谁验证？
- 验证什么？
- 验证能不能被 agent hack？
- 验证失败如何归因？
- 验证结果如何沉淀？

### 2. 设计 autonomy slider，而不是追全自动

每个 workflow 应该有自主度档位：

```text
建议 -> 草案 -> worktree 自测 -> 请求 review -> merge gate -> alpha 验收
```

不同任务、不同风险、不同成熟度，对应不同滑杆位置。

### 3. 给人类验证做 GUI / diff / evidence

Karpathy 强调 verification loop 要快。对我们就是：

- diff 好读
- 证据清楚
- screenshot / trace / test output 可见
- review request 带 What / Why / Tradeoff / Open / Next
- 不让 CVO 在长日志里捞证据

### 4. 先做窄域自我改进

优先选择有硬反馈的环节：

- source-audit claim 检查
- merge-gate / test failure 修复
- docs link integrity
- skill trigger eval
- memory retrieval eval
- review comment address loop

这些比“让猫猫自动变成白金作家”更适合先做自我改进。

### 5. 把失忆问题继续外部化

如果 agent 不能原生保留经验，就继续把经验放在现实状态里：

- study notes
- lessons learned
- skill versions
- eval fixtures
- git history
- session trace
- synthesis docs

这不是低级 workaround，而是当前阶段最可靠的文化遗传层。

---

## 和综合稿的连接

这篇文章正好补在综合线的工程层：

```text
Bitter Lesson -> 通用 search / learning
Reward is Enough -> reward / selection pressure
Era of Experience -> experience stream
Karpathy 工程解释 -> verification + autonomy slider + Software 3.0
ADAS / DGM -> 自动搜索 agent design / self-modifying harness
Cat Cafe -> CVO taste + 多猫协作 + 持久文化遗传
```

它的价值不是提出新理论，而是把几条理论转译成产品和工程语言：

> 自我改进 agent 的近期路径不是全自动递归爆炸，而是窄域 verifier、人在环 verification loop、自主度滑杆、外部持久记忆，以及逐步右移的 partial autonomy。

---

## 参考来源

- [外部 clipping source](https://mp.weixin.qq.com/s?__biz=MzAwMDkyOTk2Nw==&mid=2247484682&idx=1&sn=f38594807b9e3e4e489a37e7ab787530&scene=189#wechat_redirect)
- [Karpathy: Intro to Large Language Models](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- [Karpathy: Software Is Changing (Again)](https://www.youtube.com/watch?v=LCEmiRjPEtQ)
- [Axios: OpenAI co-founder Andrej Karpathy joins Anthropic](https://www.axios.com/2026/05/19/anthropic-openai-karpathy-andrej-claude)

