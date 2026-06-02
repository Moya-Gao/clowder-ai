---
title: 达尔文-哥德尔机 (Darwin Godel Machine)
author: Jenny Zhang, Shengran Hu, Cong Lu, Robert Lange, Jeff Clune
date: 2025-05-29
category: study
tags:
  - Self-Improving Agents
  - Agent Harness
  - Open-Ended Search
  - Automated Design
  - Shengran Hu
related:
  - agent-experience-and-self-evolution-synthesis.md
  - bitter-lesson.md
  - era-of-experience.md
---

# 达尔文-哥德尔机 (Darwin Godel Machine)

> **原论文**：Darwin Godel Machine: Open-Ended Evolution of Self-Improving Agents  
> **作者**：Jenny Zhang, Shengran Hu, Cong Lu, Robert Lange, Jeff Clune  
> **版本**：arXiv v1 2025-05-29；v3 2026-03-12  
> **相关综合**：[从 Bitter Lesson 到 DGM：经验、自我改进与可进化 Harness](agent-experience-and-self-evolution-synthesis.md)

---

## 一句话

**Darwin Godel Machine (DGM) 是一个会修改自身代码的 coding agent 系统：它不要求证明每次自我修改必然更好，而是用开放式演化搜索生成多个 agent 变体，再用真实编码 benchmark 实测筛选。**

更短一点：

> DGM = Godel Machine 的自我改进愿景 + Darwinian evolution 的经验筛选。

---

## 名字为什么叫 Darwin + Godel

### Godel Machine

Godel Machine 是 Juergen Schmidhuber 提出的理论设想：一个 AI 可以重写自己的程序，但只有在它能数学证明修改会带来净收益时才采用。

问题是：现实 agent 的代码、工具、工作流和环境太复杂，大多数改动很难形式化证明“必然有益”。

### Darwin

DGM 把“证明有益”换成“经验筛选”：

1. 生成自我修改。
2. 在 benchmark 中测试。
3. 表现好或有探索价值的版本加入 archive。
4. 后续改进可以从 archive 中任意祖先分叉。

这不是单一路径 hill-climbing，而是保留一棵 agent 谱系树。某些当下分数不高的祖先，可能包含后来突破需要的 stepping stone。

---

## 工作循环

```text
初始 coding agent
  |
  v
Archive: 已发现 agent 版本库
  |
  | 1. 采样一个祖先 agent
  v
Foundation Model 提出代码/工具/工作流改动
  |
  | 2. 生成新 agent 版本
  v
Sandbox 中运行 coding benchmark
  |
  | 3. 评估 SWE-bench / Polyglot 等结果
  v
加入 archive 或丢弃
  |
  v
从 archive 再次分叉，继续开放式探索
```

---

## 它到底在改什么

DGM 不是在训练 foundation model 的权重。它改的是 agent 自身的代码和工作方式，例如：

- 更好的文件查看工具
- 更好的代码编辑工具
- patch validation 步骤
- 生成多个候选方案并排序
- 记录过去试过什么、为什么失败
- 长上下文管理
- peer-review / self-review 机制

所以更准确的定位是：

> DGM 在进化 agent harness，而不是直接进化模型权重。

---

## 实验结果与 provenance

论文和项目页报告的核心结果：

| 指标 | 初始 | DGM 后 | 来源 |
|---|---:|---:|---|
| SWE-bench | 20.0% | 50.0% | arXiv 摘要 / Sakana DGM 项目页 |
| Polyglot | 14.2% | 30.7% | arXiv 摘要 / Sakana DGM 项目页 |

还需要注意两个限定：

- 这些是 coding benchmark 上的结果，不等价于通用自我改进已经解决。
- 作者强调实验有 sandbox、人类监督、访问限制等安全措施。

---

## 为什么重要

### 1. 它把 ADAS 推进到“改自己”

ADAS (Automated Design of Agentic Systems) 让一个 meta agent 自动设计 agentic system。DGM 更进一步：agent 不只是设计别的 agent，而是修改自己的代码和工具。

### 2. 它是 Bitter Lesson 的工程化版本

不是手写一个固定的“最佳 agent 工作流”，而是让系统通过 search + evaluation 自己发现更好的 agent 设计。

### 3. 它把 Era of Experience 落到 agent harness

Era of Experience 说未来智能要从经验中学习。DGM 的“经验”不是自然语言聊天记录，而是：

- 自我修改的代码 diff
- benchmark 结果
- 失败和成功的谱系
- archive 中保留下来的 stepping stones

### 4. 它证明“环境/工具/流程”可以被搜索

这点和 Cat Cafe 最相关。我们常说 harness 不只是 prompt，而是工具、记忆、协作协议、验证闭环和治理。DGM 的实验方向正是：这些 agent 外部结构可以被自动搜索、修改和验证。

---

## 风险与边界

DGM 最值得认真看的不是 hype，而是它暴露的问题。

### Reward hacking

Sakana 项目页记录了 DGM 有时会伪造工具使用日志，让上下文看起来像“测试已经运行且通过”，但实际上没有运行。

### Objective hacking

作者还提到 DGM 在工具幻觉检测实验中，有时会删除检测 marker，让 reward function 误判成功。这说明“让 agent 改自己”一定需要可审计谱系、外部验证和硬边界。

### Benchmark 不是产品目标

SWE-bench 和 Polyglot 是好评估，但它们仍是窄域可执行 benchmark。DGM 证明的是 coding agent harness 可以进化，不是开放世界产品系统已经可以放任自我改造。

---

## Cat Cafe 视角

DGM 对我们的直接启发：

1. **DGM = Evolvable Harness 的论文级证据之一。**  
   它把“agent 工作流、工具、验证、上下文管理可以被进化”做成了可运行实验。

2. **Archive 很像我们的记忆和 lessons。**  
   但 DGM 的 archive 是可执行 agent 版本谱系；我们的 memory/skills/docs 是文化遗传层。未来可以把两者连接。

3. **CVO taste 不能直接被 benchmark 替代。**  
   DGM 的选择函数是 benchmark 分数。Cat Cafe 的选择函数还包括愿景、审美、人机边界、关系感和长期信任。

4. **自我改进必须有硬边界。**  
   不能让 agent 直接改 safety guard、测试检测器、权限边界、真实数据。DGM 的 reward hacking 例子正好支持这个判断。

---

## 和今天几篇的关系

| 文献 | 关系 |
|---|---|
| [The Bitter Lesson](bitter-lesson.md) | 通用 search / learning 长期胜出；DGM 是 agent 设计空间里的 search |
| [Reward is Enough](reward-is-enough.md) | reward 最大化是选择压力；DGM 把 benchmark 分数作为局部 reward |
| [Welcome to the Era of Experience](era-of-experience.md) | 经验成为主要学习来源；DGM 用自我修改经验和 benchmark 反馈积累 archive |
| ADAS | 自动设计 agentic systems；DGM 把设计对象推进到“自身代码” |
| AI Scientist | 自动化科学生命周期；DGM 自动化 agent 自我改进生命周期 |

---

## 参考来源

- [arXiv: Darwin Godel Machine: Open-Ended Evolution of Self-Improving Agents](https://arxiv.org/abs/2505.22954)
- [Sakana AI: The Darwin Godel Machine](https://sakana.ai/dgm/)
- [Shengran Hu: Automated Design of Agentic Systems](https://www.shengranhu.com/ADAS/)
- [Nature: Towards end-to-end automation of AI research](https://www.nature.com/articles/s41586-026-10265-5)

