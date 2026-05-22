---
title: "Chat 记忆剖面与 Evidence-first Recall 讨论"
date: 2026-05-21
status: discussion
doc_kind: discussion
topics: [memory, chat-history, evidence-search, thread-recall, mcp]
participants: [landy, codex]
---

# Chat 记忆剖面与 Evidence-first Recall 讨论

本讨论来自 2026-05-21 铲屎官对 ChatGPT App / Claude.ai 记忆系统的对照追问，以及 Cat Café 当前 `search_evidence` / session-chain / thread-context 能否支撑“普通用户一个 thread 什么都聊”的产品问题。

## 文档结构

1. [ChatGPT App 与 Claude.ai 记忆剖面对照](./01-chatgpt-claude-memory-surfaces.md)
   - 摊开两边当前记忆形态：当前上下文、被动摘要、用户手控记忆、主动检索、Projects、Skills、MCP。
   - 结论：两边都更接近 personalization memory / retrieval helper，不是 decision provenance system。

2. [Cat Café Evidence-first Thread Recall 提案](./02-cat-cafe-evidence-first-thread-recall-proposal.md)
   - 把“长 thread 里多话题乱聊”建模为 evidence recall 问题，而不是小模型话题分片问题。
   - 结论：统一 anchor contract，不统一读取方式；`search_evidence` 找候选，typed drill-down 打开原始材料，猫负责判断。

## 核心共识

ChatGPT / Claude.ai 的产品记忆能延续关系、偏好和近期主题，但不能稳定承担架构决策、tradeoff、版本边界和完整推理链。Cat Café 不应该追求“让模型记得更多”，而应该让模型在需要时能查到同一套可审计证据。

一句话：

> 模型记忆负责连续性，工程工件负责真实性；摘要可以是索引，不能伪装成真相源。

