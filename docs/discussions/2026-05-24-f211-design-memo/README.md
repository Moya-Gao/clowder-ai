---
feature_ids: [F211]
related_features: [F061, F102, F124, F200, F201, F209, F210]
topics: [session-chain, antigravity, runtime-session, transcript, digest, ide-direct]
doc_kind: design-memo
status: review-ready
created: 2026-05-24
participants: [codex, antig-opus, opus-47, landy]
---

# F211 Phase 0 Design Memo — Cross-Runtime Session Transparency

## 0. Decision

F211 should not implement a parallel Antigravity memory system. It should make Antigravity runtime sessions first-class Cat Cafe session-chain evidence.

The Phase A compatibility path is:

- Keep `SessionRecord.cliSessionId = cascadeId` for Cat-Cafe-dispatched Antigravity Desktop cascades.
- Stop using `ephemeralSession: true` as the cascade-rotation behavior.
- Seal/create only from explicit lifecycle edges, targeted by old `cascadeId` / `cliSessionId`.
- Materialize Antigravity trajectory output into the existing `TranscriptWriter` buffer so `read_session_events` and `read_session_digest` are useful, not empty shells.

The longer-term model is a runtime-session boundary under `identity-session`, with `memory` consuming its transcript/digest output. Phase A must remain compatible with a later `Session.kind = long-lived-cascade` / `external-runtime-conversation` extension.

## 1. Current-State Audit

### 1.1 Antigravity Desktop Has A JSON Shadow Session Map

Current Antigravity Desktop reuse is owned by `AntigravityBridge`, not by Session Chain:

- `AntigravityBridge` has `sessionMap`, `deletedKeys`, and `sessionStorePath`; the default file is `data/antigravity-sessions.json`.
- `getOrCreateSession(threadId, catId)` maps `threadId:catId -> cascadeId`, validates the cascade is idle, starts a new cascade otherwise, then persists the JSON map.
- `resetSession(threadId, catId)` only deletes the JSON binding and persists it.

Code anchors:

- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts:252` defines the in-memory map fields.
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts:706` starts `getOrCreateSession`.
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts:742` starts `resetSession`.
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts:886` / `:902` load and persist the JSON file.

Consequence: Cat Cafe cannot list, seal, digest, or search this state through `SessionChainStore`.

### 1.2 Antigravity Emits Ephemeral Session Init

`AntigravityAgentService` gets a cascade through the Bridge, creates a side-effect journal keyed by that cascade, may retire an oversized cascade, then emits `session_init` with `ephemeralSession: true`.

Code anchors:

- `AntigravityAgentService.ts:414` gets or creates the current cascade.
- `AntigravityAgentService.ts:528` preflight-retire deletes the old JSON binding and creates a new cascade.
- `AntigravityAgentService.ts:548` emits `session_init`.
- `AntigravityAgentService.ts:552` sets `ephemeralSession: true`.
- `AntigravityAgentService.ts:693` repeats reset/get/new-session on recovery retry.

This does not prevent the first `SessionRecord` from being created. The real bug is rotation: if an active record exists and the session id changes, `invoke-single-cat` treats an ephemeral session as a mutable binding update instead of a seal/create boundary.

### 1.3 Existing Session Chain Can Seal/Create, But Only With The Right Signal

`invoke-single-cat` already has the compatibility hook F211 needs:

- On `session_init`, it stores the CLI session id and ensures a SessionRecord exists.
- If active `cliSessionId` differs and `ephemeralSession` is true, it updates the existing record.
- If active `cliSessionId` differs and `ephemeralSession` is false, it requests seal/finalize on the old record and creates a new one.
- Agent messages are appended to `TranscriptWriter` using the active session record.

Code anchors:

- `invoke-single-cat.ts:1202` handles `session_init`.
- `invoke-single-cat.ts:1227` looks up the active record by `(catId, threadId)`.
- `invoke-single-cat.ts:1230` updates the active record for ephemeral sessions.
- `invoke-single-cat.ts:1238` starts the non-ephemeral seal/create path.
- `invoke-single-cat.ts:1714` appends raw agent messages to transcript buffers.

Phase A can reuse this, but only after Antigravity emits non-ephemeral lifecycle events at safe lifecycle points.

### 1.4 Session Chain Storage Is Narrow

The current `SessionRecord` shape has `cliSessionId`, `threadId`, `catId`, `userId`, sequence, status, health, usage, seal reason, and continuity fields. It has no structured runtime kind, external conversation id, or identity history field.

Code anchors:

- `packages/shared/src/types/session.ts:15` defines `SessionRecord`.
- `RedisSessionChainStore.ts:5` documents Redis keys: detail hash, chain zset, active index, CLI index.
- `RedisSessionChainStore.ts:66` creates records.
- `RedisSessionChainStore.ts:181` updates the CLI index.
- `RedisSessionChainStore.ts:238` supports `getByCliSessionId`.

Phase A can store `cascadeId` in `cliSessionId`, but AC-0F requires either schema extension or a sidecar metadata store for identity history.

### 1.5 Transcript/Digest Already Work If Events Are Written

`TranscriptWriter` buffers events per `sessionId`, flushes JSONL/index/digest on seal, and creates extractive digests from visible `text`, `assistant`, `tool_use`, `tool_result`, `error`, and selected `system_info` events.

Code anchors:

- `TranscriptWriter.ts:91` appends buffered events.
- `TranscriptWriter.ts:120` flushes buffered events to disk.
- `TranscriptWriter.ts:181` generates extractive digest.
- `TranscriptWriter.ts:203` extracts tool names and file operations.
- `TranscriptWriter.ts:231` extracts errors.
- `TranscriptWriter.ts:242` extracts visible assistant text.
- `SessionSealer.ts:90` requests a seal.
- `SessionSealer.ts:141` finalizes.
- `SessionSealer.ts:321` flushes transcript and digest.

Therefore F211 does not need a second transcript store. It needs to guarantee Antigravity events are appended to the correct session and that seal waits until the last relevant events are appended.

### 1.6 Antigravity Trajectory Is Already Transformed Into Agent Messages

`transformTrajectorySteps` maps Antigravity trajectory steps into Cat Cafe `AgentMessage`s:

- planner responses become `text`;
- thinking/tool activity becomes `system_info`;
- tool calls/results become `tool_use` / `tool_result`;
- errors become `error`;
- unknown/silent steps are logged or skipped.

Code anchors:

- `AntigravityAgentService.ts:952` transforms each step batch.
- `antigravity-event-transformer.ts:115` classifies step buckets.
- `antigravity-event-transformer.ts:165` starts transformation.
- `antigravity-event-transformer.ts:174` emits assistant `text`.
- `antigravity-event-transformer.ts:214` emits `tool_use` and `tool_result`.
- `antigravity-event-transformer.ts:260` emits `error`.

This transformed message stream is the Phase A materialization source. Raw trajectory detail remains debug evidence, not the primary digest input.

### 1.7 IDE-Direct Is Still A Blind Spot

Cat-Cafe-dispatched Antigravity invokes have `threadId`, `catId`, and callback context. IDE-direct conversations do not start from `invoke-single-cat`, so no `session_init` reaches Session Chain. Existing callback credentials are invocation-scoped and cannot be assumed in IDE-direct mode.

Phase B must add a persistent-auth registration path. It cannot rely on `CAT_CAFE_INVOCATION_ID` / callback token.

### 1.8 F210 AGY CLI Is A Separate Carrier

F210's `agy` path is in `GeminiAgentService.invokeAntigravityCLI`:

- It emits normal, non-ephemeral `session_init` with an `agy-*` conversation id.
- It invokes `agy --conversation <sessionId> --print ...`.
- It flows through the CLI spawn/invoke path and existing transcript writer.

Code anchors:

- `GeminiAgentService.ts:584` starts `invokeAntigravityCLI`.
- `GeminiAgentService.ts:614` picks the AGY session id.
- `GeminiAgentService.ts:617` emits normal `session_init`.
- `GeminiAgentService.ts:637` passes `--conversation`.
- `GeminiAgentService.ts:720` uses the CLI spawn layer.

F210 should not own Antigravity Desktop cascade transparency. If AGY later exposes a long-lived structured local control plane, it should adapt into the F211 registration protocol rather than build a second session registry.

## 2. Architecture Cell

```markdown
Architecture cell: identity-session + memory
Map delta: update required
Why: F211 creates a runtime-session identity/binding boundary under identity-session. Memory consumes only the materialized transcript/digest evidence produced by that boundary.
```

Map delta:

- Add `identity-runtime-session` as a subcell under `identity-session`.
- `identity-runtime-session` owns runtime session identity, external conversation/cascade binding, lifecycle registration, seal reason, and identity history.
- `memory` owns retrieval/indexing of materialized transcript/digest evidence only. It must not decide roster truth, runtime binding, or active cascade ownership.
- `callback-auth` remains credential/lifecycle auth owner; F211 consumes persistent agent/external-session auth rather than inventing callback semantics.

## 3. Runtime Session Model

Phase A uses existing `SessionRecord` as the compatibility envelope:

```ts
SessionRecord.cliSessionId = antigravityCascadeId;
SessionRecord.threadId = Cat Cafe thread id;
SessionRecord.catId = current Cat Cafe cat id;
SessionRecord.sealReason = classified runtime rollover reason;
```

Required Phase A sidecar metadata:

```ts
type RuntimeSessionMetadata = {
  sessionId: string;
  runtime: 'antigravity-desktop';
  runtimeSessionId: string;      // cascadeId
  runtimeConversationId?: string;
  surface: 'cat-cafe-dispatch';
  identityHistory: Array<{
    catId: string;
    model: string;
    modelVerified?: boolean;
    provider?: string;
    from: number;
    to?: number;
    source: 'session_init' | 'trajectory' | 'external_registration';
  }>;
  lifecycle: {
    startedAt: number;
    lastObservedAt: number;
    sealReason?: string;
  };
};
```

Storage can be implemented either as:

1. A `runtimeSessionMetadata` JSON field on `SessionRecord` plus Redis serialization support.
2. A `RuntimeSessionStore` sidecar keyed by internal `sessionId` and `runtimeSessionId`.

Phase A should prefer the sidecar if keeping `SessionRecord` narrow avoids churn. Phase D may later promote the fields into `Session.kind`.

## 4. Lifecycle Rules

### 4.1 Cat-Cafe-Dispatched Antigravity Desktop

1. On first observed cascade, create active `SessionRecord` with `cliSessionId = cascadeId`.
2. On repeated same `cascadeId`, update last-observed runtime metadata only; do not create a new session.
3. On explicit rotation, resolve the old record by `getByCliSessionId(oldCascadeId)`.
4. Drain the old cascade materialization stream.
5. Call `sessionSealer.requestSeal({ sessionId: old.id, reason })`.
6. Finalize after transcript flush.
7. Create the new `SessionRecord` with `cliSessionId = newCascadeId`.

Prohibited:

- Do not seal based on `active.cliSessionId !== currentCascadeId` on a read path.
- Do not seal the active `(catId, threadId)` record if the old cascade id is unknown.
- Do not overwrite `cliSessionId` when the cause is cascade rotation.

### 4.2 Seal Reasons

Required initial reason vocabulary:

| Reason | Meaning |
|--------|---------|
| `oversized_retire` | Preflight health marks the old cascade retired due to context/step pressure |
| `user_initiated` | User or Antigravity UI explicitly starts New Cascade |
| `model_capacity` | Upstream capacity failure triggers safe fresh cascade |
| `empty_response` | Empty planner response triggers safe fresh cascade |
| `stream_error` | Stream interruption triggers safe fresh cascade |
| `tool_conflict` | Tool/approval conflict forces reset |
| `unsafe_side_effect` | Side-effect journal blocks automatic resume/rotation |
| `runtime_error_reset` | Unclassified error reset; should be rare and visible |

Digest policy can group these, but storage must preserve the exact reason.

### 4.3 Same Cascade, Model/Cat Changes

The stable identity is the runtime session (`cascadeId`), not the current model label.

Rules:

- Same `cascadeId` with a different model remains one runtime session and one `SessionRecord`.
- The model/cat change is appended to `identityHistory`.
- If `catId` changes because the logical Cat Cafe cat changed, Phase A should fail closed unless the runtime metadata can prove the same user intentionally switched identities.
- The transcript event should include the event-time `catId`/model metadata so later digest/search can explain mixed identity.

This avoids silently overwriting attribution while not splitting one Antigravity conversation into fake CLI sessions.

### 4.4 Same Thread + Same Cat Concurrent Cascades

Phase A does not need full concurrent same-thread same-cat support. It must fail closed:

- If two active cascades claim the same `(threadId, catId)` and neither is sealed, do not auto-seal either based on active mismatch.
- Register the second as `runtime_conflict_pending` or emit a visible diagnostic.
- Require an explicit user/system lifecycle edge to choose which cascade to seal.

Multi-cat same-thread cascades are supported because `catId` is part of the chain key.

## 5. Transcript And Digest Materialization

### 5.1 Source Of Truth

The primary materialized stream for Phase A is the transformed AgentMessage stream from Antigravity trajectory steps:

- `text` becomes assistant visible content.
- `tool_use` / `tool_result` becomes tool activity.
- `error` becomes error evidence.
- selected lifecycle `system_info` becomes runtime state evidence.

Raw trajectory steps remain available for debug/audit but should not be directly fed into high-level digest unless they map to user-visible or lifecycle events.

### 5.2 Proof Fixture

Phase A must add a fixture shaped like this:

1. Simulate a cascade with one planner response and one tool call/result.
2. Run it through Antigravity transformation and session-chain append.
3. Seal/finalize.
4. Assert `TranscriptReader.readEvents(sessionId, threadId, catId)` returns at least:
   - one `text` event containing the assistant answer;
   - one lifecycle `system_info` event with `cascadeId` / `sealReason` or runtime metadata;
   - tool events if the trajectory contains tool activity.
5. Assert `TranscriptReader.readDigest(sessionId, threadId, catId)` returns `recentMessages` with the visible answer and does not return an empty shell.

This closes Bengal review issue 1 directly.

### 5.3 Noise Policy

Noise tiers:

| Tier | Examples | Transcript | Extractive digest |
|------|----------|------------|-------------------|
| User-visible | final answer, surfaced error, retry explanation | keep | keep |
| Lifecycle | cascade created/retired, seal reason, identity switch | keep | summarize |
| Tool evidence | tool use/result, file ops, refused unsafe command | keep | keep if outcome-relevant |
| Debug churn | repeated `context canceled`, MCP allowlist refusal retries, canceled duplicate step | keep in debug detail or folded event | aggregate count/sample only |
| Silent checkpoint | internal checkpoint, empty planner response with no outcome | omit unless needed for failure classification | omit |

`context canceled` should appear in high-level digest only when it changes the user-visible outcome, such as blocking UI validation or aborting an invocation.

## 6. Drain / Flush Boundary

The hard part is not calling `requestSeal`; it is knowing the old cascade has no more meaningful events to materialize.

Phase A must add a drain barrier around Antigravity Desktop lifecycle edges:

```ts
await bridge.drainCascade(oldCascadeId, {
  waitFor: ['trajectory_idle', 'native_executor_idle', 'tool_result_writeback_idle'],
  timeoutMs: 5000,
});
```

Minimum acceptable implementation:

- Bridge tracks in-flight RPC count per `cascadeId`.
- `nativeExecuteAndPush` and `pushToolResult` increment/decrement that count.
- `pollForSteps` final terminal cursor or timeout contributes `trajectory_idle`.
- `drainCascade` resolves when trajectory is idle and in-flight count is zero.
- If drain times out, fail closed: do not create a new sealed digest pretending completeness. Mark old session `runtime_seal_pending` or emit a visible diagnostic, then retry drain on next invocation/reaper.

This is stronger than the current `SessionSealer.finalize` timeout, because `finalize` can only flush events already appended. It cannot recover events that were still in Antigravity LS or pending `pushToolResult`.

## 7. IDE-Direct Registration

Phase B needs a new persistent-auth registration contract. Shape:

```ts
register_external_session({
  runtime: 'antigravity-desktop',
  runtimeSessionId: cascadeId,
  runtimeConversationId,
  catId,
  model,
  title,
  startedAt,
  lastObservedAt,
  surface: 'ide-direct',
  userHint
})
```

Auth rules:

- Use agent-key / sidecar persistent auth, not callback tokens.
- Every registration writes an audit event.
- No `threadId` is required. The default record is an external runtime session, not a normal Cat Cafe thread transcript.
- Binding to a normal thread is explicit and later, for example `bind_external_session_to_thread`.

Storage options:

1. Create a private runtime thread and regular session record.
2. Create an orphan runtime-session record and expose it through session-chain tools.

Recommended Phase B default: orphan runtime-session record first. It avoids polluting normal thread history, and a later bind can attach it to a thread when the user wants that.

## 8. F201 / F209 / F210 Boundary

| Feature | Owns | F211 Relationship |
|---------|------|-------------------|
| F201 | Antigravity Desktop reliability contract: explainable failures, side-effect journal, native executor safety, supervisor/recovery | Closed predecessor. F211 is post-close transparency split-out, not a reopen. |
| F209 | Retrieval/read layer: find evidence, open anchors, typed drill-down, Perspective | Downstream consumer. It can search F211 output after F211 materializes sessions. |
| F210 | Headless AGY CLI migration and profile isolation | Separate carrier. Existing AGY CLI path already uses normal session init; if AGY later has long-lived conversation APIs, it should adapt into F211 registration. |

## 9. Phase Plan

### Phase A Implementation Slice

1. Add runtime session metadata storage or sidecar.
2. Make Antigravity Desktop `session_init` non-ephemeral for Cat-Cafe-dispatched cascades.
3. Add lifecycle edge detection for old/new cascade with classified seal reason.
4. Add `drainCascade`.
5. Target seal by `getByCliSessionId(oldCascadeId)`.
6. Add transcript/digest proof fixture.
7. Keep JSON as compatibility input until Phase C.

### Phase B Implementation Slice

1. Add persistent-auth external-session registration endpoint/MCP tool.
2. Store IDE-direct runtime sessions without thread pollution.
3. Extend session-chain read/list tools to include external runtime sessions or a documented sibling read path.
4. Add explicit bind-to-thread path.

### Phase C Implementation Slice

1. Migrate JSON entries to runtime session metadata / SessionChainStore bindings.
2. Make Bridge consume canonical binding.
3. Remove JSON write path or make it read-only migration input.

### Phase D/E

After A/B prove shape, decide whether to promote `Session.kind` and add Hub UI surfaces.

## 10. Review Questions

For architecture review:

- Is `identity-runtime-session` the correct subcell, or should it be a separate ownership cell?
- Is sidecar runtime metadata acceptable for Phase A, or should `SessionRecord` grow now?
- Is the drain fail-closed policy strict enough?

For Antigravity surface review:

- Does the transformed-message materialization source miss any important Antigravity trajectory shape?
- Are manual New Cascade and model/cat switches captured in the right layer?
- Is orphan runtime-session registration enough for IDE-direct v1?

