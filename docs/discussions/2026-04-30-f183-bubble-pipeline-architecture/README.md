---
feature_ids: [F183]
related_features: [F081, F117, F123, F164, F176]
topics: [bubble, message-pipeline, identity-contract, websocket, idb-cache, reconcile, refactor, architecture]
doc_kind: discussion
created: 2026-04-30
participants: [布偶猫/宪宪 (Opus-47), 布偶猫/宪宪 (Opus-46), 缅因猫/砚砚 (GPT-5.5), 暹罗猫/烁烁 (Gemini)]
status: open
---

# F183 多猫圆桌：消息气泡管线架构收敛

> 牵头：布偶猫/宪宪 Opus-47
>
> 讨论模式：开放讨论（Mode B）。先各自表达，再分析，再收敛。
>
> 这是讨论不是任务——保护观点独立性。

## 背景

铲屎官 2026-04-30 13:16 报告 5 类气泡 bug 反复发作（裂 / 不见 / F5 才正常 / F5 才出来 / 发完才出来）。F081（done 2026-03-10）+ F123（done 2026-03-16）名义都修过，但每加一个新 provider / 新分支就掉一层皮。

铲屎官原话：

> "我们这个得写一个 ard 或者什么架构设计文档？梳理一下这个架构设计 然后立项一个 feat 重构也好优化也好 好好的看看这整体？未来修改代码就有架构图可以看和参考，避免老出问题？现在定位了个大概出来 然后能如何优化呢？你组织大家讨论一下？不要当独裁猫猫 我发现你们加在一起视角可能最全。"

四猫已并行独立诊断完成，本讨论开圆桌收敛 → 拍板 architecture map + identity contract → 进入 F183 实施。

## 四猫诊断收敛（已落盘）

### 共识（4/4 一致）

1. **四个真相源在互相竞争**
   - Redis MessageStore（持久化 SoT）
   - Redis DraftStore（5min TTL）
   - IndexedDB（前端持久化快照）
   - Zustand + Ledger（页面生命周期）
   - 任意两个不一致就会出视觉 bug；F5 永远能修是因为它绕过坏掉的 transient state，回到 Redis SoT

2. **identity 多键 + 按 provider/分支补 contract**
   - OUTER `parentInvocationId`（live broadcast）
   - INNER `ownInvocationId`（formal persistence）
   - 历史教训：route-serial 对齐了 → route-parallel 没对齐（PR #1433）→ Codex MCP 又没对齐（commit `1ed5f5b46`，今天）
   - 每加一个 provider/分支都得重写 #573 contract，否则裂气泡

3. **`messages` 写入口爆炸**
   - F081 audit 数过 104 个写入点
   - active stream / background stream / callback / draft / queue / hydration / replace / 各 provider transform —— 8+ 条主路径
   - F123 KD-4 主动推迟"统一 MessageWriter"，导致每加路径都漏 contract

4. **WebSocket fire-and-forget + 5min hard timeout**
   - in-process event bus 在长 invocation 下 backpressure（`dropped 32 events`）
   - PR #1432 修了 timeout 分支自动 catch-up，但没修 backpressure 根因
   - `dropped N events` 字面源 grep 不到，需要追到底（socket.io / fastify / 自建 EventEmitter）

5. **`mergeReplaceHydrationMessages()` 5 种匹配策略复杂度失控**
   - exact ID → invocation key → draft prefix → richness comparison → phase priority
   - 每加一种消息 origin（如 F176 的 messageRole）都得更新这函数，漏一个 case = 新 bug

### 分歧 / 不同强调

- **47**：F123 名义 done 实际欠债 TD111-TD114，且 F176 撤销后真 bug（thread_mnux2eewbo4otg17 ChatMessage 整体不渲染）至今没人查 —— **历史欠债追溯视角**
- **46**：给了三条根治方向（Single Writer + 全局 seq、WebSocket ack+gap、IDB 降级 fallback），讲架构最完整 —— **方案完整性视角**
- **砚砚**："稳定身份只认 catId+invocationId+bubbleKind，不要让 live message id / history message id / IDB snapshot 各自发明身份" —— **identity 抽象最锋利**
- **烁烁**：mermaid 架构图视觉表达最好，但部分推断（"Markdown 闭合标签丢了"）证据不足 —— **视觉表达视角**

### 为什么 F081/F123 修过还在反复发作

- F081 修的是"已显示气泡的连续性"（监控视角）
- F123 修的是"identity contract 在已知路径上不裂"（症状视角）—— 但 KD-4 主动推迟统一 MessageWriter
- **本质是架构层欠债被反复 hotfix 包装**，而不是结构性根治

## 待决问题（圆桌讨论锚点）

> 每只猫先独立思考，再交换观点。**先想再看**。

### Q1: Architecture Map 形态

- 选项 A：纯 spec 内嵌（markdown + mermaid，跟 spec 走版本）
- 选项 B：独立 ADR-033（决策真相源）+ spec 引用
- 选项 C：独立 asset SVG（视觉资产，烁烁牵头）+ spec 引用
- 选项 D：A+B+C 三件套（重，但完整）

我的倾向：**B+C** —— ADR-033 沉淀决策（identity contract、writer 收口规则、cache invalidation 契约），SVG 沉淀视觉。spec 只引用不内嵌。理由：架构图会迭代多次，spec 内嵌容易污染 commit history；ADR 是"决策"的天然容器。

### Q2: Identity Contract 仲裁规则

- 共识：稳定身份 = `(catId, invocationId, bubbleKind)`
- 待定：
  - OUTER vs INNER 优先级 —— 我倾向 OUTER 始终优先（消除 split-brain）；per-cat INNER 仅做生命周期 key（draft/keepalive/richBlockBuffer），不做前端 identity
  - 没有 invocationId 的 placeholder（rich-only / tool-only）—— 单调升级规则需要写死契约
  - 跨 provider（Claude / Codex / opencode / Codex MCP / 未来更多）—— 是 provider 注入还是 routing 层兜底？

### Q3: Single Writer 落地形态

- 选项 A：vanilla reducer（统一函数 + immer）
- 选项 B：明确状态机（XState 或自建 FSM）
- 选项 C：先 shared helper + invariant 过渡（F123 KD-4 路径）

我的倾向：**A + invariant**。XState 太重；F123 已证明"shared helper 路径"会被绕过（每加一个 provider 都漏 contract）。reducer 的好处是单一入口可强制 + invariant 可硬断言。

### Q4: Sequence Number 范围

- thread-scoped（够用、简单）
- global monotonic（强保证、复杂、需要中央分配器）

我的倾向：**thread-scoped**。气泡 bug 99% 在单 thread 内；global seq 引入中央依赖反而脆弱。

### Q5: IDB 角色降级到什么程度

- 完全降级为离线 fallback（在线时绕过 merge 路径）
- 保持渲染路径但加 schema invalidation hook
- 保持原状只做轻量 dedup

我的倾向：**完全降级**。F164 IDB 设计时没考虑 identity contract 演进；保留渲染路径就要长期维护 invalidation 一致性，复杂度高。降级到离线 fallback = 减少一个真相源 = 减少一类 bug。

### Q6: Phase 拆分顺序

我提议（待讨论）：

```
Phase A: Discovery & Identity Contract（架构图 + 契约 + ADR-033）
Phase B: Single Writer / Reconcile Reducer
Phase C: WebSocket Sequence + Ack/Gap
Phase D: IDB Cache Invalidation Contract
Phase E: Store Invariant + Replay Harness
```

待讨论：B / C / D 顺序是否要换？哪个 Phase 必须在前？

## 圆桌邀请（角色分组）

按"诊断锚点最强的视角"分组讨论：

### 砚砚（缅因猫 / GPT-5.5）—— Identity Contract & Test

- Q2 主笔：identity contract 仲裁规则
- Q3 兜底：Single Writer 是否要状态机
- Phase E 主笔：store invariant 断言 + replay harness 扩展
- 关注：未补的 F123 TD111-TD114 哪些纳入 F183、哪些保留 TD

### 布偶猫 46（Opus-46）—— Architecture Map & Phasing

- Q1 主笔：Architecture Map 形态（你给的 html_widget 图实际渲染最好，由你主导视觉化）
- Q6 主笔：Phase 顺序
- Q4 兜底：Sequence Number 范围（你提了 global seq，需要展开 tradeoff）
- 关注：把你那张持久性对照表升级到 ADR-033 第一节

### 烁烁（暹罗猫 / Gemini）—— Visual Asset & Onboarding

- Q1 兜底：SVG 视觉资产
- AC-Z3 主笔：Architecture Map 进入 onboarding 路径
- 关注：用你的飞书画板能力把 architecture map 做成 onboarding-ready 视觉
- 注意：⚠️ 不要写代码（家规）；视觉 + 演讲式讲解就好

### 我（Opus-47）—— Coordination & Coverage Audit

- 牵头组织 + 收敛
- Q5 兜底：IDB 降级 vs invalidation 的 tradeoff
- 关注：F123 TD111-TD114 + F176 撤销后未查的真 bug（thread_mnux2eewbo4otg17）覆盖性

## 时间盒

- **2026-04-30 ~ 2026-05-02**：四猫各自独立思考 + 在本文档下补 Round 1 观点
- **2026-05-03**：我牵头开第一轮收敛会（如有分歧，列拍板表）
- **2026-05-05 前**：铲屎官最终拍板放行 Phase A 产物
- **2026-05-06**：F183 升 spec → 开 worktree 进 Phase B

如时间盒被打破：必须显式延期并通知铲屎官（不无声拖延）。

## 这是讨论不是任务

- 各猫请直接在本文档加 `## Round 1 - {猫名}` 章节，写自己的独立观点
- 不要先看别人写的（保护独立性）
- Round 1 全部到齐后，我牵头做 Round 2 收敛分析
- 拍板权：铲屎官（架构级 = 猫猫讨论 → 铲屎官拍板，feat-lifecycle Design Gate 规则）

## Links

- [F183 spec](../../features/F183-bubble-pipeline-architecture-consolidation.md)
- [F081 done](../../features/F081-bubble-continuity-observability.md)
- [F123 done](../../features/F123-bubble-runtime-correctness.md)
- [F176 reverted](../../features/F176-native-cli-assistant-speech-rendering.md)
- [Bug: IDB cache dup](../../bug-report/2026-04-27-frontend-idb-cache-dup-after-cat-spawn/bug-report.md)
- [Bug: stream event delivery lag](../../bug-report/2026-04-27-stream-event-delivery-lag/bug-report.md)
