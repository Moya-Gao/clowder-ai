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
| T+30s | User sends message | `cancelled` | agent.id=opus, cancel.reason=AUTO_USER_MESSAGE |
| T+2min | Cat holds ball again | `registered` | agent.id=opus |
| T+5min | Scheduler fires wake | `wake` | agent.id=opus |

Trace chain: hold → auto-cancel → hold → wake (complete happy path + interruption path).

### Step 2: Eval (Is It Working)

**Observation unit**: Thread segment from first hold to post-wake message.

**Compensation behavior detection**:
- Auto-cancel at T+30s: User sent a message while hold was active.
  - Reason = `AUTO_USER_MESSAGE` (system auto-cancel, not manual)
  - Classification: **Not a compensation behavior** — system correctly auto-cancelled because user wanted to interact directly.
- Second hold at T+2min: Cat re-holds after user interaction completed.
  - No cancel → wake fires normally at T+5min.
  - Classification: **Success** — hold fulfilled its purpose (bounded wait).

**Friction Metric calculation**:
- Total cancels in window: 1 (`cancelled` counter)
- Cancels with structured reason: 1 (`cancelled_with_reason` counter, reason=AUTO_USER_MESSAGE)
- Friction = 1 - (1/1) = 0% — all cancels have reasons.

**Trust gap rate**: 0 TRUST_GAP cancels / 1 total cancel = 0%.

**Conclusion**: Unit is working correctly. No friction detected.

### Step 3: Feedback (What to Change)

**Structured feedback received**: None in this cycle.
- The auto-cancel had reason `AUTO_USER_MESSAGE` — this is expected behavior, not a complaint.
- No manual DELETE with TRUST_GAP/HARNESS_GAP/STUCK reason observed.

**Feedback channel validation**:
- DELETE endpoint accepts optional `{ reason, message }` body ✓
- Cancel reason flows to OTel counter attribute ✓
- `cancel.reason` is in metric allowlist ✓

**Actionable insight**: No feedback signals indicate problems. Unit is transparent and non-intrusive.

### Step 4: Governance (Lifecycle Decision)

**Input**: Eval aggregates from this cycle.
- friction_rate = 0% (target < 20%) ✓
- trust_gap_rate = 0% (target < 5%) ✓
- zombie_rate = N/A (Phase C — not yet measurable)

**Decision**: `maintain`
- Criteria for `upgrade` (friction < 10% AND trust_gap < 5% over 2 weeks) cannot be evaluated yet — insufficient data volume (1 cycle ≠ 2 weeks).
- Criteria for `degrade` (friction > 30% OR trust_gap > 20%) NOT triggered.
- Criteria for `sunset` (zero holds for 3 months) NOT triggered.

**Evidence**: [hold-ball-phase-b.md §4 governance thresholds]
**Decided by**: automated threshold check (no escalation needed)

## Cycle Summary

```
trace (4 events) → eval (0% friction, 0% trust_gap)
  → feedback (no actionable signals) → governance (maintain)
```

The four semantic interfaces form a closed loop: trace provides data, eval interprets it, feedback enriches with user intent, governance decides the unit's future. This cycle validates that the loop functions end-to-end for hold_ball.
