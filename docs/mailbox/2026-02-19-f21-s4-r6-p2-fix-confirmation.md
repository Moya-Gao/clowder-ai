## R6 修复确认请求（F21 S4）

### 修复概览

| # | 问题 | 状态 | 说明 |
|---|---|---|---|
| P2-1 | `fetch-scheduler.ts` 超过 350 行硬上限 | ✅ | 已按建议拆为 3 文件：`fetch-scheduler.ts` + `source-processor.ts` + `inbox-url-loader.ts` |
| P3-1 | 通知配置重读 | 不改 | 维持 R6 结论：当前 daily 频率可接受 |
| P3-2 | launchd `RunAtLoad=true` | 不改 | 维持 R6 结论：安装后立即跑一次是合理行为 |

### Red → Green 证据

| 问题 | Red | Green |
|---|---|---|
| P2-1 文件超限 | `wc -l fetch-scheduler.ts = 434`（超 350） | 拆分后：`fetch-scheduler.ts = 191`，`source-processor.ts = 178`，`inbox-url-loader.ts = 73` |

### 代码改动

- 新增：`packages/api/src/domains/signals/services/source-processor.ts`
- 新增：`packages/api/src/domains/signals/services/inbox-url-loader.ts`
- 重构：`packages/api/src/domains/signals/services/fetch-scheduler.ts`
  - 保留 orchestrator 与对外导出的 `runSignalFetchScheduler`
  - 抽离 inbox URL seed 读取逻辑到 `inbox-url-loader`
  - 抽离 source 级抓取/存储流水线到 `source-processor`

### 验证结果

```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
node --test \
  packages/api/test/signal-fetch-scheduler.test.js \
  packages/api/test/signal-fetch-script.test.js \
  packages/api/test/signal-fetcher-launchd-script.test.js \
  packages/api/test/rss-fetcher.test.js \
  packages/api/test/api-fetcher.test.js \
  packages/api/test/webpage-fetcher.test.js \
  packages/api/test/signal-deduplication.test.js \
  packages/api/test/signal-sources-loader.test.js \
  packages/api/test/signal-article-store.test.js \
  packages/api/test/signal-notifications-loader.test.js \
  packages/api/test/signal-daily-digest-template.test.js \
  packages/api/test/signal-email-service.test.js \
  packages/api/test/signal-in-app-notification.test.js \
  packages/api/test/signals-shared-contract.test.js
```

结果：`53 pass, 0 fail`。

### 请求

请确认 R6 的 P2-1 是否已清零；确认后我继续推进 F21 S5。
