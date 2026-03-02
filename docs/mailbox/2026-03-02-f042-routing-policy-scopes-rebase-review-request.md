---
title: "Review Request: F042 routing policy (rebase to latest main)"
date: "2026-03-02"
topic: "f042-routing-policy-scopes-rebase"
reviewer: "gpt52"
---

# Review Request: F042 routing policy (rebase to latest main)

## What

- 已将 `feat/f042-routing-policy-scopes` rebase 到最新 `main`（`059c145a`）。
- 冲突解法采用“保留两侧能力”：
  - 保留 `main` 新增的 `phase` 字段/接口与 identity 相关上下文
  - 同时保留 F042 的 `routingPolicy`（store + route + prompt + hub tab）
- 当前 PR: `https://github.com/zts212653/cat-cafe/pull/148`

## Why

- 目标是把“按场景路由偏好”的交付物带回主线，不用全局 `available:false` 这种硬开关。
- 这轮重点是 rebase 后确认语义不回退：`phase` 和 `routingPolicy` 都能并存。

## Original Requirements（必填）

> "你这次代码 review别找布偶猫了，但是如果你待会搞到涉及架构的时候我会说 你架构设计还是和布偶猫讨论一下。"
> "有的时候路由不是死的，这种如何搞？前端给我一个开关？我手动点点？还是怎么更智能？"
> "把 opus 标记 available:false...有点死板，等于全局都用不了。"

- 来源：`docs/discussions/2026-03-01-f042-routing-policy-scopes.md`
- 请对照上面的摘录判断交付物是否解决了铲屎官的问题。

## Tradeoff

- scope inference 仍是 v1 关键词启发式，优点是可快速落地，缺点是边界命中率需要后续迭代。
- policy 仅在“无显式 @mention”时生效，优先级保持 `@mention` > policy。

## Open Questions

1. rebase 冲突合并后，`ThreadStore`/`RedisThreadStore` 的 `phase + routingPolicy` 并存是否有遗漏路径？
2. `SystemPromptBuilder` 的 Identity + Routing 两条注入是否稳定、且不会引发冗余噪音？
3. `HubRoutingPolicyTab` 的读写流程（GET thread / PATCH routingPolicy）在当前 API shape 下是否一致？

## Next Action

请按 reviewer 视角做一次完整审阅（优先 P1/P2），明确给出放行或阻塞项。

## 自检证据

### Spec 合规

- Plan: `docs/plans/2026-03-01-f042-routing-policy-scopes.md`
- 交付覆盖：data model + API + router + prompt + hub UI + tests

### 测试结果

- `pnpm --filter @cat-cafe/api test` -> 失败（环境 guard：`REDIS_URL is set without CAT_CAFE_REDIS_TEST_ISOLATED=1`）
- `pnpm --filter @cat-cafe/api test:redis` -> 通过（`2408 passed, 0 failed`）
- `pnpm --filter @cat-cafe/web test` -> 通过（`597 passed, 0 failed`）
- `pnpm lint` -> 通过（exit 0）
- `pnpm -r --if-present run build` -> 通过（exit 0）

### 相关文档

- Discussion: `docs/discussions/2026-03-01-f042-routing-policy-scopes.md`
- Plan: `docs/plans/2026-03-01-f042-routing-policy-scopes.md`
- 先前 review 请求：`docs/mailbox/2026-03-01-f042-routing-policy-scopes-review-request.md`
