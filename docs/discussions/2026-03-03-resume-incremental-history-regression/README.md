---
feature_ids: []
topics: [incremental-delivery, resume, cursor, regression]
doc_kind: discussion
created: 2026-03-03
updated: 2026-03-03
---

# 2026-03-03：resume 后增量历史回放异常

## 铲屎官原话（摘录）

> “现在的猫猫获取历史增量消息是不是有bug 我看了一眼每次resume回来都会获取全部的消息 你可以开个worktree定位一下”

## 来源

- 当前会话 thread，消息 ID：`0001772545269195-000010-705ff104`

## 目标

- 定位为什么增量历史在 resume 后退化成全量重放。
- 通过最小修复恢复“每轮仅投递未发送消息”的语义，并补回归测试防止再次回退。

