---
feature_ids: [F183]
related_features: [F081, F123, F088, F167]
topics: [websocket, backpressure, observability, rate-limit, broadcast, log-instrumentation]
doc_kind: plan
created: 2026-05-02
---

# F183 Phase C2/C3 — Backpressure Observability + 字面源追溯

**Feature:** F183 — `docs/features/F183-bubble-pipeline-architecture-consolidation.md`
**预案 source:** Phase A bug report `docs/bug-report/2026-04-27-stream-event-delivery-lag/bug-report.md`
**Goal:** 完成 AC-C2 (in-process event bus backpressure 根因定位 + 修复) + AC-C3 (`dropped N events` 字面源追溯)。AC-C1 (sequence + gap detection) 已 PR #1532 merged 提供 user-visible safety net。

## TL;DR — Scope 收敛说明

原 spec 设想 AC-C2.2 加 buffer/限速/丢弃策略；调研后**实际不需要**：
1. **`dropped N events` 字面源**：Phase A bug report 截图含黄色警告 `"in-process app-server event stream lagged; dropped 32 events"`。
   - grep 全 packages/* + node_modules → **不存在**
   - socket.io / socket.io-adapter / socket.io-parser → 不含
   - ioredis / fastify / @opentelemetry → 不含
   - **结论**：literal 来自外部（Antigravity IDE / browser extension / 历史 instrumentation 已删除），不在 cat-cafe 当前代码或当前 deps 任意路径
2. **broadcast 路径无内置 drop**：`SocketManager.broadcastAgentMessage` 用 `this.io.to(room).emit(...)`，socket.io emit 是 best-effort，没有 drop 机制；engine.io 内部 buffer 可无界增长但不主动 drop
3. **AC-C1 catchup 已是 user-visible safety net**：client gap detection + retry HTTP catchup + epoch-change → server 重启 / dropped event 都能自动恢复，不需要手动 F5

**修订 scope**：
- ✅ AC-C3.1 字面源追溯：documented as "not in code / current deps; likely external/historical"
- ✅ AC-C3.2 替换字面源 → 落地结构化日志 (`broadcast_rate_warn` event)
- ✅ AC-C2.1 backpressure 触发点：identified `SocketManager.broadcastAgentMessage` 唯一 choke point；当前无内置 drop
- ✅ AC-C2.3 触发指标暴露：per-thread emit rate 滑动窗口 + threshold warning + `getStats(threadId)` admin/test introspection
- ⏸ AC-C2.2 加 buffer / 限速 / 丢弃：**SKIP** — 没有确认 backpressure 触发点，premature optimization。AC-C1 已是 user-visible safety net。需要时通过新数据 (rate monitor logs) 评估再加。

**Acceptance Criteria — closed sub-items:**
- [x] AC-C3.1: 字面源追溯完成 (结论: 不在我们代码/deps)
- [x] AC-C3.2: 结构化诊断日志 (`broadcast_rate_warn` schema 替代 unfindable literal)
- [x] AC-C2.1: backpressure 触发点 identified (broadcastAgentMessage choke point)
- [x] AC-C2.3: backpressure 触发指标暴露 (BroadcastRateMonitor + getStats)
- ~~[ ] AC-C2.2: buffer/限速/丢弃策略~~ → **deferred** (no confirmed bottleneck; revisit when rate monitor surfaces real pressure)

**Architecture:** AC-C1 is single-instance server's WebSocket emit injects seq+epoch; client maintains lastSeq + pending + retry catchup. AC-C2/C3 adds per-thread emit rate observability (BroadcastRateMonitor instrumentation) without changing any actual flow. 100% additive, zero behavior change for normal traffic.

**Tech Stack:** TypeScript + node:test (BroadcastRateMonitor pure utility)

---

## Implementation

### `BroadcastRateMonitor` (new, packages/api/src/infrastructure/websocket/)

Pure in-memory utility:
- Per-thread sliding window (default 1000ms) of emit timestamps
- Threshold check (default 200 events/window) — fires `onWarn` callback with structured event
- Dedup per thread (default 5000ms) — avoid log storm under sustained pressure
- Admin/test introspection: `getStats(threadId)` + `reset(threadId)` + `resetAll()`
- All knobs configurable via constructor options for production tuning + test determinism

### `SocketManager` integration

- New `rateMonitor: BroadcastRateMonitor` field (public for test introspection)
- `broadcastAgentMessage` calls `rateMonitor.record(tid)` before `io.to(room).emit(...)`
- `onWarn` callback forwards to module logger as structured `broadcast_rate_warn` event
- Constructor accepts optional `BroadcastRateMonitorOptions` for production overrides

### Tests

`packages/api/test/broadcast-rate-monitor.test.js` (11 cases):
- under-threshold no-op
- over-threshold warn
- sliding window expiry
- dedup window
- per-thread isolation
- getStats accuracy
- reset / resetAll
- default values
- timestamp injection (deterministic via clock injection)
- 5s sustained 200/sec stress (verify dedup limits warn count)

---

## Risks

| 风险 | 缓解 |
|------|------|
| Rate monitor itself becomes bottleneck under high emit | 砚砚 R1 P2 fix: head-index sliding window (NOT `Array.shift()` 是 O(n)) + 当 dead-prefix ≥ live count 时 batch splice 压缩内存 — amortized O(1) per record。Cloud R2 P1 fix: opportunistic eviction throttled to ≤ 1 sweep per windowMs（之前 `size >= 1024` → 每个 record() 都全表扫，broadcast 自己变瓶颈）。10k records on single thread with continuous expiry, live window count bounded (实测 100ms 窗 + 10ms cadence ~10 entries); throttle test 验证连续 200 records 内只触发 1 sweep。 |
| Logger / onWarn callback throw aborts broadcast emit | 砚砚 R1 P1 fix: record() 用 try/catch wrap onWarn — observability 必须 best-effort，logger 异常不能制造 "气泡不出来" 症状（正是 monitor 该探测的 backpressure 表现）。Test: rateThreshold:0 + onWarn throw → record() doesNotThrow。 |
| Threshold misconfigured (false positives) | 默认 200 events/sec for 1s — 实测 streaming text 通常 50-100 chunks/sec (gemini/claude)；CLI tool stream burst 可能 ~200。配置 5s dedup 防 log storm。生产可通过 SocketManager constructor option 调高。 |
| Warn 事件本身丢失 | onWarn 是 sync callback，no async loss. 但 logger 后端 (pino transport) 可能丢 — 这是 logger 层问题，不是 monitor 层。 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-C2-1 | 是否需要 buffer/drop policy？ | ⏸ defer — 没有 confirmed bottleneck，先 observe，需要时再加 |
| OQ-C2-2 | 阈值 200 events/sec 合理吗？ | 默认值，可能需要根据真实流量调整。生产/Alpha 跑一段时间后看 `broadcast_rate_warn` 频率决定 |
| OQ-C3-1 | "in-process app-server event stream lagged" 字面源真的不存在？ | ✅ 已实证 (codebase + node_modules grep)。结论 likely 外部 IDE / 历史 instrumentation。 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-02 | AC-C1 PR #1532 merged (`f1ba91a8b`) — sequence + gap detection user-visible safety net |
| 2026-05-02 | AC-C2/C3 plan landed: BroadcastRateMonitor 作为 observability，AC-C2.2 deferred |
