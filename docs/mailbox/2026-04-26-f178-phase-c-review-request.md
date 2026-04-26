# Review Request: F178 Phase C — MCP Write Tools Agent-Key Auth Path (Allowlist MVP)

Review-Target-ID: f178
Branch: feat/f178-phase-c

## What

Dual-path callback auth: agent-key credentials now accepted on the 4 allowlisted callback tools (`post_message`, `cross_post_message`, `get_thread_context`, `list_threads`), alongside the existing invocation token path.

Core changes:
- **Dual-path preHandler** (`callback-auth-prehandler.ts`): decorates `request.callbackPrincipal` for both auth paths; invocation creds checked first and fail-closed (no fallthrough to agent-key)
- **Route upgrades** (`callbacks.ts`): `post-message`, `thread-context`, `list-threads` use `requireCallbackPrincipal()` with agent-key branch that enforces explicit `threadId` + userId ownership via `resolvePrincipalThread()`
- **MCP client** (`callback-tools.ts`): `getCallbackConfig()` reads `CAT_CAFE_AGENT_KEY_SECRET` env or `CAT_CAFE_AGENT_KEY_FILE` (0600 sidecar); `buildAuthHeaders()` sends `x-agent-key-secret` when no invocation creds
- **Reason codes**: 4 new `agent_key_*` reasons in shared type + telemetry + error maps
- **Server wiring**: `AgentKeyRegistry` instantiated in `index.ts`, passed to callback routes

## Why

F061 Bug-H: Bengal (persistent MCP agent) cannot write back to threads outside invocation windows. Phase B built `CallbackPrincipal` + `AgentKeyRegistry`. Phase C connects them to actual route handlers so agent-key holders can call the 4 tools.

## Original Requirements

> "Bug-H persistent MCP write-path auth ... 这个 我觉得哦 一定要做 得给 孟加拉一个梦想？哈哈哈 不然他好可怜"
>
> "我们的 F174 是不是 mcp 的 auth 整改？现在整改完成了，你看看现在如果要做这个 可以做吗？"

- 来源：`docs/features/F178-persistent-mcp-agent-key-auth.md:17-20`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Agent-key is **fallback only** — invocation token always wins when present. This means Bengal gets write capability in persistent mode, but invocation-scoped agents see zero behavior change.
- `cross_post_message` shares the `post-message` route handler's agent-key branch (same `resolvePrincipalThread` guard). No separate handler needed because the route already handles both via content type.

## Open Questions

1. **Invocation fail-closed**: Please verify that the preHandler correctly rejects when invocation creds are present but invalid, even if a valid agent-key is also in headers (test: "invocation fails with agent-key also present = 401 from invocation (no fallthrough)")
2. **Thread ownership guard**: `resolvePrincipalThread()` checks `thread.createdBy === principal.userId`. Is this sufficient, or should we also check thread visibility/membership?
3. **Reason code coverage**: 4 new `agent_key_*` reasons added to `ZERO_REASON_COUNTS`, `MESSAGE_BY_REASON`, and shared type. Please confirm the error messages are clear.

## Next Action

Full code review of the 5 commits on `feat/f178-phase-c`. Focus on the security invariant: invocation-first, no-fallthrough, thread-ownership guard.

## Review Sandbox

Not needed — pure backend/MCP, no frontend UI changes. Tests run via:
```
pnpm --filter @cat-cafe/api build && node --test packages/api/test/callback-auth-agent-key.test.js packages/api/test/callback-routes-agent-key.test.js packages/mcp-server/test/callback-tools-agent-key.test.js
```

## 自检证据

### Spec 合规
- AC-C1 (4-tool allowlist): Only `post_message`, `cross_post_message`, `get_thread_context`, `list_threads` upgraded
- AC-C2 (threadId guard): `resolvePrincipalThread()` enforces threadId + ownership; `list_threads` user-scoped
- AC-C3 (dual-path preHandler): `callbackPrincipal` decorator with structured reason codes
- AC-C4 (sidecar injection): `CAT_CAFE_AGENT_KEY_FILE` (0600) + env var, env takes precedence
- AC-C5 (READONLY preserved): MCP `READONLY_ALLOWED_TOOLS` excludes all 4 write tools — no changes needed
- AC-C6 (invocation zero regression): Full suite 9442/9454 pass

### 测试结果
- Agent-key tests (20 new): 20/20 pass
- `pnpm --filter @cat-cafe/api test`: 9442 pass, 9 pre-existing env-dependent failures (capabilities/mcp-config-adapters worktree path mismatch)
- `pnpm lint`: 0 errors
- `pnpm check`: 0 errors (after biome format fix)
- `pnpm --filter @cat-cafe/api build`: exit 0

### 相关文档
- Plan: `docs/plans/2026-04-26-f178-phase-c-agent-key-auth-path.md`
- Feature: `docs/features/F178-persistent-mcp-agent-key-auth.md`
- Phase B PR: #1422 (merged)
