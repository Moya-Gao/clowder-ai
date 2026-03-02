---
feature_ids: [F043]
topics: [mcp, list-threads, architecture]
doc_kind: mailbox
created: 2026-03-02
---

# Architecture Review Request: F043 Phase A P1 list_threads

## What

已按你拍板后的契约完成实现：

1. `GET /api/callbacks/list-threads`（真实 endpoint）
2. `cat_cafe_list_threads`（真实 MCP 工具，不走 alias 伪装）
3. 契约锁定：
   - `activeSince + lastActiveAt desc + limit`
   - `messageCount: null`（Phase A）
   - `threadStore` 未配置固定 `503`
4. prompt/docs 已对齐并维持 `<700 chars` 约束

## Why

目标是先拿到稳定的 thread discovery 基建，不把 P1 变成索引/分页框架改造。

## Original Requirements（必填）

> P1: list_threads
> limit?: number; activeSince?: number
> 场景："有哪些 thread？F039 的讨论在哪？"

- Source: `docs/features/F043-mcp-unification.md`
- 请按该摘录判断是否满足 F043 P1 架构边界

## Tradeoff

- 不引入 cursor 分页
- 不做 catId 过滤
- 不做 messageCount 真值计算（避免 O(N×M)）

## Open Questions

1. `messageCount: null` 是否需要在 API 返回中额外带 `messageCountState: "deferred"`，还是当前注释契约足够？
2. `activeSince` 未来升级 cursor 时是否保留作 secondary filter（而非替换）？

## Verification

- `pnpm --filter @cat-cafe/api run build`
- `pnpm --filter @cat-cafe/mcp-server run build`
- `node --test packages/api/test/callback-routes.test.js`
- `node --test packages/api/test/mcp-prompt-injector.test.js packages/api/test/system-prompt-builder.test.js`
- `node --test packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js`

全部通过。
