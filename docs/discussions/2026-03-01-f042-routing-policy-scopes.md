---
title: "F042: routing policy (review vs architecture) - requirements excerpt"
date: "2026-03-01"
---

# F042: Routing Policy (Intent/Scope) Requirements

## Context

We need routing to be contextual, not global:

- For code review, avoid spending Opus budget.
- For architecture/design, still prefer discussing with Opus.

## Original Requirements (source excerpt)

> "你这样加...把 opus 标记 available:false...有点死板 等于全局都用不了，我只是不想他这次找布偶猫"
>
> "我希望的是...你这次代码 review别找布偶猫了，但是如果你待会搞到涉及架构的时候我会说 你架构设计还是和布偶猫讨论一下...有的时候路由不是死的，这种如何搞？前端给我一个开关？我手动点点？还是怎么更智能？"
>
> "不过你这次 review继续找gpt52，让我们验证看看你刚刚的修复，他还会不会认为 gpt52 = 你 codex"

## Notes / Constraints

- Do not use a global `available:false` switch for Opus (too rigid).
- Prefer a thread-scoped routing policy (toggle-able) that can vary by scope.
- Routing must not override explicit @mention.
