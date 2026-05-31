---
doc_kind: harness-feedback
feedback_type: feature-fit-review
feature_id: F218
thread_ids:
  - thread_mpndq0ztqnl307f9
  - thread_mptx5udyjkkad8pk
session_ids: []
cats: [codex, opus, opus47]
primary_failure_class: none
status: accepted
created: 2026-05-31
---

# F218 Harness Feedback: Source Hygiene Guardrails

## Scope

F218 changed the Cat Cafe harness itself: shared L0, shared skills, deep-research refs, feat-lifecycle teaching, `pnpm check`, and F192 capability-wakeup eval inputs. Completion therefore requires harness feedback rather than `harness_feedback: none`.

## Fit Verdict

F218 fits the harness design goal: it converts a repeated cognitive miss ("external data looked plausible, so cats reused it without provenance scrutiny") into a shared, action-bound guardrail.

The final shape has all three ADR-031 layers:

| Layer | Shipped Evidence | Fit |
|-------|------------------|-----|
| Soft | L0 §2 source hygiene reflex; `source-audit` skill; deep-research template; feat-lifecycle teaching | Good. The trigger lives at the point of quoting high-risk claims, not only in heavy research mode. |
| Hard | `check:source-hygiene` in `package.json` and `scripts/run-checks.mjs`; L0 compile token-budget tests | Good. Shared artifacts can no longer drift silently without breaking `pnpm check`. |
| Eval | MemU echo-chamber fixture in `eval:capability-wakeup`; parser + invocation context carry fixture refs after cloud R1 fix | Good after R1. The fixture now reaches the weekly eval-cat packet instead of staying a static doc reference. |

## Key Observation

The cloud R1 finding was the important harness lesson: static docs references are not enough for an eval layer. The fixture must survive every runtime boundary that builds the eval-cat packet. F218 now covers that path through:

- `eval-domain-registry.ts`: `evalDomainFixtureSchema` and `fixtures: ...default([])`
- `eval-cat-invocation.ts`: `context.fixtures`
- `eval-domain-registry.test.js` and `eval-cat-invocation.test.js`: registry preservation + context carry-through

## Residual Risk

| Risk | Current Control | Regression Signal |
|------|-----------------|---------------|
| Cats over-trigger source-audit and add friction to low-risk search results | Skill trigger is limited to high-risk claims: numbers, benchmarks, causal claims, temporal/model applicability, medicine/finance/papers, and durable docs/PPT output | F192 capability-wakeup miss/overuse rates |
| Cats still quote high-risk claims without provenance | `source-audit` skill + L0 reflex + check coverage for shared artifacts | Eval output samples with missing provenance |
| Rich block provenance visualization is absent | Phase A intentionally ships text/table provenance first | Only revisit if users need UI inspection of claim ledgers |

## Evidence Refs

- PR #2005: `c3f6812a`
- Cloud R1 fix commit: `f2187b38`
- Phase doc sync: `1baa5c872`
- Vision guardian verdict: message `0001780244113547-000301-8caf1faa`
