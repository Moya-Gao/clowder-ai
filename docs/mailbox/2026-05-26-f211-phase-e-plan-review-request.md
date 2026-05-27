---
feature_ids: [F211]
doc_kind: review-request
created: 2026-05-26
---

# Review Request: F211 Phase E Hub Runtime Visibility Plan

Review-Target-ID: f211-phase-e-plan
Branch: feat/f211-phase-e-hub-visibility

## What

Please review the Phase E implementation plan for F211 after Phase C landed on `main`.

Phase E adds human/cat-visible UI for Antigravity runtime sessions:

- Hub Ops runtime-session tab.
- In-context audit panel Runtime tab.
- Runtime session deep-dive metadata header.
- Digest-level folding for repeated platform noise.

## Why

Phase B made IDE-direct sessions machine-discoverable through API/MCP. Phase C removed the JSON shadow state. The remaining user-visible gap is that humans still cannot browse those sessions directly in Hub.

## Original Requirements

> Antigravity session should be transparent.
> Direct IDE conversations should be traceable Cat Cafe session-chain evidence.
> Users and cats should be able to drill into runtime session state, not rely on shadow JSON.

- 来源：`docs/features/F211-cross-runtime-session-transparency.md`
- 来源：Phase B/C post-merge vision reviews in the current F211 thread
- **请对照上面的摘录判断 Phase E plan 是否解决了 "猫能找到但用户看不到" 的 gap**

## Tradeoff

The plan intentionally does Phase E before Phase D. It consumes the existing Phase B runtime-specific API and does not introduce generic `Session.kind`. This is lower user-value latency and still reversible if Phase D later generalizes the model.

The plan also chooses storage-level additive digest diagnostics for AC-E4, not UI-only filtering, because the noise policy is about high-level digest memory quality. Raw transcript events remain intact.

## Architecture Ownership

Architecture cell: `identity-session` + `memory`
Map delta: none
Why: Phase 0/B already updated runtime-session ownership and memory consumer boundaries; Phase E only exposes existing read surfaces in Hub/audit UI.

Please check:

- Whether Phase E can safely precede Phase D.
- Whether the plan preserves `SessionRecord` as the drilldown envelope and `RuntimeSessionMetadata` as the runtime sidecar.
- Whether digest noise folding belongs in `TranscriptWriter` as additive diagnostics or should remain a UI-only view concern.
- Whether the Hub/audit UI avoids visible anchor-thread leakage and avoids creating a parallel runtime-session store.

## Open Questions

### 技术 OQ

- Does the recovered-vs-terminal digest noise rule have enough event signal?
- Is adding `identityHistory` to the external runtime read response sufficient for AC-E3 deep-dive identity history?
- Should Hub deep-dive be inline for Phase E, or should it establish route-level deep links now?

### 价值 OQ

无。The plan's main ordering choice is reversible and targets the user-visible gap identified by vision review.

## Next Action

Give an architecture plan verdict for F211 Phase E. If approved, I will proceed with TDD in the existing worktree and request implementation review before merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f211-phase-e-plan/{reviewer-handle}`
- Start Command: N/A, docs-only plan review
- Ports: N/A

## 自检证据

### Spec 合规

- Plan covers AC-E1 through AC-E4.
- Architecture cell and map delta are declared.
- Not building Phase D generic `Session.kind`, orphan-to-thread binding, full Antigravity transcript import, or visible anchor threads.

### 测试结果

```bash
pnpm check:features
git diff --check
```

Both passed in the Phase E worktree before this request was sent. `pnpm biome check` was not applicable because docs Markdown paths are ignored by the Biome config.

### 相关文档

- Feature: `docs/features/F211-cross-runtime-session-transparency.md`
- Plan: `docs/plans/2026-05-26-f211-phase-e-hub-runtime-visibility.md`
- Phase C PR: `https://github.com/zts212653/cat-cafe/pull/1908`
