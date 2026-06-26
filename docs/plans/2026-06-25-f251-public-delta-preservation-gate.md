---
feature_ids: [F251]
related_features: [F059, F116, F168, F238]
topics: [open-source, outbound-sync, provenance, community, harness]
doc_kind: implementation-plan
created: 2026-06-25
status: spec
owner: codex
---

# F251 Public Target Delta Preservation Gate Implementation Plan

**Feature:** F251 — `docs/features/F251-public-delta-preservation-gate.md`
**Goal:** Prevent full outbound sync from erasing clowder-ai changes that landed after the last sync baseline.
**Acceptance Criteria:**
- AC-1: Full sync fails before touching the real `clowder-ai` target when any sync-managed path has an unpreserved target delta.
- AC-2: The gate runs in public byte-space after cat-cafe export/sanitization and before `sync_filtered_into_target "$TARGET_DIR"`.
- AC-3: The gate emits machine-readable JSON and human-readable Markdown reports with per-path classification.
- AC-4: Override requires an explicit reason, is written to provenance/report output, and triggers a CVO approval alarm when one sync overrides more than 3 blocked items.
- AC-5: Known home-side behavior regressions are tracked separately through a Community Contract Registry v0; the public delta gate does not claim to solve unregistered behavior.
- AC-6: At least one historical mindfn/Wu Lang incident from the A ledger is reconstructed as a dry-run fixture; V1 must block it or the gate is not accepted.
- AC-7: One month after V1 deploy, retroactive dry-run eval must show C1a/C1b historical incidents block; any miss reopens gate design.
**Architecture cell:** Draft open-source sync pipeline extension; final feature cell pending CVO signoff.
**Map delta:** none
**Map delta why:** This tightens the existing outbound sync pipeline and does not add a new product/runtime ownership cell.
**Architecture:** Add a fail-closed public target delta preservation gate to the existing `sync-to-opensource.sh` flow. Keep the current export and rsync implementation in V1, but prove that rsync will not erase clowder-ai HEAD deltas before it can run.
**Tech Stack:** Bash, Node.js ESM scripts, git CLI, JSON/Markdown reports.
**前端验证:** No.

---

## Finish Line

Before a full sync can write to the real `clowder-ai` checkout, cat-cafe must prove this statement:

> For every sync-managed path changed on `clowder-ai` since the last landed sync commit, the current public export either preserves the same content, explicitly excludes the path as target-owned/generated, or carries a recorded human override.

This is stricter than a normal "3-way overlap conflict" check. With `rsync --delete`, a target-only delta is still dangerous: if `theirs != base` and `ours == base`, rsync will silently revert the community delta even though cat-cafe did not touch that file in this cycle.

## Anchor Provenance

CVO assigned **F251** as the dedicated feature anchor for this work on 2026-06-25 (directive: "用最新的f251比较好吧"). F059 ("Cat Café 开源计划", done 2026-03-30) remains the broader open-source umbrella and is recorded under `related_features`; this plan is not a phase of F059. Future renames require CVO re-signoff per `feedback_feat_anchor_needs_cvo_explicit_signoff.md`.

## Decision Packet

**TL;DR:** Ship V1 as a hard gate, not a warning. Keep rsync for now, but make it impossible to run real sync when clowder-ai has unpreserved target deltas.

**Recommendation:** Fail closed by default. Allow override only with a written reason; if a single sync needs more than 3 overrides, require CVO approval before proceeding.

**Rollback cost:** Low. The gate is a pre-sync script and can be reverted in one commit. It does not rewrite either repository, change GitHub relationships, or change the export transform.

**Value question for CVO:** Do we accept more blocked sync attempts in exchange for no longer silently erasing community-maintained deltas?

**Technical questions for implementation cats:** Baseline fallback order, generated-file allowlist shape, and V2 hunk-level diff mechanics are implementation details and should be self-decided in the feature worktree.

## Non-Goals

- Do not turn `clowder-ai` into a GitHub fork of `cat-cafe`.
- Do not rewrite public history or migrate stars/issues/PRs.
- Do not replace `rsync --delete` in V1.
- Do not upgrade `scripts/reverse-sanitizer.mjs` from detect-only into a bidirectional transform engine for V1.
- Do not auto-resolve conflicts.
- Do not claim to prevent home-side regressions where clowder-ai had no target delta. Those require explicit contracts and tests.

## Incident Taxonomy

Use this taxonomy for mindfn/Wu Lang issue quantification and for gate evals. `gateCoverage` is multi-select because one incident can expose multiple missing guard layers.

| Code | Meaning | Gate Coverage |
| --- | --- | --- |
| C0 | Not a sync overwrite/regression incident | `not_sync_related` |
| C1a | Community/user delta overwritten; reporter waited for us to fix | `covered_by_v1_public_delta_gate` when target delta existed |
| C1b | Maintainer-level contributor quickfixed clowder-ai directly after our overwrite | `covered_by_v1_public_delta_gate` plus severity downgrade from C1a |
| C2 | Ledger false complete / incomplete absorption | `covered_by_v1_public_delta_gate`, `requires_ledger_hardening` |
| C3 | Home-side regression exported to public; clowder-ai had no independent delta | `requires_contract_registry` |
| C4 | Export/sanitizer regression | `requires_transform_gate` |
| C5 | Release/package/docs drift after sync | `requires_release_gate` |

Evidence threshold:
- Issue title alone is only a candidate.
- Hard attribution requires issue body/comment text naming a sync/regression/introduced-by source, a linked PR/closing commit, or file/commit diff proof.
- Table fields for analysis: `issue`, `reporter`, `symptom`, `class`, `gateCoverage[]`, `introducedBy`, `fixedBy`, `affectedPaths[]`, `proofLink`, `contractGap`.

## A/B Evidence Contract

A (mindfn/Wu Lang incident quantification) is not a separate retrospective document. It feeds B directly through a normalized incident ledger.

```ts
interface SyncIncidentLedger {
  version: 1;
  generatedAt: string;
  entries: SyncIncidentEntry[];
}

interface SyncIncidentEntry {
  issue: { repo: 'zts212653/clowder-ai'; number: number };
  reporter: string;
  symptom: string;
  classes: Array<'C0' | 'C1a' | 'C1b' | 'C2' | 'C3' | 'C4' | 'C5'>;
  gateCoverage: string[];
  affectedPaths: string[];
  affectedModules: string[];
  publicBehaviorId?: string;
  introducedBy?: { type: 'sync-pr' | 'commit' | 'unknown'; ref: string };
  fixedBy?: { type: 'pr' | 'commit' | 'manual'; ref: string };
  proofLinks: string[];
  contractGap?: string;
}
```

Rules:
- Every `C1*` or `C2` row must list `affectedPaths[]`; otherwise V1 cannot be validated against it.
- Every `C3` row must either create a Community Contract candidate or explicitly explain why the behavior is not contract-worthy.
- At least one high-confidence historical row becomes a dry-run regression fixture for the gate acceptance suite.

## Terminal Schema

```ts
type PublicDeltaGateMode =
  | 'source-only-pass'
  | 'equivalent-preserved-pass'
  | 'target-only-would-revert-block'
  | 'both-changed-conflict-block'
  | 'target-added-would-delete-block'
  | 'delete-or-rename-block'
  | 'binary-block'
  | 'target-owned-pass'
  | 'generated-or-provenance-pass'
  | 'override-pass';

interface PublicDeltaGateReport {
  version: 1;
  generatedAt: string;
  sourceRepo: 'cat-cafe';
  targetRepo: 'clowder-ai';
  sourceHead: string;
  targetHead: string;
  baselineCommit: string;
  baselineSource: 'sync-tag' | 'landed-sync-commit' | 'explicit';
  syncModule: string;
  summary: {
    passCount: number;
    blockCount: number;
    revertCandidateCount: number;
    conflictCandidateCount: number;
    deleteCandidateCount: number;
    overrideCount: number;
    cvoApprovalRequired: boolean;
  };
  items: PublicDeltaGateItem[];
}

interface PublicDeltaGateItem {
  path: string;
  publicBehaviorId?: string;
  mode: PublicDeltaGateMode;
  risk: 'pass' | 'block' | 'override';
  reason: string;
  baseBlob: string | null;
  theirsBlob: string | null;
  oursBlob: string | null;
  suggestedAction: 'absorb' | 'preserve-target' | 'manual-review' | 'allow';
  linkedLedgerEntries: Array<{ prNumber?: number; decision?: string; issue?: number }>;
  overrideReason?: string;
}
```

Community Contract Registry v0:

```ts
interface CommunityContractRegistry {
  version: 1;
  contracts: CommunityContract[];
}

interface CommunityContract {
  id: string;
  status: 'active' | 'retired';
  source: { repo: 'zts212653/clowder-ai'; type: 'issue' | 'pr'; number: number };
  classes: Array<'C1a' | 'C1b' | 'C2' | 'C3' | 'C4' | 'C5'>;
  gateCoverage: string[];
  affectedPaths: string[];
  behavior: string;
  proof:
    | { type: 'command'; command: string; expected: string }
    | { type: 'manual'; evidence: string };
  owner: 'opensource-ops';
  lastVerifiedSync?: string;
}
```

## Stateful Object Gate

Lifecycle objects:

| Object | Lifecycle Owner | Create | Update | Retire |
| --- | --- | --- | --- | --- |
| Sync baseline | `publish-sync-tag.sh` / landed sync PR | Sync PR lands and tag is published | Next sync lands | Never delete; old tags remain provenance |
| Gate report | `check-sync-public-delta-gate.mjs` | Each dry-run/full sync | Immutable after run | Can be archived, not rewritten |
| Override decision | Sync operator + CVO when threshold trips | Operator supplies reason | Written into report/provenance | Retained for eval |
| Community contract | Open-source ops maintainer | Incident accepted as contract-worthy | Verification status per sync | Retired only with linked rationale |

Invariants:

- INV-1: Baseline commit is the latest landed sync commit on clowder-ai, not `.sync-provenance.json.target_head_sha` from that commit. `target_head_sha` is the pre-sync parent metadata and is useful for validation, not as the next comparison base.
- INV-2: Real target sync is unreachable when `blockCount > 0` and no approved override exists.
- INV-3: `overrideCount > 3` sets `cvoApprovalRequired=true`; without approval the script exits nonzero.
- INV-4: A target-only delta in a sync-managed path blocks unless `oursBlob === theirsBlob`, the path is target-owned/generated/provenance, or there is an override.
- INV-5: Binary, delete, and rename cases block in V1.
- INV-6: Reports are append-only evidence for eval; do not rewrite a report after sync result is known.

Adversarial scenarios:

- Crash after report generation but before sync: rerun must regenerate or explicitly reuse the report against the same source/target SHAs.
- Stale target checkout: script must fetch target remote before resolving `targetHead` and baseline.
- Missing baseline tag: fail closed unless an explicit baseline commit is supplied.
- Override abuse: repeated overrides trigger CVO approval and eval telemetry.
- Generated/provenance noise: allowlist only paths proven generated or target-owned; broad globs require tests.

## Implementation Tasks

### Task 0: Normalize A incident ledger

> Guardrail: Task 0 produces the historical replay input for AC-A5. Do not confuse Task 1 synthetic classifier fixtures with the real #720/#726 dry-run replay fixture.

**Files:**
- Create: `docs/ops/community-sync-incident-ledger.json`
- Test: `scripts/check-community-sync-incident-ledger.test.mjs`

**Step 1: Write schema tests**

Assert that every non-C0 entry has `proofLinks[]`, every `C1*`/`C2` entry has `affectedPaths[]`, and every `C3` entry has either `contractGap` or a linked Community Contract candidate.

**Step 2: Implement ledger validation**

Keep the validator read-only. It should validate A's output without trying to infer classifications from issue titles.

**Step 3: Select historical dry-run fixture**

Pick one high-confidence issue from A's first batch, initially expected to be #723 or #991 if path evidence is sufficient. Reconstruct the relevant `base/current/exported` tree state in a fixture and require the V1 gate to block.

Initial replay candidate:
- clowder-ai sync PR #720 base + #720 head + the matching cat-cafe export candidate from that sync window.
- Expected report: 17 F190 visual paths classified as REVERT candidates, not generic conflicts.
- A may replace or supplement this with #991 / #966 / #959 / #1025 once body + linked PR/commit evidence is complete.

### Task 1: Pure classifier and fixtures

> **Status**: ✅ merged via PR #2554 (`606cd63d`) on 2026-06-25. Follow-up tasks still need to wire the classifier into baseline resolution, report output, and `sync-to-opensource.sh`.

**Files:**
- Create: `scripts/check-sync-public-delta-gate.mjs`
- Create: `scripts/check-sync-public-delta-gate.test.mjs`

**Step 1: Write failing tests**

Cover:
- `theirs == base && ours != base` passes as `source-only-pass`
- `theirs != base && ours == theirs` passes as `equivalent-preserved-pass`
- `theirs != base && ours == base` blocks as `target-only-would-revert-block`
- `theirs != base && ours != base && ours != theirs` blocks as `both-changed-conflict-block`
- target-added missing from ours blocks as `target-added-would-delete-block`
- omitted or `undefined` blob metadata fails closed; explicit `null` is required to represent proven path absence
- binary/delete/rename blocks
- override reasons must be non-empty after trimming
- `.sync-provenance.json` passes as generated/provenance only when blob metadata is explicitly present
- target-owned path passes only when blob metadata is explicitly present and loaded from the same target-owned source used by sync

Run:

```bash
node --test scripts/check-sync-public-delta-gate.test.mjs
```

Expected: FAIL because the script does not exist.

**Step 2: Implement classifier**

Keep the core classifier pure: input path metadata + three blob IDs; output `PublicDeltaGateItem`.

**Step 3: Run tests green**

```bash
node --test scripts/check-sync-public-delta-gate.test.mjs
```

Expected: PASS.

### Task 2: Baseline resolver

> **Status**: ✅ merged via PR #2566 (`3eb52c60`) on 2026-06-25. The resolver now handles explicit baselines, reachable mirrored `sync/*` refs, landed sync provenance, stale local refs, and shallow target repos. Follow-up tasks still need report output and `sync-to-opensource.sh` wiring before the gate protects real syncs.

> Guardrail: Task 2 is the semantic hinge for the whole gate. A correct classifier with the wrong `base` commit still produces placebo safety. Baseline selection must preserve KD-2/INV-1 and reject missing or ambiguous baseline evidence.

**Files:**
- Modify: `scripts/check-sync-public-delta-gate.mjs`
- Test: `scripts/check-sync-public-delta-gate.test.mjs`

**Step 1: Write failing git-fixture tests**

Create temporary git repos in the test:
- Commit `base sync` with `.sync-provenance.json`.
- Tag it as `sync/YYYY-MM-DD-HHMMSS`.
- Add a target commit after the tag.
- Assert baseline resolves to the sync tag commit, not `.sync-provenance.json.target_head_sha`.

**Step 2: Implement resolver**

Resolution order:
1. `--baseline <sha>` explicit CLI argument.
2. Latest reachable `sync/*` tag in target repo.
3. Latest first-parent commit containing `.sync-provenance.json` with `source_commit_sha`.
4. Fail closed.

**Step 3: Validate stale checkout behavior**

The CLI must run `git fetch origin main --tags` unless `--no-fetch` is supplied for tests.

### Task 3: Report writer

**Files:**
- Modify: `scripts/check-sync-public-delta-gate.mjs`
- Test: `scripts/check-sync-public-delta-gate.test.mjs`

**Step 1: Write failing tests**

Assert JSON schema fields and Markdown sections:
- Summary table
- Revert / Conflict / Delete candidate counts
- Blocked items
- Overrides
- Suggested actions
- Baseline/source/target SHAs

**Step 2: Implement output**

Default paths:
- JSON: `docs/ops/sync-public-delta-gate-{timestamp}.json`
- Markdown: `docs/ops/sync-public-delta-gate-{timestamp}.md`

The sync script may also pass temp output paths to avoid polluting `docs/ops` during dry-run tests.

### Task 4: Wire into `sync-to-opensource.sh`

**Files:**
- Modify: `scripts/sync-to-opensource.sh`
- Test: `scripts/check-env-port-drift.test.mjs`

**Step 1: Write failing source-order test**

Assert the new gate call appears after filtered export/provenance generation and before real target sync:
- before `sync_filtered_into_target "$TARGET_DIR"`
- before any code path that mutates the real target

**Step 2: Add script invocation**

Call:

```bash
node scripts/check-sync-public-delta-gate.mjs \
  --source-dir "$SOURCE_DIR" \
  --target-dir "$TARGET_DIR" \
  --filtered-dir "$FILTERED_DIR" \
  --sync-module "$SYNC_MODULE"
```

For `--dry-run`, run the gate and print report paths.

**Step 3: Override flags**

Add:
- `--allow-public-delta-overwrite`
- `--public-delta-override-reason "text"`
- `--cvo-approved-public-delta-overwrite`

Rules:
- Override without reason exits nonzero.
- Override count > 3 without CVO approval exits nonzero.
- All overrides are written to report output.

### Task 5: Community Contract Registry v0

**Files:**
- Create: `docs/ops/community-contracts.json`
- Create: `scripts/check-community-contracts.mjs`
- Create: `scripts/check-community-contracts.test.mjs`

**Step 1: Write schema tests**

Assert required fields, unique ids, active/retired statuses, and valid source references.

**Step 2: Implement command runner**

V0 only runs explicit `proof.type === 'command'` contracts whose `affectedPaths` intersect the sync export diff. Manual contracts are reported as checklist blockers, not silently passed.

**Step 3: Wire as warning first**

Do not block all syncs on day one for manual contracts. Emit report and require explicit operator acknowledgement. After A quantification identifies high-value contracts, promote selected contracts to hard blockers.

### Task 6: SOP and eval loop

**Files:**
- Modify: `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
- Modify: `cat-cafe-skills/opensource-ops/SKILL.md`
- Optional Modify: `docs/ops/opensource-intake-ledger.json` only if new metadata is needed

**Step 1: Update soft layer**

Replace the Step 1.5 manual-only Community Diff Guard wording with:
- tool gate is mandatory
- manual ledger review is explanatory/supporting evidence
- target-only public delta is a block even when cat-cafe did not touch the file

**Step 2: Add hard layer checks**

Run:

```bash
node --test scripts/check-community-sync-incident-ledger.test.mjs
node --test scripts/check-sync-public-delta-gate.test.mjs
node --test scripts/check-community-contracts.test.mjs
pnpm check
```

**Step 3: Add eval loop**

After each sync, record:
- number of public delta blocks
- number of overrides
- whether CVO approval was required
- post-sync incidents by C0-C5 class and `gateCoverage[]`

Success metric for V1: C1/C2 incidents that involve an existing clowder-ai target delta should drop to zero after deployment.

## Acceptance Test Matrix

| Scenario | Expected |
| --- | --- |
| Source-only change in sync-managed file | PASS |
| clowder-ai target-only change in sync-managed file; export lacks it | BLOCK |
| clowder-ai target-only change already appears identically in export | PASS |
| Both sides changed same text file differently | BLOCK |
| Target added file that export would delete | BLOCK |
| Target deleted file that export would recreate | BLOCK |
| Binary changed since baseline | BLOCK |
| Path is target-owned and sync preserve logic covers it | PASS |
| `.sync-provenance.json` differs | PASS as provenance |
| Missing baseline | BLOCK |
| Override count 1 with reason | PASS with override report |
| Override count 4 without CVO approval | BLOCK |
| Reconstructed historical incident from A ledger | BLOCK unless `oursBlob === theirsBlob` or explicit override exists |

## Open Questions

**Technical OQ (self-decide during implementation):**
- Exact generated/provenance allowlist source.
- Whether report files should always live in `docs/ops` or use temp paths during dry-run.
- Whether V2 hunk-level diff should use `git merge-file`, `git diff --word-diff`, or a custom parser.

**Value OQ (CVO):**
- Confirm the override threshold: recommended `> 3` blocked items requires CVO approval.
- Decide whether manual Community Contract Registry entries can become hard release blockers before they have automated proof.
