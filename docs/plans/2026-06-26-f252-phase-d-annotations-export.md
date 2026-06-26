# F252 Phase D: Annotations + Sanitized Export — Implementation Plan

**Feature:** F252 — `docs/features/F252-story-player.md`
**Goal:** Enable presenters to annotate story replay at arbitrary timestamps + generate sanitized public export packs for external sharing
**Acceptance Criteria:**
- AC-D1: Annotations at arbitrary time points, auto-popup on replay
- AC-D2: Sanitized export pack (no raw transcript API), filtered content, ledger audit, public URL
**Architecture cell:** `story-player` (F252, same cell as Phase A-C)
**Map delta:** none
**Map delta why:** Annotations are local data layer + frontend; sanitizer is a new pure function in the story domain — no new ownership cell
**Architecture:** Annotation CRUD via REST API + `data/stories/:storyId/annotations.json` file storage. Export sanitizer is a pure function that walks transcript events and applies content-class redaction rules (reuses TelemetryRedactor's A/B/C/D classification concept but operates on event content, not OTel spans). Public URL serves pre-generated static export pack.
**Tech Stack:** Fastify routes, pure TS functions, vitest, React components
**前端验证:** Yes — annotation UI + public viewer require browser testing

---

## Finish Line

**B definition:** A presenter can annotate a story replay at any timestamp, and generate a public URL that serves a sanitized copy — no credentials, paths, tokens, or internal names leak.

**What we're NOT building:**
- Real-time collaborative annotation (single-user only)
- Video/audio annotations (text only)
- Annotation templates or AI-generated annotations
- Granular per-field sanitization UI (all-or-nothing export)

## Terminal Schema

```typescript
// --- Annotation types (new file: packages/shared/src/types/story-annotation.ts) ---

interface StoryAnnotation {
  id: string;                    // nanoid
  storyId: string;               // session:<id> or feat:<featId>
  at: number;                    // timestamp (ms since epoch)
  kind: 'narration' | 'highlight';  // text narration or highlight marker
  content: string;               // markdown text
  createdAt: number;
  updatedAt: number;
}

interface AnnotationSet {
  storyId: string;
  annotations: StoryAnnotation[];
  version: number;               // optimistic concurrency
}

// --- Export types (new file: packages/shared/src/types/story-export.ts) ---

interface StoryExportManifest {
  exportId: string;              // nanoid
  storyId: string;
  title: string;
  description: string;
  exportedAt: number;
  sanitizationRules: string[];   // which redaction classes were applied
  eventCount: number;
  annotations: StoryAnnotation[];
}

interface SanitizedEvent {
  // Same shape as ReplayEvent but with redacted content
  id: string;
  at: number;
  kind: string;
  content: string;               // redacted
  toolName?: string;
  toolArgs?: string;             // redacted
  toolResult?: string;           // redacted
  catId?: string;                // kept (public cat names)
}

interface StoryExportPack {
  manifest: StoryExportManifest;
  events: SanitizedEvent[];      // sanitized event stream
  rendering?: object;            // sanitized FeatureStoryRenderingDTO (if feat story)
}
```

## Stateful Object Gate

### Census: Lifecycle Objects

1. **AnnotationSet** — CRUD lifecycle per storyId
2. **StoryExportPack** — generated artifact, immutable after creation

### Object 1: AnnotationSet

**Lifecycle owner:** API route handler (CRUD)

**State x Event Transition Table:**

| Current State | Event | Next State | Side Effect |
|---|---|---|---|
| not-exists | POST /annotations | created (v=1) | Create `data/stories/:storyId/annotations.json` |
| created (v=N) | PUT /annotations/:id | updated (v=N+1) | Update annotation in-place, bump version |
| created (v=N) | DELETE /annotations/:id | updated (v=N+1) | Remove annotation, bump version |
| created (v=N) | POST /annotations (new) | updated (v=N+1) | Append annotation, bump version |
| any | GET /annotations | read | No state change |

**Bypass restrictions:** None — annotations are user-owned, no shared state concerns.

**Invariants:**
- INV-1: annotation.id is unique within an AnnotationSet (test: POST two with same id → reject)
- INV-2: version monotonically increases on every write (test: sequential writes → v increments)
- INV-3: annotation.at must be within the story's time range (test: out-of-range → 400)

**Adversarial scenarios:**
- Concurrent writes: optimistic concurrency via version field — PUT with stale version → 409
- File missing mid-session: GET returns empty set, POST creates fresh

### Object 2: StoryExportPack

**Lifecycle owner:** Export route handler (create-once)

**State x Event Transition Table:**

| Current State | Event | Next State |
|---|---|---|
| not-exists | POST /export | created |
| created | GET /public | served (read-only) |
| created | DELETE /export | deleted |

**Invariants:**
- INV-4: Export pack is immutable after creation (no PATCH/PUT)
- INV-5: Public URL only serves if export pack exists (404 otherwise)
- INV-6: Every content field in the export is sanitized — no raw paths, tokens, env vars, or internal cat names survive (test: known sensitive patterns in fixtures → assert absent in output)

**Adversarial scenarios:**
- Export while annotations being edited: snapshot annotations at export time (point-in-time copy)
- Re-export: creates new exportId, old one remains (no overwrite)

---

## Implementation Steps

### Sub-Phase D1: Annotation Layer (AC-D1)

#### Task 1: Annotation types + CRUD API

**Files:**
- Create: `packages/shared/src/types/story-annotation.ts`
- Create: `packages/api/src/domains/story/annotation-store.ts`
- Create: `packages/api/src/routes/story-annotations.ts`
- Create: `packages/api/test/story-annotations.test.js`
- Modify: `packages/api/src/index.ts` (register routes)

**Step 1:** Define `StoryAnnotation` + `AnnotationSet` types in shared (terminal schema above).

**Step 2:** Write failing tests for annotation CRUD:
- POST creates annotation, returns 201 + annotation with id
- GET returns all annotations for storyId
- PUT updates annotation content/at, bumps version
- DELETE removes annotation, bumps version
- PUT with stale version → 409
- POST with at outside story time range → 400

**Step 3:** Implement `AnnotationFileStore` — read/write `data/stories/:storyId/annotations.json`.

**Step 4:** Implement Fastify routes: `GET/POST /api/story/:storyId/annotations`, `PUT/DELETE /api/story/:storyId/annotations/:annotationId`.

**Step 5:** Wire routes in `index.ts` with `registerCallbackAuthHook`.

**Step 6:** Run tests → green. Commit.

#### Task 2: Annotation UI — editor + replay integration

**Files:**
- Create: `packages/web/src/components/story-player/AnnotationEditor.tsx`
- Create: `packages/web/src/components/story-player/AnnotationOverlay.tsx`
- Modify: `packages/web/src/components/story-player/ReplayControls.tsx` (add annotation button)
- Modify: `packages/web/src/app/story/[storyId]/page.tsx` (integrate overlay)

**Step 1:** `AnnotationEditor` — modal form: timestamp (auto-filled from current playback position), kind selector, content textarea. Calls POST/PUT annotation API.

**Step 2:** `AnnotationOverlay` — displays annotations as floating cards during replay. Auto-pauses at annotation timestamp, shows card, resumes on dismiss.

**Step 3:** Add "📝 Add Note" button to `ReplayControls` — opens `AnnotationEditor` at current playback time.

**Step 4:** Integrate `AnnotationOverlay` into story page — fetch annotations on mount, pass to overlay with current replay time.

**Step 5:** Commit.

### Sub-Phase D2: Sanitized Export + Public Sharing (AC-D2)

#### Task 3: Content sanitizer (pure function)

**Files:**
- Create: `packages/api/src/domains/story/content-sanitizer.ts`
- Create: `packages/api/test/content-sanitizer.test.js`

**Step 1:** Write failing tests with fixture events containing known sensitive content:
- File paths: `/Users/lysander/projects/relay-station/...` → `[PATH_REDACTED]`
- API keys: `sk-ant-api03-...` → `[KEY_REDACTED]`
- Environment variables: `REDIS_URL=redis://localhost:6399` → `[ENV_REDACTED]`
- Internal cat names (internal handles) → public cat names
- GitHub tokens, callback tokens → `[TOKEN_REDACTED]`
- Worktree paths, `.env.local` content → `[CONFIG_REDACTED]`

**Step 2:** Implement `sanitizeEventContent(event: TranscriptEvent): SanitizedEvent` — regex-based redaction with the following classes:
- Class A (credentials): API keys, tokens, passwords → `[REDACTED]`
- Class B (paths): absolute file paths, worktree paths → `[PATH]`
- Class C (env): env var assignments, config values → `[CONFIG]`
- Class D (identity): internal handles → public names (lookup table)

**Step 3:** Implement `sanitizeStoryExport(events: TranscriptEvent[], annotations: StoryAnnotation[]): StoryExportPack` — walks all events, applies sanitizer, packages with manifest.

**Step 4:** Run tests → green. Commit.

#### Task 4: Export API + public route

**Files:**
- Create: `packages/api/src/routes/story-export.ts`
- Create: `packages/api/test/story-export.test.js`
- Modify: `packages/api/src/index.ts` (register routes)

**Step 1:** Write failing tests:
- POST `/api/story/:storyId/export` → creates export pack, returns manifest
- GET `/api/story/:storyId/public` → serves sanitized export (no auth required)
- GET `/api/story/:storyId/public` when no export → 404
- POST export → verify INV-6 (no sensitive content in output)
- DELETE `/api/story/:storyId/export/:exportId` → removes export

**Step 2:** Implement export route — fetches transcript events, loads annotations, calls sanitizer, writes to `data/stories/:storyId/exports/:exportId/`.

**Step 3:** Implement public route — serves pre-generated export pack, no auth (public).

**Step 4:** Wire routes. Run tests → green. Commit.

#### Task 5: Public viewer UI

**Files:**
- Create: `packages/web/src/app/story/[storyId]/public/page.tsx`
- Create: `packages/web/src/components/story-player/PublicStoryViewer.tsx`

**Step 1:** `PublicStoryViewer` — read-only replay using sanitized export data (no raw API calls). Reuses `ReplayControls` + `ReplayEventBubble` in read-only mode.

**Step 2:** Public page fetches from `/api/story/:storyId/public` (no auth), renders `PublicStoryViewer` with sanitized events + annotations.

**Step 3:** Commit.

#### Task 6: Export button + ledger audit

**Files:**
- Modify: `packages/web/src/app/story/[storyId]/page.tsx` (add export button)
- Modify: `packages/api/src/routes/story-export.ts` (ledger write)

**Step 1:** Add "📤 Export for Sharing" button to story page → calls POST export → shows public URL.

**Step 2:** Export route writes audit entry to ledger (who exported, when, sanitization rules applied, event count).

**Step 3:** Commit.

---

## Open Questions

| # | Question | Type | Resolution |
|---|---|---|---|
| OQ-D1 | Should annotations persist in Redis (like other user data) or in filesystem (`data/stories/`)? | Technical | Filesystem — annotations are story-scoped artifacts, not user state. `data/stories/` matches the spec's `annotations.json` pattern. If we later need multi-user access, migrate to Redis then |
| OQ-D2 | Should the sanitizer be regex-based or AST-based for code content? | Technical | Regex — simpler, sufficient for known sensitive patterns. AST parsing would be over-engineering for v1 |
| OQ-D3 | Public URL auth-free: is this safe given the sanitizer covers all sensitive content? | Technical | Yes — the sanitizer is the security boundary. Public URL only serves pre-generated sanitized packs, never raw data. INV-6 test suite is the safety net |
