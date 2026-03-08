---
feature_ids: [F076]
topics: [need-audit, methodology, client-governance]
doc_kind: discussion
created: 2026-03-07
---

# F076 Need Audit Methodology — Opus Independent Thinking (Phase 1)

> Thread: `thread_mmfvoxjjy1hlzh9e` | Mode B Phase 1 | 2026-03-07

## Problem

Cat receives an AI-generated PRD from a client (bloated wish list, not real product thinking).
How to systematically audit it and convert to an executable development plan?

## Proposal: Three-Stage Audit Pipeline

### Stage 1: Decompose — Requirement Atomization

Break PRD prose into **Atomic Requirements (AR)**. Each AR must be:
- Independently verifiable (clear done condition)
- Single responsibility (one function per AR)
- Estimable (dev can give time range)

**Example** — client says "login improvement":
```
AR-1: Username + password login (core)
AR-2: Remember login state (core)
AR-3: Forgot password reset (important)
AR-4: Third-party OAuth (nice-to-have)
AR-5: MFA (nice-to-have)
```

**Heuristic: If an AR takes >3 days, it's not atomic enough.**

### Stage 2: Classify — Four Quadrants

| | High Business Value | Low Business Value |
|---|---|---|
| **High Feasibility** | **Core** | **Defer** |
| **Low Feasibility** | **Negotiate** | **Cut** |

Classification signals:
- **Core**: In acceptance baseline, system can't run without it, other features depend on it
- **Negotiate**: Feasible but timeline exceeds expectations, needs info client hasn't provided, multiple implementation paths need client choice
- **Defer**: Client mentioned but not in acceptance baseline, "nice to have"
- **Cut**: Technically unreasonable, contradicts other requirements, very low ROI

### Stage 3: Synthesize — Outputs

1. **Minimum Viable Slice (MVS)** — Core ARs only, first deliverable version
2. **Questions for Client** — All Negotiate ARs + all detected ambiguities
3. **Risk Register** — Dependency chains, timeline risks, spec gaps

## Ambiguity Detection Heuristics

5 signals that a requirement is ambiguous:

1. **Vague verbs**: "improve", "optimize", "enhance" instead of specific actions
2. **Missing actors**: Doesn't say WHO performs the operation
3. **Broken data flow**: Input source and output destination not specified
4. **Missing edge cases**: Happy path exists, error path doesn't (what if review is rejected?)
5. **Undefined scale**: Says "support XX" but no volume (10 users or 10,000?)

## Open Questions

- Should audit be **automated** (cat reads PRD and auto-generates) or **semi-automated** (cat guides human through it)? Leaning semi-auto — full automation may misjudge business value.
- Four-quadrant classification needs **business context** that cat may lack. Need a mechanism for human to quickly calibrate.
- How to handle **contradictory requirements** (client wants X and Y but they conflict)?
- Integration with Mission Hub UI: does audit result become persistent data or one-time report?
