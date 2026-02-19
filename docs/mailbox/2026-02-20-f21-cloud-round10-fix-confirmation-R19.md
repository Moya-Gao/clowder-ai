# R19 确认: Cloud Round10 修复 (1×P1 + 1×P2) — 全部通过

## Review 结论

**0 P1 / 0 P2 / 0 P3 — 放行 ✅**

## 逐项审查

### P1: 通知失败未影响 CLI exit code（假成功）

| 项目 | 结果 |
|------|------|
| 修复文件 | `packages/api/src/scripts/fetch-signals.ts` L68-91, L130-138 |
| 根因 | `toFetchSignalsExitCode` 只看 `summary.errors.length`（源抓取错误），不检查 notification status → 通知失败时 exit 0 → cron 假成功 |
| 修复方式 | `toFetchSignalsExitCode` 新增 `hasNotificationError`：`notifications?.email.status === 'error' \|\| notifications?.inApp.status === 'error'` → exit 1 |
| 可观测性 | `formatFetchSignalsSummary` 追加 `notificationErrors=N`；CLI 输出 `EMAIL_NOTIFY_FAILED` / `IN_APP_NOTIFY_FAILED` 结构化日志（L130-136） |
| 空值安全 | `?.` 安全处理 dry-run 时 `notifications` 为 undefined 的情况 |
| 测试覆盖 | `signal-fetch-script.test.js` 新增 "returns non-zero when notifications contain error status"：`errors=[]` + `email.status='error'` → 断言 exit=1 |
| 判定 | ✅ 通过 |

### P2: source toggle 并发 read-modify-write 覆盖

| 项目 | 结果 |
|------|------|
| 修复文件 | `packages/api/src/routes/signals.ts` L43-56, L214-242 |
| 根因 | `PATCH /sources/:id` 做 load→find→map→save，两个并发请求各自 load 同一快照、各改一字段、先后 save，后写覆盖前写 |
| 修复方式 | 新增 `SerialTaskQueue` 类：进程内串行队列，`run()` 将 task 链到 `tail` promise，保证同一时刻只有一个 read-modify-write 在执行 |
| 队列设计 | `then(task, task)` — 前一个无论 resolve/reject 都继续下一个；`tail` 重置为 always-resolve 避免 unhandled rejection。正确的 fire-and-forget 链式设计 |
| 模块级单例 | `signalSourcesUpdateQueue` 模块级变量，同进程共享。对单进程 Fastify 部署足够 |
| 路由集成 | 整个 load→find→map→save 包入 `signalSourcesUpdateQueue.run()` 中，原子化（对同进程并发） |
| Tradeoff | 进程内串行队列是最小闭环修复，多进程扩展时需升级为 versioned optimistic concurrency (ETag)。当前阶段正确选择 |
| 测试覆盖 | `signals-route.test.js` 新增 "preserves both updates under concurrent toggles"：`Promise.all` 并发 PATCH 两个 source → 断言两个都变 false |
| 判定 | ✅ 通过 |

## 构建 & 测试

```bash
# Build
pnpm --filter @cat-cafe/shared build  # ✅ clean
pnpm --filter @cat-cafe/api build     # ✅ clean

# Signal tests regression (7 suites, 12 sub-suites)
node --test test/signal-fetch-script.test.js \
  test/signals-route.test.js \
  test/signal-source-processor.test.js \
  test/signal-fetch-scheduler.test.js \
  test/signal-migrate-script.test.js \
  test/signal-source-migration.test.js \
  test/signals-shared-contract.test.js
# 45 passed, 0 failed ✅
```

## Git SHA

- Base: `b412413` (R18 confirmation)
- Head: `2395876` (R19 fix)

## 下一步

砚砚可以 push + 触发下一轮云端 review（只一次）。

---
*R19 by 布偶猫🐾 — 2026-02-20*
