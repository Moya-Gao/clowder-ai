---
feature_ids: [F076]
topics: [need-audit, methodology, client-governance]
doc_kind: discussion
created: 2026-03-07
---

# F076 Need Audit Methodology — Meeting Notes

**Thread ID**: `thread_mmfvoxjjy1hlzh9e` | **Date**: 2026-03-07 | **Participants**: Opus, GPT-5.2

## Background

Cat Cafe needs a methodology for auditing external client PRDs (often AI-generated wish lists) and converting them into executable development plans. Real case: studio-flow project with 27 features, client's "9 acceptance points" baseline.

## Opus Proposal: Three-Stage Pipeline

Decompose (atomize) -> Classify (4 quadrants: business value x feasibility) -> Synthesize (MVS + questions + risks). Plus 5 ambiguity detection heuristics.

## GPT-5.2 Proposal: Four-Stage Pipeline with "Downgrade First"

Key insight: **First step is not to decompose, but to downgrade the PRD from "looks-complete spec" to "unverified intent bundle".**

1. Intent Extraction (6-slot Intent Cards)
2. Validity Triage (certainty x necessity x coupling -> Build Now/Clarify First/Challenge/Later)
3. Question Generation (constrained confirmation format, not open questions)
4. Slice Planning (vertical cuts by business flow, not horizontal by module)

Plus 8 risk detection signals (adds "AI fake specificity", "data source unknown", "scope creep" to Opus's 5).

## Consensus

1. PRD is not spec — must audit before decomposing into features
2. Need structured decomposition (AR / Intent Card)
3. Ambiguity detection via heuristic signals
4. Question list is a core output
5. Business value judgment needs human calibration, can't fully automate
6. Risk Register as persistent output

## Divergence (with resolution)

| Point | Opus | GPT-5.2 | Resolution |
|-------|------|---------|------------|
| Audit order | Decompose first, then classify | Downgrade first, then check if worth decomposing | **Adopt GPT-5.2's "downgrade first"** — not all items deserve atomization effort |
| Classification | 2D (value x feasibility) | 3D (certainty x necessity x coupling) -> 4 categories | **Adopt GPT-5.2's 4 categories** — separating "unclear" from "unreasonable" is critical for client communication |
| Slicing | Horizontal (by module) | Vertical (by business flow) | **Adopt GPT-5.2's vertical slicing** — clients understand end-to-end flows, not modules |
| Question format | Open-ended | Constrained confirmation ("We think A, if not then B/C, default A because...") | **Adopt GPT-5.2's constrained format** — goes to client with judgment, not just questions |
| Ambiguity signals | 5 | 8 (adds AI fake specificity, data source, scope creep) | **Merge to 8** — "AI fake specificity" is essential for AI-generated PRDs |

## Merged Methodology: Need Audit Pipeline v1

### Stage 1: Downgrade + Intent Extraction

- Treat PRD as "unverified intent bundle", not spec
- Extract Intent Cards with 6 slots: `actor`, `goal`, `trigger`, `object`, `success_signal`, `non_goal`
- If a requirement can't fill these 6 slots, it's not development-ready

### Stage 2: Validity Triage

Score each Intent Card on 3 dimensions:
- `certainty`: Is it well-defined?
- `necessity`: Does core delivery fail without it?
- `coupling`: Does it drag in hidden dependencies?

Classify into 4 categories:
- **Build Now**: Clear, necessary, manageable coupling
- **Clarify First**: Necessary but unclear — client needs to provide specifics
- **Challenge**: Clear but unreasonable (bad ROI, contradictory, scope creep)
- **Later**: Could do, but not in minimum delivery

### Stage 3: Question Generation

Format: Constrained confirmation, not open questions.
```
- We understand you want: [A]
- If not A, candidates are: [B / C]
- Our default recommendation: [A], because [reason]
- Please confirm or rewrite
```

### Stage 4: Slice Planning (Vertical Cuts)

Slice by business flow, not by module:
- One primary actor
- One complete workflow
- One verifiable outcome

Example for studio-flow:
```
Slice 1: Admin login -> Dashboard -> View real task -> Complete one review -> Status recorded
(crosses login, dashboard, review — but client can see and accept it)
```

### Risk Detection: 8 Signals

1. Hollow verbs: "improve", "optimize", "support", "manage"
2. Missing actors: who initiates, who approves, who sees result
3. Unknown data source: where does data come from, who is truth source
4. Missing success signal: how to tell it's done
5. Missing edge cases: errors, empty states, permissions, undo
6. Hidden dependencies: one point drags out 3-4 sub-systems
7. **AI fake specificity**: document is long but object model and process nodes are empty
8. **Scope creep**: MVP and enterprise-complete mixed together

### Mission Hub Output: 4 Products

1. **Translation Matrix**: Client's words -> Our Intent Cards
2. **Clarification Queue**: Must-confirm questions (constrained format)
3. **Risk Register**: Unreasonable / high-coupling / high-uncertainty items
4. **Slice Ladder**: Next batch of minimum viable delivery slices

## GPT-5.2 Phase 5 Review: Confirmed + 2 Guardrails

gpt52 confirmed no misread on the convergence. Added 2 guardrails:

1. **Show translated governance products, not raw project data** — Translation Matrix / Clarification Queue / Risk Register / Slice Ladder are what Mission Hub displays. DO NOT mirror raw backlog/issues/commits from external projects. "Home is not a workplace."

2. **Start semi-auto, not auto-judge** — necessity, priority, and cut/challenge decisions MUST have a human confirmation slot. Cat provides structured suggestions, but doesn't pretend to know what client truly wants.

**Recommended next step** (gpt52): Run a real Need Audit trial on studio-flow's actual client PRD before productizing the schema. Let the trial expose field gaps, friction points, and panel object shapes, then feed back into writing-plans.

## Action Items

- [x] Update F076 spec with merged methodology
- [ ] Design Intent Card data structure for implementation
- [ ] Determine automation level: semi-auto (cat + human) for Stage 2 certainty/necessity scoring
- [ ] UX: Add "Need Audit" flow to Mission Hub wireframe (trigger -> pipeline -> 4 outputs)
- [ ] **NEW**: Run Need Audit trial on studio-flow's real client PRD before schema finalization

## Convergence Check

1. Rejected alternatives -> ADR? **No** — no rejected tech alternatives, just methodology refinement
2. Lessons learned? **No** — no pitfalls discovered yet (methodology is theoretical, needs validation)
3. New operational rules? **No** — methodology will become operational after implementation + validation
