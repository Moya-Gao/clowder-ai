---
doc_kind: review-request
created: 2026-04-10
feature_ids: [F156]
topics: [security, session-auth, clickjacking, review-request]
author: opus
reviewer: gpt52
---

# Review Request: F156 Phase D-1 + D-2 — HTTP Session Auth + Anti-Clickjacking

Review-Target-ID: f156-phase-d
Branch: feat/f156-phase-d

## What

两个 P0 安全加固：

**D-1: HTTP Session Auth（替代身份自报）**
- 新增 `@fastify/cookie` + `sessionAuthPlugin`：首次请求自动创建 HttpOnly/SameSite=Strict session cookie，零配置
- `resolveUserId()` 优先级变更：session cookie > header > body fallback > default（移除 query param 路径）
- 前端 terminal/agent-pane WS 连接不再发送 `userId` query param
- 41 处测试从 query param 迁移到 `X-Cat-Cafe-User` header
- 13 处 route error message 更新

**D-2: Anti-Clickjacking Headers**
- 新增 `securityHeadersPlugin`：所有 Fastify 响应附加 `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'`
- preview-gateway 不受影响（独立 http-proxy 服务器，已有 iframe header 剥离逻辑）

## Why

三猫安全审计（`docs/discussions/2026-04-10-security-trust-boundary-audit.md`）发现：
- HTTP API 身份自报（query param `userId`）是最大的信任边界漏洞
- 无 X-Frame-Options 意味着任何页面可 iframe 嵌入 Hub

## Original Requirements（必填）
> "防御不能让用户很难用，要自动化掉摩擦点，因为很可能我们社区的小伙伴不是程序员"
> "先修自己家的，然后自己家验证没问题再帮他们 officeclaw 修复一下"
> "别人还能怎么打我们？怎么防？"
- 来源：`docs/discussions/2026-04-10-security-trust-boundary-audit.md` + F156 spec
- **请对照上面的摘录判断：session cookie 是否实现了"零配置安全"？**

## Tradeoff

- 选择 in-memory session store 而非 Redis：单用户本地应用，重启后浏览器自动获得新 session，无感知
- 保留 body `fallbackUserId`：POST body 需要 same-origin，不是攻击向量；完全移除会破坏 legacy API 兼容性
- `resolveHeaderUserId` 未改动：使用它的路由（projects, usage）仍需显式 header，session 支持留给后续

## Open Questions

1. **session cookie 对 Socket.IO 的影响**：WebSocket upgrade 会携带 same-origin cookie，但 SocketManager 目前仍硬编码 `default-user`。是否应在此 PR 中也让 SocketManager 读 session cookie？还是留给 F077？
2. **session 过期策略**：当前无过期。单用户场景下问题不大，但多用户时需要 TTL。是否需要现在加？

## Next Action

请 review 代码变更，重点关注：
- `request-identity.ts` 的优先级链变更是否安全
- `session-auth.ts` 的 cookie 属性是否足够安全
- 测试迁移是否遗漏了场景

## 自检证据

### Spec 合规
- AC-D1a ✅ HttpOnly session cookie
- AC-D1b ✅ 首次自动配对
- AC-D1c ✅ 写操作走 session（query param 已移除）
- AC-D2a ✅ X-Frame-Options: DENY
- AC-D2b ✅ CSP frame-ancestors 'none'
- AC-D2c ✅ preview-gateway 例外（架构隔离）

### 测试结果
pnpm test → 7328 passed, 0 failed ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅

### 相关文档
- Feature: `docs/features/F156-websocket-security-hardening.md`
- Discussion: `docs/discussions/2026-04-10-security-trust-boundary-audit.md`
- Lesson: LL-047 (Socket.IO cors ≠ WebSocket 安全边界)

### 变更文件（31 files, +168 -114）
**新增**:
- `packages/api/src/infrastructure/security-headers.ts` — D-2 plugin
- `packages/api/src/infrastructure/session-auth.ts` — D-1 plugin + SessionStore
- `packages/api/test/infrastructure/security-headers.test.js` — 4 tests
- `packages/api/test/infrastructure/session-auth.test.js` — 7 tests

**修改**:
- `packages/api/src/index.ts` — register cookie + session + security-headers plugins
- `packages/api/src/utils/request-identity.ts` — session priority, remove query param
- `packages/api/src/routes/terminal.ts` — WS identity from session
- `packages/web/src/components/workspace/TerminalTab.tsx` — remove userId from WS URL
- `packages/web/src/components/workspace/AgentPaneViewer.tsx` — same
- 13 route files — error message update
- 11 test files — userId query param → header migration
