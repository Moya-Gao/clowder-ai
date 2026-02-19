# F21 Cloud Review Round4 Bug Report（P1 x2）

## 1) 报告人

- 报告来源：Cloud Codex review（PR #30, reviewed commit `5921fe7`）
- 同步人：铲屎官（“review 了两个问题 且和 main 有冲突，你记得 fetch rebase”）

## 2) 复现步骤（期望 vs 实际）

### P1-A: 自动调度未按 `schedule.frequency` 过滤

- 位置：`packages/api/src/domains/signals/services/source-processor.ts`（`selectSources`）
- 复现方式：
  1. 配置 4 个 enabled source：`daily` / `hourly` / `weekly` / `manual`
  2. 调用 `runSignalFetchScheduler({ sourceId: undefined })`
- 期望：
  - `manual` 不参与自动调度
  - `weekly` 仅在“到期日”参与（本轮采用固定周一）
- 实际：
  - 仅排除 `manual`，其余频率都被选中，`weekly` 每天都跑

### P1-B: legacy 多 feed source 的 alias 被最后一个 feed 覆盖

- 位置：`packages/api/src/scripts/migrate-signals/source-migration.ts`（`parseLegacySources`）
- 复现方式：
  1. legacy `sources.yaml` 中同一 source 带多个 feed
  2. 运行 `parseLegacySources`
- 期望：
  - 对多 feed source，不应把通用 alias（`legacySourceId`/`baseName`）硬映射到某一个 feed ID
- 实际：
  - 循环中重复 `aliasToId.set(...)`，最后一次写入覆盖前值，通用 alias 固定指向最后一个 feed

## 3) 根因分析

### P1-A 根因

- `selectSources(config, sourceId)` 的自动路径只做了：
  - `source.enabled === true`
  - `source.schedule.frequency !== 'manual'`
- 没有“是否到期”判断，`weekly` 频率语义失效。

### P1-B 根因

- `parseLegacySources` 在 `feeds.forEach(...)` 内总是执行：
  - `aliasToId.set(slugify(legacySourceId), sourceId)`
  - `aliasToId.set(slugify(baseName), sourceId)`
- 多 feed 情况下这是同 key 多次覆盖，导致 alias 与 feed 列表顺序耦合。

## 4) 修复方案（含 tradeoff）

### P1-A 修复

- 在 `source-processor` 增加“到期判断”：
  - `hourly`/`daily`：视为到期（true）
  - `weekly`：仅周一到期（UTC 周一）
  - `manual`：自动调度始终 false
- `selectSources` 支持传入 `now`，由 `fetch-scheduler` 传入同一时间点，保证一次运行的判定一致。

Tradeoff:
- 当前配置没有“每周具体日期/时区”字段，本轮以“UTC 周一”为确定性默认，先消除“每天都跑”的错误；后续如需可扩展配置。

### P1-B 修复

- 仅当 source 为单 feed 时写入通用 alias（`legacySourceId` / `baseName`）。
- 多 feed 时改为只写“带 feedName 的 alias”（例如 `legacySourceId-feedName` / `baseName-feedName`），避免把通用 alias错误绑定到某个 feed。

Tradeoff:
- 多 feed 且文章仅提供通用 label 时，可能无法直接命中具体 feed（后续由 fallback 兜底），但这优于“确定性误绑定到最后一个 feed”。

## 5) 验证方式

- Red→Green 新增/修改测试：
  - `packages/api/test/signal-fetch-scheduler.test.js`
    - 新增“自动调度按 frequency 过滤（含 weekly）”用例
  - `packages/api/test/signal-source-migration.test.js`
    - 新增“多 feed 不覆盖通用 alias”用例
- 回归命令（修复后）：
  - `pnpm --filter @cat-cafe/api exec node --test test/signal-fetch-scheduler.test.js test/signal-source-migration.test.js`
  - `pnpm --filter @cat-cafe/api exec node --test 'test/signal-*.test.js'`
  - `pnpm --filter @cat-cafe/shared build`
  - `pnpm --filter @cat-cafe/api build`
  - 说明：`pnpm --filter @cat-cafe/api test` 在当前会话受 Redis 隔离环境变量约束（`CAT_CAFE_REDIS_TEST_ISOLATED`）会触发与本改动无关的失败，本轮以 signals 测试集 + build 作为验收基线。
