# F21 Cloud Review Round 2 Bug Report (3xP1 + 1xP2)

## 1. 报告人

- 报告来源: Cloud Codex PR review (`chatgpt-codex-connector`)
- 触发方式: PR #30 在 commit `9e0c3c37f1ffe4ab4914d03ba785ba2bf3c1957b` 上执行 `@codex review`
- 审核时间: 2026-02-19

## 2. 复现步骤（期望 vs 实际）

### P1-A: fetch-signals CLI 在有 source errors 时仍返回 0

- 位置: `packages/api/src/scripts/fetch-signals.ts`
- 复现: scheduler summary 带 `errors.length > 0` 时执行 `runFetchSignalsCli`
- 实际: 记录 error 日志后仍返回 `0`
- 期望: 返回非 0（至少 `1`），让 launchd/cron/CI 感知失败

### P1-B: 调度器在 source fetch 失败时仍发送 digest

- 位置: `packages/api/src/domains/signals/services/fetch-scheduler.ts`
- 复现: `processSources()` 返回 error，且 `dryRun=false`、有 selected sources
- 实际: 仍执行 `sendDigestNotifications()`，可能发送“no new signals”误导通知
- 期望: 当本轮存在 fetch errors 时跳过 digest 发送

### P1-C: article by-url 查询未做 URL 归一化

- 位置: `packages/api/src/domains/signals/services/article-query-service.ts`
- 复现: 存储 URL 与查询 URL 仅在归一化层面不同（如 query param 顺序、tracking params、trailing slash）
- 实际: `record.url === normalizedInput` 直接字符串比较，可能返回 404
- 期望: 使用与去重一致的 URL 归一化规则比较

### P2: 日期过滤参数无效时触发 NaN 比较导致“全过滤”

- 位置: `packages/api/src/domains/signals/services/article-query-service.ts`
- 复现: `/api/signals/search` 传 `dateFrom` 或 `dateTo` 为无效日期字符串
- 实际: `Date.parse` 产出 `NaN`，比较恒为 false，结果被静默过滤为 0
- 期望: 无效日期边界不应导致全量误过滤（可忽略无效边界或返回 400）

## 3. 根因分析

### P1-A 根因

`runFetchSignalsCli` 将 `summary.errors` 仅作为日志输出，没有进入 exit code 决策。控制流缺少“部分失败=非零退出”的状态映射。

### P1-B 根因

`runSignalFetchScheduler` 的通知发送门控条件仅检查 `dryRun` 和 `selectedSources.length`，漏掉 `sourceResults.errors.length`，导致“抓取失败”路径被误判为“正常可发 digest”。

### P1-C 根因

`getArticleByUrl` 使用原始字符串等值比较，未复用 `DeduplicationService` 的 `normalizeArticleUrl` 规则，查询语义与入库/去重语义不一致。

### P2 根因

`withinDateRange` 直接使用 `Date.parse(from/to)` 参与比较，未对 `NaN` 做边界归一化处理，导致无效输入变成不可满足条件。

## 4. 修复方案

1. `fetch-signals.ts`
- 增加显式 exit-code 计算函数（`summary.errors.length > 0 => 1`）
- `runFetchSignalsCli` 基于该函数返回退出码
- 增加 CLI 回归测试覆盖

2. `fetch-scheduler.ts`
- 增加通知门控: 当 `sourceResults.errors.length > 0` 时不发送 digest
- 保持 summary 中错误信息不变，仅调整 `notifications` 行为
- 增加 scheduler 回归测试

3. `article-query-service.ts`（by-url）
- 查询入参和记录 URL 均使用 `normalizeArticleUrl` 后比较
- 保持空字符串返回 `null` 的现有行为
- 增加 route/service 级回归测试

4. `article-query-service.ts`（date range）
- 提供安全日期边界解析：无效 `from/to` 回退到 `±Infinity`
- 防止无效输入导致全量误过滤
- 增加回归测试验证“无效边界不会误杀结果”

## 5. 验证方式

- Red→Green 测试策略：先新增失败用例，确认红灯，再改实现转绿
- 目标测试集：
  - `packages/api/test/signal-fetch-script.test.js`
  - `packages/api/test/signal-fetch-scheduler.test.js`
  - `packages/api/test/signals-route.test.js`
- 回归验证：
  - `pnpm --filter @cat-cafe/api test -- signal-fetch-script.test.js signal-fetch-scheduler.test.js signals-route.test.js`
  - `pnpm --filter @cat-cafe/api test`
