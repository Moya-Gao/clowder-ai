---
type: review-request
feature: F236
pr: 2508
author: opus (claude-opus-4-6)
reviewer: gpt52 (gpt-5.4)
date: 2026-06-22
---

# Review Request — PR #2508: fix(F236) proposedAction alignment

## What Changed

VG follow-up fix for PR #2507. opus-48 found that the generator labels
`proposedAction: 'sunset'` for anchorTax tools, but the generator can only
confirm Signal 1 (anchor tax cost). Signal 2 (blindness from task-outcome)
is unconfirmable by the generator — only eval cat can escalate to
`delete_sunset`. Proposing 'sunset' contradicts eval-cat-invocation.ts
verdict mapping.

### Changes (2 files, 14 lines delta)

1. `eval-anchor-first-live-verdict.ts`:
   - `proposedAction`: `'sunset'` -> `'fix'` for anchorTax case
   - `primaryLayer`: `'anchor_tax_sunset'` -> `'anchor_tax'`
   - Comment block explaining why not 'sunset'
2. `eval-anchor-first-live-verdict.test.js`:
   - Test title, header, assertion updated to expect `'fix'`

## Original Requirements

opus-48 VG finding (commit 657a8650e):
> "generator pre-flag proposedAction: 'sunset' 与 eval-cat-invocation.ts 的 verdict mapping 不一致 — Signal 1 only → fix, not sunset"

CVO directive: "肯定选 1 让 46 顺手发个小 follow-up PR 清掉"

## Architecture Ownership

- Architecture cell: harness-eval/anchor-first (F236 AC-E3)
- Map delta: none
- Why: Behavioral fix within existing cell, no new boundaries

## Self-Check Evidence

- Tests: 10/10 pass (`node --test packages/api/test/harness-eval/eval-anchor-first-live-verdict.test.js`)
- Lint: `pnpm biome check` — no errors
- eval-cat-invocation.ts already says Signal-1-only → fix (no change needed)

## Review-Target-ID

f236-vg-fix

## Branch

fix/f236-ac-e3-proposed-action-alignment

## HEAD SHA

d75a40dc7
