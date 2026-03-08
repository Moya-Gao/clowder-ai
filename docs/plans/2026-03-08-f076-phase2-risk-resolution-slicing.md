# F076 Phase 2: Risk Detection + Resolution Design + Slice Planning

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Complete F076 AC-3 (Risk Detection), AC-1 remaining (Stage 3 Resolution Design), AC-6 (Slice Planning), and AC-5 (Pattern Reflux interface) — the "resolution + slicing" layer that converts triaged Intent Cards into actionable work.

**Architecture:** Three backend stores (RiskDetectionService, ResolutionStore, SliceStore) + three frontend tabs (風險預警, 切片計劃, extended 治理健康度). Risk detection runs semi-auto heuristics on IntentCard text fields. Resolution Design models the 5 resolution paths as structured data. Slice Planning creates vertical business-flow cuts compatible with F070 DispatchMissionPack.

**Tech Stack:** TypeScript, Fastify routes, Zustand store, React components, existing shared type patterns.

**Design reference:** Pencil MCP `designs/mission-hub-坏猫采访.pen` Node ID `Tljbb` — tab bar has 风險預警 + 切片計劃 placeholders.

---

## Terminal Schema

```typescript
// ── Risk Detection ──────────────────────────────────
// RiskSignal type already exists in intent-card.ts
// New: detection result attached to each card

interface RiskDetectionResult {
  readonly signal: RiskSignal;
  readonly severity: 'critical' | 'high' | 'medium';
  readonly evidence: string;     // which field/text triggered it
  readonly autoDetected: boolean; // true = heuristic, false = manual
}

// ── Stage 3: Resolution Design ──────────────────────
interface ResolutionItem {
  readonly id: string;
  readonly projectId: string;
  readonly cardId: string;        // links to IntentCard
  readonly path: ResolutionPath;  // confirmation | evidence | artifact | prototype | escalation
  readonly question: string;      // what we need to resolve
  readonly options: readonly string[];    // for confirmation: preset choices
  readonly recommendation: string;        // our suggested answer
  readonly status: 'open' | 'answered' | 'escalated';
  readonly answer: string;        // client's response
  readonly answeredAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

// ── Stage 4: Slice Planning ─────────────────────────
type SliceType = 'learning' | 'value' | 'hardening';

interface Slice {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly sliceType: SliceType;
  readonly description: string;          // what this slice proves/delivers
  readonly cardIds: readonly string[];   // which IntentCards this covers
  readonly actor: string;                // who does the workflow
  readonly workflow: string;             // end-to-end business flow description
  readonly verifiableOutcome: string;    // what client can see/verify
  readonly order: number;                // sequence in Slice Ladder
  readonly status: 'planned' | 'in_progress' | 'delivered' | 'validated';
  readonly createdAt: number;
  readonly updatedAt: number;
}

// ── Pattern Reflux ──────────────────────────────────
interface RefluxPattern {
  readonly id: string;
  readonly projectId: string;
  readonly category: 'methodology' | 'risk_pattern' | 'resolution_strategy';
  readonly title: string;
  readonly insight: string;
  readonly evidence: string;     // anonymized summary, no client data
  readonly createdAt: number;
}
```

## What We're NOT Building

- **Automated AI-powered risk detection** (heuristics only, no LLM calls)
- **Stage 1.5 Domain Pass** (deferred to Phase 3 — need real trial run first)
- **Card family types** (Constraint/Quality/Transition — IntentCard covers 80%)
- **Full reflux pipeline** (just the interface + manual capture; auto-reflux after trial runs)
- **DB persistence** (stays in-memory, consistent with Phase 1)

---

## Task 1: Shared Types — Risk Detection + Resolution + Slice

**Files:**
- Modify: `packages/shared/src/types/intent-card.ts`
- Create: `packages/shared/src/types/resolution.ts`
- Create: `packages/shared/src/types/slice.ts`
- Create: `packages/shared/src/types/reflux.ts`
- Modify: `packages/shared/src/types/index.ts`

**Step 1:** Add `RiskDetectionResult` to `intent-card.ts` (after existing types):

```typescript
export interface RiskDetectionResult {
  readonly signal: RiskSignal;
  readonly severity: 'critical' | 'high' | 'medium';
  readonly evidence: string;
  readonly autoDetected: boolean;
}
```

**Step 2:** Create `resolution.ts`:

```typescript
import type { ResolutionPath } from './intent-card.js';

export type ResolutionStatus = 'open' | 'answered' | 'escalated';

export interface ResolutionItem {
  readonly id: string;
  readonly projectId: string;
  readonly cardId: string;
  readonly path: ResolutionPath;
  readonly question: string;
  readonly options: readonly string[];
  readonly recommendation: string;
  readonly status: ResolutionStatus;
  readonly answer: string;
  readonly answeredAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CreateResolutionInput {
  readonly cardId: string;
  readonly path: ResolutionPath;
  readonly question: string;
  readonly options?: readonly string[];
  readonly recommendation?: string;
}

export interface AnswerResolutionInput {
  readonly answer: string;
}
```

**Step 3:** Create `slice.ts`:

```typescript
export type SliceType = 'learning' | 'value' | 'hardening';
export type SliceStatus = 'planned' | 'in_progress' | 'delivered' | 'validated';

export interface Slice {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly sliceType: SliceType;
  readonly description: string;
  readonly cardIds: readonly string[];
  readonly actor: string;
  readonly workflow: string;
  readonly verifiableOutcome: string;
  readonly order: number;
  readonly status: SliceStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CreateSliceInput {
  readonly name: string;
  readonly sliceType: SliceType;
  readonly description: string;
  readonly cardIds?: readonly string[];
  readonly actor: string;
  readonly workflow: string;
  readonly verifiableOutcome: string;
}

export interface UpdateSliceInput {
  readonly name?: string;
  readonly description?: string;
  readonly cardIds?: readonly string[];
  readonly actor?: string;
  readonly workflow?: string;
  readonly verifiableOutcome?: string;
  readonly status?: SliceStatus;
}
```

**Step 4:** Create `reflux.ts`:

```typescript
export type RefluxCategory = 'methodology' | 'risk_pattern' | 'resolution_strategy';

export interface RefluxPattern {
  readonly id: string;
  readonly projectId: string;
  readonly category: RefluxCategory;
  readonly title: string;
  readonly insight: string;
  readonly evidence: string;
  readonly createdAt: number;
}

export interface CreateRefluxPatternInput {
  readonly category: RefluxCategory;
  readonly title: string;
  readonly insight: string;
  readonly evidence: string;
}
```

**Step 5:** Update `index.ts` exports. Rebuild: `pnpm --filter @cat-cafe/shared build`

**Step 6:** Commit: `feat(F076): add shared types for risk detection, resolution, slicing, reflux`

---

## Task 2: Risk Detection Service + Tests

**Files:**
- Create: `packages/api/src/domains/projects/risk-detection-service.ts`
- Create: `packages/api/test/risk-detection-service.test.js`

**Step 1:** Write failing tests:

```javascript
// 8 test cases, one per risk signal heuristic:
// 1. hollow_verbs: "improve system performance" → detected
// 2. missing_actors: no actor or actor="the system" → detected
// 3. unknown_data_source: references data but no sourceDetail → detected
// 4. missing_success_signal: empty successSignal → detected
// 5. missing_edge_cases: no mention of error/empty/permission → detected
// 6. hidden_dependencies: 4+ dependency tags → detected
// 7. ai_fake_specificity: sourceTag=A + long text + empty objectState → detected
// 8. scope_creep: "MVP" and "enterprise" in same card → detected
// + combo test: card with multiple signals
// + clean card: no signals detected
```

**Step 2:** Run tests, confirm red.

**Step 3:** Implement `RiskDetectionService`:

```typescript
import type { IntentCard, RiskDetectionResult, RiskSignal } from '@cat-cafe/shared';

const HOLLOW_VERBS = /\b(improve|optimize|enhance|support|manage|ensure|streamline|facilitate)\b/i;
const SYSTEM_ACTORS = /^(the system|system|N\/A|none|)$/i;

export function detectRisks(card: IntentCard): RiskDetectionResult[] {
  const results: RiskDetectionResult[] = [];
  // ... heuristic checks per signal
  return results;
}
```

Each heuristic checks specific fields (goal for hollow verbs, actor for missing actors, etc.) and returns severity per the architecture doc.

**Step 4:** Run tests, confirm green.

**Step 5:** Commit: `feat(F076): risk detection service with 8 signal heuristics`

---

## Task 3: Resolution Store + Tests

**Files:**
- Create: `packages/api/src/domains/projects/resolution-store.ts`
- Create: `packages/api/test/resolution-store.test.js`

**Step 1:** Write failing tests (8 tests):
- `create()` returns item with generated ID
- `listByProject()` filters by projectId
- `listByCard()` filters by cardId
- `getById()` returns item or undefined
- `answer()` sets answer + answeredAt + status=answered
- `escalate()` sets status=escalated
- `listOpen()` returns only status=open items
- `delete()` removes item

**Step 2:** Run tests, confirm red.

**Step 3:** Implement `ResolutionStore` (same Map-based pattern as IntentCardStore).

**Step 4:** Run tests, confirm green.

**Step 5:** Commit: `feat(F076): resolution store for Stage 3 clarification queue`

---

## Task 4: Slice Store + Tests

**Files:**
- Create: `packages/api/src/domains/projects/slice-store.ts`
- Create: `packages/api/test/slice-store.test.js`

**Step 1:** Write failing tests (8 tests):
- `create()` returns slice with generated ID + order auto-increment
- `listByProject()` returns slices sorted by order
- `getById()` returns slice or undefined
- `update()` patches fields
- `reorder()` swaps two slices' order values
- `updateStatus()` transitions status
- `delete()` removes slice
- `listByType()` filters by sliceType

**Step 2:** Run tests, confirm red.

**Step 3:** Implement `SliceStore`.

**Step 4:** Run tests, confirm green.

**Step 5:** Commit: `feat(F076): slice store for Stage 4 slice planning`

---

## Task 5: Reflux Pattern Store + Tests

**Files:**
- Create: `packages/api/src/domains/projects/reflux-pattern-store.ts`
- Create: `packages/api/test/reflux-pattern-store.test.js`

**Step 1:** Write failing tests (5 tests):
- `create()` returns pattern with generated ID
- `listByProject()` filters by projectId, newest first
- `listByCategory()` filters by category
- `getById()` returns pattern or undefined
- `delete()` removes pattern

**Step 2–4:** Red → Green.

**Step 5:** Commit: `feat(F076): reflux pattern store for methodology experience capture`

---

## Task 6: API Routes — Risk + Resolution + Slice + Reflux

**Files:**
- Modify: `packages/api/src/routes/external-projects.ts` (add new endpoint groups)
- Create: `packages/api/test/f076-phase2-routes.test.js`
- Modify: `packages/api/src/index.ts` (wire new stores)

**New endpoints:**

```
# Risk Detection (auto-run on card)
POST /api/external-projects/:projectId/intent-cards/:cardId/detect-risks
GET  /api/external-projects/:projectId/risk-summary

# Resolution (Stage 3)
POST /api/external-projects/:projectId/resolutions
GET  /api/external-projects/:projectId/resolutions
GET  /api/external-projects/:projectId/resolutions/:resolutionId
PATCH /api/external-projects/:projectId/resolutions/:resolutionId/answer
PATCH /api/external-projects/:projectId/resolutions/:resolutionId/escalate
DELETE /api/external-projects/:projectId/resolutions/:resolutionId

# Slices (Stage 4)
POST /api/external-projects/:projectId/slices
GET  /api/external-projects/:projectId/slices
GET  /api/external-projects/:projectId/slices/:sliceId
PATCH /api/external-projects/:projectId/slices/:sliceId
DELETE /api/external-projects/:projectId/slices/:sliceId

# Reflux Patterns
POST /api/external-projects/:projectId/reflux-patterns
GET  /api/external-projects/:projectId/reflux-patterns
DELETE /api/external-projects/:projectId/reflux-patterns/:patternId
```

⚠️ **Route file size**: existing `external-projects.ts` is ~225 lines. Adding these routes will exceed 350-line hard limit. **Split into sub-route files:**
- `external-projects.ts` — project CRUD + backlog import (existing)
- `intent-card-routes.ts` — card CRUD + triage + risk detection (extract from existing + new)
- `resolution-routes.ts` — resolution CRUD + answer/escalate
- `slice-routes.ts` — slice CRUD
- `reflux-routes.ts` — reflux pattern CRUD

All sub-routes share `requireOwnedProject` pattern from existing code.

**Step 1:** Write route tests (15+ tests covering happy path + auth + ownership).

**Step 2:** Run tests, confirm red.

**Step 3:** Split existing routes + implement new endpoints.

**Step 4:** Wire stores in `index.ts`.

**Step 5:** Run tests, confirm green.

**Step 6:** Commit: `feat(F076): API routes for risk, resolution, slicing, reflux`

---

## Task 7: Frontend — Risk Panel (風險預警 tab)

**Files:**
- Create: `packages/web/src/components/mission-control/RiskPanel.tsx`
- Modify: `packages/web/src/components/mission-control/ExternalProjectTab.tsx` (add tab)
- Modify: `packages/web/src/stores/externalProjectStore.ts` (add risk state)

**UI** (per design `Tljbb`):
- Top: risk signal summary (8 signals × count) as colored badges
- Card list filtered by cards that have risk signals, grouped by severity (critical → high → medium)
- Each row: card ID + goal excerpt + risk signal badges + "View Card" link
- "Run Detection" button triggers bulk detect-risks for all cards

**Step 1:** Add risk state to Zustand store.

**Step 2:** Create `RiskPanel.tsx` component.

**Step 3:** Wire into `ExternalProjectTab.tsx` as new sub-tab.

**Step 4:** Verify with `pnpm --filter @cat-cafe/web build`.

**Step 5:** Commit: `feat(F076): risk panel — 風險預警 tab`

---

## Task 8: Frontend — Resolution Queue (Stage 3 in 需求追踪 tab)

**Files:**
- Create: `packages/web/src/components/mission-control/ResolutionQueue.tsx`
- Modify: `packages/web/src/components/mission-control/IntentCardDetail.tsx` (add resolution section)
- Modify: `packages/web/src/stores/externalProjectStore.ts`

**UI:**
- In IntentCardDetail right panel: new "Clarification Queue" section showing resolution items for this card
- "Add Question" button opens inline form (path selector + question + options + recommendation)
- Each resolution item shows status badge (open/answered/escalated) + question + answer
- Answer form: text input + submit

**Step 1–4:** Store update → component → wire → build check.

**Step 5:** Commit: `feat(F076): resolution queue — Stage 3 clarification`

---

## Task 9: Frontend — Slice Ladder (切片計劃 tab)

**Files:**
- Create: `packages/web/src/components/mission-control/SliceLadder.tsx`
- Modify: `packages/web/src/components/mission-control/ExternalProjectTab.tsx`
- Modify: `packages/web/src/stores/externalProjectStore.ts`

**UI** (per design tab "切片計劃"):
- Vertical ladder visualization: ordered slices as cards, draggable to reorder
- Each slice card: name + type badge (learning/value/hardening) + status badge + linked card count
- Expand to see: description, actor, workflow, verifiable outcome, linked Intent Cards
- "Add Slice" form: name, type, description, actor, workflow, verifiable outcome, select cards
- Status transitions: planned → in_progress → delivered → validated

**Step 1–4:** Store → component → wire → build.

**Step 5:** Commit: `feat(F076): slice ladder — 切片計劃 tab`

---

## Task 10: Frontend — Enhanced GovernanceHealth + Reflux

**Files:**
- Modify: `packages/web/src/components/mission-control/GovernanceHealth.tsx`
- Create: `packages/web/src/components/mission-control/RefluxCapture.tsx`
- Modify: `packages/web/src/stores/externalProjectStore.ts`

**Enhancements to GovernanceHealth:**
- Add: resolution progress (open/answered/escalated counts)
- Add: slice progress (planned/in_progress/delivered/validated counts)
- Add: risk signal distribution chart

**RefluxCapture** (in GovernanceHealth tab):
- "Capture Insight" form: category + title + insight + evidence (anonymized)
- List of captured patterns with category badges
- Clear labeling: "Only methodology patterns flow home — no project data"

**Step 1–4:** Store → components → wire → build.

**Step 5:** Commit: `feat(F076): enhanced governance health + reflux capture`

---

## Task 11: Integration + Build + Full Test

**Step 1:** Rebuild shared: `pnpm --filter @cat-cafe/shared build`

**Step 2:** Run all F076 tests: `node --test test/risk-detection-service.test.js test/resolution-store.test.js test/slice-store.test.js test/reflux-pattern-store.test.js test/f076-phase2-routes.test.js test/external-project-routes.test.js`

**Step 3:** Run full API suite: `node --test` (confirm no regressions)

**Step 4:** Build web: `pnpm --filter @cat-cafe/web build`

**Step 5:** Run biome: `pnpm check`

**Step 6:** Update F076 spec AC status + timeline.

**Step 7:** Commit: `docs(F076): update spec — Phase 2 complete`

---

## Estimated Test Count

| Store/Service | Tests |
|---------------|-------|
| risk-detection-service | 10 |
| resolution-store | 8 |
| slice-store | 8 |
| reflux-pattern-store | 5 |
| Phase 2 routes | 15 |
| **Total new** | **~46** |
| Phase 1 existing | 69 |
| **Grand total F076** | **~115** |
