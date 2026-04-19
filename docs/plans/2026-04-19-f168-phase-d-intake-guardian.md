# F168 Phase D — Intake Guardian Hardline

**Feature:** F168 — `docs/features/F168-community-ops-board.md`
**Goal:** 把铲屎官的"你去守护一下"变成系统自动触发：intake 完成 + reviewer 放行 → 自动选 guardian → sign-off 作为 merge 硬门禁
**Acceptance Criteria:**
- AC-D1: Intake 完成 + reviewer 放行 → 系统自动 @ guardian 猫
- AC-D2: Guardian 从 roster 自动选择（≠ author ≠ reviewer）
- AC-D3: 缺 guardian sign-off → merge-gate 自动拦截
- AC-D4: Intake checklist 每项需要证据，系统验证非人工叮嘱
- AC-A1/A2/A3: Close out — skill infrastructure already complete (direction-card-template.md + triage-complete endpoint + create_rich_block MCP + multi_mention MCP)
**Architecture:** GuardianMatcher (based on reviewer-matcher.ts) selects guardian; new `intake-guardian` routes manage lifecycle; WorkflowSop.checks.visionGuardDone tracks state; merge-gate skill checks guardian sign-off before Step 7
**Tech Stack:** TypeScript, node:test, Fastify, cat-config.json roster, WorkflowSop
**前端验证:** No — backend + skill only

---

## What we're NOT building

- Auto-detection of "intake complete" from git events (cats explicitly call the endpoint)
- Intake checklist UI in the frontend (Phase E or later)
- Guardian chat thread creation (guardian works in existing community system thread)
- Auto-retry if guardian is unavailable (degrade + log, caller handles)

## Terminal Schema

```typescript
// New: Guardian assignment result
interface GuardianMatchResult {
  guardian: CatId;
  isDegraded: boolean;
  degradeReason?: string;
  candidates: readonly CatId[];
}

// New: Guardian assignment tracking (stored in CommunityIssueItem or WorkflowSop)
interface GuardianAssignment {
  guardianCatId: string;
  requestedAt: number;
  requestedBy: string;         // cat that triggered guardian
  signedOff: boolean;
  signedOffAt?: number;
  evidence?: IntakeChecklistItem[];
}

// New: Intake checklist item with evidence
interface IntakeChecklistItem {
  id: string;                  // e.g. 'vision-alignment', 'test-coverage', 'doc-sync'
  label: string;
  required: boolean;
  evidence?: string;           // URL, test output ref, or description
  verifiedAt?: number;
  verifiedBy?: string;         // cat that verified
}
```

---

## Task 1: GuardianMatcher — Cat Selection Logic

**Files:**
- Create: `packages/api/src/domains/community/GuardianMatcher.ts`
- Test: `packages/api/test/guardian-matcher.test.js`

Based on `reviewer-matcher.ts` but with key differences:
- **Two exclusions**: both author AND reviewer (not just author)
- **No role requirement**: any cat can be guardian (don't filter by 'peer-reviewer')
- Same sorting: prefer cross-family → lead → thread activity

**Step 1: Write failing tests**

```javascript
// guardian-matcher.test.js
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

const { resolveGuardian } = await import('../dist/domains/community/GuardianMatcher.js');

describe('GuardianMatcher', () => {
  test('excludes both author and reviewer', async () => {
    const result = await resolveGuardian({ author: 'opus', reviewer: 'codex' });
    assert.notEqual(result.guardian, 'opus');
    assert.notEqual(result.guardian, 'codex');
  });

  test('prefers different family from author', async () => {
    const result = await resolveGuardian({ author: 'opus', reviewer: 'codex' });
    // opus=ragdoll, codex=maine-coon → should pick siamese/other family
    assert.equal(result.isDegraded, false);
  });

  test('degrades to same family if no cross-family available', async () => {
    // When all cross-family cats are excluded/unavailable
    const result = await resolveGuardian({
      author: 'opus',
      reviewer: 'codex',
      policy: { requireDifferentFamily: false },
    });
    assert.ok(result.guardian);
  });

  test('does not require peer-reviewer role', async () => {
    // gemini has 'designer' role, not 'peer-reviewer' — should still be eligible
    const result = await resolveGuardian({ author: 'opus', reviewer: 'codex' });
    assert.ok(result.candidates.length > 0);
  });

  test('returns fallback when no candidates', async () => {
    const result = await resolveGuardian({ author: 'opus', reviewer: 'opus' });
    assert.ok(result.guardian);
    assert.equal(result.isDegraded, true);
  });
});
```

**Step 2:** Run tests → verify they fail (module not found)

**Step 3: Implement GuardianMatcher**

```typescript
// GuardianMatcher.ts
import type { CatId, ReviewPolicy, Roster } from '@cat-cafe/shared';
import { createCatId } from '@cat-cafe/shared';
import { getDefaultCatId, getReviewPolicy, getRoster } from '../../config/cat-config-loader.js';

export interface GuardianMatchOptions {
  author: CatId;
  reviewer: CatId;
  policy?: Partial<ReviewPolicy>;
  threadActivity?: Record<string, number>;
}

export interface GuardianMatchResult {
  guardian: CatId;
  isDegraded: boolean;
  degradeReason?: string;
  candidates: readonly CatId[];
}

export async function resolveGuardian(options: GuardianMatchOptions): Promise<GuardianMatchResult> {
  const roster = getRoster();
  const defaultPolicy = getReviewPolicy();
  const policy: ReviewPolicy = { ...defaultPolicy, ...options.policy };
  const authorId = options.author as string;
  const reviewerId = options.reviewer as string;
  const authorEntry = roster[authorId];

  if (!authorEntry) {
    return { guardian: getDefaultCatId(), isDegraded: false, candidates: [] };
  }

  // Key difference: exclude BOTH author and reviewer, NO role requirement
  const eligible = Object.entries(roster).filter(
    ([id, entry]) => id !== authorId && id !== reviewerId && entry.available !== false,
  );

  const differentFamily = eligible.filter(([_, e]) => e.family !== authorEntry.family);
  const sameFamily = eligible.filter(([_, e]) => e.family === authorEntry.family);
  const activity = options.threadActivity ?? {};

  const sort = (arr: Array<[string, Roster[string]]>) =>
    [...arr].sort((a, b) => {
      const actDiff = (activity[b[0]] ?? 0) - (activity[a[0]] ?? 0);
      if (actDiff !== 0) return actDiff;
      if (policy.preferLead) {
        if (b[1].lead && !a[1].lead) return 1;
        if (a[1].lead && !b[1].lead) return -1;
      }
      return 0;
    });

  const allIds = eligible.map(([id]) => createCatId(id));

  if (differentFamily.length > 0) {
    const sorted = sort(differentFamily);
    return { guardian: createCatId(sorted[0][0]), isDegraded: false, candidates: allIds };
  }

  if (sameFamily.length > 0) {
    const sorted = sort(sameFamily);
    return {
      guardian: createCatId(sorted[0][0]),
      isDegraded: true,
      degradeReason: 'No different-family guardians available',
      candidates: allIds,
    };
  }

  return { guardian: getDefaultCatId(), isDegraded: true, degradeReason: 'No guardians available', candidates: allIds };
}
```

**Step 4:** Run tests → verify green
**Step 5:** Commit `feat(F168): guardian matcher — auto-select guardian cat excluding author+reviewer`

---

## Task 2: IntakeChecklist Types + Validation

**Files:**
- Modify: `packages/shared/src/types/community-issue.ts`
- Modify: `packages/shared/src/types/index.ts`
- Test: `packages/api/test/intake-checklist.test.js`

**Step 1: Add types to shared**

```typescript
// Add to community-issue.ts
export interface IntakeChecklistItem {
  id: string;
  label: string;
  required: boolean;
  evidence?: string;
  verifiedAt?: number;
  verifiedBy?: string;
}

export interface GuardianAssignment {
  guardianCatId: string;
  requestedAt: number;
  requestedBy: string;
  signedOff: boolean;
  signedOffAt?: number;
  checklist: IntakeChecklistItem[];
}

export const DEFAULT_INTAKE_CHECKLIST: readonly Omit<IntakeChecklistItem, 'evidence' | 'verifiedAt' | 'verifiedBy'>[] = [
  { id: 'vision-alignment', label: '愿景对齐：交付物解决了铲屎官的原始需求', required: true },
  { id: 'test-coverage', label: '测试覆盖：新增行为有对应测试', required: true },
  { id: 'doc-sync', label: '文档同步：spec/plan/BACKLOG 已更新', required: true },
  { id: 'no-regression', label: '无回归：现有测试全绿', required: true },
  { id: 'design-fidelity', label: '设计一致：UI 与设计稿一致（如适用）', required: false },
];
```

**Step 2: Write failing test for checklist validation**

```javascript
// intake-checklist.test.js
describe('IntakeChecklist validation', () => {
  test('rejects checklist with missing required evidence', () => { ... });
  test('accepts checklist with all required items evidenced', () => { ... });
  test('allows optional items without evidence', () => { ... });
});
```

**Step 3:** Implement `validateIntakeChecklist(checklist: IntakeChecklistItem[]): { valid: boolean; missing: string[] }`
**Step 4:** Run tests → green
**Step 5:** Build shared: `pnpm --filter @cat-cafe/shared build`
**Step 6:** Commit `feat(F168): intake checklist types + validation (Phase D)`

---

## Task 3: Guardian Assignment Store Extension

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/CommunityIssueStore.ts` (add guardianAssignment field)
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisCommunityIssueStore.ts`
- Test: extend `packages/api/test/community-issues-routes.test.js`

Extend `CommunityIssueItem` with optional `guardianAssignment?: GuardianAssignment` field.
The field is stored as part of the issue document (same Redis hash), set via the existing `update()` method.

**Step 1:** Add `guardianAssignment` to `CommunityIssueItem` interface
**Step 2:** Update `updateSchema` in routes to accept `guardianAssignment`
**Step 3:** Test: PATCH with guardianAssignment stores and returns it
**Step 4:** Commit `feat(F168): extend community issue with guardianAssignment field`

---

## Task 4: Request Guardian Endpoint

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts`
- Test: `packages/api/test/community-issues-routes.test.js`

New endpoint: `POST /api/community-issues/:id/request-guardian`

Request body:
```typescript
{
  author: string;   // cat that did the intake work
  reviewer: string; // cat that reviewed the intake
}
```

Logic:
1. Validate issue exists and is in `accepted` state
2. Check no existing guardian assignment (409 if already assigned)
3. Call `resolveGuardian({ author, reviewer })` → get guardian cat
4. Write `guardianAssignment` to issue: `{ guardianCatId, requestedAt, requestedBy, signedOff: false, checklist: DEFAULT_INTAKE_CHECKLIST }`
5. Return assignment result

**Step 1: Write failing test**

```javascript
test('request-guardian selects guardian and stores assignment', async () => {
  // Setup: issue in 'accepted' state
  // POST /api/community-issues/:id/request-guardian { author: 'opus', reviewer: 'codex' }
  // Assert: response has guardianAssignment with guardianCatId ≠ opus ≠ codex
  // Assert: checklist has DEFAULT_INTAKE_CHECKLIST items
});

test('request-guardian rejects if already assigned', async () => {
  // 409 when guardianAssignment already exists
});

test('request-guardian rejects non-accepted issues', async () => {
  // 409 for issues not in 'accepted' state
});
```

**Step 2:** Run → fail
**Step 3:** Implement endpoint
**Step 4:** Run → green
**Step 5:** Commit `feat(F168): request-guardian endpoint — auto-select and assign guardian cat`

---

## Task 5: Guardian Sign-Off Endpoint

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts`
- Test: `packages/api/test/community-issues-routes.test.js`

New endpoint: `POST /api/community-issues/:id/guardian-signoff`

Request body:
```typescript
{
  catId: string;                    // must match guardianAssignment.guardianCatId
  checklist: IntakeChecklistItem[]; // filled-in checklist with evidence
  approved: boolean;                // guardian's decision
  reason?: string;                  // if not approved, why
}
```

Logic:
1. Validate issue has guardianAssignment
2. Validate catId matches assigned guardian
3. Validate checklist (all required items have evidence if approved)
4. Update guardianAssignment: `signedOff: true/false, signedOffAt, checklist`
5. If approved: update `WorkflowSop.checks.visionGuardDone = 'verified'` (if WorkflowSop exists for this feature)
6. Return updated issue

**Step 1: Write failing tests**

```javascript
test('guardian-signoff with valid checklist marks signedOff', async () => { ... });
test('guardian-signoff rejects wrong catId', async () => { ... });
test('guardian-signoff rejects missing required evidence', async () => { ... });
test('guardian-signoff rejection stores reason', async () => { ... });
```

**Step 2:** Run → fail
**Step 3:** Implement endpoint
**Step 4:** Run → green
**Step 5:** Commit `feat(F168): guardian sign-off endpoint with checklist evidence verification`

---

## Task 6: Merge-Gate Guardian Check Endpoint

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts`
- Test: `packages/api/test/community-issues-routes.test.js`

New endpoint: `GET /api/community-issues/:id/guardian-status`

Returns:
```typescript
{
  hasGuardian: boolean;
  guardianCatId?: string;
  signedOff: boolean;
  checklistComplete: boolean;    // all required items have evidence
  missingItems: string[];        // ids of required items without evidence
}
```

The merge-gate skill will call this endpoint before Step 7 (merge). If `signedOff !== true`, merge is blocked.

**Step 1:** Write test
**Step 2:** Implement
**Step 3:** Green
**Step 4:** Commit `feat(F168): guardian-status endpoint for merge-gate integration`

---

## Task 7: Close Out AC-A1/A2/A3

**Files:**
- Modify: `docs/features/F168-community-ops-board.md`

Verify and mark done:
- AC-A1: ✅ Skill instructions (direction-card-template.md) + backend (triage-complete endpoint + create_rich_block MCP) complete
- AC-A2: ✅ DirectionCardPayload has all fields; template specifies card structure with all required fields
- AC-A3: ✅ Backend (await-second-cat flow) + skill instructions (multi_mention auto-@ in triage SOP) complete

Update spec: `[ ]` → `[x]` for A1/A2/A3 with evidence notes.

**Step 1:** Commit `docs(F168): close AC-A1/A2/A3 — skill + backend integration verified`

---

## Task 8: Merge-Gate Skill Update

**Files:**
- Modify: `cat-cafe-skills/merge-gate/SKILL.md`

Add between Step 6 (cloud review) and Step 7 (squash merge):

```
# Step 6.5: Guardian Sign-Off Check (F168 Phase D)
# Only for community intake PRs (branch contains 'intake' or PR links to community issue)
GUARDIAN_STATUS="$(curl -sf http://localhost:3002/api/community-issues/{ISSUE_ID}/guardian-status)"
SIGNED_OFF="$(echo "$GUARDIAN_STATUS" | jq -r '.signedOff')"
if [ "$SIGNED_OFF" != "true" ]; then
  echo "❌ Guardian sign-off missing. Cannot merge."
  echo "$GUARDIAN_STATUS" | jq .
  exit 1
fi
```

**Step 1:** Update skill
**Step 2:** Commit `feat(F168): merge-gate guardian check — block merge without sign-off`

---

## Commit Summary

| # | Message | AC |
|---|---------|-----|
| 1 | `feat(F168): guardian matcher — auto-select guardian cat` | AC-D2 |
| 2 | `feat(F168): intake checklist types + validation` | AC-D4 (types) |
| 3 | `feat(F168): extend community issue with guardianAssignment` | AC-D1 (store) |
| 4 | `feat(F168): request-guardian endpoint` | AC-D1 |
| 5 | `feat(F168): guardian sign-off endpoint with checklist` | AC-D3, AC-D4 |
| 6 | `feat(F168): guardian-status endpoint for merge-gate` | AC-D3 |
| 7 | `docs(F168): close AC-A1/A2/A3` | AC-A1, AC-A2, AC-A3 |
| 8 | `feat(F168): merge-gate guardian check` | AC-D3 (skill) |
