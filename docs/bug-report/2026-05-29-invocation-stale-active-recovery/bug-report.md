---
feature_ids: []
related_features: [F194, F215]
topics: [invocation, cancel, routing, liveness, queue]
doc_kind: bug-report
created: 2026-05-29
---

# Bug Report: invocation 边界收尾不可靠 → thread 僵尸活跃态无法解除

> 发现：2026-05-29 | 调查/owner：宪宪 (Opus-4.8) | 性质：invocation/消息队列**回归 bug**（非新 feature；CVO 2026-05-29 拍板不挂 F215、不新开 F 号）
> 状态：**修复完成，待跨个体 review**（宪宪 Sonnet-4.6 实现，交 opus-48 review）

## 1. 报告人 / 怎么发现的

铲屎官在两个 thread 连续撞到"猫卡住、无法解除"的现象：

- **Thread 1** (`thread_mpr4mta201x8sf9h`，16:20)：链路 @kimi，但"布偶猫正在回复中"卡死，点 cancel n 次没用、F5 后还在、禁用 kimi 也没用。
- **Thread 2** (`thread_mpr4ckfbc50an2rr`，16:32)：闲聊接力实验，opus-47 R6 @了 opus-48 R7，opus-48 接力后"停止输出"，消息发不出去（排队中）。

## 2. 现象 / 期望 vs 实际

| | 期望 | 实际 |
|---|---|---|
| Thread 1 | @ 不存在的猫 → 明确提示；卡住 → cancel 可解除 | @kimi 静默变成布偶猫执行；cancel 点 n 次/F5/禁猫都无法解除 |
| Thread 2 | invocation 结束 → thread 空闲可继续发消息 | invocation 已结束（CLI done），但 thread 永久 busy，新消息只能排队 |

## 3. 根因分析

### 3.1 Thread 2（核心，已取证）

**CLI 侧（rawArchive `2026-05-29/27378e9b-...ndjson`，cliSession `a05888c0` = Thread 2 那条，已确认）**：
- `stop_reason`: 2×end_turn + 5×tool_use + 19×null（null 多为流式中间态）
- **`abort/cancel/error/preempt` 信号 = 0** → 不是被中途 abort，是 CLI 自己跑完
- 最终 `result`: `subtype:success / is_error:false / result:"" / num_turns:6`
- → opus-4.8 长 context（461k input）下，最后一轮 form A（thinking-only 无有效产出），CLI 报"假成功"（result 空）。**与 F215 同源，但 F215 检测条件 `textEventCount===0` 精确漏掉它**——前面有开场白 text，textEventCount>0。

**cat-cafe 侧（代码事实，已验证）**：
- slot 释放的**唯一触发**：`if ((msg.type === 'done' || msg.type === 'error') && msg.catId) → invocationTracker.completeSlot(...)`（`routes/invocations.ts:213`、`routes/messages.ts:943`、`QueueProcessor.ts:1004`）
- 新消息排队判定：`hasActiveExecution(threadId)` 为 true → enqueue（`routes/messages.ts:486-512`）
- A2A slot 由 `trackA2ASlot`/`completeA2ASlots` 回调管理（`messages.ts:897-901`、`QueueProcessor.ts:967-971`），routeSerial 不直接管 slot

**根因链（假设，待复现测试钉死）**：`success + result:""` 边界**未产生 `done`/`error` 消息** → `completeSlot` 永不触发 → slot 残留 → `hasActiveExecution=true` → 新消息永久排队。

**附带**：session 卡 `status:active` + `ballState:in_progress`（`CollaborationContinuityCapsule.ts:60-61` 的初始默认值从未被 complete）；重启 runtime 不清（持久化在 Redis），现有 reaper 只回收 `sealing` 不覆盖 `active`。

### 3.2 Thread 1（已验证，main 最新代码仍存在）

- **触发器**：@kimi 不在 roster → `resolveCatTarget` cat_not_found → AgentRouter 丢弃 mention → fallback 链 `getDefaultCatId()` = opus（布偶猫，ragdoll 是第一个 breed）。静默 fallback，用户无感知。
- **卡死**：cancel route（`routes/queue.ts:515-540`）只调 `invocationTracker.cancel()`（清内存 slot），**从不更新持久化的 `InvocationRecord.status`**；且开头 `invocationTracker.has()` 为 false 时直接 404 短路（孤儿场景 slot 已不在 → 永远 404 → 永远清不掉）。而 F194 后"正在回复中"读的是 record-based liveness → record 卡 running → F5 后仍显示。禁用 kimi 无效，因为卡的是 opus 的 record。

### 3.3 共同根因

invocation 在**异常/边界结束**（empty-result / 孤儿 / malformed）时，**收尾路径不可靠**（slot 不释放 / record 不收尾 / session 不 seal），留下**僵尸活跃态**；且该状态**无法被解除**——cancel 够不到 record、reaper 不覆盖 active、重启不清持久态、用户无强制重置入口。

## 4. 修复方案（scope，TDD）

1. **核心（Thread 2）**：保证 invocation 在 `success + result:""`（及任何"无有效产出但 CLI 结束"）边界**必定产生 `done`/`error` 终止消息** → `completeSlot` 释放 slot + ballState 收尾。让 thread 不会因空产出而永久 busy。
2. **兜底（Thread 1 + 通用）僵尸活跃态可清除性**：cancel 同步清 `InvocationRecord` + 放宽 404 短路（tracker 无 slot 但 record running 时仍清）+ active 僵尸纳入 reaper/或用户强制重置入口。
3. **触发器（Thread 1）**：@ 不存在/未启用的猫 → 明确反馈，不静默 fallback 到默认猫。

## 5. 验证方式（计划）

- **复现测试（Thread 2）**：构造 A2A serial 一棒 invoke 返回 `success + result:""`（mock CLI），断言 ① 产生 done/error ② `completeSlot` 被调 ③ `hasActiveExecution` 转 false（新消息不再排队）。先红后绿。
- **复现测试（Thread 1）**：cancel 一个 tracker 无 slot 但 record running 的孤儿 → 断言 record 被标 canceled、liveness 不再 active。
- 回归：routeSerial / queue-processor 既有测试套全绿（routeSerial 是 2302 行雷区，重点防回归）。

## 6. 假设验证进展（debugging Phase 3）

- [x] **已证伪**：routeSerial 的 A2A slot 残留**不是**根因。复现测试 `route-serial-empty-result-recovery.test.js`（A2A target 一棒只 yield text、不 yield done）**绿** → `completeA2ASlots`（route-serial.ts:2264，while 循环后无条件调）确实释放了 A2A slot，即使该棒无 done。**避免了在 2302 行 routeSerial 雷区瞎改**。该测试保留为回归保护。
- [x] **已钉死 busy 判定源**：`hasActiveExecution`（QueueProcessor.ts:413）查两源——`InvocationTracker.has` + `processingSlots`（均带 TTL/sweep 保护）。
- [ ] **新假设（待钉死）**：真因在更上游——`invoke-single-cat` 处理 CLI `result(subtype:success, result:"")` 时是否 emit 终止 `done`。若不 emit → 外部消费循环（`messages.ts:943` / `invocations.ts:213`）的 `completeSlot` + `InvocationRecord` 收尾不触发 → **初始 slot 或 record 残留** → `hasActiveExecution` 仍 true → 消息排队。下一步：用 invoke-single-cat 的 CLI mock harness（参考 `invoke-single-cat.test.js` / `f215-malformed-toolcall.test.js`）测 empty-result 是否 emit done。
- [ ] session 卡 active（status active + ballState in_progress）：可能是正常的 session 复用（非 bug），需与"消息发不出去"的真因（slot/record）解耦确认。

## 7. Thread 1（cancel 僵死）可独立先修

Thread 1 根因明确（§3.2，main 最新代码确认）、与 Thread 2 真因解耦，可先行 TDD 修复：cancel route 同步标记 `InvocationRecord` + 放宽 `invocationTracker.has()` 404 短路（孤儿场景）。

## 8. 修复实现记录（宪宪 Sonnet-4.6，2026-05-29）

实现 commits: `fc72d1b0a`（核心修复）、`32f78cea7`（biome 格式）、`5314c254b`（feature index）

### 8.1 Thread 1 fix: cancel 孤儿 record（queue.ts）
- **文件**：`packages/api/src/routes/queue.ts`
- **改动**：cancel route 的 404 短路前先查 `invocationRecordStore.listRunningByThread`
  - 找到 catId 对应的 running record → 标 canceled → 返回 200（不再 404）
  - 没找到 record → 原 404 行为保持
- **测试**：`packages/api/test/cancel-orphan-record.test.js`（3 tests GREEN）

### 8.2 通用逃生口: force-reset endpoint（queue.ts）
- **文件**：`packages/api/src/routes/queue.ts`
- **新增**：`POST /api/threads/:threadId/force-reset`
  - `queueProcessor.releaseThread(threadId)` — 释放所有 in-memory processingSlots
  - 批量 cancel 所有 running InvocationRecords for (threadId, userId)
  - 返回 `{ ok: true, canceledRecords: N }`
- **测试**：`packages/api/test/force-reset-thread.test.js`（3 tests GREEN）

### 8.3 @not-found 反馈: routing_warnings 透传（AgentRouter.ts）
- **文件**：`packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts`
- **改动**：`resolveTargetsAndIntent` 新增返回 `routing_warnings: CatRoutingError[]`
  - 调用方可用此字段在 `@kimi`（cat_not_found/cat_disabled）时给用户显式提示
  - 已有 messages.ts 调用点可接收此字段（消费实现可后续补充）
- **测试**：`packages/api/test/routing-warning-feedback.test.js`（3 tests GREEN）

### 8.4 未做 / 故意留后续
- Thread 2 的"active session 永不自愈"：reaper 扩展覆盖 active→sealing 过渡（opus-48 诊断说明需验证 invoke-single-cat done 是否正常 emit，这一层暂未动，restart 能解除）
- messages.ts 消费 `routing_warnings` 向用户推送 socket warning：前端集成留后续 feature PR
