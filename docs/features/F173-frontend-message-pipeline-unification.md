---
feature_ids: [F173]
related_features: [F081, F123, F164, F047, F117]
topics: [frontend, thread-runtime, message-pipeline, liveness, cancel-button, queue-gating, state-machine, ghost-bubble, cli-resolve, hydration]
doc_kind: spec
created: 2026-04-22
---

# F173: 前端 Thread-Runtime State 统一（消除 dual write-path & liveness fragmentation）

> **Status**: reopened 2026-04-26 11:30 (was closed 07:30) | **Owner**: 布偶猫 | **Priority**: P0
>
> **Reopen reason 2026-04-26 11:30**: 铲屎官 push back — "F177 stub 是 follow-up 话术包装，debt = never，TD = never，检查出来没完成的为什么不直接闭环？"。原 close 时把 deferred AC-B2 (handler unification) 抽出去开 F177 stub 的做法被识别为**虚假闭环**：feat 没真完成，只是把没完成的部分藏到一个新的 stub spec 文件里。**reopen，handler unification 必须做完才真闭环**。F177 stub 已删。
>
> **What 还没做**: KD-1 handler unification — `handleBackgroundAgentMessage` (~500 行 useSocket-background.ts) 业务逻辑迁移到 thread-aware `useAgentMessages`，消除 active vs background event handler 双路径。新增 Phase E AC-E1/E2 见下文。
>
> **PR 链 (主线已 merged)**：#1347 Phase A → #1379 hotfix3 → #1391 Phase B-3 fixture → #1399 PR-A1 → #1400 PR-A2 → #1405 PR-A → #1411 PR-B Task 9 → #1413 PR-B-2 → #1416 PR-C → #1417 Phase D → 🚧 Phase E 待开 (handler unification)。
>
> **闭环 closed 2026-04-26 07:30 段已撤销**（保留 Closure 时的 attempt 描述供 audit trail）：~~主线愿景达成 (KD-2 mirror invariant 全收口...)。AC-B2 (handler unification) deferred → F177 接棒 — gpt52 愿景守护 P1: defer 必须留可点开的 follow-up anchor~~ — 这套话术被铲屎官 11:30 识破，handler unification 是没完成不是 deferred，stub anchor 是 follow-up 包装不是真闭环。
>
> **Phase A merged 2026-04-23 (PR #1347, squash 3feae9563)**：mirror invariant + 单指针 routing + deterministic bubble id + invocation-driven suppression cleanup（含 fail-open）。Phase B/C/D 留 follow-up PR。
>
> **Phase A hotfix merged 2026-04-23 (PR #1352, squash b4e46761d)**：close ea0973e7 ghost — explicit invocationId threaded through all event entry points (text/tool_use/tool_result/done/error/web_search/thinking/rich_block/invocation_created). 砚砚 LGTM-6 cycles + 9 cloud Codex P1 fix cycles. CVO 2026-04-23 拍板将剩余 multi-failure race scenarios (lost done + lost invocation_created + reconnect/hydration) defer 进 Phase B (AC-B5..B10) — thread-scoped runtime consolidation 会从结构上消除这些场景。
>
> **Phase A hotfix2 merged 2026-04-24 (PR #1364, squash da928015e)**：close clowder-ai#573 dup-bubble — stream + callback + persistence 三条路径在同一逻辑响应的 invocation identity 上收口（统一用 OUTER `parentInvocationId ?? ownInvocationId`）。Hotfix 后 1352 的前端 dedup 把 dup 从偶发暴露为 100% 复现，根因是 QueueProcessor:761 broadcast 用 OUTER、route-serial/callbacks 持久化用 INNER 的 split-brain。Codex P1（A→B→A re-enqueue cross-turn merge）实测验证为 broadcast-layer pre-existing 行为，本 PR 不引入新 regression — 真要分 turn 显示需另立 Feature 改 broadcast 契约 + bubble identity。
>
> **Scope 扩展（2026-04-22 22:05 铲屎官指示）**：原 scope 仅 message pipeline；新事故诊断把 cancel 按钮缺失 / queue gating 失效 / spawn ENOENT 三个症状同源到 **liveness truth source fragmentation**，与 message dual-write 是同一个病。铲屎官原话："不要小修小改"——一锅端。

## Why

### 触发事故（同 thread / 同 day / 同根因家族）

| 时间 | 现象 | 当时归因 |
|------|------|---------|
| 4-22 21:42 | F5 后基本每个气泡都裂 | message pipeline dual write（active vs background handler） |
| 4-22 21:55 | 砚砚正在 streaming 但前端 cancel 按钮没出 + 同时发消息走 normal send 不是 queue+steer | 前端 `hasActiveInvocation` 与"视觉上砚砚在流式输出"不是同一真相源 |
| 4-22 21:55 | 后端走 immediate spawn 而不是 queue → spawn `/opt/homebrew/bin/codex` ENOENT | 后端 `invocationTracker` 无 entry 判 hasActive=false；同时 `cli-resolve.ts` 进程内永久 resolvedCache 命中 stale 路径（codex 软链 21:54 被 brew/npm 重建） |
| 4-21 | stuck-after-cancel | 同类 liveness 漂移 |

### 根因：thread-runtime state 没有 single source of truth

**前端至少 5 处并行存 liveness**：
- `chatStore.hasActiveInvocation` (flat) — `ChatInputActionButton` 读这个判 cancel/queue
- `threadStates[tid].hasActiveInvocation` — per-thread 拷贝，`snapshotActive`/`flattenThread` 双向搬运
- `catStatuses[catId]` / `catInvocations[catId]`
- `activeInvocations` (per-invocation map)

**后端 2 处**：
- `invocationTracker`（进程内 Map，`messages.ts:404-413` 判 hasActive 用这个）
- `invocationRecordStore`（Redis，跨进程真相）

**Socket event 任一 drop / 乱序 / F5 hydration race** → 5 个前端字段各自漂移。"视觉看到砚砚在流" ≠ "store 认 hasActiveInvocation=true" ≠ "invocationTracker 有 entry"，三者独立可以同时不一致。

### 不能只修 message pipeline

F173 v1 只管 message bubble pipeline → cancel 按钮 / queue gating 这条链不会被自动修好——它读的是 `hasActiveInvocation`，不是 message 字段。同一类 dual write-path 病，要一锅端。

### 历史证据 + 反复修复

F081 Risk #1 早已预言："**写路径分散导致修复互相覆盖**"。
- F164（IndexedDB cache，2026-04-16）→ ghost bubble 涌现
- #1261（2026-04-19）修 IDB 占位过滤
- #1310（2026-04-21）修 watchdog 清 ghost stream
- 砚砚 4-21 修 active-handler callback 不收 invocationless rich placeholder
- F39 force-send（2026-02-27）也是同源 liveness 漂移

铲屎官原话（2026-04-22 21:44）："有问题你为什么不直接走 p2？呢？ 你是不是又在绕路和做脚手架了呢？"
铲屎官原话（2026-04-22 22:05）："不要小修小改！！"

**P0 = 消除 thread-runtime state 双轨制**——messages + liveness 一起，不是再加 dedup 补丁。

## What

### 现状（dual write-path + liveness fragmentation）

| 维度 | Active 路径 | Thread-scoped 路径 | 真相源问题 |
|------|------------|-------------------|----------|
| messages | flat state.messages, `activeRefs`, `catInvocations` (active handler) | `threadStates[tid].messages`, `bgStreamRefs` (background handler) | dual handler 双指针 race → ghost bubble |
| hasActiveInvocation | flat `chatStore.hasActiveInvocation` | `threadStates[tid].hasActiveInvocation` | snapshotActive/flattenThread 双向搬运不原子 |
| catStatuses / catInvocations | flat | per-thread copy | 同上 |
| activeInvocations | flat | per-thread copy | 同上 |
| 后端 hasActive | `invocationTracker`（进程 Map） | `invocationRecordStore`（Redis） | tracker 无 entry 但 record 存在/反之 → gating 误判 |
| spawn 路径解析 | `cli-resolve.ts` `resolvedCache: Map<string,string>` | — | 永久缓存，从不清空；软链/二进制 rebuild 后 ENOENT |

> **设计校准（砚砚 push back 2026-04-22）**：chatStore 中 `threadStates[currentThreadId]` 只是 thread switch 时的 snapshot，不是持续真相源；大量 `addMessageToThread`/`setThreadCatInvocation`/`setThreadLoading`/`addThreadActiveInvocation`/`setThreadIntentMode`/`setThreadTargetCats` 都内置 `threadId === currentThreadId` 分叉，仍然把 active 写到 flat（`chatStore.ts:53,1365,1390,1572,1645,1683,1746,1768,1843`）。F123 也已拍过 "shared helper + invariant 渐进，不把统一 MessageWriter 当前置" 路线（`F123:45,140`）。所以 P0 的直线是**先把所有 thread-runtime 写入收口到一个 thread-scoped writer**，flat 降级 compatibility mirror。**不**在 Phase A 把"删 flat"和"统一 writer"绑成一刀。

### Phase A: ThreadRuntimeWriter 收口（messages + liveness） + socket routing 统一

1. **统一 ThreadRuntimeWriter**（前端核心）：
   - **Messages 通道**：`writeThreadMessage / patchThreadMessage / appendThreadStreamChunk / appendThreadToolEvent / setThreadStreaming / replaceThreadMessageId`
   - **Liveness 通道**：`setThreadCatInvocation / addThreadActiveInvocation / removeThreadActiveInvocation / setThreadHasActiveInvocation / setThreadLoading / setThreadIntentMode / replaceThreadTargetCats / setThreadCatStatus`
   - 所有写入只走 thread-scoped 路径，flat state 在同一 `set()` 内由 writer 同步镜像（compatibility mirror）
2. **Socket routing 收口**：`agent_message` / `intent_mode` / `spawn_started` 都改用单一 handler，决策只看 `msg.threadId`，删除 `routeThread` (ref) vs `storeThread` (zustand) 双指针 guard（race 根因）
3. **Handler 合并**：`handleAgentMessage` + `handleBackgroundAgentMessage` 合为单一入口，按 `msg.threadId` dispatch 给 ThreadRuntimeWriter；background system info / toast / 进度等"非 writer 副作用"继续保留
4. flat state.messages / hasActiveInvocation / catStatuses / activeInvocations 等**保留**作 compat mirror，不在本 phase 删；读侧组件继续读 flat 不动

### Phase B: refs 全量纳入 thread-scoped runtime + background 瘦身

1. `useAgentMessages` 里所有 runtime refs 整体收口为 `Map<threadId, ThreadRuntimeRefs>`，每个 entry 至少含：`active / finalized / replaced / sawStreamData / pendingTimeoutDiag / timeoutHandle / lastTouched`。**保持 runtime-only，不进 zustand**。
2. `useSocket-background.ts` 瘦身为 ≤ 30 行 shim（仅做 toast/进度等非 writer 副作用），message creation 路径全部走 Phase A 的 ThreadRuntimeWriter。
3. GC 策略：① thread delete 硬删；② `done/error/callback replace/resetThreadInvocationState/reconnect reconcile` 后若该 thread 无 active slots 且 refs 全空 → 立刻删；③ `setCurrentThread`/reconnect 时 sweep 一次长 idle entry。**不引入后台定时器**。

### Phase C: 读侧 selector 迁移 + hydration 简化 + 前后端 liveness 对齐

1. **读侧组件迁移**：从 flat state 切换到 thread-scoped selector（`useThreadMessages(threadId)` / `useThreadLiveness(threadId)` 等），用 zustand `subscribeWithSelector + shallow` 控制重渲染。**`ChatInputActionButton`** 必须从 selector 读 hasActiveInvocation，禁止读 flat 字段。
2. **`mergeReplaceHydrationMessages`** 删除 ghost-tolerance 分支（来源不再产生 ghost）。
3. **前后端 liveness reconcile**：`fetchQueue` 拿到的 `activeInvocations` 必须直接覆盖 thread-scoped state，不再"if currentThread 才写"分叉；socket reconnect 触发的 `reconcileInvocationStateOnReconnect` 与 backend `invocationTracker.list()` 对齐，单一 reconcile 路径。
4. 跨场景回归测试（F5 / thread switch / socket reconnect / cross-post / 并发多猫 / cancel-during-stream / queue+steer）全绿。
5. F081 AC-B2 关闭。

### Phase D: 环境/缓存防腐（cli-resolve）

> 与 thread-runtime state 是不同 layer，但同事故现场 + 铲屎官"不要小修小改"指示 → 一锅端。

1. **`cli-resolve.ts` cache invalidation**：spawn ENOENT 时 `resolvedCache.delete(command)` 让下次重解析；可叠加 file mtime 校验（每次命中前 stat 一下，mtime 变了重解析）。
2. 加单测覆盖"软链/二进制 rebuild 后 ENOENT 必须自愈"。

### Phase E（可选 / TD）: flat compat layer 退休

如果 Phase C 完成后 flat state 已无独立读者，开一个轻量 TD 移除 flat mirror。**不在 F173 主路径强制做**。

## Acceptance Criteria

### Phase A（ThreadRuntimeWriter + Routing）— ✅ Merged PR #1347 (squash 3feae9563, 2026-04-23)
- [x] AC-A1: ThreadRuntimeWriter helpers (`mirrorActiveToThreadStates` + `mirrorActiveFlat`) 收口所有 thread runtime 写入
- [x] AC-A2: `agent_message` / `intent_mode` / `spawn_started` 走单指针 routing（删 `routeThread` vs `storeThread` 双指针 guard）
- [x] AC-A3: flat state 由 writer 在同一 `set()` 内同步镜像（compatibility mirror）
- [x] AC-A4: chatStore 所有 `setThreadX` + flat `setX` active 分支全部走 mirror helper
- [x] **A.3 deterministic bubble id**: `deriveBubbleId(invocationId, catId)` 让两个 handler 创建同一 bubble id 一致 → hydration merge 自然 dedup
- [x] **A.6 shared replaced-invocations module**: 双向 suppression handoff（process-singleton Map）
- [x] **A.12 invocation-driven cleanup**: navigation 不清，invocationless flow fail-open 防永久 drop

### Phase B（runtime refs 收口 + background 瘦身）
- [ ] AC-B1: 所有 runtime refs 合并为 `Map<threadId, ThreadRuntimeRefs>`（active/finalized/replaced/sawStreamData/pendingTimeoutDiag/timeoutHandle/lastTouched），保持 runtime-only
- [ ] AC-B2: ~~`useSocket-background.ts` 缩为 ≤ 30 行 shim~~ ~~**重新规划 2026-04-25**: end-state 是 0 行（删除整文件），不留 shim~~ ~~**再次重新规划 2026-04-26 (deferred / re-scoped → F177 接棒)**~~ — **2026-04-26 11:30: F177 stub 撤销，handler unification 直接做，归到 Phase E (AC-E1/E2)**。PR-D 开工实地审计揭示 `handleBackgroundAgentMessage` (~500 行) 不是 dead code，是 active live runtime path；删整文件等价于 KD-1 handler unification。把它抽到 F177 stub 是话术包装，铲屎官 push back: debt = never。归到 Phase E 直接做。`recoverStreamingMessage` / `ensureBackgroundAssistantMessage` / `shouldSuppressLateBackgroundStreamChunk` / `markThreadInvocationActive/Complete` 不是 Phase C 后才 dead 的，它们是 `handleBackgroundAgentMessage` 的内部 helper，被 ~500 行 live business logic（active→bg stream 恢复 / callback replacement / late chunk suppression / tool placeholder / toast/status）调用。Phase C 关闭了 **writer 端**双路径（KD-2 mirror invariant），但 **event handler 端**（active 走 useAgentMessages.onMessage / background 走 handleBackgroundAgentMessage）仍是双实现。删整文件需要把 background handler 业务逻辑迁到 thread-aware useAgentMessages，是真正的 KD-1 handler unification 改动，不是 cleanup，单独立项再做。Phase C 主线（read 收口 + writer 收口 + hydration 收口 + liveness 收口）至此完成。
- [ ] AC-B3: GC 三规则就位（delete 硬删 / done+empty 立刻删 / setCurrentThread+reconnect sweep idle）
- [ ] AC-B4: thread switch 不再触发 ghost bubble（fixture 验证）— **重新规划 2026-04-25**: fixture 抽出作为 pre-Phase C 独立小 PR（B-3 fixture）由宪宪 own，给 Phase C 大改动提供回归基础设施。**Fixture 已 merged via PR #1391 (squash `94180b490`, 2026-04-25 09:42)**：3 条 invariant 锁定（routing isolation / concurrent isolation / terminal correctness），Phase C 改 hydration 时此 fixture 必须保持绿。AC-B4 完整闭合（含真实 race window 修复）等 Phase C。

#### Phase B Backlog: 双失/三失场景 race（hotfix PR #1352 cloud Codex 累积发现）

`fix/f173-phase-a-hotfix` 是 Phase A merge 后的 ea0973e7 ghost hotfix。修了 8 处 fix（4-piece + 4 cloud P1）后云端 Codex 仍持续发现"done lost + invocation_created lost + reconnect/hydration"等多失场景的 race。铲屎官 2026-04-23 拍板：hotfix 现在 ship（原 ea0973e7 已修），剩余 race 进 Phase B 与 ledger consolidation 一并解决（thread-scoped runtime refs 会从结构上消除这些场景）。

下表是 Phase B 必须覆盖的 follow-up backlog（来自 PR #1352 cloud Codex review 的真实 finding）：

- [ ] **AC-B5**: invocationless 终端事件（legacy `done`/`error` 无 `msg.invocationId`）在 `activeRefs` 已 clear（thread switch / hydration）后必须能 finalize 已 bound 的 streaming bubble；当前 hotfix 的 Loop 2 unbound fallback 拒绝 bound bubble，导致 stuck-streaming 状态（cloud P1#10）。
- [ ] **AC-B6**: `invocation_created` boundary 路径下 `markReplacedInvocation` 已升级为 `Set<invocationId>`，但旧 invocationId 只在 thread-level cleanup 时整体清掉；长会话下应在"该 invocation 真正 terminal + confirm-no-late-window"后用 `removeReplacedInvocation` 做细粒度回收，避免内存/维护债（砚砚 LGTM-5 非阻塞观察 + cloud P2 multi-value）。
- [ ] **AC-B7**: 多个 stale unbound bubble 共存（reconnect / hydration）时，`invocation_created` 只 rebind 最新一个；其他 unbound bubble 应被 finalize 或 GC，不能继续作为"unbound 抽奖池"被 callback / late event 误捕。
- [ ] **AC-B8**: callback path 的 strict-callback 契约（clowder-ai#305 absorb）与 stream→callback 关联机制需要在 thread-scoped runtime 重写，目前依赖 `extra.stream.invocationId` 严格匹配 + activeInvocations fallback 兜底，结构脆弱。
- [ ] **AC-B9**: `shouldSuppressLateStreamChunk` 当前用"explicit `msg.invocationId` 优先 / 无则 catInvocations 兜底"+"surgical clean stale catInvocations"组合（cloud P1#6）。Phase B thread-scoped runtime 应直接用 `lastObservedExplicitInvocationId` 替代 catInvocations 兜底，消除 surgical clean。
- [ ] **AC-B10**: 终端 permissive fallback 的 binding policy 现在用 slot-fresh 信号差异化（slot-fresh confirmed → 任何 streaming bubble；否则 → 仅 binding 匹配 / unbound）。Phase B 应让 `isStaleTerminalEvent` 显式返回 confirmation source，避免在 callsite 重新计算 slot-fresh。

**Phase B 不需要逐条修这 6 条 AC**——thread-scoped runtime + ledger consolidation 完成后，这些 race 应该从结构上消失（每个 thread 单独的 runtime entry，不再共享可变 refs）。AC-B5..B10 是验收清单，不是单独修复任务。

### Phase C（读侧迁移 + hydration 简化 + liveness 对齐）
- [ ] AC-C1: 关键读侧组件（ChatContainer/MessageList/RightStatusPanel/MissionHub/**ChatInputActionButton**）改为 thread-scoped selector
- [ ] AC-C2: F5 后 0 ghost bubble（fixture 含 race window）
- [ ] AC-C3: socket reconnect 期间收的 events 在重连后正确合并到现有 bubble，不裂
- [ ] AC-C4: cross-post + 当前 thread stream 同时进行不裂
- [ ] AC-C5: `mergeReplaceHydrationMessages` 简化（移除 ghost-tolerance 分支）
- [ ] AC-C6: **cancel 按钮一致性**：只要后端 `invocationTracker` 有 entry，前端 `hasActiveInvocation` 必为 true（fixture 验证 socket-drop / F5 / reconnect 三场景）
- [ ] AC-C7: **queue gating 一致性**：发消息时前端门禁与后端门禁判定结果一致（fixture 验证）
- [ ] AC-C8: F081 AC-B2 (Remaining Gaps) 关闭
- [ ] AC-C9: ~~**历史 dup tolerance**~~ — **降级 P3 / deferred 2026-04-25**（来源：Phase C Task 0 Spike 真实数据）。原 spec 假设的 "时间窗 < 5s + content prefix overlap" 模糊匹配在真实数据里**不存在**（sample last 200 msgs of `thread_moay5tqumsbu17yr`，10 个 candidate dup pair 的 ts gap 全部 ≥15s，p50=31s，没有任何 < 5s pair）— 这些都是 user-driven 连续对话节奏，不是 OUTER/INNER race。模糊视觉合并会**误合并正常多轮回复**（false positive 比历史脏数据残留更糟）。**新方向**：仅在精确 metadata（`parentInvocationId` / `userMessageId` / `<100ms + 近 100% prefix`）能识别时才处理；hotfix2 之后写入路径已收口，不再产生新 race dup；历史脏数据用户清 site data 即可（与 AC-C10 IDB cache 覆盖一起处理）。详见 `docs/plans/2026-04-25-f173-phase-c.md` Spike Result 段。

### Phase D（cli-resolve 防腐）
- [x] AC-D1: `cli-resolve.ts` 双管齐下：缓存命中时 `existsSync(cached)` 自维护 + 导出 `invalidateCliCommand(commandOrPath)` 显式信号（cli-spawn 的 ENOENT handler 自动调用，by-key 和 by-resolved-path 都支持） — PR #1417
- [x] AC-D2: 单测覆盖"binary 删除后自愈" + "invalidate by absolute path"（双路径都钉） — PR #1417

### Phase E（KD-1 handler unification — reopen 后新增）
- [ ] AC-E1: `useSocket-background.ts:handleBackgroundAgentMessage` 业务逻辑 (~500 行 stream/callback/error/toast/late-suppression/cat-status) 迁到 thread-aware `useAgentMessages`；`useSocket.ts:485-534` 的 `if (isActiveThreadMessage) ... else handleBackgroundAgentMessage(...)` 双路径合并为单一 thread-aware handler 调用
- [ ] AC-E2: 5 场景 fixture 复用 PR #1391/#1413/#1416 已有 + 新增 cross-thread message handoff fixture（确保 active→bg→active 切换时 stream key 追踪 / callback replacement / late chunk suppression 不裂）。F173 PR #1418 a2a_handoff hotfix 的 marker-gated insert 在 unified handler 中验证可简化（hotfix 自己注释提到这一点）
- [ ] AC-E3: **`thread_mo6icfmm74ma9vkw` 复现的"前端渲染裂气泡"消失**——铲屎官 2026-04-26 11:45 报告 thread mo6 里 Opus 4.6 在 04/25 22:58 同时刻显示两个内容相同的气泡 (Thinking + CLI Output 20 tools 1m38s, 同 token 同 cached %)。后端 Redis 38 条 messages 全是 timestamp-prefix style，**store 干净没 race 痕迹**——裂在前端 store 创建了两个 bubble id（active path 和 background path 同时给同一 server message 各创建一份）。Phase E 单一 handler 落地后单一 bubble id 创建路径，此类症状从结构上消失。fixture 必须钉住"thread switch 后收到原 active thread 的 stream + callback 不再产生重复 bubble"

## Dependencies

- **Evolved from**: F081（write-path audit 已识别 dual-pipeline 风险，AC-B2 未闭合）
- **Related**:
  - F123（bubble runtime correctness fixture matrix）
  - F164（IndexedDB cache，ghost bubble 涌现源头之一）
  - F047（Queue Steer，liveness 漂移导致 queue gating 失效）
  - F117（Delivery Lifecycle，invocation 生命周期一致性）

## Risk

| 风险 | 缓解 |
|------|------|
| Scope 扩太大（messages + liveness + cli-resolve）回归面广 | Phase A/B/C/D 分阶段合入，每段独立 alpha 验收；fixture matrix 跑全；cli-resolve 是独立 sidecar 可以单 PR 先合 |
| zustand selector 派生 flat state 性能下降 | subscribeWithSelector + shallow equal；benchmark 关键 hook 渲染次数 |
| 删 background handler 路径影响 multi-thread split-pane / mission-hub | split-pane / mission-hub 监听本就用 threadStates，路径统一后更一致；保留 background 行为（toast/进度），删的是 message creation 路径 |
| ChatInputActionButton 改 selector 后 cancel/queue/normal 三态切换有边缘 case | 先把现状 fixture 化（F123 matrix 扩 cancel/queue/normal 矩阵），改完跑全 |
| 后端 invocationTracker ↔ Redis record 也存在分裂（不在 F173 直接修） | 留 Open Question OQ-3，后端 liveness 收口可能需要独立 feat（隔壁诊断 #2 路径） |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | flat state 派生方案：完全删 vs 保留作为 selector cache？性能权衡 | ✅ 已决（KD-2） |
| OQ-2 | refs Map 的内存生命周期：thread 删除 / 长期不访问时如何清理？ | ✅ 已决（KD-3） |
| OQ-3 | 后端 `invocationTracker` ↔ `invocationRecordStore` 的一致性收口（隔壁诊断 #2）是否纳入 F173？ | ⬜ 倾向：F173 只覆盖前端 + cli-resolve，后端 liveness audit 单独立 F-XXX；待铲屎官拍板 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不在 hydration merge 加 dedup 补丁 | 铲屎官 magic word "脚手架" + "绕路了"；F081 已预言写路径分散 = 反复出 bug | 2026-04-22 |
| KD-2 | flat state 降级 compatibility mirror，**不**在 Phase A 删 | 砚砚 push back：直接 selector-only 把"统一 writer"和"删 flat"绑成一刀，scope 过大；F123 已拍 shared helper + invariant 渐进路线。先收口写入，flat 由 writer 同步，读侧迁完后再决定退休（Phase E / TD） | 2026-04-22 |
| KD-3 | runtime refs 保持 runtime-only（不进 zustand），用 `Map<threadId, ThreadRuntimeRefs>` 单一聚合 entry；GC 三规则（delete 硬删 / done+empty 立刻删 / switch+reconnect sweep idle），不引入后台定时器 | refs 是过程性数据不该污染 store；聚合 entry 避免散成多张 top-level Map；GC 由 lifecycle 事件驱动比定时器更可预测 | 2026-04-22 |
| KD-4 | socket routing 一并收口 `intent_mode` / `spawn_started`，不只 `agent_message` | 砚砚指出 race 不只在 message 路径；只收 message 路径，invocation owner 注册仍会双写，ghost 根因换壳回来 | 2026-04-22 |
| KD-5 | **F173 scope 扩展为 thread-runtime state（messages + liveness）一起统一，不只 message pipeline** | 4-22 21:55 事故诊断把 cancel 按钮缺失 / queue gating 失效 / spawn ENOENT 同源到 liveness fragmentation；铲屎官原话"不要小修小改"——一锅端，避免 F173 v1 修完 cancel/queue 这条链还得另开 feat | 2026-04-22 |
| KD-6 | cli-resolve cache invalidation 作 Phase D sidecar 一起合，不单独 hot fix | 同事故现场 + 铲屎官"不要小修小改"指示；3-5 行代码 + 单测，独立 PR 即可，不污染 thread-runtime 主架构 | 2026-04-22 |
| KD-7 | 后端 `invocationTracker` ↔ Redis record 收口暂不纳入 F173 | 后端 liveness audit 是 layer 不同的工作（涉及跨进程一致性），独立立项更清晰；F173 已经覆盖前端 + 环境层 | 2026-04-22 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-22 21:42 | 立项（铲屎官触发：F5 后批量裂 + magic word 拒绝脚手架） |
| 2026-04-22 21:58 | Design Gate v2：砚砚 push back AC-A3 → KD-2/3/4 收敛 |
| 2026-04-22 22:05 | Scope 扩展 v3：铲屎官"不要小修小改" → KD-5/6/7，纳入 liveness fragmentation + cli-resolve sidecar |
| 2026-04-23 11:30 | **Phase A merged (PR #1347, squash `3feae9563`)** — A.1-A.12 含 砚砚 round 5 invocation-driven cleanup + codex review 4 轮 push back 收敛 |
| 2026-04-24 05:28 | **Phase A hotfix2 merged (PR #1364, squash `da928015e`)** — close clowder-ai#573，stream/callback/persistence 三路统一到 OUTER `parentInvocationId ?? ownInvocationId`；连带 piggyback fix（formatCatName mock + cli-spawn drainWarnings restore + env-registry register + biome auto-fix）解锁被 main 上 F174-B/clowder-ai#540 intake 误碰的 gate；Codex P1（A→B→A cross-turn merge）实测确认为 broadcast pre-existing，downgraded P3 |
| 2026-04-24 06:17 | **#1364 实机验证（铲屎官 runtime 重启后）**：✅ 新发 invocation 单 bubble（fix 生效）；⚠️ 历史 dup record 不自愈（写入路径 fix 不回溯改写持久化数据，预期）— 拍板推进 Phase B → C 路线，历史 dup tolerance 进 Phase C 处理（写时不动数据，hydration 加近似 dup 视觉合并层），授权砚砚 + 宪宪 自主闭环 Phase B/C |
| 2026-04-24 06:25 | **Phase B kickoff** — 启动 thread-scoped runtime refs 收口 + background handler 瘦身（AC-B1..B4 主线 + AC-B5..B10 race 验收清单）|
| 2026-04-24 12:46 | **Phase B-1 merged (PR #1373, squash `30cc69e70`)** — thread-runtime ledger module + 5 refs migration (sawStreamData / finalizedStream / pendingTimeoutDiag / activeRefs / shared-replaced-invocations) + AC-B9/B10 wired into useAgentMessages production path. 砚砚 review cycles: 7 (P1 wiring, 2 rounds biome, 2 rounds Codex P1 fresher-signal precedence, 1 round 契约残留 cleanup) + cloud Codex 3 P1 全部 push back/fix。491/491 hooks tests green throughout。Phase B-2 (thin useSocket-background ≤30 行) + Phase B-3 (thread switch fixture) 留 follow-up PR。 |
| 2026-04-24 18:47 | **Phase A hotfix3 诊断（Orphan Draft Bubble）** — Phase B-1 merge 后实机验收发现新 dup-bubble 变种：`draft-{inv}` 持久化占位 + `msg-{inv}-{cat}` live stream 并存。根因 = `messages.ts:1265-1312` draft merge 缺 invocation-alive 验证，invocation 在产生 formal message 前异常终止留下孤儿 draft。详见 [bug-report](../bug-report/2026-04-24-f173-orphan-draft-bubble/bug-report.md)。Hotfix 实施：GET `/api/messages` draft merge 只保留同 thread/user 且 `status=running` 的 invocation draft，并懒删除 missing / terminal invocation orphan draft；lookup transient failure 时 fail open 保留 draft；新增 6 条回归测试（running / missing / failed / succeeded / canceled / lookup failure）。 |
| 2026-04-24 20:51 | **Phase A hotfix3 merged (PR #1379, squash `6f7d97ab`)** — Orphan Draft Bubble 修复合入 main。Gate 证据：`pnpm gate` on `96e02ee5`，rebased onto latest `origin/main=3e95847c`，build/test/lint/check 全绿；云端 Codex current-head review no major issues；宪宪 LGTM 延续链覆盖 `93da93602 → 94fe6cc21 → 0f1e63b7 → d8b6f70ec → 96e02ee5`。 |
| 2026-04-25 03:08 | **路线图重新规划（铲屎官 + 宪宪 end-state 反推）** — 宪宪原计划"B-2 + B-3 follow-up 一起做" 经实际验证被 push back：`useSocket-background.ts` 当前 630 行，原 AC-B2 "缩 30 行 shim" 目标本身是过渡层，end-state 是 0 行（删整文件）。重新规划：**(1) B-3 thread switch fixture** 抽出作 pre-Phase C 独立小 PR（宪宪 own），给 Phase C 大改动提供回归基础设施；**(2) Phase C 主线 PR** = hydration 简化（统一走 ThreadRuntimeWriter）+ 历史 dup 视觉合并层 + 同 PR 砍 useSocket-background 的 hydration 协助函数；**(3) AC-B2 ≡ Phase C 收尾** = Phase C merge 后剩余 useSocket-background 是 dead code，直接删整文件不留 shim；**(4) Phase D** orthogonal 独立排。决策动因：避免"30 行 shim"过渡层 = 避免绕路。 |
| 2026-04-26 17:12 | **Phase E Task 6 merged (PR #1423, squash `da22c780`)** — Cross-thread handoff fixture for AC-E3 钉 thread_mo6 双气泡场景外部行为不变量。3 测试覆盖：(1) AC-E3 主场景 same invocationId 跨 A→B→A switch → 全程同一 deterministic bubble id `msg-{inv}-{cat}` (no double-bubble) + Phase 2 negative assertion bg path 不污染 flat state (云端 P2)，(2) bg-only invocation → only threadStates 写入，(3) invocationless fallback 容纳 bg-/msg- 双前缀 (Task 3-5 后改 msg-)。Observable invariant 测试，**不 mock useSocket-background** — real handleBackgroundAgentMessage 跑通，store-level 断言 deterministic id (砚砚 P1: mock-based 不算 pre-refactor guard，重写为 observable)。砚砚 GPT-5.5 review 4 round (P1 mock 化 → P2 biome → P1 PR scope drift rebase → P2 cloud's vacuously-true assertion → 所有都修) → LGTM 链 `9d54ae8b9 → 40fff2146 → c01800a45 → fe0157b66 → b3c6d8163`。云端 Codex 3 round (vacuously true / Phase 2 negative assertion / P0 hash) → no major issues ("Can't wait for the next one!"). 525/525 hooks 全套 + tsc + biome 全绿。**铲屎官特批 same as PR #1421**: api gate `mcp-config-adapters.test.js` + `capability-orchestrator.test.js` pre-existing env leak (`CAT_CAFE_RUNTIME_ROOT` 全局泄漏到 `resolveWorkspaceRoot()`) 跳过 — fixture-only PR 不动 packages/api。Phase E Task 3-5 (~500 行 handleBackgroundAgentMessage 业务逻辑迁到 useAgentMessages + 删 useSocket-background.ts) 砚砚 GPT-5.5 接手，fresh context 启动。 |
| 2026-04-26 13:24 | **Phase E Task 1+2 merged (PR #1421, squash `bfe8f461`)** — Single dispatch unification: `useSocket.ts:485-534` 的 active vs background 三段分发逻辑下沉到 `useAgentMessages.handleAgentMessage`，useSocket 不再做路由决策只 forward 到 onMessage。bg refs (bgStreamRefs/bgFinalizedRefs/bgSeq) 从 useSocket 迁到 useAgentMessages，handleAgentMessage 入口加 dispatch (active/bg/!threadId 三分支)。AgentMsg 类型补 threadId 字段。useSocket-thread-guard.test.ts 3 测试改契约 + 新增 useAgentMessages-thread-dispatch.test.ts 4 fixture 钉真实 dispatch 行为（砚砚 P1 review fix: 真实 mount useAgentMessages() 跑 handleAgentMessage 而非只验 useSocket forward 到 mock onMessage）。砚砚 GPT-5.5 review 1 round → LGTM 延续 `0ee859848 → 694727525`。云端 Codex no major issues ("Delightful")。525/525 hooks + 2539/2539 web + tsc + biome 全绿。**铲屎官特批**: `pnpm gate` 里 `mcp-config-adapters.test.js` + `capability-orchestrator.test.js` pre-existing api test infra fail (env 全局 `CAT_CAFE_RUNTIME_ROOT` 泄漏到 `resolveWorkspaceRoot()`，main 仓库同样 fail，跟 Phase E 改动无关) 跳过。useSocket-background.ts 仍在（useAgentMessages 内部 bg delegate）— Task 3-5 把 ~500 行业务逻辑迁过来后才能删，AC-E1 部分达成（single dispatch ✓，文件删除 □）。 |
| 2026-04-26 07:30 | **Phase D AC-D1+D2 merged (PR #1417, squash `1e168b10`)** — `cli-resolve.ts` 缓存腐烂闭环：(1) `resolveCliCommand` 缓存命中 `existsSync(cached)` 校验自维护；(2) 导出 `invalidateCliCommand(commandOrPath)`，cli-spawn `child.once('error')` 检测 `code === 'ENOENT'` 自动调用，scan-and-delete by value（处理 cli-spawn 拿绝对路径但 cache key 是裸命令名的不匹配，砚砚 GPT-5.5 P1）+ delete by key 兜底。Fixture: 2 个 by-key 场景 + 1 个 by-path 场景（HOME 切换避免 existsSync auto-invalidation 掩盖 invalidate-by-path bug）。砚砚 review 1 round (P1: invalidate-by-key-only) → LGTM 延续 `4e74d6be → 356ac435e`。云端 Codex no major issues ("Delightful")。api 9414/9414 + cli-resolve 8/8 pass + biome touched files clean。**铲屎官 push back: "follow-up = never，给我直接做"** — 反思工程师"下次一定"敷衍习惯，记 LL。 |
| 2026-04-26 05:35 | **PR-D / AC-B2 deferred + re-scoped（砚砚 GPT-5.5 + 宪宪 独立 reach 同结论）** — PR-D 开工实地审计：`useSocket-background.ts` 不是 dead code。`handleBackgroundAgentMessage` (line 364-) 是 ~500 行 live runtime path 处理 background-thread agent_message 事件 (text/error/done + stream key 追踪 + callback replacement + cat status + toast)。原 2026-04-25 plan 假设"Phase C 完成后 useSocket-background 自然成 dead code"经实测**错了**——Phase C 收口的是 writer 端 (KD-2 mirror invariant)，但 event handler 端仍是双路径分叉 (active 走 useAgentMessages.onMessage / background 走 handleBackgroundAgentMessage)。3 个选项 (窄删/宽删/accept reality) 中宪宪 + 砚砚独立 reach 选 3：Phase C 主线收官，AC-B2 重新定位为后续 KD-1 handler unification 单独立项。Plan + spec 同步修订。Phase C 实际 5 PR (#1391/#1399/#1400/#1405/#1411/#1413/#1416) 全部 merged。 |
| 2026-04-26 05:05 | **Phase C PR-C Task 10+12 merged (PR #1416, squash `0d399912`)** — Liveness reconcile 走 writer + 5 场景 fixture。`reconcileThreadWithServer` 重构：导出 for tests + 去掉 `if (isActiveThread) ... else ...` 分叉，server-has-slots 路径统一 `addThreadActiveInvocation`，server-no-slots 路径统一 `setThreadLoading` / `setThreadIntentMode` / `clearThreadCatStatuses` (新 writer，做 targetCats/catStatuses + #586 Bug 2 catInvocations 'running'→'completed' 清理) / `setThreadMessageStreaming`；`requestStreamCatchUp` 仍 active-only。`updateThreadMessage` + `clearThreadActiveInvocation` 的 active 分支补 mirror via `mirrorActiveFlat` (KD-2 漂移修复)。新 fixture `useSocket-liveness-reconcile-writer.test.ts` 4 场景 (reconnect ACTIVE / cross-post BG / cancel-during-stream ACTIVE / cross-post inverse BG)；配合 PR #1413 (F5) + PR #1391 (thread switch) 覆盖完整 5 场景 AC-C2/C3/C4。砚砚 GPT-5.5 review 0 round LGTM `718df9ce`。云端 Codex no major issues ("You're on a roll")。45/45 useSocket 相关测试 + 264/264 store + 2459/2459 web 全套 + tsc + biome 全绿。Phase C 主线收官；剩 PR-D Task 11 删 useSocket-background.ts ~600 行 dead code。 |
| 2026-04-26 04:10 | **Phase C PR-B-2 Task 5+6+7 merged (PR #1413, squash `ce6a7082`)** — hydrateThread atomic writer 收口：单一 set() 内 active 分支写 flat + mirror threadStates；background 分支 confined to threadStates，flat 不动；两侧都过 `revokeRemovedBlobUrls` 释放被覆盖的 `blob:` URL；IDB overwrite 仅对 current thread 触发。`useChatHistory.fetchHistory` replace path 切到 `hydrateThread` 单一入口。砚砚 GPT-5.5 review 2 round（P1-1: active 分支没 mirror threadStates → 加 `mirrorActiveFlat` helper；P1-2: background 用 `mirrorActiveToThreadStates` 经 `snapshotActive` fallback 会泄漏 active liveness/queue/workspace 到 never-seen BG → 改 `DEFAULT_THREAD_STATE` base + fixture 钉不泄漏）→ LGTM 延续链 `982389d4c → a61df029 → 21c16bfc2`。云端 Codex 1 round（P2: background 分支没 revoke 旧 blob URL → 补 revoke + fixture）→ 第 3 轮 review no major issues。2523/2523 web 全套 + 12/12 thread-runtime-writer fixture + tsc EXIT 0 + biome touched files clean。 |
| 2026-04-26 02:07 | **Phase C PR-B Task 9 merged (PR #1411, squash `caf59bad3`)** — 修 hotfix3 实机 cache 残留根因。`mergeReplaceHydrationMessages` 加 ghost-tolerance guard：local-only msg id startsWith `draft-` AND no live invocation in catInvocations → drop（IDB 残留 ghost）。Live just-completed bubbles (`msg-{inv}-{cat}`) 仍保留（不误删 server persistence lag 的合法 bubble）。砚砚 GPT-5.5 review 0 round + 云端 Codex P1（"原 guard 太宽，会丢 just-completed local bubble"）→ guard 收窄到 `draft-*` + 加 fixture 钉行为 → 砚砚 LGTM 延续 + 云端 4df217d61 review pass。1671/1671 测试 + 11/11 replace-hydration（含 baseline 9 + Task 9 orphan + P1 regression）+ biome + tsc 全绿。Task 5/6/7 (writer 收口 architectural cleanup) 留 PR-B-2。 |
| 2026-04-25 21:17 | **Phase C PR-A (Task 3+4) merged (PR #1405, squash `a7f91000e`)** — 完整 read-side 迁移：ChatContainer 把 useChatStore() 解构里 6 字段（messages/activeInvocations/catStatuses/catInvocations/intentMode/targetCats）全砍，改用 `useThreadMessages(threadId)` + `useThreadLiveness(threadId)`；ParallelStatusBar 加 `threadId` prop 用 `useThreadLiveness`；扩展 `ThreadLiveness` 加 `catInvocations` 字段（ParallelStatusBar 需 token aggregation）；SplitPaneView 已 thread-scoped 无需改。砚砚 GPT-5.5 review 0 round（直接 LGTM 覆盖 `852c6db3f`）。云端 Codex no major issues。1639/1639 tests + tsc + biome 全绿。 |
| 2026-04-25 14:25 | **Phase C Task 2 merged (PR #1400, squash `2d02b0113`)** — ChatContainer 的 `hasActiveInvocation` 来源切到 `useThreadLiveness(threadId).hasActive`，关闭 AC-C6 race window（flat 滞后于 thread switch 时 cancel 按钮不再短暂消失）。其他 4 个 liveness 字段（activeInvocations / catStatuses / intentMode / targetCats）留 PR-A 一次性迁移。Selector 加 defensive fallback（state.currentThreadId 缺失时退化 flat read）让 partial test mock 不抛错；prod 行为不变。Fixture chat-container-thread-scoped-active.test.ts 3 cases 钉住 race window 直接 differentiate（旧 flat 读会失败）。砚砚 GPT-5.5 review 1 round（P1 fixture 缺失 → 新增钉住 contract 的 fixture）→ LGTM 延续 `9b2126bbe`。云端 Codex review no major issues。1611/1611 tests + tsc EXIT 0 + biome clean。 |
| 2026-04-25 13:34 | **Phase C Task 1 merged (PR #1399, squash `b60128a96`)** — `useThreadScopedSelectors.ts` 引入 `selectThreadMessages` / `selectThreadLiveness` 纯函数 + thin React hook wrappers (`useThreadMessages` / `useThreadLiveness` with `useShallow`)。Read-side 收口前置：所有 read-side 组件后续将迁移到 selector，让 flat-vs-thread-scoped 变成 writer/mirror concern 不是 reader concern；Phase C 后续 hydration rewrite 不动消费者。Side change：export `ChatState` from `chatStore.ts`（selector 类型签名需要）。砚砚 GPT-5.5 review LGTM 0 round（直接通过）。云端 Codex review no major issues。窄验证：8/8 selector tests + 502/502 hooks 全套 + tsc --noEmit EXIT 0 + biome touched files clean。Component 迁移留 Task 2-4 follow-up PR。 |
| 2026-04-25 09:42 | **Phase B-3 fixture merged (PR #1391, squash `94180b490`)** — `useSocket-background-thread-switch.test.ts` 207 行 fixture-only，3 条 invariant 锁定 thread switch 后的 routing isolation / concurrent isolation / terminal correctness。砚砚 GPT-5.4 review 1 round（P1 fixture 漏掉 stopTrackedStream finalize 验证 → 修后端到端验证 + assert isStreaming=false + ref 清掉）→ LGTM 延续 `050c4d977`。云端 Codex review no major issues。**特批跳过 build gate**（铲屎官 09:37 拍板）— 原因：v2 fresh worktree gate 跑 build 时偶发 next prerender flakiness（两次错误不同：`<Html>` outside _document / useContext on null），但单独 web build 各 commit 都 EXIT 0；binary search 证明非本 PR 引入。Main build flakiness 留给其他猫修。Hotfix 闭环：Phase C 主线工作前置基础设施就位。 |
| 2026-04-25 09:03 | **Hotfix3 实机验证 + 新 bug 发现（铲屎官 runtime 验收）** — 验证三件套：runtime worktree HEAD `bd6d0385d` 含 hotfix3 squash `6f7d97ab9` ✅；API 进程 pid 82801 启动于 01:32:09（hotfix3 merge 后 5 小时，含新代码）✅；`curl /api/messages?threadId=thread_moay5tqumsbu17yr` draft id 列表 = `[]`，后端**正确过滤** orphan draft `1085dd1d-...` ✅。但前端实机仍看到 `draft-1085dd1d-...` 气泡——铲屎官 chrome devtools `Application → Storage → Clear site data` 清完前端 cache + F5 后，重复气泡消失。**根因**：F164 IndexedDB messages cache 在 hotfix3 后端过滤新数据时**没有被覆盖**，hotfix3 部署前 cache 的 orphan draft 残留在本地。**新 bug 处置**：不开 hotfix4 单独修，cache 失效逻辑漏洞列入 **Phase C 范围**——Phase C hydration 简化重定义 cache → store 同步路径，自然解决。临时 workaround：用户清 site data 即可（已在本次实机验证闭环）。 |
| 2026-04-26 01:21 | **Bug Issue: Cat ChatMessage 整体不渲染（DOM 缺失）** — 来源 `thread_mnux2eewbo4otg17` 实测（铲屎官 2026-04-25 13:14 截图）：opus/codex 互 @ 之后那些 cat 消息**整条 ChatMessage 没有 mount 到 DOM**。可见 vs 不可见对比： ✅ 顶部缅因猫 GPT-5.5 那条（头像 + 标题 + CLI Output 折叠卡完整渲染） ✅ BriefingCard / DirectionPill 正常出现 ❌ opus/codex 互 @ 后的所有 cat assistant 消息：连头像、连 CLI Output 折叠卡都不显示。数据层验证：thread context API 返回的 catId='opus-47'/'codex' 消息 content 不为空，message 真实存在 messageStore。真问题：**store 里有数据，但前端 ChatMessage 不渲染它们**。**误诊史**：铲屎官原话 "前端连他们的头像 cli thinking 什么都看不到"被 Opus-47 + GPT-5.5 双猫读图误诊为 "stream content 被 CliOutputBlock 折叠"，立项 F176 走完整 SOP（4 轮 review + cloud + alpha）后被铲屎官 2026-04-26 01:02 + 01:05 三个感叹号否决全部 revert（commit `3eccebce9`）。详见 `docs/features/F176-native-cli-assistant-speech-rendering.md` § Postmortem。**接下来**：候选根因（待验证，不预设）— ChatMessage early-return / F167 dedup 误杀 / mergeReplaceHydrationMessages / catData 缺失 / React key 冲突。诊断必须先看 alpha 浏览器 DOM（不再凭印象猜）。**铲屎官 2026-04-26 01:21 拍板**：不立独立 F177，挂在 F173 下作为 Bug Issue（feat-lifecycle 哲学：bug fix ≠ feat）。 |
| 2026-04-26 06:28 | **Bug Issue: a2a_handoff 蓝条排序错位（"消息乱了"真根因锁定）** — 来源 `thread_mnux2eewbo4otg17` 03:18 + 03:26 + 06:28 铲屎官报告："布偶猫气泡 → 两个蓝条紧挨 → 缅因猫气泡"，正确序应该是"布偶猫气泡 → 蓝条1 → 缅因猫气泡 → 蓝条2"。三猫并行独立诊断收敛同根因（4.6 + 砚砚-GPT5.5 + 47 各自从源码 grep + DOM 实测）：① 蓝条 = `a2a_handoff` 系统消息（不是 BriefingCard / DirectionPill），后端 `route-serial.ts:1294 + 1509` 双点 yield，content = "${current} → ${next}"。② Bug A（前台 timestamp 丢失）：`useAgentMessages.ts:1262` 用 `Date.now()` 客户端时间，丢掉后端 `msg.timestamp` 服务端时间。Background `useSocket-background.ts:618-622` 同样问题。③ Bug B（store 只 append 不按时间插）：`chatStore.ts:1114` `addMessage` 永远 `[...state.messages, msg]`，迟到的 `a2a_handoff` 永远排在已 append 的 stream bubble 之后。**修法决定**（砚砚 push back + 47 独立确认 + 46 接受）：**收窄修，不全局改 addMessage 排序**（避免触及 F173 streaming/dedup hot path + perf O(n) 劣化）。4 step：① foreground/background `a2a_handoff` 用 `msg.timestamp ?? Date.now()`；② 抽 `insertTimestampOrdered(messages, msg)` helper 只对 a2a_handoff/非 streaming system notice 用；③ AgentMsg type 补 timestamp 字段；④ foreground+background 各加 1 fixture（"布偶猫 stream 先到，handoff server timestamp 更早但客户端后到 → 顺序正确"）。**Owner**：47 实施 + @codex（GPT-5.5）跨家族 review（他对 a2a_handoff + F173 store 路径最熟）。 |

## Review Gate

- Phase A: 砚砚（架构 review，writer + routing 正确性） + 烁烁（视觉回归守护）
- Phase B: 砚砚（refs 迁移 + GC 策略） + Codex（测试覆盖）
- Phase C: 跨家族 review（read-path migration） + 铲屎官愿景守护（cancel/queue UX 一致性）
- Phase D: 砚砚 / Codex（cli-resolve 单测）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Audit** | `docs/features/F081-write-path-audit.md` | dual write-path 已识别，AC-B2 未闭 |
| **Architecture** | `docs/features/F123-bubble-runtime-correctness.md` | shared helper + invariant 渐进路线（KD-2 来源） |
| **Cache** | `docs/features/F164-*.md` | IndexedDB cache（ghost bubble 涌现源头之一） |
| **Queue** | `docs/features/F047-*.md` | Queue Steer，liveness gating 强相关 |
| **Lifecycle** | `docs/features/F117-message-delivery-lifecycle.md` | invocation 生命周期 |

## 需求点 Checklist

- [ ] dual handler 合并为单入口（messages + liveness）
- [ ] thread-scoped runtime refs Map
- [ ] socket routing 收口 agent_message + intent_mode + spawn_started
- [ ] hydration merge 简化
- [ ] ChatInputActionButton + queue gating 走 selector，前后端 liveness 对齐
- [ ] cli-resolve cache invalidation
- [ ] F081 AC-B2 闭合
