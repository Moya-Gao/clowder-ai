---
feature_ids: [F173]
related_features: [F081, F123, F164]
topics: [frontend, message-pipeline, state-machine, ghost-bubble, hydration]
doc_kind: spec
created: 2026-04-22
---

# F173: 前端 Message State Pipeline 统一（消除 dual write-path）

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官原话（2026-04-22 21:42）："为啥我之前一个 f5 之后 基本每个气泡的都裂了？"
铲屎官原话（2026-04-22 21:44）："有问题你为什么不直接走 p2？呢？ 你是不是又在绕路和做脚手架了呢？"

F081 Risk #1 早已预言："**写路径分散导致修复互相覆盖**"。证据：
- F164（IndexedDB cache，2026-04-16）→ ghost bubble 涌现
- #1261（2026-04-19）修 IDB 占位过滤
- #1310（2026-04-21）修 watchdog 清 ghost stream
- 砚砚 4-21 在 thread `mo8m0ttnlcwryfji` 修 active-handler callback 不收 invocationless rich placeholder
- 4-22 21:42 thread `moasr0gm6saqnbt6`：F5 后基本每个气泡都裂——这次根因是 **background-handler 创建 `bg-{ts}-{cat}-{seq}` ghost bubble，invocationId 取自陈旧/虚构 thread-state**，hydration merge 永远匹配不到 history → 每个 ghost 都被保留

每次只修一条 case → 双轨制不消除，下一个 case 一定再来。**P2 = 消除 dual write-path 才是终态**，不是再加 dedup 补丁。

## What

### 现状（dual pipeline）

| 路径 | 触发条件 | refs/state | 创建 ID 模式 |
|------|---------|-----------|-------------|
| Active handler (`useAgentMessages.ts`) | route+store 双指针都指向当前 msg.threadId | flat state.messages, `activeRefs`, `catInvocations` | `msg-{ts}-{catId}` / `draft-{invId}` |
| Background handler (`useSocket-background.ts`) | 任一指针不一致 / 非当前 thread | `threadStates[tid].messages`, `bgStreamRefs`, thread-scoped catInvocations | `bg-{ts}-{cat}-{seq}` / `bg-cb-...` |

两套 refs 互不可见 → race window 期间产生的 ghost bubble 永远不会被另一边接管。

> **设计校准（2026-04-22 砚砚 push back）**：现状 chatStore 中 `threadStates[currentThreadId]` 只是 thread switch 时的 snapshot，不是持续真相源；大量 `addMessageToThread`/`setThreadCatInvocation`/`setThreadLoading`/`addThreadActiveInvocation`/`setThreadIntentMode`/`setThreadTargetCats` 都内置 `threadId === currentThreadId` 分叉，仍然把 active 写到 flat（`packages/web/src/stores/chatStore.ts:53,1365,1390,1572,1645,1683,1746,1768,1843`）。F123 也已拍过 "shared helper + invariant 渐进，不把统一 MessageWriter 当前置" 的路线（`docs/features/F123-bubble-runtime-correctness.md:45,140`）。所以 P2 的直线是**先把所有 thread-runtime 写入收口到一个 thread-scoped writer**，flat 降级成 compatibility mirror（同一 set() 内同步），延迟到读侧迁完再决定退休。**不**在 Phase A 把"删 flat"和"统一 writer"绑成一刀。

### Phase A: 统一 thread-scoped Writer + 统一 socket routing（消除 ghost 来源）

1. **统一 ThreadRuntimeWriter**：抽出 `writeThreadMessage / patchThreadMessage / appendThreadStreamChunk / appendThreadToolEvent / setThreadStreaming / replaceThreadMessageId / setThreadCatInvocation / addThreadActiveInvocation / removeThreadActiveInvocation / setThreadLoading / setThreadIntentMode / replaceThreadTargetCats` 为单一 writer 接口；所有写入只走 thread-scoped 路径，flat state 在同一个 `set()` 内由 writer 同步镜像（compatibility mirror）。
2. **socket routing 收口**：`agent_message` / `intent_mode` / `spawn_started` 都改用单一 handler，决策只看 `msg.threadId`，删除 `routeThread` (ref) vs `storeThread` (zustand) 双指针 guard（race 根因）。background system info / toast / 进度等"非 message creation"行为继续保留。
3. **handler 合并**：`handleAgentMessage` + `handleBackgroundAgentMessage` 合为单一入口，按 `msg.threadId` dispatch 给 ThreadRuntimeWriter。
4. flat state.messages **保留**作 compat mirror，不在本 phase 删；读侧组件继续读 flat 不动。

### Phase B: refs 全量纳入 thread-scoped runtime + background 瘦身

1. `useAgentMessages` 里所有 runtime refs 整体收口为 `Map<threadId, ThreadRuntimeRefs>`，每个 entry 至少含：`active / finalized / replaced / sawStreamData / pendingTimeoutDiag / timeoutHandle / lastTouched`。**保持 runtime-only，不进 zustand / threadStates**。
2. `useSocket-background.ts` 瘦身为 ≤ 30 行 shim（仅做 toast/进度等非 writer 副作用），message creation 路径全部走 Phase A 的 ThreadRuntimeWriter。
3. GC 策略：① thread delete 硬删；② `done/error/callback replace/resetThreadInvocationState/reconnect reconcile` 后若该 thread 无 active slots 且 refs 全空 → 立刻删；③ `setCurrentThread`/reconnect 时 sweep 一次长 idle entry。**不引入后台定时器**。

### Phase C: 读侧 selector 迁移 + hydration 简化

1. 读侧组件逐步从 flat state 切换到 selector 派生（`useThreadMessages(threadId)` 等），用 zustand `subscribeWithSelector + shallow` 控制重渲染。
2. `mergeReplaceHydrationMessages` 删除 ghost-tolerance 分支（来源不再产生 ghost）。
3. 跨场景回归测试（F5 / thread switch / socket reconnect / cross-post / 并发多猫）全绿。
4. F081 AC-B2 关闭。

### Phase D（可选 / TD）: flat compat layer 退休

如果 Phase C 完成后 flat state 已无独立读者，开一个轻量 TD 移除 flat mirror。**不在 F173 主路径强制做**。

## Acceptance Criteria

### Phase A（统一 Writer + Routing）
- [ ] AC-A1: 单一 ThreadRuntimeWriter，所有 thread runtime 写入只通过它进入 zustand
- [ ] AC-A2: `agent_message` / `intent_mode` / `spawn_started` 走单一 handler，决策只看 `msg.threadId`，无 `routeThread` vs `storeThread` 双指针 race
- [ ] AC-A3: flat state 由 writer 在同一 `set()` 内同步镜像（compatibility mirror），读侧组件不变更
- [ ] AC-A4: chatStore 中 `addMessageToThread / setThreadCatInvocation / setThreadLoading / addThreadActiveInvocation / setThreadIntentMode / setThreadTargetCats` 等"if active 就再写 flat"的分叉收敛进 writer，不再散布

### Phase B（runtime refs 收口 + background 瘦身）
- [ ] AC-B1: 所有 runtime refs 合并为 `Map<threadId, ThreadRuntimeRefs>`（active/finalized/replaced/sawStreamData/pendingTimeoutDiag/timeoutHandle/lastTouched），保持 runtime-only
- [ ] AC-B2: `useSocket-background.ts` 缩为 ≤ 30 行 shim，message creation 路径走 Phase A writer
- [ ] AC-B3: GC 三规则就位（delete 硬删 / done+empty 立刻删 / setCurrentThread+reconnect sweep idle）
- [ ] AC-B4: thread switch 不再触发 ghost bubble（fixture 验证）

### Phase C（读侧迁移 + hydration 简化）
- [ ] AC-C1: 关键读侧组件（ChatContainer/MessageList/RightStatusPanel/MissionHub）改为 thread-scoped selector
- [ ] AC-C2: F5 后 0 ghost bubble（fixture 含 race window）
- [ ] AC-C3: socket reconnect 期间收的 events 在重连后正确合并到现有 bubble，不裂
- [ ] AC-C4: cross-post + 当前 thread stream 同时进行不裂
- [ ] AC-C5: `mergeReplaceHydrationMessages` 简化（移除 ghost-tolerance 分支）
- [ ] AC-C6: F081 AC-B2 (Remaining Gaps) 关闭

## Dependencies

- **Evolved from**: F081（write-path audit 已识别 dual-pipeline 风险，AC-B2 未闭合）
- **Related**: F123（bubble runtime correctness fixture matrix） / F164（IndexedDB cache）

## Risk

| 风险 | 缓解 |
|------|------|
| 大改前端核心 state，回归面广 | Phase A/B/C 分阶段合入，每段独立 alpha 验收；fixture matrix 跑全 |
| zustand selector 派生 flat state 性能下降 | subscribeWithSelector + shallow equal；benchmark 关键 hook 渲染次数 |
| 删 background handler 路径影响 multi-thread split-pane / mission-hub | split-pane / mission-hub 监听本就用 threadStates，路径统一后更一致；保留 background 行为（toast / 进度），删的是 message creation 路径 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | flat state 派生方案：完全删 vs 保留作为 selector cache？性能权衡 | ✅ 已决（KD-2） |
| OQ-2 | refs Map 的内存生命周期：thread 删除 / 长期不访问时如何清理？ | ✅ 已决（KD-3） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不在 hydration merge 加 dedup 补丁 | 铲屎官 magic word "脚手架" + "绕路了"；F081 已预言写路径分散 = 反复出 bug | 2026-04-22 |
| KD-2 | flat state 降级 compatibility mirror，**不**在 Phase A 删 | 砚砚 push back：直接 selector-only 把"统一 writer"和"删 flat"绑成一刀，scope 过大；F123 已拍 shared helper + invariant 渐进路线。先收口写入，flat 由 writer 同步，读侧迁完后再决定退休（Phase D / TD） | 2026-04-22 |
| KD-3 | runtime refs 保持 runtime-only（不进 zustand），用 `Map<threadId, ThreadRuntimeRefs>` 单一聚合 entry；GC 三规则（delete 硬删 / done+empty 立刻删 / switch+reconnect sweep idle），不引入后台定时器 | refs 是过程性数据不该污染 store；聚合 entry 避免散成多张 top-level Map；GC 由 lifecycle 事件驱动比定时器更可预测 | 2026-04-22 |
| KD-4 | socket routing 一并收口 `intent_mode` / `spawn_started`，不只 `agent_message` | 砚砚指出 race 不只在 message 路径；只收 message 路径，invocation owner 注册仍会双写，ghost 根因换壳回来 | 2026-04-22 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-22 | 立项（铲屎官触发：F5 后批量裂 + magic word 拒绝脚手架） |
| 2026-04-22 | Design Gate：砚砚 push back AC-A3 → KD-2/3/4 收敛，Phase 重排（writer 统一→refs+background→读侧+hydration→可选 compat 退休） |

## Review Gate

- Phase A: 砚砚（架构 review） + 烁烁（视觉回归守护）
- Phase B: 砚砚（refs 迁移正确性） + Codex（测试覆盖）
- Phase C: 跨家族 review + 铲屎官愿景守护

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Audit** | `docs/features/F081-write-path-audit.md` | dual write-path 已识别，AC-B2 未闭 |
| **Architecture** | `docs/features/F123-bubble-runtime-correctness.md` | shared helper + invariant 渐进路线（KD-2 来源） |
| **Cache** | `docs/features/F164-*.md` | IndexedDB cache（ghost bubble 涌现源头之一） |

## 需求点 Checklist

- [ ] dual handler 合并为单入口
- [ ] thread-scoped refs Map
- [ ] flat state 改 selector 派生（或删除）
- [ ] hydration merge 简化
- [ ] F081 AC-B2 闭合
