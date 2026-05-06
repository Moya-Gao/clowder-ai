---
feature_ids: [F181]
related_features: [F153]
topics: [telemetry, observability, debug]
doc_kind: spec
created: 2026-04-30
---

# F181: Prompt X-Ray + Cross-Route A2A Trace Propagation

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P2
>
> Canonical prompt capture for debugging + trace continuity across A2A cat invocations.

## Why

When a cat behaves unexpectedly, maintainers need to inspect the actual prompt that was sent. Additionally, A2A cross-route invocations (callback post_message, text-scan @mention, InvocationQueue) break trace causality — the child route has no span parent linking it back to the mentioner.

## What

### Trace Propagation

- `CallerTraceContext` shared type (W3C TraceContext aligned: traceId/spanId/traceFlags)
- `setTraceContext` as proper `IAuthInvocationBackend` method (Memory + Redis)
- Propagate through all 3 A2A paths: text-scan @mention, post_message callback, InvocationQueue callback
- Remote parent context reconstruction in `AgentRouter.routeExecution()`
- `mention_dispatch` spans for A2A handoff causality tracking
- Route aggregate attributes: `total_cats_invoked`, `total_tokens`, `has_a2a_handoff`

### Prompt X-Ray

- File-based canonical prompt snapshot store with gzip compression
- Async capture bridge in `invokeSingleCat` (zero latency impact on invocation hot path)
- GET list/detail API endpoints with session auth + captureId validation
- Hub trace detail X-Ray button + PromptInspector component (system/user/effective/meta tabs)
- TTL enforcement on read and list (not just on write overflow)
- Local trace store TTL extended from 2h to 24h

## Acceptance Criteria

- [x] AC-1: CallerTraceContext type extracted to genai-semconv.ts and used across all propagation sites
- [x] AC-2: setTraceContext is a proper IAuthInvocationBackend method with Memory and Redis implementations
- [x] AC-3: Cross-route spans share traceId when invoked via A2A callback
- [x] AC-4: mention_dispatch spans link mentioner to dispatched targets
- [x] AC-5: Route aggregates (cats invoked, tokens, A2A handoff) set on route span
- [x] AC-6: Prompt capture gated by PROMPT_CAPTURE=on env var
- [x] AC-7: captureId validated as UUID before filesystem access
- [x] AC-8: TTL enforced on read and list, not just overflow prune
- [x] AC-9: Behavioral tests for backend contract (setTraceContext round-trip, TTL slide, peekRecord)
- [x] AC-10: Behavioral tests for queue callerTraceContext flow-through

## Dependencies

- **Evolved from**: F153 (Observability Infrastructure)
- **Blocked by**: none
- **Related**: F174 (Backend Facade), F175 (Unified Queue)

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| KD-1 | Reserved slot filled with Prompt X-Ray + Trace Propagation | team lead confirmed scope | 2026-05-06 |
| KD-2 | CallerTraceContext as shared type, not inline | Reviewer finding: reduce repetition across 7+ files | 2026-05-06 |
| KD-3 | setTraceContext as backend interface method | Reviewer finding: peekRecord mutation fragile for Redis | 2026-05-06 |
| KD-4 | Combined PR (not split) | User decision: both concerns are part of F181 | 2026-05-06 |
