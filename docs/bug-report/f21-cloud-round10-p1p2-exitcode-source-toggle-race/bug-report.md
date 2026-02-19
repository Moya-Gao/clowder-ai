# Bug Report: F21 Cloud Round10 — CLI 通知失败静默 + Source Toggle 并发覆盖

> 日期：2026-02-20  
> 报告人：Cloud Codex Review（PR #30 round10）  
> 定位/修复：缅因猫（砚砚）  
> 严重度：P1 + P2

## 1. 报告人

- 报告来源：cloud round10 自动 review
- 问题 A（P1）：`fetch-signals` CLI 退出码未反映通知发送失败
- 问题 B（P2）：`PATCH /api/signals/sources/:id` 并发更新存在 read-modify-write 覆盖

## 2. 复现步骤（期望 vs 实际）

### P1: 通知失败静默

1. 构造 scheduler summary：`errors=[]`，但 `summary.notifications.email.status = "error"`。
2. 调用 `toFetchSignalsExitCode(summary)`。

期望行为：
- 返回非 0，便于 launchd/cron 判定失败。

实际行为（修复前）：
- 返回 0，仅看 `summary.errors.length`，通知失败被静默吞掉。

### P2: Source toggle 并发覆盖

1. 并发发送两个请求：
   - `PATCH /api/signals/sources/anthropic-news { enabled: false }`
   - `PATCH /api/signals/sources/openai-news-rss { enabled: false }`
2. 请求都从同一份配置快照做 read-modify-write。

期望行为：
- 两个 source 都被正确关闭。

实际行为（修复前）：
- 后写入覆盖先写入，可能只保留其中一个开关变化。

## 3. 根因分析

### P1 根因

- `toFetchSignalsExitCode` 只基于 `summary.errors.length` 判定失败。
- digest 通知错误记录在 `summary.notifications.*.status`，未参与退出码计算。

### P2 根因

- PATCH handler 是无保护的 read-modify-write：
  1. 读取 `sources.yaml`
  2. 改一个 source
  3. 整体写回
- 并发请求会互相覆盖写入结果，产生 lost update。

## 4. 修复方案（为何选择）

### P1 修复

- `toFetchSignalsExitCode` 增加 notification error 判定：只要 `email` 或 `inApp` 有 `status: "error"`，退出码置为 1。
- `formatFetchSignalsSummary` 增加 `notificationErrors` 计数。
- CLI 日志新增 `EMAIL_NOTIFY_FAILED` / `IN_APP_NOTIFY_FAILED` 明确错误信号。

Why：
- 让运维层（cron/launchd）和日志层都能感知通知通道失败，避免“假成功”。

### P2 修复

- 在 route 内引入 `SerialTaskQueue`，将 source toggle 的 read-modify-write 串行化执行，消除同进程并发覆盖。

Why：
- 改动面最小，不改 shared schema，不引入额外持久化版本字段；先把本次 cloud 发现的 lost update 兜住。

Tradeoff（已知取舍）：
- 当前是进程内串行队列；若未来部署为多进程/多副本，仍建议补充跨进程版本校验（ETag/version）或存储层 CAS。

## 5. 验证方式

### Red（先失败）

- `packages/api/test/signal-fetch-script.test.js`
  - 新增：`returns non-zero when notifications contain error status`
  - 修复前 FAIL（返回 0）。
- `packages/api/test/signals-route.test.js`
  - 新增：`PATCH /api/signals/sources/:id preserves both updates under concurrent toggles`
  - 修复前 FAIL（并发时丢一个更新）。

### Green（修复后通过）

```bash
pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/signal-fetch-script.test.js test/signals-route.test.js
# => 21/21 pass

pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/signal-fetch-scheduler.test.js test/signal-fetch-script.test.js test/signals-route.test.js
# => 26/26 pass

pnpm -r --if-present run build
# => pass（web 仅既有 lint warning）
```
