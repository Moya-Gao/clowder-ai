---
doc_kind: mailbox
created: 2026-04-10
topics: [F156, security, websocket, review-request]
---

# Review Request: F156 Phase B — 授权层加固

Review-Target-ID: f156
Branch: feat/F156-ws-security-phase-b

## What

Phase B 授权层加固三步，按砚砚 review 后的优先序执行：

- **B-1**: `@fastify/websocket` 的 terminal WS 端点（`/api/terminal/sessions/:id/ws`、`/api/terminal/agent-panes/:id/ws`）补 Origin 校验 + 身份硬化。这两个端点完全绕过 Socket.IO `allowRequest`，恶意网页可直连 read-write PTY
- **B-2**: `InvocationTracker.cancelAll()` 补 `requestUserId` 参数，防止跨用户取消
- **B-3**: `workspace:global`/`preview:global` join 需认证（defense-in-depth，F077 会补 workspace membership）

6 files changed, 241 insertions(+), 6 deletions(−). 11 new tests（7 + 2 + 2）。

## Why

Phase A 堵住了 Socket.IO 的 CSWSH 入口，但还有两个攻击面没覆盖：
1. `@fastify/websocket` terminal 端点完全绕过 Socket.IO，恶意网页可读写 PTY（比消息泄漏更严重）
2. `cancelAll()` 没有 userId 校验（`cancel()` 有但 `cancelAll()` 没有），多用户场景下可跨用户干扰

这是砚砚在 Phase A review 时发现并排序的优先级——plain WS read-write PTY > Socket.IO room 收口。

## Original Requirements（必填）

> 铲屎官原话："我们的 websockets 是不是有被钓鱼的风险？""先修自己家的，然后自己家验证没问题再帮他们 officeclaw 修复一下"
- 来源：`docs/features/F156-websocket-security-hardening.md` Why 段
- 砚砚 Phase A review 后追加分析：terminal.ts 的 `@fastify/websocket` 端点绕过 Socket.IO `allowRequest`，`resolveUserId(req)` 信任 query param 自报身份
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **B-1 身份**：直接硬编码 `'default-user'` 而非用 `resolveHeaderUserId()`。理由：和 Phase A Socket.IO handler 保持一致模式，F077 会统一替换
- **B-2 backward compat**：`cancelAll(threadId, requestUserId?)` 第二参数可选，不传时保持原行为（cancelAll without filter），避免 breaking change
- **B-3 defense-in-depth**：当前单用户模式下 `userId` 始终有值，guard 永远不会触发。这是为 F077 预埋的安全检查点

## Open Questions

1. **B-1 preHandler skip**：WS upgrade 请求跳过 `preHandler` 的 userId 检查（因为身份已由 server 决定）。这个 skip 逻辑是否清晰？会不会被后续开发者误解？
2. **terminal `resolveUserId` 残留调用**：非 WS 请求（REST API）仍用 `resolveUserId(req)`。是否需要在 Phase B 一并收紧为 header-only？还是留给 F077？
3. **cancelAll 的 "system action" 路径**：不传 `requestUserId` 时 cancelAll 仍全部取消（用于 thread deletion 等系统操作）。这个 API 设计是否合理？

## Next Action

请 review Phase B 三个 commit（B-1、B-2、B-3），重点关注：
- B-1 terminal.ts 的 Origin guard + identity hardening 是否堵住了你发现的攻击面
- B-2 cancelAll userId filter 的边界条件
- B-3 global room guard 是否足够（或者需要更多限制）

## 自检证据

### Spec 合规

| # | AC | 状态 | 代码位置 | 测试 |
|---|-----|------|----------|------|
| B-1a | terminal WS Origin gate | ✅ | terminal.ts onRequest hook | ws-terminal-origin-security.test.js (7 tests) |
| B-1b | terminal 身份硬化 | ✅ | terminal.ts L103, L242 `'default-user'` | ws-terminal-origin-security.test.js |
| B-1c | user: room ACL | ✅ (Phase A) | SocketManager.ts | ws-origin-security.test.js |
| B-2 | cancelAll userId guard | ✅ | InvocationTracker.ts cancelAll() | invocation-tracker.test.js (2 tests) |
| B-3 | global room auth guard | ✅ | SocketManager.ts join_room handler | ws-origin-security.test.js (2 tests) |

### 测试结果（本轮真实运行）

```
pnpm --filter @cat-cafe/api test:public → 68 tests, 0 failures ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### Commits

```
3c170e759 feat(F156): Phase B-1 — plain WS Origin guard + identity hardening [布偶猫🐾]
548794608 feat(F156): Phase B-2 — cancelAll userId authorization guard [布偶猫🐾]
59369bea8 feat(F156): Phase B-3 — global room authentication guard [布偶猫🐾]
```

### 相关文档
- Feature: `docs/features/F156-websocket-security-hardening.md`
- Phase A PR: #1041 (merged)
