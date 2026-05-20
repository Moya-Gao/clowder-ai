---
feature_ids: [F208]
topics: [harness-engineering, control-plane, contract]
doc_kind: spec
created: 2026-05-20
---

# Harness Unit Contract (F208)

> **Version**: 1.0.0
> **Status**: draft

## 1. Overview
A Harness Unit is a managed component of the agent execution environment (Prompt, Skill, Tool, or Guard). This contract defines the semantic interfaces for its lifecycle management.

## 2. Three-Layer Contract

### 2.1 Runtime Contract (load / execute / exit)
How the unit gets loaded and executed in the agent environment.

| Field | Type | Description |
|-------|------|-------------|
| `load_trigger` | `static \| dynamic \| on-demand` | When is this unit injected into context? |
| `execute_mechanism` | `mcp-tool \| prompt-injection \| guard-rule` | How does the runtime invoke it? |
| `exit_condition` | string | What ends this unit's active state? |

### 2.2 Eval Contract (activation / friction / success)
How the unit's effectiveness is measured (F192 template).

| Field | Type | Description |
|-------|------|-------------|
| `activation_signal` | string | Observable event proving the unit fired |
| `friction_metric` | string | User compensation behavior to detect |
| `success_signal` | string | Desired outcome that proves the unit worked |
| `regression_fixture` | string[] | Test scenarios for regression detection |

### 2.3 Governance Contract (lifecycle decisions)
Who decides the unit's future and under what criteria.

| Field | Type | Description |
|-------|------|-------------|
| `owner` | string | Cat responsible for this unit |
| `upgrade_criteria` | string | When to promote from experimental → active |
| `degrade_criteria` | string | When to switch to manual/dynamic injection |
| `sunset_signal` | string | Observable condition for retirement |

## 3. Unit Schema (registry.yaml)

```yaml
id: string          # Unique ID (e.g., hold_ball)
name: string        # Display name
type: string        # skill | tool | guard | prompt
status: string      # active | experimental | degraded | sunset
owner: string       # Cat ID (lead cat responsible for this unit)
description: string # What it does
```

## 4. The Four Semantic Interfaces

### 4.1 Trace (发生了什么)
Captures runtime events for telemetry (F153).
- **Input**: Execution context (invocationId, catId, threadId), tool arguments.
- **Output**: Structured trace event with `{ event_type, unit_id, timestamp, payload }`.
- **Trigger**: Unit lifecycle transitions — load, execute, complete, error, timeout.

### 4.2 Eval (有没有用)
Evaluates effectiveness using thread-level observation (F192).
- **Input**: Thread segment (sequence of events between two stable states) + time window.
- **Output**: `{ activation_detected: bool, friction_type: harness_gap | trust_gap | both_spinning | none, compensation_count: number }`.
- **Trigger**: Thread segment close (user sends next message) or time window expiration.
- **Observation Unit**: Thread Segment + Time Window, NOT single tool call (KD-3).

### 4.3 Feedback (要改什么)
Provides structured feedback channel for tuning.
- **Input**: User intervention event (cancel, override, manual retry) + context snapshot.
- **Output**: `{ reason_code: string, message: string, unit_id: string, thread_segment_id: string }`.
- **Trigger**: User cancels/overrides a harness unit action, or automated eval detects friction.

### 4.4 Governance (生命周期决策)
Decides the unit's future state based on accumulated evidence.
- **Input**: Eval aggregates (daily/weekly), feedback history, usage counters.
- **Output**: `{ decision: upgrade | degrade | sunset | maintain, evidence: string[], decided_by: string }`.
- **Trigger**: Periodic review (weekly cron) or threshold breach (friction_rate > 30%).

## 5. UI/UX Design (Design Gate)

Following the "In-context Observability" philosophy, the Harness Control Plane will surface unit states directly where they impact the user.

### 5.1 Pilot: Ball Ownership (Baton Status)
- **L1 In-context**: When `hold_ball` is active, a System Notice Bar (Warm Amber) appears in the thread showing:
    - 🧶 **Cat Name is holding the ball**
    - Reason (e.g., "Waiting for CI")
    - Next Step (e.g., "Check results")
    - Action Buttons: `[Release]` `[Cancel]` (with reason selection).
- **L2 Entity-self**: The Cat Avatar in the sidebar/thread will show a 🧶 badge during a hold.
- **L3 Deep-dive**: A "Harness" tab in the Hub to view the Registry and unit health.

### 5.2 Feedback Interface for hold_ball
When canceling a ball hold, the user is presented with structured reasons:
- `TRUST_GAP`: "I'll do it myself" / "I don't trust the wait".
- `HARNESS_GAP`: "This unit is not helping here".
- `STUCK`: "The agent seems stuck".

These feedback signals flow back to the **Eval Interface** to calculate the **Friction Metric**.
