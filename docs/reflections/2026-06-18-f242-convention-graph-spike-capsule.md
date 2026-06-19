---
capsule_id: "F242-Close-2026-06-18"
context: "F242 convention graph spike close: package + discovery skill + cat-cafe/deer-flow dogfood"
feature_ids: [F242]
doc_kind: capsule
created: 2026-06-18
---

## What Worked

- The engine/extractor split kept the spike from becoming a cat-cafe-only tool. `packages/convention-graph` owns schema, provenance, scope, and freshness; concrete domains stay in plugins.
- Real dogfood found real bugs: `cat_cafe_post_message` exposed the `as const` extractor miss, and cloud review forced the freshness contract to become explicit instead of optimistic.
- LL-072 seal was the right finish line for the cloud review loop. Stateful local review by Sonnet/Opus cats closed stale comments without waiting for a bot clean stamp that has no stable fixed point.
- The discovery skill captured the portable method: define a convention domain, write an extractor, emit gaps/freshness/provenance, then use the graph as code evidence.

## What Failed

- The PR churned through too many replacement branches and cloud rounds before the seal protocol was applied. Most late findings were hygiene or stale replays, not new F242 logic.
- The first post-merge sync marked the feature done and removed BACKLOG before the completion artifacts were fully written. Sonnet's guardian PASS exposed that close-gate evidence still needed to be persisted.
- `feat-lifecycle` completion was easy to treat as "status update only"; the required reflection, harness-feedback, and CloseGateReport needed an explicit second pass.
- The close gate confused "spike evidence is real" with "feature vision is done". CVO caught the missing product surface: no hard cognitive path, no smooth usable entrypoint, and no auto-update/reindex behavior.

## Trigger Missed

- After LL-072 was triggered, branch cleanup should have included all F242 scratch refs in the same closure checklist, not just the final PR branch.
- Completion should load `feat-lifecycle` immediately after guardian PASS, not after a final summary.
- Cloud review loop telemetry should become mechanical evidence for the future LL-076/F245 friction path, rather than relying on cats to remember how many rounds happened.
- User Visibility Disclosure said the workflow was manual-only, but the close still treated that as acceptable without CVO signoff. That is exactly the F190/F041 class of close miss.

## Doc Links

- `docs/features/F242-code-graph-layer-spike.md` — feature truth source and CloseGateReport.
- `docs/discussions/2026-06-17-f242-design/README.md` — Design Gate decisions.
- `packages/convention-graph/` — merged package.
- `cat-cafe-skills/convention-graph-discovery/SKILL.md` — discovery skill.
- `docs/harness-feedback/2026-06-18-F242-convention-graph-spike.md` — harness fit review.

## Rule Update Target

- `cat-cafe-skills/merge-gate/SKILL.md` LL-072 / future LL-076: add mechanical seal telemetry ideas when F245 friction rollup is ready.
- `cat-cafe-skills/feat-lifecycle/SKILL.md` Completion: make "guardian PASS -> write reflection + harness-feedback + CloseGateReport before final summary" harder to miss.
- `feat-lifecycle` close gate: if User Visibility Disclosure contains "manual-only / not in cognitive path / no usable entrypoint", close must be blocked unless there is explicit CVO signoff.
