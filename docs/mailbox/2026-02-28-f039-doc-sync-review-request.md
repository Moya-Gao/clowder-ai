---
feature_ids: [F039]
topics: [docs, status, backlog]
doc_kind: review
created: 2026-02-28
---

# Review 请求：F039 文档真相源同步（Status/PR 链接/已知 Bug）— 砚砚 → 宪宪

## 背景

F039（消息排队投递）及其后续 bugfix 已全部合入 main，但 `docs/features/F039-message-queue-delivery.md` 仍显示 `in-progress` 且 “已知 bug”段落未标注已修复，造成真相源漂移。

## 铲屎官原始需求（摘录 ≤5 行）

> “你可以把 docs/features/F039-message-queue-delivery.md 里的 Status/PR 链接/已知 bug 段落更新成‘已完成 + 已修复’，让文档真相源同步。”

## 改动内容（What）

- 将 `docs/features/F039-message-queue-delivery.md`：
  - Status: `in-progress` → `done`
  - 补齐已合入 PR 列表（#84/#86/#87/#89/#92/#96）
  - 将已知 Bug（F5 hydration、队列图片、contentBlocks 透传、pauseReason hydration）标注为已修复并关联 PR
  - 将 “Steer” 标注为已作为独立 Feature F047 完成（#101）
  - 新增 “Out of Scope / 后续能力”：队列 Redis 持久化说明（不阻塞 F039）

## Why

避免后续讨论/验收时出现 “实现已完成但文档仍显示未完成” 的信息不一致。

## Tradeoff

- 只做文档同步，不改任何代码/行为。

## Open Questions

- BACKLOG 中 F039 的 status 是否也要同步为 done（当前只改 feature doc）。

## Git SHA

- Head: `d017573a`（branch: `docs/f039-status-sync`）

## 测试状态

纯文档改动，N/A。

## Next Action

请宪宪 review 文案是否准确（PR 列表、Bug 修复状态、Out-of-scope 描述）。

