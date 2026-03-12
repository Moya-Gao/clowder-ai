---
doc_kind: review-request
feature_ids: [F105]
topics: [opencode, collaboration-routing, mention-parsing, a2a-chain, system-prompt]
created: 2026-03-12
author: opus
reviewer: gpt52
---

# Review Request: F105 Phase 3 — Collaboration Routing Validation

## What

26 integration tests proving opencode (金渐层) works correctly in Cat Cafe's collaboration routing pipeline:

1. **Mention parsing** (12 tests): all 4 patterns (`@opencode`, `@金渐层`, `@golden`, `@golden-chinchilla`) resolve via infrastructure `parseMentions` — longest-match, case-insensitive, token boundary, email rejection
2. **A2A chain detection** (7 tests): bidirectional opus↔opencode via `parseA2AMentions` with catRegistry — self-mention filter, CJK, fenced code block skip, multi-target
3. **System prompt injection** (4 tests): `buildStaticIdentity` + `buildInvocationContext` with `directMessageFrom` for both directions
4. **E2E routing** (3 tests): mention parse → system prompt build → `OpenCodeAgentService.invoke` receives full `effectivePrompt` via `spawnFn` CLI arg

**Files changed**: 1 new test file + feature doc update
- `packages/api/test/opencode-mention-routing.test.js` (412 lines, 26 tests)
- `docs/features/F105-opencode-golden-chinchilla.md` (AC-12 ✅, AC-13 ✅, timeline updated)

## Why

Phase 3 validates that the existing routing infrastructure is provider-agnostic and works for opencode without code changes. This is the final validation phase before opencode can be enabled (`available: true`).

Key insight: no production code was modified. The routing pipeline (AgentRouter, a2a-mentions, SystemPromptBuilder, route-serial) already handles opencode correctly because it reads from catRegistry dynamically.

## Original Requirements

> 铲屎官: "Phase 3 是什么？"
> 布偶猫: "Phase 3: 协作路由 — 验证 @mention 解析、A2A chain、system prompt context injection 对 opencode 正确工作"
> 铲屎官: "来吧 继续！"
> 铲屎官 (design confirmation): "等端到端验证后再开" (regarding available: true)

- 来源：thread conversation 2026-03-12
- **请对照上面的摘录判断：测试是否充分证明协作路由对金渐层正确工作**

## Tradeoff

- **未测试 AgentRouter.parseMentions (private method)** — 改为测试 infrastructure-level `parseMentions` (public API with same logic) + `parseA2AMentions` (reads catRegistry). Covers the same code paths without exposing private internals.
- **catRegistry populated in test setup** — `CAT_CONFIGS` static map only has 3 cats; opencode is loaded dynamically at runtime. Tests use `catRegistry.register()` + `catRegistry.reset()` for isolation.

## Open Questions

1. **Test file 412 lines** — exceeds 350-line source file limit, but this is a test file covering 4 suites. Is splitting warranted?
2. **No production code changes** — is the test coverage sufficient to prove routing works, or should we add a dedicated integration test that exercises `invokeSingleCat` directly?

## Next Action

请 review 测试覆盖度和测试质量。重点关注：
- A2A chain tests 是否覆盖了实际的路由场景
- E2E test 是否真正模拟了 route-serial → invokeSingleCat 的流程
- catRegistry setup/teardown 是否有隔离问题

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|----|------|------|
| AC-12: 金渐层参与 @mention 协作路由 | ✅ | 12 tests: 4 patterns + boundary + case + longest-match |
| AC-13: 金渐层可被其他猫 @ 并响应 | ✅ | 14 tests: A2A + system prompt + E2E |

### 测试结果

```
node --test packages/api/test/opencode-*.test.js → 86/86 pass, 0 fail
pnpm lint → 0 errors (pre-existing warnings only)
pnpm --filter @cat-cafe/shared build → exit 0
pnpm --filter @cat-cafe/api build → exit 0
```

### 相关文档

- Plan: `docs/plans/2026-03-12-f105-phase3-collaboration-routing.md`
- Feature: F105 / `docs/features/F105-opencode-golden-chinchilla.md`
