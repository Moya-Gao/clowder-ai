---
feature_ids: [F208]
topics: [harness-engineering, control-plane, hold-ball, trace, eval, governance]
doc_kind: impl
created: 2026-05-20
---

# Hold Ball — Phase B: Four Interface Implementation

> Pilot unit: `hold_ball` | Phase B end-to-end verification

## 1. Trace Interface (AC-B1)

### 1.1 OTel Counters

| Counter | Metric Name | Attributes | When Incremented |
|---------|-------------|------------|------------------|
| holdBallRegistered | `cat_cafe.hold_ball.registered` | `agent.id` | POST /api/callbacks/hold-ball returns 200 |
| holdBallCancelled | `cat_cafe.hold_ball.cancelled` | `agent.id`, `cancel.reason` | Any cancel: manual DELETE or auto-cancel on user message |
| holdBallCancelledWithReason | `cat_cafe.hold_ball.cancelled_with_reason` | `agent.id`, `cancel.reason` | Cancel includes structured reason (TRUST_GAP/HARNESS_GAP/STUCK/OTHER) |
| holdBallWake | `cat_cafe.hold_ball.wake` | `agent.id` | Scheduler fires hold-ball reminder (reminder template execute) |
| holdBallRejected | `cat_cafe.hold_ball.rejected` | `agent.id` | POST returns 429 (maxHoldsPerWindow exceeded) |

Attribute allowlist: `cancel.reason` added to `metric-allowlist.ts` (CANCEL_REASON in genai-semconv.ts).

Implementation:
- Counters: `packages/api/src/infrastructure/telemetry/instruments.ts`
- Allowlist: `packages/api/src/infrastructure/telemetry/metric-allowlist.ts`
- Wake wiring: `packages/api/src/infrastructure/scheduler/templates/reminder.ts`

### 1.2 Trace Event Schema

Each hold_ball lifecycle event is observable via the counters above plus structured log entries:

```
event_type: hold | cancel | reject | wake | zombie
unit_id: hold_ball
timestamp: ISO-8601
payload:
  threadId: string
  catId: string
  taskId: string        # scheduler task ID (hold-ball-*)
  reason?: string       # hold: reason for holding; cancel: TRUST_GAP|HARNESS_GAP|STUCK|OTHER|AUTO_USER_MESSAGE
  wakeAfterMs?: number  # hold only
  holdsInWindow?: number
```

Event mapping to existing code paths:
- **hold**: `holdBallRegistered` counter + log `F167 C1: hold_ball registered`
- **cancel**: `holdBallCancelled` counter (manual DELETE + auto-cancel on user message with reason `AUTO_USER_MESSAGE`)
- **reject**: `holdBallRejected` counter + log `F167 C1: hold_ball rejected`
- **wake**: `holdBallWake` counter in reminder template, gated on `hold-ball-` task ID prefix
- **zombie**: Requires eval pipeline correlation: wake fired but no subsequent invocation for that cat in that thread within a followup window. Phase C scope — needs cross-referencing `holdBallWake` with invocation traces

### 1.3 Observability Path

Counter data flows through the OTel SDK's MeterProvider → configured exporter (Prometheus or OTLP). Query via:
- `GET /api/telemetry/metrics` (if Prometheus endpoint exposed)
- OTel collector → Grafana dashboard (production path)

## 2. Eval Interface (AC-B2)

### 2.1 Observation Unit

Per eval-model.md, the observation unit is a **thread segment** — the sequence of events between two stable states in a thread. For hold_ball, a segment spans from `hold` event to either `wake`, `cancel`, or `zombie`.

### 2.2 Trust Gap Detection (Primary Compensation Pattern)

**Definition**: User cancels an active hold, indicating they don't trust the hold mechanism to work correctly.

**Detection rule**:
```
IF holdBallCancelled fires
AND cancel.reason IN (TRUST_GAP, unspecified)
AND time_since_hold < wakeAfterMs * 0.5
THEN trust_gap detected
```

Rationale: A cancel within the first half of the hold window, especially with TRUST_GAP reason or no reason at all, indicates the user didn't believe the hold would succeed. Cancels near the end of the window are more likely genuine condition changes.

**Simplified v0 (counter-based)**:
```
trust_gap_rate = holdBallCancelled{cancel.reason="TRUST_GAP"} / holdBallCancelled{total}
```

When `trust_gap_rate > 0.3` over a rolling 7-day window, the hold_ball unit should be flagged for governance review.

### 2.3 Friction Metric

The Friction Metric for hold_ball is the proportion of cancels WITHOUT a structured reason:

```
friction = 1 - (holdBallCancelledWithReason / holdBallCancelled)
```

- **Phase B baseline (pre-deploy)**: 100% (no cancel reason field existed)
- **Phase B target**: < 20% (most cancels should include a reason)
- **Interpretation**: High friction means users cancel without explaining why, making it impossible to distinguish trust_gap from harness_gap. The feedback channel is not working.

### 2.4 Thread-Segment Observation Window

| Window | Purpose | Aggregation |
|--------|---------|-------------|
| Per-segment | Individual hold lifecycle (hold→outcome) | Duration, outcome type |
| Hourly | Operational health | hold_count, cancel_rate, reject_rate |
| Daily/Weekly | Governance input | trust_gap_rate, friction, zombie_rate |

## 3. Feedback Interface (AC-B3)

### 3.1 Cancel Reason Schema

Added to `DELETE /api/callbacks/hold-ball/:taskId`:

```typescript
{
  reason?: 'TRUST_GAP' | 'HARNESS_GAP' | 'STUCK' | 'OTHER',
  message?: string  // max 500 chars, free-text context
}
```

Reason semantics (from eval-model.md):
- **TRUST_GAP**: User doesn't trust the hold to complete correctly
- **HARNESS_GAP**: The hold mechanism itself is inadequate for this situation
- **STUCK**: The agent appears stuck in a loop
- **OTHER**: None of the above

### 3.2 Counter Pair (Friction Metric)

- `cat_cafe.hold_ball.cancelled` — all cancels (denominator)
- `cat_cafe.hold_ball.cancelled_with_reason` — cancels with structured reason (numerator)

Friction = `1 - (cancelled_with_reason / cancelled)`

## 4. Governance Interface (AC-B4)

### 4.1 Upgrade Criteria

**Condition**: `friction_rate < 10%` AND `trust_gap_rate < 5%` sustained over 2 consecutive weeks.

**Concrete example**: If over 14 days, 50 holds fire, 8 are cancelled, 7 of those cancels have a reason, and only 1 is TRUST_GAP:
- friction = 1 - 7/8 = 12.5% → NOT met (needs < 10%)
- trust_gap = 1/8 = 12.5% → NOT met (needs < 5%)
- Decision: **maintain** — keep current configuration

**Action on upgrade**: Promote hold_ball sub-rules from "dynamic injection" to "always-on" in dispatch context. Remove the manual confirmation step if one was added during degradation.

### 4.2 Degrade Criteria

**Condition**: `friction_rate > 30%` OR `trust_gap_rate > 20%` over any 7-day window. (Phase C adds `zombie_rate > 15%` once eval pipeline correlation is available.)

**Concrete example**: Over 7 days, 30 holds fire, 12 are cancelled, only 3 have a reason, and 6 are TRUST_GAP:
- friction = 1 - 3/12 = 75% → TRIGGERED
- trust_gap = 6/12 = 50% → TRIGGERED
- Decision: **degrade** — add manual confirmation step before hold_ball fires

**Action on degrade**: Switch `load_trigger` from `dynamic` to `on-demand` (cat must explicitly request hold). Add a system message asking user to confirm before hold begins.

### 4.3 Sunset Signal

**Condition**: Zero `holdBallRegistered` events over 3 consecutive months, AND PR tracking webhooks (F167) cover 100% of wait-for-external scenarios.

**Concrete example**: CI webhook integration (future) means cats no longer need to poll — they get notified directly. If hold_ball hasn't been called in 90 days because webhooks handle all cases:
- Decision: **sunset** — remove hold_ball from dispatch context, archive registry entry

### 4.4 Governance Review Cadence

- **Weekly**: Manual check of friction_rate and trust_gap_rate against documented thresholds (automation deferred per Phase C retrospective)
- **On threshold breach**: Escalate to owner (opus) via thread message
- **Monthly**: Registry review — is the unit still relevant?
