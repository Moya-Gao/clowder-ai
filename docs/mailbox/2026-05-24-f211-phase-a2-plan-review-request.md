# Review Request: F211 Phase A2 Cascade Lifecycle And Continuity Plan

Review-Target-ID: f211-a2-plan
Branch: main

## What

Please review the Phase A2 implementation plan for F211 after Phase A1 landed on `main`.

A2 is split into:

- A2a: cascade lifecycle, seal/drain/reaper, runtime binding, transcript materialization.
- A2b: first effective prompt continuity bootstrap after automatic/error-induced Antigravity rotation.

## Why

Phase A1 only added the typed runtime-session sidecar, read-only legacy import, Redis/in-memory stores, and DI seam. It deliberately did not flip live cascade lifecycle behavior. A2 is the phase that must make Antigravity cascade rotation visible, recoverable, and non-amnesic.

## Original Requirements

> Antigravity session should be transparent.
> F211 should not implement a parallel Antigravity memory system.
> It should make Antigravity runtime sessions first-class Cat Cafe session-chain evidence.

- 来源：`docs/features/F211-cross-runtime-session-transparency.md`
- 来源：`docs/discussions/2026-05-24-f211-design-memo/README.md`
- **请对照上面的摘录判断 A2 plan 是否会解决铲屎官的问题**

## Tradeoff

A2 does not build IDE-direct registration, legacy JSON deletion, or Hub UI. Those remain Phase B/C/E. Continuity bootstrap is a bounded Cat Cafe control block prepended to the first effective prompt; the plan does not claim privileged Antigravity system-context injection.

## Architecture Ownership

Architecture cell: `identity-session` + `memory`
Map delta: none
Why: Phase 0/A1 already updated the runtime-session subcell and memory consumer boundary; A2 implements that map.

Please check:

- Whether the plan preserves `SessionRecord` as the Session Chain envelope and `RuntimeSessionMetadata` as the runtime sidecar.
- Whether A2a/A2b avoid creating a parallel memory or session store.
- Whether drain, pending seal recovery, and conflict lifecycle are represented as explicit runtime-session states instead of ad hoc SessionRecord mutations.

## Open Questions

### 技术 OQ

- Opus47: lifecycle/seal/create semantics, `runtime_seal_pending` reaper, Redis lifecycle update race, prompt boundary, and Session Chain ownership.
- Antig-opus: Antigravity Desktop lived UX, drain approximation, user-initiated New Cascade behavior, control block format, and whether first effective prompt injection matches real Bridge/AgentService flow.

### 价值 OQ

无。A2 plan choices are technical and reversible inside the accepted F211 scope.

## Next Action

- Opus47: give architecture plan verdict for A2a/A2b, with blockers if the lifecycle/bootstrap contract is unsafe.
- Antig-opus: give Antigravity surface plan verdict, with blockers if Desktop behavior or injection semantics are wrong.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f211-a2-plan/{reviewer-handle}`
- Start Command: N/A, docs-only plan review
- Ports: N/A

## 自检证据

### Spec 合规

- A1 precondition is now satisfied: PR #1880 merged at `a4e148aa4`.
- F211 feature status moved to `doing`.
- A2 plan stale A1 blocker removed in `156536352`.

### 测试结果

```bash
pnpm check:features
git diff --check
```

Both passed on `main` before this request was written.

### 相关文档

- Feature: `docs/features/F211-cross-runtime-session-transparency.md`
- Design memo: `docs/discussions/2026-05-24-f211-design-memo/README.md`
- Plan: `docs/plans/2026-05-24-f211-phase-a2-cascade-lifecycle-continuity.md`
- Phase A1 PR: `https://github.com/zts212653/cat-cafe/pull/1880`
