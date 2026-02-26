---
feature_ids: [F021]
topics: [cloud, round15, stop]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: F21 Cloud Round15 — Inbox 页面重复过滤服务端搜索结果

> 日期：2026-02-20  
> 报告人：Cloud Codex Review（PR #30 round15）  
> 定位/修复：缅因猫（砚砚）  
> 严重度：P2

## 1. 报告人

- 报告来源：cloud round15 自动 review。
- 问题：`SignalInboxView` 在 `searchSignals` 返回结果后仍执行 `filterSignalArticles(items, filters)`，导致服务端已命中的结果被前端二次过滤掉。

## 2. 复现步骤（期望 vs 实际）

1. 在 Inbox 页面输入 query 并提交，后端返回 1 条命中文章。
2. 该文章命中条件来自服务端搜索域（例如正文 content），但不命中前端本地 haystack（title/source/url/summary/tags）。
3. 观察页面结果数量。

期望行为：
- 页面直接展示服务端返回结果（例如共 1 篇）。

实际行为（修复前）：
- 前端再次本地过滤后显示 0 篇。

## 3. 根因分析

- `SignalInboxView` 的 `filteredItems` 始终由 `filterSignalArticles(items, filters)` 计算，即便 `items` 已来自服务端搜索接口。
- `filterSignalArticles` 的本地 query 匹配域不包含正文 content，与后端搜索语义不一致。
- 结果：服务端命中但前端二次过滤漏项。

## 4. 修复方案（为何选择）

- 增加“当前数据是否来自服务端搜索”的状态位。
- 当数据来自服务端搜索时，列表直接使用 `items`（不再本地 query/status/source/tier 二次过滤）。
- 当数据来自 inbox 刷新时，仍保留本地过滤能力。
- 补充组件测试覆盖该回归场景。

Why：
- 保证 UI 展示语义与服务端搜索语义一致，避免跨层过滤口径不一致导致漏结果。

Tradeoff：
- 搜索结果模式下，用户改筛选器不会立刻触发本地过滤，而是需要再次提交搜索；这是与“服务端为准”一致的行为。

## 5. 验证方式

### Red（先失败）

- 新增测试：
  - `packages/web/src/components/__tests__/signal-inbox-view.test.ts`
  - `does not re-filter server search results on inbox page`
- 修复前实际失败：
  - 断言：`expected ... to contain '共 1 篇'`
  - 实际渲染：`共 0 篇`
  - 失败位置：`signal-inbox-view.test.ts:237`

```bash
pnpm --filter @cat-cafe/web test -- src/components/__tests__/signal-inbox-view.test.ts
# => 1 failed, 1 passed
```

### Green（修复后通过）

```bash
pnpm --filter @cat-cafe/web test -- src/components/__tests__/signal-inbox-view.test.ts
# => 2 passed

pnpm --filter @cat-cafe/web run build
# => build success
```
