---
doc_kind: harness-feedback
feedback_type: feature-fit-review
feature_id: F242
thread_ids:
  - thread_mpy1686qmoewe8ds
session_ids: []
cats: [codex, opus-48, opus-47, sonnet]
primary_failure_class: none
status: accepted
created: 2026-06-18
---

# F242 Convention Graph Spike — Harness Fit Review

## Scope

F242 shipped both a code evidence package and a new discovery skill. It therefore changes the harness path for future code work: when a cat changes a convention-bearing surface, the desired behavior is to build/query a convention graph instead of relying only on grep and memory.

## Fit Verdict

The shipped shape fits the harness goal. It turns a repeated code-agent failure mode ("string conventions hide consumers from LSP and grep") into a reusable, provenance-bearing workflow.

| Layer | Shipped Evidence | Fit |
|-------|------------------|-----|
| Soft | `convention-graph-discovery` skill describes when/how to define a convention domain and emit a graph | Good. The trigger is action-bound: entering a repo or changing MCP/skill/route conventions. |
| Hard | `packages/convention-graph` tests cover provenance, domain scope, consumer lookup, gap reporting, FastAPI route extraction, and freshness fail-closed behavior | Good. The cloud-review freshness loop converted implicit scope assumptions into red/green contract tests. |
| Eval | F242 spec defines F192-style friction metrics, regression fixtures, false-positive cost, and sunset signal | Adequate for spike. Runtime adoption metrics are not shipped yet; that belongs to future Code Graph Layer work, not this spike. |

## Key Observation

The most important fit decision was separating the domain-agnostic engine from domain extractors. Without that split, Phase A would have produced a cat-cafe-specific helper. With the split, Phase B could reuse the engine for deer-flow FastAPI routes, proving the method is portable enough for a spike.

## Residual Risk

| Risk | Current Control | Regression Signal |
|------|-----------------|-------------------|
| Cats forget to load the discovery skill and keep grepping manually | Skill exists and F242 truth source records trigger contexts | Future MCP/schema edits with no convention-graph query evidence |
| More framework extractors are missing | Gap reporting is explicit; spike scope does not claim universal coverage | Silent 0-hit graph in a repo with obvious conventions |
| False-positive edges cause bad edits | Source span + extractor provenance + scoped negative fixtures | Guardian/review finds name-only or cross-domain edges without provenance |
| Cloud review loop repeats stale findings | LL-072 seal used for #2408; reflection points future LL-076/F245 telemetry | Same PR exceeds 5 bot rounds without seal or local final review |

## Evidence Refs

- PR #2408 squash: `2e9f5842`
- Post-merge truth sync: `6ad1af977`
- Vision guardian PASS: message `0001781845013679-000557-797f4741`
- Feature doc: `docs/features/F242-code-graph-layer-spike.md`
- Discovery skill: `cat-cafe-skills/convention-graph-discovery/SKILL.md`
