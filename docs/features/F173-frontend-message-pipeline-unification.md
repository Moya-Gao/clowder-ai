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

### Phase A: Handler 统一（直接消除 ghost 来源）

合并 `handleAgentMessage` + `handleBackgroundAgentMessage` 为单一 handler。决策只用 **一个真相源**判断目标 thread：消息自带 `msg.threadId`，写到对应 thread state。当前 active thread 的 flat state 改为从 `threadStates[currentThreadId]` 派生（selector），不再独立维护。

### Phase B: refs 迁移到 thread-scoped

`activeRefs` / `finalizedStreamRef` / `replacedInvocationsRef` / `bgStreamRefs` / `finalizedBgRefs` 全部合并为 per-thread `Map<threadId, Map<catId, ...>>`，由统一 handler 按 `msg.threadId` 操作。删除 `useSocket-background.ts` 整个文件（或保留为 thin shim 调用统一 handler）。

### Phase C: 回归 + 清理

- 跨场景回归测试（F5、thread switch、socket reconnect、cross-post、并发多猫）
- 删除 `mergeReplaceHydrationMessages` 中针对 ghost bubble 的"宽容保留"分支（来源不再产生 ghost）
- F081 AC-B2 关闭

## Acceptance Criteria

### Phase A（Handler 统一）
- [ ] AC-A1: 单一 `handleAgentMessage` 入口，决策只看 `msg.threadId`，无 `routeThread` vs `storeThread` 双指针 race
- [ ] AC-A2: 任意 thread（active / background / 不存在的）收到 stream events 都写到 `threadStates[msg.threadId]`，不直接写 flat state
- [ ] AC-A3: flat state.messages 改为 selector 从 `threadStates[currentThreadId]` 派生（zustand subscribeWithSelector）

### Phase B（refs 迁移）
- [ ] AC-B1: 所有 stream/callback refs 改为 `Map<threadId, Map<catId, RefData>>`
- [ ] AC-B2: `useSocket-background.ts` 删除或缩为 ≤ 30 行 shim
- [ ] AC-B3: thread switch 不再触发 ghost bubble（fixture 验证）

### Phase C（回归 + 清理）
- [ ] AC-C1: F5 后 0 ghost bubble（fixture 含 race window）
- [ ] AC-C2: socket reconnect 期间收的 events 在重连后正确合并到现有 bubble，不裂
- [ ] AC-C3: cross-post + 当前 thread stream 同时进行不裂
- [ ] AC-C4: `mergeReplaceHydrationMessages` 简化（移除 ghost-tolerance 分支）
- [ ] AC-C5: F081 AC-B2 (Remaining Gaps) 关闭

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
| OQ-1 | flat state 派生方案：完全删 vs 保留作为 selector cache？性能权衡 | ⬜ Design Gate 决 |
| OQ-2 | refs Map 的内存生命周期：thread 删除 / 长期不访问时如何清理？ | ⬜ Design Gate 决 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不在 hydration merge 加 dedup 补丁 | 铲屎官 magic word "脚手架" + "绕路了"；F081 已预言写路径分散 = 反复出 bug | 2026-04-22 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-22 | 立项（铲屎官触发：F5 后批量裂 + magic word 拒绝脚手架） |

## Review Gate

- Phase A: 砚砚（架构 review） + 烁烁（视觉回归守护）
- Phase B: 砚砚（refs 迁移正确性） + Codex（测试覆盖）
- Phase C: 跨家族 review + 铲屎官愿景守护

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Audit** | `docs/features/F081-write-path-audit.md` | dual write-path 已识别，AC-B2 未闭 |
| **Fixture** | `docs/features/F123-symptom-fixture-matrix.md` | bubble symptom matrix |
| **Discussion** | `docs/discussions/2026-04-22-F173-design/` | Design Gate 待生成 |

## 需求点 Checklist

- [ ] dual handler 合并为单入口
- [ ] thread-scoped refs Map
- [ ] flat state 改 selector 派生（或删除）
- [ ] hydration merge 简化
- [ ] F081 AC-B2 闭合
