---
feature_ids: [F021]
topics: [signal, hunter, bootstrap]
doc_kind: plan
created: 2026-02-18
---

# F21 Signal Hunter S1+S2 Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 落地 F21 的基础骨架：完成 S1 基础设施（类型、schema、配置加载、目录初始化），并交付 S2 的首个可运行抓取器（RSS）与去重入口。

**Architecture:** 在 `packages/shared` 定义 Signal 领域类型与 Zod schema；在 `packages/api/src/domains/signals/` 建立分层目录（config/fetchers/services/storage）；配置文件采用 YAML，目录根默认 `~/.cat-cafe/signals`。抓取链路先实现 `RssFetcher + DeduplicationService`，后续 API/Webpage fetcher 与路由在下一批接入。

**Tech Stack:** TypeScript, Node test runner, Zod, YAML, rss-parser, Node fs/promises, crypto。

---

### Task 1: Shared Signals Types + Schemas（TDD）

**Files:**
- Create: `packages/shared/src/types/signals.ts`
- Create: `packages/shared/src/schemas/signals.schema.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Write failing test**
- Create: `packages/api/test/signals-shared-contract.test.js`
- 断言 `SignalArticle` / `SignalSource` schema 可解析合法输入并拒绝非法 tier/fetch method。

**Step 2: Run test to verify fails (Red)**
Run: `pnpm --filter @cat-cafe/shared run build && pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signals-shared-contract.test.js`
Expected: FAIL（模块或导出不存在）。

**Step 3: Write minimal implementation**
- 补齐 shared types + zod schema + index export。

**Step 4: Run test to verify passes (Green)**
执行同一命令，Expected: PASS。

---

### Task 2: Signals Workspace + Source Loader（TDD）

**Files:**
- Create: `packages/api/src/domains/signals/config/signal-paths.ts`
- Create: `packages/api/src/domains/signals/config/sources-loader.ts`
- Create: `packages/api/src/domains/signals/config/default-sources.ts`
- Create: `packages/api/test/signal-sources-loader.test.js`

**Step 1: Write failing test**
- 测试 `ensureSignalWorkspace()` 会创建 `config/library/inbox/logs`。
- 测试 `loadSignalSources()` 读取 YAML、校验 schema，空文件时回退默认 sources。

**Step 2: Run test to verify fails (Red)**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-sources-loader.test.js`
Expected: FAIL。

**Step 3: Write minimal implementation**
- 加载 YAML（`sources.yaml`）+ Zod 校验。
- 默认路径：`~/.cat-cafe/signals`，支持 `SIGNALS_ROOT_DIR` 覆盖。

**Step 4: Run test to verify passes (Green)**
执行同一命令，Expected: PASS。

---

### Task 3: Fetcher Contracts + RSS Fetcher（TDD）

**Files:**
- Create: `packages/api/src/domains/signals/fetchers/types.ts`
- Create: `packages/api/src/domains/signals/fetchers/rss-fetcher.ts`
- Create: `packages/api/src/domains/signals/fetchers/index.ts`
- Create: `packages/api/test/rss-fetcher.test.js`

**Step 1: Write failing test**
- `canHandle()` 对 `method=rss` 返回 true。
- `fetch()` 解析给定 RSS XML 返回标准 `RawArticle[]`。
- 非法 feed 抛错时返回 `errors` 而不是 throw。

**Step 2: Run test to verify fails (Red)**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/rss-fetcher.test.js`
Expected: FAIL。

**Step 3: Write minimal implementation**
- 封装 `rss-parser`，将 item 映射到 `RawArticle`。

**Step 4: Run test to verify passes (Green)**
执行同一命令，Expected: PASS。

---

### Task 4: URL Deduplication Service（TDD）

**Files:**
- Create: `packages/api/src/domains/signals/services/deduplication.ts`
- Create: `packages/api/test/signal-deduplication.test.js`

**Step 1: Write failing test**
- 同 URL（含尾部 `/`、UTM query）映射同一 `articleId`。
- 首次 seen 返回 `isNew=true`，重复返回 `isNew=false`。

**Step 2: Run test to verify fails (Red)**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-deduplication.test.js`
Expected: FAIL。

**Step 3: Write minimal implementation**
- URL 规范化 + SHA-256 截断生成 ID。
- 先内存集合实现（Redis 接口预留）。

**Step 4: Run test to verify passes (Green)**
执行同一命令，Expected: PASS。

---

### Task 5: Integration Verification + Commit

**Files:**
- Modify: `packages/api/package.json`（新增 `yaml`、`rss-parser`）
- Modify: `docs/BACKLOG.md`（记录 F21 S1/S2 bootstrap 进展）

**Step 1: Verification**
Run:
- `pnpm --filter @cat-cafe/shared run build`
- `pnpm --filter @cat-cafe/api run build`
- `node --test packages/api/test/signals-shared-contract.test.js packages/api/test/signal-sources-loader.test.js packages/api/test/rss-fetcher.test.js packages/api/test/signal-deduplication.test.js`

**Step 2: Commit**
```bash
git add <changed-files>
git commit -m "feat(signals): bootstrap S1 infra and RSS fetcher [缅因猫🐾]" -m "Why: establish typed signal foundation and first fetch pipeline before route integration."
```

**Step 3: Request local review**
- 按 `cat-cafe-requesting-review` 写 review 信给布偶猫，附测试证据。

---

## DoD

1. Shared 层已提供 Signal 类型与 schema，API 可直接复用。
2. `~/.cat-cafe/signals` 目录与 `sources.yaml` 加载链路可运行。
3. RSS 抓取器可解析 feed 并返回标准结构。
4. URL 去重服务可稳定输出 ID 并识别重复。
5. 定向测试全部通过，形成首个可 review 的 S1/S2 基线。
