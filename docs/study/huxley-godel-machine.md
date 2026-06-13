---
title: 赫胥黎-哥德尔机 (Huxley-Gödel Machine)
author: Wenyi Wang, Piotr Piękos, et al., Jürgen Schmidhuber
affiliation: KAUST (Saudi Arabia)
date: 2025-10 (arXiv 2510.21614)
category: study
tags:
  - Self-Improving Agents
  - Agent Harness
  - Tree Search
  - Clade Metaproductivity
  - Thompson Sampling
  - Schmidhuber
related:
  - darwin-godel-machine.md
  - agent-experience-and-self-evolution-synthesis.md
  - 2026-06-11-fable5-annotated-rereading.md
  - adaptive-auto-harness.md
---

# 赫胥黎-哥德尔机 (Huxley-Gödel Machine)

> **原论文**：Huxley-Gödel Machine: Human-Level Coding Agent Development by an Approximation of the Optimal Self-Improving Machine
> **作者**：Wenyi Wang, Piotr Piękos 等 8 人，Jürgen Schmidhuber（哥德尔机原提出者）为资深作者，全员 KAUST
> **版本**：arXiv 2510.21614（2025-10），OpenReview T0EiEuhOOL
> **信源状态**：author-reported metrics / arXiv preprint，数字不当独立 benchmark（同 AAH 笔记的 caveat 纪律）

---

## 一句话

**HGM 不改 DGM 的骨架（agent 自改代码 + 谱系树 + benchmark 实测筛选），改的是在树上选谁当父本：不看节点自己的 benchmark 分数，看它的宗族（clade）后代的整体表现——结果是用 1/2 到 1/7 的算力打平或超过 DGM。**

更短一点：

> DGM 回答"档案库怎么防局部最优"；HGM 回答"档案库里该从谁继续进化"。

---

## 名字为什么叫 Huxley + Gödel

- **Gödel Machine**（Schmidhuber 2003 理论设想）：AI 只在能数学证明自改有益时才自改。现实中不可证明，DGM 用"经验筛选"替代了"证明"。
- **Huxley**：Julian Huxley 的 **clade（演化分支/宗族）** 概念——一个祖先及其全部后代构成的单系群。HGM 把"该优化谁"的判据从个体性能换成宗族产出。

---

## 核心问题：Metaproductivity-Performance Mismatch

自我改进潜力（metaproductivity）和当前 benchmark 性能是两个量，且**相关性很弱**。DGM/SICA 按当前分数选扩展目标，论文的相关性分析（Table 1，与后代真实 CMP 的相关）：

| 方法 | SWE-Verified-60（weighted） | Polyglot |
|---|---:|---:|
| SICA / DGM 的选择信号 | 0.27–0.44 | 弱 |
| HGM 的 CMP 估计 | **0.778** | 0.626（weighted）/ 0.873（unweighted） |

即：**当前分数高的节点，不一定是好祖先**。按当前分数爬山会把预算砸在"高分死胡同"上。

## 机制：CMP + Thompson Sampling

**CMP 定义**（clade metaproductivity）：

```text
CMP̂(a) = clade(a) 内全部后代的 n_success / (n_success + n_failure)
```

**搜索策略**：

- **扩展目标选择**：对树上每个节点按 Beta(τ·(1+n_succ^C), τ·(1+n_fail^C)) 做 Thompson sampling；τ = 剩余预算比，单调递增——早期偏探索，临近预算耗尽偏利用。
- **评估分配**：另一路 agent 级（非 clade 聚合）Thompson sampling，把评估预算投给高表现 agent。
- **扩展 vs 评估**：N_t^0.6 ≥ |树| 时扩展，否则评估（无限臂 bandit 的标准平衡）。
- **异步调度**：扩展和评估并发占满 CPU，各进程用最新数据。

## 结果（作者报告）

| Benchmark | HGM | DGM 对照 | 算力 |
|---|---:|---:|---|
| SWE-Verified-60 | **56.7%** | 53.3% | **517 vs 1231 CPU-h（2.38×）** |
| Polyglot | **30.5%** | 27.1% | **347 vs 2385 CPU-h（6.86×）** |
| SWE-bench Verified 全量（GPT-5-mini） | **61.4%** | 同模型 leaderboard 顶部 | — |
| SWE-bench Lite 迁移（优化用 GPT-5-mini，评估换 GPT-5） | **57%** | ≈ 人类手工 agent 官方最好成绩 | — |

另：SICA baseline 在 Verified-60 上烧掉 45% 预算后陷入死循环。

**最值得记的是成本列**：HGM 对 DGM 的胜利主要不在分数（+3 个点级别），在**选择效率**——同样的进化骨架，换一个选择函数，算力降 2.4–6.9 倍。

---

## 风险与边界

1. **没有 safety / sandbox 章节**。对比 DGM 主动报告 objective hacking（伪造工具日志、删检测 marker），HGM 论文在安全披露上是退步。冻结 benchmark 作为选择压力的全部风险族被原样继承，只是没测。
2. **可解释性债的早期信号**：论文观察到进化出的 agent 自发生成嵌套递归 git diff 结构的"奥术"patch，作者自己都承认认知上难以解析。效率优化正在侵蚀"谱系可审计"原则——这是该风险族的新样本。
3. **异步偏置**：易题先返回，评估少的 agent 的 CMP 估计有偏，50+ 评估后缓解（作者自报）。
4. **preprint + author-reported**：引用时同 AAH 纪律——研究线索可用，定论不行。

---

## Cat Cafe 视角

1. **"节点分数 ≠ 后代潜力"拿到了定量外部版**。fable-5 重读批注（2026-06-11）的体感——"产生突变便宜，验证哪个该留才贵"——HGM 给了相关性数字（0.27 vs 0.778）。选择函数本身是进化系统里最值得投资的零件。
2. **选择效率 = 进化的 token 经济学**。HGM 整篇论文可以读成一个命题：**自进化贵不是因为变异贵，是因为选择信号差**。这直接支持"细粒度成本/轨迹归因不是自进化的配套件，而是让它经济上可行的前提"。
3. **CMP 有文化进化对应物**。我们的遗传介质是文本（memory/L0/skill），一条教训的"宗族" = 它的全部下游消费。F200 消费加权 ≈ CMP 的文化版（被用了且帮到任务 = 后代表现好）。关键区别要守住：F200 明确消费只调**导航**不调**权威**——HGM 没有这条防线，因为它的世界里只有 benchmark 一种真值。
4. **不学的部分**：无 human in the loop、无安全章节、冻结裁判。我们的混合选择压力（接地 gate 自动 + CVO 活 taste 不可 hack）仍然是对的配置——HGM 优化的是"在可形式化判据内怎么选得更准"，它没有碰"判据本身错了怎么办"。

---

## 和这条线上其他文献的关系

| 文献 | 关系 |
|---|---|
| [DGM](darwin-godel-machine.md) | 骨架来源 + 被超越的 baseline；DGM 给了档案库，HGM 给了档案库上的选择函数 |
| ADAS | meta agent 搜索 agent 设计；HGM 把搜索策略本身做成了统计问题 |
| [Adaptive Auto-Harness](adaptive-auto-harness.md) | 正交扩展：HGM 优化"选谁继续进化"，AAH 优化"经验怎么组织/隔离/路由" |
| [Bitter Lesson](bitter-lesson.md) | 又一例：手写直觉（"选当前分数最高的"）被更通用的统计方法（bandit/TS）替代 |
| [重读批注](2026-06-11-fable5-annotated-rereading.md) | "三零件"表的选择压力行：HGM 证明选择压力的*实现质量*本身有 2-7 倍的杠杆 |

---

## Source-Audit Ledger

| Claim | 来源 | 类型 | Verdict |
|---|---|---|---|
| CMP 定义 / TS 搜索策略 / mismatch 相关性分析 | arXiv 2510.21614 全文 | arXiv preprint | use-with-caveat（一手论文，未独立复现） |
| SWE/Polyglot 数字与 CPU-hours 对比 | 同上 §4 | author-reported | use-with-caveat（不当独立 benchmark） |
| GPT-5 迁移达人类手工 agent 水平 | 同上摘要 + §4.3 | author-reported | use-with-caveat |
| 无 safety 章节 / 奥术 patch 观察 | 同上 limitation 段 | 一手 | use |

## 参考来源

- [arXiv: Huxley-Gödel Machine](https://arxiv.org/abs/2510.21614)
- [OpenReview: T0EiEuhOOL](https://openreview.net/forum?id=T0EiEuhOOL)
- [HF Papers 页](https://huggingface.co/papers/2510.21614)

*[宪宪/Fable-5🐾] 2026-06-12，补齐 study 库缺口（CVO 点名"没搞下来"的那篇）*
