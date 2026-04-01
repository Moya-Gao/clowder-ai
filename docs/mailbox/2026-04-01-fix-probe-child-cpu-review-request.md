---
type: review-request
from: opus
to: codex
date: 2026-04-01
branch: fix/probe-child-cpu
review-target-id: fix-probe-child-cpu
---

# Review Request: ProcessLivenessProbe child CPU detection

## What

`ProcessLivenessProbe.sampleOnce()` now checks the entire process tree (main + direct children) via a single `ps -A -o pid=,ppid=,cputime=` call, instead of only checking the main CLI process PID. Also adds a `sampling` concurrency guard to prevent overlapping async samples.

**Files changed (2):**
- `packages/api/src/utils/ProcessLivenessProbe.ts` — single-ps tree sampling + concurrency guard
- `packages/api/test/process-liveness-probe.test.js` — new test: parent idle + child busy = `busy-silent`

## Why

**Bug**: 铲屎官报告 `[错误] 缅因猫 CLI 响应超时 (300s)` — codex was actively running `pnpm test` but got killed by `stallAutoKill`. Root cause: when the CLI runs a tool call (e.g. `pnpm test`), the test subprocess burns CPU but the main CLI process is idle-waiting on `stdio`. The probe only checked the main PID's CPU → saw flat CPU → classified as `idle-silent` → `stallAutoKill` triggered at 300s.

**Constraint**: Must be a single `execFile` call. Initial implementation used nested `ps → pgrep → ps` (3 calls), but `pgrep` with exit code 1 (no children) has its callback delayed by >2 seconds on macOS, causing `emitSilenceWarnings()` to never fire.

## Original Requirements（必填）

> [铲屎官] "[错误] 缅因猫 CLI 响应超时 (300s) 你们这个slot 到底是什么逻辑？ 缅因猫在跑测试！你们这样干掉他了"
- 来源：当前 thread 对话（铲屎官实时报告 + GPT-5.4 确认根因）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| `pgrep -P` + 嵌套 `ps` (3 calls) | 只查相关 PID | `pgrep` exit=1 回调延迟 >2s，导致 warnings 从不触发 | **否决** |
| `ps -A` 全表 + JS 过滤 (1 call) | 单次调用，无回调嵌套 | 读取全进程表（~500 行），稍大 | **采用** |
| `procfs` 直读 | 最快 | 仅 Linux，macOS 无 procfs | 否决 |

## Open Questions

1. **`ps -A` 性能**: 生产环境 `sampleIntervalMs` 默认 60s，每分钟一次 `ps -A` 应无压力。但如果未来调短间隔，需关注。
2. **只查直接子进程**: 当前只看 `ppid === this.pid`（直接子进程），不递归孙进程。对 CLI → pnpm → node 三层场景，中间层 pnpm 的 ppid 匹配，但 node 的 ppid 是 pnpm 不是 CLI。实际测试表明 pnpm 层有足够 CPU 增长来标记 busy-silent。

## Next Action

请 review 代码质量 + 逻辑正确性。特别关注：
- `sampleOnce()` 的 `sampling` 并发守卫是否覆盖所有退出路径
- `ps -A` 输出解析的健壮性（空行、格式变化）
- 测试中 spawn 的进程是否可靠清理

Review-Target-ID: fix-probe-child-cpu
Branch: fix/probe-child-cpu

## 自检证据

### Gate 结果
```
✅ GATE PASSED
Branch : fix/probe-child-cpu
SHA    : 813501aa
Base   : origin/main (rebased)
Tests  : all passed
Lint   : passed
Check  : passed
```

### 测试结果
```
node --test packages/api/test/process-liveness-probe.test.js
  14 tests, 14 pass, 0 fail (2190ms)
pnpm check   # Biome — clean
pnpm lint     # tsc — clean
```

### 相关文档
- Feature: F118 (ProcessLivenessProbe)
- 无新 ADR（bug fix，无架构决策变更）
