---
feature_ids: []
related_features: [F216, F118, F215]
topics: [invocation, queue, steer, preempt, cancel, slot, liveness]
doc_kind: bug-report
created: 2026-06-02
---

# Bug Report: Steer「立即中断」无法抢占——leaked processingSlot 让 QUEUE_BUSY 死循环

> 发现：2026-06-02 | 铲屎官截图（一堆"Steer 失败 — 队列繁忙"）→ 宪宪(Opus-4.8) 定位 | CVO 拍板「修根因」
> 性质：invocation 抢占 / 双 busy 真相源不一致 **回归 bug**（非新 feature，不开 F 号；2026-05-29 slot-leak 同族）
> 状态：**修复完成（tombstone race-safe，云端 R3 P1 已修），待复审** | 分支 `fix/steer-preempt-leaked-slot`

## 1. 报告人 / 怎么发现的
铲屎官截图：布偶猫 Opus 4.6 长时间"工作中"，他点 Steer「立即中断」想插队/中断，连续弹一堆 **"Steer 失败 — 队列繁忙，暂无法立即执行"**，怎么点都中断不了。原话："我还不能打断布偶猫了！"

## 2. 现象 / 期望 vs 实际
| | 期望 | 实际 |
|---|---|---|
| Steer 立即中断一个正忙的猫 | 取消当前回合 → 立刻跑插队消息 | 永远 `QUEUE_BUSY`，无法中断（runtime 日志：13:04:09–13:04:22 同一 entry 猛点 20+ 次全失败） |

## 3. 根因分析（airtight）

### 3.1 代码事实（`packages/api/src/routes/queue.ts:337-377` steer immediate）
```
if (invocationTracker.has(threadId, steerCatId)) {     // ← 门 (339)
   cancel(...) ; clearPause(...) ; releaseSlot(...)     // ← releaseSlot 在 if 内 (363)
}
promote(...) ; const result = await processNext(...)    // ← processNext 按 processingSlots 判忙
if (!result.started) return QUEUE_BUSY                  // (374-376)
```
- `releaseSlot`（清 `QueueProcessor.processingSlots`）**只在 `invocationTracker.has()=true` 时才执行**。
- 但 `processNext → tryExecuteNextForUser`（`QueueProcessor.ts:709-720`）的忙门是 **`processingSlots.has(sk)` ‖ `invocationTracker.has(entryCat)`**。

### 3.2 双 busy 真相源分叉 = 根因
当一个回合**占着 `processingSlots` 但 `invocationTracker.active` 里没有**（slot 泄漏 / 状态分叉）：
- Steer 走 else：`invocationTracker.has()=false` → **cancel 跳过、releaseSlot 也跳过**。
- `processNext`：`processingSlots.has(sk)=true` → `!started` → **QUEUE_BUSY**。
- → 这个 leaked slot 永远没人清（除非超 `processingSlotTtlMs` 被 `sweepZombieSlots` 扫掉），Steer 怎么点都没用。

### 3.3 runtime 日志铁证
- 13:04:09–13:04:22 thread `thread_mpw5sfg1ev3l9vzi` entry `fe99eb66` 收到 20+ 次 `/steer` 请求。
- 同窗口 `f211_reg6_invocation_abort`（`invocationTracker.cancel` **必打**的日志，`InvocationTracker.ts`）**一条都没有** → 证明 cancel 分支从没进 → `invocationTracker.has(steerCatId)=false` 全程成立。
- 同 thread 有活跃 draft `4b632d60`（13:03:38→13:04:55+），即占着执行槽的长回合。

### 3.4 附带观测缺口
`tryExecuteNextForUser` 返回 `!started` **无任何日志**（`return {started:false}` 直接返回），所以这个 QUEUE_BUSY 在日志里查不到"为什么"——本次定位靠"cancel 日志缺席"反推。

## 4. 修复方案（最终，race-safe — tombstone）

> 演进：R1 age-grace（砚砚放行）→ **云端 codex R3 P1 否决 age**：`create` await 的是 Redis `eval`，pre-start 窗口不被任何常量约束；age 启发式在 create 慢/卡时会误删合法 fresh slot → double-start。最终改用仓库**已有的 sound tombstone 机制**（`callback-a2a-trigger.ts:194-217`），不靠时间。

Steer immediate 按 `invocationTracker.has(steerCatId)` 分支：
- **`has()=true`（真 live 回合）**：`cancel` → `clearPause` + `releaseSlot` → 落到共享 `promote` + `processNext`（立即抢占启动）。**保留原行为**。
- **`has()=false`（无 live tracker 回合）**：slot 可能被一个**卡在 pre-start（create-await）窗口**的 executeEntry 占着（tracker 尚未 `startAll` 登记）。**绝不 force-release**（create 返回后那个 executeEntry 会继续 → double-start）。改为：
  1. `invocationQueue.findProcessingByCat(threadId, steerCatId)` 找到占 slot 的 in-flight entry；
  2. `removeProcessedAcrossUsers(inflight.id)` **tombstone** 它——executeEntry 在 `startAll` 后的 F216-c3 guard（`QueueProcessor.ts:856`）自检 entry 缺失 → routeExecution 前 `self-abort`（返回 `canceled_by_user`）→ 自己的 `.then` 清 slot；
  3. `promote` 被 steer 的 entry → 返回 **202 `PREEMPT_PENDING_PRESTART`（deferred）**；它在 in-flight executeEntry self-abort 后经 `onInvocationComplete → tryAutoExecute` 跑起来。
  - **race-safe**：无 slot 被 force-release，无时间启发式。pre-start 窗口任意长（含 stalled create）都安全——tombstone 始终让 executeEntry 在它实际推进到 startAll 时 self-abort。
  - 无 in-flight entry（slot 未被占）→ fall through 正常 `promote` + `processNext`。

**附带**：`tryExecuteNextForUser` 两个 `!started` 返回补 `queue_not_started` 诊断日志（reason: `processing_slot_busy` / `tracker_active`），堵观测缺口。

## 5. 验证（已完成）
- **route（real InvocationQueue）**：`queue-api.test.js` tombstone 测——in-flight A 占 opus slot + has()=false + steer B → A 被 tombstone（`findProcessingByCat` 转 null）、**不 force-release**、**不 cancel**、返回 202 `PREEMPT_PENDING_PRESTART`、B 被 promote。
- **finder 单元测**：`invocation-queue.test.js` `findProcessingByCat`——命中 processing+target、纯 queued 返回 null、错 cat 返回 null。
- 结果：queue-api + queue-processor + invocation-queue + 广回归（integration/slot-release/cancel/a2a-coalesce）**277/277**；tsc 0 error；biome 0 error。
- **不回归**：`has()=true` 仍走 cancel→releaseSlot→processNext 立即抢占（既有测试绿）。

**已放弃**：R1 的 `releaseStaleSlot(age grace)` 方案已删（云端 R3 P1 证其不 sound）。

### 云端 R3–R6 收敛结论（最终 sound 设计）
云端 6 轮系统性地证明了一个架构事实：**没有任何 age 阈值能 sound 地判断一个 has()=false 的占用 slot**。
- R3：slot 的 age 不行（`create` await 不被常量 bound）。
- R6：queue-entry 的 age 也不行（executeEntry 卡在 `create` stall >10min 仍可能 resume → 误判僵尸 → force-release → resume 后 double-start）。
- **推论**：占用 slot + has()=false ⟺ "executeEntry pending 在 create-await"——**慢但活** vs **已死** 在 steer 时**不可区分**（取决于 create 会不会返回，未知）。所以 **force-recover 一个卡住的 slot 根本不可能 sound**。

**最终 steer has()=false 分支**（`queue.ts`）：
- **跨用户 inflight**（P1-b）：owner check `inflight.userId !== guard.userId → 409 INVOCATION_ACTIVE`。
- **任何 inflight（不分 age）**：**TOMBSTONE**（`removeProcessedAcrossUsers`）+ 返回 **202 `PREEMPT_PENDING_PRESTART`**。executeEntry 在 create 返回时自检 self-abort → promoted entry 经 tryAutoExecute 跑。**绝不 force-release**（任何 age 都不 sound）。
- **无 inflight**：fall-through 正常 processNext。

**云端 R5「leak 恢复」的处置（push back，by design）**：递归 hung-forever-create（dead Redis）下 tombstone 无 executeEntry 可触发 → steered entry 卡到 75min sweep。这**不是可 sound 修复的 bug**——R6 证明任何 force-recover 都不 sound。该病态场景（整系统不可用）由 **75min zombie sweep + force-reset 端点**兜底，steer 非正确工具。这是**有意识的设计限制**，非缺陷。

回归测（queue-api 39/39）：has()=true cancel / 跨用户 409 / inflight（含 1h 老 entry）→202 tombstone 永不 force-release。

### 云端 R7 P1（已修）
tombstone 一个 user-sourced in-flight entry 时，其 messageId/mergedMessageIds 对应消息会永久卡 'queued'（executeEntry self-abort 发生在 markDelivered 之前）。镜像 withdraw/clear 的 F117 清理：tombstone 前收集 message ids，`markCanceled` + emit `message_deleted`。回归测：tombstone user entry → 消息标 canceled + message_deleted 发出（queue-api 40/40）。
