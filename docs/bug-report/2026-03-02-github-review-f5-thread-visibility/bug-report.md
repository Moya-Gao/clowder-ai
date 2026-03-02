---
feature_ids: [F039, F050]
debt_ids: [TD091]
topics: [github-review, notification, thread, f5, identity]
doc_kind: bug-report
created: 2026-03-02
---

# Bug Report: GitHub Review 通知在部分 thread 中 F5 后消失

## 1. 报告人
- 报告人：铲屎官（2026-03-02）
- 触发上下文：#39 消息管道 + GitHub review 对接通知场景
- 现象：同样是 GitHub review connector 通知，部分 thread 刷新（F5）后仍在，部分 thread 刷新后消失。

## 2. 复现步骤
1. 存在一个已注册 PR tracking 的 thread（或历史 tracking 记录）。
2. GitHub review 邮件到达，ReviewRouter 路由并广播 `connector_message`。
3. 前端在实时流中看到通知气泡。
4. 对该 thread 执行 F5，前端通过 `GET /api/messages?threadId=...` 重拉历史。

期望行为：
- 实时可见的 connector 通知，在 F5 后依然可见（历史一致）。

实际行为：
- 某些 thread 的通知在实时可见，但 F5 后历史不返回，表现为“消息不见了”。

## 3. 根因分析
### 关键链路
- 写入链路：`ReviewRouter`（registry 命中）使用 `tracking.userId` 作为 `messageStore.append` 的 `userId`。
- 读取链路：`GET /api/messages` 按当前请求用户 `userId` 过滤 thread 消息。

### 差异来源
- 当 PR tracking 记录里的 `userId` 与 thread 实际 owner（`thread.createdBy`）不一致（stale/历史残留）时：
  - 通知会被写成 tracking.userId 名下消息；
  - WebSocket `connector_message` 是按 room 广播，不做 userId 过滤，实时阶段仍能看到；
  - F5 后历史读取按当前用户过滤，消息被过滤掉，呈现“消失”。

## 4. 修复方案
- 在 `ReviewRouter` 的 registry 路由中，对目标 thread 做一次 owner 对齐：
  - 优先使用 `threadStore.get(threadId).createdBy`（非 `system`）作为消息 `userId`；
  - 无法解析 owner 时再回落 `tracking.userId/default`；
  - 对 mismatch 打 warning 日志，便于后续清理 stale tracking。
- 保持现有 fallback/triage 流程不变，缩小改动面。

为什么选它：
- 最小改动即可修复“实时与历史不一致”的核心路径；
- 不改消息读取协议，不引入新的鉴权面。

放弃方案：
- 取消 thread 历史的 userId 过滤。风险较高，可能放大跨用户数据暴露面。

## 5. 验证方式
- Red→Green 单测：`review-router.test.js` 新增 stale tracking userId 回归用例。
- 回归测试：`review-router` + `messages-endpoint` + `callback-routes`。
- 验证标准：
  - 路由写入的 message.userId 与 thread owner 一致；
  - `RouteResult.userId` 与写入一致；
  - 不破坏既有 registry/fallback/triage 路由行为。
