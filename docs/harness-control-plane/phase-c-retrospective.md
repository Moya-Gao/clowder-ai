---
feature_ids: [F208]
topics: [harness-engineering, control-plane, retrospective]
doc_kind: discussion
created: 2026-05-20
---

# F208 Phase C Retrospective: Is the Contract Too Heavy or Too Light?

## Assessment Method

Evaluated by applying the three-layer contract + four interfaces to two units:
1. **hold_ball** (tool) — full implementation through Phase B
2. **search_evidence** (tool) — stub-level migration in Phase C

## Findings

### What Worked (Keep)

1. **Three-layer contract is the right granularity**. Runtime/Eval/Governance each serve distinct audiences:
   - Runtime → developer implementing the unit
   - Eval → operator measuring effectiveness
   - Governance → owner deciding lifecycle

2. **OTel counter pattern is lightweight and effective**. The `lazy(() => meter().createCounter(...))` pattern adds ~5 lines per event. Wiring into existing code is minimal (1-2 lines per call site). The allowlist prevents accidental cardinality explosion.

3. **Paired counters (total + with_reason) make friction measurable**. Without this pattern, you can't compute ratios. Simple and proven with hold_ball.

4. **Registry YAML as single source of truth**. Having one file listing all units with their interface pointers prevents drift. Review feedback confirmed this catches inconsistencies early.

### What's Too Heavy (Simplify)

1. **Zombie/correlation events premature**. Phase B tried to include zombie detection in governance thresholds before the eval pipeline existed. This caused 3 review rounds of cleanup. **Recommendation**: Registry entries should only reference counters that exist. Placeholder thresholds must say "Phase N: requires [dependency]" explicitly.

2. **Regression fixtures in registry.yaml are aspirational, not executable**. They read like test descriptions but aren't wired to actual tests. **Recommendation**: Either wire to real test files (e.g., `test: packages/api/src/__tests__/hold-ball.test.ts`) or remove and rely on the test suite directly.

3. **Governance cadence (weekly/monthly) assumes automation that doesn't exist**. The "weekly threshold check" is manual. **Recommendation**: Keep governance criteria but defer cadence until there's a cron or dashboard to automate it.

### What's Too Light (Strengthen)

1. **No standard for "activation signal verified"**. AC-C1 requires a complete cycle, but there's no automated way to verify all counters are non-zero. **Recommendation**: Add a health-check endpoint or script that queries `cat_cafe.hold_ball.*` counters and reports which are zero.

2. **Feedback interface is optional in practice**. search_evidence has no feedback channel and the contract allows this (stub). But without feedback, the eval→governance loop is one-directional (observe-only, no user input). **Recommendation**: Make "at least one user feedback signal" a hard requirement for `active` status units. `experimental` units can have stub feedback.

3. **Cross-unit correlation not addressed**. hold_ball and route-serial interact (hold is a valid ball-pass action in route-serial's decision tree). The contract treats each unit independently. **Recommendation**: Add an optional `depends_on` field to registry entries for units that form interaction chains.

## Adjustment Recommendations

| # | Change | Priority | Scope |
|---|--------|----------|-------|
| 1 | Registry: only reference counters that exist in code | P1 | Immediately enforce |
| 2 | Registry: add `depends_on` field for unit interaction chains | P2 | Next registry schema update |
| 3 | Governance: defer cadence to "when automated" | P2 | Update hold_ball entry |
| 4 | Status gate: `active` requires ≥1 feedback signal; `experimental` allows stub | P2 | Contract schema update |
| 5 | Regression fixtures: wire to test files or remove | P3 | Next pilot migration |

## Conclusion

The contract is **slightly too heavy** for the current maturity level — specifically the governance cadence and zombie/correlation thresholds that assumed infrastructure not yet built. The core structure (three layers + four interfaces + OTel counters + registry YAML) is **right-sized** and validated through the hold_ball pilot. The main gap is on the "too light" side: feedback is optional but shouldn't be for active units, and cross-unit dependencies aren't modeled.

**Net recommendation**: Keep the structure, trim the aspirational parts, add the `depends_on` field.
