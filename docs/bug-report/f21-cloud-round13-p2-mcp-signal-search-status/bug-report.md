---
feature_ids: [F021]
topics: [cloud, round13, mcp]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: F21 Cloud Round13 — MCP `signal_search` 未透传 `status` 过滤

> 日期：2026-02-20  
> 报告人：Cloud Codex Review（PR #30 round13）  
> 定位/修复：缅因猫（砚砚）  
> 严重度：P2

## 1. 报告人

- 报告来源：cloud round13 自动 review。
- 问题：`@cat-cafe/mcp-server` 的 `signal_search` 工具未把 `status` 参数传给 `/api/signals/search`，导致 MCP 搜索无法按状态过滤。

## 2. 复现步骤（期望 vs 实际）

1. 通过 MCP 调用 `signal_search`，输入 `query=claude` 且 `status=read`。
2. 观察 mcp-server 发给 API 的请求 query string。

期望行为：
- 请求包含 `status=read`，后端按状态过滤。

实际行为（修复前）：
- 请求缺少 `status`，后端无法执行状态过滤。

## 3. 根因分析

- `signalSearchInputSchema` 未声明 `status` 字段。
- `handleSignalSearch` 的输入类型未包含 `status`。
- 组装 `URLSearchParams` 时未写入 `status`。

结论：这是 MCP 层参数传递链路漏项，不是 API 服务逻辑错误。

## 4. 修复方案（为何选择）

- 在 `signalSearchInputSchema` 增加 `status`（枚举：`inbox|read|starred|archived`）。
- 在 `handleSignalSearch` 输入类型增加 `status`。
- 构造查询参数时补 `status` 透传。
- 增加 MCP 回归测试，断言 query string 包含 `status`。

Why：
- 最小改动补齐 MCP->API 参数链路，和既有 web/api 语义保持一致。

Tradeoff：
- 使用工具层显式枚举约束状态值，而非复用 shared 的 zod schema，减少跨包耦合改动。

## 5. 验证方式

### Red（先失败）

- 新增测试：
  - `packages/mcp-server/test/signals-tools.test.js`
  - `handleSignalSearch forwards status filter to API query`
- 修复前失败：`searchParams.get('status')` 断言为 `null`（预期 `read`）。

### Green（修复后通过）

```bash
pnpm --filter @cat-cafe/mcp-server run build && node --test packages/mcp-server/test/signals-tools.test.js
# => 4/4 pass

pnpm --filter @cat-cafe/mcp-server test
# => 31/31 pass
```
