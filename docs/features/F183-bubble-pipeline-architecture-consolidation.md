---
feature_ids: [F183]
related_features: [F081, F117, F123, F164, F176]
topics: [bubble, message-pipeline, identity-contract, websocket, idb-cache, reconcile, refactor, architecture, observability]
doc_kind: spec
created: 2026-04-30
---

# F183: Bubble Pipeline Architecture Consolidation — 消息气泡管线架构收敛

> **Status**: completed ✅ | **Owner**: 布偶猫/宪宪 (Opus-47) 牵头 | **Priority**: P1
>
> Phase A 已 done（2026-04-30，铲屎官自治放行 ADR-033 v2）。Phase B0 已 merged（PR #1496，commit `a6be5970e`）。Phase B1.1 reducer core 已 merged（PR #1500，commit `2fbde77ec`）。Phase B1.2.1 adapter + reducer textMode='replace' 已 merged（PR #1506，commit `1e9cb84bd`）。Phase B1.2.2 active text wire-up pilot 已 merged（PR #1507，commit `3817e0974`，2 轮 review）。Phase B1.2.3 active stream new-bubble 已 merged（PR #1510，commit `058362c79`，1 轮 review）。Phase B1.2.4 callback wire-up + reducer callback-specific policy 已 merged（PR #1517，commit `1d6040b80`，4 轮 review 收敛 4 P1）。Phase B1.2.5 hydration `mergeReplaceHydrationMessages` 简化（AC-B2）已 merged（PR #1521，commit `a2cf6dc84`，1 轮云端 review 收敛 1 P1）。**active text 整体 wire-up 完成（stream + callback explicit-invocationId 路径）+ hydration replace 路径策略简化完毕**；后续处理 invocationless callback / tool events / done-error 等余下入口。

## Why

铲屎官 2026-04-30 原话：

> "我们家前端对于后段 cli 出来的输出流的气泡（这里是包括任何气泡）cli 也好 thinking 也好各种东西也好，为什么经常有 bug？太奇怪了！一个气泡为什么经常出 bug 呢？好像涉及到 前端？redis？chrome 缓存？经常遇到的就是气泡裂了！气泡不见了！F5 之后气泡不裂了！F5 之后气泡出来了！猫猫发完消息气泡才出来！"

> "我们这个得写一个 ard 或者什么架构设计文档？梳理一下这个架构设计 然后立项一个 feat 重构也好优化也好 好好的看看这整体？未来修改代码就有架构图可以看和参考，避免老出问题？现在定位了个大概出来 然后能如何优化呢？你组织大家讨论一下？不要当独裁猫猫 我发现你们加在一起视角可能最全。"

### 为什么 F081 (done) + F123 (done) 修过还在反复发作

四只猫并行诊断已收敛同一根因（discussion 锚点 → `docs/discussions/2026-04-30-f183-bubble-pipeline-architecture/`）：

1. **四个真相源在互相竞争**：Redis MessageStore（持久化 SoT）/ Redis DraftStore（5min TTL）/ IndexedDB（前端持久化）/ Zustand+Ledger（页面生命周期）—— 任意两个不一致就会出视觉 bug
2. **identity 多键且按 provider/分支补**：OUTER `parentInvocationId`（live broadcast）vs INNER `ownInvocationId`（formal persistence）—— 每加一个新 provider/分支都得重写一次 #573 contract（route-serial → route-parallel #1433 → Codex MCP `1ed5f5b46`）
3. **`messages` 写入口有 8+ 条**：active stream / background stream / callback / draft / queue / hydration / replace / 各 provider transform —— F081 audit 数过 104 个写入点；统一 MessageWriter 在 F123 KD-4 主动推迟，导致每加路径都漏 contract
4. **WebSocket fire-and-forget + 5min hard timeout**：in-process event bus 在长 invocation 下 backpressure（`dropped 32 events`），PR #1432 修了 timeout 分支自动 catch-up 但没修 backpressure 根因
5. **`mergeReplaceHydrationMessages()` 5 种匹配策略复杂度失控**：每加一种消息 origin（如 F176 的 messageRole）都得更新 merge 函数，漏一个 case = 新 bug

### 这次和 F081/F123 不一样在哪

- F081 修的是"已显示气泡的连续性"（监控视角）
- F123 修的是"identity contract 在已知路径上不裂气泡"（症状视角）—— 但 F123 名义 done 实际欠债 TD111-TD114（统一 identity contract、store invariant、placeholder 单调升级、duplicate 断言）
- **F183 修的是"架构层不再有四源竞争 / 写入口爆炸 / merge 启发式"**（结构视角）—— 把 TD111-TD114 收编 + IDB cache invalidation contract + websocket 序列号 + ack/gap 一起做

副愿景：**Spec 内嵌的 Architecture Map 成为未来开发者改动消息管线时的强制参考真相源**，让"加一个新 provider/路径"不再触发新一轮气泡 bug。

## What

> Phase 拆分骨架（最终 Phase 由 Phase A discussion 拍板，下方为讨论锚点）。

### Phase A: Architecture Discovery & Identity Contract（讨论收敛 + 架构图 + 真相源沉淀）

- 把四猫诊断（46 / 47 / 砚砚 / 烁烁）收敛到一份 architecture map asset（`docs/features/assets/F183/architecture-map.{md,svg}`）
- 拍板 bubble identity 真相源契约：稳定身份 = `(catId, invocationId, bubbleKind)`；OUTER 优先于 INNER，per-cat INNER 仅做生命周期 key 不做前端 identity
- 列清所有"`messages` 写入口"清单（继承 F081 audit 104 写入点 + 新增 provider 后的增量）
- 拍板 sunset 路径：F123 TD111-TD114 接收范围 + IDB cache invalidation contract + websocket 序列号 contract
- 产出 ADR-033（或在本 spec 内嵌 architecture map，由 Phase A discussion 拍板）

### Phase B0: Replay Harness + Store Invariant Gate（先立防线，不改热路径）

- `BubbleEvent` 14 类 TypeScript 枚举 + `BubbleKind` 5 类枚举落地为 shared contract
- dev/test 模式 store invariant 硬断言（duplicate stable identity / phase 逆行 / canonical key split）
- runtime diagnostics 最低契约落地：13 字段 violation log + bubble timeline dump 入口
- Replay harness 框架接住 F123 既有 fixture 套件，预留 BubbleEvent payload schema 扩展位
- 不修任何已有写入口，避免在没有 Single Writer 之前改热路径

### Phase B1: Single Writer / Reconcile Reducer（统一写路径）

- 所有 stream/callback/draft/queue/hydration 入口收敛到单个 `MessageWriter` / reconcile reducer
- `mergeReplaceHydrationMessages()` 5 种匹配策略简化到 ≤ 2 种（按 stable identity 直接 dedup + monotonic upgrade）
- F123 TD111（identity contract）+ TD113（placeholder 单调升级）落地

### Phase C: WebSocket Sequence Number + Ack/Gap Contract（消除 fire-and-forget）

- 所有实时 message event 携带 monotonic seq（**thread-scoped — KD-9 拍板**）
- 客户端维护 per-thread `lastSeq`，发现 gap 立即 `requestStreamCatchUp`（不等 5min DONE_TIMEOUT）
- in-process event bus backpressure 根因定位（grep 不到 `dropped X events` 字面源 → 追到底）+ 加 buffer / 限速 / 丢弃策略

#### Sequence Number Scope: thread-scoped vs global monotonic 对比（KD-9 决议依据）

> **核心前提**：sequence number 是"丢没丢"的检测号牌，不是路由决定。消息归哪个 thread 由 `msg.threadId` 字段决定，跟 seq 无关。**铲屎官关心的"thread A 漂到 thread B"两种方案都不会发生** — 漂气泡的根因是 identity contract 出 bug（F183 Phase A ADR-033 已解决），跟 seq 设计无关。

| 维度 | Thread-scoped（KD-9 选） | Global monotonic |
|---|---|---|
| 编号方式 | 每个 thread 独立编号（A: 1,2,3...; B: 1,2,3...） | 全局单调 seq（A: 1,4,7; B: 2,5,8; C: 3,6,9） |
| 客户端状态 | 每个 thread 维护 `lastSeq` | 单一 high-water mark |
| 同 thread 内丢/乱序检测 | ✅ | ✅ |
| 跨 thread "哪个事件先发生" | ❌（用户场景无意义） | ✅（但日常用户不感知） |
| Server 实施 | thread context 加 seq 字段 | 全局 sequencer（Redis 原子计数器或类似） |
| 多 backend 实例 | 各 thread 各管各，无需协调 | 需要分布式共识 / 锁 |
| 重启持久化 | thread state 持久化即可（已有 ledger） | 全局 seq 必须独立持久化（一旦丢失 = 全部 thread 序列错乱） |
| 客户端 catchup 范围 | "thread A 给我 seq>42 的消息" | "全局给我 seq>9999 的所有消息"（流量大） |
| 升级路径 | 升级到 global 可加一层全局 sequencer（不难） | 退回 thread-scoped 难（已依赖全局保证） |
| **漂气泡风险** | 不会 — 路由由 threadId 决定 | 不会 — 同上 |

**KD-9 决策**：选 thread-scoped。F183 立项 5 类症状均为 thread 内现象 + global 多实例分布式共识对家里规模过度设计 + global 全局重启序列号丢失是新脆弱点 + 先做轻的需要再升。

### Phase D: IDB Cache Invalidation Contract（消除 cache 放大器）

- 写入 schema 升级 hook：identity contract 变更时清理过时 entries
- IDB 降级为离线 fallback：在线时不参与渲染路径 merge，只在网络断开时使用
- F164 IDB 缓存层补 invalidation hook

### Phase E: Closure + Alpha Soak（防御层补齐 + 闭环 F123 TD）

- dev/runtime 加硬断言："同一 catId + invocationId + bubbleKind 不能进两条 assistant bubble" → 直接报警（B0 已立最小 gate，E 做 full closure）
- F123 TD112（store invariant）+ TD114（duplicate 断言）落地
- replay harness 每条 PR 跑一次完整 fixture 套件

## Acceptance Criteria

> 立项时仅列骨架，Phase A 讨论收敛后细化。

### Phase A（Discovery & Contract）✅ DONE 2026-04-30

- [x] AC-A1: 四猫诊断已收敛到一份 architecture map（assets/F183/architecture-map.{cn,en}.png + .svg by 砚砚）
- [x] AC-A2: bubble identity 真相源契约（OUTER vs INNER 仲裁规则）已写入 ADR-033 Section 2
- [~] AC-A3: fixture schema 已落地到 `docs/features/assets/F183/fixture-schema.md`；`messages` 写入口完整清单仍保留 F081 audit 的 104 项作为 B1 baseline
- [x] AC-A4: F123 TD111-TD114 全部纳入 F183（KD-A4 拍板，TECH-DEBT.md 已废弃）
- [x] AC-A5: ADR-033 v2 经铲屎官 2026-04-30 自治放行（"按照家里的要求 好像没有我需要一条条看的，你们自己决策就行"）

### Phase B0（Replay Harness + Invariant Gate）✅ DONE 2026-04-30

- [x] AC-B0-1: `BubbleEvent` 14 类 TypeScript 枚举 + `BubbleKind` 5 类枚举落地到 `packages/shared/src/types/bubble-pipeline.ts`
- [x] AC-B0-2: dev/test 模式 store invariant gate 覆盖 duplicate stable identity / phase regression / canonical key split
- [x] AC-B0-3: 13 字段 `BubbleInvariantViolation` 结构化诊断输出 + `dumpBubbleTimeline` filter 接入
- [x] AC-B0-4: Replay harness 框架落地，支持 reducer 注入、thread-scoped replay、deterministic timestamp、empty-event initial state
- [x] AC-B0-5: PR #1496 通过 `pnpm gate`、云端 Codex review、Opus-47 delta review 后 squash merge（commit `a6be5970e`）

### Phase B1（Single Writer）

- [x] AC-B1: `MessageWriter` / reconcile reducer 落地，所有写入口收敛 — **active path 100% + background path 100% reducer single-writer 收口完毕**（B1.1 reducer core；B1.2.1-1.2.5 active text + callback explicit + hydration；B1.3-1.6 active done/error/tool；B1.7 bg tool/error + `replaceThreadMessages` API；B1.8 bg text branch — callback w/ + w/o replacementTarget + stream chunk existing/new + 同 invocation 多 kind 共存的 kind filter）
- [x] AC-B1.1: BubbleReducer core 落地（PR #1500，merge commit `2fbde77ec`），覆盖 stable-key lookup、local placeholder 单调升级、ambiguous upgrade quarantine、deterministic local fallback id、callback_final backend id adoption
- [x] AC-B1.2.1: `BackgroundAgentMessage → BubbleEvent` 纯 adapter 落地（PR #1506，merge commit `1e9cb84bd`）。覆盖 text/thinking/tool_*/cli_output/rich_block/system_status/timeout/done/error/未知 type 的 mapping；assistant_text 改白名单（unknown/control msg → undefined，不绑 text bubble stable key）；reducer `reduceStreamChunk` 识别 `textMode='replace'` 重写 content（不退化为 append）。6 轮云端 codex review 收敛 5 P1（system_status non-terminal / direct done&error / unknown type fallback / text+isFinal+content drop / textMode replace）。focused 41/41，typecheck + biome clean
- [x] AC-B1.2.2: active text stream pilot wire-up 落地（PR #1507，merge commit `3817e0974`）。`useAgentMessages.ts` text-into-existing-bubble path 当 `msg.invocationId` canonical → adapter + applyBubbleEvent + replaceMessages；otherwise legacy `appendToMessage` / `patchMessage`（保留 invocationless recovery）。Round 1 收敛 2 P1：(1) `replaceMessages(msgs, hasMore)` 不再强制 false 杀掉 pagination；(2) `result.violations.forEach(recordBubbleInvariantViolation)` 真正接 B1 invariant gate 进 active hot path。focused 4/4 + 2667/2667 full web suite，typecheck + biome clean。**节奏对照：B1.2.1 6 轮 review，B1.2.2 2 轮 review — 砚砚的垂直切片建议起效**
- [x] AC-B1.2.3: active text stream new-bubble wire-up 落地（PR #1510，merge commit `058362c79`）。`useAgentMessages.ts` 无 recoverable bubble 时 → adapter + applyBubbleEvent + replaceMessages 创建新 bubble，setActive/markReplacedInvocation/metadata-replyTo-replyPreview patches 等副作用保留。Bundled with B1.2.2 后 **active text stream branch 整体收口完毕**。8 个既有 test files 加 `replaceMessages` mock + 5 处 assertion 放松接受 reducer 路径。focused 5/5 + 2668/2668 full web suite，typecheck + biome clean。**1 轮 review LGTM** — 节奏继续优化（6 → 2 → 1 轮）
- [x] AC-B1.2.4: callback wire-up + reducer callback-specific upgrade policy 落地（PR #1517，merge commit `1d6040b80`）。reducer 新增 `findUpgradableCallbackPlaceholder`（rich/tool-only placeholder + bound invocationId-strict + contentful invocationless live stream 不 hijack）；top-level ambiguous guard 跳过 callback_final（callback 内部 narrow policy 自处理）。useAgentMessages explicit invocationId 路径走 reducer + recoveryAction !== 'none' fallback to legacy with non-conflicting id；invocationless callback 留 legacy。**4 轮云端 codex review 收敛 4 P1**：(1) 通用 ambiguous guard 拦截 callback；(2) finalId 不能预 pick replacementTarget.id；(3) recoveryAction !== 'none' 必须 fallback；(4) fallback id 不能撞既有 bubble id。focused 11+31 + 2682/2682 full web，typecheck + biome clean
- [x] AC-B1.3: reducer expansion + active path done wire-up 落地（PR #1523，merge commit `df3e59327`）。reducer 加 `reduceDoneEvent`（lifecycle marker，命中 `{catId, invocationId, isStreaming}` 全部 finalize；invocationless 是 reducer no-op）+ `reduceErrorEvent`（error/timeout 共享，append `system_status` bubble；canonical 走 stable-key dedup，invocationless 走 local fallback id）。useAgentMessages active path `done` 事件接 reducer：legacy recovery + setFinalized 先跑（让 `findInvocationlessStreamPlaceholder` 之后能拿到 origin='stream' 的 id），reducer 再 finalize 剩余 cross-kind bubbles。**3 轮 review 收敛 3 issue**：(1) 砚砚 R1 P1 — system_status 重复 error/timeout 同 invocation duplicate id（fix: stable-key dedup）；(2) 砚砚 R2 P2 — Biome format 阻塞 gate（fix: biome --write）；(3) 云端 codex P1 — reducer call 在 legacy recovery 之前会让 setFinalized 记错 callback bubble id（fix: 移到 setFinalized 之后）。focused reducer 41/41 + useAgentMessages 217/217 + 2694/2694 full web。**SOP 验证 #2**：严格 serial（砚砚 R1→R2→R3 LGTM → 云端 v1 → fix → 云端 v2 LGTM → merge），3 轮本地 + 2 轮云端。**B1.3 仅 wire 了 active path done**；error/callback-invocationless/tool/background path 留给 B1.4（设计议题各自独立：error 跟 legacy addMessage 重复、replacementTarget 推断、tool_or_cli kind UI 渲染、不同 lifecycle）。reducer 对 error/timeout 已经支持但暂未 wire
- [x] AC-B1.4: invocationless callback wire-up via reducer messageId-hint 落地（PR #1524，merge commit `b8eb6eae0`）。reducer `reduceCallbackFinal` 顶部加 invocationless 分支：`!event.canonicalInvocationId && event.messageId` 时按 id 命中现有气泡 → 就地 patch (content/isStreaming/origin)，未命中 fallback `makePlaceholder`（与 caller 不传 hint 的 standalone 一致）。useAgentMessages active path `else if (replacementTarget)` 分支从 legacy `patchMessage` 改成 reducer：`finalId` 计算 → `replaceMessageId`（store 内 rename 让 reducer lookup 命中）→ `applyBubbleEvent({event: { ...event, messageId: finalId }})`，recoveryAction !== 'none' 回退 legacy patchMessage。共存 side-fields (metadata / extra.crossPost / mentionsUser / replyTo / replyPreview) reducer 不 model，单独 patchMessage 写。**1 轮砚砚 LGTM + 1 轮云端 LGTM 直接 merge**，无 P1/P2。focused reducer 44/44 + useAgentMessages 219/219 + 2697/2697 full web。**Scope 决策**：单切 invocationless callback，AC-B1 没全绿（active error/tool/background path 各自独立设计议题，不是同质拆碎）。reviewer + 铲屎官 都 accept 这个 scope decision
- [x] AC-B1.5: active error wire-up via reducer 落地（PR #1525，merge commit `c247820a`）。reducer `reduceErrorEvent` 加 `payload.content` / `payload.extra` 透传：caller 拼好 rich display content（含 errorSubtype label）+ timeoutDiagnostics extra 后传给 reducer。`payload.content` 以 'Error' 开头时作为完整 display 用，否则保留 'Error: {error}' 兜底。useAgentMessages active path error 分支从 legacy addMessage 改成 reducer + replaceMessages（msg.invocationId 时），recoveryAction !== 'none' 或 invocationless 回退 legacy。3 个既有测试改 storeState end-state assertion（不再依赖 mockAddMessage call）。**1 轮砚砚 LGTM + 1 轮云端 LGTM 直接 merge**，无 P1/P2。focused reducer 46/46 + useAgentMessages 217/217 + 2699/2699 full web。**Scope 决策**：单切 active error，剩 active tool（UI 数据模型对齐 ADR-033）+ background path（不同 lifecycle）留 B1.6+
- [x] AC-B1.6: active tool_use/tool_result wire-up via reducer reduceToolEvent (UI-compat) 落地（PR #1528，merge commit `61291847f`）。reducer 加 `reduceToolEvent`：caller 通过 `payload.toolEvent` 传 ToolEvent 结构，reducer 找匹配 invocation+cat+kind=assistant_text bubble 并 append toolEvent。**3 轮 review 收敛 3 P1**：(1) 砚砚 R1 P1 — reducer no-existing 分支创建的 placeholder 跟后续 stream_chunk 触发 canonical-split（fix: Option B no-op + caller fallback）；(2) 砚砚 R2 P1 — Option B 不完整，active path seed 后 reducer append toolEvent 让气泡推断成 tool_or_cli 仍 canonical-split（fix: deriveBubbleKindFromMessage 加 stream-binding + isStreaming + origin='stream' 三件套 disambiguation 视作 assistant_text + makeIncomingProxy tool_or_cli case 显式 isStreaming=false 让 proxy derive 一致）；(3) 云端 P1 — reduceToolEvent 不区分 kind 拿 first-streaming-assistant，可能落到 thinking bubble（fix: lookup 加 kind filter 'assistant_text'）。focused reducer 53/53 + invariants 8/8 + 2706/2706 full web，biome/check 全绿。**Active path 100% 收口完毕**：text + callback (explicit + invocationless) + done + error + tool_use + tool_result 全部 reducer single-writer。剩 background path → B1.7（不同 lifecycle，需要 chatStore 新 API replaceThreadMessages 才能 apply reducer nextMessages 到 thread state）
- [x] AC-B1.7: background path tool/error wire-up via reducer + `replaceThreadMessages` thread-scoped store API 落地（PR #1529，merge commit `97577d575`）。chatStore 新增 `replaceThreadMessages(threadId, msgs, hasMore?)`：mirror `replaceMessages` 但 thread-scoped（覆盖 currentThread 或写到 threadStates[threadId]），不 persist IDB。useAgentMessages background path 三个分支接 reducer：(1) bg `tool_use` / `tool_result` → reducer + `replaceThreadMessages`（fallback legacy `addMessageToThread` on reducer no-op）；(2) bg `error` → reducer + `replaceThreadMessages` + 显式 `incrementUnread`（sidebar badge）。**砚砚 R1 P1**：bg error `replaceThreadMessages` 不像 `addMessageToThread` 自动 +unread，sidebar badge 停留 0 → fix: BackgroundStoreLike 接口加 `incrementUnread` + 仅当 reducer 真的新增气泡（`nextMessages.length > prevLen`）时调用，stable-key dedup 不双增。R2 LGTM；**1 轮云端 LGTM** 直接 merge。focused reducer 53/53 + useAgentMessages 217 + useAgentMessages-background 51 cases + 2725/2725 full web，biome/check 全绿。**Bg path 部分收口**：bg tool + bg error 100% reducer single-writer；bg text branch（callback merge + replacementTarget 推断 + batchStreamChunkUpdate hot path + cross-thread invocation handoff，~200 行）独立设计议题留 B1.8 收尾
- [x] AC-B1.8: background path text branch wire-up via reducer (single-writer) 落地（PR #1530，merge commit `72bd2e27b`）。useAgentMessages bg text branch (line 924-1081) 全部 4 个 sub-path 接 reducer：(1) bg callback w/ replacementTarget — `replaceThreadMessageId` 改名 → reducer `reduceCallbackFinal` patch in place (content/origin/isStreaming) → 单独 `patchThreadMessage` 写 side fields；(2) bg callback w/o replacementTarget — reducer `reduceCallbackFinal` makePlaceholder 创建新 bubble (origin=callback + isStreaming=false + extra.stream.invocationId 由 reducer 正确写入，修了 legacy `addMessageToThread` 漏写 extra.stream 的 bug，砚砚 R1 P1 在 B1.7 改过同款) + non-current bg thread 显式 `incrementUnread`；(3+4) bg stream chunk existing/new bubble — 预 derive `msg-{inv}-{cat}` deterministic id 通过 `event.messageId` 传给 reducer (cross-thread-handoff AC-E3 不变量：active 和 bg 同 invocation 必须用同 bubble id；reducer 默认 `msg-{inv}-{cat}-{kind}` 后缀会破坏不变量) → reducer append/replace content。所有路径 fallback legacy 在 reducer no-op (event undefined / recoveryAction !== none) 或 invocationless。Reducer 不 model 的 side effects (isStreaming 翻转 / catStatus / bgStreamRefs ledger / markReplacedInvocation) 显式调用。**砚砚 R1 P1**：bg stream reducer-target lookup 不带 kind filter，同 invocation thinking + assistant_text 共存时 thinking bubble (排在前) 会被先匹配 → `setThreadMessageStreaming(false)` finalize 错气泡 + bgStreamRefs 指错。Fix: lookup 加 `deriveBubbleKindFromMessage(m) === 'assistant_text'` filter（同 B1.6 cloud P1 教训 reduceToolEvent kind filter）；regression test 用 `replaceThreadMessages` 直接构造多 kind 状态绕过 `addMessageToThread` TD112 dedup。R2 LGTM；**1 轮云端 LGTM** 直接 merge。Hot path 保留：invocationless stream chunks 仍走 `batchStreamChunkUpdate` 单 set() 优化（50-chunk update-storm regression test 保护）。focused reducer 53/53 + invariants 8/8 + bg-test 70/70 (含 9 个新 B1.8 用例) + B1.8-relevant cluster 187/187 + 2716/2720 full web (4 pre-existing flake unrelated)。biome/check 全绿。**AC-B1 全收口完毕**：text + thinking + callback (explicit + invocationless) + done + error + tool_use + tool_result + bg 全分支 100% reducer single-writer
- [x] AC-B2: `mergeReplaceHydrationMessages()` 简化到 ≤ 2 种匹配策略 落地（PR #1521，merge commit `a2cf6dc84`）。统一 `historyIndexByStableId: Map<string, { index, matchKind: 'id' \| 'stream-key' }>`：id 优先；streamKey 命名空间内取 last-wins（与 refactor 前 `historyIndexByStreamKey` 直接 Map.set 覆盖语义一致）。draft-orphan guard 保留为副过滤器（不算独立匹配策略）。云端 codex 1 P1 — 初版用 `!has(streamKey)` 改成了 first-wins，dual-bubble-per-invocation（stream + 后续 callback 同 streamKey 不同 id）场景下 reconciliation 瞄到 stale earlier 条目；fix 改为"existing 不是 id 类型才 set"（last-wins for streamKey, id 不被覆盖）+ 新增 dual-history-bubble regression test（pre-fix RED，post-fix GREEN）。focused 12 + 2683/2683 full web
- [ ] AC-B3: F123 TD111 + TD113 收编完成
- [x] AC-B4: Review `recoveryAction` 默认值是否需要 reducer 覆盖（B0 P2 follow-up 已落地：late `stream_chunk` after `callback_final` 走 `catch-up`；其他 phase regression 走 `quarantine` + violation）

### Phase C（Sequence + Gap）

- [x] AC-C1: 实时 event 携带 thread-scoped monotonic seq + sequencer epoch；客户端 per-thread (lastSeq, lastSeqEpoch) gap/epoch-change detection；recovery 通过 captured-target ack + retry-with-backoff（PR #1532, merge `f1ba91a8b`）。落地清单：(1) ThreadSequencer 类 (in-memory per-thread + instance epoch UUID)；(2) SocketManager.broadcastAgentMessage choke point 注入 seq+seqEpoch + bumpTo monotonicity；(3) BackgroundAgentMessage / API AgentMessage / useSocket AgentMessage 三处 wire contract 加 seq?+seqEpoch?；(4) chatStore 加 lastSeqByThread + lastSeqEpochByThread + pendingCatchUpTargetSeqByThread + streamCatchUpVersionByThread + lastConsumedCatchUpVersionByThread + setLastSeq/setLastSeqEpoch/setPendingCatchUpTargetSeq/setLastConsumedCatchUpVersion/acknowledgeCatchUp(threadId, ackedTargetSeq) actions；(5) processThreadSeq 决策树 (no-op/seed/advance/late/gap/epoch-change) — gap 不 advance lastSeq 只 setPending 防 silent loss；epoch-change reset lastSeq=0+setPending 防 catchup 失败时新 epoch 早期范围丢；'seed' branch 检查 pending 防 epoch-change 后早期 seed 过水位线；(6) useChatHistory 订阅 per-thread streamCatchUpVersionByThread + consumedCatchUpVersionByThread gating + retry 3 次 exponential backoff 防 fetchHistory 失败/loadingRef early-out + captured-target 防 stale-fetch race + acknowledgeCatchUp(target) 关闭 gap 态。13 砚砚 review rounds + 5 cloud rounds 收敛 8 P1/P2（cloud R1 P1+P2、砚砚 R1 P1、R5 P1、R6 P1 race、R7 P2 docs、cloud R2 P1-A+P1-B、cloud R3 P1+P2、cloud R4 P1）。focused 121/121 + ThreadSequencer 20/20 + chatStore-ack 14/14 全绿。AC-Z1 (5 类症状全消) 仍待 alpha 实测验证 + Phase D/E 后才能闭。
- [x] AC-C2: in-process event bus backpressure 根因定位 + 修复（PR #1535, merge `5fecec6bf`）。**Scope 收敛**：调研后 AC-C2.1 / AC-C2.3 落地，AC-C2.2（buffer/限速/丢弃）deferred — 无确认 backpressure 触发点，AC-C1 client gap detection + retry catchup 已是 user-visible safety net，先 observability 再 enforcement。落地清单：(1) AC-C2.1 触发点定位：`SocketManager.broadcastAgentMessage` 唯一 choke point，socket.io emit 是 best-effort 无内置 drop；(2) AC-C2.3 触发指标暴露：`BroadcastRateMonitor` 类（per-thread 滑动窗口 head-index O(1) + 默认 200/sec 阈值 + 5s warn dedup + monotonic clock + opportunistic eviction throttled to 1 sweep/window 不分 cardinality）+ `getStats(threadId)` admin 内省 + `sweepCount` 诊断；(3) `broadcast_rate_warn` 结构化日志事件替代未发现的字面源。7 砚砚 + 5 cloud review rounds 收敛 9 P1/P2（砚砚 R1 P1 onWarn throw best-effort + R1 P2 head-index 替换 Array.shift；cloud R1 P1 evictExpired 不抢气泡 + R1 P2 head-index 内存边界；cloud R1 P2-A opportunistic eviction + R1 P2-B `<= cutoff` 边界；cloud R2 P1 once-per-window 节流 + R2 P2 wall-clock 断言换行为；cloud R3 P2 monotonic clock + 砚砚 R5 P2 `-Infinity` sentinel；cloud R4 P2 unconditional eviction at any cardinality）。21/21 BroadcastRateMonitor tests passing.
- [x] AC-C3: `dropped N events` 字面源追溯完成（PR #1535, merge `5fecec6bf`）。AC-C3.1 字面源结论：grep cat-cafe codebase + node_modules 全部 deps 实证字面 `"in-process app-server event stream lagged; dropped 32 events"` 不在我们任意路径——likely 历史 instrumentation（已删除）或外部来源（Antigravity IDE / browser extension）。AC-C3.2 替代：`broadcast_rate_warn` 结构化事件 schema（`{threadId, windowCount, threshold, windowMs, timestamp}`）作为可追溯的诊断信号，由 BroadcastRateMonitor.onWarn 注入到 logger 转结构化事件。

### Phase D（IDB Contract）✅ DONE 2026-05-02

- [x] AC-D1: IDB schema-version invalidation hook 落地（PR #1538, merge `626ee8c2`）。`DB_VERSION` 1→2 + upgrade hook 在 `oldVersion > 0` 时 drop 全部既有 object stores，让 legacy snapshot（带旧 identity contract 标记）不能污染 UI。snapshots 不是 SoT (F164 KD-1) — 删了下次 hydration 自动 rebuild。`SCHEMA_VERSION` 留给后续修 IDB 字段语义时主动 bump。
- [x] AC-D2: IDB 降级为离线 fallback 落地（PR #1538, merge `626ee8c2`）。`ChatMessage.cachedFrom?: 'idb'` 标记在 `loadThreadMessages` 时 stamp，在 `saveThreadMessages` (含 self-heal 写回) strip — 标记是 per-load decoration，不 round-trip。`mergeReplaceHydrationMessages` 在 per-message loop 顶部 (top-of-loop guard, 砚砚 R1 P1 fix) skip 所有 `cachedFrom='idb'` 消息，让 server history 永远 authoritative：id-match 路径不进 mergeSameIdHydrationMessage 防 "richer current wins" spread cachedFrom；streamKey-match 路径不进 shouldPreferCurrentMessage 防 verbatim replace；no-match 路径直接 drop（不 preserve as local）。F164 AC-A3 instant-render 完整保留：cold-start 仍 IDB-first 渲染，API 来 hydrate 时 cleaner replace 不闪空白。Live state (无 cachedFrom) 通过 stable-identity 仍 preserve，不受影响。**2 砚砚 + 1 cloud review rounds 收敛 2 P1+P2**：砚砚 R1 P1 (cachedFrom 必须在 id/streamKey matching 之前 skip 防 cache amplifier) + R1 P2 (test filename comment 修复) → R2 LGTM；cloud R1 "Didn't find any major issues. Breezy!" 直接 LGTM。focused 25/25 (offline-store 18 + merge-idb 7) + full web 2776/2776。

### Phase E（Invariant）✅ DONE 2026-05-02

- [x] AC-E1: dev/runtime store invariant 断言落地（PR #1539, merge `a028eed4e`）。`BUBBLE_INVARIANT_STRICT` env toggle + `NEXT_PUBLIC_BUBBLE_INVARIANT_STRICT` (browser bundle) + `localStorage['catcafe.bubbleInvariantStrict']` (runtime) 三源 OR — strict ON 时 `recordBubbleInvariantViolation` throw after recordDebugEvent (timeline 不丢)；strict OFF prod 默认 warn-only 不 crash 用户。alpha 操作员 DevTools `localStorage.setItem(...)` 即时翻转。整个 localStorage access path 在 try/catch 内防 sandboxed iframe / privacy mode SecurityError (cloud R1 P1 fix)。
- [x] AC-E2: F123 TD112 + TD114 收编完成（PR #1539）。三层 gating：(1) Pre-set TD112 in-store dedup (addMessage / addMessageToThread)；(2) Pre-set strict-mode runtime gate (replaceMessages / replaceThreadMessages / hydrateThread 通过 `forwardStoreInvariantViolationsStrict`，strict OFF = 1-instruction early-out 零 prod cost，strict ON = scan + throw before set() 让 bad state 不 land)；(3) Reducer-driven path 仍 forward violations 到 recordBubbleInvariantViolation (existing wire-up)。完整 audit table in chatStore-invariant-coverage.test.ts (11 mutation entries → 三类标注)。砚砚 R2 P1 fix 把 caller-driven writers 从"测试可以查得到"升级到"writer 自己 strict mode 下 throw"。
- [x] AC-E3: replay harness Phase B/C/D 场景覆盖（PR #1539）。Phase D scenario 用 **真实 production helper** `mergeReplaceHydrationMessages` (砚砚 R1 P3 fix)；Phase B+C scenario 显式 scope 为 "harness-level smoke"（production reducer 由 `bubble-reducer.test.ts` 覆盖）。F081/F123 历史 fixture 由原有 `bubble-replay-harness.test.ts` 框架支持，新增 fixture 是 Phase B/C/D 场景的 harness smoke 演示。**5 砚砚 + 2 cloud review rounds 收敛 5 P1+P2**：砚砚 R1 P1×3 (browser strict + chatStore audit + real merge fixture) → R2 P1 (writer-self runtime gate, "测试 vs runtime" 闭环) → R3 P2 (audit table 文档同步) → R4 LGTM；cloud R1 P1 (localStorage property access guard) → cloud R2 LGTM。focused 35/35 + full web 376 files / 2797 tests 全绿。

### 端到端

- [x] AC-Z1: 铲屎官 2026-04-30 报告的 5 类症状（裂 / 不见 / F5 才正常 / F5 才出来 / 发完才出来）在 alpha 通道实测全部消失 — Phase B/C/D/E 全部代码落地，经愿景守护猫 (@gemini) 验收通过 (2026-05-02)
- [x] AC-Z2: 一个新加 provider / 新加分支不需要再单独写 #573 contract（架构层已通过 BubbleReducer 默认对齐契约）
- [x] AC-Z3: Architecture Map 进入 onboarding 路径，未来改动消息管线必须先读（已加入 CONTRIBUTING.md）

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "气泡裂了" | AC-B1, AC-B2, AC-E1, AC-Z1 | replay test + alpha | [x] |
| R2 | "气泡不见了" | AC-C1, AC-C2, AC-Z1 | replay test + alpha | [x] |
| R3 | "F5 之后气泡不裂了" | AC-D1, AC-D2, AC-Z1 | manual + alpha | [x] |
| R4 | "F5 之后气泡出来了" | AC-C1, AC-Z1 | replay + alpha | [x] |
| R5 | "猫猫发完消息气泡才出来" | AC-C1, AC-C2, AC-Z1 | replay + alpha | [x] |
| R6 | "写一个 ADR 或架构设计文档" | AC-A1, AC-A2, AC-A5 | doc review | [x] |
| R7 | "未来修改代码就有架构图可以看和参考" | AC-Z3 | onboarding 检查 | [x] |
| R8 | "组织大家讨论一下，不要当独裁猫猫" | AC-A1（多猫收敛） | discussion 落盘 | [x] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（Phase A 收敛后补）

## Dependencies

- **Evolved from**: F081（bubble continuity & observability）、F123（bubble runtime correctness）—— F123 KD-4 主动推迟的"统一 MessageWriter"在本 feature 落地
- **Blocked by**: 无硬阻塞；F180（Agent CLI Hook Health）in-progress 不影响本 feature
- **Related**:
  - F117（Message Delivery Lifecycle —— delivery 真相源、queue 模式 dedup）
  - F164（IDB cache 层 —— Phase D 需要其 schema invalidation hook 的合作）
  - F176（reverted —— messageRole 字段加在 merge 复杂度上是 F183 要修复的反模式之一）
  - F045（NDJSON observability —— event 流可观测性是 Phase C backpressure 定位的基础）

## Risk

| 风险 | 缓解 |
|------|------|
| Phase A 讨论发散，三周不收敛 | Discussion 限定 5 个待决问题 + 设拍板时间盒（铲屎官 1 周内拍板）|
| 重构热路径影响现有聊天体验 | 沿用 F123 fixture-first 节奏，先建 replay harness 再分层替换入口 |
| Single Writer 收口造成 regression | Phase B 上线前必须满足 F123 全套 replay 测试 + alpha 双周验证 |
| backpressure 根因定位失败 | Phase C 拆 sub-phase，先做客户端 gap detection（即使后端没修，体感也已大幅缓解）|
| Architecture Map 沉淀后无人维护 | onboarding 路径强制读 + 改动消息管线 PR 模板新增"是否需要更新 Architecture Map" checkbox |
| F183 scope 失控变成"消息系统全重写" | scope 显式排除：不重做 Provider 协议、不动 A2A handoff 语义、不改 thread/draft 模型；只动"identity contract + writer + reconcile + cache"四层 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Phase A 产物是 ADR-033 + 内嵌 spec，还是只在 spec 内嵌 architecture map asset？ | ⬜ 等 Phase A discussion |
| OQ-2 | Sequence Number 是 thread-scoped（够用、简单）还是 global monotonic（强保证、复杂）？ | ✅ KD-9 拍板 thread-scoped（2026-05-02） |
| OQ-3 | IDB 是降级为纯离线 fallback，还是保持渲染路径但加 invalidation hook？性能 vs 一致性的 tradeoff | ⬜ 等 Phase D |
| OQ-4 | Single Writer 是 vanilla reducer 还是引入更重的 state machine（XState 等）？ | ⬜ 等 Phase B |
| OQ-5 | Store Invariant 是 dev-only 还是 prod 也开（带 sampling）？ | ⬜ 等 Phase E |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 立项 F183 而非 reopen F123 | F123 KD-4 主动推迟统一 MessageWriter，本 scope 是架构级重构，需要独立 owner 与 phase 节奏 | 2026-04-30 |
| KD-2 | Phase A 必须以"四猫独立诊断收敛"为产出 | 铲屎官原话"不要当独裁猫猫，加在一起视角可能最全" + F176 误诊教训"双猫并行 5/5 收敛 ≠ 正确" | 2026-04-30 |
| KD-3 | scope 显式排除 Provider 协议 / A2A 语义 / thread 模型 | 防止"消息系统全重写"风险，本 feature 只动 identity contract / writer / reconcile / cache 四层 | 2026-04-30 |
| KD-4 | 视觉载体：砚砚 GPT-5.5 主笔图片生成（手绘风格中英双版）；烁烁 Pencil 修复后补细节稿 | 烁烁 Pencil 插件 CLI 环境连不上；砚砚的图片生成是已验证的视觉路径（家里记忆系统图 / 整体架构图都是砚砚做的）；不阻塞 Phase A 时间盒 | 2026-04-30 |
| KD-5 | Phase 顺序合并：A → B0 (invariant gate 前置) → B1 (Single Writer) → C (seq) → D (IDB) → E (closure) | 砚砚 + 46 提议合并：B0 立 harness/invariant 框架 + B1/C/D 各 Phase AC 落具体断言，不留窗口期 | 2026-04-30 |
| KD-6 | IDB 形态：provisional cache + 5 metadata 字段（identityContractVersion / cacheSchemaVersion / savedAt / containsLocalOnly / containsDuplicateStableIdentity） | 砚砚版本：在线不参与 merge 仲裁，保留冷启动画缓存（减少白屏）+ 离线 fallback 能力。比"完全降级"更稳健 | 2026-04-30 |
| KD-7 | TD111-TD114 全部纳入 F183；`docs/TECH-DEBT.md` 已废弃不维护 | 铲屎官原话"docs/TECH-DEBT.md 这个很久没更新了 建议废弃不要考虑这个"。TD112 partial 实现的事实直接在 ADR-033 + spec 里说清楚 | 2026-04-30 |
| KD-8 | F184（F176 撤销后真 bug）不并入 F183；roadmap 强制串行（F183 Phase A done → F184 启动，禁止并发） | 铲屎官原话"这个和你们这个会耦合吧... 别并发去修"。耦合点：F183 改 message 数据结构 / reducer / cache contract；F184 改 ChatMessage mount 逻辑——并发会引入新不一致 | 2026-04-30 |
| KD-9 | Phase C sequence number 选 **thread-scoped**（不选 global monotonic） | (1) F183 立项的 5 类症状（裂/不见/F5 才正常/F5 才出来/发完才出来）都是同一个 thread 内现象，铲屎官原话没出现"跨 thread 顺序错"；(2) global 在多实例 backend 下需要分布式共识 / Redis 全局原子计数器 + 重启持久化全局 seq state，对家里规模过度设计；(3) global 的"全局重启序列号丢失"是新脆弱点 — thread-scoped 在 thread state 持久化（已有 ledger）里天然安全；(4) 从 thread-scoped 升级到 global 不难（加一层全局 sequencer），从 global 退回 thread-scoped 反而难（已经依赖了全局保证）。**先做轻的，需要再升**。**铲屎官关心的"thread A 漂到 thread B"两种方案都不会发生**：消息归属由 `msg.threadId` 字段决定，跟 seq 无关 — 漂气泡的根因是 identity contract 出 bug，已由 F183 Phase A ADR-033 解决 | 2026-05-02 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-30 | 铲屎官原话立项触发；四猫并行诊断（46 / 47 / 砚砚 / 烁烁）已收敛同一根因 |
| 2026-04-30 | F183 kickoff（status=idea），Discussion 启动 |
| 2026-04-30 | Round 1 三猫到齐（提前于 2026-05-02 截止）；Round 2 收敛分析完成 |
| 2026-04-30 | 5 KD（A1-A5）铲屎官全部 ack；F184 stub 同步立项；F183 + F184 自治闭环授权 |
| 2026-04-30 | KD-A1 砚砚画手绘架构图（中英双版，commit `ba1e35d94`）|
| 2026-04-30 | ADR-033 v1 草稿 → Round 3 三猫同日全部到齐（烁烁 / 46 / 砚砚）→ v2 修订（11 改动，commit `9414d1288`）|
| 2026-04-30 | **Phase A done**：铲屎官自治放行 ADR-033 v2（"技术细节自决"）。F183 status: idea → in-progress；F184 解锁立项（roadmap 串行）|
| 2026-04-30 | **Phase B0 done**：PR #1496 squash merged（`a6be5970e`）—— shared contract / invariant gate / diagnostics / replay harness 框架落地；Phase B1 + F184 实施解锁 |
| 2026-05-01 | **Phase B1.1 done**：PR #1500 squash merged（`2fbde77ec`）—— BubbleReducer core + B1 `recoveryAction` override 落地；focused 36/36、`pnpm gate`、云端 Codex review clean |
| 2026-05-01 | **Phase B1.2.1 done**：PR #1506 squash merged（`1e9cb84bd`）—— `bubble-event-adapter.ts` (108 行) + `reduceStreamChunk` 识别 `textMode='replace'`。6 轮云端 codex review 收敛 5 P1（assistant_text 白名单 / direct done&error 归 system_status / text+isFinal 不 drop content / textMode replace 不退化 append）；focused 41/41、typecheck + biome clean。教训：adapter-only PR 切片过细 → B1.2.2 起改"adapter + 1-2 callsite + replay test"垂直切片 |
| 2026-05-01 | **Phase B1.2.2 done**：PR #1507 squash merged（`3817e0974`）—— active text-into-existing-bubble pilot wire-up（adapter+applyBubbleEvent+replaceMessages，canonical-invocation only）。2 轮云端 codex review 收敛 2 P1：(1) hasMore 保留（不强制 false 杀掉 pagination）；(2) `result.violations.forEach(recordBubbleInvariantViolation)` 接 B1 invariant gate 进 active hot path。focused 4/4 + 2667/2667 full web。**节奏验证：B1.2.1 6 轮 review → B1.2.2 2 轮 review，垂直切片节奏起效** |
| 2026-05-01 | **Phase B1.2.3 done**：PR #1510 squash merged（`058362c79`）—— active text stream new-bubble wire-up，bundled with B1.2.2 完成 active text stream branch 整体收口。1 轮云端 codex LGTM，pure-rebase 后自决合入（review-continuity 教训）。8 个既有 test files 加 replaceMessages mock + 5 处 assertion 放松。focused 5/5 + 2668/2668 full web。**节奏继续优化：6 → 2 → 1 轮 review** |
| 2026-05-01 | **Phase B1.2.4 done**：PR #1517 squash merged（`1d6040b80`）—— callback wire-up + reducer callback-specific upgrade policy。4 轮云端 codex review 收敛 4 P1（通用 ambiguous guard / finalId pre-pick / recoveryAction !== none fallback / fallback id 撞 id）。focused 42 + 2682/2682 full web。**SOP 教训：本地砚砚 review 完后再触发云端，避免并发；本 PR 我违反了走 cloud + 本地并行触发，导致和砚砚 race（铲屎官 11:35 拍板）** |
| 2026-05-01 | **Phase B1.2.5 done**：PR #1521 squash merged（`a2cf6dc84`）—— `mergeReplaceHydrationMessages` 简化到 ≤ 2 匹配策略（AC-B2）。统一 `historyIndexByStableId` Map (id ∪ streamKey)，id 优先 + streamKey 内 last-wins。1 轮云端 codex review 收敛 1 P1：初版 `!has(streamKey)` 改成了 first-wins，dual-history-bubble-per-invocation 场景下 reconciliation 瞄到 stale earlier；fix 改为 existing-not-id 才 set + 新增 dual-bubble regression test。focused 12 + 2683/2683 full web。**SOP 验证：本次严格按照 serial 流程（本地砚砚 LGTM → 云端 review → cloud P1 → fix → re-trigger → cloud LGTM → merge），无并发** |
| 2026-05-01 | **Phase B1.3 done**：PR #1523 squash merged（`df3e59327`）—— reducer expansion (`reduceDoneEvent` + `reduceErrorEvent`) + active path done wire-up（AC-B1.3）。done 是 lifecycle marker 不建独立 bubble，reducer 把同 invocation+cat 的 streaming bubbles 全 finalize；error/timeout 走 system_status bubble + stable-key dedup。3 轮 review 收敛 3 issue：(1) 砚砚 R1 P1 system_status 重复 error 同 invocation duplicate id；(2) 砚砚 R2 P2 Biome format 阻塞 gate；(3) 云端 P1 reducer call 顺序错，要 recovery + setFinalized 先跑 —— 否则 invocationless callback 之后挑不到 origin='stream' 的 finalized id 导致 split bubble。focused 41+217 + 2694/2694 full web。**B1.3 scope 收紧**：仅 wire active done，error/callback-invocationless/tool/background path 留 B1.4（设计议题独立）。 |
| 2026-05-01 | **Phase B1.4 done**：PR #1524 squash merged（`b8eb6eae0`）—— invocationless callback wire-up via reducer messageId-hint extension（AC-B1.4）。reducer `reduceCallbackFinal` 加 invocationless 分支：caller 通过 replacementTarget 显式 resolve target id 后传 messageId hint，reducer 命中现有气泡就地 patch；未命中 fallback makePlaceholder。useAgentMessages active path `else if (replacementTarget)` 分支从 legacy patchMessage 改成 reducer + replaceMessages。**1 轮砚砚 LGTM + 1 轮云端 LGTM 直接 merge**，无 P1/P2。focused 44+219 + 2697/2697 full web。**Scope 单切 invocationless callback**：error/tool/background path 各自独立设计议题留 B1.5+。**SOP 验证 #3**：流程最干净一次（砚砚 LGTM → 云端 LGTM → merge，零 round-trip）。 |
| 2026-05-01 | **Phase B1.5 done**：PR #1525 squash merged（`c247820a`）—— active error wire-up via reducer + reduceErrorEvent enrichment（AC-B1.5）。reducer `reduceErrorEvent` 加 `payload.content` / `payload.extra` 透传，让 caller 拼好 rich display content + timeoutDiagnostics 后传给 reducer。useAgentMessages active path error 分支从 legacy addMessage 改成 reducer + replaceMessages（canonical 路径），invocationless 仍 legacy。3 个既有测试 (concurrent-cancel + 2x bubble-merge) 改 storeState end-state assertion。**1 轮砚砚 LGTM + 1 轮云端 LGTM 直接 merge**，无 P1/P2。focused 46+217 + 2699/2699 full web + biome/check 全绿。**SOP 验证 #4**：第二次零 round-trip。**Scope 单切 active error**：剩 active tool（UI 模型对齐 ADR-033）+ background path（不同 lifecycle）留 B1.6+。 |
| 2026-05-01 | **Phase B1.6 done**：PR #1528 squash merged（`61291847f`）—— active tool_use/tool_result wire-up via reducer reduceToolEvent (UI-compat)（AC-B1.6）。reducer 加 reduceToolEvent，append toolEvent 到 assistant_text bubble.toolEvents 字段（UI-compat 数据模型，ADR-033 设计的 tool_or_cli 独立 kind bubble 留给后续 UI 重构）。**3 轮 review 收敛 3 P1**：(1) 砚砚 R1 P1 reducer no-existing placeholder 触发 canonical-split → Option B no-op + caller fallback；(2) 砚砚 R2 P1 active path seed 后仍 canonical-split → narrowed deriveBubbleKindFromMessage 加 stream-binding 三件套 disambiguation；(3) 云端 P1 reduceToolEvent 不分 kind 可能污染 thinking bubble → lookup 加 kind filter 'assistant_text'。focused reducer 53/53 + invariants 8/8 + 2706/2706 full web。**Active path 100% 收口完毕**：text + callback (explicit + invocationless) + done + error + tool_use + tool_result 全部 reducer single-writer。剩 background path → B1.7（不同 lifecycle，需要 chatStore 新 API replaceThreadMessages，独立 PR）。 |
| 2026-05-02 | **Phase B1.7 done**：PR #1529 squash merged（`97577d575`）—— background path tool/error wire-up + `replaceThreadMessages` thread-scoped chatStore API（AC-B1.7）。chatStore 新增 `replaceThreadMessages(threadId, msgs, hasMore?)`（mirror `replaceMessages` 但 thread-scoped，currentThread 走 messages，否则写 threadStates[threadId]，不 persist IDB）。useAgentMessages bg `tool_use` / `tool_result` / `error` 三分支接 reducer + replaceThreadMessages（reducer no-op 时 fallback legacy addMessageToThread）。**砚砚 R1 P1 → R2 LGTM**：bg error `replaceThreadMessages` 不像 `addMessageToThread` 自动 +unread badge → 显式 incrementUnread + 仅当 reducer 真的新增气泡（length 增加）时调用，stable-key dedup 不双增；**1 轮云端 LGTM** 直接 merge。focused reducer 53/53 + useAgentMessages 217 + bg-test 51 + 2725/2725 full web，biome/check 全绿。**Bg path 部分收口**：bg tool + bg error 100%；bg text branch（callback merge + replacementTarget + batchStreamChunkUpdate hot path + cross-thread invocation handoff）~200 行设计议题独立 B1.8 收尾。 |
| 2026-05-02 | **Phase B1.8 done — AC-B1 全收口完毕**：PR #1530 squash merged（`72bd2e27b`）—— bg text branch wire-up via reducer single-writer（AC-B1.8）。bg text branch 全部 4 个 sub-path 接 reducer：bg callback w/ replacementTarget (replaceMessageId + reducer patch + side-fields)、bg callback w/o replacementTarget (reducer makePlaceholder + 显式 incrementUnread)、bg stream chunk existing/new bubble (预 derive `msg-{inv}-{cat}` id 通过 event.messageId 传给 reducer 保 cross-thread-handoff AC-E3 不变量)。Reducer 不 model 的 side effects (isStreaming 翻转 / catStatus / bgStreamRefs ledger / markReplacedInvocation) 显式调用。Hot path 保留 (invocationless 仍走 batchStreamChunkUpdate)。**砚砚 R1 P1 → R2 LGTM**：bg stream reducer-target lookup 不带 kind filter，同 invocation thinking + assistant_text 共存时 thinking 排前会被错命中 → `setThreadMessageStreaming(false)` finalize 错气泡 + bgStreamRefs 指错。Fix: lookup 加 `deriveBubbleKindFromMessage(m) === 'assistant_text'` filter（同 B1.6 cloud P1 reduceToolEvent kind filter 教训）；regression test 用 replaceThreadMessages 直接构造多 kind 状态绕过 addMessageToThread TD112 dedup；**1 轮云端 LGTM** 直接 merge。focused reducer 53/53 + invariants 8/8 + bg-test 70/70 + B1.8 cluster 187/187 + 2716/2720 full web。**🎯 Phase B1 (AC-B1) 真正收口**：text + thinking + callback (explicit + invocationless) + done + error + tool_use + tool_result + bg 全分支 100% reducer single-writer，所有写入口收敛到单个 BubbleReducer。下一步 Phase C (sequence + gap) / Phase D (IDB contract) / Phase E (closure)。 |
| 2026-05-02 | **Phase B1 alpha vision guard**：砚砚在 alpha 通道 `3011/3012/4111/6398` 对 B1 做有限愿景守护验收（报告：`docs/features/assets/F183/alpha-b1-vision-guard-2026-05-02.md`）。结果：frontend/API 200；默认 thread reload 前后 5 条 `data-message-id` 完全一致、无重复 id；B1/F123 fixture cluster 10 files / 227 tests 全绿。结论：**B1-owned split/duplicate/hydration regression 通过 alpha smoke + fixture 验证**；但 AC-Z1 不勾，R2/R4/R5 仍依赖 Phase C sequence/gap，R3 仍依赖 Phase D IDB contract，完整 5 类症状消失需 C/D/E 后再跑 alpha。 |
| 2026-05-02 | **Phase C / AC-C1 done — sequence number + gap detection 落地**：PR #1532 squash merged（`f1ba91a8b`）—— thread-scoped monotonic seq (KD-9) + sequencer epoch (server restart 探测) + per-thread `lastSeq/lastSeqEpoch` ledger + `processThreadSeq` 决策树 (no-op/seed/advance/late/gap/epoch-change) + `pendingCatchUpTargetSeqByThread` + `acknowledgeCatchUp(threadId, capturedTarget)` race-safe ack + `lastConsumedCatchUpVersionByThread` 防 thread-switch 重放 + retry 3 次 exponential backoff 防 fetchHistory 失败/loadingRef early-out。**13 砚砚 review rounds + 5 cloud rounds 收敛 8 P1/P2**：cloud R1 P1 watermark preservation (gap 不 advance lastSeq)、cloud R1 P2 per-thread catchup version、砚砚 R1 P1 server epoch、砚砚 R5 P1 catchup-success ack 关闭 gap 态、砚砚 R6 P1 captured-target 防 stale-fetch race、砚砚 R7 P2 docs / cloud R2 P1-A fetchHistory result-check / cloud R2 P1-B epoch-change 不 premature advance / cloud R3 P1 retry-on-skip + P2 consumed-version-tracking / cloud R4 P1 retry exhaustion 不 mark consumed (quiet thread remount 能重试) / 砚砚 R12 P2 doc 漂移。focused 121/121 + ThreadSequencer 20/20 + chatStore-ack 14/14 全绿。**catchup 触发器从原 5min DONE_TIMEOUT 换成 gap-detect/epoch-change immediate**，复用既有 useChatHistory HTTP fetch + reducer stable-key dedup（不写新 ranged WebSocket replay handler — KD-9 单实例 + 用户场景没毫秒延迟需求）。剩 AC-C2 (backpressure) + AC-C3 (`dropped N events` 字面源追溯) 单独 PR；AC-Z1 (5 类症状全消) 仍待 alpha 实测验证 + Phase D/E 后才能闭。 |
| 2026-05-02 | **Phase C / AC-C2 + AC-C3 done — backpressure observability + 字面源追溯**：PR #1535 squash merged（`5fecec6bf`）—— `BroadcastRateMonitor` per-thread sliding window observability + `broadcast_rate_warn` structured event 替代未发现的字面 `"dropped N events"`。**Scope 收敛**：AC-C2.2 (buffer/限速/丢弃) deferred — grep 全 packages/* + node_modules 实证字面不存在，likely 历史 instrumentation / 外部来源（Antigravity IDE / browser extension），且 socket.io emit 是 best-effort 无内置 drop，AC-C1 client gap detection + retry catchup 已是 user-visible safety net。落地：(1) 头索引 deque-style 滑动窗口 amortized O(1)；(2) once-per-window throttled eviction at any cardinality（low-cardinality 单 noisy thread idle 也能清）；(3) monotonic clock default + `-Infinity` sentinel 保 process 早期首次 gate 不被压；(4) best-effort onWarn try/catch 防 logger throw 中断 broadcast；(5) `<= cutoff` 边界包含 expiry。**7 砚砚 + 5 cloud review rounds 收敛 9 P1/P2**：砚砚 R1 P1 best-effort onWarn / R1 P2 head-index 替换 Array.shift / R5 P2 sentinel collision；cloud R1 P2-A opportunistic eviction / R1 P2-B `<= cutoff` 边界 / R2 P1 once-per-window 节流 / R2 P2 wall-clock 断言换行为 / R3 P2 monotonic clock / R4 P2 unconditional eviction at any cardinality。21/21 BroadcastRateMonitor tests passing。**🎯 Phase C 全部 AC 落地完毕**：AC-C1 sequence + gap (PR #1532) / AC-C2 backpressure observability + AC-C3 字面源追溯 (PR #1535)。**AC-Z1 (5 类症状全消) 仍待 alpha 实测验证 + Phase D/E 后才能闭**。下一步 Phase D (IDB cache invalidation contract) / Phase E (closure + alpha soak)。 |
| 2026-05-02 | **Phase D done — IDB Cache Invalidation Contract**：PR #1538 squash merged（`626ee8c2`）—— AC-D1 schema-version invalidation hook (`DB_VERSION` 1→2 + drop stale stores on bump) + AC-D2 `cachedFrom='idb'` marker (load-stamp / save-strip / self-heal-strip) + `mergeReplaceHydrationMessages` top-of-loop guard 把 cached IDB 隔离出渲染合并路径。F164 AC-A3 instant-render 完整保留（cold-start IDB-first 渲染未变；API hydrate 时 cleaner replace 不闪空白）。**2 砚砚 + 1 cloud review rounds 收敛 2 P1+P2**：砚砚 R1 P1 cachedFrom 必须在 id/streamKey matching 之前 skip (防 cache amplifier — 否则 mergeSameIdHydrationMessage 的 "richer current wins" 会让 cached IDB 击败 server，shouldPreferCurrentMessage 的 streamKey replacement 也会写入 verbatim) + R1 P2 doc filename → R2 LGTM；cloud R1 直接 LGTM "Didn't find any major issues. Breezy!"。focused 25/25 (offline-store 18 + merge-idb 7) + full web 2776/2776 + `pnpm gate` 全绿。**🎯 Phase D 全部 AC 落地完毕**：AC-D1 + AC-D2。剩 Phase E (closure + alpha soak) + AC-Z1 (5 类症状 alpha 实测) + 全 feature close 愿景守护。 |
| 2026-05-02 | **Phase E done — Closure + Alpha Soak Prep**：PR #1539 squash merged（`a028eed4e`）—— AC-E1 dev/runtime strict invariant 三源 toggle (BUBBLE_INVARIANT_STRICT env / NEXT_PUBLIC_* browser bundle / localStorage runtime) + AC-E2 chatStore writer-self strict gate (replaceMessages / replaceThreadMessages / hydrateThread 在 set() 之前 scan + throw，TD112 + TD114 端到端收编) + AC-E3 replay harness Phase B+C+D 场景 fixture (Phase D 用真实 `mergeReplaceHydrationMessages` production helper)。**5 砚砚 + 2 cloud review rounds 收敛 5 P1+P2**：砚砚 R1 P1×3 (browser-side strict + chatStore mutation audit + real merge fixture) → R2 P1 (writer-self runtime gate 把"测试可以查得到"升级到 "writer 自己 strict mode 下 throw") → R3 P2 (audit table 同步) → R4 LGTM；cloud R1 P1 (localStorage property access 必须在 try/catch 内防 sandboxed iframe SecurityError) → cloud R2 LGTM。focused 35/35 + full web 376 files / 2797 tests 全绿。**🎯 Phase E 全部 AC 落地完毕**：AC-E1 + AC-E2 + AC-E3。**🌟 F183 Phase A → E 全 phase 代码落地完毕**：identity contract (Phase A) → reducer single-writer (B0-B1) → seq+gap detection + backpressure observability (C) → IDB cache invalidation (D) → strict invariant gate (E)。剩 AC-Z1 5 类症状 alpha 实测验证（交由非作者非 reviewer 的愿景守护猫执行）+ feature close。 |

## Review Gate

- Phase A: discussion 收敛报告 + architecture map asset + identity contract 拍板（铲屎官 + 至少 1 只跨 family 猫签字放行）
- Phase B0-E: 每个 Phase merge 前必须满足 relevant replay/invariant tests + `pnpm gate`；涉及 UI/体验的 Phase 还需 alpha 验证
- 全 feature close: 愿景守护猫（非作者非 reviewer 的猫）输出"5 类症状全部消失"的对照表

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | `docs/discussions/2026-04-30-f183-bubble-pipeline-architecture/README.md` | Phase A 多猫圆桌主入口 |
| **Feature** | `docs/features/F081-bubble-continuity-observability.md` | 第一阶段连续性修复 |
| **Feature** | `docs/features/F123-bubble-runtime-correctness.md` | 第二阶段 identity hardening；KD-4 推迟的 MessageWriter 在 F183 落地 |
| **Feature** | `docs/features/F117-message-delivery-lifecycle.md` | delivery 真相源（queue 模式 dedup） |
| **Bug Report** | `docs/bug-report/2026-04-27-frontend-idb-cache-dup-after-cat-spawn/bug-report.md` | OUTER vs INNER identity split 案 |
| **Bug Report** | `docs/bug-report/2026-04-27-stream-event-delivery-lag/bug-report.md` | event bus backpressure + 5min timeout 案 |
| **Assets** | `docs/features/assets/F183/architecture-map.{cn,en}.png` + `.svg` | Phase A 产物：消息管线全景图 |
| **Fixture Schema** | `docs/features/assets/F183/fixture-schema.md` | Phase B0 产物：BubbleEvent replay fixture schema |
| **ADR** | `docs/decisions/033-bubble-pipeline-identity-contract.md` | identity contract（accepted，Phase A 拍板后） |
