---
title: "Agent Memory 6 件必须有 — 三猫收敛版"
date: 2026-05-12
event_date: 2026-05-13
doc_kind: seminar-reference
status: converged
synthesizer: "宪宪/Opus-46"
contributors: ["宪宪/Opus-46", "宪宪/Opus-47", "砚砚/GPT-5.5"]
---

# Agent Memory 必要范式综合

> 铲屎官原始问题：记忆组件和 Harness 一样还没有标准——到底哪些是"帮猫猫完成现实闭环的必须范式"，哪些是"黑猫白猫能抓老鼠就行"？
>
> 三猫并行独立回答后，由 46 综合，47 表态收敛。砚砚原始立场已在综合中反映（47 采纳了砚砚的 Recall+Salience 拆法 + Truth Source 折叠方案）。

---

## 一、三猫各自的模型

### Opus-46（5+1 模型）

以"记忆操作的不可回避问题"为切入——不管技术栈如何，这 5 个问题必须回答：

| # | 范式 | 核心问题 |
|---|---|---|
| 1 | **Write Gate** | 什么进记忆？谁决定？ |
| 2 | **Read Gate** | 什么时候取出？给谁看？ |
| 3 | **Mutation Protocol** | 改了/删了/冲突了怎么办？ |
| 4 | **Provenance** | 这条记忆从哪来？为什么在这？ |
| 5 | **Scope Boundary** | 这条记忆谁能看？跨 agent 怎么办？ |
| +1 | **Eval / Self-Calibration** | 记忆系统自身怎么知道工作得好不好？ |

### Opus-47（6 范式模型）

以 harness 判别式为切入——"是在维护 agent 感知现实的准确度（= 必须），还是在工程化记忆系统运行细节（= 黑猫白猫）？"

| # | 范式 | 核心问题 |
|---|---|---|
| 1 | **写入门禁** | 什么该入库 / 什么是噪音 |
| 2 | **过期识别 + 矛盾标记** | 旧决策不退役 = 污染现行行为 |
| 3 | **Wearing Protocol** | 有义肢不会用 = 装了等于没装 |
| 4 | **Provenance + Rollback** | 来自哪、谁验证、改错能撤 |
| 5 | **Multi-agent 一致性** | 同族盲点是结构性的 |
| 6 | **Eval 反馈环** | 改了不知道好没好 = 改错也不知道 |

独有贡献：**Wearing Protocol 单独列为必须范式**（46 把它折进 Read Gate，codex 拆成 Recall + Salience）。47 的论点是："有义肢不会用 = 装了等于没装"——这不是检索问题，是行为习得问题。

### GPT-5.5/砚砚（6 器官 / 8 细项模型）

以"记忆体 = agent 感知器官"为比喻，先列 8 个细项，再压缩为 6 器官：

| # | 器官 | 覆盖的细项 |
|---|---|---|
| 1 | **真相源** | Truth Source 层级（什么算事实 vs 聊天片段 vs 候选） |
| 2 | **索引层** | 怎么找到事实 |
| 3 | **召回层** | 什么时候把事实送到 agent 面前（含 Recall Path 多入口） |
| 4 | **显著性层** | 当前该看什么、不该看什么（Salience Gating） |
| 5 | **治理层** | 过期、冲突、删除、回滚、权限 |
| 6 | **评估层** | 记忆有没有让任务真的变好 |

独有贡献：**Truth Source 层级单独列为必须**（46/47 没独立提这个）；**Salience 从 Recall 独立出来**。

---

## 二、收敛地图：三猫都同意的

| 必须范式 | 46 | 47 | 砚砚 | 共识程度 |
|---|---|---|---|---|
| **写入门禁**（什么该记） | Write Gate | 写入门禁 | Write Gate | ✅ 全一致 |
| **审计溯源**（从哪来、能回滚） | Provenance | Provenance + Rollback | Provenance | ✅ 全一致 |
| **生命周期治理**（过期/冲突/遗忘） | Mutation Protocol | 过期识别 + 矛盾标记 | 治理层 | ✅ 全一致（粒度不同） |
| **多 agent 一致性** | Scope Boundary | Multi-agent 一致性 | Multi-agent Consistency | ✅ 全一致 |
| **Eval 反馈环** | +1 Eval | 第 6 件 | 评估层 | ✅ 全一致（都认为 speech draft 漏了这件） |

**核心共识一句话**：不管存储后端、检索算法、压缩策略如何选，以上 5 件是"不做就不算企业级 Agent Memory"的硬约束。

---

## 三、分歧地图：需要讨论的

### 分歧 1：Wearing Protocol 是独立范式，还是 Read Gate 的子集？

| 立场 | 猫 | 论据 |
|---|---|---|
| **独立范式** | 47 | "有义肢不会用 = 装了等于没装"。这不是检索问题（Read Gate 管"找到"），而是行为习得问题（agent 学会何时用/何时压制记忆）。AGENTS.md study 证明这是行业 gap |
| **Read Gate 子集** | 46 | Read Gate = "什么时候取出？给谁看？"——Wearing Protocol 回答的就是这个问题的决策层 |
| **拆成 Recall + Salience 两件** | 砚砚 | 召回（什么时候送到面前）和显著性（当前该不该看）是两个独立能力。Salience 不只是检索排序，还包括主动降权 |

**待收敛**：Wearing Protocol 是第 6 件独立范式？还是 Read Gate 内部拆成 Recall + Salience 两层更精确？

### 分歧 2：Truth Source 层级是独立范式，还是 Write Gate 的前置？

| 立场 | 猫 | 论据 |
|---|---|---|
| **独立范式** | 砚砚 | "记忆系统必须知道什么是正式事实、什么只是聊天片段、什么是候选想法"——这不是写入门禁（那管"该不该进"），这是"进来后的信任等级" |
| **Write Gate 的产出** | 46/47 | 写入时标注 authority level 就够了，不需要单独列为范式 |

**待收敛**：Truth Source 层级是写入后的元数据，还是独立于写入的结构性要求？

### 分歧 3：最终列几件？

| 模型 | 数量 | 说法 |
|---|---|---|
| 46 | 5+1 | 5 个操作维度 + 1 个元层 |
| 47 | 6 | 6 个现实闭环范式 |
| 砚砚 | 6 | 6 个器官 |

数量接近（5~6），但边界切法不同。需要收敛到一个对外可讲的版本。

---

## 四、黑猫白猫区域（三猫完全一致）

以下是"怎么实现都行，能 work 就好"的部分：

- **存储后端**：向量 DB / 图 DB / KV / SQLite FTS / 文件系统 / 参数权重
- **检索算法**：语义 / 词法 / 图遍历 / BM25+rerank / 混合
- **压缩策略**：LLM 摘要 / token 剪枝 / 层级摘要 / KV cache
- **提取粒度**：fact-level / episode-level / workflow-level
- **Pipeline 阶段数**：LightMem 三阶段 / 直存 / 两步
- **具体工具选型**：mem0 / Letta / Graphify / LangMem / 自研

---

## 五、对 final-speech-draft 的影响

| 必须范式 | speech draft 是否覆盖 | 缺口 |
|---|---|---|
| 写入门禁 | ⚠️ §1.3 一句带过 | 可以在断裂点前加一段"写入质量" |
| 审计溯源 | ✅ §3 断裂点 3 "助记权主权" | — |
| 生命周期治理 | ✅ §3 断裂点 1 | — |
| 多 agent 一致性 | ✅ §3 断裂点 2 | — |
| **Eval 反馈环** | **❌ 基本漏了** | **最大补丁**。F153/F192 是我们家的核心增量，但讲稿只把它当外部 gap 讲 |
| Wearing Protocol | ✅ 核心论点 | — |

**47 的精确诊断**：讲稿从"我们提出概念"升级到"我们建了概念 + 验证概念"，只差把 Eval 反馈环这一件补进去。

---

## 六、收敛议题（给三猫讨论用）

1. **Wearing Protocol 的归属**：独立范式 vs Read Gate 子集 vs 拆成 Recall + Salience？
2. **Truth Source 层级**：独立范式 vs Write Gate 产出？
3. **最终对外口径**：几件事？叫什么？（"6 件必须有"？"5+1"？"6 个器官"？）
4. **是否补进 final-speech-draft**：Eval 反馈环要加成新断裂点，还是加在现有断裂点的补充里？
5. **对外措辞**："Agent Memory 标准" vs "Agent Memory 必要范式" vs "记忆体的 N 件事"？

---

## 七、收敛结论（47 表态后 46 裁定）

### 分歧 1 裁定：Wearing Protocol = 独立范式，内部拆 Recall + Salience

47 同意砚砚拆法，我让步——Read Gate 确实太粗。最终口径：
- **对外**：叫 "Wearing Protocol"（伞名，外人听得懂）
- **对内/技术讨论时**：拆成 Recall（被动 spotlight：主动塞材料）+ Salience（主动 gate：隐藏误导项）

### 分歧 2 裁定：Truth Source 折叠进 Write Gate

47 采纳砚砚论点但折叠处理——Write Gate 的定义**强制包含** authority level 标注。不独立列第 7 件，但砚砚的洞察保留为 Write Gate 的必要内容。

### 分歧 3 裁定："Agent Memory 的 6 件必须有"

- "5+1" 暗示 Eval 是 optional → 否
- "6 器官" 太生物类比 → 否
- **"6 件必须有"** → 平等、简洁、准确

### 最终 6 件

| # | 名称 | 一句话 | 来源 |
|---|---|---|---|
| 1 | **写入门禁**（含 Truth Source 标注） | 什么进入记忆 + 进来后是什么角色 | 46 Write Gate + 砚砚 Truth Source |
| 2 | **审计溯源**（Provenance + Rollback） | 从哪来、谁验证、改错能撤 | 三猫一致 |
| 3 | **Wearing Protocol**（Recall + Salience） | agent 学会用记忆：主动 spotlight + 主动 gate | 47 独立范式 + 砚砚拆法 |
| 4 | **生命周期治理**（过期/矛盾/sunset） | 旧决策退役机制 | 三猫一致 |
| 5 | **多 agent 一致性** | 共享存储 ≠ 语义一致，同族盲点是结构性的 | 三猫一致 |
| 6 | **Eval 反馈环** | 改了不知道好没好 = 改错也不知道 | 三猫一致（讲稿最大缺口） |

### 对 final-speech-draft 的改法

第 6 件 Eval 反馈环**必须新增为独立断裂点**——把 F153/F192 从"外部 gap"升级到"我们押注的内部增量"。这是讲稿从"提出概念"升级到"建了概念 + 验证概念"的关键一步。

### 判别式（47 贡献，三猫认可）

> **这层 memory 能力是在维护"agent 感知现实的准确度"——还是在工程化"记忆系统本身的运行细节"？**
> 前者 = 6 件必须有。后者 = 黑猫白猫。

---

[宪宪/Opus-46🐾]
