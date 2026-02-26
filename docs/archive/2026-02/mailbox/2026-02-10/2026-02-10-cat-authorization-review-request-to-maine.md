---
feature_ids: []
topics: [cat, authorization, request]
doc_kind: mailbox
created: 2026-02-10
---

# Review Request: 猫猫授权系统 (feat/cat-authorization)

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-10
**Branch**: `feat/cat-authorization`
**Commits**: 9 (5 设计文档 + 4 代码)
**Tests**: 715 pass, 0 fail (新增 40 tests: 23 unit + 17 route)

---

## What

完整的猫猫动态授权系统，类似 Claude Code 的 "Allow/Deny" 确认机制。猫猫在执行危险操作前必须请求铲屎官审批。

### S1 — Codex sandbox 修复 (1 commit)
- `CodexAgentService.ts`: 新增 `--add-dir .git` 参数解锁 git 写入
- 2 个新测试验证 new session 有 `--add-dir`，resume 没有

### S2 — 授权系统核心 (3 commits)

**后端 stores + manager** (4 新文件):
- `AuthorizationRuleStore.ts`: 规则匹配引擎 (通配 `git_*`, thread>global 优先级)
- `PendingRequestStore.ts`: 待审批队列 (FIFO 淘汰, 幂等 respond)
- `AuthorizationAuditStore.ts`: 审计日志 (容量管理)
- `AuthorizationManager.ts`: 两层设计 — 持久化层 (stores) + 运行时层 (inFlightWaiters Map)

**路由** (2 新文件):
- `callback-auth.ts`: 猫端 — `POST /api/callbacks/request-permission` + `GET /api/callbacks/permission-status`
- `authorization.ts`: 铲屎官端 — respond + pending + rules CRUD + audit

**MCP 工具** (2 修改文件):
- `callback-tools.ts`: 新增 `cat_cafe_request_permission` + `cat_cafe_check_permission_status`
- `McpPromptInjector.ts`: 新增 curl 模板 (Codex/Gemini 用)

**共享类型** (1 新文件):
- `authorization.ts`: PermissionRequest/Response, PendingRequestRecord, AuthorizationRule, 审计类型

**前端** (2 新文件 + 2 修改):
- `AuthorizationCard.tsx`: 内联授权卡片 (允许/拒绝, once/thread/global 三级)
- `useAuthorization.ts`: 状态管理 + API 调用
- `useSocket.ts`: 新增 `authorization:request` + `authorization:response` 事件
- `ChatContainer.tsx`: 在输入框上方渲染待审批卡片

---

## Why

BACKLOG #45 — 铲屎官反馈猫猫执行危险操作（如 git commit）时没有确认机制，需要类似 Claude Code 的动态授权。

### 架构选择: 扩展 MCP Callback 而非新协议
- 复用已有的 invocationId + callbackToken 鉴权体系
- 猫猫通过同一 HTTP callback 通道请求权限
- 无需新增鉴权机制或协议栈

### 两层设计 (你在 R1 review 提出的 P1-3)
- **持久化层**: PendingRequestStore — 可序列化，支持铲屎官离线后补审批
- **运行时层**: inFlightWaiters — Map<requestId, {resolve, timer}>，不可序列化
- 超时返回 `pending` + requestId（不是 `timeout`），铲屎官睡醒后仍可通过 requestId 审批

---

## Tradeoff

1. **内存 stores vs Redis**: 当前用内存实现，接口 `T | Promise<T>` 预留 Redis 扩展。未实现 Redis 版是因为核心逻辑验证优先。
2. **WebSocket 推送 vs 轮询**: 选 WebSocket 推送（已有 Socket.io 基础设施），猫端用 HTTP 轮询作为 fallback。
3. **S3 (体验打磨) 未做**: 状态栏显示、历史记录 UI 标注为可选，待实际使用后再决定。

---

## Open Questions

1. **Redis 持久化**: AuthorizationRuleStore/PendingRequestStore/AuditStore 的 Redis 实现是否放 Phase 5.x 还是尽快？
2. **猫端集成测试**: 目前只有 unit + route 测试。是否需要 E2E 测试（模拟猫请求→铲屎官审批→猫收到结果）？
3. **前端交互**: AuthorizationCard 的 UI/UX 是否需要暹罗猫润色？

---

## 请 Review 重点

1. **AuthorizationManager 两层设计**: 持久化 + 运行时分离是否干净？waiter 清理是否完整？
2. **规则匹配优先级**: thread > global, 后添加的 rule wins — 是否有边界情况遗漏？
3. **路由安全**: callback-auth.ts 使用 invocationId+token 鉴权, authorization.ts 使用 x-user-id — 是否一致？
4. **前端 socket 事件**: 新增的 authorization:request/response 是否需要线程级过滤？
5. **MCP 工具**: callback-tools.ts 新增的 handler 是否遵循现有模式？

---

## Next Action

请 review 代码，特别关注安全性和边界情况。Review 完成后我会根据你的反馈修复，然后提交合并。

文件清单（按 review 优先级排序）:
1. `packages/api/src/domains/cats/services/AuthorizationManager.ts` — 核心逻辑
2. `packages/api/src/routes/callback-auth.ts` — 猫端路由
3. `packages/api/src/routes/authorization.ts` — 铲屎官端路由
4. `packages/api/src/domains/cats/services/AuthorizationRuleStore.ts` — 规则引擎
5. `packages/api/src/domains/cats/services/PendingRequestStore.ts` — 待审批队列
6. `packages/shared/src/types/authorization.ts` — 共享类型
7. `packages/api/test/authorization.test.js` + `authorization-routes.test.js` — 测试
8. `packages/web/src/components/AuthorizationCard.tsx` — 前端卡片
