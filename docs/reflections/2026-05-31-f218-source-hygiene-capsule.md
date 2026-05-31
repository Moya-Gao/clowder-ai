---
capsule_id: "F218-PhaseA-2026-05-31"
context: "F218 Phase A source hygiene guardrails"
feature_ids: [F218]
doc_kind: capsule
created: 2026-05-31
---

# F218 Phase A Source Hygiene Capsule

## What Worked
- The core failure was framed correctly as external evidence contamination rather than generic hallucination. That kept the solution focused on provenance, source quality, and action-bound triggers.
- Zero per-family divergence held: durable behavior landed in shared L0, shared skills, shared refs, eval fixtures, and checks rather than family prompt files.
- The soft + hard + eval method was dogfooded: L0 / skill teaching, `check:source-hygiene`, and a MemU regression fixture all shipped together.
- Cloud review caught a real eval-layer break: the fixture was in YAML but stripped before the eval-cat packet. Fixing schema + invocation context made the eval layer real rather than decorative.

## What Failed
- The first implementation treated adding a fixture reference to the eval domain YAML as enough. The actual runtime parser and invocation context were a separate contract and initially dropped `fixtures`.
- The initial local review and self-check focused on F218 deliverable presence more than the downstream F192 packet path.

## Trigger Missed
- Contract drift sweep should have triggered when adding a new field to a docs-backed eval domain registry. The seam was not just YAML and docs; it included Zod parser output and `buildEvalCatInvocation()` serialization.
- Source-hygiene hard gate can be strengthened to prove not only reference presence but also that referenced eval fixtures survive the runtime loader path.

## Doc Links
- Feature spec: `docs/features/F218-evidence-provenance-source-hygiene.md`
- Harness feedback: `docs/harness-feedback/2026-05-31-F218-source-hygiene.md`
- Source-audit skill: `cat-cafe-skills/source-audit/SKILL.md`
- Eval fixture: `docs/harness-feedback/fixtures/source-hygiene-memu-echo-chamber.md`
- PR: `#2005`

## Rule Update Target
- `cat-cafe-skills/refs/close-gate.md`: contract drift check should explicitly include docs-backed schema fields and packet serialization paths.
- `scripts/f218-source-hygiene.test.mjs`: additional hardening target is end-to-end runtime loader coverage for eval fixture references, not just static reference presence.
