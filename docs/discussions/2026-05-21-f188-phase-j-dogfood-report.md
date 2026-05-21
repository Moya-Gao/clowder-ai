# F188 Phase J: Dogfood Acceptance Report (AC-J9)

**Date:** 2026-05-21
**DB source:** `cat-cafe-runtime/evidence.sqlite` (338 MB, snapshot at 20:48)
**Author:** 布偶猫/Opus-46

## Baseline (before repair)

| Metric | Count |
|--------|-------|
| Total docs | 2,137 |
| Total edges | 4,193 |
| Orphan edges (dangling to_anchor) | 201 |
| Unverified docs (authority!=observed, verified_at IS NULL, active) | 591 |
| review_status distribution | all NULL (2,137) |

### Authority distribution

| Authority | Count |
|-----------|-------|
| observed | 1,412 |
| candidate | 445 |
| validated | 222 |
| constitutional | 58 |

## Orphan Edge Dry-Run

| Classification | Count | Action |
|----------------|-------|--------|
| feature_ref_zero_pad | 164 | update (e.g. F20→F020) |
| feature_ref_true_ghost | 7 | delete (F999, F340 etc.) |
| wikilink_code_artifact | 1 | delete (architecture) |
| wikilink_potential_doc | 26 | review only |
| related_field_ghost | 3 | delete (F32-b, F340) |
| **Total** | **201** | |
| **Auto-fixable** | **175** (87%) | |
| **Review needed** | **26** (13%) | |

### Dogfood discovery: zero-pad collision bug

During dogfood, `applyOrphanRepair` crashed with `SQLITE_CONSTRAINT_PRIMARYKEY` when updating `F10→F010` because the canonical edge `(F002, F010, feature_ref)` already existed. Fixed in commit `103bfd425`: when canonical edge already exists, delete the orphan row instead of updating.

## Orphan Edge After Repair

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Orphan edges | 201 | 26 | -175 (-87%) |
| Remaining type | — | wikilink_potential_doc (26) | review items only |

All 26 remaining orphans are `wikilink_potential_doc` — these are intentionally kept for human review (e.g., `"$rel" == "$owned"*`, `Library Architecture`). No CVO intervention needed for these; they are cat-triageable.

## Verification Migration Dry-Run

| Bucket | Count | Description |
|--------|-------|-------------|
| trusted_legacy | 279 | lesson/feature/decision in canonical paths |
| needs_review | 446 | validated/constitutional/candidate not in whitelist |
| observed (NULL) | 1,412 | thread-derived, untouched |
| already_verified | 0 | no prior review_status set |
| **Total** | **2,137** | |

### After migration applied

| review_status | Count |
|---------------|-------|
| NULL | 1,412 (observed, untouched) |
| needs_review | 446 |
| trusted_legacy | 279 |

### Verification debt vs Design Gate predictions

Design Gate R4 predicted ~724 unverified. Actual: 591 with `authority != observed AND verified_at IS NULL`. The delta (133) is accounted for by candidate-authority docs that the Design Gate counted but are actually observed-adjacent (thread summaries with candidate authority). Migration correctly assigns these to needs_review, not trusted_legacy.

## CVO Intervention Assessment

| Item | Needs CVO? | Why |
|------|-----------|-----|
| 175 auto-fixable orphans | No | Mechanical zero-pad + ghost deletion |
| 26 review orphans | No | Cat-triageable wikilink targets |
| 279 trusted_legacy docs | No | Whitelisted kind×path, low risk |
| 446 needs_review docs | No for bulk | Cat batch-confirm workflow handles this |
| Specific high-risk items | TBD | Cats can escalate individual items via `escalate` action |

**Conclusion:** No CVO intervention required for initial rollout. The cat verification workflow (AC-J7) provides escalation for edge cases.

## Evidence Files

- Orphan dry-run: `dryRunOrphanRepair(db)` on runtime copy
- Verification dry-run: `dryRunVerificationMigration(db)` on runtime copy
- Apply verification: `applyVerificationMigration(db)` + `applyOrphanRepair(db)` on writable copy
- Bug discovered and fixed: commit `103bfd425` (zero-pad collision)
