---
feature_ids: [F021]
topics: [article, store]
doc_kind: plan
created: 2026-02-19
---

# F21 S2 Article Store Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 S2 抓取引擎里补齐 article-store，把抓取到的文章稳定落盘到 `~/.cat-cafe/signals/library`，并同步 inbox 与 Redis 索引。

**Architecture:** 新增 `ArticleStoreService`，输入为 `SignalSource + RawArticle`，输出为标准 `SignalArticle`。服务职责限定为“序列化 + 写盘 + 索引更新”，不耦合抓取器实现；Redis 作为可选依赖注入，便于单测与后续调度脚本复用。

**Tech Stack:** TypeScript, Node fs/promises, @cat-cafe/shared schema/types, Node test runner。

---

### Task 1: 定义 article-store 行为测试（RED）

**Files:**
- Create: `packages/api/test/signal-article-store.test.js`

**Step 1: 写失败测试**
- `store()` 会把文章写入 `library/{source}/{date}-{slug}.md`，包含 frontmatter。
- `store()` 会写入 `inbox/{YYYY-MM-DD}.json` 并追加条目。
- 传入 Redis mock 时，会写 `signal:article:{id}` + `signal:inbox` + `signal:by-source:{source}` + `signal:by-date:{date}`。
- 不传 `articleId` 时自动使用 dedup ID 规则。

**Step 2: 跑红灯**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-article-store.test.js`
Expected: FAIL（`article-store.js` 不存在）。

---

### Task 2: 最小实现 ArticleStoreService（GREEN）

**Files:**
- Create: `packages/api/src/domains/signals/services/article-store.ts`

**Step 1: 实现核心写盘**
- 构建 `SignalArticle`：`id/url/title/source/tier/publishedAt/fetchedAt/status/tags/filePath`。
- frontmatter + markdown body 写入文件。
- 文件名规则：`{YYYY-MM-DD}-{slug}.md`，slug 只保留 `[a-z0-9-]`，长度限 80。

**Step 2: 实现 inbox 更新**
- 按 `fetchedAt` 日期写入 `inbox/{YYYY-MM-DD}.json`。
- 文件不存在则初始化数组；已存在则 append 新条目。

**Step 3: 实现 Redis 可选索引写入**
- `hset signal:article:{id}` 保存文章元数据。
- `zadd signal:inbox`（score=fetchedAt epoch ms）。
- `zadd signal:by-source:{sourceId}`（score=fetchedAt epoch ms）。
- `sadd signal:by-date:{YYYY-MM-DD}`。

**Step 4: 跑绿灯**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-article-store.test.js`
Expected: PASS。

---

### Task 3: 回归验证与导出

**Files:**
- Modify: `packages/api/src/domains/signals/services/index.ts`（若不存在则创建）

**Step 1: 导出 service**
- 统一导出 `ArticleStoreService` 与相关类型。

**Step 2: 回归验证**
Run:
- `pnpm --filter @cat-cafe/shared run build`
- `pnpm --filter @cat-cafe/api run build`
- `node --test packages/api/test/rss-fetcher.test.js packages/api/test/api-fetcher.test.js packages/api/test/webpage-fetcher.test.js packages/api/test/signal-deduplication.test.js packages/api/test/signal-sources-loader.test.js packages/api/test/signal-article-store.test.js packages/api/test/signals-shared-contract.test.js`

Expected: PASS。

---

### Task 4: 提交与请求 review

**Step 1: 提交**
```bash
git add docs/plans/2026-02-19-f21-s2-article-store-plan.md \
  packages/api/src/domains/signals/services/article-store.ts \
  packages/api/src/domains/signals/services/index.ts \
  packages/api/test/signal-article-store.test.js

git commit -m "feat(signals): add article store for s2 [缅因猫🐾]" \
  -m "Why: persist fetched signal articles into library/inbox with redis indexes for downstream querying."
```

**Step 2: 请求布偶猫 review**
- 发送五件套 handoff + Red→Green 证据。

---

## DoD

1. `ArticleStoreService` 能把 `RawArticle` 持久化为 `SignalArticle` markdown 文件。
2. inbox 文件按天可累积读取。
3. Redis 索引可选启用且字段完整。
4. 新增测试覆盖落盘、inbox、Redis 索引与 ID fallback。
