---
feature_ids: [F039]
topics: [message, queue, delivery]
doc_kind: note
created: 2026-02-26
---


# F039: 消息排队投递 — 用户操作三模式

> **Status**: in-progress
> **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- 2026-02-26 铲屎官口述

## What
- **F39**: 猫在跑时支持排队发送/强制发送/取消三模式。InvocationQueue per-thread FIFO + scopeKey 用户隔离 + 同源合并 + 前端 QueuePanel + cancel 后暂停管理。砚砚 R1→R8 放行。优先级在 #97 3c 之前（队列是 3c 的基础设施）。需求 · 技术 plan。

## Links
- [需求](./plans/2026-02-26-message-queue-delivery.md)
- [技术 plan](./plans/2026-02-26-message-queue-delivery-plan.md)

## Key Decisions
- 历史记录未单列关键决策

## Dependencies
- 无显式依赖声明

## 已知 Bug / UX 改进（2026-02-27 铲屎官发现）

### Bug 1: F5 刷新后队列消息状态丢失
- **复现**：消息在队列中（queued/processing） → 按 F5 刷新 → 消息显示为"已发送"
- **根因**：`useChatHistory.ts` 页面加载时获取 `/api/messages` 和 `/api/tasks`，但**不获取 `/api/threads/{id}/queue`**。Zustand store 重置后 `queue: []`，队列面板为空。后端有 `GET /api/threads/:threadId/queue` 端点但前端从未调用。
- **修复方向**：在 `useChatHistory` 里加 queue 状态初始化请求

### Bug 2: 队列 UI 不显示图片附件
- **复现**：发送带图片的消息 → 消息进入队列 → QueuePanel 只显示文字，不显示图片
- **参考**：Codex 原生队列 UI（截图 `1772263352365-9cac5ed8.png`）
- **修复方向**：QueuePanel 通过 `entry.messageId` 查找关联消息的 contentBlocks 显示图片指示器
- **⚠️ 后端遗留**：`QueueEntry` 接口不携带 `contentBlocks`，`QueueProcessor.executeEntry()` 处理排队消息时也不从 messageStore 补取 contentBlocks → 猫猫实际看不到排队消息的图片。需要在 QueueProcessor 中从 messageStore 按 messageId 补取。（前端显示已修复，后端传递待修）

### UX 改进: Steer 功能（学习 Codex 原生）
- **描述**：Codex 原生队列有 "Steer" 按钮——用户可以在消息排队等待时追加引导（"Ask for follow-up changes"），修改猫猫处理方向
- **参考**：截图中 Codex 队列的 Steer 按钮 + 追加输入框
- **设计方向**：在 QueuePanel 的排队消息旁加 Steer 按钮，点击后展开追加输入框，内容合并到排队消息

> Bug 1 + Bug 2 前端修复：PR #TBD（fix/f039-queue-bugs）。Bug 2 后端遗留 + Steer UX 待后续处理。

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
