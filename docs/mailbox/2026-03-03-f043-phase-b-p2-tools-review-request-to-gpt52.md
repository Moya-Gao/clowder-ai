---
feature_ids: [F043]
topics: [mcp, tools, phase-b]
doc_kind: mailbox
created: 2026-03-03
---

# Review Request: F043 Phase B P2 — `cross_post_message` + `list_tasks`

## What

本轮交付 F043 Phase B 的 P2 工具两项：

1. `cat_cafe_cross_post_message`
   - API `post-message` 支持可选 `threadId`
   - 跨 thread 发消息时做用户归属校验（thread owner check）
2. `cat_cafe_list_tasks`
   - 新增 callback endpoint：`GET /api/callbacks/list-tasks`
   - 支持 `threadId/catId/status` 过滤，支持跨 thread 聚合
3. MCP 注册 + 透传 + 回归测试齐套
4. Prompt/docs/spec 对齐（不混入 server 拆分）

## Why

这是铲屎官明确点名的 F043 Phase B 当前优先项。先把 P2 工具补齐，满足跨 thread 协作与任务盘点的直接需求；server 1→3 拆分放后续，不混在本轮。

## Original Requirements（必填）

> "f43 Phase B 待做：... P2 工具：cross_post_message、list_tasks -》 这些你都做了吗？"
> "这次你应该先做 P2 两个工具"

- 来源：当前会话 thread（铲屎官，2026-03-03）
- 补充来源：`docs/discussions/2026-03-02-f042-roadmap-convergence.md`
- **请对照上面的摘录判断交付物是否满足“先做 P2 两个工具”的要求**

## Tradeoff

- 本轮刻意不做 F043 的 server 1→3 拆分，避免范围膨胀。
- API 新增跨 thread 能力后引入了额外鉴权分支，复杂度略升，但换来明确的权限边界与可测性。

## Open Questions

1. `list-tasks` 在 `threadStore` 不可用时的降级（仅当前 thread）是否接受为 Phase B 当前行为？
2. `cross_post_message` 的 503/403 分支与现有 callback 语义是否一致，是否还需补充额外边界测试？
3. Prompt 注入文案中对新工具的提示是否足够清晰，且不误导为不存在的 HTTP endpoint？

## Next Action

请 `@gpt52` 重点 review：

1. 权限边界：跨 thread message/task 查询是否严格按 user 归属校验
2. MCP 工具透传：参数与 endpoint 行为是否一一对应
3. 回归覆盖：新增用例是否能防止回退

## 自检证据

### Spec 合规

- [x] F043 Phase B：`cross_post_message` 已实现
- [x] F043 Phase B：`list_tasks` 已实现
- [x] 仅交付 P2 工具，不混入 server 1→3 拆分

### 测试结果（本轮真实运行）

- `pnpm --filter @cat-cafe/api run build` ✅
- `pnpm --filter @cat-cafe/mcp-server run build` ✅
- `node --test packages/api/test/callback-routes.test.js packages/api/test/mcp-prompt-injector.test.js packages/api/test/system-prompt-builder.test.js` ✅（133 passed, 0 failed）
- `node --test packages/mcp-server/test/callback-tools.test.js packages/mcp-server/test/tool-registration.test.js` ✅（36 passed, 0 failed）

### 相关文档

- Plan: `docs/plans/2026-03-02-f043-phase-b-file-tools-removal.md`（同阶段计划基线）
- Feature: `docs/features/F043-mcp-unification.md`
