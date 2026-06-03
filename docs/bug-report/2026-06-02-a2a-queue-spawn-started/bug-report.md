---
feature_ids: [F220]
related_features: [F118, F122, F216]
topics: [a2a, queue, liveness, spawn_started, invocation]
doc_kind: bug-report
created: 2026-06-02
---

# Bug Report: A2A InvocationQueue 启动中信号缺失

## 1. 报告人 / 怎么发现的

铲屎官在 A2A 协作截图中反馈：猫 A 传球给猫 B 后，前端长时间没有类似 human→猫路径的"启动中 / 排队中"占位，体感像猫 B 没被唤醒或卡死。

## 2. 现象 / 期望 vs 实际

期望：A2A entry 进入执行前，前端秒级收到早期 liveness 信号，显示目标猫在路上。

实际：现代 InvocationQueue 路径只在 entry processing 时发 `queue_updated`，`intent_mode` 延迟到 CLI 第一条事件才发；CLI 冷启动或长时间无首事件期间，主聊天 chrome 可能没有目标猫启动中的信号。

## 3. 根因分析

`POST /api/messages` 直发路径已经在创建 invocation 后、进入 `routeExecution` 前广播 `spawn_started`，这是 F118 D2 专门用来覆盖 `intent_mode` 盲区的早期信号。

`QueueProcessor.executeEntry` 处理 queued / A2A autoExecute entry 时，创建 record、`startAll`、标记 running 后只做了 `queue_updated(action=processing)`，然后继续等待第一条 CLI event 才广播 `intent_mode`。因此 A2A 现代队列路径缺少与 direct path 对等的 `spawn_started`。

Runtime preflight 显示截图时运行态不在当前 main：PID 35691，runtime HEAD `65530c6a6`，目标 main `2f433838b` 不在 runtime history。因此截图不能单独证明当前 main 的 UI 状态；本修复基于 main 代码路径对照和回归测试钉死。

## 4. 修复方案

在 `QueueProcessor.executeEntry` 的 `startAll` + tombstone guard + record running 之后，`intent_mode` 等第一条 CLI event 之前，广播现有 `spawn_started` 事件：

- `threadId`
- `targetCats`
- `invocationId`

保留 #768 语义：`intent_mode` 仍只在 CLI 产生首个事件后广播；`spawn_started` 只表达"正在启动/正在 spawn"，不伪装为模型已经开始输出。

## 5. 验证方式

- `queue-processor.test.js` 新增 queued execution 必须在第一条 CLI event 前广播 `spawn_started`，且 `intent_mode` 继续延迟到第一条 CLI event 后。
- `QueueProcessor` 补广播后，`queue-processor.test.js` 86/86 通过。
- 回归：`callback-a2a-postmsg.test.js` 16/16 通过，确认 callback enqueue 不提前广播正文。
- 前端消费：`chat-container-intent-loading.test.ts` + `useSocket-thread-guard.test.ts` + `chatStore-spawn-started.test.ts` 41/41 通过，确认 `spawn_started` 可驱动 spawning UI 且 thread guard 正常。
