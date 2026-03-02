---
feature_ids: [F043]
topics: [mcp, search-messages, callbacks]
doc_kind: plan
created: 2026-03-02
---

# F043 Phase A: search_messages 落地计划

## Goal

实现 F043 Phase A 的 P0：在 MCP 协作工具中支持按 `catId` / `keyword` 检索消息。

## Scope

1. `cat_cafe_get_thread_context` 增加可选参数 `catId` 与 `keyword`。
2. 新增别名工具 `cat_cafe_search_messages`（复用 thread-context handler）。
3. API callback 路由 `/api/callbacks/thread-context` 增加参数校验与过滤逻辑。
4. 补齐 API + MCP server 的回归测试。

## TDD

1. 新增 callback route 过滤测试（catId/user、keyword、组合过滤、非法 catId）。
2. 新增 MCP callback tools 参数透传测试。
3. 先跑失败，再实现最小改动，再跑回归。

## Verification

1. `pnpm --filter @cat-cafe/api run build`
2. `pnpm --filter @cat-cafe/mcp-server run build`
3. `node --test packages/api/test/callback-routes.test.js`
4. `node --test packages/api/test/mcp-prompt-injector.test.js packages/api/test/system-prompt-builder.test.js`
5. `node --test packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js`
