---
feature_ids: [F148]
doc_kind: plan
created: 2026-04-02
---

# F148 VG-3: Decision/Product Ledger — Implementation Plan

**Feature:** F148 — `docs/features/F148-hierarchical-context-transport.md`
**Goal:** Upgrade threadMemory from file-operation log to decision+product dual-track ledger, so cold-mention briefing cards show what decisions were made — not just what files changed.
**Acceptance Criteria:**
- AC-1: threadMemory includes discussion decision summaries (not just file ops)
- AC-2: briefing card expanded view shows key decisions
**Architecture:** DecisionSignals extracted in SessionSealer (regex + ThreadSummary), passed to buildThreadMemory which produces v2 output with structured decisions alongside session lines. format-briefing renders decisions in expanded view.
**Tech Stack:** TypeScript, node:test, zero LLM cost
**Frontend:** No (briefing bodyMarkdown only — already rendered by BriefingCard)

---

## Terminal Schema

```typescript
// New: DecisionSignals — assembled in SessionSealer, passed to buildThreadMemory
interface DecisionSignals {
  decisions: string[];      // "选择 B+A 方案" — max 8
  openQuestions: string[];  // "burst gap 阈值？" — max 5
  artifacts: string[];      // "ADR-011", "F148 spec" — max 8
}

// ThreadMemoryV1 → backward-compatible extension (keep v:1, add optional fields)
interface ThreadMemoryV1 {
  v: 1;
  summary: string;
  sessionsIncorporated: number;
  updatedAt: number;
  // VG-3 additions (optional — old data reads as undefined → [])
  decisions?: string[];
  openQuestions?: string[];
  artifacts?: string[];
}
```

## What we're NOT building

- No LLM-based extraction (zero cost, regex + existing ThreadSummary only)
- No L1a/L1b split (future work, not VG-3 scope)
- No new store/database (reuse existing ThreadStore + SummaryStore)
- No frontend changes (briefing bodyMarkdown already rendered by BriefingCard)

---

## Task 1: extractDecisionSignals pure function + tests

**Files:**
- Create: `packages/api/src/domains/cats/services/session/extractDecisionSignals.ts`
- Test: `packages/api/test/extract-decision-signals.test.js`

**Step 1: Write failing tests**

```javascript
// 4 test cases: regex-only, summary-only, combined, empty
test('extracts decisions from transcript text via regex', () => {
  const signals = extractDecisionSignals({ transcriptText: '我们决定用方案B。确定了redis端口6398。', summaryConclusions: [], summaryOpenQuestions: [] });
  assert.ok(signals.decisions.length >= 2);
});
test('extracts from ThreadSummary conclusions', () => { ... });
test('combines both sources and deduplicates', () => { ... });
test('returns empty arrays when no signals', () => { ... });
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement extractDecisionSignals**

Pure function. Inputs: `{ transcriptText: string, summaryConclusions: string[], summaryOpenQuestions: string[] }`. Regex patterns reuse AutoSummarizer's proven patterns (`决定|确定|选择|采用|使用|完成了|修复了` for decisions, `需要|待|TODO|还没|是否` for questions). Dedup by substring containment. Cap at 8/5/8.

**Step 4: Run tests — expect PASS**

**Step 5: Commit** `feat(F148): VG-3 extractDecisionSignals pure function`

---

## Task 2: Wire SessionSealer to produce DecisionSignals

**Files:**
- Modify: `packages/api/src/domains/cats/services/session/SessionSealer.ts` (~line 255-270)
- Test: `packages/api/test/session-sealer-decisions.test.js`

**Step 1: Write failing test**

```javascript
test('seal produces threadMemory with decisions when transcript has decision text', () => {
  // Setup: mock transcriptWriter that returns events with decision text
  // seal() → threadStore.getThreadMemory → verify decisions array populated
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**

In SessionSealer's seal method, after generating extractive digest:
1. Read raw transcript events from TranscriptWriter buffer (already available via `this.transcriptWriter`)
2. Get latest ThreadSummary: `this.summaryStore?.listByThread(threadId)` → take last one
3. Build transcript text from cat message events
4. Call `extractDecisionSignals({ transcriptText, summaryConclusions, summaryOpenQuestions })`
5. Pass signals to `buildThreadMemory` as new parameter

SessionSealer needs `summaryStore` injected — add optional `ISummaryStore` to constructor deps.

**Step 4: Run — expect PASS**

**Step 5: Commit** `feat(F148): VG-3 wire SessionSealer → DecisionSignals`

---

## Task 3: Upgrade buildThreadMemory to dual-track output

**Files:**
- Modify: `packages/api/src/domains/cats/services/session/buildThreadMemory.ts`
- Modify: `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts` (ThreadMemoryV1 type)
- Test: `packages/api/test/build-thread-memory.test.js` (extend existing)

**Step 1: Write failing tests**

```javascript
test('VG-3: merges decisions from signals into threadMemory', () => {
  const signals = { decisions: ['用方案B'], openQuestions: ['gap阈值?'], artifacts: ['ADR-011'] };
  const result = buildThreadMemory(null, digest, 3000, signals);
  assert.deepStrictEqual(result.decisions, ['用方案B']);
  assert.deepStrictEqual(result.openQuestions, ['gap阈值?']);
});
test('VG-3: deduplicates and caps decisions across sessions', () => { ... });
test('VG-3: backward compatible — no signals = no decisions fields', () => { ... });
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**

1. Add optional fields to `ThreadMemoryV1`: `decisions?: string[]`, `openQuestions?: string[]`, `artifacts?: string[]`
2. `buildThreadMemory` gets optional 4th param `signals?: DecisionSignals`
3. Merge: `[...existing.decisions, ...signals.decisions]` → dedup → cap at 8
4. Same for openQuestions (cap 5) and artifacts (cap 8)
5. If no signals and no existing decisions → don't set the field (backward compat)

**Step 4: Run — expect PASS**

**Step 5: Commit** `feat(F148): VG-3 ThreadMemory v2 — dual-track decisions + session lines`

---

## Task 4: Render decisions in briefing expanded view

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/format-briefing.ts`
- Test: `packages/api/test/f148-context-briefing.test.js` (extend existing)

**Step 1: Write failing tests**

```javascript
test('VG-3: bodyMarkdown includes key decisions when threadMemory has decisions', () => {
  const mapWithDecisions = { ...baseCoverageMap, threadMemory: { available: true, sessionsIncorporated: 3, decisions: ['用方案B', '不用cheap model'], openQuestions: ['gap阈值?'] } };
  const msg = buildBriefingMessage(mapWithDecisions, 'thread-1');
  const card = msg.extra.rich.blocks[0];
  assert.ok(card.bodyMarkdown.includes('用方案B'));
  assert.ok(card.bodyMarkdown.includes('gap阈值'));
});
test('VG-3: omits decisions section when no decisions', () => { ... });
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**

In `format-briefing.ts`, after existing threadMemory section and before 证据召回:
```typescript
if (coverageMap.threadMemory?.decisions?.length) {
  const top3 = coverageMap.threadMemory.decisions.slice(0, 3);
  bodyParts.push(`**关键决策**:\n${top3.map(d => `- ${d}`).join('\n')}`);
}
if (coverageMap.threadMemory?.openQuestions?.length) {
  const top2 = coverageMap.threadMemory.openQuestions.slice(0, 2);
  bodyParts.push(`**待决问题**:\n${top2.map(q => `- ${q}`).join('\n')}`);
}
```

Also need to extend CoverageMap's `threadMemory` type to include `decisions/openQuestions`.

**Step 4: Run — expect PASS**

**Step 5: Commit** `feat(F148): VG-3 briefing expanded view — decisions + open questions`

---

## Task 5: Integration + verification

**Run:**
```bash
pnpm gate          # full build + test + lint + check
```

**Verify:**
- [ ] extractDecisionSignals: regex + summary + combined + empty
- [ ] SessionSealer: seal produces threadMemory with decisions
- [ ] buildThreadMemory: dual-track output, dedup, cap, backward compat
- [ ] format-briefing: decisions + openQuestions in expanded bodyMarkdown
- [ ] All existing F148 tests still pass
- [ ] pnpm gate green
