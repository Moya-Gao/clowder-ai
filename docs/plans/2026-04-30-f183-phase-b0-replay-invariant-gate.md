---
feature_ids: [F183]
related_features: [F081, F123, F164, F184]
topics: [bubble-pipeline, replay-harness, invariant-gate, runtime-diagnostics, bubble-event]
doc_kind: plan
created: 2026-04-30
---

# F183 Phase B0 — Replay Harness + Invariant Gate Implementation Plan

**Feature:** F183 — `docs/features/F183-bubble-pipeline-architecture-consolidation.md`
**Goal:** 建立 BubbleEvent 契约类型、replay harness 框架、store invariant gate 与 runtime diagnostics 最小防线，为 Phase B1 Single Writer 收口写入口提供安全网。
**Acceptance Criteria:**

- [ ] AC-B0-1: `BubbleEvent` 14 类 TypeScript 契约枚举与 `BubbleKind` 5 类枚举落地，来自 ADR-033 Section 2.5。
- [ ] AC-B0-2: dev/test invariant gate 能检测 duplicate stable identity、phase regression、canonical key split，并在测试环境硬失败。
- [ ] AC-B0-3: runtime diagnostics 输出 ADR-033 Section 3.1 要求的 13 字段 violation event，支持 warn/error 两级与 bubble timeline dump。
- [ ] AC-B0-4: replay harness 框架能接收 BubbleEvent fixture，执行 reducer adapter，并输出 messages + violations；先接 F123 TD112 baseline，预留 payload schema 扩展位。
- [ ] AC-B0-5: 本 Phase 不改造现有 `useAgentMessages` / `useChatHistory` / route 写入口；只立 framework + invariant 防线。

**Architecture:** 契约类型放在 `@cat-cafe/shared`，因为后续 API 路由、web store、fixture schema 都要引用同一份枚举。前端 Phase B0 只新增纯函数 invariant gate、diagnostics adapter 与 replay harness，不收口实际写入口；`chatStore` 的 TD112 partial baseline 不重写，只复用其消息形态和测试数据。runtime debug 接入现有 `invocationEventDebug` ring buffer，扩展 event schema 与 `dumpBubbleTimeline`。
**Tech Stack:** TypeScript + Vitest + Zustand store test harness + existing `invocationEventDebug` ring buffer。
**前端验证:** No — Phase B0 是纯 contract/harness/test 框架，不改 UI；验证以 Vitest + typecheck 为主。

---

## Straight-Line Check

**B definition:** Phase B0 完成后，任何后续 B1/C/D 改动都能先把输入表达成 `BubbleEvent` fixture，并用同一套 invariant gate 检测 stable identity 违规。

**Terminal schema:**

```ts
export type BubbleKind =
  | 'assistant_text'
  | 'thinking'
  | 'tool_or_cli'
  | 'rich_block'
  | 'system_status';

export type BubbleEventType =
  | 'local_placeholder_created'
  | 'stream_started'
  | 'stream_chunk'
  | 'thinking_chunk'
  | 'tool_event'
  | 'cli_output'
  | 'rich_block'
  | 'callback_final'
  | 'history_hydrate'
  | 'draft_restore'
  | 'cache_restore'
  | 'done'
  | 'error'
  | 'timeout';

export type BubbleOriginPhase = 'draft/local' | 'stream' | 'callback/history';

export interface BubbleStableIdentity {
  threadId: string;
  actorId: string;
  canonicalInvocationId: string;
  bubbleKind: BubbleKind;
}

export interface BubbleInvariantViolation {
  threadId: string;
  actorId: string;
  canonicalInvocationId: string;
  bubbleKind: BubbleKind;
  eventType: BubbleEventType;
  originPhase: BubbleOriginPhase;
  sourcePath: BubbleSourcePath;
  existingMessageId: string | null;
  incomingMessageId: string | null;
  seq: number | null;
  recoveryAction: BubbleRecoveryAction;
  violationKind: BubbleViolationKind;
  timestamp: number;
}
```

**Not building in B0:**

- 不收口 `useAgentMessages` / `useChatHistory` / route 写入口。
- 不改变 `mergeReplaceHydrationMessages()` 行为。
- 不动 IDB schema invalidation（Phase D）。
- 不并发 F184 rendering mount 排查。

---

## Task 1: Shared Bubble Pipeline Contract

**Files:**
- Create: `packages/shared/src/types/bubble-pipeline.ts`
- Modify: `packages/shared/src/types/index.ts`
- Test: `packages/shared/src/__tests__/bubble-pipeline-types.test.ts`

**Step 1: Write failing tests**

Test that the exported arrays contain exactly ADR-033's 14 `BubbleEventType` values and 5 `BubbleKind` values, and that guard helpers reject unknown strings.

Run:

```bash
pnpm --filter @cat-cafe/shared exec vitest run src/__tests__/bubble-pipeline-types.test.ts
```

Expected RED: test file or exports missing.

**Step 2: Implement minimal shared contract**

Implement literal arrays, union types, `isBubbleEventType`, `isBubbleKind`, and supporting union types for origin phase / source path / recovery action / violation kind.

**Step 3: Verify GREEN**

Run the same shared test. Then run:

```bash
pnpm --filter @cat-cafe/shared run lint
```

Expected: PASS.

---

## Task 2: Store Invariant Gate Pure Functions

**Files:**
- Create: `packages/web/src/stores/bubble-invariants.ts`
- Test: `packages/web/src/stores/__tests__/bubble-invariants.test.ts`

**Step 1: Write failing tests**

Cover three ADR violations:

- duplicate stable identity: two messages in one thread share `(actorId, canonicalInvocationId, bubbleKind)`.
- phase regression: existing `callback/history` message receives incoming `stream` event for same stable key.
- canonical key split: same logical incoming event carries a different canonical key than the existing bubble timeline.

Run:

```bash
pnpm --filter @cat-cafe/web exec vitest run src/stores/__tests__/bubble-invariants.test.ts
```

Expected RED: module missing.

**Step 2: Implement minimal invariant functions**

Implement:

```ts
deriveBubbleKindFromMessage(msg): BubbleKind
deriveActorIdFromMessage(msg): string | undefined
deriveBubbleStableIdentity(msg, threadId): BubbleStableIdentity | undefined
findBubbleInvariantViolations(messages, context): BubbleInvariantViolation[]
assertNoBubbleInvariantViolations(messages, context): void
```

Keep mapping conservative:

- assistant text defaults to `assistant_text`.
- system messages without cat use actor `system`.
- unknown / invocationless local placeholders are skipped by stable-key duplicate checks but may be represented in replay fixtures.

**Step 3: Verify GREEN**

Run the targeted web test. Existing TD112 tests should still pass because B0 does not change store mutation semantics:

```bash
pnpm --filter @cat-cafe/web exec vitest run src/stores/__tests__/bubble-invariants.test.ts src/__tests__/td112-store-dedup.test.ts
```

---

## Task 3: Runtime Diagnostics Minimum Contract

**Files:**
- Modify: `packages/web/src/debug/invocationEventDebug.types.ts`
- Modify: `packages/web/src/debug/invocationEventDebug.ts`
- Create: `packages/web/src/debug/bubbleInvariantDiagnostics.ts`
- Test: `packages/web/src/debug/__tests__/bubbleInvariantDiagnostics.test.ts`
- Modify: `packages/web/src/debug/__tests__/invocationEventDebug.test.ts`

**Step 1: Write failing tests**

Verify that:

- `recordBubbleInvariantViolation()` stores all 13 ADR fields.
- `warn` vs `error` is preserved.
- `dumpBubbleTimeline()` includes invariant violation events, not only lifecycle events.
- thread IDs are masked unless `rawThreadId: true`.

Run:

```bash
pnpm --filter @cat-cafe/web exec vitest run src/debug/__tests__/bubbleInvariantDiagnostics.test.ts src/debug/__tests__/invocationEventDebug.test.ts
```

Expected RED: diagnostics module / fields missing.

**Step 2: Implement minimal diagnostics adapter**

Add `bubble_invariant_violation` to `DebugEventName`; extend allowed sanitized keys with ADR fields:

```text
actorId / canonicalInvocationId / bubbleKind / eventType / originPhase /
sourcePath / existingMessageId / incomingMessageId / seq /
recoveryAction / violationKind / level
```

Implement `recordBubbleInvariantViolation(violation, level)` as a thin adapter over `recordDebugEvent`.

**Step 3: Verify GREEN**

Run targeted diagnostics tests.

---

## Task 4: Replay Harness Framework

**Files:**
- Create: `packages/web/src/stores/bubble-replay-harness.ts`
- Create: `packages/web/src/stores/__tests__/bubble-replay-harness.test.ts`
- Create: `docs/features/assets/F183/fixture-schema.md`

**Step 1: Write failing tests**

Verify replay harness can:

- accept an ordered list of `BubbleEventFixture` entries.
- run an adapter that converts events to messages.
- run invariant gate after each event.
- return final messages + violation list.

Run:

```bash
pnpm --filter @cat-cafe/web exec vitest run src/stores/__tests__/bubble-replay-harness.test.ts
```

Expected RED: harness missing.

**Step 2: Implement minimal replay harness**

Keep the reducer adapter injectable so B1 can plug in the real Single Writer later:

```ts
replayBubbleEvents(events, { initialMessages, reduceEventToMessages })
```

The default adapter may be identity/no-op; tests provide a small adapter for TD112 duplicate scenarios.

**Step 3: Write fixture schema doc**

Document the JSON shape only; do not add large fixture sets yet. Include the 14 event types, stable identity fields, payload extension slot, and expected output block.

**Step 4: Verify GREEN**

Run targeted replay harness test.

---

## Task 5: Phase B0 Integration Guardrails + Verification

**Files:**
- No new production write-entry changes.
- Optional docs update: `docs/features/F183-bubble-pipeline-architecture-consolidation.md` Phase B0 evidence block.

**Step 1: Run focused tests**

```bash
pnpm --filter @cat-cafe/shared exec vitest run src/__tests__/bubble-pipeline-types.test.ts
pnpm --filter @cat-cafe/web exec vitest run \
  src/stores/__tests__/bubble-invariants.test.ts \
  src/stores/__tests__/bubble-replay-harness.test.ts \
  src/debug/__tests__/bubbleInvariantDiagnostics.test.ts \
  src/debug/__tests__/invocationEventDebug.test.ts \
  src/__tests__/td112-store-dedup.test.ts
```

**Step 2: Run package checks**

```bash
pnpm --filter @cat-cafe/shared run lint
pnpm --filter @cat-cafe/web exec tsc --noEmit
```

**Step 3: Scope check**

Confirm no changes to F184 files and no rewrite of existing write entries:

```bash
git diff --stat
git diff -- packages/web/src/hooks/useAgentMessages.ts packages/web/src/hooks/useChatHistory.ts packages/api/src/domains/cats/services/agents/routing
```

Expected: no B1 write-entry refactor.

**Step 4: Request review**

Commit from worktree with signature, then ask `@opus-47` for review. Reviewer focus:

- Does B0 stay framework-only?
- Are ADR Section 2.5 / 3.1 contracts represented without overfitting implementation?
- Are existing TD112 tests still green?
