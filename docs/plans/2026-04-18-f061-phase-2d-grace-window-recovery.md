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
- AC-4 Grace deadline 到期仍无恢复文本 → yield pending stream_error + `terminalAbort=true`，counter `_expired_total++`
- AC-5 `hasText=false`（开口即断）→ 立刻 yield，保持现状
- AC-6 Telemetry 三件低基数 counter：`antigravity_stream_error_buffered_total` / `_recovered_total` / `_expired_total`（属性通过现有 allowlist 表达：`gen_ai.system=antigravity`、`gen_ai.request.model={normalized bucket}`、`operation.name=partial_text`）
- AC-7 前端不再收到“先 error 再 text”的错乱序列（靠 buffer 自然消除）

**Architecture:** Service 层在 `AntigravityAgentService.ts` poll 循环中维护 `pendingStreamError`（`AgentMessage | null`）和 `graceDeadline`（absolute timestamp）；拦截来自 transformer 的 `error:stream_error` 消息，按状态机决定立即 yield / buffer / demote / flush。Transformer 保持纯映射，不引入 timer 或状态。
**Tech Stack:** TypeScript, node:test, 现有 Antigravity bridge 轮询框架
**前端验证:** 不改前端。reviewer 只需确认 WS 广播顺序（text 在前、error 在后或无 error），无需跑 Playwright。

---

## 背景

F061 Phase 2c merge 后连续修了两根因：
- **#1268**（`fix/f061-stream-error-rootcause`）：`AntigravityAgentService` 在 `hasText=true` 的 stream_error 场景也走 `terminalAbort`，把 recovery tail 截掉。修复是 “continue poll”，但**错误事件仍立即 yield 给前端**。

铲屎官体感：Antigravity 产品里直接聊天没见过这个错误，说明它们的客户端有更强的容错/延迟决策。我们 Cat Café 集成层需要把半步补满。

## Design

### 实现口径：deadline-based grace（不是“数空 batch”）

关键实现约束：**bridge 不向 service yield 空 batch**。`pollForSteps()` 只在有新/变异 step、`awaitingUserInput`、或 terminal empty 时 yield；空轮询只在 bridge 内部 `setTimeout(2_000)`。

所以 v1 在“不改 bridge、不动 cadence”的约束下，**只能用 deadline，不能数空 batch**。

### 状态机

```text
初始:
  pendingStreamError = null
  graceDeadline = 0

每批 messages 处理：
  for msg of messages:
    if msg.type === 'text':
      if pendingStreamError:
        log.info({cascadeId}, 'stream_error recovered mid-stream')
        counter.recovered.add(1, attrs)
        pendingStreamError = null
        graceDeadline = 0
      hasText = true
      yield msg

    elif msg.type === 'error' && msg.errorCode === 'stream_error' && hasText && !hasSpecificError:
      pendingStreamError = msg
      graceDeadline = Date.now() + GRACE_WINDOW_MS
      counter.buffered.add(1, attrs)

    elif msg.type === 'error' && (msg.errorCode === 'upstream_error' || msg.errorCode === 'model_capacity'):
      if pendingStreamError:
        log.info({cascadeId}, 'stream_error superseded by specific error')
        pendingStreamError = null
        graceDeadline = 0
      yield msg

    else:
      yield msg

每次 await 下一批时：
  if pendingStreamError:
    remaining = graceDeadline - now
    if remaining <= 0:
      log.warn({cascadeId}, 'stream_error grace expired without recovery')
      counter.expired.add(1, attrs)
      yield pendingStreamError
      pendingStreamError = null
      terminalAbort = true
      break

    raced = Promise.race(iterator.next(), timeout(remaining))
    if raced === timeout:
      log.warn({cascadeId}, 'stream_error grace expired without recovery')
      counter.expired.add(1, attrs)
      yield pendingStreamError
      pendingStreamError = null
      terminalAbort = true
      break
```

### 为什么产品口径写“2 poll tick”，代码实现写 wall-clock deadline

- Bridge poll cadence 固定 2s（`AntigravityBridge.ts:236`）
- 唯一真实样本 `partial_text -> stream_error` 间隔 2.015s
- 裸 3s 只买 1.5 tick，尴尬；`GRACE_WINDOW_MS=4500` 相当于两轮 2s cadence + 小 buffer
- v1 不动 cadence，避免把“错误终止策略”扩大成“调度改造”

### Transformer 不动

`antigravity-event-transformer.ts` 继续按上游 stopReason 映射 error message。timer/状态机放到 service 是因为：
- Service 本来就是 “terminal vs recoverable” 的决策层
- Transformer 保持纯函数，便于单元测试和跨调用复用
- 把 buffer 语义放在离 `hasText` / `hasSpecificError` 判断最近的地方，减少跨层传递的状态

---

## Tasks

### Task 1: TDD — 状态机骨架

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Modify: `packages/api/test/antigravity-agent-service-fatal-errors.test.js`

**Steps:**
1. Red: 写测试 `stream_error with partial text is buffered and recovered on subsequent text`（AC-1 + AC-2）
2. Red 验证：跑测试，fail 信号应为“error 被立刻 yield 了”或“text 出现后 pending 未清”
3. Green: 引入 `pendingStreamError` + `graceDeadline`，按状态机实现
4. Green 验证：单测通过
5. 继续红绿循环覆盖 AC-3（upstream_error 抢占）、AC-4（expired flush）、AC-5（hasText=false 立即 yield）

### Task 2: Telemetry 三件 counter

**Files:**
- Modify: `packages/api/src/infrastructure/telemetry/instruments.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`

**Guardrails:**
- 属性只允许：`gen_ai.system="antigravity"`、`gen_ai.request.model`（normalized bucket）、`operation.name="partial_text"`
- 禁止 `threadId` / `cascadeId` 等高基数字段（查细节走日志的 `cascadeId`）
- 不用 log 假装 metric，直接挂 OTel counter

### Task 3: Regression

**Files:**
- 跑全套 `pnpm --filter @cat-cafe/api test` 确认 `antigravity-*` 不退化
- `pnpm gate` 本地全绿

---

## Risk & 非目标

| 风险 | 缓解 |
|------|------|
| Grace 期间用户等空气最多 4.5s | `GRACE_WINDOW_MS=4500` 固定，有 counter + log 可观察；若 recovery 率低再压到 2500 |
| `graceDeadline` / timer 清理边界 | 单测覆盖超时 flush；实现里 `clearTimeout` 必须在 race 后执行 |
| Buffered 期间 cascade cancel | `controller.signal.aborted` 检查点在 poll 循环入口，pending 会随 return 被 GC；timer 需要在 abort 时 clear |
| 同一 batch 内 error + 后续 text | 状态机按 msg 顺序处理；如果 transformer 把 text 放在 error 之后，状态机会先 buffer 再 recover，行为正确 |
| Timer 精度 vs `Date.now()` 漂移 | 用 `Date.now()` 算 `remaining = deadline - now`；精度秒级，漂移 <100ms 不影响用户体感 |

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
| AC-2 | `recovers buffered stream_error on subsequent text` | text yielded，pending == null |
| AC-3 | `drops buffered stream_error when upstream_error arrives` | upstream_error yielded，pending == null |
| AC-4 | `flushes buffered stream_error after grace deadline expires` | stream_error yielded after `GRACE_WINDOW_MS` 超时，`terminalAbort == true` |
| AC-5 | `yields stream_error immediately when no text has streamed` | immediate yield，no buffering |

---

## Handoff

- **实施**：@gpt52（缅因猫 GPT-5.4）
- **Review**：@opus-47（布偶猫 Opus 4.7，当前方案作者）
- **PR**：新分支 `feat/f061-grace-window-recovery`，不塞回已 merge 的 `#1268`
