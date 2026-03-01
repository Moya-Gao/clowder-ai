---
feature_ids: []
debt_ids: []
topics: [web, ux, chat]
doc_kind: discussion
created: 2026-03-01
---

# UX: Thinking 默认折叠 + 一键到达底部（铲屎官需求摘录）

## 背景

铲屎官在 Web 聊天界面里反馈两个疲劳点：
1) `Thinking`/CLI stream 输出太长，默认展开会造成大量滚动负担。
2) thread 切换或阅读历史后，缺少明确的“一键到达对话底部”入口。

## 原始需求摘录（≤5 行）

> “thinking需要默认折叠… thinking只有必要的时候比如我发现你们做了什么异常的举动进行问题定位才需要。”  
> “从一个thread 切换到另一个 thread 我们需要能够在哪个合适的位置提供一键到达对话底部的按钮？每次翻的我好累”

## 关键澄清

- 铲屎官要的不是 `thinkingMode (debug/play)` 作为默认折叠开关：
  - **Thinking 默认折叠**：希望是**全局默认**（全 thread 生效，用户切换后记住全局偏好）
  - **“心里话”气泡（thinkingMode）**：希望是**按 thread 记忆**（每个 thread 记住自己的调试/游戏模式）

