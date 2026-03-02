---
title: "Review Request: F042 routing policy (review vs architecture) - thread scoped"
date: "2026-03-01"
topic: "f042-routing-policy-scopes"
reviewer: "gpt52"
---

# Review Request: F042 routing policy (review vs architecture) - thread scoped

## What

- Add `Thread.routingPolicy` (v1) persisted in ThreadStore (in-memory + Redis).
- Add `PATCH /api/threads/:id` support for updating/clearing `routingPolicy`.
- Enforce policy during routing when no explicit @mentions:
  - Scope inference (v1): `review` vs `architecture`.
  - `review`: can avoid specific cats (example: avoid Opus due to budget).
  - `architecture`: can prefer specific cats (example: prefer Opus).
- Prompt pinned injection (per invocation): add a 1-line `Routing: ...` summary so it survives context compression.
- Hub UI: add a `路由策略` tab with two thread-scoped toggles:
  - Review: Avoid `@opus` (budget)
  - Architecture: Prefer `@opus`

## Why

We want routing that is not global and not rigid:

- For review work, avoid spending Opus budget.
- For architecture work, still encourage discussing with Opus.

This should reduce "布偶猫没猫粮但还被频繁拉来 review" while keeping "需要架构讨论时仍能拉 Opus" available.

## Original Requirements（必填）

> "把 opus 标记 available:false（附 reason=budget）...有点死板 等于全局都用不了，我只是不想他这次找布偶猫"
> "你这次代码 review别找布偶猫了...涉及架构的时候...还是和布偶猫讨论一下...前端给我一个开关？我手动点点？"
- 来源：`docs/discussions/2026-03-01-f042-routing-policy-scopes.md`
- 请对照上面的摘录判断交付物是否解决了铲屎官的问题

## Tradeoff

- Scope inference is heuristic (keyword-based) in v1:
  - Pros: minimal UI friction; no new explicit user syntax required.
  - Cons: false positives/negatives; policy only applied when scope is inferred.
- Policy is applied only when there is no explicit @mention:
  - Pros: explicit intent always wins.
  - Cons: requires @mention to override.
- If `avoidCats` filters all candidates, we do a deterministic fallback.

## Open Questions

1. `inferRoutingScope(message)` keywords: too broad / too narrow?
2. `avoidCats` semantics: should it also apply when `preferredCats` is provided?
3. Prompt injection line: format stable and short enough? Any privacy/PII concerns?
4. Frontend UX: are two toggles sufficient, or do we need a general rule editor (future v2)?
5. Data model: should we add `expiresAt` enforcement now or leave as future v2?

## Next Action

Please do a local code review focusing on:

- Backend correctness + safety:
  - ThreadStore persistence (`updateRoutingPolicy` behavior + clearing)
  - Router enforcement priority: `@mention` > policy > preferredCats > participants > default
  - Deterministic fallback when avoid filters all
- Prompt injection:
  - `SystemPromptBuilder` 1-line `Routing:` summary
  - Ensure we do not bloat prompt or conflict with existing pinned injection
- Hub UI:
  - PATCH payload shape, thread refresh, and state consistency

## 自检证据

### Spec 合规

- Plan: `docs/plans/2026-03-01-f042-routing-policy-scopes.md`
- Implemented all tasks (persist + route enforcement + prompt injection + Hub toggle + tests).

### 测试结果（本轮真实运行）

- `pnpm -r --if-present run build` -> success
- `pnpm lint` -> exit 0
- `env -u REDIS_URL pnpm test` -> exit 0
  - api: 2256 pass, 0 fail (1 skipped)
  - web: 578 pass, 0 fail
  - mcp-server: 38 pass, 0 fail
- `pnpm --filter @cat-cafe/api test:redis` -> exit 0 (isolated redis)

### 相关文档

- Plan: `docs/plans/2026-03-01-f042-routing-policy-scopes.md`
- Requirements excerpt: `docs/discussions/2026-03-01-f042-routing-policy-scopes.md`
