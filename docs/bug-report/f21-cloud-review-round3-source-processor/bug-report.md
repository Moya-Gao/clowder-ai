# F21 Cloud Review Round 3 Bug Report (P1 + P2 in source-processor)

## 1. 报告人

- 报告来源: Cloud Codex PR review (`chatgpt-codex-connector`)
- PR: `#30`
- Reviewed commit: `79e5a5508f1cbfa1a7fbfd3f26c20a71968bec11`
- 发现时间: 2026-02-19

## 2. 复现步骤（期望 vs 实际）

### P1: 单条文章 store 失败会中断整轮抓取

- 位置: `packages/api/src/domains/signals/services/source-processor.ts`
- 复现: `articleStore.store()` 对某条文章抛错（比如 schema 校验失败或文件写入异常）
- 实际: 异常冒泡导致 `storeFetchedArticles` 退出，后续文章/来源不再处理
- 期望: 该条失败转为 source error 记录，处理流程继续执行

### P2: source.filters.keywords 配置未生效

- 位置: `packages/api/src/domains/signals/services/source-processor.ts`
- 复现: source 配置 `filters.keywords.include/exclude`，fetch 返回多条不同关键词文章
- 实际: 所有文章直接进入 dedup/store，include/exclude 被忽略
- 期望: 在 dedup/store 前执行关键词过滤，只处理符合配置的文章

## 3. 根因分析

1. `storeFetchedArticles` 内部直接 `await articleStore.store(...)`，没有 try/catch 隔离单条失败。
2. 处理循环没有任何 `source.filters.keywords` 判断逻辑，导致配置字段仅定义不执行。

## 4. 修复方案

1. 在 `storeFetchedArticles` 中为每条 store 调用加 try/catch：
   - 捕获异常并转为 `FetchError`（按来源 method 映射 code）
   - 继续处理下一条文章
2. 增加关键词过滤函数并在 dedup/store 前调用：
   - `include`: 至少命中一个才通过
   - `exclude`: 命中任意一个即剔除
   - 匹配目标: `title/summary/content/url`，大小写不敏感
3. Red→Green 回归测试：
   - store 单条异常不应中断整轮
   - include/exclude 过滤必须生效，且在 dedup/store 之前

## 5. 验证方式

1. 先新增失败测试（Red）：
   - `packages/api/test/signal-source-processor.test.js`
2. 修复实现后转绿（Green）：
   - `pnpm --filter @cat-cafe/api run build`
   - `pnpm --filter @cat-cafe/api exec node --test test/signal-source-processor.test.js`
3. 回归：
   - `cd packages/api && node --test test/signal-*.test.js test/rss-fetcher.test.js test/signals-route.test.js`
   - `pnpm --filter @cat-cafe/mcp-server test`
   - `pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useChatCommands-signals.test.ts`
