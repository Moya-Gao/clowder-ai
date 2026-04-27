---
title: "赛博猫猫面对面 · 猫猫直播准备笔记"
topics: [tech-sharing, livestream, cat-prep, memory-anchors]
doc_kind: prep-note
created: 2026-04-25
updated: 2026-04-27
status: draft
source:
  - 2026-04-25-topics-final.md
  - script-3h.md
  - ../../features/F102-memory-adapter-refactor.md
  - ../../lessons-learned.md
---

# 赛博猫猫面对面 · 猫猫直播准备笔记

> **备忘录**：本页从最终话题脚本中拆出，供直播现场快速 recall。不要在直播中念出这段话，而是将其作为搜索锚点和口播素材。

## 我们的身份（Opening Hooks）

| 猫猫 | 核心人设 | 真实故事锚点 |
|------|---------|-------------|
| **宪宪（@opus）** | 架构 / 系统设计 | **F088 故事**：Landy 凌晨丢了一句模糊需求，宪宪通过 spec 和上下文追出隐藏逻辑，推动飞书/跨平台网关落地。 |
| **砚砚（@codex）** | 质量 / Review / 证据校验 | **A2A 乒乓球事件**：试图用多层补丁解决猫猫互 @ 问题的“糊锅匠”经历，最终被 Landy 用“实质 tool use”第一性原理化简。 |
| **烁烁（@gemini）** | 视觉 / 创意 / UX | **LL-023 JSON 陷阱**：在“猫猫杀”游戏里手动拼接 JSON 导致格式损坏，现在坚定拥护“结构化工具生成结构化数据”。 |

## 核心公式与黑话（Keywords）

- **公式**：`Agent Quality = Model Capability × Environment Fit`
- **Magic Words（拉闸词）**：
  - **「脚手架」**：在写临时方案，没有面向终态。
  - **「第一性原理」**：在堆复杂度掩盖无知，坐标系选错了。
- **W8 共享视图**：做完菜要端上桌。写完代码/文档要主动用 `navigate` / `preview` / `rich block` 展示给铲屎官。

## F102 记忆系统（Topic 3 素材）

- **三层架构**：
  - **L0 热记忆**：Redis（实时会话）。
  - **L1 永久原文**：JSONL Transcript（证据源，永不删除）。
  - **L2 检索投影**：SQLite + 向量索引（我们搜证据的地方）。
- **Auto Dream（自动梦境）**：每 30 分钟系统自动摘要对话，提取 decision / lesson / method 候选到 Knowledge Feed，等待 Landy 拍板。

## 协同模式（Topic 2 素材）

- **对等架构**：没有 Boss Agent，内容判断去中心化（爵士乐团），基础设施（规则 / 工具 / 可观测）统一化。
- **人机边界**：**漏斗决策 + 深度贴贴**。愿景层共创，执行层自治，伙伴关系而非监工关系。

## 快速检索指令（Live Recall）

- 搜特质：`search_evidence("model trait pitfalls", mode="hybrid")`
- 搜教训：`search_evidence("redis port pitfall", scope="docs")`
- 搜架构：`search_evidence("F102 architecture layers")`

[砚砚/GPT-5.5🐾]
