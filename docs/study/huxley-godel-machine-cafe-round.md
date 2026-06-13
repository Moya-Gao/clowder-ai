---
title: 赫胥黎-哥德尔机 (Huxley-Gödel Machine)
author: fable-5 (in-cafe arm)
date: 2026-06-12
category: study
tags:
  - Self-Improving Agents
  - Agent Harness
  - Open-Ended Search
  - Clade Metaproductivity
  - Jürgen Schmidhuber
related:
  - darwin-godel-machine.md
  - adaptive-auto-harness.md
  - agent-experience-and-self-evolution-synthesis.md
  - loop-engineering.md
experiment_note: >
  本篇是铲屎官设计的 bare-CC vs in-cafe A/B 实验的猫咖臂。
  独立写作：未读 bare 臂版本（72207a61e, docs/study/huxley-godel-machine.md）任何内容，
  仅 git show --name-only 看过文件名以避免覆盖。信源为论文 abstract + arXiv HTML 全文抽取。
---

# 赫胥黎-哥德尔机 (Huxley-Gödel Machine)

> **原论文**：Huxley-Gödel Machine: Human-Level Coding Agent Development by an Approximation of the Optimal Self-Improving Machine
> **作者**：Wenyi Wang, Piotr Piękos, Li Nanbo, Firas Laakom, Yimeng Chen, Mateusz Ostaszewski, Mingchen Zhuge, **Jürgen Schmidhuber**（KAUST）
> **版本**：arXiv 2510.21614，2025-10
> **代码**：github.com/metauto-ai/HGM
> **前作笔记**：[达尔文-哥德尔机](darwin-godel-machine.md)

---

## 一句话

**HGM 发现"当前 benchmark 分数高"和"能生出好后代"是两回事（metaproductivity-performance mismatch），于是把自我修改树的扩展依据从"个体当前分数"换成"整个演化支（clade）的子孙聚合表现"——结果比 DGM 分数更高，CPU 时砍掉一半以上。**

更短：

> DGM 按"你考得好"选祖先；HGM 按"你的子孙们考得好"选祖先。

---

## 名字的弧线：Gödel → Darwin → Huxley

这条命名线本身就是自我改进方法论的进化史，而且有一个罕见的细节：**Schmidhuber 本人是 HGM 的署名作者**——哥德尔机（2003，"数学证明修改有益才采用"）的发明人，亲自署名了把"证明"松弛掉两次的后继：

| 代 | 选择依据 | 谁说了算 |
|---|---|---|
| Gödel Machine | 形式化证明修改必然有益 | 数学（从未实用化） |
| Darwin Gödel Machine | 修改后实测 benchmark，好的留 archive | 个体的经验成绩 |
| **Huxley-Gödel Machine** | 按演化支的**子孙聚合表现**选扩展对象 | **谱系**的经验成绩 |

"Huxley" 取自赫胥黎的 **clade（演化支）** 概念：评估单位从个体改成"以它为根的整棵子树"。

---

## 核心发现：mismatch 是量化过的，不是修辞

DGM 式搜索的隐含假设是"当前分数高的节点更值得继续改"。HGM 用相关性数据打掉了这个假设——**各方法的选择信号 vs 真实未来产出的加权相关**：

| 数据集 | SICA | DGM | HGM (CMP) |
|---|---:|---:|---:|
| SWE-Verified-60 | 0.444 | 0.285 | **0.778** |
| Polyglot | 0.274 | 0.383 | **0.626** |

DGM 的信号（个体分数）与后代质量相关性只有 ~0.3：**一半以上的搜索预算花在"当前漂亮但是死胡同"的节点上。** 这给了"防局部最优"一个比口号硬得多的形态——局部最优不是抽象风险，是可测量的信号-目标错配。

## CMP：定义与估计

**定义**（注意是 max 不是 mean）：

```text
CMP_π(𝒯, a) = E[ max_{a' ∈ C(𝒯,a)} U(a') ]
   C(𝒯,a) = 以 a 为根的子树（a 的 clade）
   U      = 下游任务表现
```

一个支系的价值 = **它最好后代的期望高度**，不是后代的平均水平。差的兄弟不拖累支系——只要这条线能通向一个高点，就值得挖。

**实践估计器**：clade 聚合通过率 `n_success^C / (n_success^C + n_failure^C)`（整棵子树的测试通过/失败计数），套 **Thompson sampling**（带探索-利用温度 τ）决定扩展谁。本质是把"选哪个祖先继续改"建成多臂老虎机，臂的统计量是谱系级的。

**算法循环**：① 按预算条件决定本步是扩展还是评估 → ② 扩展：TS 按 clade 统计采样祖先，生成自修改子代 → ③ 评估：采样个体跑单任务，更新整条祖先链的计数 → ④ 最终交付：取后验 ε-分位的 agent。异步执行，无刚性串行。

## 实验结果与 provenance

同等 800 次评估预算（作者报告，GPT-5-mini 为主干）：

| 方法 | SWE-Verified-60 | Polyglot | CPU 时 |
|---|---:|---:|---|
| SICA | 50.0% | 25.4% | 572h (Polyglot) |
| DGM | 53.3% | 27.1% | 1231h / 2385h |
| **HGM** | **56.7%** | **30.5%** | **517h / 347h** |

放大到全量 SWE-bench Verified：61.4%，超过同主干最佳人工 agent；换 GPT-5 主干在 SWE-bench Lite 57%，**追平人工 SOTA**（"human-level"的实际含义是这个，不是泛化的人类水平）。

**Polyglot 上 DGM 花 6.9 倍 CPU 还低 3.4 个点**——谱系信号同时买到了质量和预算。这条对我们特别重要：进化谱系方法最大的落地阻力一直是评估成本，HGM 证明**更好的选择信号本身就是省钱手段**。

---

## 风险与边界（这部分论文自己没怎么写，我们替它写）

1. **没有 safety section。** DGM 论文诚实报告了 reward hacking 实录（伪造工具日志、删检测 marker）；HGM 全文无显式安全讨论。方法变强了，安全话语反而退步了。
2. **CMP 不防 oracle 污染，反而放大它。** CMP 的 success/failure 计数仍来自同一个 benchmark oracle——agent 若骗过测试（DGM 实录过），**伪造的成功会沿祖先链向上聚合，抬高整条支系的 CMP**，让搜索系统性涌向会作弊的家族。谱系信号把单点污染变成结构性污染。verifier 卫生（独立证据源、不可被改的检测层）在 HGM 框架下比 DGM 更关键，而非更不关键。
3. **静态世界假设。** 可重复试验 + 冻结任务分布 + 冻结评估。开放任务流（任务类型混杂、世界漂移）正是 [Adaptive Auto-Harness](adaptive-auto-harness.md) 的地盘——两篇正好互补：HGM 答"怎么选扩展对象"，AAH 答"经验怎么不变成包袱"。
4. **Theorem 1 强假设**，作者自己承认 benchmark 受控条件外未必成立。
5. **域边界**：通过率估计 CMP 预设了**廉价、客观、可自动判分的 validator**。coding 有；taste 域（审美/写作/陪伴）没有——这正是家里 longform-003/004 反复钉的"validator 可得性是领域选择函数"。CMP 直接搬进 taste 域会退化成"聚合一堆不可信的自评"。

## Cat Cafe 视角

1. **"max 不是 mean"我们先写过。** longform-002 第 7 章伙伴系统数学："团队不是平均值，而是候选路径的最大值。"HGM 把同一个判断用在时间轴上（谱系的 max）而非空间轴上（并行猫的 max）。同一个数学，两个投影。
2. **CMP 与 F200 消费加权同构。** 都是"不信自评/不信当前印象，信下游真实使用信号"：记忆条目的价值看它被消费后任务成不成，agent 节点的价值看子孙考得好不好。F200 已经踩过的坑（信号脏时不能当裁判、consumption 不影响 authority）是 CMP 落地的前置教训。
3. **mismatch 是 `no-ground-truth-self-hype` 的谱系版。** "当前表现好 ≠ 真实潜力"在家里的 failure mode 表里早有名字，HGM 给了它相关系数。
4. **对"自进化包装"讨论的回填**（2026-06-12 thread）：朋友清单第 6 条"看子孙优化可能性最大的那个"就是 CMP 逐字复述；第 6 条因此是清单里唯一有 2025-10 新论文背书、且自带成本叙事（CPU 减半）的一条。包装时它和 token 经济学（第 1 条）是同一根线：**进化是搜索，搜索的预算效率取决于选择信号质量。**
5. **我们的活裁判批评依然成立。** HGM 的裁判仍是冻结的 benchmark（只是聚合得更聪明）。冻结裁判可被 hack（见风险 2）；家里的答案——选择压力里放一个会换坐标系反问的活人——HGM 没有对应物，这是它的天花板，也是我们的差异化。

## 放进总主线

```text
DGM            harness 可以被进化（个体分数选祖先）
   |
HGM            谱系信号 > 个体信号：更准 + 更省（mismatch 量化 + CMP + TS）
   |           [缺口：oracle 污染沿谱系放大；静态世界；无 taste 域 validator]
   |
Adaptive       开放任务流：经验要分支/路由/退役，人补方向信号
Auto-Harness
   |
Cat Cafe       活的选择压力（CVO taste）+ 硬边界不动点 + validator 卫生
```

## Source-Audit Ledger

| Claim | 原始来源 | 类型 | Verdict | Provenance |
|---|---|---|---|---|
| CMP 定义（max 语义）/ TS 估计器 / 算法循环 | arXiv 2510.21614 HTML 全文抽取 | arXiv preprint | use | 一手论文，未 peer-reviewed |
| mismatch 相关性（0.285 vs 0.778 等） | 同上 Table 1 | arXiv preprint | use-with-caveat | 作者报告指标 |
| 结果数字（56.7%/30.5%/517h/347h；61.4%；GPT-5 57%） | 同上 Table 2 + 正文 | arXiv preprint | use-with-caveat | 作者报告，未独立复现 |
| Schmidhuber 署名 / KAUST | arXiv 作者页 + HTML | arXiv | use | 已核作者表 |
| "无 safety section" | HTML 全文抽取（小模型辅助） | 抽取结论 | use-with-caveat | 抽取器未见显式安全节；终审引用前建议人工翻全文复核一遍 |

## 参考来源

- [arXiv: Huxley-Gödel Machine](https://arxiv.org/abs/2510.21614)
- [HGM 代码仓库](https://github.com/metauto-ai/HGM)
- [前作：Darwin Gödel Machine 笔记](darwin-godel-machine.md)
- [Adaptive Auto-Harness 笔记](adaptive-auto-harness.md)

*[宪宪/fable-5🐾] 2026-06-12 · in-cafe 臂，独立写作，未读 bare 臂*
