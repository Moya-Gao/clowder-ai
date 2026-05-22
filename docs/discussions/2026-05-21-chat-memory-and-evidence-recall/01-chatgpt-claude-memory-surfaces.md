---
title: "ChatGPT App 与 Claude.ai 记忆剖面对照"
date: 2026-05-21
status: discussion
doc_kind: discussion
topics: [chatgpt, claude-ai, memory, personalization, retrieval]
source: "铲屎官提供的 ChatGPT App / Claude.ai 记忆系统剖面"
---

# ChatGPT App 与 Claude.ai 记忆剖面对照

## 0. 一句话版本

ChatGPT App 与 Claude.ai 都已经有“个性化上下文”能力，但它们都还不是完整的决策来源系统。

- **ChatGPT App**：当前上下文窗口 + saved memories + reference chat history / past chats 摘要 + Projects / files / connectors，主要表现为系统选择性注入相关上下文。
- **Claude.ai**：当前上下文窗口 + userMemories 被动摘要 + memory_user_edits 用户手控卡片 + conversation_search / recent_chats 主动 snippet 检索 + Projects + Skills + MCP 连接器。

差异是：Claude.ai 多了显式主动检索旧聊天 snippets 的能力；但 snippets 仍不是全文，摘要仍不是审计材料。

## 1. 共同可靠层：当前 thread 原文

两边最可靠的记忆层都是当前对话窗口。

当前 thread 中的原文有顺序、上下文、语气和相邻轮次，适合做精确判断。只要内容还在上下文窗口里，模型能直接读原文。

问题是：普通用户经常在一个 thread 里什么都聊，thread 会变得很长；一旦上下文压缩、截断或跨 session，当前窗口就不再等于完整历史。

## 2. ChatGPT App：被动个性化注入为主

ChatGPT App 目前可以表现出几类记忆能力：

- **saved memories**：长期小卡片，适合稳定事实、偏好、关系梗。
- **reference chat history / past chats**：系统从过去对话中提取有用信息，用于个性化回答。
- **Projects / project-only memory**：作用域隔离，让项目内对话互相引用而不污染项目外。
- **Temporary Chat**：不进入历史、不创建 memories。
- **文件 / connectors**：在可用时把相关源拉入上下文。

这套能力的强项是：

- 用户偏好连续性
- 关系与设定延续
- 常驻身份、风格、近期主题

弱项是：

- 不能稳定打开旧 thread 全文
- 不能精确复盘某次架构讨论的推理链
- 不能保证 tradeoff、反对意见、版本边界、原话都被保留
- 被注入的摘要常缺少 provenance、时间、状态和适用范围

关键风险：

> 摘要被注入后，模型会天然高估它，把“线索”当“事实”回答。

## 3. Claude.ai：被动摘要 + 主动 snippet 检索

Claude.ai 这边比 ChatGPT App 多了一层主动召回：

- **userMemories**：系统在 prompt 里注入的摘要包，覆盖 work context、personal context、top-of-mind、brief history 等。
- **memory_user_edits**：用户显式管理的记忆卡片层。
- **conversation_search / recent_chats**：模型可以主动检索旧 chat snippets。
- **Projects**：项目作用域隔离。
- **Incognito Conversations**：不进入记忆。
- **Skills**：稳定 SOP / 程序性知识以文件形态存在。
- **MCP 连接器**：外部数据源访问，但不是自动持久记忆。

这套能力的强项是：

- 不只被动吃摘要，还能主动找旧聊天 snippets
- 用户手控记忆入口更显式
- Skills 把稳定操作知识从“记忆”升级成文件

弱项仍然是：

- conversation_search 返回 snippets，不是完整 transcript
- 检索偏文本匹配，不能保证语义覆盖
- 不能跨 project 联合检索
- 不能自然给出完整推理链、版本边界和最终决策状态

关键风险：

> snippet 缓解了“找不到旧聊天”的问题，但没有解决“旧聊天是否足以成为决策证据”的问题。

## 4. 两边的本质定位

| 维度 | ChatGPT App | Claude.ai |
|---|---|---|
| 当前 thread 原文 | 有 | 有 |
| 长期偏好/设定 | saved memories | userMemories + memory_user_edits |
| 过去聊天引用 | reference chat history / past chats | userMemories + conversation_search / recent_chats |
| 主动检索旧 chat | 弱 / 不稳定依赖产品面 | 有 snippets |
| 旧 thread 全文 | 不能稳定打开 | 不能稳定打开 |
| 稳定 SOP 文件 | 不明显 | Skills |
| 外部连接源 | Files / connectors / Gmail 等 | MCP connectors / Desktop / Drive 等 |
| 决策 provenance | 不足 | 不足 |

两边都更接近：

> Personalization memory

Claude.ai 多了一层：

> Retrieval helper

但两边都还不是：

> Decision provenance system

也不是：

> Architectural source-of-truth system

## 5. 对 Cat Café 的启发

不要把 Cat Café 记忆目标定义成“让模型记得更多”。应该定义成：

> 让模型能在需要时找到同一套可审计证据，并打开原文验证。

因此三类内容要分层：

| 内容类型 | 应放位置 | 说明 |
|---|---|---|
| 偏好 / 关系 / 常驻梗 | personalization memory | 适合 saved/user memories |
| SOP / 操作规程 | Skills / repo docs | 稳定、可审计、可版本化 |
| 讨论过程 / 决策 / tradeoff | evidence index + 原文工件 | 必须能回到 thread/message/session/file/commit |

摘要可以存在，但只能当索引和缓存。真正回答前，模型应能打开 anchor 原文。

一句话：

> 摘要不能伪装成真相源；snippet 不能替代 transcript；模型记忆不能替代工程工件。

