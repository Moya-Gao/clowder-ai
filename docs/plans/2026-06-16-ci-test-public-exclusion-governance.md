---
feature_ids: []
topics: [ci, test-public, governance, exclusions]
doc_kind: plan
created: 2026-06-16
updated: 2026-06-16
---

# CI `test:public` Exclusion Governance Implementation Plan

**Feature:** Protocol — `packages/api` `test:public` exclusion governance
**Goal:** Replace the opaque inline `grep -v` exclusion chain with a traceable, time-bounded registry that keeps the public gate usable without silently masking real regressions.
**Acceptance Criteria:**
- `test:public` no longer hardcodes exclusions inline in `packages/api/package.json`; it resolves them from a dedicated registry artifact.
- Every active exclusion entry has `match`, `category`, `reason`, `owner`, `introducedBy`, and `expiresOn`.
- Validation blocks malformed entries, expired entries, entries that match no current tests, and entries that classify a real product regression as permanent `source-only`.
- The current exclusion set is migrated losslessly, with parity tests proving the new resolver preserves the intended file list before cleanup work starts.
- Governance follow-up is phased: metadata + validation first, review/policy automation second, scheduled audit/reporting third.
**Architecture cell:** `harness-eval`
**Map delta:** none
**Map delta why:** This changes an existing public-gate control path and its validation scripts; it does not introduce a new ownership boundary.
**Architecture:** Move exclusion selection out of shell `grep -v` into a machine-readable registry plus a small Node resolver/validator. `test:public`, source-owned public gate, and pre-merge checks all consume the same resolver so policy lives in one place. Keep the resolved test list as a pure projection; only the registry itself is persisted.
**Tech Stack:** Node.js, JSON, existing package scripts, node:test, shell gate scripts.
**前端验证:** No

---

## Finish Line

The end state is not “fewer grep commands.” The end state is:

1. We can answer, from the repo, why any test is excluded from `test:public`.
2. Exclusions expire unless someone renews them explicitly.
3. CI stops treating real regressions as export-surface exceptions by default.

Not building in this plan:

- No first-pass GitHub bot that auto-assigns reviewers.
- No dashboard before the registry exists.
- No bulk promise to fix all 43 current exclusions in one PR.

## Truth Snapshot (2026-06-16)

- `packages/api/package.json` currently encodes `test:public` as a single shell pipeline with **43** `grep -v` exclusions.
- `packages/api/test/public-test-script.test.js` only guards one specific exclusion (`governance-pack.test`), not the registry shape or full policy.
- `Test (Public)` is consumed by both PR evidence and the source-owned open-source sync gate (`scripts/pre-merge-check.sh`, `scripts/sync-to-opensource.sh`).
- `capabilities-route.test.js` is currently excluded but no longer safely classifiable as “source-only”: a focused local run on 2026-06-16 failed on `realigns stale managed cat-cafe MCP paths to the stable main repo root on GET`, i.e. a real managed-MCP behavior regression, not an export-fixture absence.
- `CODEOWNERS` currently maps essentially everything to `@zts212653`, so CODEOWNERS alone cannot enforce cross-individual review for exclusion edits.

## Direction Choice

### Recommend

1. **Dedicated exclusion registry**
   - Use `packages/api/config/public-test-exclusions.json`.
   - Why: JSON is repo-readable, script-friendly, and avoids a build step for the public gate.

2. **Single resolver + validator**
   - Add `packages/api/scripts/resolve-public-test-files.mjs`.
   - It should enumerate test files, apply registry entries, validate policy, and print the final file list for `node --test`.

3. **Category-aware policy**
   - Minimum categories:
   - `source_only`
   - `private_fixture`
   - `flaky_or_perf`
   - `product_regression`
   - Why: `capabilities-route` shows that “excluded” is not a sufficient policy dimension.

4. **Phased hardening**
   - Phase A hardens metadata + correctness.
   - Phase B hardens PR/policy review flow.
   - Phase C adds scheduled audit/reporting and drives burn-down.

### Do Not Do First

1. **Do not start with reviewer auto-routing**
   - Current CODEOWNERS is single-owner and path-based review automation would create ceremony without traceability.
   - Metadata must exist before review automation has anything meaningful to enforce.

2. **Do not start with cron/dashboard**
   - A dashboard over opaque grep strings is decoration, not governance.
   - Build the registry first; reporting becomes trivial after that.

3. **Do not grandfather `product_regression` exclusions as permanent**
   - They may exist temporarily, but they need short TTL plus a linked fix owner.

## Stateful Object Gate

### Object Census

1. `public-test-exclusions.json`
   - Persisted state object. Canonical source of truth for exclusion policy.

2. Resolved public test file list
   - Pure projection from repo files minus active exclusions.
   - Must not be stored separately.

3. Validation report
   - Pure projection from the registry and filesystem.
   - May be printed/logged, but no extra persisted state is needed in Phase A.

### State × Event Table

| Object | State | Event | Next State | Lifecycle owner |
|---|---|---|---|---|
| exclusion entry | proposed | add with full metadata | active | `owner` field |
| exclusion entry | active | target test fixed / export gap removed | removed | `owner` field |
| exclusion entry | active | expiry date passes | expired | `owner` field |
| exclusion entry | expired | explicit renewal with new evidence | active | `owner` field |
| exclusion entry | active | reclassified from source-only to real bug | active(product_regression) | `owner` field |

旁路规则:

- Manual edits to the registry are allowed only through normal git changes plus validator pass.
- No fallback inline `grep -v` may remain after Phase A; dual truth sources would rot immediately.

### Invariants

- `INV-1`: Every active entry has a unique stable `id`.
- `INV-2`: Every active entry has non-empty `match`, `category`, `reason`, `owner`, `introducedBy`, and `expiresOn`.
- `INV-3`: Every active entry matches at least one current test path.
- `INV-4`: The resolved `test:public` file set is computed only from filesystem enumeration plus active registry entries.
- `INV-5`: `product_regression` entries require a near-term expiry and a fix reference; they cannot be indefinite waivers.

### Adversarial Scenarios

- A regex typo excludes too many tests.
- A renamed/deleted test leaves a stale entry that still “looks valid.”
- A real regression is mislabeled as `source_only`.
- Two PRs add overlapping entries for the same file pattern.
- The registry and shell gate diverge because one consumer still uses the old inline list.

Each scenario needs a dedicated regression test in Phase A or B.

## Phase Plan

### Phase A — Normalize and lock the registry

**Purpose:** Create the machine-readable truth source and make it impossible to silently edit exclusions without metadata.

**Files:**
- Create: `packages/api/config/public-test-exclusions.json`
- Create: `packages/api/scripts/resolve-public-test-files.mjs`
- Create: `packages/api/test/public-test-exclusions.test.js`
- Modify: `packages/api/package.json`
- Modify: `packages/api/test/public-test-script.test.js`

**Step 1: Write failing tests**
- Add a parity test that loads the current 43 exclusions and asserts the resolver reproduces the existing selected file list.
- Add validator tests for:
  - missing required metadata
  - expired entry
  - zero-match stale entry
  - over-broad match that removes multiple unrelated files

**Step 2: Run tests to verify failure**
- Run: `cd packages/api && node --test test/public-test-script.test.js test/public-test-exclusions.test.js`
- Expected: FAIL because the resolver/registry does not exist yet.

**Step 3: Write minimal implementation**
- Move exclusions into JSON entries shaped like:

```json
{
  "id": "capabilities-route",
  "match": "capabilities-route\\.test",
  "category": "product_regression",
  "reason": "Managed MCP path realignment still fails in public gate",
  "owner": "@zts212653",
  "introducedBy": "e9bb56052",
  "expiresOn": "2026-06-23"
}
```

- The resolver:
  - enumerates `test/*.test.js` and `test/**/*.test.js`
  - validates all registry entries
  - prints the final file list for `node --test`
- Replace the inline `grep -v` chain in `test:public` with the resolver.

**Step 4: Run tests to verify pass**
- Run: `cd packages/api && node --test test/public-test-script.test.js test/public-test-exclusions.test.js`
- Run: `pnpm --filter @cat-cafe/api run test:public`
- Expected: PASS with file-selection parity preserved.

**Step 5: Migration note**
- Seed all current legacy entries with `introducedBy` commit evidence and an explicit owner/expiry during migration.
- Do not leave placeholder “TODO owner” metadata; that would institutionalize non-ownership.

### Phase B — Gate PR edits and classify risk correctly

**Purpose:** Prevent exclusion edits from bypassing review discipline and distinguish temporary waivers from legitimate source-only gaps.

**Files:**
- Modify: `scripts/pre-merge-check.sh`
- Modify: `scripts/pre-merge-check.test.mjs`
- Modify: `scripts/sync-to-opensource.sh`
- Modify: `scripts/sync-to-opensource-public-launch.test.mjs`
- Modify: `packages/api/test/public-test-exclusions.test.js`
- Optional: `CODEOWNERS` (only if review routing meaningfully improves)

**Step 1: Write failing tests**
- Add checks that fail when:
  - an exclusion entry is expired
  - a `product_regression` entry has no fix reference or uses a long TTL
  - registry edits bypass shared validation in pre-merge/public-sync paths

**Step 2: Implement**
- Ensure both `pre-merge-check` and source-owned public gate call the same validator.
- Add a policy rule:
  - `source_only` / `private_fixture` can live longer but still expire
  - `flaky_or_perf` and `product_regression` must expire quickly

**Step 3: Review-policy decision**
- Keep cross-individual review as a **process requirement** first.
- Only add path-based automation if it can verify something real.
- Current `CODEOWNERS` does not satisfy this by itself; don’t pretend it does.

**Step 4: Verification**
- Run: `node --test scripts/pre-merge-check.test.mjs scripts/sync-to-opensource-public-launch.test.mjs`
- Run: `pnpm --filter @cat-cafe/api run test:public`

### Phase C — Audit loop and burn-down

**Purpose:** Turn the registry into an active cleanup program instead of a permanent graveyard.

**Files:**
- Create: `packages/api/scripts/report-public-test-exclusions.mjs`
- Create: `packages/api/test/public-test-exclusion-report.test.js`
- Optional: scheduled caller under existing eval/cron conventions
- Optional: docs/report artifact path if the team wants persisted snapshots

**Step 1: Write failing tests**
- Report groups exclusions by category, owner, and days-to-expiry.
- Report flags likely cleanup candidates:
  - file now passes in isolation
  - entry matches a deleted/renamed file
  - category says `product_regression`

**Step 2: Implement**
- Emit a plain-text or JSON report consumable by humans and future cron.
- If cron is added, it should only report/escalate; it should not mutate the registry.

**Step 3: Start burn-down**
- Triage oldest/highest-risk entries first.
- `capabilities-route` should be an early candidate because current evidence shows real behavior coverage hiding behind the exclusion.

## Recommended First PR Scope

Keep the first PR to **Phase A only**:

- registry
- resolver
- parity tests
- `test:public` wiring

Do not mix in:

- reviewer automation
- cron
- broad exclusion cleanup

That first PR is the smallest change that creates a real governance surface.

## Open Questions

### Technical OQ

1. Should `match` allow only suffix regexes, or full regex?
   - Recommendation: start with anchored suffix-style regex/string patterns only; full regex is harder to review safely.

2. Should the registry live in `packages/api/config/` or repo-root `config/`?
   - Recommendation: keep it in `packages/api/config/` because `test:public` is package-local and already owned there.

### Value OQ

1. How short should TTL be for `product_regression` exclusions?
   - Recommendation: 7 days default, renewal requires fresh evidence.
   - Rollback cost: trivial; metadata-only.
   - Decision needed: tolerance for temporary masked behavior in public gate versus PR friction.
