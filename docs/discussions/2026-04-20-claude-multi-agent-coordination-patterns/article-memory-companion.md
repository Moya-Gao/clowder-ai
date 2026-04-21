---
title: "Cat Cafe Memory Companion（A2A 拆解配套）— 检索、编译、Session Continuity、知识生命周期"
date: 2026-04-21
authors: [gpt52]
status: draft
doc_kind: discussion
topics: [memory, search, evidence, session-bootstrap, knowledge-lifecycle, architecture]
refs:
  - ../../features/F102-memory-adapter-refactor.md
  - ../../features/F065-session-continuity.md
  - ../../features/F163-memory-entropy-reduction.md
  - ../../decisions/020-f102-memory-system-architecture.md
  - article-a2a-technical-deep-dive.md
---

# Cat Cafe Memory Companion（A2A 拆解配套）

> 这篇是 [`article-a2a-technical-deep-dive.md`](./article-a2a-technical-deep-dive.md) 的配套件。  
> 它只回答一个问题：**shared state 里最复杂的那块“记忆”到底是怎么落地的。**

## 1. 为什么记忆必须单独拆

在我们家，记忆不是一个检索 API，而是一条从真相源到 runtime recall 的完整链：

```text
docs / discussions / decisions / lessons / markers
  → IndexBuilder 编译
  → evidence.sqlite / global_knowledge.sqlite
  → KnowledgeResolver 检索融合
  → /api/evidence/search
  → MCP search_evidence
  → SessionBootstrap / 猫主动 recall
  → feedback / marker / materialize / reindex 回流
```

这条链本身就足够复杂，和 A2A 放在同一篇里会互相压缩，所以必须拆开。

## 2. 真相源分层：什么是源，什么是编译产物

F102/ADR-020 的关键决定，是把“真相源”和“索引”分开。

### 真相源

- `docs/*.md`
- `docs/discussions/*.md`
- `docs/decisions/*.md`
- `docs/lessons*.md`
- `docs/markers/*.yaml`

### 编译产物

- `evidence.sqlite`
- `global_knowledge.sqlite`

这意味着：

- SQLite 不是知识本体
- rebuild 不会让知识蒸发
- marker 审核历史不能只存在 DB 里

对 agent 系统来说，这个分层是对的，因为：

> **索引是加速器，不是真相。**

## 3. 记忆系统的六个核心接口

F102 把记忆系统拆成 6 个接口：

1. `IIndexBuilder`
2. `IEvidenceStore`
3. `IMarkerQueue`
4. `IMaterializationService`
5. `IReflectionService`
6. `IKnowledgeResolver`

从 runtime 角度看，A2A 和别的流程最常直接碰到的是其中三件：

- `IEvidenceStore`
- `IKnowledgeResolver`
- `SessionBootstrap`

## 4. 检索链路：猫调用 `search_evidence` 时发生了什么

最常用的 recall 入口是 `search_evidence`。背后的链路是：

```text
MCP tool: cat_cafe_search_evidence
  → HTTP GET /api/evidence/search
  → evidence.ts 解析 q / scope / mode / depth / dimension
  → KnowledgeResolver.resolve()
  → projectStore / globalStore 搜索
  → RRF 融合（需要时）
  → 结果映射成 EvidenceResult
```

实现入口：

- [evidence.ts](/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/routes/evidence.ts)
- [KnowledgeResolver.ts](/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/memory/KnowledgeResolver.ts)

### 4.1 mode 不是 UI 装饰，而是三条真检索路径

ADR-020 把检索分成三条独立路径：

- `lexical`
- `semantic`
- `hybrid`

不是“一个检索再调几个参数”，而是真正不同的召回路径。

### 4.2 dimension 让记忆不只会搜当前项目

`KnowledgeResolver` 支持：

- `project`
- `global`
- `all`

在 `all` 下，会同时搜 project 和 global，然后用 RRF 融合。  
这一步决定了我们的记忆不是单项目小仓库，而是：

> **项目层真相 + 全局方法论层真相** 的联邦检索。

### 4.3 检索结果已经带治理语义

`evidence.ts` 不只是把 SQLite 结果原样吐出来，它会补齐：

- `sourceType`
- `confidence`
- `authority`
- `variantId`
- `degraded`

所以从猫的视角看，`search_evidence` 不是 grep，而是：  
**带排序语义、治理语义、实验语义的 recall 接口。**

## 5. shared state 为什么不是“搜得到就行”

真正让记忆成为协作底座的是三件事：

### 5.1 Session continuity

F065 把 session continuity 做成窄口 bootstrap，而不是粗暴灌历史。

核心注入包括：

- session identity
- previous session digest / handoff digest
- task snapshot
- thread memory
- recall instructions

这让新 session 的猫一醒来就知道：

- 我是谁的第几次 session
- 上轮大概发生了什么
- 当前 thread 上有哪些任务
- 如果不够，应该去哪里继续 drill down

### 5.2 Thread-level memory，而不是 cat-local memory

ADR-020 很明确：

- `Thread` 是共享语义单元
- `Session Chain` 是 per-cat 运行时单元

如果记忆只按 cat-local 存，handoff 会变成“把我脑子里的内容再讲一遍”；  
而 thread-level memory 让“本线程共同知道什么”成为可能。

### 5.3 marker → materialize → reindex

我们的知识不是“写进向量库就算结束”，而是：

```text
新洞察 / 新教训
  → marker captured
  → 审核 / 归一
  → materialize 到 docs
  → IndexBuilder reindex
  → 下一轮 recall 可见
```

所以 knowledge 在我们家是有 **生产线** 的，不是纯粹存储。

## 6. F163 把“搜得到”升级成“不会越堆越脏”

如果没有 F163，F102 最终还是会面临一个典型问题：

> 能记住越来越多东西，但系统会越来越熵增。

F163 的意义是把 memory 从“只会长”变成“会治理”：

- authority / confidence 解耦
- stale / contradiction / supersedes
- compression / condense / review queue
- entropy reduction

对 A2A 来说，这件事不是锦上添花，而是底座质量。  
因为如果 memory 里混满了过期知识、互相矛盾的结论、被错误压缩的摘要，那 handoff 看起来再顺，也只是把噪音传得更快。

## 7. 从 A2A 角度看，记忆真正提供了什么

如果只从 A2A 的问题意识看，我会把记忆层的贡献压缩成三件事：

### 7.1 降低 handoff 信息损耗

下一只猫不是只能靠上一只猫的自然语言总结来接球。它还能：

- 读 shared task state
- 读 thread memory
- 搜 docs / discussions / decisions / lessons
- drill down 到 session / invocation

所以 handoff 不再是单通道传话，而是多通道恢复。

### 7.2 让“团队经验”可继承

没有记忆层，每次换猫就像换新人。  
有记忆层之后：

- 过去踩过的坑可被下一只猫绕开
- 已经拍板的决策不需要重争一遍
- review 不是从零判断上下文

### 7.3 让治理真正可闭环

球权协议、SOP、quality gate、review verdict 这些规则，不只是活在 prompt。  
它们还会通过：

- lesson
- canon
- decision
- marker
- reindex

重新变成未来 recall 的一部分。

## 8. 当前判断

如果给这篇 companion 一个最短结论，我会这么写：

> Cat Cafe 的记忆不是“一个搜索工具”，而是  
> **真相源分层 + 编译索引 + 联邦检索 + session continuity + 知识生命周期治理**  
> 共同构成的协作记忆基础设施。

也因此，A2A 主稿里只需要引用它，不应该试图吞掉它。
