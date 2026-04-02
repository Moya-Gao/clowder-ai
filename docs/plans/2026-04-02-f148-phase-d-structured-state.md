---
feature_ids: [F148]
doc_kind: plan
created: 2026-04-02
---

# F148 Phase D: Structured State — Implementation Plan

**Feature:** F148 — `docs/features/F148-hierarchical-context-transport.md`
**Goal:** Upgrade threadMemory from activity log to product-oriented format (read/write/artifacts) and inject a structured coverage map JSON into the context packet.
**Acceptance Criteria:**
- AC-D1: buildThreadMemory distinguishes read/write, produces artifact list
- AC-D2: coverage map JSON object delivered alongside context packet
**Architecture:** Two independent changes: (1) enrich `ExtractiveDigestV1` ops + reformat `buildThreadMemory` output, (2) build `CoverageMap` from existing tombstone data and inject as JSON section in smart window context.
**Tech Stack:** TypeScript, node:test, zero LLM cost
**Frontend:** No

---

## Terminal Schema

```typescript
// AC-D1: Enhanced file ops tracking (already partially exists)
// TranscriptWriter.toolNameToOp gains 'read' for Read tool

// AC-D1: buildThreadMemory output changes from:
//   "Session #5 (10:00-10:05, 5min): Edit, Read. Files: src/index.ts, routes.ts."
// to:
//   "Session #5 (10:00-10:05, 5min): Created: src/new.ts. Modified: routes.ts. Read: index.ts."

// AC-D2: Coverage map injected as JSON in smart window context
interface CoverageMap {
  /** Omitted message range */
  omitted: {
    count: number;
    timeRange: { from: number; to: number };
    participants: string[];
  };
  /** Burst (delivered in full) */
  burst: {
    count: number;
    timeRange: { from: number; to: number };
  };
  /** Anchor IDs (Phase C) */
  anchorIds: string[];
  /** Thread memory availability */
  threadMemory: { available: boolean; sessionsIncorporated: number } | null;
  /** Retrieval hints for self-serve */
  retrievalHints: string[];
}
```

## What we're NOT building

- No LLM-based summarization or state extraction (Phase D spec item 3 "State ledger" is explicitly "explore if regex can")
- No prompt cache ordering (Phase D spec item 4 — Gemini suggestion, separate concern)
- No changes to warm mention path (only smart window / cold mention)

---

## Task 1: Track read ops in TranscriptWriter

**Files:**
- Modify: `packages/api/src/domains/cats/services/session/TranscriptWriter.ts:257-268` (toolNameToOp)
- Test: `packages/api/test/f148-context-transport.test.js` (new describe block)

**Changes:**
- Add `case 'read': return 'read';` to `toolNameToOp`
- Add `case 'grep': return 'read';` and `case 'glob': return 'read';` (these are read-type operations)

**Test:** Unit test that `generateExtractiveDigest` includes `read` ops for Read tool events.

---

## Task 2: Reformat buildThreadMemory to product-oriented output

**Files:**
- Modify: `packages/api/src/domains/cats/services/session/buildThreadMemory.ts:25-46` (formatSessionLine)
- Test: `packages/api/test/build-thread-memory.test.js` (existing tests + new)

**Changes:**
`formatSessionLine` currently outputs: `Session #5 (10:00-10:05, 5min): Edit, Read, Grep. Files: src/index.ts, routes.ts.`

New format groups files by operation:
`Session #5 (10:00-10:05, 5min): Created: src/new.ts. Modified: routes.ts. Read: index.ts, config.ts.`

- Group `filesTouched` by ops: `create` → "Created", `edit` → "Modified", `delete` → "Deleted", `read` → "Read"
- Files with multiple ops: show under highest-priority op (create > edit > delete > read)
- Still cap at MAX_FILES_DISPLAY per category
- Tools line removed (redundant with file ops)

---

## Task 3: Build CoverageMap from smart window data

**Files:**
- Create export in: `packages/api/src/domains/cats/services/agents/routing/context-transport.ts`
- Test: `packages/api/test/f148-context-transport.test.js` (new describe block)

**Changes:**
- New `CoverageMap` interface + `buildCoverageMap()` pure function
- Takes: omitted, burst, anchors, threadMemory, retrievalHints
- Returns: structured JSON with omitted range, burst range, anchor IDs, threadMemory status

---

## Task 4: Inject CoverageMap + threadMemory into smart window context

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts` (assembleSmartWindowContext)
- Test: `packages/api/test/f148-assemble-incremental.test.js` (integration test)

**Changes:**
- Fetch `threadMemory` from threadStore (already have threadStore access)
- Build `CoverageMap` from existing tombstone data + burst + anchors + threadMemory
- Format as `[Context Coverage Map]\n{JSON}\n` section — injected BEFORE tombstone
- Include `threadMemory.summary` as a separate section after coverage map (if available)
- Token trim: coverage map + threadMemory degrade together (after evidence, before anchors)

**Context packet layout (final):**
```
[Context Coverage Map]
{"omitted":{"count":22,...},"burst":{"count":8,...},...}

[Thread Memory: 5 sessions]
Session #5 (10:00-10:05): Created: src/new.ts. Modified: routes.ts.
Session #4 (09:30-09:45): Modified: config.ts. Read: routes.ts.

[System: skipped 22 messages ...]
[Thread opener: msg-0] ...
[Anchor 2/3: msg-5] ...
[Evidence: Redis Config Decision] ...
[msg-recent-1] burst message 1
...
```

---

## Task 5: Config + verification

**Files:**
- Modify: `packages/api/src/config/hierarchical-context-config.ts` (add `maxThreadMemoryTokens`)

**Verification checklist:**
- [ ] `toolNameToOp('read')` returns `'read'`
- [ ] `formatSessionLine` groups by ops
- [ ] `buildCoverageMap` produces valid JSON
- [ ] Coverage map + threadMemory appear in smart window context
- [ ] Token trim degrades coverage map correctly
- [ ] All F148 tests pass (68+)
- [ ] `pnpm gate` green
