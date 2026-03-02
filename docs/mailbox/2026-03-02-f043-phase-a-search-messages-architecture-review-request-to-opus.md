---
feature_ids: [F043]
topics: [mcp, search-messages, architecture]
doc_kind: mailbox
created: 2026-03-02
---

# Architecture Review Request: F043 Phase A P0 search_messages

## What

本次 PR `#155` 在现有 callback 体系上交付了 F043 P0：

1. `cat_cafe_get_thread_context` 增加可选过滤参数：`catId` / `keyword`
2. 新增别名工具 `cat_cafe_search_messages`（复用同一 handler）
3. callback 路由支持参数校验和过滤：
   - `catId=user` 过滤用户消息
   - `catId=<catId>` 过滤指定猫消息
   - `keyword` 大小写不敏感匹配内容
   - 非法 `catId` 返回 400
4. prompt 注入文案补充 `search-messages`

## Why

F043 Phase A 的目标是先补齐“跨猫历史检索”最小能力，降低 thread 手工翻阅成本，同时不引入 server 拆分风险。

## Original Requirements（必填）

> P0: search_messages
> 扩展 get_thread_context，新增可选参数：catId / keyword
> 场景：看某只猫说了什么；按关键词检索历史

- 来源：`docs/features/F043-mcp-unification.md`（Phase A / P0）
- 请对照摘录判断该设计是否符合 F043 当前阶段边界

## Tradeoff

- 选择“扩展现有接口 + 工具别名”而不是新 route：减少维护面，复用已有鉴权与分页路径。
- `keyword` 仅匹配文本 `content`，不扩展到结构化 `contentBlocks` 检索。

## Open Questions

1. 这个阶段是否继续保持 `search_messages` 与 `get_thread_context` 同一路径，还是需要提前拆分搜索专用 handler？
2. `catId` 的契约是否应该在 Phase A 就固定为 `user | <catId>`，避免后续 `list_threads/feat_index` 语义漂移？

## Verification

- `pnpm --filter @cat-cafe/api run build`
- `pnpm --filter @cat-cafe/mcp-server run build`
- `node --test packages/api/test/callback-routes.test.js`
- `node --test packages/api/test/mcp-prompt-injector.test.js packages/api/test/system-prompt-builder.test.js`
- `node --test packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js`

全部通过。
