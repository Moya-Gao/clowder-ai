---
feature_ids: [F192]
topics: [harness-engineering, eval, implementation-plan]
doc_kind: plan
created: 2026-05-07
---

# F192 Phase A: Harness Eval Skeleton — Implementation Plan

**Feature:** F192 — `docs/features/F192-socio-technical-harness-eval.md`
**Goal:** Create the minimal infrastructure so harness-feedback exists as a doc type, gets indexed, and is wired into feat-lifecycle.
**Acceptance Criteria:** AC-A1 through AC-A6
**Architecture cell:** memory-indexing (CatCafeScanner KIND_DIRS)
**Map delta:** none
**Map delta why:** Adding one directory + kind mapping to existing scanner — no new boundaries or ownership changes.
**Architecture:** Add `harness-feedback` to CatCafeScanner KIND_DIRS (mapped to `lesson` EvidenceKind). Add frontmatter recognition in `inferKind`. Create docs directory + README + sample doc. Add Step 0.6 to feat-lifecycle skill.
**前端验证:** No — pure docs + backend scanner + skill change.

---

## Task 1: Create `docs/harness-feedback/` directory + README

**Files:**
- Create: `docs/harness-feedback/README.md`

**AC coverage:** AC-A1, AC-A5

**Step 1: Create README with doc_kind spec + authority boundary**

The README defines the `harness-feedback` doc_kind frontmatter schema, states the "derived view, not source of truth" constraint, and documents the scanner limitation (EvidenceKind is `lesson`, not a separate filterable kind).

**Step 2: Commit**

```
docs(F192): create harness-feedback directory + README [宪宪/Opus-46🐾]
```

---

## Task 2: Wire CatCafeScanner to index `docs/harness-feedback/`

**Files:**
- Modify: `packages/api/src/domains/memory/CatCafeScanner.ts:9-23` (KIND_DIRS)
- Modify: `packages/api/src/domains/memory/CatCafeScanner.ts:279-301` (inferKind)

**AC coverage:** AC-A2

**Step 1: Add `'harness-feedback'` to KIND_DIRS**

```typescript
// In KIND_DIRS, add after 'stories':
'harness-feedback': 'lesson',
```

Maps to `lesson` because harness-feedback is closest to "what we learned from using the harness". A dedicated EvidenceKind can be added later if filtering by kind becomes necessary.

**Step 2: Add frontmatter recognition in inferKind**

```typescript
// In inferKind, add before the lesson block:
if (docKind === 'harness-feedback') return 'lesson';
```

This ensures `doc_kind: harness-feedback` in frontmatter is explicitly recognized rather than falling through to default `'plan'`.

**Step 3: Build shared + verify TypeScript compiles**

```bash
pnpm --filter @cat-cafe/api exec tsc --noEmit
```

**Step 4: Run existing scanner tests to verify no regression**

```bash
pnpm --filter @cat-cafe/api test -- --grep Scanner
```

**Step 5: Commit**

```
feat(F192): add harness-feedback to CatCafeScanner KIND_DIRS [宪宪/Opus-46🐾]
```

---

## Task 3: Write sample harness-feedback document

**Files:**
- Create: `docs/harness-feedback/2026-05-07-F167-ball-drop-friction.md`

**AC coverage:** AC-A4, AC-A6

**Step 1: Write sample using a real F167 friction point**

Use the known "ball drop" friction from A2A (zombie hold, ack loop). The sample must:
- Use `doc_kind: harness-feedback` frontmatter
- Use `trace_refs` / `evidence_refs` pointing to canonical thread/session IDs (not raw trace copies)
- Follow the `cat_user_feedback` schema from the draft

**Step 2: Verify search_evidence can find it**

After the API restarts with the new scanner config, search:
```
search_evidence("ball drop friction", scope="docs", mode="hybrid")
```

Expected: result includes the sample doc with kind `lesson` and visible `doc_kind: harness-feedback` in frontmatter.

**Step 3: Commit**

```
docs(F192): add sample harness-feedback for F167 ball-drop [宪宪/Opus-46🐾]
```

---

## Task 4: Add Step 0.6 to feat-lifecycle skill

**Files:**
- Modify: `cat-cafe-skills/feat-lifecycle/SKILL.md:264-266` (between Step 0.5 and Step 1)

**AC coverage:** AC-A3

**Step 1: Insert Step 0.6 Harness Eval Checkpoint**

After "Step 0.5: 反思胶囊" (line 264) and before "Step 1: Close Gate Report" (line 266), insert the checkpoint with:
- Checkpoint is mandatory (write `harness_feedback: none` + reason if not triggered)
- Trigger conditions: harness/skill/MCP feature close, CVO 不满意, trace anomaly, sampling
- Interview must be isolated session/turn
- If triggered, link harness-feedback doc to feature spec / CloseGateReport

**Step 2: Sync skills**

```bash
pnpm sync:skills
```

**Step 3: Commit**

```
feat(F192): add Step 0.6 Harness Eval Checkpoint to feat-lifecycle [宪宪/Opus-46🐾]
```

---

## Task 5: Verify full chain + update spec

**AC coverage:** All AC-A1~A6 final verification

**Step 1: Run `pnpm check` for lint**

**Step 2: Update F192 spec — mark Phase A AC items with evidence**

**Step 3: Final commit**

```
docs(F192): Phase A implementation complete [宪宪/Opus-46🐾]
```

---

## Commit sequence

1. `docs(F192): create harness-feedback directory + README`
2. `feat(F192): add harness-feedback to CatCafeScanner KIND_DIRS`
3. `docs(F192): add sample harness-feedback for F167 ball-drop`
4. `feat(F192): add Step 0.6 Harness Eval Checkpoint to feat-lifecycle`
5. `docs(F192): Phase A implementation complete`

All commits on feature branch in worktree → PR → 砚砚 review → merge.
