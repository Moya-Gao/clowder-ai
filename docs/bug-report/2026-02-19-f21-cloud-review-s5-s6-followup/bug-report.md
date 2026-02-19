# Bug Report: F21 Cloud Review S5/S6 Follow-up

- 报告时间：2026-02-19
- 报告人：chatgpt-codex-connector（PR #30 cloud review）
- 执行人：缅因猫（砚砚）
- 范围：`feat/f21-signal-hunter`（S5/S6）

## 1. 报告来源

云端 review 在最新提交 `27bfd38` 给出 3 条需处理问题：
- P1: `packages/api/src/domains/signals/fetchers/rss-fetcher.ts`（`discussion_r2825540067`）
- P2: `packages/api/src/domains/signals/services/article-document.ts`（`discussion_r2825540074`）
- P1: `packages/api/src/scripts/migrate-signals/shared.ts`（`discussion_r2825540078`）

## 2. 复现步骤（期望 vs 实际）

### P1-A: RSS 空 link + 非 URL guid
- 期望：该条目应被跳过，不应让调度整体失败。
- 实际：`toRawArticle` 会接受 `guid`，下游 `SignalArticleSchema` 校验 URL 失败后抛错，可能中断调度流程。

### P2: 清空 summary 后 frontmatter 残留旧值
- 期望：PATCH `summary: ""` 后应从 frontmatter 移除 `summary` 字段。
- 实际：`toUpdatedFrontmatter` 以 `...previousFrontmatter` 起步且仅在有值时覆盖 summary，导致旧 summary 残留。

### P1-B: 迁移去重丢失 query 参数
- 期望：`https://x/rss?tag=a` 与 `https://x/rss?tag=b` 视为不同 source。
- 实际：`normalizeUrl` 丢弃 query，`mergeSources` 误合并，导致 source 丢失或映射错误。

## 3. 根因分析

- P1-A：`toRawArticle` 只做空值检查，不做 URL 语义校验。
- P2：frontmatter 更新逻辑没有“删除 summary”分支。
- P1-B：URL 归一化策略过度归并（去掉 query）。

## 4. 修复方案与取舍

- P1-A：在 RSS fetch 阶段加入 URL 有效性校验，非 URL 直接丢弃。
  - 取舍：严格后会丢弃部分非标准 feed 条目，但避免调度级失败，风险更低。
- P2：`toUpdatedFrontmatter` 先剥离旧 summary，再按新 article 是否带 summary 决定是否写回。
  - 取舍：会改变历史 frontmatter 字段保留策略，但与 API 语义一致。
- P1-B：`normalizeUrl` 保留 query（继续忽略 hash），避免不同 feed 被错误合并。
  - 取舍：可能降低“去重激进度”，但这是正确的数据隔离。

## 5. 验证计划（Red→Green）

- Red（先失败）：
  - `packages/api/test/rss-fetcher.test.js` 新增“非 URL guid 被过滤”用例。
  - `packages/api/test/signals-route.test.js` 扩展“清空 summary 后持久化不回弹”用例。
  - `packages/api/test/signal-source-migration.test.js` 新增“query 不同不合并”用例。
- Green：实现修复后回跑上述用例 + 信号相关回归测试。
