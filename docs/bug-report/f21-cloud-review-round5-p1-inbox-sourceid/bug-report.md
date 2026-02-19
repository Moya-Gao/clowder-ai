# F21 Cloud Review Round5 Bug Report（P1 x2）

## 1) 报告人

- 报告来源：Cloud Codex review（PR #30, reviewed commit `a984195`）
- 同步人：铲屎官（“喜提 2p1”）

## 2) 复现步骤（期望 vs 实际）

### P1-A：单条坏文章文件导致 inbox/search/stats 整体 500

- 位置：`packages/api/src/domains/signals/services/article-query-service.ts`
- 复现方式：
  1. 先写入多条 signals 文章
  2. 手动删除其中一个 markdown 文件（或制造 frontmatter 无法解析）
  3. 调 `GET /api/signals/inbox` / `GET /api/signals/search` / `GET /api/signals/stats`
- 期望：
  - 坏文件被隔离并跳过，接口返回剩余可用数据
- 实际：
  - `Promise.all(records.map(readArticleDocument))` 任一 reject 会导致整批 reject，接口 500

### P1-B：source id 无安全约束，可构造路径穿越写入

- 位置：`packages/shared/src/schemas/signals.schema.ts` (`SignalSourceSchema.id`)
- 复现方式：
  1. source 配置使用 `id: "../outside"` 或 `id: "signals/news"`
  2. 后续 `ArticleStoreService.store` 使用 `join(paths.libraryDir, source.id)` 生成目录
- 期望：
  - schema 层拒绝不安全 source id
- 实际：
  - 仅 `min(1)`，未限制路径相关字符

## 3) 根因分析

### P1-A 根因
- 批量读取使用 `Promise.all`，缺少 per-record 容错隔离；
- signals 查询链路（inbox/search/stats）都复用了该模式。

### P1-B 根因
- shared schema 没有对 `id` 建立“安全 slug”约束；
- 下游路径拼接使用 `source.id`，形成潜在目录逃逸面。

## 4) 修复方案（含 tradeoff）

### P1-A 修复
- 新增 `readArticleDetailsSafely(records)`：`Promise.allSettled + fulfilled 过滤`；
- `listInbox/search/getStats` 全部改为走容错读取。

Tradeoff:
- 选择“跳过坏记录”优先保证服务可用性；
- 当前不额外上报坏记录计数（避免接口破坏变更），后续可扩展 observability。

### P1-B 修复
- `SignalSourceSchema.id` 改为 regex 校验：
  - 允许：字母/数字/`_`/`-`
  - 禁止：`/`、`\\`、`.` 等路径穿越相关字符

Tradeoff:
- 这会拒绝历史上非常规 ID（若有）；
- 但这是“配置入库前 fail-fast”的安全边界，优先级高于兼容宽松输入。

## 5) 验证方式

- Red→Green 用例：
  - `packages/api/test/signals-route.test.js`
    - 新增：`skips malformed article files instead of failing inbox/search/stats`
  - `packages/api/test/signals-shared-contract.test.js`
    - 新增：`rejects unsafe source ids with path traversal characters`

- 回归命令：
  - `pnpm --filter @cat-cafe/shared build`
  - `pnpm --filter @cat-cafe/api build`
  - `pnpm --filter @cat-cafe/api exec node --test test/signals-route.test.js test/signals-shared-contract.test.js`
  - `pnpm --filter @cat-cafe/api exec node --test 'test/signal-*.test.js'`
