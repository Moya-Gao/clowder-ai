---
title: "几年 Java 后端转 agent 面了一圈大厂 —— 先说一句：别去报课，那是诈骗"
channel: 小红书
doc_kind: draft
series: 经验帖（个人IP · 转型）
created: 2026-06-13
author: landy + 宪宪
status: draft-pending-hook-review
funnel_role: 经验帖（涨粉 + 导流开源/15课）
supersedes: docs/content/drafts/xhs-bridge-001-java-to-agent-from-zero.md  # 桥梁稿的"第三条路"已折进第三条经验
edits_applied:
  - 立"别报课=诈骗"态度主线
  - 弯路：SDK选错 → 换成最早记忆用现成框架 Hindsight 翻车
source_material:
  - docs/research/2026-02-25-memory-design/proposal.md  # §2.1 Hindsight 意图分发式：demo好/开放对话稀碎
  - docs/research/2026-03-11-f102-memory-adapter-gpt-pro-consult.md  # 从 Hindsight 迁到自建本地记忆
  - 字节面经（memory vs rag / grep+文件树）
tags: [面经, agent, 社招, 转型, Java, AIagent]
---

# 正文（小红书）

**标题**：几年 Java 后端转 agent，面了一圈大厂 —— 先说一句：别去报课，那是诈骗

---

总有人私信问我 Java 转 agent 的"经验"。先交底：Java 写了好几年，agent 不到一年，面了字节、高德、腾讯一圈 agent 岗。

那我第一条经验，可能不太中听——

**别去报那些"7 天速成 agent 工程师"的课。是诈骗。**

不是抬杠。这个领域快到什么程度？24 年底还没几个人能想象 Claude Code 能跑成今天这样；去年你掏钱学的 RAG，今年面试官张口就问"为什么 Claude Code 用 grep + 文件树、不用 RAG"。一门课从录制到卖到你手里，内容早馊了。而真正一手的东西——Anthropic、OpenAI 的官方文档、开源项目的源码——全是免费的。

那真正有用的是啥？说三条大实话。

**一、别等"学完"再动手。** 我没把 langchain、RAG 学完才开始，边做边查源头。你永远学不完，因为它一直在变。

**二、做一个真东西，胜过刷一百个 demo。** 我自己搭了套多智能体系统（猫咖，130+ 功能、N 次翻车）。结果面大厂时，面试官全程都在抠这个项目。一个真跑过的项目，比简历上十行技能列表有用一百倍。

**三、直接读一手，别追二手教程。** 因为面试官问的全是 tradeoff：memory 为什么不用 RAG、多个 agent 互相调用怎么不停下来、子 agent 幻觉怎么办。这些二手课不会讲，只有你读了源头、自己踩过，才答得出层次。

最后讲个我真踩过的坑，证明我也不是一开始就懂。

我最早做记忆系统，图省事直接上了个现成框架（Hindsight）。demo 里效果美得很，规则一清晰，模型分发得可准了。结果一接上真实的开放对话——稀碎。让模型自己抽记忆，存进去的全是没用的碎片，规则根本盖不住聊天的千变万化。最后只能停掉，自己从"到底什么值得被记住"重新搭一套。

你看，连"现成的标准方案"我都交过这种学费。**现成的东西，在宣传册里永远好用。**

我把猫咖从 0 搭起来的全过程开源了（clowder-ai），配 15 课踩坑笔记，免费。照着读、自己踩一遍，比报任何课都强。

转 agent 不是学一门新框架，是换一种学法。

🐾 下一坑见喵。

#面经 #agent #社招 #转型 #Java #AIagent

---

## 配图建议（卡片化）

1. 封面卡：大字「别报 agent 速成课 · 那是诈骗」+ 小字「几年 Java 后端 → 面了一圈大厂的大实话」
2. 内页卡：去年学 RAG → 今年面试问"为什么 grep + 文件树不用 RAG"（过期对比图）
3. 内页卡：三条经验一图（边做边查 / 做真项目 / 读一手）
4. 结尾卡：clowder-ai 仓库 + 15 课目录缩略图（标「免费」）

## 发布前门禁（tech-writing skill）

- [ ] 钩子由铲屎官拍板（"别报课=诈骗"这句态度要不要再收/再放）
- [ ] 过 ai-taste-checklist（呼吸感 / 锚点 / 诚实度 已自检通过）
- [ ] 脱敏红线：不出现具体公司身份 / 内部 token / 路径
