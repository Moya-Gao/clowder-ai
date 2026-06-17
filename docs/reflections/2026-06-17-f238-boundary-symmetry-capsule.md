---
capsule_id: "F238-2026-06-17"
context: "F238 Bidirectional Boundary Symmetry — 5 phases from spec to round-trip eval"
feature_ids: [F238]
doc_kind: capsule
created: 2026-06-17
---

## What Worked
- **Single truth source paid off**: `brand-dictionary.yaml` drove all 5 phases (outbound sanitizer, inbound guard, reverse sanitizer, round-trip tests) without policy drift between scripts
- **Phase decomposition**: 5 focused phases (A→E) each with clear PR scope made review tractable; no single PR exceeded 300 lines of new code
- **Per-termId reciprocity validation**: R2 review finding (gpt52) caught a real weakness — global set validation would have missed cross-term confusion. The fix was clean because dictionary structure already supported it
- **Test coverage as hard gate**: Wiring `check:boundary-roundtrip` into `pnpm check` (PARALLEL_CHECKS) means boundary regressions are caught on every PR, not just manual dry-runs

## What Failed
- **Cloud review degradation routing**: Initially tried to degrade Codex → GPT-5.4, forgetting they share the same OpenAI API quota pool. 铲屎官 caught this immediately. The merge-gate degradation table needs a note about shared provider quotas
- **AC-B2 deferred but not tracked**: "Deferred to Phase E integration" in the spec was ambiguous — Phase E didn't integrate the sync script gate because it focused on test coverage. Should have either fixed in Phase E or explicitly deleted the AC earlier

## Trigger Missed
- **Provider quota awareness**: Should have reflexively checked whether degradation targets share API quotas before routing. This is a general merge-gate gap, not just this PR

## Doc Links
- Feature spec: `docs/features/F238-bidirectional-boundary-symmetry.md`
- Plan (Phase E): `docs/plans/2026-06-17-f238-phase-e-roundtrip-eval.md`
- Dictionary: `assets/brand-dictionary.yaml`
- PRs: #2324 (Phase B), #2327 (Phase C), #2333 (Phase D), #2341 (Phase E)

## Rule Update Target
- `merge-gate` SKILL.md §Q4 degradation table: add note that 缅因猫 Codex and GPT-5.4 share OpenAI API quota — degradation must cross provider families (Codex → Opus family, not Codex → GPT-5.4)
- `merge-gate` SKILL.md: "Deferred to Phase X" in AC should be resolved (met/deleted/cvo_signoff) before that Phase's PR, not left ambiguous
