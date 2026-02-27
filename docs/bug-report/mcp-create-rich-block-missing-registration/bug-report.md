---
feature_ids: [F022]
topics: [mcp, create, rich]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: `cat_cafe_create_rich_block` MCP 工具缺失注册

- 报告日期：2026-02-22
- 报告人：铲屎官（由 @opus45 反馈），缅因猫复现确认
- 严重度：P1（功能存在但对猫猫不可用）

## 1. 复现步骤

1. 在猫猫会话中列出可用 MCP 工具。
2. 观察 `cat_cafe_post_message / cat_cafe_get_thread_context / cat_cafe_update_task` 等存在。
3. 观察 `cat_cafe_create_rich_block` 缺失。

期望行为：
- `cat_cafe_create_rich_block` 出现在 MCP 工具列表，可用于发 `card/diff/checklist/media_gallery/audio` 富块。

实际行为：
- 工具不在注册列表中，猫猫只能走 `post_message + cc_rich` 降级路径。

## 2. 根因分析

- `packages/mcp-server/src/tools/callback-tools.ts` 已定义：
  - `createRichBlockInputSchema`
  - `handleCreateRichBlock`
  - `callbackTools` 中包含 `cat_cafe_create_rich_block`
- 但 `packages/mcp-server/src/index.ts` 的 `createServer()` 手工 `server.tool(...)` 注册链漏掉该工具。
- 同时 `packages/mcp-server/test/tool-registration.test.js` 的 `EXPECTED_TOOLS` 未包含该工具，导致此前测试未覆盖此回归点。

## 3. 修复方案

- 在 `packages/mcp-server/test/tool-registration.test.js` 将 `cat_cafe_create_rich_block` 纳入 `EXPECTED_TOOLS`（先 Red）。
- 在 `packages/mcp-server/src/index.ts`：
  - 导入 `createRichBlockInputSchema` 与 `handleCreateRichBlock`
  - 注册 `server.tool('cat_cafe_create_rich_block', ...)`
- 运行 `pnpm --filter @cat-cafe/mcp-server test` 验证 Green。

## 4. 放弃方案（Tradeoff）

- 方案 A：改造为自动遍历 `callbackTools` 批量注册，降低手工漏注册概率。
  - 放弃原因：本次热修目标是最小改动、快速恢复可用性；批量注册重构可作为后续改进。
- 方案 B：仅修改 `index.ts` 不补测试。
  - 放弃原因：会再次留下“注册层无守护”的风险。

## 5. 验证方式

- Red：`tool-registration` 断言 `Tool "cat_cafe_create_rich_block" is NOT registered`（失败）。
- Green：`pnpm --filter @cat-cafe/mcp-server test` 全绿。
- 额外验证：`createServer()._registeredTools` 包含 `cat_cafe_create_rich_block`。

