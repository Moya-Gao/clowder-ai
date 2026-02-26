---
feature_ids: [F021]
topics: [api, webpage, fetchers]
doc_kind: plan
created: 2026-02-18
---

# F21 S2 API/Webpage Fetchers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有 RSS + dedup bootstrap 基础上，补齐 S2 的 API 抓取器与网页抓取器，让 F21 抓取引擎具备三种基础抓取能力（rss/api/webpage）。

**Architecture:** 继续沿用 `fetchers/` 的统一 `Fetcher` 契约。新增 `ApiFetcher`（JSON endpoint 适配）与 `WebpageFetcher`（HTML + selector 抽取），都采用依赖注入式 HTTP 客户端以便单测。错误返回保持“结构化错误，不抛到调用方”。

**Tech Stack:** TypeScript, Node fetch, cheerio, Node test runner。

---

### Task 1: 扩展 Fetcher 错误码 + 导出入口

**Files:**
- Modify: `packages/api/src/domains/signals/fetchers/types.ts`
- Modify: `packages/api/src/domains/signals/fetchers/index.ts`

**Step 1: 写失败测试**
- 在新测试中引用尚未存在的 `API_FETCH_FAILED` / `WEBPAGE_FETCH_FAILED` 语义。

**Step 2: 跑红灯**
Run: `pnpm --filter @cat-cafe/api run build`
Expected: FAIL（类型/导出缺失）。

**Step 3: 最小实现**
- 扩展 `FetchErrorCode`。
- 在 `index.ts` 导出新 fetcher。

**Step 4: 绿灯验证**
Run: `pnpm --filter @cat-cafe/api run build`
Expected: PASS。

---

### Task 2: ApiFetcher（TDD）

**Files:**
- Create: `packages/api/src/domains/signals/fetchers/api-fetcher.ts`
- Create: `packages/api/test/api-fetcher.test.js`

**Step 1: 写失败测试**
- `canHandle()` 对 `method=api` 返回 true。
- 能解析“GitHub releases 风格数组”到 `RawArticle`。
- 能解析“Algolia hits 风格对象”到 `RawArticle`。
- 下游异常时返回 `API_FETCH_FAILED`，而非 throw。

**Step 2: 跑红灯**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/api-fetcher.test.js`
Expected: FAIL。

**Step 3: 最小实现**
- 依赖注入 fetch 函数。
- 通用 JSON shape 提取：`items/data/results/hits` + 常见字段映射（title/url/publishedAt/summary/content）。
- `timeoutMs` + `headers` 支持。

**Step 4: 绿灯验证**
执行同命令，Expected: PASS。

---

### Task 3: WebpageFetcher（TDD）

**Files:**
- Create: `packages/api/src/domains/signals/fetchers/webpage-fetcher.ts`
- Create: `packages/api/test/webpage-fetcher.test.js`
- Modify: `packages/api/package.json`（新增 `cheerio`）

**Step 1: 写失败测试**
- `canHandle()` 对 `method=webpage` 返回 true。
- 基于 selector 抽取文章，支持相对链接补全。
- 网络失败返回 `WEBPAGE_FETCH_FAILED`。

**Step 2: 跑红灯**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/webpage-fetcher.test.js`
Expected: FAIL。

**Step 3: 最小实现**
- 使用 `cheerio` 从 HTML 按 selector 提取 title/url/summary。
- 缺失 selector 时 fail-fast（结构化错误）。

**Step 4: 绿灯验证**
执行同命令，Expected: PASS。

---

### Task 4: 回归验证 + 提交

**Files:**
- Modify (as above)

**Step 1: 全量本轮验证**
Run:
- `pnpm --filter @cat-cafe/shared run build`
- `pnpm --filter @cat-cafe/api run build`
- `node --test packages/api/test/rss-fetcher.test.js packages/api/test/api-fetcher.test.js packages/api/test/webpage-fetcher.test.js packages/api/test/signal-deduplication.test.js packages/api/test/signal-sources-loader.test.js packages/api/test/signals-shared-contract.test.js`

**Step 2: 提交**
```bash
git add <changed-files>
git commit -m "feat(signals): add api/webpage fetchers for s2 [缅因猫🐾]" -m "Why: complete fetcher-method parity (rss/api/webpage) before storage and scheduler integration."
```

**Step 3: 请求布偶猫 review**
- 用 `cat-cafe-requesting-review` + `cross-cat-handoff` 发 review 信，包含 Red→Green 证据。

---

## DoD

1. `fetchers` 支持 `rss/api/webpage` 三种 method。
2. API 与 Webpage 抓取均可返回标准 `FetchResult`。
3. 新增测试覆盖关键 happy-path + error-path。
4. 本轮 build + 相关测试全绿，具备进入下个 S2 子任务（article-store）的条件。
