# F188 Phase J: Health Debt Governance — Implementation Plan

**Feature:** F188 — `docs/features/F188-library-stewardship.md`
**Goal:** Turn the two core health debts exposed by Phase B dashboard (201 orphan edges, 724 unverified docs) into explainable, dry-runnable, repairable, regression-testable governance workflows
**Acceptance Criteria:**
- AC-J1: Health debt semantics spec (authority / verified_at / usage_signal 三维分离)
- AC-J2: Orphan edge details API (分页/抽样 details with classification)
- AC-J3: Orphan edge repair dry-run (分类 + before/after count + SQL preview)
- AC-J4: Orphan edge repair apply (auto-fix safe items + review bucket for ambiguous)
- AC-J5: Edge write prevention (canonical resolver in extractFeatureRefEdges + regression tests)
- AC-J6: Verification debt migration dry-run (review_status bucket assignment via kind×source_path whitelist)
- AC-J7: Cat-owned verification workflow (MCP tool with confirm/mark_stale/escalate/dismiss_review)
- AC-J8: F200 integration boundary (single-direction JOIN, negative boundary tests)
- AC-J9: Dogfood acceptance report on runtime DB copy
**Architecture cell:** memory
**Map delta:** none
**Map delta why:** Phase J only modifies data + adds migrate/repair tools, doesn't change memory cell boundary
**Architecture:** Schema V24 adds `review_status TEXT` to `evidence_docs`. Orphan edge repair via classify→dry-run→apply pipeline. Feature-ref canonical resolver prevents new orphans. Cat verification workflow via MCP tool writing review_status + verified_at. F200 data read-only via JOIN.
**Tech Stack:** better-sqlite3, node:test, Fastify routes, MCP tool
**前端验证:** No — Phase J is pure backend (API/CLI/MCP), no UI changes

---

## What We're NOT Building

- No new dashboard UI (Phase B dashboard already exists)
- No F200 modifications (read-only via JOIN)
- No new tables (reuse evidence_docs + f163_logs)
- No automatic authority promotion (cat confirm only)
- No verified_at backfill

## Terminal Schema

```typescript
// Schema V24: evidence_docs gains review_status
// evidence_docs.review_status: 'trusted_legacy' | 'needs_review' | 'reviewed' | 'escalated' | null

// Orphan edge classification
interface OrphanEdgeClassification {
  id: 'feature_ref_zero_pad' | 'feature_ref_true_ghost' | 'wikilink_code_artifact' | 'wikilink_potential_doc' | 'related_field_ghost';
  edges: Array<{ from_anchor: string; to_anchor: string; relation: string; action: 'update' | 'delete' | 'review'; new_to_anchor?: string }>;
}

// Verification action
interface VerificationAction {
  anchor: string;
  action: 'confirm' | 'mark_stale' | 'escalate' | 'dismiss_review';
}
```

---

## Task 1: Edge Write Prevention — Canonical Resolver (AC-J5)

**Files:**
- Modify: `packages/api/src/domains/memory/edge-extractors.ts:30-34`
- Test: `packages/api/test/memory/edge-extractors.test.js` (add new describe block)

**Step 1: Write failing tests for canonical resolver**

```javascript
describe('extractFeatureRefEdges canonical resolver (AC-J5)', () => {
  it('zero-pads short F numbers: F20 → F020', () => {
    const edges = extractFeatureRefEdges('文档引用 F20 和 F186', 'other');
    assert.equal(edges.length, 2);
    assert.equal(edges[0].toAnchor, 'F020');
    assert.equal(edges[1].toAnchor, 'F186');
  });

  it('F020 already canonical is no-op', () => {
    const edges = extractFeatureRefEdges('已经是 F020 的引用', 'other');
    assert.equal(edges.length, 1);
    assert.equal(edges[0].toAnchor, 'F020');
  });

  it('filters year-like F2025 (num > 999)', () => {
    const edges = extractFeatureRefEdges('年份 F2025 不是 feature', 'other');
    assert.equal(edges.length, 0);
  });

  it('rejects F32-b (hyphen suffix via lookahead)', () => {
    const edges = extractFeatureRefEdges('F32-b 不是合法 anchor', 'other');
    assert.equal(edges.length, 0);
  });

  it('creates edge for unknown F998 (unresolved is ok at extraction)', () => {
    const edges = extractFeatureRefEdges('不存在的 F998', 'other');
    assert.equal(edges.length, 1);
    assert.equal(edges[0].toAnchor, 'F998');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/api && pnpm build && node --test test/memory/edge-extractors.test.js`
Expected: FAIL — F20 produces `F20` not `F020`, F32-b produces `F032` not empty

**Step 3: Implement canonical resolver**

In `edge-extractors.ts`, replace lines 30-34:

```typescript
for (const match of masked.matchAll(/\bF(\d{2,4})(?![-a-zA-Z])\b/g)) {
  const num = parseInt(match[1]!, 10);
  if (num > 999) continue;
  const fRef = `F${String(num).padStart(3, '0')}`;
  if (fRef === selfAnchor || seen.has(fRef)) continue;
  seen.add(fRef);
  edges.push({ fromAnchor: selfAnchor, toAnchor: fRef, relation: 'feature_ref', provenance: 'content' });
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/api && pnpm build && node --test test/memory/edge-extractors.test.js`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/edge-extractors.ts packages/api/test/memory/edge-extractors.test.js
git commit -m "feat(F188): AC-J5 canonical resolver for feature-ref edges [宪宪/Opus-46🐾]"
```

---

## Task 2: Schema V24 — review_status Column (AC-J6 prerequisite)

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts` (add V24 migration)
- Test: `packages/api/test/memory/f188-library-health.test.js` (add schema test)

**Step 1: Write failing test for review_status column**

```javascript
describe('schema V24: review_status column', () => {
  it('evidence_docs has review_status column after migration', () => {
    const info = db.prepare("PRAGMA table_info('evidence_docs')").all();
    const col = info.find(c => c.name === 'review_status');
    assert.ok(col, 'review_status column should exist');
    assert.equal(col.type, 'TEXT');
  });
});
```

**Step 2: Run test — FAIL (column doesn't exist)**

**Step 3: Add V24 migration to schema.ts**

After the V23 block, add:

```typescript
if (currentVersion < 24) {
  db.exec(`ALTER TABLE evidence_docs ADD COLUMN review_status TEXT`);
  db.pragma('user_version = 24');
}
```

**Step 4: Run test — PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F188): schema V24 — add review_status to evidence_docs [宪宪/Opus-46🐾]"
```

---

## Task 3: Orphan Edge Classifier + Dry-Run (AC-J2, AC-J3)

**Files:**
- Create: `packages/api/src/domains/memory/f188-orphan-edge-repair.ts`
- Test: `packages/api/test/memory/f188-orphan-edge-repair.test.js`
- Modify: `packages/api/src/routes/f163-audit-routes.ts` (add dry-run endpoint)

**Step 1: Write failing tests for orphan classifier**

Test cases for each classification bucket: `feature_ref_zero_pad`, `feature_ref_true_ghost`, `wikilink_code_artifact`, `wikilink_potential_doc`, `related_field_ghost`. Each test inserts known orphan edges into a test DB and verifies classification.

**Step 2: Run — FAIL**

**Step 3: Implement `classifyOrphanEdges(db)` and `dryRunOrphanRepair(db, opts)`**

Core logic:
1. Query all orphan edges (from/to not in evidence_docs)
2. For F-ref edges: try zero-pad → check evidence_docs + filesystem → classify
3. For wikilink edges: pattern-match code artifacts vs potential docs
4. For related edges: check target existence
5. Return `OrphanEdgeDryRunReport` with classifications, counts, SQL preview

**Step 4: Run — PASS**

**Step 5: Write failing test for dry-run API endpoint**

```javascript
it('GET /api/f163/orphan-edges/dry-run returns classification report', ...);
```

**Step 6: Add route to f163-audit-routes.ts**

**Step 7: Run — PASS**

**Step 8: Commit**

```bash
git commit -m "feat(F188): AC-J2/J3 orphan edge classifier + dry-run API [宪宪/Opus-46🐾]"
```

---

## Task 4: Orphan Edge Apply (AC-J4)

**Files:**
- Modify: `packages/api/src/domains/memory/f188-orphan-edge-repair.ts` (add apply function)
- Modify: `packages/api/src/routes/f163-audit-routes.ts` (add apply endpoint)
- Test: `packages/api/test/memory/f188-orphan-edge-repair.test.js` (add apply tests)

**Step 1: Write failing tests**

- backup table created
- zero-pad edges updated
- true ghost edges deleted (cross-checked against filesystem)
- wikilink_potential_doc NOT auto-deleted
- post-apply orphan count matches expected
- invariant: re-run computeOrphanEdges() returns reduced count

**Step 2: Run — FAIL**

**Step 3: Implement `applyOrphanRepair(db, dryRunReport, opts)`**

Safety sequence: backup → apply auto-fixable only → verify invariant

**Step 4: Run — PASS**

**Step 5: Add POST endpoint**

**Step 6: Commit**

```bash
git commit -m "feat(F188): AC-J4 orphan edge apply with backup + invariant check [宪宪/Opus-46🐾]"
```

---

## Task 5: Verification Debt Migration Dry-Run (AC-J6)

**Files:**
- Create: `packages/api/src/domains/memory/f188-verification-migration.ts`
- Test: `packages/api/test/memory/f188-verification-migration.test.js`
- Modify: `packages/api/src/routes/f163-audit-routes.ts` (add endpoint)

**Step 1: Write failing tests**

- kind=lesson + source_path matching `lessons/` or `docs/lessons/` or `lessons-learned.md` → `trusted_legacy`
- kind=feature + source_path matching `features/` or `docs/features/` → `trusted_legacy`
- kind=decision + source_path matching `decisions/` or `docs/decisions/` → `trusted_legacy`
- kind=plan + authority=constitutional → `needs_review` (anomaly, NOT trusted_legacy)
- collection-derived validated docs → `needs_review`
- observed docs → NULL (untouched)
- already verified docs → untouched
- dry-run output includes authority×kind×source_path matrix
- total = trusted_legacy + needs_review + observed_null + already_verified

**Step 2: Run — FAIL**

**Step 3: Implement `dryRunVerificationMigration(db)` + `applyVerificationMigration(db)`**

Uses the R4 SQL with dual source_path prefix matching.

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F188): AC-J6 verification debt migration dry-run + apply [宪宪/Opus-46🐾]"
```

---

## Task 6: Cat Verification Workflow MCP Tool (AC-J7)

**Files:**
- Create: `packages/api/src/domains/memory/f188-verification-workflow.ts`
- Test: `packages/api/test/memory/f188-verification-workflow.test.js`
- Modify: MCP tool registration (tool description + handler)

**Step 1: Write failing tests for each action**

| action | precondition | writes |
|--------|-------------|--------|
| `confirm` | review_status='needs_review' | review_status='reviewed', verified_at=NOW() |
| `mark_stale` from needs_review | review_status='needs_review' | review_status='needs_review', verified_at=NULL |
| `mark_stale` from trusted_legacy | review_status='trusted_legacy' | review_status='needs_review', verified_at=NULL |
| `escalate` | review_status='needs_review' | review_status='escalated' |
| `escalate` from trusted_legacy | review_status='trusted_legacy' | review_status='escalated' |
| `dismiss_review` | review_status='needs_review' | review_status=NULL |
| `confirm` from NULL | should reject (invalid precondition) |
| audit log written for each action | f163_logs entry with verification_action type |

**Step 2: Run — FAIL**

**Step 3: Implement `executeVerificationAction(db, action: VerificationAction)`**

Validates preconditions, writes review_status + verified_at, logs to f163_logs.

**Step 4: Run — PASS**

**Step 5: Wire up as MCP tool `cat_cafe_library_verify`**

**Step 6: Commit**

```bash
git commit -m "feat(F188): AC-J7 cat verification workflow MCP tool [宪宪/Opus-46🐾]"
```

---

## Task 7: F200 Integration Boundary Tests (AC-J8)

**Files:**
- Test: `packages/api/test/memory/f188-f200-boundary.test.js`
- Modify: `packages/api/src/domains/memory/f188-library-health.ts` (health report uses needs_review count)

**Step 1: Write boundary tests (negative assertions)**

```javascript
describe('F200 integration boundary (AC-J8)', () => {
  it('F200 RecallMetricsComputer does not write verified_at');
  it('F200 RecallMetricsComputer does not change authority');
  it('F200 RecallMetricsComputer does not change review_status');
  it('F188 does not write to anchor_recall_metrics');
  it('health report counts needs_review not verified_at IS NULL');
  it('needs_review with high consumed_count_30d sorts first in review queue');
});
```

**Step 2: Run — FAIL (health report still uses old query)**

**Step 3: Update `computeLibraryHealth` to use review_status-based counting**

Modify `f188-library-health.ts` to add a `verificationDebt` metric that counts `needs_review` instead of the old `verified_at IS NULL` heuristic.

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F188): AC-J8 F200 boundary tests + health report review_status counting [宪宪/Opus-46🐾]"
```

---

## Task 8: Semantics Spec Doc (AC-J1)

**Files:**
- The Design Gate document already covers AC-J1 content
- Modify: `docs/features/F188-library-stewardship.md` (add KD-13 recording the three-dimensional separation)

**Step 1: Add KD-13 to feature spec**

```markdown
- **KD-13 (Phase J)**: authority (治理层级) / verified_at (显式验证事件) / usage_signal (F200 消费) 三维分离。F200 consumption 不写 verified_at，不提升 authority。review_status 是 triage 状态，独立于 authority。Design Gate R4 通过。
```

**Step 2: Commit**

```bash
git commit -m "docs(F188): AC-J1 three-dimensional verification semantics spec [宪宪/Opus-46🐾]"
```

---

## Task 9: Dogfood Acceptance Report (AC-J9)

**Files:**
- Create: `docs/discussions/2026-05-21-f188-phase-j-dogfood-report.md`

**Step 1: Copy runtime evidence.sqlite to worktree**

```bash
cp ../cat-cafe-runtime/evidence.sqlite ./evidence-dogfood.sqlite
```

**Step 2: Run dry-runs on copy**

- Orphan edge dry-run → verify 201 classified correctly
- Verification migration dry-run → verify bucket counts match Design Gate predictions
- Apply orphan repair → verify count drops to ~10
- Apply verification migration → verify needs_review count

**Step 3: Write report with before/after evidence**

**Step 4: Commit report**

```bash
git commit -m "docs(F188): AC-J9 dogfood acceptance report [宪宪/Opus-46🐾]"
```

---

## Execution Order & Dependencies

```
Task 1 (AC-J5 edge prevention) ─────────────────────┐
Task 2 (schema V24) ────────────────────────────────┤
                                                     ├→ Task 3 (AC-J2/J3 orphan dry-run)
                                                     │   └→ Task 4 (AC-J4 orphan apply)
                                                     ├→ Task 5 (AC-J6 verification migration)
                                                     │   └→ Task 6 (AC-J7 verification workflow)
                                                     ├→ Task 7 (AC-J8 boundary tests)
Task 8 (AC-J1 semantics doc) ──── parallel ──────────┘
                                                     └→ Task 9 (AC-J9 dogfood) — last, needs all above
```

Tasks 1, 2, 8 have no dependencies and can be done first (in any order).
Tasks 3-7 depend on schema V24.
Task 9 depends on all implementation tasks being complete.

## Estimated Total: ~9.5 hours
