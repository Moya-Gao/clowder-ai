---
title: "张书豪：CANDOR-Bench 与动态检索底盘评测"
date: 2026-05-12
event_date: 2026-05-12
doc_kind: seminar-live-notes
status: draft
speaker: "张书豪（华中科技大学）"
topic: "智能体记忆管理与检索增强 / CANDOR-Bench"
author: "砚砚/GPT-5.5"
sources:
  - "现场截图：CANDOR-Bench 动态开放世界流下的连续 ANNS 测试基准"
  - "现场截图：CANDOR-Bench 评测协议"
  - "CANDOR-Bench GitHub: https://github.com/intellistream/CANDOR-Bench"
  - "SIGMOD 2026 paper title shown in slides: Mingqi Wang et al. CANDOR-Bench: Benchmarking In-Memory Continuous ANNS under Dynamic Open-World Streams"
---

# 张书豪：CANDOR-Bench 与动态检索底盘评测

> 现场语境：张书豪老师在"智能体记忆管理与检索增强"方向里介绍 CANDOR-Bench。铲屎官判断：它看起来是在做能测复杂记忆 / 检索方案的 benchmark。我的判断：这是一个很有价值的 **retrieval substrate eval**，但还不是完整的 Agent Memory eval。

---

## 1. 快速事实核对

公开仓库显示：

- 项目：`intellistream/CANDOR-Bench`
- 题名：`CANDOR-Bench: Benchmarking In-Memory Continuous ANNS under Dynamic Open-World Streams`
- 会议：SIGMOD 2026
- 定位：面向动态开放世界流的内存连续 ANNS benchmark

仓库 README 对 CANDOR 的定义是：

> Continuous Approximate Nearest neighbor search under Dynamic Open-woRld Streams.

翻成人话：

> 它不是测一个静态向量库查得准不准，而是测一个向量索引在**数据持续进入、分布漂移、查询和更新同时发生**时，会不会还能保持 recall、吞吐、延迟和 freshness。

---

## 2. 现场截图里的核心设定

截图给出的核心判断：

| 传统 ANN benchmark | CANDOR-Bench |
|---|---|
| 数据集固定 | 数据以 streaming 方式持续进入 |
| 索引静态或低频重建 | ANNS index 持续 update |
| query/update 分开测 | query 和 update 并发竞争资源 |
| 主要看 recall / QPS / latency | 还看 freshness、故障注入、硬件 profiling |
| 更像离线算法评测 | 更像动态生产环境压力测试 |

现场 PPT 明确列出四类开放世界挑战：

1. **高速数据动态**：数据不断进入，索引不能假设"建好之后不动"。
2. **数据漂移 / 模态漂移**：向量分布、数据类型、语义空间都可能变化。
3. **噪声与随机丢失**：真实 ingestion pipeline 会有污染、drop、raw data 混入。
4. **并发查询更新**：用户查询和后台写入同时发生，freshness 与吞吐会互相拉扯。

这套问题定义比传统静态 ANN benchmark 更接近 Agent Memory 的底层现实：memory 不是一次性 build 的索引，而是不断被写入、更新和查询的运行中资源。

---

## 3. CANDOR-Bench 的评测协议

现场截图和仓库 README 能拼出一个很清楚的协议骨架：

| 模块 | 含义 |
|---|---|
| Streaming Data Pipeline | 产生动态数据流，包含 drop / contamination / raw data 等扰动 |
| Pending Update Queue | 把待写入数据排队，模拟写入积压 |
| Time-driven Query Executor | 按时间驱动查询，而不是等索引稳定后再查 |
| ANNS Index | 被测索引，承受更新与查询压力 |
| Experiment Controller | 控制 serialized / concurrency 两种模式 |
| Hardware Profiler | 记录 page faults、cache miss、cache reference |
| ANNS Evaluation | 记录 Recall@10、QPS、Latency |

现场截图里还有几个高信号参数：

- **统一时间轴**：先 warm-up 50K，再进入 streaming。
- **默认注入速率**：10K rows/s。
- **读写竞争显式化**：micro-batch 写入 + 按秒查询，让 freshness 和吞吐同步博弈。
- **压力可复现**：支持并发扩展、故障注入、profiling，能共同定位退化来源。

这个协议的价值在于：它不是只问"最终结果像不像"，而是问**索引在动态过程里怎么退化**。

---

## 4. 它和 Agent Memory 的关系

CANDOR-Bench 不是完整的 Agent Memory benchmark，但它是 Agent Memory 里很关键的一层。

我会这样分层：

| 层 | CANDOR-Bench 覆盖吗 | 说明 |
|---|---:|---|
| 动态向量索引 freshness | 是 | 数据写入后多久能被查到 |
| 并发 query/update 可靠性 | 是 | 查询和更新同时发生时是否退化 |
| 漂移 / 噪声 / 丢失压力 | 是 | 更接近开放世界数据流 |
| 源文本追溯 / provenance | 部分缺 | ANNS 能返回近邻，但未必能解释证据链 |
| 写入门禁 / truth model | 缺 | 不判断什么值得记、什么只是噪音 |
| 冲突 / stale / rollback 治理 | 缺 | 动态索引更新不等于记忆生命周期治理 |
| Wearing Protocol | 缺 | 不测 agent 什么时候该用、降权、压制记忆 |
| 任务结果影响 | 缺 | 不测检索结果是否让 agent 的真实工作变好 |

所以它的位置应该是：

> **Memory Retrieval Substrate Eval**：测试记忆系统的检索底盘在动态开放世界里会不会崩。

不是：

> **Full Agent Memory Eval**：测试 agent 是否记得对、用得对、错了能改、过期能退役。

这个边界很重要。否则容易把"向量索引在动态流下表现好"误解成"Agent Memory 系统可靠"。

---

## 5. 和我们家记忆系统的接法

如果把它接到 Cat Cafe 的评估体系里，我会放在 F192 / F188 下面的一层：

```text
Memory Eval 总体
├── Retrieval Substrate Eval
│   ├── 动态写入 freshness
│   ├── 并发查询 / 更新退化
│   ├── 漂移 / 噪声 / 丢失压力
│   └── Recall / QPS / Latency / Cache miss
├── Memory Governance Eval
│   ├── 写入门禁是否拦住 junk
│   ├── stale / conflict 是否标红
│   ├── rollback / provenance 是否可追
│   └── 权限 / 隐私过滤是否生效
└── Agent Outcome Eval
    ├── 猫是否在正确时机召回
    ├── 猫是否被旧记忆误导
    ├── 任务是否变快 / 变稳 / 少返工
    └── 经验是否沉淀成下一次可用 SOP
```

CANDOR-Bench 能很好地补第一层，但第二、三层仍然要我们自己做。

对我们现有系统的具体问题是：

1. **Knowledge Feed 正在写入 / reindex 时，猫能不能查到最新证据？**
2. **evidence.sqlite 的 FTS/vector/RRF 在并发写入下会不会 stale 或退化？**
3. **搜索结果能不能顺藤摸瓜回 source doc、thread、speaker、timestamp？**
4. **坏记忆写入后，系统能不能回滚并解释污染路径？**

第 3 点尤其关键。铲屎官说的"顺藤摸瓜"不是锦上添花，而是 Agent Memory 进入真实工作流的底线：

> 检索结果不能只给 vector id 或摘要，必须能一路摸回原始文本、文件、版本和来源。

否则 recall 准了也不够，因为猫没法验证。

---

## 6. 对张书豪这条路线的判断

我觉得这条路线很有价值，但它解决的是更底层的问题。

**强点：**

- 比静态 ANN benchmark 更接近生产。
- 明确把 query/update concurrency 变成评测对象。
- 引入 drift、noise、loss、hardware profiling，能定位底层退化原因。
- 适合测大规模 memory / RAG / multimodal retrieval 的底盘。

**限制：**

- 仍然偏索引系统，不偏 agent 行为。
- 不知道检索回来的内容是否真的支撑任务。
- 不知道错误更新、旧记忆、冲突记忆如何被治理。
- 不知道 agent 是否会误用高 recall 但低 authority 的结果。

所以现场可以这样评价：

> CANDOR-Bench 是记忆系统的"底盘测功机"。它能告诉我们动态检索引擎会不会扛得住，但不能告诉我们这套记忆是否可信、是否可治理、是否真的让 agent 少犯错。

---

## 7. 和今天其他分享的关系

这条线刚好能补上前面几场的空白：

| 分享 | 关注点 | CANDOR-Bench 的补位 |
|---|---|---|
| DeepEye / 数据智能体 | 多源异构数据怎么进入 agent 工作流 | 检索底盘在动态数据流下怎么扛压 |
| 周煊赫 / Workspace-Bench | Agent 能否在真实工作区发现文件和依赖 | 检索索引在开放流里是否稳定 |
| Memos / MemOS | 记忆如何抽取、组织、更新、共享 | 底层 memory retrieval engine 怎么评测 |
| Cat Cafe | 记忆如何治理、佩戴、协作、闭环 | 可以补一个 retrieval substrate 压测层 |

一句话：

> DeepEye 讲数据怎么编排，Workspace-Bench 讲 agent 怎么找证据，MemOS 讲记忆怎么管理，CANDOR-Bench 讲检索底盘怎么扛动态压力。它们不是替代关系，是栈上的不同层。

---

## 8. 现场可用的一句话

> 张老师这套 CANDOR-Bench 不是在测 agent 会不会"记住人"，而是在测 memory / RAG 系统的检索底盘在动态开放世界里会不会崩。它是 retrieval substrate eval，不是完整 memory eval；但没有这层，后面的治理、Wearing Protocol 和多 agent 协作都建在沙上。

## 9. 后续可做

如果要把这条线接进我们自己的评估体系，可以开一个小任务：

1. 选一个小型动态 corpus，模拟 Knowledge Feed 持续写入。
2. 同时跑 `search_evidence` / `graph_resolve` / `list_recent` 查询。
3. 记录 freshness、latency、miss rate、source traceability。
4. 注入坏数据 / 旧数据 / 冲突数据，看 F163 治理链能否拦住。
5. 把结果接到 F192：不是只看 retrieval 分数，还看猫实际任务是否少返工。

这会比单纯跑 CANDOR 原 benchmark 更贴近 Cat Cafe 的真实问题。
