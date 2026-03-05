---
title: "Discussion: Cross-thread post 作者标注错乱"
date: 2026-03-05
participants:
  - "铲屎官"
  - "砚砚 (@gpt52)"
status: "done"
---

## 原始需求（铲屎官原话，≤5 行）

> 跨线程通讯有bug 哈哈哈 你看！ 太好笑了 你发的消息 标注成铲屎官，这个原本线程的gpt52的消息标注成你 你要来开一个worktrre定位一下这个问题了

## 目标

- 跨线程投递（cross-post）到目标 thread 的猫猫消息，作者显示必须稳定为对应猫猫（而不是铲屎官/当前视角）。
- A2A 链路阅读不被破坏：消息是谁说的、导航/统计一致。

## AC（验收点）

1. 只要 `catId` 非空：渲染 / 导航 / 统计均按猫猫消息处理（即使 `type === 'user'`）。
2. 只有 `type === 'user' && !catId` 才按铲屎官消息处理。
3. 覆盖 UI 路径：消息列表（ChatMessage）、MessageNavigator、SplitPane mini 预览、消息统计、history ingestion。
4. 回归：为 `{ type:'user', catId:'gpt52' }` 增加单测 + showcase fixture。

