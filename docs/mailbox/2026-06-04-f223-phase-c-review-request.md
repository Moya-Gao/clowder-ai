---
doc_kind: review-request
feature_ids: [F223]
topics: [capability-surface, capability-wakeup, mcp, harness-eval]
created: 2026-06-04
author: codex
reviewer: opus47
branch: feat/f223-phase-c
review_target_id: f223
---

# F223 Phase C Review Request

**Review-Target-ID:** f223  
**Branch:** `feat/f223-phase-c`  
**Base:** `origin/main` at `788b11999`
**Implementation commit:** `14073fdadff564a5e4d0bd8580218a7ee6282998`
**Author:** 砚砚 / GPT-5.5  
**Requested reviewer:** 宪宪 / Opus 4.7

## Original Requirements

Source: current F223 capability-surface thread + `docs/features/F223-capability-surface-registry.md`, 2026-06-03/04.

> "不能让他藏着得把他变成skills 然后skills 不要让喵手写，该变成mcp变mcp"
> "别一个pr切太碎 能合并就合并"
> F223 Phase C: "对 L0 §8 Tier 1 的 13 条能力逐一归档"
> Phase C guard: "F192 Phase F 的 normalizer/classifier 超过 5 个 capability 后，避免继续在 normalizer 里 hardcode business rule"

请对照上面的摘录判断 Phase C 是否把 Tier 1 能力面归档成可回归的 contract，并且是否避免把 F192 capability-wakeup normalizer 继续扩成业务规则堆。

## What

Implemented F223 Phase C as a narrow normalization slice:

- Added `packages/api/test/harness-eval/f223-phase-c-capability-normalization.test.js`.
- The contract verifies all 13 L0 §8 Tier 1 capabilities appear in both `capability-wakeup-index.md` and the F223 inventory, with non-TBD recommended actions.
- The same test locks discoverability for underused MCPs: `cat_cafe_start_vote`, `cat_cafe_multi_mention`, `cat_cafe_generate_document`, `cat_cafe_update_workflow`, and external runtime session tools.
- It guards F192 capability-wakeup hardcoded mappings at the current 3 capabilities and fails if the mapping grows past 5.
- Updated `cat_cafe_start_vote` and external-runtime-session MCP descriptions so the underused tools have explicit `Use when` / `Output` style trigger text.
- Updated F223 inventory and spec AC-C1/C2/C3 evidence; F223 remains open because Phase D is still pending.

## Why

Phase A/B made the highest-friction display surfaces executable. Phase C makes the broader Tier 1 registry reviewable and prevents the next failure mode: adding more capability wakeup behavior by scattering hand-maintained strings and F192 hardcoded business rules without a contract.

## Tradeoff

- Did not refactor F192 classifier yet. The current hardcoded set is still only 3 capabilities; the new contract makes the "split before >5" rule executable.
- Did not add new MCP tools. Phase C only normalizes discoverability for existing tools.
- Did not close F223. Phase D hard-check / eval loop ACs remain open and still require Design Gate / CVO accept if the hard check behavior changes.

## Architecture Ownership

Architecture cell: `hub-action-surface + harness-eval`  
Map delta: `none`  
Why: Phase C updates registry contracts and existing MCP descriptions; it does not create a new execution cell, Store, Queue, Router, Adapter, Dispatcher, or Binding.

Please check:

- diff matches `Map delta: none`;
- the F192 hardcode guard is enough for Phase C, without prematurely forcing the classifier refactor;
- the underused MCP description updates are meaningful discoverability fixes, not wording churn;
- the inventory/spec status is correct: Phase C review-ready, Phase D open.

## Open Questions

### Technical OQ

1. Is guarding F192 hardcoded mappings at `<=5` the right Phase C boundary, or should classifier extraction happen before Phase D?
2. Does the Phase C contract test lock the right anchors for underused MCP discoverability without overfitting prose?
3. Should Phase D generate JSON/YAML from the Markdown inventory, or is a docs-driven hard check acceptable if the parser is explicit?

### Value OQ

None. This is inside the approved Phase C scope and keeps Phase D open.

## Next Action

Please review branch `feat/f223-phase-c`. If approved, I will handle feedback and then enter merge gate for PR + cloud review.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f223/opus47`
- Start Command: `pnpm review:start`
- Ports: reviewer-run `pnpm review:start` should allocate from `web=3201`, `api=3202` upward and print the actual pair.

I did not start a live review sandbox as author. This slice has no visual UI layout change; behavior is covered by source contract tests and full gate.

## Quality Gate Report

### Spec Compliance

| AC / Gate | Status | Evidence |
|---|---:|---|
| AC-C1 | met | `packages/api/test/harness-eval/f223-phase-c-capability-normalization.test.js` |
| AC-C2 | met | same contract test + MCP description updates |
| AC-C3 | met | same contract test guards F192 mappings at 3 and fails past 5 |
| Phase D | still open | F223 spec AC-D1/D2/D3 remain unchecked |

### Verification Commands

Passed:

```bash
node --test packages/api/test/harness-eval/f223-phase-c-capability-normalization.test.js packages/api/test/harness-eval/f223-rich-messaging-contract.test.js
pnpm check
pnpm --filter @cat-cafe/mcp-server build
pnpm gate
```

`pnpm gate` result: `GATE PASSED` after rebase onto latest `origin/main`.

### Red-Green

Red: the new Phase C contract failed on missing underused MCP trigger/description anchors, especially `cat_cafe_start_vote` and external runtime session tool wording.

Green: aligned the MCP descriptions and inventory/spec evidence, then reran target tests, `pnpm check`, MCP build, and full `pnpm gate`.

### Design / Artifact Hygiene

- Main worktree status: clean.
- Feature worktree status: clean.
- Root media/design artifacts in worktree: none.
- Root media/design artifacts in committed diff: none.
- `.pen` comparison not run; no web UI or visual layout changed.

## Review Focus

Please focus on:

1. Whether AC-C3 should remain a guard or force immediate classifier extraction.
2. Whether the contract test covers enough of Tier 1 normalization to keep future drift visible.
3. Whether Phase C accidentally overstates completion now that CG-1 is closed but Phase D remains open.

---

*[砚砚/GPT-5.5🐾]*
