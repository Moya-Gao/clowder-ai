---
title: "Chat 记忆剖面与 Evidence-first Recall 讨论"
date: 2026-05-21
status: discussion
doc_kind: discussion
topics: [memory, chat-history, evidence-search, thread-recall, agentic-search, mcp]
participants: [landy, codex, opus-47, opus-46]
---

# Chat 记忆剖面与 Evidence-first Recall 讨论

本讨论来自 2026-05-21 铲屎官对 ChatGPT App / Claude.ai 记忆系统的对照追问，以及 Cat Café 当前 `search_evidence` / session-chain / thread-context 能否支撑“普通用户一个 thread 什么都聊”的产品问题。同日铲屎官还追问：能否从 Everything / Smart Folder 两个外部工具偷到优化检索的微创新。

## 文档结构

1. [ChatGPT App 与 Claude.ai 记忆剖面对照](./01-chatgpt-claude-memory-surfaces.md)
   - 摊开两边当前记忆形态：当前上下文、被动摘要、用户手控记忆、主动检索、Projects、Skills、MCP。
   - 结论：两边都更接近 personalization memory / retrieval helper，不是 decision provenance system。

2. [Cat Café Evidence-first Thread Recall 提案](./02-cat-cafe-evidence-first-thread-recall-proposal.md)
   - 把“长 thread 里多话题乱聊”建模为 evidence recall 问题，而不是小模型话题分片问题。
   - 结论：统一 anchor contract，不统一读取方式；`search_evidence` 找候选，typed drill-down 打开原始材料，猫负责判断。

3. [从 Everything + Smart Folder 学什么 — Agentic Recall 微创新拆解](./03-everything-smartfolder-microinnovations.md)
   - 从 Everything（只定位不回答）/ Smart Folder（存问题不存结果）抽两个可迁移微创新。
   - 结论：锚定 agentic search 硬约束；给 anchor contract 补 `entity` sourceType，让“搜 landy 健康 / gemini 基础设施”这类实体召回变准。

4. [当前检索剖面与 F209 优化方案](./04-current-retrieval-state-and-f209-optimization.md)
   - 基于当前代码摊开 `search_evidence` 的真实检索栈：BM25、embedding、docs/thread/message passage、collection 联邦、F200 rerank。
   - 结论：下一步不是“再加一个摘要器”，而是补齐消息级语义、实体门牌号、typed message-window drill-down、活查询 Perspective 与召回 eval。

## 核心共识

ChatGPT / Claude.ai 的产品记忆能延续关系、偏好和近期主题，但不能稳定承担架构决策、tradeoff、版本边界和完整推理链。Cat Café 不应该追求“让模型记得更多”，而应该让模型在需要时能查到同一套可审计证据。

一句话：

> 模型记忆负责连续性，工程工件负责真实性；摘要可以是索引，不能伪装成真相源。

03 在此之上补一条：外部工具值得学的是**检索的形状**（确定性定位器 + 可保存的活查询），不是**记忆的形态**（摘要注入）；且一切都服从 agentic search——系统给线索与原文坐标，判断永远归猫。

04 把这条讨论落到当前实现：Cat Café 已经不是纯 RAG，而是一套 evidence-first 检索栈；真正的缺口在 `depth=raw` 仍是 lexical-only、实体别名不是一等索引、消息窗口读取还不是统一 contract。该方案已提升为 **F209: Evidence Recall Optimization**。
