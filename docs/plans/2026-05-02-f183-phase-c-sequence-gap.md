---
feature_ids: [F183]
related_features: [F081, F123]
topics: [websocket, sequence-number, gap-detection, backpressure, catch-up, thread-scoped]
doc_kind: plan
created: 2026-05-02
---

# F183 Phase C — Sequence Number + Gap Detection Implementation Plan

**Feature:** F183 — `docs/features/F183-bubble-pipeline-architecture-consolidation.md`
**Decision:** KD-9 (2026-05-02) — sequence number 选 **thread-scoped**（不选 global monotonic）
**Goal:** 消除 fire-and-forget WebSocket 协议导致的 R2 / R4 / R5 三类气泡症状（"气泡不见了" / "F5 后才出来" / "猫猫发完消息气泡才出来"）。所有实时 message event 携带 thread-scoped monotonic seq + sequencer epoch；客户端 per-thread `(lastSeq, lastSeqEpoch)` 检测 gap / 服务端重启，立即触发 `requestStreamCatchUp(threadId)` 拉缺（**unconditional full HTTP fetch — 既有 useChatHistory 消费者**），不等 5min DONE_TIMEOUT。

**Acceptance Criteria:**

- [ ] **AC-C1**: 实时 event 携带 thread-scoped monotonic seq；客户端 gap detection 立即触发 catch-up
  - [x] AC-C1.1: `BackgroundAgentMessage` / `AgentMessage` (api) / `useSocket.ts AgentMessage` 三处 wire contract 加 `seq?: number` + `seqEpoch?: string`（optional，bw-compat）
  - [x] AC-C1.2: server-side per-thread sequencer (`ThreadSequencer` 类，in-memory `Map<threadId, number>` + 实例 epoch UUID)；`SocketManager.broadcastAgentMessage` 唯一 choke point 注入 seq + seqEpoch
  - [x] AC-C1.3: client per-thread `lastSeqByThread` + `lastSeqEpochByThread` ledger（Zustand chatStore，每个 thread 独立）
  - [x] AC-C1.4: client gap detection — `processThreadSeq` 决策树 (no-op / seed / advance / late / gap / epoch-change)，gap 或 epoch-change 时调 `requestStreamCatchUp(threadId)`
  - [x] AC-C1.5: catch-up handler — **复用既有 `useChatHistory.ts` HTTP `fetchHistory({replace: true})` 消费者**（gap-triggered 替代 5min DONE_TIMEOUT 触发；reducer stable-key dedup 处理内容协调）
  - [ ] AC-C1.6: replay harness 扩展（推迟到 Phase E invariant + replay closure 一起做）

- [ ] **AC-C2**: in-process event bus backpressure 根因定位 + 修复
  - [ ] AC-C2.1: 定位 backpressure 触发点（grep 不到 `dropped X events` 字面源 → 追到底；可能在 ioredis pub/sub / WebSocket emit / Redis Stream 任一处）
  - [ ] AC-C2.2: 加 buffer 上限 + 限速 + 丢弃策略（drop with warn → catch-up trigger → reload）
  - [ ] AC-C2.3: backpressure 触发指标暴露（`/metrics` 或日志）

- [ ] **AC-C3**: `dropped N events` 字面源追溯完成（与 C2 部分耦合）
  - [ ] AC-C3.1: 找到字面源（Phase A 提到但 grep 不到 → 查 ioredis / socket.io 源码 / 上游 dep）
  - [ ] AC-C3.2: 把字面源换成结构化诊断日志（13 字段 BubbleInvariantViolation 或新 BackpressureViolation）

**Architecture:** B1 已落 single-writer reducer，所有 client 端写入口收口。Phase C 把 wire 协议从 fire-and-forget 升级为 seq-aware，client 主动 detect gap 拉 catchup。Phase D (IDB invalidation) 不变；Phase E (closure) 仍待启动。

**Tech Stack:** TypeScript + Vitest + Zustand + ioredis (per-thread HINCRBY) + socket.io + B1.1 BubbleReducer
**前端验证:** Yes — reviewer 用 Playwright 模拟 transient WebSocket disconnect 验证 gap detection + catchup 闭环
**后端验证:** Yes — 隔离 Redis 6398 跑 backpressure stress test

---

## Straight-Line Check

**Why thread-scoped (KD-9 决策依据)**:
1. F183 立项的 5 类症状都是 thread 内现象，没有跨 thread 顺序需求
2. global 在多 backend 实例下要分布式共识 / 全局 sequencer 持久化，对家里规模过度设计
3. global 全局重启序列号丢失是新脆弱点 — thread-scoped 在 thread state 持久化里天然安全
4. 升级路径单向：thread-scoped → global 容易（加层全局 sequencer），global → thread-scoped 难

**漂气泡风险消除**：消息归属由 `msg.threadId` 决定，跟 seq 无关。漂气泡的根因是 identity contract bug（Phase A ADR-033 已解决）。

**What we're NOT building:**
- ❌ Global monotonic sequencer（KD-9 排除）
- ❌ Per-message ack / 持久化 ack-log（fire-and-forget 不彻底改成 reliable delivery，只 detect+catch-up；用户场景里 socket.io reconnect + catchup 已足够）
- ❌ Inter-thread ordering（用户场景没需求）
- ❌ IDB schema 改（Phase D scope）

---

## Phase C 实施拆分（修订版 — 2026-05-02 砚砚 R1 push back 后收紧）

**初版（已废弃）**：4 个 sub-phase（C0/C1/C2/C3）。

**砚砚 R1 push back（2026-05-02 03:11）**：
> Phase C 不要再拆成 C0/C1/C2/C3 这种小 PR 地狱。下一刀应该直接做 AC-C1 e2e 闭环：server emit seq + client gap + catch-up handler + test，一次把"漏事件能补回来"打通。Backpressure 源头追踪可以单独一刀，因为那是另一类问题。

**修订后（2 个 PR，跟铲屎官 "尽量不拆碎" 一致）**：

### PR 1: AC-C1 e2e 闭环（**当前**, ~700 行含测试）

`feat/f183-c-sequence-gap` 分支：
- ✅ AC-C1.1 contract: `BackgroundAgentMessage.seq?: number` + `seqEpoch?: string`；同步加到 API `AgentMessage` (`packages/api/src/domains/cats/services/types.ts`) 和 `useSocket.ts` 内 `AgentMessage`（三处 wire-level type 都对齐）
- ✅ AC-C1.2 server emit: `ThreadSequencer` 类 + `SocketManager.broadcastAgentMessage` 注入 seq + seqEpoch（在 32 callsite 唯一 choke point 加，不需要逐个改）。Sequencer 实例 epoch (randomUUID) 给 client 探测 server restart。
- ✅ AC-C1.3 client ledger: chatStore `lastSeqByThread` + `setLastSeq` + `lastSeqEpochByThread` + `setLastSeqEpoch` actions
- ✅ AC-C1.4 client gap detection: `processThreadSeq` 在 dispatch 前置，决策树 (no-op / seed / advance / late / gap / **epoch-change**) + 触发 `requestStreamCatchUp(threadId)`（unconditional full fetch，no fromSeq）
- ✅ AC-C1.5 catchup handler: 复用既有 `useChatHistory.ts` `streamCatchUpVersion` 消费者 — gap / epoch-change 触发 (immediate) 替代原来的 5min DONE_TIMEOUT 触发，HTTP `fetchHistory({replace: true})` + reducer stable-key dedup 完成 catchup 闭环。**有意不做 ranged WebSocket replay**：契约里没有 `fromSeq` 参数，避免半实现。
- ⏸ AC-C1.6 replay harness extension: 暂不阻塞 AC-C1 闭环；后续 Phase E（invariant + replay closure）一起做更合适

**Tests**: 25 processThreadSeq (含 epoch-change 7 用例) + 15 ThreadSequencer (含 epoch 4 用例) + 70 bg + 6 cross-thread/thread-dispatch = 101/101 web focused cluster。

**为什么 AC-C1.5 复用既有 HTTP fetch 而不写新 WebSocket replay**：
- 用户场景里 catchup 路径不需要毫秒级延迟（HTTP fetch + 600ms wait + reducer dedup 是已验证路径）
- Phase A discovery 提到的 fire-and-forget 痛点根因是"5min DONE_TIMEOUT"才触发 catchup，不是 catchup 机制本身
- 把 catchup 触发器从 done-timeout 换成 gap-detect / epoch-change = 解决用户感知问题（"气泡不见了 / F5 才出来"）
- 新增 WebSocket replay handler + ranged `fromSeq` 协议是过度设计 — KD-9 单实例 + 用户场景没有强毫秒延迟需求 — 半实现 ranged contract 反而增加迷惑性（砚砚 R1 P2 教训）

**为什么需要 epoch（砚砚 R1 P1 fix）**：
- 没有 epoch：API 重启 → server seq 从 1 重新数；client lastSeq=500 卡住，所有 1..499 走 'late' 分支不更新 lastSeq；gap detection 直到 server 数到 501 才恢复 — 期间静默失效。
- 加 epoch：API 重启 → 新 instance UUID；client 比对 `lastSeqEpoch !== incomingEpoch` && `lastSeq>0` → 'epoch-change' 分支，reset lastSeq + 立即 catchup。

### PR 2: AC-C2 + AC-C3 backpressure（**下一刀**, 待启动）

独立 PR，不耦合 AC-C1：
- AC-C2: in-process event bus backpressure 根因定位 + 修复
- AC-C3: `dropped N events` 字面源追溯（grep 没找到，可能在上游 dep / 已被前次 PR 重命名 — 调研工作）

**为什么单独切**：backpressure 是独立工程问题（不是 wire 协议问题），需要单独 stress test 基础设施。砚砚明确建议这刀单切。

---

## 节奏对照

| Feature | Sub-phase 数 | 教训 |
|---------|------------|------|
| F183 Phase B1 | 8 sub-phases (B1.1 + B1.2.1-1.2.5 + B1.3-1.8) | 铲屎官三次抱怨拆碎；最后告诉砚砚 "你把砚砚当傻子吗？混进 tool/error wire-up 会让 review 抓不到核心？" |
| F183 Phase C（修订）| 2 sub-phases (AC-C1 + AC-C2/C3) | 砚砚 R1 push back 后收紧；每刀一个 user-value 闭环 |

**估算**：~600 行 (PR 1) + ~250 行 (PR 2) = 850 行。比 B1 紧很多。

---

## Risks

| 风险 | 缓解 |
|------|------|
| 多 backend 实例下 in-memory ThreadSequencer 各自独立 → seq 错乱 | KD-9 单实例假设；多实例部署需要切到 Redis HINCRBY (改动局限在 ThreadSequencer 类内部，不动 caller) |
| Server 重启 seq 丢失 | epoch 机制 (砚砚 R1 P1) — 实例 epoch 变化触发 client reset + catchup，不依赖 seq 持久化 |
| Client lastSeq 跟 IDB cache 冲突 | 不动 IDB（Phase D scope）；client lastSeq 只活在 Zustand，刷新后 lastSeq=0 → fresh seed |
| 跨 thread 的 invocation handoff (F173) 受影响 | thread-scoped seq 跟 invocation identity 解耦：handoff 跨 thread 时是新 thread 的新 seq 序列 |
| 半实现 ranged catchup contract 误导 reviewer | 砚砚 R1 P2 教训 — 显式 drop `fromSeq` 参数；plan + chatStore docs + processThreadSeq 全部用"unconditional full HTTP fetch"语言 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-C-1 | 老历史消息（pre-Phase-C）没 seq，如何兼容？ | ✅ 已决：seq 缺失 → `processThreadSeq` 返回 'no-op'，不更新 lastSeq；legacy producer graceful degradation |
| OQ-C-2 | server restart 后 client 高水位 lastSeq 卡住 → 静默失效？ | ✅ 已决（砚砚 R1 P1）：epoch 机制 — sequencer instance UUID + client 比对，mismatch 触发 reset + catchup |
| OQ-C-3 | catchup 是 full HTTP fetch 还是 ranged WebSocket replay？ | ✅ 已决（砚砚 R1 P2）：full HTTP fetch — 复用既有 `useChatHistory` 消费者，避免半实现 ranged contract |
| OQ-C-4 | seq overflow（thread 累积 2^53 events）？ | 数学上不可能（每秒 100 events 跑 2.8 亿年才溢出）— 不需要处理 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-02 | KD-9 拍板 thread-scoped；Phase C kickoff，本 plan 落地（4 sub-phase 初版） |
| 2026-05-02 | 砚砚 R1 push back：4 sub-phase 改 2 sub-phase（AC-C1 e2e + AC-C2/C3 backpressure 单独）；plan 修订 |
| 2026-05-02 | AC-C1 client foundation 落地：contract + ledger + gap detection + 18 processThreadSeq tests（commit `3d3090365`）|
| 2026-05-02 | AC-C1 server emit 落地：ThreadSequencer + broadcastAgentMessage seq inject + 11 sequencer tests（commit `a48ffd721`）|
| 2026-05-02 | AC-C1 catchup 复用既有 useChatHistory HTTP fetch — gap 触发替代原 done-timeout 触发，无需新 WebSocket replay handler |
| 2026-05-02 | 砚砚 R1 review: 3 P1/P2（epoch / fromSeq / type contract）→ commit `e17b1fe58` 修复 + 7 个新 epoch-change tests + 4 个新 ThreadSequencer epoch tests |
| 2026-05-02 | 砚砚 R2 review: 2 P2（useSocket AgentMessage 缺 seq+seqEpoch / Phase C plan 残留 ranged fromSeq 描述）→ 本次 commit 修复 |
