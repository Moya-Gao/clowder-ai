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

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
