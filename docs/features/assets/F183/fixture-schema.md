---
feature_ids: [F183]
related_features: [F081, F123]
topics: [bubble-pipeline, replay-fixture, BubbleEvent, invariant-gate]
doc_kind: reference
created: 2026-04-30
---

# F183 Bubble Replay Fixture Schema

This file defines the replay fixture payload shape for Phase B0 and later phases. ADR-033 is the contract source for the accepted `BubbleEvent` vocabulary; this file owns payload fields, sample JSON, and golden replay expectations.

## BubbleEvent Types

```text
local_placeholder_created
stream_started
stream_chunk
thinking_chunk
tool_event
cli_output
rich_block
callback_final
history_hydrate
draft_restore
cache_restore
done
error
timeout
```

## Fixture Shape

```ts
interface BubbleReplayFixture {
  id: string;
  description: string;
  sourceRefs?: string[];
  initialMessages?: ChatMessageFixture[];
  events: BubbleEventFixture[];
  expected: BubbleReplayExpected;
}

interface BubbleEventFixture {
  type: BubbleEventType;
  threadId: string;
  actorId: string;                 // catId or "system"
  canonicalInvocationId?: string;  // OUTER parentInvocationId
  bubbleKind: BubbleKind;
  originPhase: "draft/local" | "stream" | "callback/history";
  sourcePath: "active" | "background" | "callback" | "hydration" | "queue" | "draft" | "idb" | "replay" | "unknown";
  messageId?: string;
  seq?: number;
  timestamp?: number;
  payload?: Record<string, unknown>;
}

interface BubbleReplayExpected {
  messages: ChatMessageFixture[];
  violations?: Array<{
    violationKind: "duplicate" | "phase-regression" | "canonical-split";
    existingMessageId: string | null;
    incomingMessageId: string | null;
    recoveryAction: "catch-up" | "quarantine" | "sot-override" | "none";
  }>;
}
```

## Payload Extension Rules

- Contract fields above are fixed by ADR-033 Section 2.5 and Section 3.1.
- Provider-specific data must live under `payload`; it must not add new top-level identity fields.
- Adding a new `BubbleEventType` requires updating ADR-033 first.
- Adding a new `bubbleKind` requires updating ADR-033 and the replay harness stable identity tests first.

## Minimal Example

```json
{
  "id": "f123-td112-stream-callback-duplicate",
  "description": "stream and callback for one canonical invocation must not coexist as two assistant_text bubbles",
  "events": [
    {
      "type": "stream_chunk",
      "threadId": "thread-1",
      "actorId": "codex",
      "canonicalInvocationId": "inv-1",
      "bubbleKind": "assistant_text",
      "originPhase": "stream",
      "sourcePath": "active",
      "messageId": "msg-stream",
      "payload": { "content": "stream text" }
    },
    {
      "type": "callback_final",
      "threadId": "thread-1",
      "actorId": "codex",
      "canonicalInvocationId": "inv-1",
      "bubbleKind": "assistant_text",
      "originPhase": "callback/history",
      "sourcePath": "callback",
      "messageId": "msg-callback",
      "payload": { "content": "final text" }
    }
  ],
  "expected": {
    "messages": [{ "id": "msg-stream", "content": "final text" }],
    "violations": []
  }
}
```

The example's expected output represents the Phase B1 Single Writer target. Phase B0's framework can already express the input and detect violations; B1 will supply the reducer adapter that produces the merged final message.
