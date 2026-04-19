---
feature_ids: [F061]
related_features: []
topics: [antigravity, stream-error, fault-tolerance, plan]
doc_kind: plan
created: 2026-04-18
---

# F061 Phase 2d: Stream Error Grace Window Recovery

**Feature:** F061 — `docs/features/F061-antigravity-bengal-cat.md`
**Goal:** 当 Antigravity 上游吐出 `STOP_REASON_CLIENT_STREAM_ERROR` 且此前已经流出 partial text 时，service 层 buffer 住错误、允许 bounded recovery poll，只有真正无恢复文本才升级成用户可见错误——把集成层对上游软错误的放大收敛成软失败。
**Acceptance Criteria:**
- AC-1 `hasText=true && stream_error && 无更具体 fatal` → 错误进入 pending buffer，不立刻 yield 给前端
- AC-2 Grace 期间到达 `text` 消息 → drop pending，counter `_recovered_total++`，原错误只留 log.info
- AC-3 Grace 期间到达 `upstream_error` 或 `model_capacity` → drop pending，yield 更具体 error
- AC-4 Poll budget 耗尽仍无恢复文本 → yield pending stream_error + `terminalAbort=true`，counter `_expired_total++`
- AC-5 `hasText=false`（开口即断）→ 立刻 yield，保持现状
- AC-6 Telemetry 三件低基数 counter：`antigravity_stream_error_buffered_total` / `_recovered_total` / `_expired_total`（属性只允许 `provider`、`model_family`、`path=partial_text`）
- AC-7 前端不再收到"先 error 再 text"的错乱序列（靠 buffer 自然消除）

**Architecture:** Service 层在 `AntigravityAgentService.ts` poll 循环中维护 `pendingStreamError`（AgentMessage | null）和 `streamErrorPollBudget`（number）；拦截来自 transformer 的 `error:stream_error` 消息，按状态机决定立即 yield / buffer / demote / flush。Transformer 保持纯映射，不引入 timer 或状态。
**Tech Stack:** TypeScript, node:test, 现有 Antigravity bridge 轮询框架
**前端验证:** 不改前端。reviewer 只需确认 WS 广播顺序（text 在前、error 在后或无 error），无需跑 Playwright。

---

## 背景

F061 Phase 2c merge 后连续修了两根因：
- **#1268**（`fix/f061-stream-error-rootcause`）：`AntigravityAgentService` 在 `hasText=true` 的 stream_error 场景也走 terminalAbort，把 recovery tail 截掉。修复是 "continue poll"，但**错误事件仍立即 yield 给前端**。

铲屎官体感：Antigravity 产品里直接聊天没见过这个错误，说明它们的客户端有更强的容错/延迟决策。我们 Cat Café 集成层需要把半步补满。

## Design

### 状态机

```
初始:
  pendingStreamError = null
  streamErrorPollBudget = 2   // 2 poll tick ≈ 4.5s wall clock

每批 messages 处理：
  for msg of messages:
    if msg.type === 'text':
      if pendingStreamError:
        log.info({cascadeId}, 'stream_error recovered mid-stream')
        counter.recovered++
        pendingStreamError = null
      hasText = true
      yield msg

    elif msg.type === 'error' && msg.errorCode === 'stream_error' && hasText && !hasSpecificError:
      pendingStreamError = msg
      streamErrorPollBudget = 2   // reset on new buffer
      counter.buffered++

    elif msg.type === 'error' && (msg.errorCode === 'upstream_error' || 'model_capacity'):
      if pendingStreamError:
        log.info({cascadeId}, 'stream_error superseded by specific error')
        pendingStreamError = null   // drop, don't count as expired
      yield msg   // let specific error through

    else:
      yield msg

批处理结束后（每 batch，含空 batch）：
  if pendingStreamError:
    streamErrorPollBudget--
    if streamErrorPollBudget <= 0:
      log.warn({cascadeId}, 'stream_error grace expired without recovery')
      counter.expired++
      yield pendingStreamError
      pendingStreamError = null
      terminalAbort = true
      break
```

### 为什么是 poll budget 而不是 wall-clock ms

- Bridge poll cadence 固定 2s（`AntigravityBridge.ts:236`）
- 唯一真实样本 partial_text → stream_error 间隔 2.015s
- 裸 3s 只买 1.5 tick，尴尬；2 poll budget 等价 ~4.5s，和现有 cadence 自然对齐
- v1 不动 cadence，避免"错误策略改造"扩大成"调度改造"

### 为什么每 batch 减 1（含空 batch）

保证 budget 与真实 wall clock 单调对应。空 batch（poll 了但 LS 没新 step）也要消耗 budget，否则空批续命会把 grace 拉长，用户等空气时间失控。

### Transformer 不动

`antigravity-event-transformer.ts:144-154` 继续按上游 stopReason 映射 error message。timer/状态机放到 service 是因为：
- Service 本来就是 "terminal vs recoverable" 的决策层（`AntigravityAgentService.ts:222-236`）
- Transformer 保持纯函数，便于单元测试和跨调用复用
- 把 buffer 语义放在离 `hasText` / `hasSpecificError` 判断最近的地方，减少跨层传递的状态

---

## Tasks

### Task 1: TDD — 状态机骨架

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`（在现有 fatalErrors 处理循环中插入 buffer 逻辑）
- Modify: `packages/api/test/antigravity-agent-service.test.js`（加 AC-1/2/3/4/5 五个场景）

**Steps:**
1. Red: 写测试 `stream_error with partial text is buffered and recovered on subsequent text`（AC-1 + AC-2）
2. Red 验证：跑测试，fail 信号应为"error 被立刻 yield 了"或"text 出现后 pending 未清"
3. Green: 引入 `pendingStreamError` + `streamErrorPollBudget`，按状态机实现
4. Green 验证：单测通过
5. 继续红绿循环覆盖 AC-3（upstream_error 抢占）、AC-4（expired flush）、AC-5（hasText=false 立即 yield）

### Task 2: Telemetry 三件 counter

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`（埋点 buffered/recovered/expired）
- （若项目已有 OTel counter 工厂则复用；没有就只 `log.info` 结构化字段，观察几天再决定是否挂 metrics）

**Guardrails:**
- 属性只允许：`provider="antigravity"`、`model_family`（若可得）、`path="partial_text"`
- 禁止 `threadId` / `cascadeId` 等高基数字段（查细节走日志的 cascadeId）

### Task 3: Regression

**Files:**
- 跑全套 `pnpm --filter @cat-cafe/api test` 确认 `antigravity-*` 不退化（当前基线 157 pass）
- `pnpm gate` 本地全绿

---

## Risk & 非目标

| 风险 | 缓解 |
|------|------|
| Grace 期间用户等空气最多 4.5s | Budget 写死 2，有 log 可观察；若 recovery 率低再压到 1 |
| `streamErrorPollBudget` 边界 off-by-one | 单测覆盖 budget=1 时精确烧完的场景 |
| Buffered 期间 cascade cancel | `controller.signal.aborted` 检查点在 poll 循环入口，pending 会随 return 被 GC，不泄漏 |
| 同一 batch 内 error + 后续 text | 状态机按 msg 顺序处理；如果 transformer 把 text 放在 error 之后，状态机会先 buffer 再 recover，行为正确 |

**非目标：**
- 不做 adaptive poll cadence（v1）
- 不改前端渲染（只消除错乱序列）
- 不动 `hasText=false` 分支（开口即断仍快速失败）
- 不做跨 cascade 的 grace（每 cascade 独立，不累计）

---

## Test Plan

| AC | 测试名 | 验收 |
|----|--------|------|
| AC-1 | `buffers stream_error when partial text already streamed` | pending != null 且未 yield |
| AC-2 | `recovers buffered stream_error on subsequent text` | text yielded, pending == null, counter.recovered == 1 |
| AC-3 | `drops buffered stream_error when upstream_error arrives` | upstream_error yielded, pending == null |
| AC-4 | `flushes buffered stream_error after poll budget exhausted` | stream_error yielded after exactly 2 empty batches, terminalAbort == true |
| AC-5 | `yields stream_error immediately when no text has streamed` | immediate yield, no buffering |

---

## Handoff

- **实施**：@gpt52（缅因猫 Codex GPT-5.4）—— 他手里有 `fix/f061-stream-error-rootcause` worktree、runtime 日志样本（`api.2026-04-18.1.log:77967-77974`）、157 tests 基线
- **Review**：@opus（布偶猫，本计划作者的同族——但实施方是缅因猫，跨 family 满足铁律）
- **PR**：新分支 `feat/f061-grace-window-recovery`，不塞回已 merge 的 #1268
