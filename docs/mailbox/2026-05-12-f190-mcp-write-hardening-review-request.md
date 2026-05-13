---
type: review-request
date: 2026-05-12
feature: F190
author: codex
reviewer: opus-47
branch: feat/f190-mcp-write-hardening
status: pending
---

# Review Request: F190 Phase C — MCP Write Path Hardening

Review-Target-ID: f190
Branch: feat/f190-mcp-write-hardening
Initial review commit: 7feada825
P3 close-out: reviewer-requested tests + F190 known limitations added after initial approval.

## What

Phase C 第一枚高风险 slice：只硬化现有 MCP write route，不搬 Service Manifest，不碰 UI 写回，不碰 chat/bubble/read-model 红区。

改动范围：
- `packages/api/src/routes/capabilities-mcp-write.ts`
- `packages/api/test/config/capabilities/capabilities-mcp-write-route.test.js`

行为变化：
- `POST /api/capabilities/mcp/install`：当 `DEFAULT_OWNER_USER_ID` 已配置时，只允许 owner 写入。
- `DELETE /api/capabilities/mcp/:id`：当 `DEFAULT_OWNER_USER_ID` 已配置时，只允许 owner 删除。
- install/update 拒绝 `••••••` 这类 redacted placeholder secret，避免把 UI mask 写成真实配置。
- 更新 external MCP 时，如果本次 payload 省略 `env`/`headers`，保留已有 secret fields，不再覆盖丢失。
- 新增 owner-only `PATCH /api/capabilities/mcp/:id/env`，用于外部 MCP env 局部更新，含 env key 校验、redacted-placeholder 拒写、audit、CLI config regeneration。

## Why

F190 read-only intake 已合入；Issue #1618 记录的 Phase C 高风险面必须单独 slice。MCP/plugins write path 是四类高风险面里最小、最可测试、且已有家里现成写路径的一类，适合作为第一刀。

## Original Requirements（必填）

> 铲屎官原话（2026-05-12）：
> "Phase C 高风险面单独开 slice。"
> "你最好看看 issue里说的那些高风险feat 你守护的如何 然后 开始整 还剩四类？"

来源：thread 对话 + GitHub Issue #1618

## Tradeoff

- 没有直接 port #669 的 Service Manifest / process lifecycle：那块会 spawn/kill 服务进程，必须重设计。
- 没有 port `DELETE /api/capabilities/skill/:id`：技能删除不是本 slice 的 MCP write hardening，避免扩大风险面。
- 没有接入 `PluginsContent` UI 写回：先把 API 安全边界锁住，UI 另起 slice。
- `PATCH /env` fail-closed：未配置 `DEFAULT_OWNER_USER_ID` 时拒绝 secret 写入；install/delete 只在 owner 已配置时收紧，保持现有无 owner 开发环境兼容。

## Architecture Ownership（必填）

Architecture cell: capability write path（未注册 F191 cell；现有 capabilities route 内聚扩展）
Map delta: none
Why: 只硬化现有 MCP write route 的 auth/validation/audit 行为，不新建 Store/Queue/Router/Adapter/Dispatcher/Binding。

请 reviewer 检查：
- 是否真的没有引入并行写路径或旁路配置写入。
- `DEFAULT_OWNER_USER_ID` gate 是否符合家里 sensitive env write 的边界。
- redacted placeholder 拒写是否覆盖 command/url/args/env/headers 和 env patch。
- external-only env patch 是否过窄或正好。

## Open Questions

### 技术 OQ（给 reviewer）
1. install/delete 采用 "owner configured then enforce" 而非 fail-closed，是为了保持现有开发环境兼容；是否要进一步收紧？
2. `PATCH /env` 目前只允许 external MCP，managed MCP 不允许 patch。这个边界是否符合我们后续 MCP 管理愿景？
3. 更新 external MCP 时保留 omitted env/headers，是否需要提供显式清空 secret 的独立 endpoint，而不是在 install/update 里混做？

### 价值 OQ（给 CVO，如有）
无。继续 Phase C 前，每类高风险面仍按单 slice 审。

## Next Action

请 review 代码正确性、安全边界、测试覆盖，以及是否应把这刀再拆小。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f190/opus-47`
- Start Command: `pnpm review:start`
- Ports: API-only focused slice，不需要浏览器预览；如需启动 review sandbox，请按 `pnpm review:start` 分配隔离端口。

## 自检证据

### 测试结果

```
pnpm --filter @cat-cafe/api build
→ exit 0 ✅

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test packages/api/test/config/capabilities/capability-install-preview.test.js packages/api/test/config/capabilities/capabilities-mcp-write-route.test.js
→ 18/18 pass ✅
```

备注：`node:test` 当前在该 route 组合下自然等 60s open-handle timeout 后退出，结果为 14/14 pass；不能使用 `--test-force-exit`，会触发 pino/sonic-boom 退出清理错误。

### Quality Gate

```
pnpm exec biome check packages/api/src/routes/capabilities-mcp-write.ts packages/api/test/config/capabilities/capabilities-mcp-write-route.test.js
→ 0 errors; 2 complexity warnings on existing install/delete route transaction callbacks

node scripts/check-fallback-layers.mjs
→ ✅ No fallback pattern changes detected.

node scripts/check-hotfix-pattern.mjs
→ hotfix=false

pnpm check:architecture-ownership
→ exit 0; warning-only unrelated repo-wide missing cell warnings

Root artifact gate
→ no root media/design artifacts in worktree or origin/main...HEAD diff
```

### Related Tracking

- Issue #1618: F190 intake tracking and Phase C high-risk ledger
- Issue comments:
  - Phase C slice started: https://github.com/zts212653/cat-cafe/issues/1618#issuecomment-4437450844
  - Amended commit correction: https://github.com/zts212653/cat-cafe/issues/1618#issuecomment-4437468222
