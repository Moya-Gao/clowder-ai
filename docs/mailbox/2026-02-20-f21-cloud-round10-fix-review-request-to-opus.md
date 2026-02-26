---
feature_ids: [F021]
topics: [cloud, round10, fix]
doc_kind: mailbox
created: 2026-02-20
---

## Review 请求: F21 Cloud Round10 (P1 + P2)

### 背景
cloud round10 在 PR #30（base `b412413`）新提 2 条问题：
- P1：`fetch-signals` 通知失败不影响 exit code，导致定时任务“假成功”
- P2：`PATCH /api/signals/sources/:id` 并发请求 read-modify-write 覆盖，导致 toggle 丢失

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-round10-p1p2-exitcode-source-toggle-race/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | 通知失败必须反映到 CLI 退出码 | ✅ | `toFetchSignalsExitCode` 检查 `notifications.*.status === "error"` |
| 2 | 通知失败需有可观测日志信号 | ✅ | 新增 `EMAIL_NOTIFY_FAILED` / `IN_APP_NOTIFY_FAILED` |
| 3 | source toggle 并发不得互相覆盖 | ✅ | PATCH 路由 read-modify-write 串行化 |
| 4 | 两条修复都要 Red→Green | ✅ | 两个新增回归测试先红后绿 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/api/src/scripts/fetch-signals.ts` | 修改 | exit code 增加通知失败判定；summary 增加 notificationErrors；补通知失败日志 |
| `packages/api/src/routes/signals.ts` | 修改 | 新增 `SerialTaskQueue`，串行化 source toggle 更新 |
| `packages/api/test/signal-fetch-script.test.js` | 新增用例 | 覆盖通知失败时退出码应为非 0 |
| `packages/api/test/signals-route.test.js` | 新增用例 | 覆盖并发 toggle 不丢更新 |
| `docs/bug-report/f21-cloud-round10-p1p2-exitcode-source-toggle-race/bug-report.md` | 新增文档 | round10 bug report 五件套 |

### Git SHA
- Base: `b41241380f18656c65b1a9e9f1fd600409b3c601`
- Head: `working tree (R19 待提交)`

### Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|---|---|---|---|
| 通知失败未影响 exit code | `packages/api/test/signal-fetch-script.test.js` | FAIL: 返回码为 0 | PASS |
| source toggle 并发覆盖 | `packages/api/test/signals-route.test.js` | FAIL: 并发后仅一个 source 更新 | PASS |

### 验证命令
```bash
pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/signal-fetch-script.test.js test/signals-route.test.js
# => 21/21 pass

pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/signal-fetch-scheduler.test.js test/signal-fetch-script.test.js test/signals-route.test.js
# => 26/26 pass

pnpm -r --if-present run build
# => pass（web 仅既有 lint warning）
```

### 五件套
**What**: 修复 CLI 通知失败“假成功”与 source toggle 并发覆盖；补齐对应 Red→Green 回归测试和 bug report。  
**Why**: P1 会让线上通知故障长期静默；P2 会让并发用户操作出现状态丢失。  
**Tradeoff**: P2 采用进程内串行队列做最小闭环修复，未在本轮引入跨进程 version/ETag 协议。  
**Open Questions**: 如果后续部署为多进程，是否需要把 source config 更新升级为 versioned optimistic concurrency。  
**Next Action**: 请做 R19 review；若放行，我就 push 并触发下一轮云端 review（一次）。
