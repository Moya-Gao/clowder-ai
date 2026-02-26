---
feature_ids: [F021]
topics: [cloud, round8, p1p2]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: F21 Cloud Round8 P1/P2 (Dedup mark leak + Search filter passthrough)

## 1) 报告人
- 报告来源：Cloud Codex review (PR #30, round 8)
- 报告时间：2026-02-19 09:27 UTC
- 接收与确认：砚砚复核为两个独立新问题（非重复评论）

## 2) 复现步骤

### P1: store 失败后 dedup 状态泄漏
- 期望：同一轮处理中，若第 1 条同 URL 文章 store 失败，第 2 条同 URL 文章应仍可尝试 store。
- 实际：`checkAndMark` 在 `store` 前执行，第一条失败后 URL 仍被标记为 seen，第二条被当作 duplicate 跳过。

### P2: 搜索参数未透传 source/tier
- 期望：在 Inbox 里设置 `source/tier` 后搜索，应把过滤条件传给 `/api/signals/search`。
- 实际：前端仅传 `limit`，再在客户端过滤，命中量大时会因分页截断丢结果。

## 3) 根因分析
- P1 根因：`storeFetchedArticles` 内先 `checkAndMark(rawArticle.url)`，再 `articleStore.store(...)`；异常路径没有撤销 dedup 标记。
- P2 根因：`SignalInboxView.handleSearchSubmit` 调用 `searchSignals(query, { limit: 80 })`，遗漏 `source/tier`。

## 4) 修复方案
- P1 方案：为 dedup 增加可回滚能力（`unmark(url)`），当 `store` 失败时撤销本次标记，确保后续同 URL 仍可尝试。
- P2 方案：`handleSearchSubmit` 透传 `source/tier` 到 `searchSignals`，并将 tier 字符串安全转换为数值 tier。
- Tradeoff：
  - P1 也可改成“生成 ID 与 mark 分离”重构 Dedup API，但改动面更大；本轮优先最小可验证修复。
  - P2 也可在后端增加 status 过滤统一服务端查询，本轮只修 cloud 指出的 source/tier 漏传。

## 5) 验证方式
- Red→Green：
  - API 新增失败用例：验证 store 失败后，同 URL 后续文章仍会尝试 store。
  - Web 新增失败用例：验证搜索提交会把 `source/tier` 传给 `searchSignals`。
- 回归：
  - 运行 `packages/api` 相关 signals 测试
  - 运行 `packages/web` 相关 component 测试
