---
feature_ids: [F039, F050]
topics: [github-review, notification, f5, identity, review-request]
doc_kind: review-request
created: 2026-03-02
debt_ids: [TD091]
---

# Review 请求：GitHub Review 通知在部分 thread 中 F5 后消失（身份对齐修复）

## 背景
铲屎官反馈：GitHub review 对接通知在部分 thread 中“实时可见但刷新后消失”。
本轮修复聚焦 registry 路由链路中 `tracking.userId` 与 thread owner 不一致导致的历史过滤错配。

## Original Requirements（必填）
> "我发现有的thread 我按f5 通知的消息还在，但是有的thread竟然不见了！"
> "我需要你和gpt52协作完成这次的任务你是coder 他是reviewer"

来源：当前对话（2026-03-02）
请你按上面原话判断：本次修复是否真正解决“实时可见与 F5 重载不一致”的问题。

## What
- `ReviewRouter` registry 路由新增 owner 对齐：
  - 优先 `threadStore.get(threadId).createdBy`（非 `system`）
  - fallback `tracking.userId/default`
  - mismatch 记录 warning
- `RouteResult.userId` 与落库 message `userId` 统一为 resolved userId
- 新增回归测试：`stale tracking userId falls back to thread owner`
- 新增 bug report 五件套文档

## Why
- 写入路径用 tracking.userId，读取路径（`GET /api/messages`）按当前用户过滤。
- 当 tracking.userId stale 时，socket 实时广播可见，但 F5 历史重载被过滤，形成“消息消失”体感。

## Tradeoff
- 选择在写入端做 owner 对齐（最小改动）
- 不改 `/api/messages` 用户过滤策略，避免引入跨用户可见性风险

## Open Questions
1. 现有 PR tracking 里是否已有 stale userId 历史条目，需要补一轮清理/迁移吗？
2. `thread.createdBy === 'system'` 的 registry 路由是否应继续 fallback 到 tracking.userId（当前行为）还是强制阻断？

## Next Action
请重点 review：
- `packages/api/src/infrastructure/email/ReviewRouter.ts`
- `packages/api/test/review-router.test.js`
- `docs/bug-report/2026-03-02-github-review-f5-thread-visibility/bug-report.md`

## Spec Compliance 自检（Quality Gate 摘要）
| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 实时可见消息在 F5 后仍可见 | ✅ | registry 写入 userId 与 thread owner 对齐 |
| 2 | 不破坏现有 fallback/triage 路由 | ✅ | 修复仅作用于 registry 命中路径 |
| 3 | 有 Red→Green 回归测试 | ✅ | 新增 stale tracking 用例，先红后绿 |

## 测试证据（本轮）
- `pnpm --filter @cat-cafe/api run build` ✅
- `node --test packages/api/test/review-router.test.js` → 28 passed, 0 failed ✅
- `node --test packages/api/test/messages-endpoint.test.js packages/api/test/callback-routes.test.js` → 72 passed, 0 failed ✅
- `pnpm --filter @cat-cafe/api run lint` ✅
