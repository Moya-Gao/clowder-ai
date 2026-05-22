---
title: "从 Everything + Smart Folder 学什么 — Agentic Recall 微创新拆解"
date: 2026-05-21
status: discussion
doc_kind: discussion
topics: [memory, agentic-search, everything, smart-folder, entity-recall, evidence-recall, mcp]
related_features: [F102, F188, F200, F209]
participants: [landy, opus-47, opus-46, codex]
---

# 从 Everything + Smart Folder 学什么 — Agentic Recall 微创新拆解

## 0. 一句话版本

我们不抄 Everything / Smart Folder 的产品功能，只抄两个微创新：

> **Everything 的"只定位不回答"，Smart Folder 的"存问题不存结果"。**

两个都必须服从一条不可让渡的硬约束——**agentic search**：猫抓到一条线索（小金鱼），自己顺藤摸瓜找到知识簇（鱼群），系统永远只给【线索 + 原文坐标】，不端【煮好的结论】。

本文是这条讨论线（铲屎官 ↔ opus-47 / opus-46 / codex，2026-05-21）的收敛。01 摊开外部产品记忆剖面，02 提出 evidence-first thread recall；本文聚焦一个 01/02 没展开的角度：**从 Everything / Smart Folder 这两个外部工具，能偷到什么可迁移的微创新，以及它们怎么落到我们的 anchor contract 上。**

> **Codex 实现核对（2026-05-21）**：本文提出的"实体门牌号 + 活的藤"方向成立，但还漏了一个更底层的实现缺口：当前 `depth=raw` 仍是 lexical-only，消息级 passage 还没有语义向量路径。也就是说，"landy 奶奶"这类没有精确字面命中的旧聊天召回，不能只靠 alias / Perspective 解决，必须补 **message/passage-level semantic recall**。完整剖面与立项方案见 [04 当前检索剖面与 F209 优化方案](./04-current-retrieval-state-and-f209-optimization.md)。

## 1. 先钉约束：agentic search 是验收标尺

学任何外部 idea 之前，先把不能动的东西钉死。

**渔夫，不是客人。** 猫是带着网、有方法的渔夫：

- 抓到**一条小金鱼** = 一个高信号命中
- **顺藤摸瓜** = 沿 anchor / edge 一跳一跳遍历
- 找到**鱼群** = 相关知识簇

系统的产物**永远是【线索 + 原文坐标】**（`thread:xxx#message:yyy`、`docs/.../F208.md:120`），不是【结论】。猫拿着坐标自己 `Read` / `rg` / `git show` 打开原文，自己判断。

这跟 02 §2「search_evidence 找候选，不下结论」、02 §6「Retrieval 可以自动，judgment 不能黑盒自动」是同一条线。01/02 已经把它钉死，本文不重复论证——只把它**升格成验收标尺**：下面 Everything / Smart Folder 的每个 idea，凡是会把猫从渔夫降级成客人的，一律否决。

### 1.1 一个被否决的方向：pre-cooking（预煮）

讨论过程中出现过一个有诱惑力、但错误的方向，记录在此当反模式：

> ❌ 系统识别到"猫在找 landy 健康" → 自动把所有相关证据预装成一个工作集 → 整盘端给猫。

为什么否决：

- 这把猫从**主动检索的渔夫**降级成**等上菜的客人** = 直接违反 agentic search。
- 预装的工作集是一个**黑盒结论**（"这些就是全部相关证据"）= 违反「给数据不给结论」(KD-8)。
- 它和 02 §5「Topic Map 是视图不是真相源、默认不持久」是同一条红线的两个切面。

**红线**：任何"自动装配工作集 / 自动生成 topic map / 自动宣称结论"都踩线。系统可以让猫**更快抓到第一条鱼、给猫更多更好顺的藤**，但**绝不能替猫把鱼群打包**。

## 2. Everything 学什么

### 2.1 它酷在哪——"拒绝回答"

Everything 最酷的一点是它的**克制**：

> 它从不回答你的问题，它只告诉你东西**在哪**。

你敲一个词，它瞬间给你完整路径——不是文件内容，是**位置**；然后你自己去打开。它快，是因为它**只索引"确定的、能区分的"metadata**（文件名 / 路径 / mtime / size），完全不做内容理解；变更靠 NTFS 的 USN journal 保证"不遗漏"。

"拒绝回答、只给坐标"——这恰恰是它最 agentic 的地方：它永远把用户留在驾驶座。这也正是铲屎官说的"原文在哪里……方便你们最终可以 grep"。**我们现在的 `search_evidence` 返回 anchor + drill-down，本来就是这个哲学；Everything 的价值是确认这条路对，并给出两个可迁移的具体动作。**

### 2.2 微创新 ①：确定性定位器 —— 给"实体"也建门牌号

**启发**：把"能确定、能区分"的东西做成一等检索轴，让 recall **当场 filter**，而不是"捞一大堆再重排"。

**01/02 没覆盖的缺口**：02 §3 的 anchor contract 覆盖了 `docs/file`、`thread/message`、`session`、`invocation`、`decision graph`、`recent activity`——但**没有"实体"这一类 anchor**：人、猫、外部概念。

而铲屎官给的三个验收场景**全是实体召回**：

| 场景 | 实体 | facet |
|---|---|---|
| 搜 landy 健康情况 | `person:landy` | health |
| 搜 landy 职业情况 | `person:landy` | career |
| 搜 gemini 相关基础设施 | `cat:gemini` | infrastructure |

**现在为什么哑**：lexical 检索里 `landy` 和 `铲屎官` 是两个不同的字符串。如果某条记录正文用的是"铲屎官"而不是"landy"，搜"landy …"时它就匹配不上、排不进前列——这正是 noise 诊断里的"别名误伤"。

**解法**：一张**确定的 entity-alias 规范化表**——

```text
person:landy   ← landy / 铲屎官 / CVO / lysander / l.s.
cat:gemini     ← gemini / 暹罗猫 / 烁烁 / gemini25 / gemini-3.1
...
```

关键：这是**确定的字典，不是 classifier**——只做别名归一，不做语义判断，守住 KD-8。

**不是从零造**：`packages/api/src/domains/memory/GraphResolver.ts` 已经有 anchor 级的 alias 规范化机制（多种 lookup 形式 → 一个 canonical anchor，例如 `F186`）。微创新就是**把这套机制从"文档锚点"扩展到"实体节点"**，并在 02 §3 的 anchor contract 表里**新增一行 sourceType**：

| sourceType | anchor 示例 | 最佳读取方式 |
|---|---|---|
| **entity** | `person:landy` / `cat:gemini` | `graph_resolve`（顺藤到所有提到它的原文） |

这一行就是把 Everything 的"确定性定位器"落到我们的契约里。

### 2.3 微创新 ②：变更日志驱动索引——但日志直接用 git

Everything 用 USN journal 避免每次全盘重扫。我们对应的"变更日志"——**大部分已经存在，不用新造**：

- `docs/` / `docs/markers/` / skills 是 git-tracked → **`git log` 本身就是 changelog**，index cursor = last-indexed commit SHA。
- thread / message 在带时间戳的 store 里 → store 本身就是 thread 的 changelog。
- 编译产物（edges / summary）是我们自己写的 → 写时本地 hook 记录即可。

**因此不建议新造一个 `memory_change_journal`**：那要求每个写记忆的路径都可靠 emit 事件——一个跨切面契约，只要一个 writer 漏 emit，journal 就撒谎，而**会撒谎的变更日志比定期重扫更危险**（你会信它）。

真正有迁移价值的是**从 git diff 推导出的语义事件**（而不是文件级 `{path,mtime,hash}` 流）：`anchor_superseded`、`authority_changed`、`edge_added`。这些事件本身就是新的"藤"——例如 `anchor_superseded` 直接告诉猫"这条过时了，顺到新的那条"。

### 2.4 一句话

> Everything 教我们：把"鱼在哪"指得又快又准（**实体也要有门牌号**），并且永远只给坐标、让猫自己游过去看原文。

## 3. Smart Folder 学什么

### 3.1 它酷在哪——"存问题，不存结果"

Smart Folder 最容易被误解（§1.1 的 pre-cooking 漂移就栽在这）。它的本质是：

> 它存的**不是搜索结果，是搜索本身**。

"这个项目这周改过的 PDF"是一条**规则**，每次打开**现场重新跑一遍**，你照样得自己点进每个文件看。它保鲜的是**那根藤**，不是**那筐鱼**。

### 3.2 微创新 ③：可保存、可命名、活的"藤"

**启发**：让猫把"我反复要顺的那根藤"存下来、起个名。例如：

> 「从任意一个 F 号 → 顺到它的 ADR + 教训 + 最近的讨论 thread」

下次猫从一条新的小金鱼出发，直接拉这根**叫得出名字的藤**——但摸瓜、读原文的，永远是猫自己。

**边界一（铲屎官明确纠正过的点）：检索的最终用户是猫，不是人。**

- 存藤的、命名藤的、用藤的，**都是猫**。
- 人（landy）在这套系统里是**被召回的实体**（`person:landy`），**不是配视图的操作员**。
- 视图由**猫的任务自动激活**（debug 时顺 test / log 那几根藤，写方案时顺 spec / ADR 那几根），或一根藤被反复拉而**自动涌现固化**。

**边界二（agentic）：Smart Folder = 保存的【起点筛子 + 顺哪几根藤的预设】，不是保存的【结果集】。**

打开一个 Perspective = **现场重跑**、给出一批**带坐标的线索**；摸瓜、读原文的永远是猫。这跟 02 §5「Topic Map 默认不持久、是视图不是真相源」完全一致——Perspective 就是"可命名、可复用的 Topic Map 查询"，而不是固化的 Topic Map。

### 3.3 一句话

> Smart Folder 教我们：让猫存下"常顺的那几根藤"，每次现场重跑保持新鲜——但摸瓜的永远是猫。

## 4. 三个验收场景走查

把铲屎官的三个场景跑一遍，证明"实体定位器 + 活的藤"在 agentic 约束下怎么工作。

### 4.1 「搜 landy 健康情况」

```text
1. 实体解析：landy → person:landy（确定别名表，非分类器）
2. 顺藤：graph_resolve(person:landy) → 联邦召回所有提到该实体的原文候选
   （全局记忆层 + 项目 docs / threads），每条带 anchor + drill-down 建议
3. 猫顺藤摸瓜：按 facet=health 收窄，逐条 drill-down 打开原文
4. 猫读原文自己判断，给出回答 + 支撑 anchor
```

精确的根因是**第 1 步的实体别名归一**，不是更聪明的 BM25；系统全程只给候选 + 坐标，没有打包结论。

### 4.2 「搜 landy 职业情况」

同 4.1，`facet=career`。同一根"实体藤"，换一个 facet 收窄——这正是"活的藤"的价值：藤是复用的，facet 是猫当场拧的旋钮。

### 4.3 「搜 gemini 相关基础设施」

```text
1. 实体解析：gemini → cat:gemini（别名：暹罗猫 / 烁烁 / gemini25 / gemini-3.1）
2. 顺藤：gemini 参与过 / 被 @ 点名的 thread（speaker / mention 是确定信号）
        + 打了 gemini 标签的 docs + 基础设施相关 feature
3. 猫 drill-down 读原文，自己判断哪些算"基础设施"
```

facet 用**现成的确定信号**（thread 的 speaker / @mention、frontmatter `topics`、doc kind），不引入内容分类器。

## 5. 收敛

### 5.1 要学的（四条）

| # | 微创新 | 来自 | 落到哪 | 不可越的红线 |
|---|---|---|---|---|
| ① | 确定性定位器：实体也建门牌号 | Everything | 扩 `GraphResolver` 实体节点；02 anchor contract 加 `entity` 行 | 别名表是字典不是 classifier |
| ② | 变更日志驱动索引 | Everything | 用 `git log` 当 changelog + 派生语义事件 | 不新造跨切面 emit 契约 |
| ③ | 可保存 / 命名 / 活的"藤" | Smart Folder | 猫驱动的 Perspective（F188 navigation 层） | 存查询不存结果；猫存不是人存 |
| ④ | 任务自动激活视图 | Smart Folder | 按 skill / 任务自动切藤 | 自动的是"给藤"，不是"给结论" |

### 5.2 明确不学的

- ❌ saved-memory / userMemories 式的**摘要注入**——01 的结论：那是 personalization memory，不是 decision provenance。
- ❌ 把摘要硬塞进上下文当 current truth——02 §1 反目标。
- ❌ 小模型话题分片器——02 §1 反目标。
- ❌ 自动 topic map / 自动工作集——本文 §1.1 反模式。

一句话：

> Everything / Smart Folder 值得学的是**检索的形状**（定位器 + 活查询），不是**记忆的形态**（摘要注入）。

## 6. 与 01 / 02 的关系

| 文档 | 角度 | 结论 |
|---|---|---|
| 01 | 外部产品（ChatGPT / Claude.ai）记忆剖面 | 它们是 personalization memory + retrieval helper，不是 decision provenance |
| 02 | Cat Café thread recall 机制 | 统一 anchor contract，typed drill-down，猫判断 |
| **03（本文）** | 从 Everything / Smart Folder 抽**可迁移微创新** | 实体定位器 + 活的藤；给 02 的 anchor contract **补 `entity` 这一类** |

03 不和 02 竞争——03 是 02 的延伸：02 把 thread / session / invocation 纳入 evidence，03 再把"实体"纳入，并补两个让"顺藤摸瓜"更快更准的机制。

> 致谢讨论：opus-46 贡献了"Everything = 确定性"这个 framing；codex（砚砚）贡献了 noise 分桶诊断与 01 / 02 的 evidence-first 骨架。本文在其上收敛。

## 7. Open Questions

接 02 §8 继续编号：

6. **entity-alias 表谁维护、怎么和 runtime catalog 对齐？** 猫的句柄（`@codex` / `@gemini` …）已有 runtime catalog；人的别名（landy / 铲屎官 / CVO）目前没有单一真相源。需定一个 durable、git-tracked 的 entity-alias 表。
7. **facet（health / career / infrastructure）从哪来？** 倾向只用现成结构化信号（frontmatter `topics`、文件 `type`、doc kind、thread speaker / mention），不引入内容分类器。若某 facet 必须推断，应作为候选呈现而非真相。
8. **实体召回如何联邦全局层与项目层？** `person:landy` 的证据可能同时存在于全局记忆层（MEMORY.md 及其索引的记忆文件）与项目层（`evidence.sqlite`）。需确认 RRF 联邦能否覆盖实体维度。
9. **"藤被反复拉而自动固化"的阈值如何防 rich-get-richer？** 自动涌现用 F200 consumption 信号，但 consumption 只能影响 navigation utility、不能动 truth / authority；需要 exploration / freshness 对冲项，避免召回单一化（"成功轨迹"类视图尤其危险）。
10. **scope 与立项**：✅ 已提升为 **F209 Evidence Recall Optimization**。F102（索引 / `GraphResolver`）、F188（navigation / Perspective）、F200（consumption telemetry）保留为 related/base，不把本轮需求拆散塞回旧 Phase。

## 8. 结论

我们不缺的是"替猫下结论的更聪明搜索"，也不该抄外部产品的摘要注入式记忆。从 Everything / Smart Folder 真正该偷的是两个微创新——

> **把"东西在哪"指得又快又准（连实体都有门牌号），并让猫能存下"常顺的那几根藤"。**

两个都服从同一条铁律：系统给猫**第一条准的小金鱼 + 一把顺得动的藤 + 每条都带原文坐标**，然后**让开**。摸瓜的、读原文的、下结论的，永远是猫。
