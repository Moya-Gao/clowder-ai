---
feature_ids: [F148]
topics: [context-engineering, implementation-plan]
doc_kind: plan
created: 2026-03-31
---

# F148 Phase A: Smart Window + Tombstone + Evidence Recall

**Feature:** F148 — `docs/features/F148-hierarchical-context-transport.md`
**Goal:** 将 cold-mention 场景的 context 从 flat N=200 改为 smart window + tombstone + evidence recall，降低 70%+ token 消耗
**Acceptance Criteria:** AC-A1 ~ AC-A6
**Architecture:** 改造 `assembleIncrementalContext()` 的消息选择逻辑：当 unseen 消息数超过可配置阈值时，从 flat slice 切换为 burst detection + tombstone + evidence recall。warm path（gap 小）保持不变。
**Tech Stack:** TypeScript, node:test, evidence.sqlite (FTS5 BM25)
**前端验证:** No — 纯后端，无 UI 改动

---

## What we're NOT building (Phase A scope)

- NOT building importance scoring / anchor selection (Phase C)
- NOT building structured state ledger (Phase D)
- NOT adding `threadId` filter to `search_evidence` (Phase B)
- NOT changing `get_thread_context` (Phase B)
- NOT touching SystemPromptBuilder or MCP tools

## Terminal Schema

```typescript
/** F148: Configuration for hierarchical context transport */
interface HierarchicalContextConfig {
  /** Unseen message count threshold: below = warm path (unchanged), above = smart window */
  coldMentionThreshold: number;  // default: 15
  /** Silence gap in ms to detect burst boundaries */
  burstSilenceGapMs: number;  // default: 15 * 60 * 1000 (15 min)
  /** Max messages in recent burst */
  maxBurstMessages: number;  // default: 12
  /** Min messages in recent burst (guarantee) */
  minBurstMessages: number;  // default: 4
  /** Max keywords extracted for tombstone */
  maxTombstoneKeywords: number;  // default: 4
  /** Evidence recall timeout ms */
  evidenceRecallTimeoutMs: number;  // default: 500
  /** Max evidence hits to inject */
  maxEvidenceHits: number;  // default: 3
}

/** F148: Tombstone for omitted messages */
interface ContextTombstone {
  omittedCount: number;
  timeRange: { from: number; to: number };
  participants: string[];
  keywords: string[];
  retrievalHints: string[];
}
```

## Files Overview

| Action | File | Purpose |
|--------|------|---------|
| Create | `packages/api/src/config/hierarchical-context-config.ts` | Config + defaults |
| Create | `packages/api/src/domains/cats/services/agents/routing/context-transport.ts` | Pure functions: burst detection, tombstone, tool scrub, evidence recall |
| Modify | `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts:292-434` | Wire smart window into `assembleIncrementalContext` |
| Modify | `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts:24-35` | Add `evidenceStore?` to `RouteStrategyDeps` |
| Modify | `packages/api/src/domains/cats/services/agents/routing/route-serial.ts:~278` | Pass evidenceStore through deps |
| Modify | `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts:~219` | Pass evidenceStore through deps |
| Modify | `packages/api/src/index.ts:~1045` | Thread evidenceStore into route deps |
| Create | `test/f148-context-transport.test.ts` | Unit tests for pure functions |
| Create | `test/f148-assemble-incremental.test.ts` | Integration tests for assembleIncrementalContext |

---

## Task 1: Config + Types

**Files:**
- Create: `packages/api/src/config/hierarchical-context-config.ts`

**Step 1: Write the config file**

```typescript
// F148: Hierarchical Context Transport configuration
export interface HierarchicalContextConfig {
  coldMentionThreshold: number;
  burstSilenceGapMs: number;
  maxBurstMessages: number;
  minBurstMessages: number;
  maxTombstoneKeywords: number;
  evidenceRecallTimeoutMs: number;
  maxEvidenceHits: number;
}

export const DEFAULT_HIERARCHICAL_CONTEXT: HierarchicalContextConfig = {
  coldMentionThreshold: 15,
  burstSilenceGapMs: 15 * 60 * 1000,
  maxBurstMessages: 12,
  minBurstMessages: 4,
  maxTombstoneKeywords: 4,
  evidenceRecallTimeoutMs: 500,
  maxEvidenceHits: 3,
};
```

**Step 2: Commit**

`feat(F148): add hierarchical context config + types`

---

## Task 2: Burst Detection (pure function + test)

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/routing/context-transport.ts`
- Create: `test/f148-context-transport.test.ts`

**Step 1: Write failing test for `detectRecentBurst`**

Test cases:
1. Messages all within 1 minute → all in burst (up to maxBurst)
2. 20 messages, 15min gap between msg 14 and 15 → burst = msg 15-20
3. Only 3 messages → all included (min guarantee)
4. Semantic chain: question→answer pair not split even if > maxBurst
5. Tool-call → tool-result pair not split

**Step 2: Run test, verify FAIL**

`node --test test/f148-context-transport.test.ts`

**Step 3: Implement `detectRecentBurst`**

```typescript
import type { StoredMessage } from '../stores/ports/MessageStore.js';
import type { HierarchicalContextConfig } from '../../../../../config/hierarchical-context-config.js';

/**
 * F148: Detect the most recent interaction burst from the tail of messages.
 * Walks backward from the end, stopping at a silence gap >= config threshold.
 * Guarantees at least minBurstMessages, caps at maxBurstMessages.
 * Never splits semantic chains (Q→A, tool_use→tool_result).
 */
export function detectRecentBurst(
  messages: readonly StoredMessage[],
  config: HierarchicalContextConfig,
): { burst: StoredMessage[]; omitted: StoredMessage[] } {
  // ... implementation
}
```

Key logic:
- Walk backward from `messages[len-1]`
- At each step, check `messages[i].timestamp - messages[i-1].timestamp > burstSilenceGapMs`
- If gap found AND we have >= minBurstMessages: cut here
- Semantic chain detection: if `messages[i]` is a tool_result and `messages[i-1]` is the matching tool_use, don't split. Similarly for question→answer (user msg followed by cat msg).
- Cap at maxBurstMessages (but don't split chains at the boundary)

**Step 4: Run test, verify PASS**

**Step 5: Commit**

`feat(F148): burst detection with semantic chain preservation`

---

## Task 3: Tombstone Generation (pure function + test)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/context-transport.ts`
- Modify: `test/f148-context-transport.test.ts`

**Step 1: Write failing test for `buildTombstone`**

Test cases:
1. 50 omitted messages → correct count, time range, participants
2. Keywords extracted from message content (top N by frequency)
3. Retrieval hints include thread context tool suggestion
4. Empty omitted → returns null (no tombstone needed)

**Step 2: Run test, verify FAIL**

**Step 3: Implement `buildTombstone`**

```typescript
export interface ContextTombstone {
  omittedCount: number;
  timeRange: { from: number; to: number };
  participants: string[];
  keywords: string[];
  retrievalHints: string[];
}

/**
 * F148: Build a coverage tombstone for omitted messages.
 * Zero LLM cost — uses simple word frequency for keywords.
 */
export function buildTombstone(
  omitted: readonly StoredMessage[],
  threadTitle: string,
): ContextTombstone | null {
  // ...
}

/** Format tombstone as context string (~40 tokens) */
export function formatTombstone(tombstone: ContextTombstone): string {
  // [系统: 跳过了 {count} 条消息 ({timeRange})。参与者: {participants}。关键词: {keywords}。需要详情请用 search_evidence("{keywords}")。]
}
```

Keyword extraction: simple word frequency on omitted message content, filter stopwords + short words, take top N.

**Step 4: Run test, verify PASS**

**Step 5: Commit**

`feat(F148): tombstone generation with keyword extraction`

---

## Task 4: Tool Payload Scrub (pure function + test)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/context-transport.ts`
- Modify: `test/f148-context-transport.test.ts`

**Step 1: Write failing test for `scrubToolPayloads`**

Test cases:
1. Last message's tool content preserved verbatim
2. Earlier messages' tool results replaced with digest line
3. Non-tool messages untouched
4. Messages with `contentBlocks` containing tool_result type scrubbed

**Step 2: Run test, verify FAIL**

**Step 3: Implement `scrubToolPayloads`**

Scrub logic: for each message except the last, if it contains tool result content (detected by `toolEvents` or content patterns like JSON/large blocks from tool calls), replace with `<tool_result truncated: {toolName} executed>`.

**Step 4: Run test, verify PASS**

**Step 5: Commit**

`feat(F148): tool payload scrub for non-terminal messages`

---

## Task 5: Evidence Recall (async function + test)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/context-transport.ts`
- Modify: `test/f148-context-transport.test.ts`

**Step 1: Write failing test for `recallEvidence`**

Test cases:
1. Composite query built from thread title + current user message + recent non-system msgs
2. Returns top N formatted evidence hits
3. Timeout → returns empty array (fail-open)
4. No evidenceStore → returns empty array (fail-open)

**Step 2: Run test, verify FAIL**

**Step 3: Implement `recallEvidence`**

```typescript
import type { IEvidenceStore } from '../../../../memory/SqliteEvidenceStore.js';

/**
 * F148: Best-effort evidence recall for cold-mention context.
 * Composite query from thread title + current message + recent messages.
 * 500ms timeout, fail-open (returns [] on any error).
 */
export async function recallEvidence(
  evidenceStore: IEvidenceStore | undefined,
  threadTitle: string,
  currentUserMessage: string,
  recentMessages: readonly StoredMessage[],
  config: HierarchicalContextConfig,
): Promise<string[]> {
  if (!evidenceStore) return [];
  // Build composite query
  // Race with timeout
  // Format hits as context lines
}
```

**Step 4: Run test, verify PASS**

**Step 5: Commit**

`feat(F148): best-effort evidence recall with composite query + timeout`

---

## Task 6: Wire into `assembleIncrementalContext`

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts:24-35` (RouteStrategyDeps)
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts:292-434` (assembleIncrementalContext)
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` (pass deps)
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` (pass deps)
- Modify: `packages/api/src/index.ts` (thread evidenceStore)

**Step 1: Add `evidenceStore` + `threadStore` to `RouteStrategyDeps`**

```typescript
export interface RouteStrategyDeps {
  // ... existing fields
  /** F148: Evidence store for context recall (optional, fail-open) */
  evidenceStore?: IEvidenceStore;
  /** F148: Thread store for title access in tombstone/recall */
  threadStore?: IThreadStore;
}
```

**Step 2: Modify `assembleIncrementalContext` core logic**

The key change is after the `relevant` filter and before the `capped` slice:

```typescript
const config = DEFAULT_HIERARCHICAL_CONTEXT;
const isColdMention = relevant.length > config.coldMentionThreshold;

if (isColdMention) {
  // F148: Smart window path
  const { burst, omitted } = detectRecentBurst(relevant, config);
  const threadTitle = deps.threadStore
    ? (await deps.threadStore.getThread(threadId))?.title ?? ''
    : '';
  const currentMsg = burst.find(m => m.id === currentUserMessageId);

  // Tombstone
  const tombstone = buildTombstone(omitted, threadTitle);
  const tombstoneText = tombstone ? formatTombstone(tombstone) : '';

  // Evidence recall (parallel, fail-open)
  const evidenceLines = await recallEvidence(
    deps.evidenceStore,
    threadTitle,
    currentMsg?.content ?? '',
    burst.filter(m => !isSystemMessage(m)).slice(-2),
    config,
  );

  // Tool payload scrub on burst
  const scrubbedBurst = scrubToolPayloads(burst);

  // Format and assemble
  // ... (tombstone + evidence + scrubbed burst lines)
} else {
  // Warm path: existing behavior unchanged
  // ... (current flat logic)
}
```

**Step 3: Thread `evidenceStore` through deps in route-serial.ts, route-parallel.ts, index.ts**

Small wiring changes — add `evidenceStore` to the deps object passed to route strategies.

**Step 4: Commit**

`feat(F148): wire smart window into assembleIncrementalContext`

---

## Task 7: Integration Test

**Files:**
- Create: `test/f148-assemble-incremental.test.ts`

**Step 1: Write integration test**

Test scenarios:
1. **Warm path unchanged**: 10 unseen messages → all delivered as before (no tombstone, no evidence)
2. **Cold mention**: 100 unseen messages → burst (~6-8) + tombstone + evidence recall
3. **Token reduction**: cold mention context tokens < 30% of flat delivery tokens
4. **Semantic chain preserved**: last 2 messages are tool-call→result → both in burst
5. **Tool scrub works**: earlier message with large tool output → scrubbed in final output
6. **Evidence fail-open**: evidenceStore throws → still returns context (without evidence section)
7. **No evidenceStore**: deps.evidenceStore undefined → warm/cold both work fine

Uses mock `IMessageStore`, `DeliveryCursorStore`, `IEvidenceStore`.

**Step 2: Run test, verify PASS**

`node --test test/f148-assemble-incremental.test.ts`

**Step 3: Commit**

`test(F148): integration tests for hierarchical context transport`

---

## Task 8: Type check + Biome + existing tests

**Step 1: Run type check**

`pnpm lint`

**Step 2: Run Biome**

`pnpm check`

**Step 3: Run existing test suite**

`pnpm test` (ensure no regressions)

**Step 4: Commit any fixes**

---

## Task 9: Update spec status

**Files:**
- Modify: `docs/features/F148-hierarchical-context-transport.md`

**Step 1: Update status to `in-progress`, add Timeline entry**

**Step 2: Commit + push to main (shared doc)**

`docs(F148): Phase A in-progress`

---

## Verification Checklist (maps to AC)

| AC | Verification |
|----|-------------|
| AC-A1 | Integration test: cold-mention context tokens < 30% of flat delivery |
| AC-A2 | Unit test: burst detection preserves Q→A and tool→result chains |
| AC-A3 | Unit test: tombstone contains all 5 fields |
| AC-A4 | Unit test: evidence recall uses composite query, times out at 500ms, returns [] on failure |
| AC-A5 | Unit test: non-terminal tool results scrubbed |
| AC-A6 | Integration test: warm path (≤15 msgs) produces identical output to current code |
