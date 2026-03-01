---
feature_ids: [F042]
topics: [mcp, prompt, tools, review-routing]
doc_kind: bug-report
created: 2026-03-01
---

# Bug Report — MCP tool `cat_cafe_register_pr_tracking` 未被提示词注入

## 1) 报告人
- 报告来源：铲屎官 + thread 复盘（`thread_mm73p342qf8emdaq`）
- 触发方式：PR 合入流程中需要注册 PR tracking，但不同猫对“是否存在该工具”的认知不一致

## 2) 复现步骤（期望 vs 实际）

### 复现
1. 确认 MCP Server 已注册工具 `cat_cafe_register_pr_tracking`（实现存在于 `packages/mcp-server/src/tools/callback-tools.ts`）。
2. 让布偶猫/缅因猫在无额外说明的情况下依据提示词判断“有哪些 Cat Cafe MCP 工具可用”。

### 期望
- `SystemPromptBuilder` 的 MCP tools 列表和 `McpPromptInjector` 的 HTTP callback 工具清单都包含：
  - `cat_cafe_register_pr_tracking` / `register-pr-tracking`
- `using-mcp-callbacks` skill 的端点参考中包含 `/api/callbacks/register-pr-tracking` 的 curl 示例。

### 实际
- MCP Server 有该工具，但提示词注入未列出，导致不同猫对工具能力口径不一致，进而影响 PR tracking 的执行与云端 review 路由稳定性。

## 3) 根因分析
- `packages/mcp-server` 已实现并注册 `cat_cafe_register_pr_tracking`，但：
  - `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` 的 `MCP_TOOLS_SECTION` 未列出该工具。
  - `packages/api/src/domains/cats/services/agents/invocation/McpPromptInjector.ts` 的 “可用工具”清单未列出该工具。
  - `cat-cafe-skills/using-mcp-callbacks/SKILL.md` 未提供该端点的参考示例。

## 4) 修复方案与取舍
- 方案 A（采用，止血 patch）
  - 在 `SystemPromptBuilder.ts` 的 MCP tools 列表补充 `cat_cafe_register_pr_tracking`。
  - 在 `McpPromptInjector.ts` 的 “可用工具”清单补充 `register-pr-tracking`。
  - 在 `using-mcp-callbacks` skill 增补 `/api/callbacks/register-pr-tracking` 的 curl 示例。
  - 补齐最小测试用例，防回归。
- 放弃方案
  - 立即做“从 MCP server 自动生成工具清单”的架构收口（属 F042 后续 Wave 2/3 范畴，改动面更大）。

## 5) 验证方式
- Red→Green：新增/更新测试断言：
  - `system-prompt-builder` 在 `mcpAvailable=true` 时包含 `cat_cafe_register_pr_tracking`
  - `mcp-prompt-injector` 的 callback instructions 包含 `register-pr-tracking`
- 回归：运行 `@cat-cafe/api` 的相关测试文件，确认无回归。

