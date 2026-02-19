# F21 S4 Scheduler Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 F21 落地可独立运行的定时抓取调度层（手动执行 + launchd 安装/卸载 + 通知触发）。

**Architecture:** 在 `domains/signals` 新增一个纯服务化 runner，串联 `sources-loader`、三类 fetcher、`DeduplicationService`、`ArticleStoreService`、S3 通知服务。CLI 入口只负责参数解析和日志输出；macOS launchd 通过独立 bash 脚本管理 plist 生命周期。

**Tech Stack:** TypeScript, Node test runner, Bash (launchctl), YAML config (`sources.yaml`, `notifications.yaml`)。

---

### Task 1: Scheduler Runner（TDD）

**Files:**
- Create: `packages/api/src/domains/signals/services/fetch-scheduler.ts`
- Create: `packages/api/test/signal-fetch-scheduler.test.js`
- Modify: `packages/api/src/domains/signals/services/index.ts`

**Step 1: 写失败测试（最小行为）**
- `runSignalFetchScheduler` 在默认模式下：
  - 只处理 `enabled=true` 且 `frequency!==manual` 的 source
  - 每个 source 按 fetch.method 路由到对应 fetcher
  - 对重复 URL 去重，不重复入库
  - 非 dry-run 时触发 email + in-app digest
- `--dry-run` 模式：不写 article store，不发通知，但返回预览统计。
- `--source` 过滤：仅处理指定 source，未知 source 抛出明确错误。

**Step 2: 跑红灯**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-fetch-scheduler.test.js`
Expected: FAIL（模块不存在 / 导出缺失）。

**Step 3: 最小实现**
- 新增 runner：`runSignalFetchScheduler(options)`。
- 默认依赖注入：`RssFetcher/ApiFetcher/WebpageFetcher`、`ArticleStoreService`、`SignalEmailService`、`SignalInAppNotificationService`。
- 从现有 inbox 快照读取历史 URL 作为 dedup seed。
- 输出结构化 summary（sources/articles/errors/notifications）。

**Step 4: 跑绿灯**
执行同命令，Expected: PASS。

**Step 5: 导出更新**
- `services/index.ts` 导出新 runner 类型与函数。

---

### Task 2: CLI 入口（TDD）

**Files:**
- Create: `packages/api/src/scripts/fetch-signals.ts`
- Create: `packages/api/test/signal-fetch-script.test.js`
- Modify: `packages/api/package.json`

**Step 1: 写失败测试**
- 参数解析：`--dry-run`、`--source <id>`、`--help`。
- `--help` 打印 usage 并返回 0。
- 执行完成时打印 summary 行（processed/new/errors）。

**Step 2: 跑红灯**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-fetch-script.test.js`
Expected: FAIL。

**Step 3: 最小实现**
- 脚本调用 `runSignalFetchScheduler`。
- 解析 CLI 参数并映射到 runner options。
- 非零错误路径（参数缺失、未知参数）设置 `process.exitCode = 1`。
- `package.json` 添加 `fetch-signals` script：`node dist/scripts/fetch-signals.js`。

**Step 4: 跑绿灯**
执行同命令，Expected: PASS。

---

### Task 3: launchd 安装/卸载脚本（TDD）

**Files:**
- Create: `scripts/install-signal-fetcher.sh`
- Create: `scripts/uninstall-signal-fetcher.sh`
- Create: `scripts/signal-fetcher-launchd.sh`
- Create: `packages/api/test/signal-fetcher-launchd-script.test.js`

**Step 1: 写失败测试**
- `signal-fetcher-launchd.sh print-plist` 输出包含：
  - `Label=com.cat-cafe.signal-fetcher`
  - ProgramArguments 指向 `scripts/signal-fetcher-launchd.sh run`
  - stdout/stderr 路径位于 `~/.cat-cafe/signals/logs`
- wrapper 脚本存在且可执行，分别转发到 `install`/`uninstall`。

**Step 2: 跑红灯**
Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-fetcher-launchd-script.test.js`
Expected: FAIL。

**Step 3: 最小实现**
- `signal-fetcher-launchd.sh` 支持 `install|run|status|uninstall|print-plist`。
- install: 生成 plist -> bootstrap -> enable -> kickstart。
- run: 执行 `pnpm --filter @cat-cafe/api run fetch-signals`。
- uninstall: bootout + 删除 plist。
- wrappers: `install-signal-fetcher.sh` / `uninstall-signal-fetcher.sh`。

**Step 4: 跑绿灯**
执行同命令，Expected: PASS。

---

### Task 4: Spec 对齐与回归验证

**Files:**
- Modify: `docs/BACKLOG.md`（更新 F21 进展到 S4）
- Create: `docs/mailbox/2026-02-19-f21-s4-review-request.md`（提审前准备）

**Step 1: 回归命令（fresh run）**
Run:
- `pnpm --filter @cat-cafe/shared run build`
- `pnpm --filter @cat-cafe/api run build`
- `node --test packages/api/test/signal-fetch-scheduler.test.js packages/api/test/signal-fetch-script.test.js packages/api/test/signal-fetcher-launchd-script.test.js packages/api/test/rss-fetcher.test.js packages/api/test/api-fetcher.test.js packages/api/test/webpage-fetcher.test.js packages/api/test/signal-deduplication.test.js packages/api/test/signal-sources-loader.test.js packages/api/test/signal-article-store.test.js packages/api/test/signal-notifications-loader.test.js packages/api/test/signal-daily-digest-template.test.js packages/api/test/signal-email-service.test.js packages/api/test/signal-in-app-notification.test.js packages/api/test/signals-shared-contract.test.js`

Expected: PASS。

**Step 2: Spec compliance checklist**
- 对照 `docs/plans/2026-02-12-signal-hunter-integration.md` S4 验收条目逐项打勾。

**Step 3: Commit**
```bash
git add docs/plans/2026-02-19-f21-s4-scheduler-plan.md \
  packages/api/src/domains/signals/services/fetch-scheduler.ts \
  packages/api/src/domains/signals/services/index.ts \
  packages/api/src/scripts/fetch-signals.ts \
  packages/api/test/signal-fetch-scheduler.test.js \
  packages/api/test/signal-fetch-script.test.js \
  scripts/signal-fetcher-launchd.sh scripts/install-signal-fetcher.sh scripts/uninstall-signal-fetcher.sh \
  packages/api/test/signal-fetcher-launchd-script.test.js \
  packages/api/package.json docs/BACKLOG.md

git commit -m "feat(signals): add s4 scheduler and launchd scripts [缅因猫🐾]" \
  -m "Why: make signal fetching runnable by cron/launchd with deterministic logging and notification wiring."
```

---

## DoD

1. `fetch-signals` 脚本支持 `--dry-run` 与 `--source`。
2. scheduler 能串联 fetch + dedup + store + notifications。
3. launchd 安装/卸载脚本可生成并管理 `com.cat-cafe.signal-fetcher`。
4. S4 新增测试与 signals 回归测试全绿。
