---
feature_ids: [F208]
topics: [harness-engineering, control-plane, migration, playbook]
doc_kind: guide
created: 2026-05-20
---

# How to Migrate a Harness Unit (F208 Playbook)

> Step-by-step guide for bringing an existing harness component under the F208 control plane.

## Prerequisites

- The unit exists and is actively used in production
- You have access to the unit's code path and can add OTel instrumentation
- The unit has at least one observable activation signal

## Step 1: Identify the Unit Type

| Type | Examples | Key Characteristic |
|------|----------|-------------------|
| `tool` | hold_ball, search_evidence | MCP tool invoked by cat |
| `guard` | route-serial | Prompt injection rule enforced at dispatch |
| `prompt` | system prompt layers | Context injected before LLM call |
| `skill` | feat-lifecycle, tdd | On-demand workflow loaded via skill system |

## Step 2: Add Registry Entry (registry.yaml)

```yaml
- id: your_unit_id
  name: "Display Name"
  type: tool | guard | prompt | skill
  status: active | experimental
  owner: cat_id
  description: "One-line description of what it does"

  runtime:
    load_trigger: static | dynamic | on-demand
    execute_mechanism: mcp-tool | prompt-injection | guard-rule
    exit_condition: "What ends this unit's active state"
  eval:
    activation_signal: "Observable event proving the unit fired"
    friction_metric: "User compensation behavior to detect"
    success_signal: "Desired outcome"
    regression_fixtures: []
  governance:
    owner: cat_id
    upgrade_criteria: "When to promote"
    degrade_criteria: "When to add friction"
    sunset_signal: "When to retire"
  interfaces:
    trace: "pending"
    eval: "pending"
    feedback: "pending"
    governance: "pending"
```

## Step 3: Implement Trace Interface

1. **Define counters** in `packages/api/src/infrastructure/telemetry/instruments.ts`:
   ```typescript
   export const yourUnitActivated = lazy(() =>
     meter().createCounter('cat_cafe.your_unit.activated', {
       description: 'Your unit activation count',
     }),
   );
   ```

2. **Add attributes to allowlist** if using custom attributes beyond `agent.id`:
   - Define constant in `genai-semconv.ts`
   - Add to `ALLOWED_METRIC_ATTRIBUTES` in `metric-allowlist.ts`

3. **Wire counters** into the unit's code path at activation, completion, and error points.

4. **Document trace event schema** (event types + payload structure).

## Step 4: Implement Eval Interface

1. **Define the observation unit** — what thread segment represents one "use" of this unit?

2. **Identify at least one compensation behavior** to detect:
   - Harness gap: unit didn't fire but user did the action manually
   - Trust gap: unit fired but user overrode/cancelled it
   - Both spinning: unit fires repeatedly with no progress

3. **Define friction metric formula**:
   ```
   friction = <compensation_events> / <total_activations>
   ```

4. **Set target threshold** (e.g., friction < 20%).

## Step 5: Implement Feedback Interface

1. **Add structured reason field** to any cancel/override/reject action the user can take.

2. **Define reason codes** relevant to this unit (e.g., TRUST_GAP, HARNESS_GAP, STUCK, OTHER).

3. **Wire feedback to counters** (paired: total actions + actions with reason).

4. **Ensure all cancel paths increment counters** (manual + auto).

## Step 6: Implement Governance Interface

1. **Define concrete thresholds** with numerical values:
   - Upgrade: friction < X% AND trust_gap < Y% over Z weeks
   - Degrade: friction > A% OR trust_gap > B%
   - Sunset: zero activations for N months

2. **Include at least one worked example** showing how the threshold would be evaluated.

3. **Define review cadence** (weekly automated check + monthly manual review).

## Step 7: Run a Complete Cycle

Execute one full trace → eval → feedback → governance loop (see hold-ball-lifecycle-cycle.md for template). Document the results.

## Step 8: Update Registry

Replace all `pending` fields in registry.yaml with actual implementation pointers.

---

## Checklist

- [ ] Unit type identified
- [ ] Registry entry added (6 fields + three-layer contract)
- [ ] Trace: OTel counters defined and wired
- [ ] Trace: Custom attributes in allowlist (if any)
- [ ] Trace: Event schema documented
- [ ] Eval: Observation unit defined (thread segment scope)
- [ ] Eval: At least one compensation behavior detectable
- [ ] Eval: Friction metric formula defined with target
- [ ] Feedback: Structured reason field on cancel/override actions
- [ ] Feedback: Paired counters (total + with_reason)
- [ ] Feedback: All cancel paths covered (manual + auto)
- [ ] Governance: Upgrade/degrade/sunset thresholds with numbers
- [ ] Governance: Worked example
- [ ] Governance: Review cadence defined
- [ ] Lifecycle cycle: One complete pass documented
- [ ] Registry: All `pending` fields replaced

## Lessons from hold_ball Pilot

1. **Add counter to ALL paths** — auto-cancel in messages.ts was missed initially. Grep for all call sites.
2. **Allowlist enforcement is silent** — if your attribute isn't in the allowlist, aggregation silently fails. Always check `metric-allowlist.ts`.
3. **Zombie/correlation events are Phase C+** — don't promise observability that requires cross-system correlation until the eval pipeline exists.
4. **File size limit (350 lines)** — plan counter wiring to keep files manageable.
5. **Canonical spec must stay aligned** — every counter name in the feature spec must match actual OTel instrument names exactly.
