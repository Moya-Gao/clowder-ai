---
feature_ids: [F148]
topics: [context-engineering, importance-scoring]
doc_kind: plan
created: 2026-04-01
---

# F148 Phase C: Importance Scoring + Anchors — Implementation Plan

**Feature:** F148 — `docs/features/F148-hierarchical-context-transport.md`
**Goal:** From omitted messages, select high-value anchors via zero-cost scoring and inject them between tombstone and burst, so the cat sees the most important context even when messages are skipped.
**Acceptance Criteria:**
- AC-C1: zero-cost importance scoring (no LLM) — structural + positional + BM25 signals
- AC-C2: top 2-3 anchors injected into context packet
- AC-C3: primacy anchor (thread opener or title) always included
**Architecture:** New `scoreImportance()` + `selectAnchors()` pure functions in `context-transport.ts`. Integration in `assembleSmartWindowContext` between tombstone (step 3) and evidence recall (step 4). Anchors formatted as `[Anchor: msg-id]` lines.
**Tech Stack:** Pure TypeScript, no external deps. Reuses existing `StoredMessage` type.
**NOT building:** LLM-based scoring, UI surface (Gap-3), Phase D structured state.

---

## Terminal Schema

```typescript
// New in context-transport.ts

interface ImportanceSignals {
  structural: number;   // code blocks, @-mentions, tool events
  positional: number;   // primacy, burst-boundary proximity
  relevance: number;    // BM25-like keyword overlap with composite query
}

interface ScoredMessage {
  message: StoredMessage;
  score: number;
  signals: ImportanceSignals;
  isPrimacy: boolean;   // first message in thread
}

function scoreImportance(
  msg: StoredMessage,
  index: number,
  totalOmitted: number,
  queryTerms: string[],
): ScoredMessage;

function selectAnchors(
  omitted: readonly StoredMessage[],
  queryTerms: string[],
  maxAnchors?: number,  // default 3
): ScoredMessage[];

function formatAnchors(anchors: ScoredMessage[], truncateLimit: number): string[];
```

## Context Packet Layout (after Phase C)

```
[对话历史增量 - 智能窗口: N 条已摘要, M 条详细]
[System: skipped 50 messages ...]           ← tombstone
[Anchor 1/3: msg-id] content...             ← NEW: high-value anchors
[Anchor 2/3: msg-id] content...             ← NEW
[Related evidence]                          ← evidence recall
  ...
[/Related evidence]
[msg-1] recent burst message                ← burst
[msg-2] ...
[/对话历史]
```

## Tasks

### Task 1: scoreImportance — structural + positional signals

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/context-transport.ts`
- Test: `packages/api/test/f148-context-transport.test.js`

**Step 1: Write failing tests**

```javascript
describe('F148 Phase C: scoreImportance', () => {
  it('AC-C1: code blocks boost structural score', () => {
    const msg = makeMsg({ content: 'Here is the fix:\n```js\nconst x = 1;\n```' });
    const scored = scoreImportance(msg, 5, 50, []);
    assert.ok(scored.signals.structural > 0, 'code block should boost structural');
  });

  it('AC-C1: @-mentions boost structural score', () => {
    const msg = makeMsg({ content: 'normal text', mentions: ['opus'] });
    const scored = scoreImportance(msg, 5, 50, []);
    assert.ok(scored.signals.structural > 0, '@-mention should boost structural');
  });

  it('AC-C1: tool events boost structural score', () => {
    const msg = makeMsg({ content: 'result', toolEvents: [{ type: 'tool_result', label: 'search' }] });
    const scored = scoreImportance(msg, 5, 50, []);
    assert.ok(scored.signals.structural > 0, 'tool event should boost structural');
  });

  it('AC-C3: index 0 is primacy', () => {
    const scored = scoreImportance(makeMsg({}), 0, 50, []);
    assert.ok(scored.isPrimacy, 'first message should be primacy');
    assert.ok(scored.signals.positional > 0, 'primacy boosts positional');
  });

  it('AC-C1: keyword overlap boosts relevance', () => {
    const msg = makeMsg({ content: 'Redis cluster configuration sentinel mode' });
    const scored = scoreImportance(msg, 5, 50, ['redis', 'cluster']);
    assert.ok(scored.signals.relevance > 0, 'keyword match should boost relevance');
  });
});
```

**Step 2:** Run tests → RED (scoreImportance not exported)

**Step 3: Implement scoreImportance**

Scoring weights:
- Structural: code blocks (+3), @-mentions (+2), tool events (+2), long content >500 chars (+1)
- Positional: primacy index=0 (+5), near burst boundary last 20% (+1)
- Relevance: count of queryTerms found in content (case-insensitive), each +1

**Step 4:** Run tests → GREEN

**Step 5:** Commit `feat(F148-C): add scoreImportance with structural + positional + relevance signals`

---

### Task 2: selectAnchors — pick top anchors with primacy guarantee

**Files:**
- Modify: `context-transport.ts`
- Test: `f148-context-transport.test.js`

**Step 1: Write failing tests**

```javascript
describe('F148 Phase C: selectAnchors', () => {
  it('AC-C3: primacy anchor always included', () => {
    const msgs = Array.from({ length: 20 }, (_, i) =>
      makeMsg({ content: i === 0 ? 'Thread opener question' : `msg ${i}` }),
    );
    const anchors = selectAnchors(msgs, ['redis'], 3);
    assert.ok(anchors.some(a => a.isPrimacy), 'primacy anchor must be present');
  });

  it('AC-C2: returns at most maxAnchors', () => {
    const msgs = Array.from({ length: 20 }, () =>
      makeMsg({ content: 'Redis ```code``` important @opus' }),
    );
    const anchors = selectAnchors(msgs, ['redis'], 3);
    assert.ok(anchors.length <= 3, 'should not exceed maxAnchors');
  });

  it('AC-C2: high-signal messages rank higher', () => {
    const msgs = [
      makeMsg({ content: 'boring filler' }),
      makeMsg({ content: 'Redis config:\n```yaml\nport: 6379\n```', mentions: ['opus'] }),
      makeMsg({ content: 'ok' }),
    ];
    const anchors = selectAnchors(msgs, ['redis'], 2);
    // msg[1] has code block + mention + keyword match — should be selected
    assert.ok(anchors.some(a => a.message.content.includes('Redis config')));
  });

  it('returns empty for empty omitted', () => {
    assert.deepStrictEqual(selectAnchors([], ['redis'], 3), []);
  });
});
```

**Step 2:** Run → RED

**Step 3: Implement selectAnchors**

1. Score all omitted messages via `scoreImportance`
2. Sort by score descending
3. If primacy (index 0) not in top N, replace last slot with primacy
4. Return up to `maxAnchors` (default 3), sorted by original index (chronological)

**Step 4:** Run → GREEN

**Step 5:** Commit `feat(F148-C): add selectAnchors with primacy guarantee`

---

### Task 3: formatAnchors — render anchor lines for context packet

**Files:**
- Modify: `context-transport.ts`
- Test: `f148-context-transport.test.js`

**Step 1: Write failing test**

```javascript
it('formatAnchors produces labeled lines with truncation', () => {
  const anchors = [
    { message: makeMsg({ content: 'x'.repeat(2000) }), score: 10, signals: {}, isPrimacy: true },
    { message: makeMsg({ content: 'short msg' }), score: 5, signals: {}, isPrimacy: false },
  ];
  const lines = formatAnchors(anchors, 500);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('[Anchor 1/2:'));
  assert.ok(lines[0].length < 600, 'should truncate long content');
  assert.ok(lines[1].includes('short msg'));
});
```

**Step 2:** Run → RED

**Step 3: Implement formatAnchors**

```typescript
function formatAnchors(anchors: ScoredMessage[], truncateLimit: number): string[] {
  return anchors.map((a, i) => {
    const content = a.message.content.length > truncateLimit
      ? a.message.content.slice(0, truncateLimit) + '...'
      : a.message.content;
    const label = a.isPrimacy ? 'Thread opener' : `Anchor ${i + 1}/${anchors.length}`;
    return `[${label}: ${a.message.id}] ${content}`;
  });
}
```

**Step 4:** Run → GREEN

**Step 5:** Commit `feat(F148-C): add formatAnchors with truncation`

---

### Task 4: Integration — inject anchors into assembleSmartWindowContext

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts`
- Modify: `packages/api/src/config/hierarchical-context-config.ts` (add `maxAnchors`)
- Test: `packages/api/test/f148-assemble-incremental.test.js`

**Step 1: Write failing integration test**

```javascript
test('AC-C2+C3: cold mention includes anchors between tombstone and burst', async () => {
  // 30 msgs with time gap, msg[0] is thread opener, msg[5] has code block
  // Expect: tombstone + anchors (including primacy) + burst
  const result = await assembleIncrementalContext(deps, 'user-1', 'thread-1', 'opus');
  assert.ok(result.contextText.includes('[Thread opener:'), 'primacy anchor');
  assert.ok(result.contextText.includes('[Anchor'), 'at least one scored anchor');
  // Anchors appear after tombstone, before burst
  const tombstoneIdx = result.contextText.indexOf('[System: skipped');
  const anchorIdx = result.contextText.indexOf('[Thread opener:') || result.contextText.indexOf('[Anchor');
  const burstIdx = result.contextText.lastIndexOf('[0001');
  assert.ok(tombstoneIdx < anchorIdx && anchorIdx < burstIdx, 'order: tombstone < anchors < burst');
});
```

**Step 2:** Run → RED

**Step 3: Implement integration**

In `assembleSmartWindowContext` (route-helpers.ts), between step 3 (tombstone) and step 4 (evidence recall):

```typescript
// 3.5 Phase C: Anchor extraction from omitted messages
const compositeQueryTerms = [threadTitle, currentMsg?.content ?? '']
  .join(' ')
  .toLowerCase()
  .split(/[^a-zA-Z0-9\u4e00-\u9fff]+/)
  .filter(w => w.length >= 3);
const anchors = selectAnchors(omitted, compositeQueryTerms, hcConfig.maxAnchors);
const anchorLines = formatAnchors(anchors, truncateLimit);
```

In section 8 (assemble context packet), inject anchors after tombstone, before evidence:

```typescript
if (finalTombstoneText) sections.push(finalTombstoneText);
if (finalAnchorLines.length > 0) sections.push(...finalAnchorLines);  // NEW
if (finalEvidenceLines.length > 0) { ... }
```

Token trim degradation order: evidence → **anchors** → tombstone → burst.

**Step 4:** Run → GREEN

**Step 5:** Commit `feat(F148-C): integrate anchors into smart window context packet`

---

### Task 5: Config + build + full regression

**Files:**
- Modify: `packages/api/src/config/hierarchical-context-config.ts`

**Step 1:** Add `maxAnchors: number` to config interface + default `3`

**Step 2:** `pnpm gate` — full build + test + lint + check

**Step 3:** Commit config change (if not already included in Task 4)

---

## Verification Checklist

- [ ] AC-C1: `scoreImportance` uses structural + positional + BM25 signals, zero LLM
- [ ] AC-C2: `selectAnchors` returns top 2-3, injected between tombstone and burst
- [ ] AC-C3: Primacy anchor (index 0 = thread opener) always included
- [ ] Token trim degrades anchors before tombstone, before burst
- [ ] Warm path (count ≤ threshold, tokens ≤ threshold) completely unchanged
- [ ] All F148 tests pass + full regression green
