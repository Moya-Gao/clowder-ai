---
feature_ids: [F076]
related_features: [F049, F058, F070]
topics: [mission-hub, cross-project, need-audit, implementation-plan]
doc_kind: plan
created: 2026-03-07
---

# F076 Phase 1: Cross-Project Tab + Need Audit MVP — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** External projects visible in Mission Hub as new Tabs with their BACKLOG imported, plus Need Audit Pipeline (Stages 0–2) producing triaged Intent Cards displayed in a Translation Matrix view.

**Architecture:** Extend MissionControlPage with dynamic project tabs. Each external project has its own BacklogItems (scoped by `projectId`) and IntentCards. Backend stores follow existing in-memory pattern (BacklogStore). Need Audit Stages 0–2 are API-driven with manual/semi-auto triage.

**Tech Stack:** Fastify routes (API), Zustand stores (frontend), Tailwind UI (warm palette), node:test (API tests), vitest (frontend tests).

**Not in Phase 1:** Stage 3 (Resolution Design), Stage 4 (Slice Planning), Layer 5 (Knowledge Reflux), automated risk detection, card family extensions (constraint/quality/transition), Stage 1.5 (Domain Pass).

---

## Terminal Schema

These are the final-form types. All tasks build toward this schema — no throwaway scaffolding.

```typescript
// packages/shared/src/types/external-project.ts

export interface ExternalProject {
  id: string;                    // ep-{nanoid}
  userId: string;
  name: string;                  // e.g. "studio-flow"
  description: string;
  sourcePath: string;            // absolute path to project root
  backlogPath: string;           // relative path to BACKLOG.md (default: "docs/BACKLOG.md")
  createdAt: number;
  updatedAt: number;
}

export interface CreateExternalProjectInput {
  name: string;
  description: string;
  sourcePath: string;
  backlogPath?: string;          // defaults to "docs/BACKLOG.md"
}
```

```typescript
// packages/shared/src/types/intent-card.ts

export type SourceTag = 'Q' | 'O' | 'D' | 'R' | 'A';
export type TriageBucket = 'build_now' | 'clarify_first' | 'validate_first' | 'challenge' | 'later';
export type SizeBand = 'S' | 'M' | 'L' | 'XL';
export type ResolutionPath = 'confirmation' | 'evidence' | 'artifact' | 'prototype' | 'escalation' | null;
export type RiskSignal = 'hollow_verbs' | 'missing_actors' | 'unknown_data_source' | 'missing_success_signal' | 'missing_edge_cases' | 'hidden_dependencies' | 'ai_fake_specificity' | 'scope_creep';

export interface IntentCard {
  id: string;                    // ic-{nanoid}
  projectId: string;             // links to ExternalProject.id

  // Core slots (6)
  actor: string;
  contextTrigger: string;
  goal: string;
  objectState: string;
  successSignal: string;
  nonGoal: string;

  // Metadata
  sourceTag: SourceTag;
  sourceDetail: string;          // "PRD section 3.2" / "Client interview 03-07"
  decisionOwner: string;
  confidence: 1 | 2 | 3;
  dependencyTags: string[];      // IDs of cards this depends on
  riskSignals: RiskSignal[];

  // Triage result (null before Stage 2)
  triage: TriageResult | null;

  // Original text from PRD
  originalText: string;

  createdAt: number;
  updatedAt: number;
}

export interface TriageResult {
  clarity: 1 | 2 | 3;
  groundedness: 1 | 2 | 3;
  necessity: 1 | 2 | 3;
  coupling: 1 | 2 | 3;
  sizeBand: SizeBand;
  bucket: TriageBucket;
  resolutionPath: ResolutionPath;
}

export interface NeedAuditFrame {
  id: string;                    // frame-{nanoid}
  projectId: string;
  sponsor: string;
  motivation: string;
  successMetric: string;
  constraints: string;
  currentWorkflow: string;
  provenanceMap: string;         // freeform notes on source of each claim
  createdAt: number;
  updatedAt: number;
}

export interface CreateIntentCardInput {
  projectId: string;
  actor: string;
  contextTrigger: string;
  goal: string;
  objectState: string;
  successSignal: string;
  nonGoal: string;
  sourceTag: SourceTag;
  sourceDetail: string;
  decisionOwner: string;
  confidence: 1 | 2 | 3;
  dependencyTags?: string[];
  riskSignals?: RiskSignal[];
  originalText: string;
}

export interface TriageIntentCardInput {
  clarity: 1 | 2 | 3;
  groundedness: 1 | 2 | 3;
  necessity: 1 | 2 | 3;
  coupling: 1 | 2 | 3;
  sizeBand: SizeBand;
}
// bucket + resolutionPath are computed from scores + sourceTag
```

---

## Task 1: Shared Types — ExternalProject + IntentCard + NeedAuditFrame

**Files:**
- Create: `packages/shared/src/types/external-project.ts`
- Create: `packages/shared/src/types/intent-card.ts`
- Modify: `packages/shared/src/types/index.ts` (add re-exports)
- Modify: `packages/shared/src/types/backlog.ts` (add optional `projectId` to `BacklogItem`)

**Step 1: Create `external-project.ts`** with ExternalProject + CreateExternalProjectInput (from Terminal Schema above).

**Step 2: Create `intent-card.ts`** with all types from Terminal Schema above (SourceTag, TriageBucket, SizeBand, RiskSignal, IntentCard, TriageResult, NeedAuditFrame, CreateIntentCardInput, TriageIntentCardInput).

**Step 3: Add `projectId` to BacklogItem** in `packages/shared/src/types/backlog.ts`:
```typescript
// Add to BacklogItem interface:
projectId?: string;  // null/undefined = home project
```

**Step 4: Re-export from index.ts** — add `export * from './external-project.js'` and `export * from './intent-card.js'`.

**Step 5: Build shared package**
```bash
pnpm --filter @cat-cafe/shared build
```

**Step 6: Commit**
```
feat(F076): add shared types for ExternalProject, IntentCard, NeedAuditFrame
```

---

## Task 2: ExternalProjectStore — In-Memory Store

**Files:**
- Create: `packages/api/src/domains/projects/external-project-store.ts`
- Test: `packages/api/test/external-project-store.test.js`

**Step 1: Write failing tests** — `external-project-store.test.js`:
- `create() returns project with generated id and timestamps`
- `listByUser() returns projects newest-first`
- `getById() returns project or null`
- `delete() removes project`
- `update() modifies fields and bumps updatedAt`
- `create() throws if sourcePath is empty`

Pattern: follow `backlog-store.test.js` — import from `../dist/`, use `node:test` + `node:assert/strict`.

**Step 2: Run tests, verify they fail** (module not found).

**Step 3: Implement ExternalProjectStore** — in-memory Map, nanoid for IDs, same pattern as BacklogStore:
```typescript
export class ExternalProjectStore {
  private projects = new Map<string, ExternalProject>();

  create(userId: string, input: CreateExternalProjectInput): ExternalProject { ... }
  listByUser(userId: string): ExternalProject[] { ... }
  getById(id: string): ExternalProject | null { ... }
  update(id: string, patch: Partial<CreateExternalProjectInput>): ExternalProject { ... }
  delete(id: string): boolean { ... }
}
```

**Step 4: Build + run tests, verify they pass.**

**Step 5: Commit**
```
feat(F076): add ExternalProjectStore with in-memory storage
```

---

## Task 3: External Project API Routes

**Files:**
- Create: `packages/api/src/routes/external-projects.ts`
- Test: `packages/api/test/external-project-routes.test.js`
- Modify: `packages/api/src/server.ts` (register route plugin)

**Step 1: Write failing route tests** — follow `backlog-routes.test.js` pattern (Fastify inject):
- `POST /api/external-projects` — create project → 201
- `GET /api/external-projects` — list projects → 200 + array
- `GET /api/external-projects/:id` — get one → 200 or 404
- `DELETE /api/external-projects/:id` — delete → 204 or 404
- `POST /api/external-projects/:id/import-backlog` — import from BACKLOG.md → 200 + summary
- `POST /api/external-projects` with empty sourcePath → 400

**Step 2: Run tests, verify fail.**

**Step 3: Implement routes** — Fastify plugin pattern:
```typescript
export const externalProjectRoutes: FastifyPluginAsync<{
  externalProjectStore: ExternalProjectStore;
  backlogStore: BacklogStore;
}> = async (app, opts) => {
  // CRUD endpoints
  // import-backlog: reuse readActiveFeaturesFromBacklog() from backlog-doc-import.ts
  //   but with project.sourcePath + project.backlogPath as base
  //   and set projectId on created BacklogItems
};
```

**Step 4: Register in server.ts** — `app.register(externalProjectRoutes, { prefix: '/api/external-projects', ... })`.

**Step 5: Key detail for import-backlog**: The existing `readActiveFeaturesFromBacklog()` takes a path parameter. We construct: `path.join(project.sourcePath, project.backlogPath)`. Created BacklogItems get `projectId: project.id` set.

**Step 6: Build + run tests.**

**Step 7: Commit**
```
feat(F076): add external project API routes with BACKLOG import
```

---

## Task 4: IntentCardStore + NeedAuditFrameStore

**Files:**
- Create: `packages/api/src/domains/projects/intent-card-store.ts`
- Create: `packages/api/src/domains/projects/need-audit-frame-store.ts`
- Test: `packages/api/test/intent-card-store.test.js`

**Step 1: Write failing tests** for IntentCardStore:
- `create() returns card with generated id`
- `listByProject() returns cards for a project, newest-first`
- `getById() returns card or null`
- `update() patches card fields`
- `triage() sets triage result with computed bucket`
- `triage() rejects A-tagged card from build_now bucket` ← **hard gate**
- `delete() removes card`
- `listByProject() with bucket filter`

**Step 2: Write failing tests** for NeedAuditFrameStore:
- `create() returns frame`
- `getByProject() returns frame for project or null`
- `update() patches frame`
- `create() rejects if sponsor is empty`
- `create() rejects if successMetric is empty`

**Step 3: Implement IntentCardStore** — in-memory Map. Key logic: **triage bucket computation**:
```typescript
computeBucket(scores: TriageIntentCardInput, sourceTag: SourceTag): { bucket: TriageBucket; resolutionPath: ResolutionPath } {
  // Hard gate: A-tagged → cannot be build_now
  if (sourceTag === 'A') {
    return { bucket: 'validate_first', resolutionPath: 'evidence' };
  }

  const { clarity, groundedness, necessity, coupling, sizeBand } = scores;

  // Build Now: high clarity + groundedness + necessity, manageable coupling, S/M size
  if (clarity >= 2 && groundedness >= 2 && necessity >= 2 && coupling <= 2 && (sizeBand === 'S' || sizeBand === 'M')) {
    return { bucket: 'build_now', resolutionPath: null };
  }

  // Clarify First: necessary but low clarity
  if (necessity >= 2 && clarity < 2) {
    return { bucket: 'clarify_first', resolutionPath: 'confirmation' };
  }

  // Validate First: clear but low groundedness
  if (clarity >= 2 && groundedness < 2) {
    return { bucket: 'validate_first', resolutionPath: 'evidence' };
  }

  // Challenge: clear + grounded but low necessity
  if (clarity >= 2 && groundedness >= 2 && necessity < 2) {
    return { bucket: 'challenge', resolutionPath: 'escalation' };
  }

  // Later: everything else
  return { bucket: 'later', resolutionPath: null };
}
```

**Step 4: Implement NeedAuditFrameStore** — one frame per project (upsert pattern).

**Step 5: Build + run tests.**

**Step 6: Commit**
```
feat(F076): add IntentCardStore + NeedAuditFrameStore with triage logic
```

---

## Task 5: IntentCard + NeedAuditFrame API Routes

**Files:**
- Create: `packages/api/src/routes/intent-cards.ts`
- Test: `packages/api/test/intent-card-routes.test.js`
- Modify: `packages/api/src/server.ts` (register route plugin)

**Step 1: Write failing route tests**:
- `POST /api/external-projects/:projectId/intent-cards` — create → 201
- `GET /api/external-projects/:projectId/intent-cards` — list → 200
- `GET /api/external-projects/:projectId/intent-cards?bucket=build_now` — filtered list
- `GET /api/external-projects/:projectId/intent-cards/:id` — get one → 200/404
- `PATCH /api/external-projects/:projectId/intent-cards/:id` — update → 200
- `POST /api/external-projects/:projectId/intent-cards/:id/triage` — triage → 200 + computed bucket
- `POST /api/external-projects/:projectId/intent-cards/:id/triage` with A tag → bucket != build_now
- `DELETE /api/external-projects/:projectId/intent-cards/:id` — 204
- `POST /api/external-projects/:projectId/frame` — create/update frame → 200
- `GET /api/external-projects/:projectId/frame` — get frame → 200/404

**Step 2: Implement routes.**

**Step 3: Register in server.ts** — nested under `/api/external-projects`.

**Step 4: Build + run tests.**

**Step 5: Commit**
```
feat(F076): add intent card + audit frame API routes
```

---

## Task 6: Frontend — External Project Zustand Store

**Files:**
- Create: `packages/web/src/stores/externalProjectStore.ts`

**Step 1: Create store** following `missionControlStore.ts` pattern:
```typescript
interface ExternalProjectState {
  projects: ExternalProject[];
  activeProjectId: string | null;   // currently selected Tab
  intentCards: IntentCard[];         // cards for active project
  auditFrame: NeedAuditFrame | null;
  loading: boolean;
  error: string | null;

  setProjects: (p: ExternalProject[]) => void;
  setActiveProjectId: (id: string | null) => void;
  setIntentCards: (cards: IntentCard[]) => void;
  setAuditFrame: (frame: NeedAuditFrame | null) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}
```

**Step 2: Commit**
```
feat(F076): add externalProjectStore (Zustand)
```

---

## Task 7: Frontend — MissionControlPage Tab Extension

**Files:**
- Modify: `packages/web/src/components/mission-control/MissionControlPage.tsx`
- Create: `packages/web/src/components/mission-control/ExternalProjectTab.tsx`
- Create: `packages/web/src/components/mission-control/ImportProjectModal.tsx`

This is the core UX change. Current tabs: `features | dependencies`. We add dynamic project tabs.

**Step 1: Add "导入项目" button** next to existing tab row in MissionControlPage:
```tsx
// After the existing tab buttons, add:
<button onClick={() => setShowImportModal(true)} className="...">
  + 导入项目
</button>
```

**Step 2: Create ImportProjectModal** — form with fields: name, sourcePath, backlogPath (defaults to "docs/BACKLOG.md"), description. On submit: POST `/api/external-projects` → reload projects.

**Step 3: Render dynamic project tabs** — after "features" and "dependencies" tabs, map `projects` to tab buttons:
```tsx
{projects.map(p => (
  <button key={p.id} onClick={() => setActiveTab(p.id)} className={...}>
    {p.name}
  </button>
))}
```

**Step 4: Create ExternalProjectTab** — container component that shows:
- Sub-tabs: `功能列表 | 需求追踪 | 治理健康度`
- Default sub-tab: 功能列表 (reuses FeatureRowList with projectId filter)
- Header with "导入 Backlog" button (calls POST `/api/external-projects/:id/import-backlog`)

**Step 5: Wire tab switching** — when `activeTab` is a project ID (not 'features'/'dependencies'), render `<ExternalProjectTab projectId={activeTab} />`.

**Step 6: Load projects on mount** — `useEffect` fetches GET `/api/external-projects`.

**Step 7: Frontend tests** — update `mission-control-page.test.ts`:
- "renders import project button"
- "shows project tabs after import"
- "switches to external project tab"

**Step 8: Commit**
```
feat(F076): add external project tabs + import modal to Mission Hub
```

---

## Task 8: Frontend — Translation Matrix View

**Files:**
- Create: `packages/web/src/components/mission-control/TranslationMatrix.tsx`
- Create: `packages/web/src/components/mission-control/IntentCardRow.tsx`
- Create: `packages/web/src/components/mission-control/IntentCardDetail.tsx`
- Create: `packages/web/src/components/mission-control/TriageBadge.tsx`

This is the "需求追踪" sub-tab inside ExternalProjectTab.

**Step 1: Create TriageBadge** — colored badge for triage bucket:
```tsx
const BUCKET_STYLES: Record<TriageBucket, string> = {
  build_now: 'bg-green-100 text-green-800',
  clarify_first: 'bg-yellow-100 text-yellow-800',
  validate_first: 'bg-orange-100 text-orange-800',
  challenge: 'bg-red-100 text-red-800',
  later: 'bg-gray-100 text-gray-600',
};
```
Plus SourceTag badge (Q=blue, O=green, D=purple, R=teal, A=red).

**Step 2: Create IntentCardRow** — table row showing: original text (truncated) | Intent Card summary (actor + goal) | source tag badge | triage badge | status.

**Step 3: Create TranslationMatrix** — table with columns per spec Block B:
| 甲方原文 | Intent Card | Source | Triage | Status |

- Loads cards from store
- Fetch: GET `/api/external-projects/:projectId/intent-cards`
- Filter bar: bucket filter buttons (全部 / Build Now / Clarify / Validate / Challenge / Later)
- Count summary at top: "45/52 cards triaged · 18 Build Now · 7 unresolved"

**Step 4: Create IntentCardDetail** — right-side panel (replacing SuggestionDrawer when in project tab):
- All 6 core slots displayed
- Metadata: source tag, decision owner, confidence, dependencies, risk signals
- Triage form: 5 dimension sliders (1-3) + size band selector → POST triage endpoint
- Computed bucket shown after triage

**Step 5: Wire into ExternalProjectTab** — "需求追踪" sub-tab renders `<TranslationMatrix>`, clicking a row shows `<IntentCardDetail>` in right panel.

**Step 6: Frontend tests**:
- "TranslationMatrix renders cards with correct badges"
- "TriageBadge shows correct color for each bucket"
- "IntentCardDetail shows triage form"
- "A-tagged card cannot be triaged as build_now"

**Step 7: Commit**
```
feat(F076): add Translation Matrix view + Intent Card detail
```

---

## Task 9: Frontend — Need Audit Frame (Stage 0)

**Files:**
- Create: `packages/web/src/components/mission-control/NeedAuditFrame.tsx`

**Step 1: Create NeedAuditFrame form** — displayed at top of ExternalProjectTab or as a setup step:
- 6 fields matching Stage 0 (sponsor, motivation, successMetric, constraints, currentWorkflow, provenanceMap)
- "sponsor" and "successMetric" required (frontend validation mirrors backend)
- Save: POST `/api/external-projects/:projectId/frame`
- Load existing: GET `/api/external-projects/:projectId/frame`
- Visual: warm-toned card, prominent placement

**Step 2: Gate logic** — if no frame exists for project, show "完成 Stage 0: Frame" prompt before showing other sub-tabs. Not a hard block (user can skip), but clearly highlighted.

**Step 3: Frontend tests**:
- "shows frame setup prompt when no frame exists"
- "saves frame and shows success"
- "loads existing frame data"

**Step 4: Commit**
```
feat(F076): add Need Audit Frame (Stage 0) form
```

---

## Task 10: Frontend — Create Intent Card Form (Stage 1)

**Files:**
- Create: `packages/web/src/components/mission-control/CreateIntentCardForm.tsx`

**Step 1: Create form** — accessible from Translation Matrix ("+ 新建 Intent Card" button or "Run Need Audit" button):
- Fields: originalText (textarea, paste PRD excerpt), actor, contextTrigger, goal, objectState, successSignal, nonGoal
- Metadata: sourceTag (dropdown), sourceDetail, decisionOwner, confidence (1-3)
- Optional: dependencyTags (multi-select from existing cards), riskSignals (checkbox list of 8 signals)
- Submit: POST `/api/external-projects/:projectId/intent-cards`

**Step 2: Risk signal checkboxes** — 8 signals with brief descriptions:
```tsx
const RISK_SIGNALS: { value: RiskSignal; label: string }[] = [
  { value: 'hollow_verbs', label: '动词空心 — improve/optimize/support 无具体动作' },
  { value: 'missing_actors', label: '角色缺失 — 谁在操作？' },
  // ... all 8
];
```

**Step 3: Frontend tests**:
- "creates intent card with all fields"
- "requires originalText"
- "source tag defaults to A"

**Step 4: Commit**
```
feat(F076): add Create Intent Card form (Stage 1 Downgrade)
```

---

## Task 11: Frontend — Governance Health Summary

**Files:**
- Create: `packages/web/src/components/mission-control/GovernanceHealth.tsx`

**Step 1: Create GovernanceHealth** — "治理健康度" sub-tab, displays Block A metrics:
- Cards triaged: `{triaged} / {total} cards triaged`
- Build Now ready: `{buildNow} cards ready`
- Open questions: `{clarify + validate} unresolved`
- Source tag distribution: bar chart (Q/O/D/R/A counts)
- Risk signal heatmap: which signals fire most often

All computed client-side from intentCards in store. No new API needed.

**Step 2: Style** — warm palette, stat cards with icons, consistent with Mission Hub.

**Step 3: Commit**
```
feat(F076): add Governance Health summary panel
```

---

## Task 12: Integration Test + Polish

**Files:**
- Test: `packages/api/test/external-project-routes.test.js` (extend)
- Test: frontend tests (extend)

**Step 1: End-to-end API test** — full flow:
1. Create external project
2. Import backlog (mock BACKLOG.md content)
3. Create audit frame (Stage 0)
4. Create intent cards (Stage 1)
5. Triage cards (Stage 2)
6. Verify A-tagged card hard gate
7. List cards by bucket filter

**Step 2: Frontend integration test** — full flow:
1. Import project → tab appears
2. Import backlog → feature list shows
3. Create frame → gate clears
4. Create intent card → appears in matrix
5. Triage card → badge updates

**Step 3: Build + lint**
```bash
pnpm --filter @cat-cafe/shared build
pnpm check
pnpm lint
pnpm test
```

**Step 4: Commit**
```
feat(F076): Phase 1 integration tests + polish
```

---

## File Size Budget

| New file | Est. lines | Budget |
|----------|-----------|--------|
| shared/types/external-project.ts | ~25 | ✅ |
| shared/types/intent-card.ts | ~90 | ✅ |
| api/domains/projects/external-project-store.ts | ~80 | ✅ |
| api/domains/projects/intent-card-store.ts | ~150 | ✅ |
| api/domains/projects/need-audit-frame-store.ts | ~60 | ✅ |
| api/routes/external-projects.ts | ~200 | ✅ (budget: 200) |
| api/routes/intent-cards.ts | ~200 | ✅ (budget: 200) |
| web/stores/externalProjectStore.ts | ~35 | ✅ |
| web/components/mission-control/ExternalProjectTab.tsx | ~180 | ✅ |
| web/components/mission-control/ImportProjectModal.tsx | ~100 | ✅ |
| web/components/mission-control/TranslationMatrix.tsx | ~150 | ✅ |
| web/components/mission-control/IntentCardRow.tsx | ~60 | ✅ |
| web/components/mission-control/IntentCardDetail.tsx | ~200 | ✅ (budget: 200) |
| web/components/mission-control/TriageBadge.tsx | ~40 | ✅ |
| web/components/mission-control/NeedAuditFrame.tsx | ~120 | ✅ |
| web/components/mission-control/CreateIntentCardForm.tsx | ~150 | ✅ |
| web/components/mission-control/GovernanceHealth.tsx | ~100 | ✅ |
| MissionControlPage.tsx (modify) | +~50 | 632→682 ✅ |

All under 200-line warning / 350 hard limit. MissionControlPage might need extraction if it grows — monitor.

---

## Dependency Order

```
Task 1 (types) → Task 2 (project store) → Task 3 (project routes)
                                         ↘
Task 1 (types) → Task 4 (card stores) → Task 5 (card routes)
                                         ↘
Task 6 (frontend store) → Task 7 (tabs) → Task 8 (matrix) → Task 12 (integration)
                                         → Task 9 (frame)
                                         → Task 10 (card form)
                                         → Task 11 (health)
```

Tasks 2+4 can run in parallel after Task 1.
Tasks 3+5 can run in parallel after their stores.
Tasks 8+9+10+11 can run in parallel after Task 7.

---

## Phase 2 Preview (not in scope)

- Stage 1.5: Domain Pass (glossary, entity-state map, data source registry)
- Stage 3: Resolution Design (constrained confirmation, evidence request, etc.)
- Stage 4: Slice Planning (Learning/Value/Hardening slices)
- Layer 5: Knowledge Reflux (methodology patterns → F070 Phase 3)
- Automated risk signal detection (heuristic-based)
- Trial run on studio-flow PRD-V1
