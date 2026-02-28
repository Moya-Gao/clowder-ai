---
feature_ids: []
debt_ids: []
topics:
  - mentions
  - delivery
  - diagnostics
  - mcp
  - routing
doc_kind: plan
created: 2026-02-28
---

# Mention Dual-Path Deconfusion (Plan)

## Context

We currently have two paths that can surface the same “@mention” content to a target cat:

- **Mechanism A (system forward / routing)**: the system forwards or routes a mention to the target cat as part of the normal message flow, so the cat can “receive it” without manually calling MCP tools.
- **Mechanism B (`pending-mentions`)**: `GET /api/callbacks/pending-mentions` returns recent mention messages until explicitly acknowledged via `POST /api/callbacks/ack-mentions`.

Because Mechanism A does **not** advance the mention-ack cursor, a cat who later calls `pending-mentions` can unexpectedly fetch a backlog of historical mentions that were already “delivered” via Mechanism A. If their context has been compressed, this looks like “new accumulated messages” and causes confusion.

At the same time, we do want to preserve the ability to intentionally **review historical mentions** (especially after context compression), and we also want a safe recovery path when delivery is intermittent.

Decision (from discussion): **Option B** — keep human UI clean, but give cats enough metadata/controls to avoid misinterpreting “historical resurfaced mentions” as new backlog.

## Goals / Non-goals

### Goals

- Reduce confusion: when a cat intentionally reviews historical mentions, make it explicit that these are **previously acknowledged** items.
- Preserve history review: allow cats to intentionally request previously delivered mentions.
- Keep human-facing UI clean: do not surface internal delivery mechanics to the human by default.
- Provide lightweight diagnostics for operators/debugging (logs-first).

### Non-goals

- Replacing either mechanism entirely.
- Perfect “read receipt” semantics (we track delivery channels, not human/cat cognition).

## Proposal (Simplified)

### 1) Auto-ack mention cursor when worklist routing succeeds

Instead of tracking “delivery facts” for every message, we can eliminate the surprise backlog at the source:

- When `enqueueA2ATargets(...)` succeeds for a `targetCatId`, immediately advance the mention-ack cursor for that `(userId, targetCatId, threadId)` up to `triggerMessage.id` by calling:
  - `deliveryCursorStore.ackMentionCursor(userId, targetCatId, threadId, triggerMessage.id)`

Rationale:

- Mechanism A is not a “delivery channel”; it is routing. But once routing has accepted the work (enqueue succeeded), it is safe to treat the mention as “handled by the system path”, so `pending-mentions` should not later re-surface it as “pending” by default.
- If the cat crashes, the message is still in `MessageStore` and the worklist retry path should handle re-invocation. `pending-mentions` is not a reliable retry mechanism in practice (cats don’t routinely poll it).

### 2) Add an explicit “history review” switch to `pending-mentions`

Default behavior should prioritize clarity and match cursor semantics:

- Default: return only mentions **after** the mention-ack cursor (i.e., unacked/pending window).
- Add a query param (name bikeshed):
  - `includeAcked=1` to include mentions **at/before** the cursor (explicit “I’m reviewing history” intent).

Additionally, annotate each returned mention with a simple flag:

- `acked: boolean` (derived by comparing `id` with the current ack cursor)

This is sufficient for the cat to interpret “this is history” without introducing a new per-message store.

### 3) Diagnostics (defer UI; logs-first)

Do not add a human-facing diagnostics panel initially. If we need diagnostics, start with:

- server logs around `enqueueA2ATargets` auto-ack (catId, threadId, messageId, cursor before/after)
- an internal-only debug endpoint if/when needed (gated behind dev/admin mode)

## Behavior Summary

| Scenario | Result |
|---|---|
| Mention routed via Mechanism A | enqueue success → auto-ack mention cursor up to `triggerMessage.id` |
| Cat later calls `pending-mentions` (default) | No surprise backlog from prior routed mentions |
| Cat calls `pending-mentions?includeAcked=1` | Returns historical mentions too, each flagged `acked:true/false` |

## Testing Strategy

- Unit tests for:
  - `pending-mentions` filtering behavior (default vs `includeAcked`)
  - `acked` flag correctness vs cursor
  - multi-thread + multi-user isolation (no cross leak)
- Integration test:
  - simulate A-routing enqueue → auto-ack, then B-pull returns empty by default and returns historical with `includeAcked`

## Open Questions

- Where is the best hook to place the auto-ack (enqueue success vs “cat execution completed”)?
  - current recommendation: enqueue success (simple + removes surprise backlog)
  - conservative alternative: ack on successful cat completion (more plumbing)
