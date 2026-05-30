# Review Request: A2A same-turn handoff coalesce (queued-merge)

**Author**: 宪宪 / Opus-4.8
**Reviewer**: @gpt52 (GPT-5.4, 跨族缅因猫)
**Branch**: `feat/a2a-coalesce`
**Review-Target-ID**: `a2a-coalesce`
**Commit**: `c9f98513a`

## Original Requirements（铲屎官原话，2026-05-30 F216 thread）

> 我发现了一个 bug 如果你 post msg at 了两次孟加拉。按道理应该合并在一起然后 at 他出来。但现在的效果是：你 at 他一次然后他干完了，然后你第二条消息又 at 了他一次……同时 at 了一只猫两次，其实你后续那个才是你真实意图。如果不是去重或合并一起发，孟加拉第一次会执行错误的行动，你的队友会被你误导。

来源：F216 thread 实时对话 + 现场截图（opus-48 对 @antig-opus 连发两条 cross_post）。
完整诊断：`docs/bug-report/a2a-same-turn-handoff-coalesce/bug-report.md`

**请 reviewer 对照判断**：queued-merge 是否真的让"后续那条才是真实意图"不丢失？

## Architecture Ownership

- **Architecture cell**: `routing`（A2A dispatch 层，非 routeSerial 本体）
- **Map delta**: none — 没有新建并行 Store/Queue/Router/Adapter，只给既有 `InvocationQueue` 加两个查询/合并方法 + 改 `callback-a2a-trigger` Guard 2 分支
- **Why**: 修复 A2A dispatch 缺失的 same-turn coalescing（用户消息有 `collectUserBatch`，agent 路径没有对等层）

请 reviewer 确认 diff 与 `Map delta: none` 一致（无并行基础设施）。

## What changed

1. `InvocationQueue.findInFlightAgentEntry(threadId, catId)` — 两段扫描：**优先**返回可合并的 `queued` entry，否则 fresh（非 zombie）`processing` entry。两段顺序是关键：当一只猫同时有 running + queued-follow-up 时，第三条 handoff 必须 merge 进 queued follow-up 而非再生一个 entry。
2. `InvocationQueue.coalesceContentIntoQueuedAgent(...)` — 把新 content（blank-line 分隔，对齐 collectUserBatch）+ messageId 合并进 queued agent entry；processing 时返回 false。
3. `callback-a2a-trigger.ts` Guard 2 — 旧的 skip-dedup（只匹配 queued、processing 时漏过 → bug）改为：queued→合并；processing→enqueue follow-up（不丢真实意图）。

## Scope 边界（重要，请 reviewer 确认分层合理）

- **本 PR = queued-merge**（第一条还没开跑）：无 abort、无 race，纯队列内合并。
- **processing-supersede（第一条已开跑，主场景）归 F216 Phase D**：唯一正确解是 abort 正在跑的 + follow-up 重启，这条 abort→slot cleanup→pause→resume 时序与 routeSerial/QueueProcessor abort-resume 坐标系同源；独立硬接会和后台 `executeEntry` cleanup 抢 `processingSlots` mutex = F216 硬约束 #2 警告的 LL-064 式堆补丁。已写入 F216 spec AC-D1~D4。

**技术 OQ（给 reviewer）**：interim 行为——processing 时 enqueue follow-up 而非 supersede。follow-up 会在第一条（可能错误的）handoff 完成后才跑。这个 interim 是否可接受，还是你认为 supersede 必须本 PR 就做（不等 F216）？我的判断是分层更安全，但这条边界想听你的。

## 自检证据

- **测试**：`node --test test/a2a-coalesce.test.js test/callback-a2a-trigger.test.js test/invocation-queue.test.js`
  → `tests 145 / pass 145 / fail 0`（a2a-coalesce 11 新测试红→绿；callback-a2a-trigger 的 dedup 测试改为 coalesce 契约；invocation-queue 零回归）
- **typecheck**：`tsc --noEmit` 绿
- **biome**：我新增的两个 src 文件 0 新 warning（`callback-a2a-trigger.ts` line 69/185/503 的 3 个复杂度/non-null warning 是预存的，不在我改动区；`STALE_QUEUED_THRESHOLD_MS` deprecation 也是预存自引用）
- **根目录工件闸门**：working tree CLEAN + committed diff CLEAN

## 如果我判断错了，最可能错在哪

1. **interim follow-up 语义**：processing 时 enqueue follow-up，万一第一条 handoff 跑很久，follow-up 会延迟很久才纠正——也许 demo 主场景需要更激进的即时 supersede（但那碰 F216 雷区）。
2. **两段扫描的 queued 优先**：是否有边界情况下 fresh-processing 才是正确合并目标？我假设 queued 永远优先（可 in-place merge 无副作用），但没穷举多 entry 排列。
3. **mergedMessageIds 的下游消费**：合并的 messageId 进 `mergedMessageIds`，delivery/ack 是否真覆盖到？我读了 `executeEntry` 的 allMessageIds 聚合（QueueProcessor.ts:834）认为覆盖，但没端到端验。

Review-Target-ID: a2a-coalesce
Branch: feat/a2a-coalesce
