## Review 请求: F21 S4 调度层（scheduler + CLI + launchd）

### 背景
F21 前三阶段已完成（S1/S2/S3）。本轮实现 S4，目标是让 signals 抓取链路可以脱离 API 进程独立定时运行，并具备手动触发、可观测日志与安装/卸载能力。

### 设计文档
- Plan (overall): `docs/plans/2026-02-12-signal-hunter-integration.md`
- Plan (this batch): `docs/plans/2026-02-19-f21-s4-scheduler-plan.md`

### Spec Compliance 自检

| # | S4 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|---|---|---|---|
| 1 | 抓取脚本可独立运行 | ✅ | `packages/api/src/scripts/fetch-signals.ts` + `packages/api/src/domains/signals/services/fetch-scheduler.ts` | `packages/api/test/signal-fetch-script.test.js`, `packages/api/test/signal-fetch-scheduler.test.js` |
| 2 | launchd plist 配置正确 | ✅ | `scripts/signal-fetcher-launchd.sh` (`print-plist`) | `packages/api/test/signal-fetcher-launchd-script.test.js` |
| 3 | 安装/卸载脚本 | ✅ | `scripts/install-signal-fetcher.sh`, `scripts/uninstall-signal-fetcher.sh` | `packages/api/test/signal-fetcher-launchd-script.test.js` |
| 4 | 日志记录完善 | ✅ | `scripts/signal-fetcher-launchd.sh` (`StandardOutPath/StandardErrorPath`, summary log) + `fetch-scheduler` in-app log sink | `packages/api/test/signal-fetcher-launchd-script.test.js` |
| 5 | 手动触发支持（dry-run/source/help） | ✅ | `packages/api/src/scripts/fetch-signals.ts`, `packages/api/package.json` (`fetch-signals`) | `packages/api/test/signal-fetch-script.test.js` |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/api/src/domains/signals/services/fetch-scheduler.ts` | 新增 | 串联 sources/fetchers/dedup/store/notification 的调度 runner |
| `packages/api/src/scripts/fetch-signals.ts` | 新增 | CLI 参数解析 + 执行入口 + summary 输出 |
| `scripts/signal-fetcher-launchd.sh` | 新增 | launchd install/run/status/uninstall/print-plist |
| `scripts/install-signal-fetcher.sh` | 新增 | install wrapper |
| `scripts/uninstall-signal-fetcher.sh` | 新增 | uninstall wrapper |
| `packages/api/test/signal-fetch-scheduler.test.js` | 新增 | runner 行为测试（normal/dry-run/source filter） |
| `packages/api/test/signal-fetch-script.test.js` | 新增 | CLI 参数/summary 测试（含 pnpm `--` 兼容） |
| `packages/api/test/signal-fetcher-launchd-script.test.js` | 新增 | plist 输出与 wrapper 可执行性测试 |
| `packages/api/src/domains/signals/services/index.ts` | 修改 | 导出 `runSignalFetchScheduler` |
| `packages/api/package.json` | 修改 | 新增 `fetch-signals` script |
| `docs/plans/2026-02-19-f21-s4-scheduler-plan.md` | 新增 | S4 实施计划 |
| `docs/BACKLOG.md` | 修改 | F21 进展更新到 S4 完成 |

### Git SHA
- Base: `269c7d4`
- Head: `400879b`

### 测试状态

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

结果：`53 passed, 0 failed`。

### Review 重点
1. `fetch-scheduler` 的依赖注入边界是否清晰（避免提前耦合 S5 路由层）。
2. dedup seed（从 inbox 快照读取 URL）是否足够稳妥。
3. launchd 脚本（尤其 schedule 解析和 run 路径）是否满足线上可操作性。

### 五件套

**What**: 实现 S4 调度层（scheduler runner + CLI + launchd install/uninstall），补齐对应测试。  
**Why**: 让 Signal Hunter 可以系统级定时运行，不依赖 API 常驻进程。  
**Tradeoff**: in-app digest 默认写入 `signals-in-app.log`（文件 sink），没有在 S4 直接接 MessageStore；优先保证离线可运行与可观测，S5 再接 API/MCP。  
**Open Questions**: S5 阶段是否将 in-app sink 改为真正线程消息写入（thread=`signals`）并补全读写 API。  
**Next Action**: 请按上面 review 重点进行 R6 审查；如有 P1/P2 我会当轮修完。
