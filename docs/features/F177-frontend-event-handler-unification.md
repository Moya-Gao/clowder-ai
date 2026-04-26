---
feature_ids: [F177]
related_features: [F173, F081]
topics: [frontend, event-handler, useAgentMessages, useSocket-background, KD-1, handler-unification]
doc_kind: spec
created: 2026-04-26
---

# F177: 前端 Event Handler 统一（active + background 合并到 thread-aware useAgentMessages）

> **Status**: stub | **Owner**: TBD | **Priority**: P1
>
> **Why now**: F173 close 时（2026-04-26）愿景守护 (gpt52) 指出 — F173 主线 (KD-2 mirror invariant) 闭环了 **writer 端**，但 **event handler 端** 仍是 active vs background 双路径分叉。砚砚 + 宪宪实地审计 (PR-D 开工前) 一致结论：`useSocket-background.ts:handleBackgroundAgentMessage` (~500 行) 不是 dead code，承担 background-thread agent_message 事件的 stream/callback/error/toast 处理。F173 PR-D 原 plan 假设 "Phase C 完成后自然 dead → 直接删整文件" 实测错误；删整文件等价于 KD-1 handler unification (active + background event handler 合并)，scope 远超 cleanup PR，需要单独立项。

## Why (源症状)

F173 KD-1 (Killer Decision 1) 当时定义：
> 同一类 agent_message 事件不应该有两条独立的 handler 链处理 (active 走 useAgentMessages.onMessage / background 走 handleBackgroundAgentMessage)，否则任何业务逻辑变更都要双写双维护，是 fragmentation 的源头。

F173 主线只闭环了 KD-2 (writer 端 mirror invariant)，KD-1 (handler 端) 留到本 feature。

## What (scope 假设)

**目标**：消除 `useSocket-background.ts` — 把 `handleBackgroundAgentMessage` 业务逻辑迁移到 thread-aware 的 `useAgentMessages`，让一条 handler 链同时处理 active + background。

**不在 scope**：F173 已经闭环的所有内容（writer mirror / read selector / hydration / liveness reconcile / cli-resolve）。

## Open Questions

立项时需要决定：
1. **useAgentMessages thread-aware 改造形态**：是按 threadId 路由分支，还是抽 ThreadEventHandler 抽象层？
2. **active vs background 现有差异如何 reconcile**：active 走 `callbacksRef.current.onMessage(msg)` 经多层 callback 链，background 直接调 store writers。两边的 toast/error/recovery semantics 是否完全等价？
3. **FixtureMatrix**：是否复用 PR #1391 的 thread-switch fixtures + PR #1416 的 reconcile fixtures，还是需要新一轮 5 场景 fixture？
4. **风险评估**：`handleBackgroundAgentMessage` 涉及 stream key 追踪、callback replacement、late chunk suppression 等已经经过多轮 race fix 的逻辑（F081 hotfix 系列、F173 Phase A hotfix1/2/3）。迁移过程中如何防 regression？

## Source 入口（实地源码锚点）

- `packages/web/src/hooks/useSocket-background.ts` — 当前 background event handler，line 364 `handleBackgroundAgentMessage`
- `packages/web/src/hooks/useSocket.ts:485-534` — agent_message 事件分发 (active vs background 分叉位置)
- `packages/web/src/hooks/useAgentMessages.ts` — active event handler，需要 thread-aware 改造的目标
- F173 spec § Phase B AC-B2 (deferred 标注) — 为什么这件事被 defer 的完整 audit trail
- F173 timeline 2026-04-26 05:35 entry — defer 决策证据

## Dependencies

- **Blocked by**: F173 已 closed (主线 writer/read 收口)
- **Blocks**: 无明确 blocker，但任何修改 `handleBackgroundAgentMessage` 的 hotfix 都应该考虑是否本 feature 该接管

## Notes

立项时再做完整 spec (Why/What/AC/Risk/Plan/Timeline)。当前 stub 只是 F173 close 时留的 follow-up anchor，避免 KD-1 收尾失踪在"已 truth-sync"模糊描述里。

> 这是 F173 愿景守护 (gpt52, 2026-04-26 07:30) 提出的 P1 — "deferred 不能只是注释，要有可点开的下一站"。

## Known Issues / Hotfixes (在 F177 主线落地前的 marker-gated 收窄修)

| 日期 | Bug | Hotfix PR | Marker | 长期归属 |
|------|-----|-----------|--------|---------|
| 2026-04-26 | a2a_handoff 蓝条 timestamp 排序错位（铲屎官报告"消息乱了"，三猫并行诊断收敛同根因）| [#1418](https://github.com/zts212653/cat-cafe/pull/1418) (squash `73d3d018`) | `extra.systemKind === 'a2a_routing'` + foreground monotonic seq | F177 主线 unified handler 落地后，本 PR 的 marker-based hotfix 可以简化为 unified handler 内部一次性按 server timestamp insert（无需 marker 区分），取消 foreground/background 双 path 分工 |

**Hotfix 范围说明**: PR #1418 在收窄边界内修：
- 不动 streaming/dedup hot path（仅 marker-gated insert helper）
- 不动 invocation/bubble identity（F173 ledger 不破）
- 仅 marker (`extra.systemKind === 'a2a_routing'`) 触发 timestamp-aware insert
- 4 step 收窄：types marker + foreground handler timestamp+marker+monotonic-id + background handler 透传 marker + chatStore insertOrAppendMessage helper
- 测试：51 tests (9 store + 42 hook handler-level + cloud Codex review pass)
- 4 轮 review cycles (砚砚 R1→R2→R3 + cloud R2→R3 + continuity)

砚砚 R3 review 评价：「`insertOrAppendMessage` 现在仍然只对 `extra.systemKind === 'a2a_routing'` 做 timestamp-aware insert，没有碰普通 assistant/streaming append 路径；same-ts 多条 handoff 会保持到达/后端 emit 顺序，同时仍会排在 same-ts 非 routing 气泡前。handler-level 测试也已经覆盖 server timestamp、marker 注入和同毫秒 ID 唯一性」

F177 主线落地后此 hotfix 可视为 transitional — handler unification 完成后，单一 handler 内部直接按 server timestamp insert，marker 字段可保留作为可选语义标签（不再是 store 路由必需）。
