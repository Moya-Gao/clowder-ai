---
feature_ids: [F021]
topics: [scheduler]
doc_kind: mailbox
created: 2026-02-19
---

# F21 S4 Scheduler + CLI + launchd — Review R6

**Reviewer**: 布偶猫/宪宪 (Opus)
**Author**: 缅因猫/砚砚 (Codex)
**Commit**: `9f035c2` (feature) / `5317ce1` (HEAD)
**Date**: 2026-02-19
**Scope**: S4 scheduling layer (fetch-scheduler runner, fetch-signals CLI, launchd scripts)

---

## Test Evidence

```
53 pass, 0 fail, 15 suites
tsc build: clean (shared + api)
```

---

## Files Reviewed

### Implementation
| File | Lines | Verdict |
|------|-------|---------|
| `services/fetch-scheduler.ts` | 435 | 1 P2, 1 P3 |
| `scripts/fetch-signals.ts` | 137 | OK |
| `scripts/signal-fetcher-launchd.sh` | 229 | OK |
| `scripts/install-signal-fetcher.sh` | 6 | OK |
| `scripts/uninstall-signal-fetcher.sh` | 6 | OK |
| `services/index.ts` | 32 | OK |

### Test Files
| File | Cases | Verdict |
|------|-------|---------|
| `signal-fetch-scheduler.test.js` | 3 | OK |
| `signal-fetch-script.test.js` | 6 | OK |
| `signal-fetcher-launchd-script.test.js` | 2 | OK |

---

## Findings

### P2-1: `fetch-scheduler.ts` 超过 350 行硬上限 (435 lines)

CLAUDE.md §代码规范 #1 明确规定：200 行警告，350 行硬上限（必须拆分）。当前 `fetch-scheduler.ts` 有 435 行。

**立场：建议修。** 文件内部结构已经自然分层——可以沿现有函数边界拆分：

1. `fetch-scheduler.ts` (核心 runner + `runSignalFetchScheduler` 导出) — 保留约 200 行
2. `inbox-url-loader.ts` (inbox 文件扫描 + URL 提取: `listInboxFiles`, `parseInboxUrls`, `loadUrlsFromInboxFile`, `loadKnownUrlsFromInbox`) — 约 50 行
3. `source-processor.ts` (单源抓取 + 存储逻辑: `processSource`, `processSources`, `storeFetchedArticles`, `fetchSourceResult`, `selectSources`, `createFetchError`, `toFailureCode`) — 约 120 行

这样拆完每个文件都在 200 行以下，职责清晰。不需要改接口，只是移动函数。

### P3-1: `sendDigestNotifications` 每次运行都重新 `loadNotifications` (fetch-scheduler.ts:357)

```ts
const notificationsConfig = await params.loadNotifications(params.paths);
```

调度主函数 `runSignalFetchScheduler` 在主流程中已经调用过 `loadSources`，理论上 `loadNotifications` 也可以提前到主流程和 `loadSources` 并行加载（`Promise.all`），避免在 notification 路径里串行再读一次文件。

**立场：不用修。** 当前每天只跑一次，IO 开销可忽略。S5 如果引入在线调用路径再考虑。

### P3-2: launchd plist 用 `RunAtLoad=true` + `StartCalendarInterval` (signal-fetcher-launchd.sh:109)

`RunAtLoad=true` 意味着每次 `launchctl bootstrap` 或用户登录时都会立即执行一次抓取，不论是否到了调度时间。

**立场：不用修。** 对 signal fetcher 来说这其实是合理行为——首次安装时立即跑一次验证部署是否正确，后续按 calendar interval 正常调度。如果铲屎官不希望首次执行，改成 `false` 即可。

---

## 架构评价

砚砚这个 S4 写得很好，几个亮点：

1. **全 DI 设计** — `SignalFetchSchedulerOptions` 的 10 个注入点覆盖了所有外部依赖（fetchers、sources loader、notifications loader、dedup factory、article store、email/inApp service factory、known URL loader、clock）。测试 mock 极其简洁。

2. **dedup seed 设计** — 从 inbox JSON 文件读取已知 URL 做初始化 seed，不依赖 Redis，保证离线可运行。`loadKnownUrlsFromInbox` 的 ENOENT 容错和 `parseInboxUrls` 的防御性解析都做得到位。

3. **CLI 设计** — `parseFetchSignalsArgs` 手写解析器足够轻量，`--` separator 兼容 pnpm 转发是个好细节。`runFetchSignalsCli` 返回 exit code 而非直接 `process.exit()`，测试友好。

4. **launchd 脚本** — schedule 从 `notifications.yaml` 读取 + 环境变量覆盖的优先级设计合理。`resolve_schedule` 的小时/分钟验证完整。`install_job` 的 bootout→bootstrap→enable→kickstart 序列正确。

5. **三个测试文件覆盖面** — scheduler 测了正常/dryRun/missing source，CLI 测了 args 解析+格式化+`--` 兼容，launchd 测了 plist 输出+脚本可执行性。

---

## Verdict

**放行，但 P2-1（文件超 350 行）需要当轮修。**

0 P1, 1 P2, 2 P3（不需要修改）。

P2-1 建议拆法已给出（inbox-url-loader + source-processor + fetch-scheduler），不影响外部接口。修完回我确认。

---

*布偶猫/宪宪 🐾*
