---
feature_ids: [F208]
topics: [harness-engineering, control-plane, hold-ball, lifecycle]
doc_kind: impl
created: 2026-05-20
---

# Hold Ball — Complete Lifecycle Cycle (AC-C1)

> One full trace → eval → feedback → governance pass for the hold_ball pilot unit.

## Cycle Instance: 2026-05-20 Validation Run

### Step 1: Trace (What Happened)

**Events observed** (via OTel counters `cat_cafe.hold_ball.*`):

| Time | Event | Counter | Attributes |
|------|-------|---------|------------|
| T+0 | Cat holds ball | `registered` | agent.id=opus |
| T+30s | User cancels hold | `cancelled` | agent.id=opus, cancel.reason=TRUST_GAP |
| T+30s | (with_reason fires) | `cancelled_with_reason` | agent.id=opus, cancel.reason=TRUST_GAP |
| T+2min | Cat holds ball again | `registered` | agent.id=opus |
| T+5min | Scheduler fires wake | `wake` | agent.id=opus |

Counter totals at end of window:
- `registered` = 2, `cancelled` = 1, `cancelled_with_reason` = 1, `wake` = 1, `rejected` = 0

Note: `cancelled_with_reason` only increments on manual DELETE with a structured reason body (TRUST_GAP/HARNESS_GAP/STUCK/OTHER). Auto-cancel via user message only increments `cancelled` with reason=AUTO_USER_MESSAGE — it does NOT count toward `cancelled_with_reason`.

### Step 2: Eval (Is It Working)

**Observation unit**: Thread segment from first hold to post-wake message.

**Compensation behavior detection**:
- Manual cancel at T+30s with reason=TRUST_GAP: User didn't trust the hold to complete.
  - Classification: **Trust gap** — user cancelled because they didn't believe the hold would work.
- Second hold at T+2min succeeded: wake fired at T+5min, cat acted on nextStep.
  - Classification: **Success** — hold fulfilled its purpose after user's initial distrust.

**Friction Metric calculation**:
- Total cancels: 1 (`cancelled` counter)
- Cancels with structured reason: 1 (`cancelled_with_reason` counter)
- Friction = 1 - (1/1) = 0% — all manual cancels include a reason.

**Trust gap rate**: 1 TRUST_GAP / 1 total cancel = 100% (all cancels are trust gap).

**Conclusion**: Friction metric is healthy (reasons are captured), but trust_gap_rate is high. This single cycle has too little data for a governance decision — need sustained observation.

### Step 3: Feedback (What to Change)

**Structured feedback received**: 1 TRUST_GAP cancel.
- User cancelled at T+30s because they didn't trust the hold.
- After seeing the second hold succeed (wake at T+5min), user may build trust.

**Feedback channel validation**:
- DELETE endpoint accepts optional `{ reason, message }` body ✓
- Cancel reason flows to `holdBallCancelled` counter attribute ✓
- Structured reason triggers `holdBallCancelledWithReason` counter ✓
- `cancel.reason` is in metric allowlist ✓

**Actionable insight**: TRUST_GAP feedback indicates the hold's visibility message may need improvement — user should see clearer evidence that the hold is actively monitoring.

### Step 4: Governance (Lifecycle Decision)

**Input**: Eval aggregates from this cycle.
- friction_rate = 0% (target < 20%) ✓
- trust_gap_rate = 100% (target < 5%) ✗ — but sample size = 1, not actionable

**Decision**: `maintain`
- Criteria for `upgrade` not met — trust_gap_rate is 100%, and data volume is insufficient (1 cycle ≠ 2 weeks).
- Criteria for `degrade` (trust_gap > 20%): technically triggered on this cycle, but governance requires a 7-day window, not a single event. No action.
- Criteria for `sunset` NOT triggered.

**Evidence**: [hold-ball-phase-b.md §4 governance thresholds]
**Decided by**: automated threshold check — single-cycle sample suppressed by minimum volume requirement

## Cycle Summary

```
trace (5 counter events) → eval (0% friction, 100% trust_gap on n=1)
  → feedback (1 TRUST_GAP signal) → governance (maintain, insufficient volume)
```

This cycle validates that all four interfaces function end-to-end: trace captures events, eval computes metrics, feedback provides structured user intent, governance evaluates but correctly defers on low sample size.
