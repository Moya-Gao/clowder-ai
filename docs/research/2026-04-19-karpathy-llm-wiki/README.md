---
doc_kind: research
created: 2026-04-19
status: index
topics: [karpathy, llm-wiki, graphify, memory, harness-engineering]
related_features: [F102, F148, F152, F163, F167, F169]
---

# 2026-04-19 Karpathy LLM Wiki 研究专题

这个目录集中放和 **Karpathy《LLM Wiki》、Graphify，以及我们家 F102/F148/F152/F163/F167** 对照相关的研究材料，以及由此引出的 [F169 立项提案](../../features/F169-agent-memory-reflex.md)。

## 文件索引

- [source-note.md](./source-note.md)
  Karpathy《LLM Wiki》原始 gist 的结构化摘要。保留原始链接和核心抽象，不镜像全文。（砚砚/gpt52）

- [comparison.md](./comparison.md)
  `Karpathy LLM Wiki vs Graphify vs 我们家 F102/F152/F163/F167` 对照表。（砚砚/gpt52）

- [human-readable-comparison.md](./human-readable-comparison.md)
  三套方案的**人话版**对比分析。用故事和类比讲清楚三者的区别。（宪宪/opus-46）

- [opus47-perspective.md](./opus47-perspective.md)
  opus-47 的**跨族视角**延续：主体层 vs 产物层、LLM ≈ ADHD externalized working memory 同构、Karpathy Schema 层被低估。引出 [F169 立项提案](../../features/F169-agent-memory-reflex.md)。

## 由此 spin-off 的愿景文档

- [F169: Agent Memory Reflex](../../features/F169-agent-memory-reflex.md)（**vision substantially realized, 2026-04-25**）
  把记忆从"猫需要搜的书架"升级为"猫的外部工作记忆反射"。三层愿景实现度：Compiled Wiki Self-Authoring（剥离 F169，待铲屎官在 2026-05-19 前决策 F102 产物增强）/ Reflex Injection（**✅ F148 Phase F-H done**，2026-04-25）/ Task-scoped Salience Gating（**✅ F163 Phase F merged** PR #1412 `b843744f`，2026-04-25）。review 3 条 P1/P2 finding 全部接受，B+C 已闭环。

## 为什么单独建目录

这组材料不是一次性问答，而是一个会继续增长的专题：

- 可能继续补 `llm-wiki-compiler` / `Pratiyush/llm-wiki`
- 可能继续补“Cat Café 版 LLM Wiki 应如何设计”
- 可能继续把 F167 和 memory transport 的关系说得更清楚
- F169 review 反馈后的迭代也放在这里

单独建目录后，后续补充不用再把文件散落在 `docs/research/` 根目录。
