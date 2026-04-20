---
doc_kind: research
created: 2026-04-19
status: source-note
topics: [karpathy, llm-wiki, memory, compiled-knowledge, wiki]
related_features: [F102, F152, F163, F167]
source_url: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
retrieved_at: 2026-04-19
---

# Karpathy《LLM Wiki》Source Note

> 说明：本文件保存 **source note**，不是原文镜像。目的是把外部原始想法落成家里的可追溯摘要，避免只在聊天里提过一次就散失。

## 一句话

Karpathy 提出的不是一个现成产品，而是一个 **knowledge compilation pattern**：

> 不要让 LLM 在每次提问时都重新从 raw documents 里发现知识；而要让它持续维护一个位于 raw sources 和 query 之间的 persistent wiki。

## 这份 gist 在说什么

### 1. 它批评的对象

Karpathy 把常见 RAG 体验概括成：

```text
query -> retrieve chunks -> answer
```

问题不是它不能答，而是：

- 每次问都要重新“发现”相同关系
- 多文档综合不会积累
- 知识没有被编译成可复用中间层

### 2. 它提出的替代方案

在 raw sources 和提问之间，加一个由 LLM 维护的 wiki：

```text
raw sources -> persistent wiki -> query / lint / save-back
```

这个 wiki 不是人手工写，而是 LLM 负责：

- 读新资料
- 抽取关键信息
- 更新实体页 / 主题页 / 综合页
- 维护交叉引用
- 标记新旧说法的冲突与修正

Karpathy 的关键词不是“检索增强”，而是 **persistent, compounding artifact**。

### 3. 三层架构

Karpathy 把整个系统拆成三层：

| 层 | 作用 |
|---|---|
| Raw sources | 原始资料，只读，不修改 |
| Wiki | LLM 维护的 markdown 知识中间层 |
| Schema | 告诉 LLM 怎么 ingest / query / lint / maintain 的规则文件 |

这是最值得记住的抽象。它本质上是把“prompt 中的一次性上下文”升格为“可持续维护的知识表示层”。

## 关键操作

Karpathy 在 gist 里描述了三类核心操作：

### Ingest

新 source 进入后，不只是索引它，而是把它整合进现有 wiki。

### Query

问题优先针对 wiki 回答；好的回答还可以回写 wiki，形成新的知识页。

### Lint

定期做健康检查：

- 冲突
- stale claims
- orphan pages
- 缺失 cross-references
- 值得继续追问的问题

## 为什么这件事打到我们

它和我们家 Round 4 的“数学之美 / 第一性原理”高度同频，因为它不是在原坐标系里堆更多 retrieval 技巧，而是在**换知识表示坐标系**：

- 从 “每次 query 重新拼”
- 改成 “先编译成可读、可维护、可积累的中间层”

这符合我们家的判断：

> 最优表达在正确坐标系下必然更简。

## 它没有解决什么

Karpathy 这份 gist 刻意保持抽象，所以它没有展开：

- 多 agent 协作
- 权威性 / 生命周期治理
- 审批与 materialize 流程
- 跨项目迁移
- 角色与球权传递
- 运行时权限边界

也就是说，它更像是 **知识表示层的第一性原理**，而不是完整的 agent memory runtime。

## 和我们家的映射

| Karpathy 概念 | 我们家的对应 |
|---|---|
| Raw sources | `docs/*.md` / `docs/markers/*.yaml` / 外部项目文档 |
| Wiki / compiled layer | `evidence.sqlite` / `global_knowledge.sqlite` / 各种摘要与 evidence 结果 |
| Schema | `shared-rules.md`、skills、feature specs、SystemPromptBuilder 注入规则 |

但我们家的 compiled layer 不是“wiki 页面优先”，而是 **SQLite index + 联邦检索 + 治理元数据** 优先。

## 结论

Karpathy《LLM Wiki》最重要的价值不是某个具体实现细节，而是它给了一条非常干净的判断轴：

> 记忆系统的重点，不该只是“能搜”，而是“有没有把知识编译成一个会复利的中间层”。

这条轴对我们家依然有效。
