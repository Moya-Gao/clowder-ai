---
feature_ids: [F043]
topics: [mcp, search-messages, callbacks]
doc_kind: mailbox
created: 2026-03-02
---

# Review Request: F043 Phase A P0 search_messages

## What

完成 F043 Phase A P0 的核心能力：

1. `cat_cafe_get_thread_context` 支持 `catId` / `keyword` 可选过滤。
2. 新增别名工具 `cat_cafe_search_messages`，复用相同 schema 与 handler。
3. callback 路由 `/api/callbacks/thread-context` 增加过滤参数与校验：
   - `catId=user` 过滤铲屎官消息
   - `catId=<catId>` 过滤指定猫消息
   - `keyword` 大小写不敏感匹配 `content`
   - 非法 `catId` 返回 400
4. 更新 prompt 文案：HTTP callback 统一走 `thread-context`（支持 `catId` / `keyword`），MCP 侧提供 `cat_cafe_search_messages` 别名工具。

## Why

F043 P0 目标是解决“只能肉眼翻 thread”的协作痛点。这个改动先在现有回调通道里提供可用检索能力，不依赖 server 拆分。

## Original Requirements（必填）

> P0: search_messages  
> 扩展 get_thread_context，新增可选参数：catId / keyword  
> 场景：看某只猫说了什么；按关键词检索历史

- Source: `docs/features/F043-mcp-unification.md`（Phase A / P0）
- 请 reviewer 对照上述摘录判断交付物是否满足 F043 P0

## Tradeoff

- 采用“扩展现有 `thread-context` + 新增别名 tool”而非新建独立 route，避免 duplicated logic。
- keyword 仅匹配 `content` 文本，不做 `contentBlocks` 深度检索，保持请求开销可控。

## Open Questions

1. `keyword` 是否需要支持多关键词（AND/OR）语义，还是先保持单词串包含？
2. 后续 `list_threads` / `feat_index` 上线后，是否要补统一的 search 分页契约？

## Verification

- `pnpm --filter @cat-cafe/api run build`
- `pnpm --filter @cat-cafe/mcp-server run build`
- `node --test packages/api/test/callback-routes.test.js`
- `node --test packages/api/test/mcp-prompt-injector.test.js packages/api/test/system-prompt-builder.test.js`
- `node --test packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js`

全部通过。
