---
title: "当前检索剖面与 F209 优化方案"
date: 2026-05-21
status: discussion
doc_kind: discussion
topics: [memory, evidence-recall, search-evidence, passage-vector, entity-anchor, perspective]
related_features: [F102, F188, F200, F209]
participants: [landy, codex]
---

# 当前检索剖面与 F209 优化方案

## 0. 一句话版本

Cat Café 现在的记忆检索已经不是“一个 RAG”：

> **BM25 + embedding + docs/thread/message passage + collection 联邦 + F200 行为信号 rerank**。

真正缺的不是再加一个摘要器，而是把**消息级原文**也纳入同等强度的 evidence recall：能先搜到候选证据，再打开原始 message / invocation / file / thread window，由猫判断。

因此本轮收敛为新 feature：

> **F209: Evidence Recall Optimization — 消息级语义、实体门牌号与活查询藤**

## 1. 当前检索系统到底有什么

### 1.1 对外入口：`search_evidence`

MCP 工具 `cat_cafe_search_evidence` 当前已经有一套比较完整的查询面：

- `scope=docs|memory|threads|sessions|all`
- `mode=lexical|semantic|hybrid`
- `depth=summary|raw`
- `dateFrom/dateTo`
- `contextWindow`
- `threadId`
- `dimension=project|global|library|collection|all`
- `collections`
- `explain`

这意味着我们已经有三件事：

1. **范围控制**：查文档、查聊天、查 session、查 collection。
2. **检索策略控制**：BM25、向量、混合。
3. **深度控制**：summary-first；需要原文时 `depth=raw`。

这比 ChatGPT / Claude.ai 产品记忆里的“系统挑一些摘要塞进上下文”要硬很多，因为它是猫主动调用的 evidence tool。

### 1.2 索引层：docs 与 thread 都进了 evidence store

当前 SQLite evidence store 里有几层：

- `evidence_docs`：文档 / thread digest / session digest 的主表。
- `evidence_fts`：FTS5 BM25。
- `evidence_vectors`：文档级 embedding 向量。
- `evidence_passages`：thread message / transcript passage。
- `passage_fts`：passage 级 lexical 检索。
- `summary_segments`：thread 摘要片段 ledger。

IndexBuilder 当前会：

- 把 docs / features / decisions / discussions 编译进 `evidence_docs`。
- 给 dirty thread 写 thread summary。
- 把 thread messages 写进 `evidence_passages`，`passage_id=msg-{id}`，speaker / timestamp 也保存。
- 从 JSONL transcript 回填 passage，避免 Redis TTL 后旧消息不可搜。

这说明我们已经有了“消息级材料”，不是只存 thread summary。

### 1.3 检索与排序：已经有 hybrid 和联邦

当前检索路径大致是：

- 精确 anchor 直接命中。
- FTS5 BM25 查 `evidence_docs`。
- lexical contains backfill 补漏。
- semantic mode 走文档级向量 NN。
- hybrid mode 用 BM25 + vector NN 做 RRF 融合；CJK query 对 NN 有加权。
- `KnowledgeResolver` 做 project / global / library / collection 联邦检索。
- F200 consumption rerank、salience rerank、authority boost 作为后处理增强。

这已经接近“多路召回 + 融合排序”，不是简单关键词搜索。

## 2. 当前最大缺口

### 2.1 `depth=raw` 仍是 lexical-only

代码里明确写着：

> `depth=raw` forces lexical-only because passage-level vectors are not yet available.

也就是说：

- docs summary 可以 hybrid。
- thread summary 可以 hybrid。
- 但 raw message / passage 级别，当前主要靠 lexical。

这会导致铲屎官提出的真实场景不稳：

> “搜 landy 奶奶，能不能把所有和我奶奶相关的都找出来？即使聊天里没出现‘奶奶’两个字。”

如果旧消息没有字面词，但语义上在讲“外婆 / 家人健康 / 老人就医 / 家属照护”，当前 raw 检索不一定能捞到。不是因为我们缺摘要，而是因为**消息级原文没有语义召回路径**。

### 2.2 entity alias 还不是一等索引轴

03 提出的“实体门牌号”方向是对的：

```text
person:landy ← landy / 铲屎官 / CVO / lysander / l.s.
cat:gemini   ← gemini / 暹罗猫 / 烁烁 / gemini25 / gemini-3.1
```

但这不能只停在 GraphResolver 的 anchor 规范化。它还要落到检索阶段：

- query expansion：搜 `landy` 时要扩展为 alias 集。
- mention extraction：索引时记录 message/doc 提到了哪些实体。
- result explanation：告诉猫“这条为什么命中 person:landy”。

实体别名是**确定字典**，不是 classifier。系统可以告诉猫“这些词是同一个实体的门牌号”，不能替猫判断“这条消息是否真的在讨论某人的健康”。

### 2.3 drill-down contract 还不够统一

现在 `search_evidence(depth=raw)` 能返回 passage 和 context，但猫真正需要的是统一的“打开原文窗口”能力：

```text
read_message_window(threadId, messageId, before=5, after=5)
read_invocation_detail(invocationId)
read_file_slice(path, lineStart, lineEnd)
```

这不必强行统一成一个巨大 `read_anchor()` 黑盒。更稳的设计是：

- 统一 **anchor contract**：每条结果必须给可定位 anchor。
- 保留 **typed reader**：不同 source 用最适合它的读取方式。
- 每个 reader 支持窗口 / grep / line range，避免一次打开 10000 行。

统一的是坐标，不是读取实现。

### 2.4 Perspective 还没有产品化

03 的 Smart Folder 启发是“存问题，不存结果”。这个方向对，但要落得更精确：

- Perspective 存的是 **query plan / route recipe**，不是结果集。
- 每次打开都现场重跑，保证新鲜。
- 自动激活的是“给猫一根藤”，不是“给猫一个结论”。
- Perspective 的消费信号可进 F200，但只能影响 navigation utility，不能影响 truth / authority。

## 3. F209 方案

### Phase A：消息级语义召回

给 `evidence_passages` 增加 passage-level vector path：

- 为 message / transcript passage 生成 embedding。
- 新增 `passage_vectors` 或等价存储。
- `depth=raw&mode=semantic|hybrid` 不再强制降级 lexical。
- raw hybrid 用 passage BM25 + passage vector NN 做 RRF。
- 返回结果必须仍然是 message anchor + context window，不返回“摘要结论”。

这是“奶奶没有字面出现也能找线索”的基础。

### Phase B：实体门牌号

建立 durable entity registry：

- `entity_id`
- aliases
- type（person / cat / feature / external concept）
- provenance
- updated_at

索引时记录 candidate mentions；检索时做确定性 alias expansion。注意边界：

- alias 字典可以自动建议，但入库要有 provenance。
- inferred facet 只能标 candidate，不能直接当 truth。
- 隐私实体默认只在受控 scope 内检索。

### Phase C：typed message-window drill-down

把“搜到 thread / message 之后怎么打开”做成稳定 contract：

- message window：按 messageId 打开前后 N 条。
- invocation detail：按 invocationId 打开细节。
- file slice：按 path + line range 打开。
- thread digest/session digest 仍走现有 digest reader。

目标不是造一个万能 reader，也不是重复造已有工具。默认策略是：message window 扩展现有 thread context 读取能力；invocation 复用 / 补强 `read_invocation_detail`；file slice 优先让猫用 `rg` / `sed` / Read。统一的是 anchor contract，不是读取实现。

### Phase D：活查询 Perspective

实现类似 Smart Folder 的“活藤”：

```yaml
id: perspective:feature-origin
name: F 号来源追踪
query_plan:
  start: feature_id
  include:
    - feature spec
    - decisions
    - discussions
    - commits
    - recent thread mentions
  default_depth: summary
  drilldown: on-demand
```

Perspective 不是 topic map，不存结果。它只是猫反复使用的检索路径。

这一层必须先做 product spike，不能直接开写：至少回答“谁创建 Perspective、什么时候打开、返回什么结构”。v1 倾向猫手动保存 query plan；F200 自动建议和 settings 可见化后置。

### Phase E：F200 eval 集成

避免“看起来更聪明，其实召回更偏”，但不在 F209 自建第二套 eval：

- F209 每个 Phase 贡献 retrieval regression fixtures。
- F200 统一拥有 golden query set、recall@k、anchor open rate、false confidence、raw drill-down success。
- F200 consumption signal 只能影响 navigation utility，不得改变 authority。
- F200 统一做 exploration / freshness 对冲，防 rich-get-richer。

## 4. 对 03 的修正

03 的方向有三点正确：

1. Everything 的“只定位不回答”是对的。
2. Smart Folder 的“存问题不存结果”是对的。
3. entity alias / 门牌号是必要的。

但 03 还需要补三点：

1. **消息级语义召回是关键缺口**：没有 passage vector，alias / Perspective 也救不了“非字面命中”的旧聊天。
2. **facet 不能只来自确定结构信号**：确定信号优先，但可允许 candidate facet，前提是标明“不是真相”。
3. **不要过度害怕 embedding**：embedding 是传感器，不是判断者。只要结果带 anchor、猫读原文，embedding 就没有替猫下结论。

## 5. 非目标

- 不做小模型 topic splitter。
- 不做摘要注入式 memory。
- 不做自动 topic map 真相源。
- 不做算法替猫判断 intent。
- 不把 Perspective 的结果缓存成“当前事实”。
- 不用实体 / facet 推断替代原文证据。

## 6. Open Questions

1. `passage_vectors` 的存储形态：复用现有 vector store，还是独立 vec0 table？
2. message passage embedding 的 refresh 策略：热路径 append 即 embed，还是批处理？
3. entity registry 的真相源放哪里：runtime catalog、docs/team/entity-aliases.md，还是 DB + git-backed export？
4. candidate facet 的 UI / MCP 表达：如何让猫一眼看出“候选，不是真相”？
5. typed reader 的 MCP surface 是新增工具，还是扩现有 `read_session_events/read_invocation_detail` 家族？
6. Perspective 谁来创建：✅ v1 猫手动保存；F200 自动建议 / settings 可见化后置，Design Gate 前做 product spike。
7. retrieval eval 的初始 golden set 谁维护：✅ F200 统一收；F209 每个 Phase 贡献 fixture。

## 7. 收敛

当前 Cat Café 记忆系统已经证明了一件事：**原文证据层比产品记忆摘要更可靠**。下一步不是让模型“更会记”，而是让猫更快抓到原文：

> 搜索负责找候选证据，reader 负责打开原文窗口，resolve 负责当前有效决策，artifact 负责沉淀确认后的结论。

这就是 F209 的边界：**优化召回，不替猫判断；扩大原文可达性，不制造摘要真相源。**
