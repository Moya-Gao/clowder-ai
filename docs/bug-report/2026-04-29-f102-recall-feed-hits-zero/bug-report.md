---
feature_ids: [F102]
topics: [bug-report, memory, recall-feed, search-evidence, tool-events]
doc_kind: bug-report
created: 2026-04-29
---

# Bug Report: F102 RecallFeed 搜到结果但显示 `0 hits`

## 1. 报告人

Landy 在 2026-04-29 runtime dogfood 时发现：猫猫调用 `search_evidence` 后，记忆面板里能看到 recall 卡片，但展开后只显示 `Mode / Scope / Time`，或者 header 显示 `0 hits`。同一 query 通过 `cat_cafe_search_evidence` / `cat_cafe_list_threads` 可直接搜到结果。

## 2. 复现步骤

1. 触发猫猫连续调用多个 `search_evidence`，或让工具结果包含当前 MCP 输出格式：
   `Found N result(s) [variant=...]`
2. 打开 Workspace 记忆面板的 RecallFeed。
3. 展开对应 recall 卡片。

期望行为：卡片显示真实 hit count，并展示可解析的结果条目。

实际行为：部分 recall 卡片无结果；带 `[variant=...]` 的结果头会被解析为 `0 hits`。

## 3. 根因分析

根因有两层：

1. `parseResultCountFromText()` 只匹配 `Found N result(s):`，没有兼容 F163 variant 输出 `Found N result(s) [variant=...]:`。
2. `filterRecallEvents()` 依赖位置相邻配对：遇到 `search_evidence` 的 `tool_use` 后，只看后面的下一个 `tool_result`，且遇到另一个 `tool_use` 就停止。实际 provider 会先连续吐出多个 `tool_use`，再依次返回多个通用 label 的 `tool_result`，导致前面的 search 永远拿不到结果。

后端 evidence index 未丢：`scope=threads` 检索仍可命中 `猫猫杀` 相关 thread，问题在 RecallFeed 对工具事件的前端还原层。

## 4. 修复方案

1. 兼容 `Found N result(s) [variant=...]` 结果头。
2. 将 RecallFeed 工具结果配对从“相邻 next result”改为“pending search FIFO 队列”。
3. 只把看起来像 search_evidence 输出的 `tool_result` 配给 pending search，避免把 `read_file` 等无关工具结果误配给 recall 卡片。

## 5. 验证方式

新增回归测试：

- 带 MCP prefix + `[variant=...]` 的 search_evidence 输出能解析真实 `resultCount`。
- 多个 search_evidence `tool_use` 连续出现、随后结果按 FIFO 返回时，RecallFeed 能正确配对 first/second 结果。

验证命令：

```bash
pnpm --filter @cat-cafe/web exec vitest run src/__tests__/recall-feed.test.ts src/hooks/__tests__/useRecallEvents.test.ts
```

