---
capsule_id: "F245-2026-06-23"
context: "F245 Friction Signal Eval — 4 通道摩擦统一聚合与 Eval Hub 呈现"
feature_ids: [F245]
doc_kind: capsule
created: 2026-06-23
---

## What Worked

- **Read-model boundary was correct**: F245 did not migrate task-outcome, F222, or existing eval domains. It consumed them through adapters, which kept canonical ownership clear and reduced blast radius.
- **Design Gate caught the important shape**: Port + Adapter, rollup-time clustering, Top-N/tail folding, and ①②③ vs ④ actionability split all survived implementation.
- **Cloud review pressure improved the contract**: Phase D's "oversized verdict card" feedback forced the Eval Hub view to split into smaller, readable sections instead of shipping a dense blob.
- **Y-lite migration became shared infrastructure**: the F236 collision surfaced the hard enum-bump weakness early enough to fix the contract before more eval domains copied it.

## What Failed

- **Cross-thread decision propagation failed once**: the 2026-06-18 Y-lite decision lived in the F236 coordination thread but did not enter the F245 Phase C plan, so PR1a/PR1b shipped the wrong registration pattern first.
- **Feature doc lagged real state**: code, PRs, and vision guard had closed, but the F245 spec still used stale in-progress language that made the final state ambiguous.
- **Close artifacts were not produced at first close**: reflection capsule, harness-feedback review, and formal Close Gate Report had to be added after CVO explicitly called out the close process.

## Trigger Missed

- **Shared-contract collision should have triggered canonical doc update immediately**: once F236 and F245 both touched `domainId`/`sourceAdapter`, the Y-lite pattern needed to move from thread message to feature/F192 truth source before either implementation continued.
- **Vision guard completion should have checked `docs/features/README.md`**: F245 was removed from BACKLOG, but not added to the completed feature index until this close sync.

## Doc Links

- F245 spec: `docs/features/F245-friction-signal-eval.md`
- Design Gate: `docs/discussions/2026-06-18-F245-design-gate.md`
- Phase D microspec: `docs/plans/2026-06-22-f245-phase-d-microspec.md`
- Harness feedback: `docs/harness-feedback/reviews/F245-feature-fit-review.md`
- Related eval control plane: `docs/features/F192-socio-technical-harness-eval.md`
- PRs: #2422, #2443, #2458, #2469, #2476, #2483, #2504

## Rule Update Target

- `feat-lifecycle` completion: emphasize that BACKLOG removal and completed README insertion are paired operations, and both should be verified by the guardian.
- `cross-thread-sync`: when a shared contract decision is made in one feature thread but blocks another active feature, the owning feature spec must get the canonical pattern before implementation resumes.
