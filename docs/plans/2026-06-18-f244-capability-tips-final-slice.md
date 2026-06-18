---
feature_ids: [F244]
related_features: [F114, F155, F192, F223, F229]
topics: [capability-tips, waiting-state, concierge, knowledge-feed, harness-eval]
doc_kind: plan
created: 2026-06-18
---

# F244 Capability Tips — Final-Shaped First Slice

**Feature:** `docs/features/F244-capability-tips-system.md`
**Design Gate:** `docs/discussions/2026-06-18-f244-design-gate/README.md`
**Owner / author:** 缅因猫/砚砚
**Reviewer:** 布偶猫 Opus 4.8

## CVO Direction

> "你可以先把这个做完 后续再补充 tips"

> "开 worktree 和宪宪一起按照 SOP 完成？你 coder 他 review"

This is one vertical-slice PR, not a chain of tiny PRs. The slice uses the final contract and runtime boundary now; later work only adds more tips, deeper eval consumption, and more presentation contexts.

## Non-Negotiable Shape

- No temporary help drawer.
- No F229-local tips catalog.
- No temporary action contract.
- No second truth source for capability definitions.
- No auto-send from a tip action.
- No tips in `alive_but_silent` or `suspected_stall` states.
- No fake progress wording.

## Architecture Ownership

Architecture cell: hub-action-surface + harness-eval
Map delta: update required
Why: F244 adds a user-visible waiting-state projection surface, a structural contribution gate, and usage event shape for later eval.

## Stateful Object Gate

New durable state objects: none.

Existing state consumed:

- F229 `conciergeStore.surfaceState` / `pendingPrompt`, via the existing `setSurfaceState('bubble', prompt)` contract.

New ephemeral state:

- Local tip display delay / rotation state in the tip strip component.
- Privacy-minimal usage events with `tipId`, `context`, `surface`, `action`, and `outcome`; no private prompt or thread body.

Invariants:

- `CapabilityTip` inventory is the only F244 tips inventory.
- `sourceRef` anchors must resolve.
- `capability` / `workflow` / `feature` tips require a typed action.
- `open_concierge_draft` only pre-fills the concierge input; it never sends.
- Warning/stall liveness states hide tips and keep cancel/reset controls dominant.

## Implementation Plan

### 1. Contract + Seed Inventory

Files:

- `packages/shared/src/types/capability-tips.ts`
- `packages/shared/src/capability-tips.seed.json`
- `packages/shared/src/index.ts`
- `packages/shared/src/types/index.ts` if needed by local export pattern

Work:

- Define `CapabilityTip`, `CapabilityTipAction`, `CapabilityTipUsageEvent`, `CapabilityTipSourceRef`, and validation helpers.
- Seed the first inventory with a small final-shaped set:
  - magic word: `脚手架`
  - capability: browser preview
  - capability: workspace navigation
  - workflow: memory recall
  - workflow: alpha validation
  - workflow: merge gate
  - feature: F229 concierge draft
- Each seed has `structureSource`, `bodySource`, `sourceRef`, `owner`, contexts, audience, and action where required.

Tests first:

- Schema rejects missing source/action on action-required kinds.
- Schema rejects fake progress wording.
- Seed inventory validates and has no duplicate IDs.

### 2. Selector + Usage Event Shape

Files:

- `packages/shared/src/capability-tips.ts` or same type module if cleaner
- `packages/web/src/lib/capabilityTipEvents.ts`

Work:

- Implement a deterministic selector for contexts and audience.
- Implement `buildConciergeDraftPrompt(tip)`.
- Add a client recorder for privacy-minimal usage events. First release can expose the event stream locally and/or through existing debug hooks; the event shape is final even if eval aggregation is shallow.

Tests first:

- Selector prefers matching context over generic tips.
- Draft prompt contains the tip ID/source context but no auto-send behavior.
- Usage event schema excludes free-form private text.

### 3. Waiting-State UI + F229 Draft Action

Files:

- `packages/web/src/components/CapabilityTipStrip.tsx`
- `packages/web/src/components/ThreadExecutionBar.tsx`
- `packages/web/src/components/ThinkingIndicator.tsx`
- relevant component tests under `packages/web/src/components/__tests__/`

Work:

- Render one secondary tip strip in `ThreadExecutionBar`.
- Render fallback tip strip in normal `ThinkingIndicator` only when execution bar is absent.
- Delay first display by roughly 6s and rotate no faster than 12s.
- Hover / title says "了解更多".
- Click calls `setSurfaceState('bubble', draftPrompt)` and records action event.
- Hide tips in `alive_but_silent` / `suspected_stall`.

Tests first:

- Normal execution/thinking can render a tip after the delay.
- Warning/stall states do not render a tip.
- Clicking "了解更多" opens concierge bubble with a draft and does not call send.

### 4. Contribution Gate + Templates

Files:

- `scripts/check-capability-tips.mjs`
- `scripts/check-capability-tips.test.mjs`
- `package.json`
- `docs/features/TEMPLATE.md`
- `cat-cafe-skills/refs/pr-template.md`
- `cat-cafe-skills/quality-gate/SKILL.md` if the existing skill text needs an explicit checklist hook

Work:

- Add `pnpm check:capability-tips`.
- Wire it into root `pnpm check`.
- Validator checks schema, source anchors, duplicate IDs, action-required kinds, and fake progress wording.
- Diff-aware mode checks changed user-visible feature/guide/skill files for a matching tip source or explicit `tips_exempt`.
- Templates add a `Tips Contribution` section with `added / updated / exempt` options and reviewer usefulness wording.

Tests first:

- Red fixture for changed feature without tip or exemption.
- Green fixture for valid tip sourceRef.
- Green fixture for explicit exemption.
- Red fixture for broken anchor.

### 5. Eval / Dogfood Artifacts

Files:

- `docs/reports/2026-06-18-f244-dogfood.md` or a dated report after local verification
- Possible lightweight fixture under `packages/shared` or `packages/web` for usage event validation

Work:

- Record the implemented usage event contract.
- Add a first dogfood report section with what can be verified locally before alpha.
- Leave deeper F192 aggregation as follow-up only if the event shape and sourceRef stale checks are already present.

## Validation Commands

Run in the feature worktree:

```bash
pnpm --filter @cat-cafe/shared test
pnpm --filter @cat-cafe/web test
pnpm check:capability-tips
pnpm check
pnpm lint
pnpm build
```

Frontend visual validation:

- Start the worktree app on worktree-safe ports, not runtime ports 3001/3002.
- Screenshot normal waiting with a tip.
- Screenshot warning/stall state with tips hidden.
- Click "了解更多" and verify F229 concierge draft is pre-filled, not sent.

## Review Handoff

Request Opus 4.8 review after quality gate with focus on:

- Single-source boundary: F229 consumes F244, no local tips catalog.
- Structural gate vs reviewer usefulness split.
- No fake progress and no warning-state obstruction.
- No PR-splitting workaround or throwaway scaffold.

[砚砚/gpt-5.5🐾]
