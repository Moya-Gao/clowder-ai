---
feature_ids: [F021]
topics: [cloud, round14, search]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: F21 Cloud Round14 — 后端 signal search 未包含 tags 匹配

> 日期：2026-02-20  
> 报告人：Cloud Codex Review（PR #30 round14）  
> 定位/修复：缅因猫（砚砚）  
> 严重度：P2

## 1. 报告人

- 报告来源：cloud round14 自动 review。
- 问题：`/api/signals/search` 的后端匹配 haystack 未包含 `article.tags`，导致“仅标签命中”的查询结果被漏掉。

## 2. 复现步骤（期望 vs 实际）

1. 准备一篇文章，其 `tags` 包含唯一关键词（不出现在 title/url/source/summary/content）。
2. 请求 `GET /api/signals/search?q=<tag-keyword>`。

期望行为：
- 返回该文章（`total >= 1`），因为 tag 应参与后端全文匹配。

实际行为（修复前）：
- 返回 `total = 0`（或漏返回），因为后端仅匹配 title/url/source/summary/content。

## 3. 根因分析

- `SignalArticleQueryService.search()` 在构建 `haystacks` 时缺少 `detail.article.tags`。
- 前端和 MCP 已透传参数，但后端匹配域不完整，导致语义缺口仍存在于 API 服务层。

结论：这是后端搜索实现缺项，不是调用方参数问题。

## 4. 修复方案（为何选择）

- 在 `packages/api/src/domains/signals/services/article-query-service.ts` 的搜索 haystack 中追加 `...detail.article.tags`。
- 增加 API 集成回归测试，验证“query 仅命中 tags”也能返回结果。

Why：
- 以最小改动补齐后端搜索语义，覆盖 web 和 MCP 所有调用路径。

Tradeoff：
- 保持当前 `includes` 字符串匹配策略，不引入分词/索引引擎，优先确保正确性与低风险回归。

## 5. 验证方式

### Red（先失败）

- 新增测试：
  - `packages/api/test/signals-route.test.js`
  - `GET /api/signals/search matches query against article tags`
- 修复前实际失败：`0 !== 1`（`signals-route.test.js:195`）。

```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signals-route.test.js
# => fail 1/15
# failing test: GET /api/signals/search matches query against article tags
```

### Green（修复后通过）

```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signals-route.test.js
# => 15/15 pass
```
