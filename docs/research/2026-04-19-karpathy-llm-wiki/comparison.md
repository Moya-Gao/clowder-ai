---
doc_kind: research
created: 2026-04-19
status: draft
topics: [karpathy, llm-wiki, graphify, memory, harness-engineering, knowledge-governance]
related_features: [F102, F152, F163, F167]
related_docs:
  - docs/research/2026-04-19-karpathy-llm-wiki/source-note.md
  - docs/discussions/2026-04-08-external-memory-tools-landscape-review.md
  - docs/canon/meta-aesthetics.md
external_sources:
  - https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
  - https://github.com/safishamsi/graphify
graphify_local_clone: /Users/lysander/projects/ref/graphify
graphify_audited_commit: 7a0a5ac
---

# Karpathy LLM Wiki vs Graphify vs 我们家 F102/F152/F163/F167

## 结论先行

这三者不在同一抽象层：

- **Karpathy LLM Wiki**：提出“compiled knowledge layer”的第一性原理
- **Graphify**：把 raw corpus 编译成 **knowledge graph + report** 的工具化实现
- **我们家 F102/F152/F163/F167**：把编译知识、治理生命周期、跨项目迁移、跨猫传递质量，做成多猫协作 runtime 的一部分

所以它们不是简单替代关系，而是：

```text
Karpathy = 理念坐标轴
Graphify = graph-first 落地分支
Cat Café = governed memory + multi-cat runtime 分支
```

## 三列表

| 维度 | Karpathy LLM Wiki | Graphify | 我们家 F102 / F152 / F163 / F167 |
|---|---|---|---|
| **核心问题** | 为什么每次 query 都要重新发现知识？ | 如何把一堆 raw files 变成可导航的知识图？ | 如何让多猫协作里的知识既能编译、又能治理、还能正确传递？ |
| **主产物** | Persistent wiki | `graph.json` + `GRAPH_REPORT.md` + `graph.html`，可选 `--wiki` | `evidence.sqlite` / `global_knowledge.sqlite` + marker/materialization + A2A 协议护栏 |
| **抽象形态** | wiki-first | graph-first | governed-index-first |
| **真相源** | raw sources | raw files / corpus | `docs/*.md`、`docs/markers/*.yaml`、外部项目文档 |
| **中间层** | interlinked markdown pages | graph + report + optional wiki | SQLite compiled indices + evidence docs + summaries + review state |
| **schema / rules** | 一个指导 LLM 维护 wiki 的 schema 文档 | README + skill + hooks + graph conventions | `shared-rules.md`、skills、feature specs、prompt injection、workflow guards |
| **ingest 思路** | 新 source 进来后整合进 wiki | AST + LLM extraction + graph merge + cache | scan/hash/rebuild/materialize；外部项目走 bootstrap / scanner |
| **query 思路** | 先读 wiki，再回答 | 先看 `GRAPH_REPORT.md`，再查 `graph.json` hop-by-hop | `search_evidence` 联邦检索（FTS5 + 向量 + RRF） |
| **更新触发** | 新资料/新问题/定期 lint | `--watch`、git hooks、显式 `query` / `path` / `explain` | 冷启动 bootstrap、stale/fingerprint 检查、增量 rebuild、老用户/新 thread 提示重编 |
| **对文档变化的态度** | 继续维护 wiki | 改动后重建 graph，代码变更可即时，文档变更要 update | 文档是真相源；索引是编译产物；变化后按 freshness/fingerprint 决定是否 rebuild |
| **冲突 / 失效** | gist 提到 contradictions 和 stale claims，但偏概念 | 标 `EXTRACTED / INFERRED / AMBIGUOUS`，但没有真正知识生命周期治理 | F163 明确做 authority / activation / status / review queue / invalidation |
| **置信度** | 没具体机制 | 有 edge confidence + 标签 | F163 把 authority 与 confidence 解耦；confidence 来自 rank，authority 独立存在 |
| **时序** | 只说“持续更新” | 图是持久的，但时序治理弱 | F163 明确把 verified_at / invalid_at / supersedes / contradicts 纳入治理 |
| **跨项目** | 可以想象成个人/团队 wiki | 对任意 folder/corpus 可跑，但不区分项目治理 | F152 专门解决“猫出征外部项目”的冷启动理解与经验回流 |
| **协作对象** | 单个 LLM + 人类 | 单个 agent / 多平台 skill 使用者 | 多猫、多引擎、多身份、跨 reviewer / handoff / baton |
| **多猫 / 角色** | 无 | 无 | F167 明确补球权协议、角色门禁、乒乓熔断、虚空传球检测 |
| **运行时位置** | 知识表示层 | 知识图导航层 | 记忆基础设施 + 协作 harness 层 |
| **最强优点** | 第一性原理最干净 | 可视化和结构发现非常强，`GRAPH_REPORT.md` 适合当 high-level map | 适合长期真实协作：检索、治理、迁移、A2A 质量一起考虑 |
| **最大短板** | 太抽象，没给 runtime 治理方案 | 没有严格知识治理和多猫协作协议 | 系统更重，抽象层更多，审美上不如 Karpathy 那么“轻” |

## 四个 Feature 在这个比较里的分工

### F102

**位置**：我们家的“compiled memory substrate”。

解决：

- 文档真相源如何编译成 index
- 如何用 FTS5 / 向量 / RRF 检索
- 如何解耦 Hindsight，变成可插拔 memory adapter

可以把 F102 看成“我们家对 Karpathy 的系统级回应”，但它的产物不是 wiki，而是 **governed searchable index**。

### F152

**位置**：把 memory 能力从“家里”带到“外派项目”。

解决：

- 外部已有项目如何 bootstrap 记忆
- 不同项目结构如何扫描
- 经验如何回流全局层

如果 Karpathy 关心的是“一个 corpus 怎么复利”，F152 关心的是“猫带着这套能力去新项目时，怎么冷启动还不丢经验”。

### F163

**位置**：把 memory 从“只会增”变成“会治理熵减”。

解决：

- authority / activation / status 多轴元数据
- stale / contradiction / review queue
- summary vs source 的层级关系

Karpathy gist 里有 lint/stale/contradiction 的方向感，但 F163 是把这件事真正做成 **knowledge lifecycle governance**。

### F167

**位置**：不在“存什么”，而在“知识和球权如何在多猫链路里正确传递”。

它纳入这个比较不是因为它是 memory store，而是因为：

- 再好的 compiled knowledge，如果 A2A 链路把球传丢、传错对象、或者 ping-pong 到死，知识也到不了该到的人
- 在我们家，memory 不是单猫工具，而是多猫协作 runtime 的一部分

所以 F167 可以理解为：

> **memory 的 transport / routing quality layer**

Karpathy 和 Graphify 主要关心“知识怎么组织”；F167 关心“组织好的知识在多猫系统里怎么不掉链子”。

## 用 Round 4 的语言重述

参考 [Meta-Aesthetics](/Users/lysander/projects/relay-station/cat-cafe/docs/canon/meta-aesthetics.md)：

- **Karpathy** 做的是一次漂亮的**坐标变换**  
  从“每次问都重新拼 raw context”换到“先编译知识中间层”

- **Graphify** 做的是一条**graph-first 认知路径工程**  
  先给 agent 一张图和一页报告，再让它按结构导航，而不是上来 grep 全仓

- **我们家** 做的是**知识层 + 治理层 + 传输层** 的组合  
  不仅要让知识可编译，还要让它可审计、可失效、可迁移、可在多猫之间正确流动

## 谁更“数学之美”

如果只论表达的纯度：

1. **Karpathy 最美**：概念最少，坐标系最正
2. **Graphify 次之**：用 graph 把结构显化，很直观
3. **我们家最重**：因为问题域更难，必须加治理和协作层

但“更重”不等于“更差”。它只是说明我们面对的问题不是单 agent 知识库，而是：

> 多猫、多引擎、多身份、多任务链路下的长期协作记忆系统。

## 一个更精确的映射

```text
Karpathy
  = 先提出 compiled knowledge 的北极星

Graphify
  = 把 corpus 编译成 graph/report 的结构导航器

Cat Café
  = 把 compiled knowledge 纳入多猫 runtime：
      F102 负责编译与检索
      F152 负责跨项目冷启动与迁移
      F163 负责生命周期治理与熵减
      F167 负责协作链路中的球权与角色质量
```

## 对我们最有价值的吸收点

### 从 Karpathy 吸收

- “知识中间层要是 **人类可浏览的 artifact**” 这点非常对
- 我们现在 index 很强，但人类可读的 compiled layer 还不够显眼

### 从 Graphify 吸收

- `GRAPH_REPORT.md` 这类一页式结构鸟瞰图很有价值
- “先看结构，再搜细节”的认知路径工程很适合 agent

### 我们自己已经比它们更强的点

- 文档真相源和 compiled index 的分层更清楚
- 生命周期治理更严
- 多猫协作与角色护栏是它们都没有的

## 当前判断

**Graphify 可以视为 Karpathy LLM Wiki 理念下的一个 graph-first 产物。**  
**我们家则是同一理念在 multi-cat governed runtime 里的更重版本。**

如果只问一句：

> “Karpathy LLM Wiki、Graphify、我们家，最本质的差别是什么？”

我的答案是：

- **Karpathy**：发明了方向
- **Graphify**：把方向做成结构地图
- **我们家**：把方向做成可治理、可迁移、可协作的系统
