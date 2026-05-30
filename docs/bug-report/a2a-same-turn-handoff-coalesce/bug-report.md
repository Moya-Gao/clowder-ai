---
feature_ids: [F216]
topics: [routing, a2a, bug]
doc_kind: bug-report
created: 2026-05-30
---

# Bug Report: A2A 同 turn 对同一只猫连发两次 handoff，第一条先跑错

## 1. 报告人 / 怎么发现

铲屎官 2026-05-30 报（F216 thread，带截图）：

> 我发现了一个 bug 如果你 post msg at 了两次孟加拉。按道理应该合并在一起然后 at 他出来。但现在的效果是：你 at 他一次然后他干完了，然后你第二条消息又 at 了他一次……同时 at 了一只猫两次，其实你后续那个才是你真实意图。如果不是去重或合并一起发，孟加拉第一次会执行错误的行动，你的队友会被你误导。

现场截图：opus-48 对 @antig-opus 连发两条 `cross_post_message`——第一条让他「跑一会儿的多步骤任务」，第二条「打断，先别管总结，先回我三个问题」。孟加拉先执行了第一条（错误行动），再执行第二条。

对照：用户（landy）连发两条消息会在队列里合并/去重（`collectUserBatch`），agent A2A 路径没有这层。

## 2. 复现步骤

期望行为：同一 turn 内对同一只猫的多条 handoff → 合并成一条 / 后者覆盖前者，目标猫只看到最终意图。
实际行为：两条各自独立 dispatch，目标猫**串行执行两条**，先跑（可能错误的）第一条。

最小复现（红测，`packages/api/test/a2a-coalesce.test.js`）：
- 同一 caller 在一个 turn 内对同一 target 连发两条 A2A handoff。
- 断言：不应产生两个独立 invocation；后续 handoff 不应丢失。

## 3. 根因分析

`callback-a2a-trigger.ts` 的 A2A dedup（Guard 2）只调 `hasQueuedAgentForCat` —— **只匹配 `status==='queued'`**（注释明说"故意的，让 processing 时还能排新 handoff"）。

但 A2A entry `autoExecute: true`：`enqueueA2ATargets` enqueue 后**立即** `tryAutoExecute` → `markProcessingById` → 第一条几乎瞬间从 `queued` 变 `processing`。而连发的第二条要等第一次 callback 完整返回后才发出 → 第二条到达时**第一条已 `processing` 不是 `queued`** → dedup 失效 → 第二条照常 enqueue → 两条独立串行执行。

排除的方向：
- ❌「把 dedup 从 queued 扩到 processing」会让 bug 反向更糟——第二条会被 skip，而第二条恰是真实意图。
- ✅ 正确语义：queued → 合并；processing → 必须 abort 重启（supersede）。

## 4. 修复方案

**两段式，按修复点风险分层：**

### 已交付（本 PR，独立于 F216）：queued-merge
- `InvocationQueue.findInFlightAgentEntry(threadId, catId)`：两段扫描，**优先返回可合并的 queued entry**，否则 fresh-processing entry（忽略 zombie）。
- `InvocationQueue.coalesceContentIntoQueuedAgent(...)`：把新 content + messageId 合并进 queued agent entry（blank-line 分隔，对齐 `collectUserBatch`）。
- `callback-a2a-trigger.ts` Guard 2：queued → 合并；processing → enqueue follow-up（不丢真实意图），后续 handoff coalesce 进该 follow-up（不产生无界重复）。

放弃的备选：在 dispatch 层直接硬接 abort+releaseSlot+clearPause+重 enqueue。原因：会和后台 `executeEntry` cleanup 抢 `processingSlots` mutex = F216 硬约束 #2 警告的 LL-064 式堆补丁。

### 归 F216 Phase D：processing-supersede
主场景（第一条已 processing）需要 abort 正在跑的 + follow-up 重启。这条 abort→slot cleanup→pause→resume 时序与 routeSerial/QueueProcessor abort-resume 坐标系同源，在 F216 干净坐标系上一次做对。已写入 F216 spec AC-D1~D4。

## 5. 验证方式

- 红→绿：`packages/api/test/a2a-coalesce.test.js`（11 测试）复现 bug，修复后全绿。
- 回归：`callback-a2a-trigger.test.js`（dedup 测试改为 coalesce 契约）+ `invocation-queue.test.js` 零回归。合计 53 测试全绿。
- typecheck `tsc --noEmit` 绿；biome 我新增代码 0 新 warning（既有 9 warning 是 F216 待清理债）。
- ⏳ 真实 runtime 验证（LL-064）：queued-merge 路径需 alpha 实测；processing-supersede 随 F216 Phase D 验。

## §16e Failure-Mode Sweep（46 review R1 P1 驱动补做）

**承认失误**：R1 我只修了 trigger 的 Guard 2，没做 failure-mode sweep。46（reviewer）抓到平行入口 `callback-multi-mention-routes.ts:131` 用同一个 `hasQueuedAgentForCat`，是"补锅匠"病（战术勤劳掩战略懒惰）。补做如下。

- **Pattern（不变量）**：A2A queue dispatch 的同猫去重只认 `status==='queued'`，漏 `processing`（因 A2A entry `autoExecute=true` enqueue 后立即转 processing）。
- **Scanned**：`grep hasQueuedAgentForCat packages/api/src` = 3 处命中：

| 位置 | 处置 | 理由 |
|------|------|------|
| `callback-a2a-trigger.ts` Guard 2 | ✅ FIXED（coalesce） | same-turn handoff = 同 caller 合并意图，coalesce 语义正确 |
| `callback-multi-mention-routes.ts:131` | ⚠️ N/A coalesce + 记录独立隐患 | 见下方语义论证 |
| `QueueProcessor.ts:295` | N/A | thin wrapper（`return this.deps.queue.hasQueuedAgentForCat(...)`），转发非决策点 |

### 为何 multi-mention **不能**套同一个 coalesce 修复（Feature Gate 拦截）

multi-mention 是 **fan-out-and-collect** 语义，与 same-turn handoff coalesce 相反：

1. `dispatchViaQueue`（line 147-164）：hook 经 `registerEntryCompleteHook(result.entry.id, ...)` 注册，**只在产生新 entry 时**注册；hook 触发才 `orch.recordResponse(requestId, catId)`。每个 requestId 要独立收齐每只 target 猫的回答才 flush。
2. 若套 coalesce（合并进已有 entry、不产生新 `result.entry`）→ 第二个 requestId 的 hook **注册不上** → 它的 orchestrator 永远等不到该猫回答 → timeout。**改完核心路径死了**（Feature Gate）。
3. multi-mention line 131 在 `processing` 时"漏 skip"→ 重复 enqueue → 各 requestId 各绑各的 hook 各自收答 —— 这恰是 fan-out **想要的正确行为**，不是 bug。

### multi-mention 的真正隐患（独立、方向相反、pre-existing）

它真正可疑的是 **`queued` 时"误 skip"**：requestId-2 在该猫还 queued（未开跑）时被 `hasQueuedAgentForCat` skip → requestId-2 没注册 hook → 收不到该猫回答 → 等到 timeout（空回答，summary 缺失）。

- 方向与本 bug **相反**：本 bug 是"漏 skip→重复执行误导队友"；multi-mention 是"误 skip→请求卡到 timeout"。
- 来源：`646d6aa40 feat(F122): B6 multi_mention dispatch via InvocationQueue (#536)`，pre-existing，非本 PR 引入。
- 归属：multi-mention **不走 routeSerial**，不属 F216；coalesce 修不了它（反而恶化）。需要独立评估其 dedup-vs-hook 设计（支持同猫多请求 fan-out / 显式串行）。**建议独立 backlog 条目，待 reviewer 共识 + CVO signoff，不硬塞本 PR 也不硬塞 F216。**

### P2 处置

`A2ATriggerDeps` 的 Pick 删除死引用 `hasQueuedAgentForCat`（trigger Guard 2 已不用）。✅ DONE。

## 云端 codex review R4（merge-gate 串行云端那一棒，2 个真 finding）

本地 46 三轮 review 通过 + 全量 gate 绿后触发云端 codex review（HEAD bde2a79aa），codex 抓到 2 个本地 review + gate 都漏的真 finding：

### P1（InvocationQueue.ts findInFlightAgentEntry）— coalesce 必须限定 sourceCategory
`findInFlightAgentEntry` 只 match `source === 'agent'`，但 self-continuation entry（`QueueProcessor.enqueueContinuation`）**也是** `source: 'agent'`（`sourceCategory: 'continuation'`）。后果：cat 有 queued continuation 时，A2A handoff 被误并进 continuation prompt → 混入不相关控制流内容 + 抑制真正的 A2A 路由。
- 失败模式：又是「没穷尽数据类型的所有来源」——我只看 `source: 'agent'` 没区分 `sourceCategory`，而代码库 `isSystemPinnedQueueEntry`/`normalizedPriority` 早有区分先例。
- 修复：`findInFlightAgentEntry` + `coalesceContentIntoQueuedAgent` 双层限定 `sourceCategory === 'a2a'`（defense-in-depth）。测试：continuation 不被合并 + both-exist 时选 a2a。

### P2（callback-a2a-trigger.ts emit）— coalesce 改 content 必须 emit queue_updated
coalesce 改 `entry.content`，但 emit `queue_updated` 原 gating on `enqueued.length>0` → 纯 coalesce 不 emit。前端 `QueueEntryRow` 渲染 `entry.content`、`QueuePanel` 从 `queue_updated` 刷新 → 用户看 stale 合并前内容。
- **这推翻了 46 R3 和我的判断**：我俩都说「coalesce 无可见 delta」，但漏了前端渲染依赖 content 字段。云端无运行环境但静态数据流追对了。
- 修复：emit 门控 `enqueued` → `handled`（enqueued ∪ coalesced）。测试：coalesce 触发 queue_updated + 携带合并后 content。

### 教训（本 PR 反复出现，值得沉淀）
- **「只看改的文件/字段、不追全数据来源与下游消费」failure mode 出现 3 次**：R1 漏 multi-mention sweep（46 抓）、gate 抓 callbacks routed 契约、云端抓 continuation source + 前端 content 渲染。§16e sweep 不能只 grep 消费方，还要 grep 同字段的所有**生产方**（哪些地方产生 `source:'agent'` entry）。

## 即时缓解（行为层，不依赖代码）

猫别在一个 turn 内对同一只猫连发矛盾的两条 handoff——想改主意先把完整意图想清楚再发一条。
