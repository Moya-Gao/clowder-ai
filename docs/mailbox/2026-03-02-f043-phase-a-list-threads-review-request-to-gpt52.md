---
feature_ids: [F043]
topics: [mcp, list-threads, callbacks]
doc_kind: mailbox
created: 2026-03-02
---

# Review Request: F043 Phase A P1 list_threads

## What

本次实现交付了 F043 Phase A 的 `list_threads` 最小能力：

1. 新增 HTTP callback endpoint：`GET /api/callbacks/list-threads`
2. 新增 MCP tool：`cat_cafe_list_threads`（透传 `limit` / `activeSince`）
3. 契约按拍板执行：
   - 分页：`activeSince + lastActiveAt desc + limit`
   - `messageCount`：Phase A 固定 `null`
   - `threadStore` 未配置：固定 `503`
4. prompt/docs 对齐：HTTP 工具列表加入 `list-threads`，并保持 `<700 chars` 门禁

## Why

F043 P1 的目标是 thread 发现能力（先知道“有哪些 thread 在活跃”），为后续 `feat_index` 和跨 thread 协作提供入口。

## Original Requirements（必填）

> P1: list_threads
> limit?: number; activeSince?: number
> 场景："有哪些 thread？F039 的讨论在哪？"

- Source: `docs/features/F043-mcp-unification.md`（P1 设计段）
- 请 reviewer 对照上面摘录判断本次交付是否满足 F043 P1

## Tradeoff

- 明确不做 cursor/offset（Phase A 先轻契约）
- 明确不做 `catId` filter（延后 P1+）
- 为避免 O(N×M) 扫描，`messageCount` 暂设 `null`，后续如需真实计数单开 `countByThread`

## Open Questions

1. `threadStore` 未配置返回 `503` 的错误文案是否需要统一成全局错误码格式？
2. `messageCount: null` 的 UI/消费者兼容性是否还需补一条契约测试？

## Verification

- `pnpm --filter @cat-cafe/api run build`
- `pnpm --filter @cat-cafe/mcp-server run build`
- `node --test packages/api/test/callback-routes.test.js`
- `node --test packages/api/test/mcp-prompt-injector.test.js packages/api/test/system-prompt-builder.test.js`
- `node --test packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js`

全部通过。
