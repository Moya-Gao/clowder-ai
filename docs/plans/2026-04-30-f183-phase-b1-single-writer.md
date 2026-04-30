---
feature_ids: [F183]
related_features: [F081, F123, F164, F173, F184]
topics: [bubble-pipeline, single-writer, reconcile-reducer, write-path-consolidation]
doc_kind: plan
created: 2026-04-30
---

# F183 Phase B1 — Single Writer / Reconcile Reducer Implementation Plan

**Feature:** F183 — `docs/features/F183-bubble-pipeline-architecture-consolidation.md`
**Goal:** 把现有 8+ 类写入口（active stream / background stream / callback / draft / queue / hydration / replace / provider transforms）收敛到一个 `BubbleReducer`，所有路径只能提交 `BubbleEvent`，不直接改 `messages`。
**Acceptance Criteria:**

- [ ] AC-B1-1: `BubbleReducer` 落地（vanilla reducer + invariant gate inline），输入 `BubbleEvent` + 当前 store snapshot，输出 next snapshot + violations。
- [ ] AC-B1-2: `useAgentMessages` 全部 ~26 处 `addMessageToThread` / `addMessage` 调用收敛到 reducer 入口（不再直接 mutate `messages`）。
- [ ] AC-B1-3: `useChatHistory` 的 hydration / replace 路径收敛到 reducer（`hydration_event` / `replace_event` 走同一通道）。
- [ ] AC-B1-4: `mergeReplaceHydrationMessages()` 5 种匹配策略简化到 ≤ 2 种（exact stable-key match + monotonic upgrade）。
- [ ] AC-B1-5: F123 TD111（identity contract）+ TD113（placeholder 单调升级）通过 reducer 强制；不再依赖各写入口"自觉"调用 helper。
- [ ] AC-B1-6: B1 follow-up checklist 决议 —— `recoveryAction` 默认值是否需 reducer 覆盖？特别是 `callback_final` 后 late stream chunk 应走 catch-up 而非 quarantine。
- [ ] AC-B1-7: F123 全套 replay 测试 + B0 fixture schema 扩展 fixture 全绿。
- [ ] AC-B1-8: 不改 provider 协议 / 不动 A2A 语义 / 不动 routing 后端写入口（这是 KD-3 scope 排除）。

**Architecture:** B0 已建 `BubbleEvent` 14 类契约 + invariant gate + replay harness 框架。B1 在 web 层加 `BubbleReducer`（位于 `packages/web/src/stores/bubble-reducer.ts`），它消费 `BubbleEvent` 输出 next ChatMessage[] + violations。`useAgentMessages` / `useChatHistory` 各自的写入路径转换为"先生成 BubbleEvent → 调 reducer → 应用 result"。reducer 内部包含 monotonic phase upgrade 逻辑、stable-identity dedup、recoveryAction 决议（B1 follow-up 评审）。
**Tech Stack:** TypeScript + Vitest + Zustand (chatStore.addMessageToThread 保留，但所有 caller 走 reducer 包装) + existing B0 framework (BubbleEvent / invariants / diagnostics / replay harness)。
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测气泡渲染。重点验证：(a) 现有 ChatMessage 渲染无 regression；(b) F123 历史 fixture（裂气泡 / 双胞胎 / hydration 覆盖）全部不复发；(c) thread switch + F5 + 长 invocation 三类场景在 alpha 通道不裂气泡。

---

## Straight-Line Check

**B definition:** Phase B1 完成后，**任何想改 `messages` 状态的代码必须经过 `BubbleReducer`**——直接写 `chatStore.addMessageToThread` 在 dev/test 失败（reducer 包装外的调用被 lint rule 拦下）。

**Terminal schema:**

```ts
// packages/web/src/stores/bubble-reducer.ts
export interface BubbleReducerInput {
  threadId: string;
  event: BubbleEvent;
  currentMessages: ChatMessage[];
}

export interface BubbleReducerOutput {
  nextMessages: ChatMessage[];
  violations: BubbleInvariantViolation[];
  recoveryAction: BubbleRecoveryAction;
}

export function applyBubbleEvent(input: BubbleReducerInput): BubbleReducerOutput;

// 所有 useAgentMessages / useChatHistory 写入路径 → 转换为 BubbleEvent → 调 applyBubbleEvent → 应用 nextMessages
```

**What we're NOT building (scope guard):**

- ❌ Provider 协议改动（KD-3）
- ❌ A2A handoff 语义（KD-3）
- ❌ Thread / Draft 模型改造（KD-3）
- ❌ Routing 后端 (route-serial / route-parallel) 写入口（KD-3，那是后端 messageStore 写入，不是前端 store）
- ❌ WebSocket sequence number（Phase C）
- ❌ IDB invalidation（Phase D）
- ❌ F184 ChatMessage mount（KD-A5 串行约束）
- ❌ Onboarding tour 实现（AC-Z3，B1 不做）

**Three-question check 每个 Task:**
1. extends-only 不重写？✅ reducer 是新模块；caller 改造只替换调用语义；旧 chatStore 写入 API 保留
2. 可 demo/test？✅ 每个 Task 都有 RED test → GREEN 实现 → focused vitest 通过
3. 缺失成本？✅ 缺一个 caller 收口 = 一类 bug 不防（明确成本，不糊弄）

---

## Task 列表（按写入口分类，TDD 渐进收口）

### Task 1: `BubbleReducer` 核心 + 第一组 BubbleEvent

**Files:**
- Create: `packages/web/src/stores/bubble-reducer.ts`
- Create: `packages/web/src/stores/__tests__/bubble-reducer.test.ts`

**Steps:**
1. **RED**: 写测试覆盖 3 个核心 event 类型（`stream_started` / `stream_chunk` / `callback_final`）。每个 event 输入 + 期望 nextMessages + violations。
2. **RED 验证**: 运行测试 → fail（reducer 不存在）
3. **GREEN**: 实现 `applyBubbleEvent` 最小骨架——`stream_started` 创建 placeholder；`stream_chunk` append content；`callback_final` 替换/dedupe stream placeholder（走 unique stable identity 路径）。inline 调用 B0 `validateIncomingBubbleEvent` 收集 violations；`recoveryAction` 默认值跟 B0 contract 一致（`canonical-split → sot-override`，其他 → `quarantine`）。
4. **GREEN 验证**: focused vitest 通过
5. **Commit**: `feat(F183): add BubbleReducer core for stream/callback events`

### Task 2: B1 follow-up — `recoveryAction` reducer override 评审

**Files:**
- Modify: `packages/web/src/stores/bubble-reducer.ts`
- Modify: `packages/web/src/stores/__tests__/bubble-reducer.test.ts`

**评审决议**（基于 47 P2 + 砚砚 spec follow-up）：
- `callback_final` 后到达的 late stream chunk → 默认 `recoveryAction='catch-up'`（不是 quarantine）。理由：late stream chunk 的语义是"已经在 history 里了，现在补"，应该被 reducer drop 但**不**当作 violation 阻断流——B0 默认 quarantine 太重，会让 UI 上看到"事件被吞"。catch-up 语义 = drop event + log warn + 继续。
- 其他 phase-regression / canonical-split / duplicate 保持 B0 默认。

**Steps:**
1. **RED**: 测试 `callback_final → stream_chunk` 序列 → 期望 `recoveryAction='catch-up'`
2. **RED 验证**: fail（reducer 仍用 quarantine）
3. **GREEN**: reducer 在 phase-regression 且 incoming 是 stream chunk + existing 是 callback/history 时 → `recoveryAction='catch-up'`，drop event 不写入 messages
4. **GREEN 验证**: 通过
5. **Commit**: `feat(F183-B1): override recoveryAction for late stream after callback`

### Task 3: 收口 active stream 写入口（useAgentMessages）

**Files:**
- Modify: `packages/web/src/hooks/useAgentMessages.ts` (active stream branch ~10 处 addMessage / addMessageToThread 调用)
- Test: existing TD112 + B0 fixture 扩展

**Steps:**
1. **RED**: 扩展 B0 fixture，把现有 active stream 行为 replay 一遍，期望 reducer 输出与现状一致
2. **GREEN**: 把 active stream 路径所有 `addMessageToThread` 替换为"生成 BubbleEvent → applyBubbleEvent → 应用 nextMessages"
3. **GREEN 验证**: focused vitest 通过 + 包级 web test 通过
4. **Commit**: `refactor(F183-B1): consolidate active stream write path into reducer`

### Task 4: 收口 background stream 写入口

**Files:**
- Modify: `packages/web/src/hooks/useAgentMessages.ts` (background path: `handleBackgroundAgentMessage` + `recoverBackgroundStreamingMessage` etc.)

**Steps:** 同 Task 3 模式（RED fixture / GREEN consolidation / Commit）

### Task 5: 收口 callback 写入口

**Files:**
- Modify: `packages/web/src/hooks/useAgentMessages.ts` (`findCallbackReplacementTarget` / `findInvocationlessRichPlaceholder` callback 升级路径)

**Note:** 砚砚 B1 follow-up 的核心场景在这里——callback_final 后的 late stream chunk 必须走 Task 2 决议的 catch-up 路径。

**Steps:** 同 Task 3 模式

### Task 6: 收口 draft 写入口

**Files:**
- Modify: `packages/web/src/hooks/useAgentMessages.ts` (draft restore path)
- Modify: `packages/web/src/hooks/useChatHistory.ts` (draft merge path，如有)

### Task 7: 收口 queue 写入口

**Files:**
- Modify: `packages/web/src/hooks/useAgentMessages.ts` (queue hydration path)

### Task 8: 收口 hydration 写入口（useChatHistory）

**Files:**
- Modify: `packages/web/src/hooks/useChatHistory.ts` (`hydrateThread` / API GET hydration)

### Task 9: 收口 replace 写入口

**Files:**
- Modify: `packages/web/src/hooks/useChatHistory.ts` (active invocation `replace` 路径)

### Task 10: 简化 `mergeReplaceHydrationMessages`

**Files:**
- Modify: `packages/web/src/hooks/useChatHistory.ts` 或 `packages/web/src/utils/`（找到 `mergeReplaceHydrationMessages` 实际定义位置）

**Steps:**
1. **RED**: 现有 5 种 strategy 各自一个 fixture，期望"用 stable-key + monotonic upgrade"两种 strategy 全部覆盖
2. **GREEN**: 删除 strategy 3-5（draft prefix / richness comparison / phase priority），保留 stable-key match + monotonic upgrade
3. **GREEN 验证**: 全部 fixture 通过
4. **Commit**: `refactor(F183-B1): simplify merge to 2 strategies (stable-key + monotonic)`

### Task 11: dev-mode lint rule（防 reducer 旁路）

**Files:**
- Create: `packages/web/eslint.config.mjs` rule（或 biome rule）—— 禁止在 hooks/ 下直接调用 `chatStore.addMessageToThread`，必须经过 reducer

**Steps:**
1. **RED**: lint rule 测试 fixture
2. **GREEN**: rule 实现
3. **Commit**: `feat(F183-B1): block direct chatStore writes outside reducer`

### Task 12: F123 全套 replay + B0 fixture 守护

**Files:**
- Modify: `packages/web/src/stores/__tests__/bubble-replay-harness.test.ts`（B0 已建框架，B1 加 8 类历史 fixture）
- 复用 F123 既有 fixture（`docs/features/assets/F123/symptom-fixture-matrix.md`）

**Steps:**
1. 加载 F123 历史症状 fixture（active late-bind 双影 / background ref-lost / callback dup / hydration ghost / queue 乱序 / draft hydration 身份断层 / rich block 落错 / CLI Output duplicate）
2. 通过 B0 replay harness + 新 reducer 跑一遍，期望全绿
3. 任一 fixture 失败 → 回到 Task 1-10 修对应入口
4. **Commit**: `test(F183-B1): F123 symptom fixtures all pass via reducer`

### Task 13: provider transforms 评审（不收口，只 audit）

**Note:** Provider transforms（Claude / Codex / opencode / Codex MCP yield 链路）属后端 yield 函数。前端 reducer 不应该改 provider 输出，但要审 yield 出的 metadata 是否能让 reducer 正确生成 BubbleEvent。

**Files:**
- Audit (read-only): `packages/api/src/domains/cats/services/agents/providers/*Transform*` + `*AgentService*`

**Steps:**
1. Audit yield 链路里 `invocationId / catId / origin / messageRole` 是否都能被 routing 层兜底为 OUTER canonical id
2. 如有缺口 → 记入 B1 review note（不修，留 Phase C / D / E 或单开 hotfix）
3. **Commit**: `docs(F183-B1): audit provider transforms metadata coverage`

### Task 14: quality-gate + request-review

**Files:**
- 走 `quality-gate` skill → `request-review` skill

**Steps:**
1. invoke `quality-gate` skill
2. 自检 8 AC 全 ✅
3. 写 review request mailbox 到 `docs/mailbox/2026-XX-XX-f183-phase-b1-review-request-to-codex.md`
4. **Commit**: `docs(F183-B1): request review`
5. **@codex** 砚砚做跨家族 review

---

## Roadmap

| 日期 | 事件 |
|------|------|
| 2026-04-30 | B1 plan + commit + push + 开 worktree + Task 1 RED |
| 2026-05-01 | Task 1-3（reducer 核心 + recoveryAction override + active stream 收口）|
| 2026-05-02 | Task 4-7（background / callback / draft / queue 收口）|
| 2026-05-03 | Task 8-10（hydration / replace / merge 简化）|
| 2026-05-04 | Task 11-13（lint rule + F123 fixture + provider audit）|
| 2026-05-05 | Task 14（quality-gate + request-review）|
| 2026-05-06 | 砚砚 review + 修反馈 |
| 2026-05-07 | merge-gate（云端 review + squash merge）|
| 2026-05-07 | Phase B1 done → Phase C 解锁 + F184 解锁实施（roadmap 串行）|

## Links

- [F183 spec](../features/F183-bubble-pipeline-architecture-consolidation.md)
- [ADR-033](../decisions/033-bubble-pipeline-identity-contract.md)
- [Phase B0 plan](2026-04-30-f183-phase-b0-replay-invariant-gate.md)
- [F081 write-path audit](../features/F081-bubble-continuity-observability.md) (104 写入点 baseline)
- [F123 symptom-fixture matrix](../features/assets/F123/symptom-fixture-matrix.md)
