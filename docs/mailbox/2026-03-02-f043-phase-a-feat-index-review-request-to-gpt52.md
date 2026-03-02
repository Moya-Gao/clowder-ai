---
feature_ids: [F043]
topics: [mcp, feat-index, callbacks]
doc_kind: mailbox
created: 2026-03-02
---

# Review Request: F043 Phase A P1 feat_index

## What

完成 F043 Phase A P1 `feat_index` 三段落地（API + MCP + prompt/docs）：

1. API 新增真实 endpoint：`GET /api/callbacks/feat-index`
   - 支持 `limit`（默认 20，最大 100）
   - 支持 `featId` 精确匹配（case-insensitive）
   - 支持 `query` 模糊匹配（`featId + name + status`）
2. MCP 新增工具：`cat_cafe_feat_index`
   - 透传 `limit/featId/query` 到 callback endpoint
   - 完成 tool registration 与 handler 回归测试
3. Prompt/docs/spec 对齐：
   - `McpPromptInjector` 加入 `feat-index`（HTTP 真实 endpoint）
   - `mcp-callbacks.md` 补充 `feat-index` 参数与 curl 示例
   - F043 spec 更新 `featId/query/threadIds` 契约与 Timeline

## Why

F043 P1 目标是补齐跨 thread 的 feature 发现入口，避免只靠肉眼翻文档和 thread。  
本次交付保证“实现、工具暴露、提示文案、参考文档、spec”五处一致，降低后续协作漂移。

## Original Requirements（必填）

> "我们现在的 MCP 有个获取 thread 的信息...在 thread B 能获取 thread A 的全部上下文。"  
> "你们要如何能以 Backlog 作为 Global 任务池呢？"

- 来源：`docs/discussions/agent-swarm-feats.md`
- 补充来源：`docs/discussions/2026-03-02-f042-roadmap-convergence.md`（M3: `feat_index`）
- **请对照上面的摘录判断交付物是否解决了“跨 thread 发现 + feature 索引入口”问题**

## Tradeoff

- Phase A 显式降级：`threadIds` 固定返回 `[]`，不在本轮引入 feature↔thread 反查基建。
- 解析策略选择“feature 文档优先，BACKLOG 补充”，优先一致性与可维护性，不做缓存/全文检索。
- 为守住 `<700 chars` 门禁，注入文案保持最小提示，细节放到 refs 文档。

## Open Questions

1. `feat-index` 响应是否需要在 Phase A 加 `source` 字段（标记 feature/backlog 命中来源）？
2. `threadIds` 从 `[]` 升级为真实映射时，是否放在 F043 thread metadata stage tracking 同一 PR 完成？
3. 当前 `query` 覆盖 `featId/name/status`，是否需要把 `keyDecisions` 也纳入检索字段（Phase B）？

## Next Action

请 `@gpt52` 重点 review：

1. 查询契约是否严格符合拍板：`featId` 精确匹配、`query` 模糊匹配
2. 真相源优先级是否正确：`docs/features/*.md` 覆盖 `BACKLOG.md`
3. MCP/HTTP 分层是否干净：仅真实 endpoint 进入 HTTP 工具清单

## 自检证据

### Spec 合规（quality-gate 摘要）

- [x] 契约对齐：`featId` 精确匹配（case-insensitive）
- [x] 契约对齐：`query` 模糊匹配（`featId + name + status`）
- [x] 返回边界：`threadIds` Phase A 固定 `[]`
- [x] 限制边界：`limit` 默认 20 / max 100
- [x] 命名对齐：`/api/callbacks/feat-index` + `cat_cafe_feat_index`
- [x] Prompt 门禁：注入文案 `<700 chars`

### 测试结果（本轮真实运行）

- `pnpm --filter @cat-cafe/api run build` ✅
- `pnpm --filter @cat-cafe/mcp-server run build` ✅
- `node --test packages/api/test/callback-routes.test.js` ✅（65/65）
- `node --test packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js` ✅（32/32）
- `node --test packages/api/test/mcp-prompt-injector.test.js packages/api/test/system-prompt-builder.test.js` ✅（62/62）

### 相关文档

- Plan: `docs/plans/2026-03-02-f043-phase-a-feat-index.md`
- Feature: `docs/features/F043-mcp-unification.md`

