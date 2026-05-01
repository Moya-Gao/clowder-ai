---
feature_ids: [F183]
related_features: [F081, F123, F184]
topics: [bubble-pipeline, single-writer, active-stream, write-path-consolidation]
doc_kind: plan
created: 2026-05-01
---

# F183 Phase B1.2 — Active Stream Write Path Consolidation Implementation Plan

**Feature:** F183 — `docs/features/F183-bubble-pipeline-architecture-consolidation.md`
**Goal:** 把 `useAgentMessages` 中 active stream branch 的 ~10 处 `addMessageToThread` / `addMessage` 调用收敛到 `applyBubbleEvent` (BubbleReducer)，所有 active stream 路径只能提交 BubbleEvent，不直接 mutate `messages`。
**Acceptance Criteria:**

- [ ] AC-B1.2-1: `handleAgentMessage` 中 active stream 写入口（`agent_message`/`text`/`thinking`/`tool_use`/`rich_block` 等）转换为 BubbleEvent → applyBubbleEvent 包装
- [ ] AC-B1.2-2: B0 invariant gate 在 dev/test 模式下覆盖每条收口入口（duplicate/phase-regression/canonical-split 触发即 fail）
- [ ] AC-B1.2-3: F123 active stream 历史 fixture 通过 reducer replay 全绿（active late-bind 双影 / activeRefs ref-lost）
- [ ] AC-B1.2-4: 不改 background stream（B1.3 scope）/ 不改 callback（B1.3 scope）/ 不改 hydration（B1.4 scope）
- [ ] AC-B1.2-5: F184 (rendering mount) 仍 blocked，按 KD-A5 串行约束

**Architecture:** B1.1 已落 reducer core (`bubble-reducer.ts`)。本 phase 在 web 层把 `useAgentMessages` 内 active stream branch 的 caller 改造成"build BubbleEvent → applyBubbleEvent → applyResult to chatStore"。每条 callsite 一个 commit，TDD red→green。

**Tech Stack:** TypeScript + Vitest + Zustand chatStore + B1.1 BubbleReducer
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测气泡渲染（active stream 主路径）

---

## Straight-Line Check

**B definition:** Phase B1.2 完成后，`useAgentMessages.handleAgentMessage` 主分支不再直接调用 `addMessage` / `addMessageToThread`，而是：

```ts
const event: BubbleEvent = adaptIncomingToBubbleEvent(msg, options);
const result = applyBubbleEvent({ threadId, event, currentMessages: store.messages });
result.violations.forEach(recordBubbleInvariantViolation);
store.replaceMessages(result.nextMessages);
```

**Terminal schema:** 无新 contract（复用 B1.1 reducer + B0 invariant）。

**What we're NOT building:**
- ❌ Background stream callsites（B1.3）
- ❌ Callback path（B1.3）
- ❌ Draft / queue / hydration / replace（B1.4）
- ❌ Provider transforms 改动（KD-3 排除）
- ❌ chatStore API 改动（store 层保持，只换 caller）

---

## Task 列表（按 callsite，逐个 TDD）

> 每个 task 一个 commit。RED→GREEN→commit→下一个。

### Task 1: 抽出 `adaptIncomingToBubbleEvent` adapter

**Files:**
- Create: `packages/web/src/hooks/bubble-event-adapter.ts`
- Create: `packages/web/src/hooks/__tests__/bubble-event-adapter.test.ts`

**Goal:** 把 `BackgroundAgentMessage` / `ActiveRoutedAgentMessage` 转换为 `BubbleEvent`。

**Steps:**
1. RED: 写测试覆盖 `text` / `thinking` / `tool_use` / `rich_block` 等几类常见 incoming msg
2. GREEN: 实现 adapter（switch on msg.type → BubbleEvent type/kind/originPhase/sourcePath）
3. Commit: `feat(F183-B1.2): add bubble-event-adapter`

### Task 2: pilot — `text` 类 active stream 收口

**Files:**
- Modify: `packages/web/src/hooks/useAgentMessages.ts` (active text path 中的 `addMessage` / `addMessageToThread`)

**Steps:**
1. RED: 加 fixture 覆盖现有 active text stream 行为
2. GREEN: 替换 callsite 为 reducer 包装
3. Verify: F123 active fixture + B0 invariant 不退化
4. Commit: `refactor(F183-B1.2): consolidate active text stream into reducer`

### Task 3-N: 逐 callsite 收口

按以下顺序：
- thinking_chunk
- tool_event / cli_output
- rich_block
- timeout / error / done

每条入口一个 commit，红绿验证。

### Task M: F123 active stream fixture replay

加载 F123 active late-bind 双影 / activeRefs ref-lost fixture，通过 reducer 回放，验证症状不复发。

### Task K: quality-gate + request-review

- invoke `quality-gate`
- 写 review request mailbox
- gh pr create + register PR tracking
- @codex 砚砚 review

---

## Roadmap

| 日期 | 事件 |
|------|------|
| 2026-05-01 | B1.2 plan + worktree + Task 1 (adapter) RED |
| 2026-05-02 | Task 1 GREEN + Task 2 (text) pilot |
| 2026-05-03 | Task 3-N（thinking / tool / rich / timeout / error）|
| 2026-05-04 | F123 fixture replay + quality-gate + review request |
| 2026-05-05 | 砚砚 review + 修反馈 |
| 2026-05-06 | merge-gate（云端 review + squash merge）|

## Links

- [F183 spec](../features/F183-bubble-pipeline-architecture-consolidation.md)
- [ADR-033](../decisions/033-bubble-pipeline-identity-contract.md)
- [B1 plan](2026-04-30-f183-phase-b1-single-writer.md)
- [B1.1 PR #1500](https://github.com/zts212653/cat-cafe/pull/1500) (merged)
