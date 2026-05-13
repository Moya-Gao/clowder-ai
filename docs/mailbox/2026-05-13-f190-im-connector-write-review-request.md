---
type: review-request
date: 2026-05-13
feature: F190
author: codex
reviewer: opus-47
branch: feat/f190-im-connector-write
status: pending
---

# Review Request: F190 Phase C — IM Connector Write Hardening

Review-Target-ID: f190-im-connector-write
Branch: feat/f190-im-connector-write
Initial review commit: branch HEAD

## Original Requirements

Source:
- User thread, 2026-05-13: "Phase C 高风险面单独开 slice"
- User thread, 2026-05-13: "继续完成 Service Manifest、refAudio、IM connector write"
- User thread, 2026-05-13: "我就想你们搞完别出太多bug 我们家后续的那些功能别改坏了 包括气泡的那些"
- `docs/discussions/2026-05-13-f190-im-connector-write-design/README.md`

## What

Phase C 第四枚高风险 slice：hardening 现有 IM connector credential write，不新增 IM runtime，不新增 callback URL / endpoint 写入，不碰 chat/bubble/read-model 红区。

改动范围：
- 新增 connector write guard helper：real session identity、explicit owner fail-closed、redacted placeholder reject。
- `/api/config/secrets` 改为真实 session + `DEFAULT_OWNER_USER_ID` owner gate。
- Guided connector write routes 纳入同一 owner gate，并加 redacted placeholder reject + audit entry。
- `GET /api/connector/status` 改为真实 session identity，read response 继续 redacted。
- Hub connector UI 在客户端阻止保存 `••••••` 占位符，保留 untouched secret omission。
- 更新 F190 spec 和 Design Gate memo。

## Why

前 3 刀已经把 read-only surfaces、MCP write hardening、Service Manifest visibility、refAudio upload 分别收口。剩余高风险面不是新增 IM connector，而是家里已有 connector config / guided setup write path 的凭据写入安全边界。

## Source Behavior

clowder-ai#669 提供了 settings connector / IM configuration surface 的方向。家里已有对应读写入口：`HubConnectorConfigTab`、`POST /api/config/secrets`、Feishu/WeChat/WeCom guided setup routes。

## Must Preserve Home Behavior

- 保留 F136 `ConfigChangeEvent` + connector reload subscriber 热生效路径。
- 保留 WeCom guided setup 的 validate → persist → start → rollback 语义。
- 保留 omitted secret = no change，`null` = explicit clear。
- 保留 read response 的 redacted secret display，不向 frontend / audit / thread message 输出 raw secret。
- 不接管 F088/F124 connector runtime、message routing、transport、thread binding。
- 不碰 F183/F184/F194 chat bubble / read-model 红区。

## Decision

按 design memo recommendations 自决：
- OQ-1 No: 不引入 user-editable callback URL / provider endpoint 字段，避免扩 SSRF 面。
- OQ-2 Yes: connector credential writes 在 owner 未配置时 fail-closed。
- OQ-3 Yes: generic secret writes 保留现有 hot reload。
- OQ-4 Yes: guided setup routes 纳入 hardening scope，避免旁路。
- OQ-5 Yes: low-risk read status 同刀改 real session identity。

Rejected / excluded:
- 新 connector adapter
- ConnectorRouter / MessageEnvelope / outbound hook / transport 语义
- service lifecycle controls
- custom callback URL / endpoint writes
- raw secret audit

## Architecture Ownership

Architecture cell: transport
Map delta: none
Why: F190 只 harden Console/Settings 的 connector credential configuration surface；IM connector runtime、message routing、adapter semantics、thread binding、outbound delivery 仍由 F088/F124 ownership 管。

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致。
- 是否没有新建并行 Store / Queue / Router / Adapter / Dispatcher / Binding。
- guided routes 是否全部覆盖 owner gate + redacted placeholder reject。
- audit 是否只记录 operator/key names/redacted metadata，不泄露 raw secret。
- read status 改 real session identity 是否低风险。

## Open Questions

### 技术 OQ（给 reviewer）

1. `applyAuditedConnectorSecretUpdates` 的 audit failure isolation 是否合理：credential write 已完成后，audit append 失败只 log，不回滚主写入。
2. `GET /api/connector/status` 改为 real session identity 是否会影响任何 legitimate read-only status 调用。
3. Weixin QR confirm 中把 `adapter.setBotToken` 移到 persist 成功之后，是否符合现有 guided setup 语义。

### 价值 OQ（给 CVO）

无。OQ-1~OQ-5 已被 47 判定为技术边界，按推荐自决。

## Next Action

请 47 review `feat/f190-im-connector-write` HEAD。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f190-im-connector-write/opus-47`
- Start Command: `pnpm review:start`
- Suggested path: `/` → Cat Cafe Hub → Connectors / Settings connector config

## 自检证据

```
node --test packages/api/test/config-secrets.test.js packages/api/test/connector-hot-reload-integration.test.js packages/api/test/connector-hub-route.test.js
→ 46/46 pass ✅

pnpm --filter @cat-cafe/api build
→ exit 0 ✅

NODE_ENV=test pnpm --dir packages/web exec vitest run src/components/__tests__/hub-connector-config-tab.test.tsx
→ 5/5 pass ✅

pnpm --filter @cat-cafe/web test
→ 403 files / 3037 tests pass ✅

node scripts/check-fallback-layers.mjs
→ net +2; only connector-hub audit isolation try/catch and web test helper. Self-check: audit logging is side-channel after credential persistence; this layer should not be removed.

git diff --check origin/main...HEAD
→ exit 0 ✅

red-zone path grep
→ no useAgentMessages / bubble-* / chatStore / ChatContainer / ChatMessage / thread route / audio-capture / refAudio / service lifecycle paths ✅

root artifact guard
→ no root media/design artifacts ✅

pnpm gate
→ GATE PASSED ✅
```
