---
feature_ids: [F088]
doc_kind: review-request
created: 2026-03-10
author: opus
reviewer: codex
---

# Review Request: F088 Phase C — 架构归一（命令管道统一 + 跨平台 Thread）

## What

Phase C 解决两个架构问题：

1. **命令消息入管道** — `/where /new /threads /use` 的交互以前只发回外部平台，不存 messageStore、不广播 WebSocket、前端不可见。现在：
   - `CommandResult` 新增 `contextThreadId`，标记命令对应的 thread
   - `ConnectorRouter.storeCommandExchange()` 把 inbound 命令 + outbound 系统回复存入 messageStore 并广播 WebSocket
   - 无 thread 的命令（如 `/where` 无 binding）优雅降级，不存不广播

2. **跨平台 `/threads` + `/use`** — 以前 connector-scoped（飞书看不到 Telegram 的 thread），现在用 `threadStore.list(userId)` 全局查询

3. **system-command connector** — 注册 `system-command` connector 定义，系统命令回复有独立的 source 标识

## Why

铲屎官核心诉求："飞书接入我们的前端应该是可见的！我也能在前端看到你们的 thread"

讨论共识（2026-03-10 讨论纪要）：**统一的是 Cat Café 的 thread/message/router 内核**，GitHub/飞书/Telegram 都只是 connector。命令绕过管道 = 信息孤岛，违反架构归一原则。

## Original Requirements（必填）

> 铲屎官："飞书接入我们的前端应该是可见的！我也能在前端看到你们的 thread"
> 讨论共识："统一的是 Cat Café thread/message core，不是 GitHub transport"
> 三层结构共识：Principal Link + Session Binding + Command Layer
> 命令解析放平台无关层，adapter 只做平台协议解析

- 来源：`docs/discussions/2026-03-10-f088-connector-thread-unification-meeting-notes.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- ConnectorRouter.ts 从 ~177 行增长到 227 行（>200 warning），通过提取 `storeCommandExchange()` 私有方法控制复杂度
- `exactOptionalPropertyTypes` 导致 RouteResult 构建用了 type assertion — 权衡为避免 undefined 赋值到 optional 属性的 TS 严格模式限制
- `/threads` 返回上限 10 条 — MVP 足够，后续可加分页

## Open Questions

1. **ConnectorRouter 227 行**：是否需要进一步拆分？当前 `storeCommandExchange` 已经是独立方法，但文件整体逾 200 行 warning
2. **system-command source 的 icon 用 ⚙️**：是否合适？还是应该用猫猫 logo？
3. **timestamp+1 分离命令和回复**：用 `now` 和 `now+1` 保证顺序，是否有更优雅的方案？

## Next Action

请 review 以下 7 个文件的改动，重点关注：
- `storeCommandExchange()` 的管道集成是否正确
- 跨平台 `/threads` + `/use` 的 `threadStore.list()` 切换
- RouteResult type assertion 是否安全

## 自检证据

### Spec 合规

Plan 3 步全部实现：
1. ✅ contextThreadId on CommandResult + storeCommandExchange
2. ✅ 跨平台 /threads + /use (threadStore.list)
3. ✅ system-command connector definition

### 测试结果

```
node --test test/connector-router.test.js test/connector-command-layer.test.js test/connector-phase-b4-integration.test.js
→ 31/31 pass, 0 fail ✅

新增 Phase C 专项测试：
- stores command exchange in messageStore when contextThreadId present
- broadcasts command exchange to WebSocket
- skips messageStore when contextThreadId absent
- /threads lists recent threads with titles (cross-platform)
- /use switches to an existing thread by prefix (cross-platform)
```

### Build & Type Check

```
pnpm build (api + shared) → exit 0 ✅
tsc --noEmit → 0 errors ✅
pnpm check (Biome) → 0 new errors in changed files ✅
```

### 文件改动清单

| File | Lines | Change |
|------|-------|--------|
| ConnectorCommandLayer.ts | 136 | +contextThreadId, +threadStore.list(), cross-platform /threads & /use |
| ConnectorRouter.ts | 227 | +storeCommandExchange(), +RouteResult command variant |
| connector-gateway-bootstrap.ts | ~230 | +list() in deps type |
| connector.ts (shared) | 113 | +system-command definition |
| connector-command-layer.test.js | 227 | +cross-platform tests, updated mocks |
| connector-router.test.js | ~350 | +3 Phase C tests |
| connector-phase-b4-integration.test.js | ~200 | +list() to mock |

### 相关文档
- Plan: `.claude/plans/quiet-tumbling-blanket.md`
- Feature: `docs/features/F088-multi-platform-chat-gateway.md`
- Discussion: `docs/discussions/2026-03-10-f088-connector-thread-unification-meeting-notes.md`
