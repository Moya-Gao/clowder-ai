---
feature_ids: []
topics: [gate, test, flaky, api, mcp, probe]
doc_kind: bug-report
created: 2026-05-08
---

# Bug Report: pnpm gate API capabilities-route MCP probe tests flaky

> 日期：2026-05-08
> 报告人：布偶猫 (Opus 4.7)
> 发现场景：F193 Phase C `feat/F193-phase-C-split-only` merge-gate

## 1. 现象

`pnpm gate` rebase 到最新 main（含 `2fad783b6 fix(test): stabilize test baseline`）后，`packages/api` 全量测试里有一组 **MCP probe 相关测试** 在并行跑下随机超时；隔离跑全绿。

15s timeout 不够：probe 测试 spawn 子进程（external MCP server）+ 跑 stdio handshake + tools/list call，单次本地 ~1s，但全 api 测试套并行执行下，进程争抢导致单次 9.5–11s+，刚好踩 connection wait timeout。

## 2. 期望 vs 实际

| | 期望 | 实际 |
|---|---|---|
| `packages/api` 全量测试 | full pass | 1 个 probe 测试随机失败（9–12s timing） |
| 隔离单测 | pass | pass（~1s） |
| 失败位置 | 稳定 | 每轮不同 probe 测试随机 timeout |

## 3. 高频失败的测试

文件：`packages/api/test/capabilities-route.test.js` 的 `GET /api/capabilities (Fastify)` describe 下：

| 测试 | 失败模式 |
|---|---|
| `probe=true keeps runtime PATH when capability provides custom env` | `connectionStatus === 'disconnected'`（期望 `connected`），耗时 9486ms |
| `probe=true still probes when global disabled but per-cat override enabled` | 同上，11272ms |
| `probe=true returns MCP connection status and tool list` | 偶发同类 timeout |

每轮失败的具体测试不同（rolling flake），但都在 probe-spawn child process + handshake 这条路径。

## 4. 复现

```bash
cd /path/to/cat-cafe-{feature}
pnpm gate
# 跑到 packages/api 测试时，probe-* 测试中至少一个随机失败
# 或者直接：
pnpm --filter @cat-cafe/api test
# 等几次也会复现
```

隔离跑全绿：

```bash
cd packages/api
env -u CAT_CAFE_RUNTIME_ROOT CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 \
  bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js \
  --test --test-timeout=60000 \
  --test-name-pattern='probe=true keeps runtime PATH' \
  test/capabilities-route.test.js
# ✔ probe=true keeps runtime PATH when capability provides custom env (976.368666ms)
```

## 5. 根因假设

API 测试套用 `node:test` 默认 `--test` flag 全并行跑（无 worker 限制）。多个 probe 测试同时 spawn child processes（每个跑一个完整 MCP handshake server）+ 各自抢端口/CPU/IO，单 probe 子流程从平时的 ~1s 拉长到 9–12s，刚好踩 `connectionStatus` wait 的内部 timeout，被认定为 `disconnected`。

类似 landy `2fad783b6` 修 `process-liveness-probe.test.js` 的"20ms sample lose to event loop contention"——但那个是单测内部 sampling timing；这个是测试套层的 child-process spawn 争抢。两者根因相似但层不同。

## 6. 建议修复方向

**短期（可选）**：
- 给 `capabilities-route.test.js` 的 probe 测试加显式 timeout（e.g. 30s）覆盖默认 wait
- 或把 probe 测试组用 `describe.serial` 串行跑（如果 node:test 支持）

**中期（推荐）**：
- 给 `packages/api` 的 `node --test` 加 `--test-concurrency=N`（默认 unlimited），限到 4–8
- 或类似 landy 的 vitest `maxWorkers: '25%'` 思路，让 api 测试套也有 worker 上限

**长期**：
- F193/F177 后续考虑：probe 测试 vs orchestrator 测试是否应该 split 到不同 test:* script，按重量分组并发

## 7. 影响

- F193 Phase C merge-gate 卡 1 次（写本 bug report 后按 CVO 不阻塞 PR 的先例继续）
- 任何后续修 `packages/api/` 的 PR 都会撞，需要重跑 gate 1–3 次
- 无功能影响（隔离测试都过，行为正确）

## 8. 不阻塞 F193 Phase C PR

按 Phase A / Phase B 的 CVO 先例（pre-existing test flakies 不阻塞 F193 PR），本 bug report 提交后 Phase C 继续推进 PR + 云端 review + merge。

## 9. 参考

- `2fad783b6 fix(test): stabilize test baseline` — landy 已修 web vitest + process-liveness-probe，但 capabilities-route MCP probe 未覆盖
- `docs/bug-report/2026-05-08-gate-web-parallel-flaky/bug-report.md` — 同类 web 侧 flaky（已 fixed）
