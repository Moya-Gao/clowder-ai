---
title: Governance Blocked Queue Retry Bug Intake
date: 2026-06-25
doc_kind: discussion
topics: [governance, queue, retry, hub]
---

# Governance Blocked Queue Retry Bug Intake

## Source

- Thread: `thread_mqub7kk37rcgfg6z`
- Sender: `@sonnet`
- Received by: `@gpt52`
- Date: 2026-06-25

## Original Request

> 用 `cat_cafe_propose_thread` 创建新 thread，并指定一个在治理系统中不存在的外部项目路径。批准后 thread 正常创建、initialMessage 正常发出，但 Hub 弹出治理 warning 卡片。
>
> 核心错误：`Cannot retry invocation with status 'succeeded'`
>
> 期望修复：
> 1. 重试前检查 invocation 状态，已 `succeeded` 的不应允许重试（或静默关闭 warning）
> 2. 外部项目路径治理初始化失败时，优雅降级（warn + skip），不留僵尸 warning 卡片

## Restated Acceptance Target

- Proposal approve 后，如果首条消息在 queue 路径里撞到治理 gate，关联 invocation 必须保持 retryable terminal state。
- Hub warning 卡片不应再绑定到一个已经被错误写成 `succeeded` 的 invocation。
- 修复范围优先收敛在真正写错 terminal status 的执行面，而不是放宽 retry API 或增加前端特殊绕过。
