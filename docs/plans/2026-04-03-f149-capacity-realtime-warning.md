# F149 Capacity Realtime Warning Implementation Plan

**Feature:** F149 — `docs/features/F149-acp-runtime-operations.md`
**Goal:** When Gemini CLI retries due to 429/capacity errors, show a realtime warning to the user instead of silent 120s timeout
**Acceptance Criteria:**
- AC-1: When Gemini CLI stderr contains 429/capacity signal during an active invoke, frontend displays "⚠️ Gemini 服务端容量不足，正在重试..."
- AC-2: Warning is deduplicated: at most one per invoke, no matter how many retry stderr lines
- AC-3: Warning does NOT reset invocation timeout (no "续命")
- AC-4: Warning does NOT set `attemptHasContentOutput` (no self-heal interference)
- AC-5: Warning does NOT replay `recentCapacitySignal` from previous invokes (fresh only)
- AC-6: Silent stall (zero stderr, zero events) is unaffected — PR #934 observation continues to cover that
**Architecture:** New `provider_signal` AgentMessage type, yielded by GeminiAcpAdapter when capacity signal fires during promptStream. `invoke-single-cat` explicitly skips it for timeout reset and content output flags. Frontend renders via existing `system_info`→`warning` path (adapter maps `provider_signal` → `system_info/warning` at yield point).
**Tech Stack:** TypeScript, node:test
**前端验证:** No — frontend already renders `system_info` + `warning` JSON. Backend-only change.

**NOT building:**
- Generic `RETRY_RE` for non-429 stderr (no production evidence)
- Liveness-style stateful indicator (long-term UX, not this hotfix)
- Silent stall detection (covered by PR #934 `firstEventLatencyMs`)

---

### Task 1: Add `provider_signal` to AgentMessageType + skip in invoke-single-cat

**Files:**
- Modify: `packages/api/src/domains/cats/services/types.ts:96-104` (AgentMessageType union)
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts:1368` (skip timeout reset)
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts:1456` (skip content output flag)
- Test: `packages/api/test/acp/gemini-acp-adapter.test.js` (new tests)

**Step 1: Add `provider_signal` to AgentMessageType**

In `types.ts`, add `'provider_signal'` to the union:

```typescript
export type AgentMessageType =
  | 'session_init'
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'error'
  | 'done'
  | 'a2a_handoff'
  | 'system_info'
  | 'provider_signal'; // F149: capacity/retry signals — skipped by invocation state machine
```

**Step 2: Skip `provider_signal` for timeout reset in invoke-single-cat**

At line ~1368, change:

```typescript
// Before:
resetInvocationTimeout();

// After:
if (msg.type !== 'provider_signal') resetInvocationTimeout();
```

**Step 3: Skip `provider_signal` for content output flags**

At line ~1456, the existing condition already excludes `error`, `done`, `session_init`. Add `provider_signal`:

```typescript
// Before:
if (msg.type !== 'error' && msg.type !== 'done' && msg.type !== 'session_init') {

// After:
if (msg.type !== 'error' && msg.type !== 'done' && msg.type !== 'session_init' && msg.type !== 'provider_signal') {
```

**Step 4: Map `provider_signal` → `system_info/warning` for frontend delivery**

In `streamProcessedOutputs` (or the yield path in invoke-single-cat), convert `provider_signal` to `system_info` with `{ type: 'warning', message: '...' }` JSON content before yielding to the WebSocket/SSE layer. This way the frontend's existing `warning` handler works unchanged.

Check: if `streamProcessedOutputs` passes through the message type as-is, we need to map it there. Otherwise, map in the yield path.

### Task 2: Yield capacity warning from GeminiAcpAdapter

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/acp/GeminiAcpAdapter.ts:97-99` (onCapacity handler)
- Modify: `packages/api/src/domains/cats/services/agents/providers/acp/GeminiAcpAdapter.ts:162-170` (for-await loop)

**Step 1: Add dedup flag and yield queue in onCapacity handler**

```typescript
let capacitySignal: AcpCapacitySignal | null = null;
let capacityWarningYielded = false; // dedup: at most one warning per invoke
const onCapacity = (signal: AcpCapacitySignal) => {
  capacitySignal = signal;
};
```

**Step 2: Check and yield warning inside the for-await loop**

After each event from `client.promptStream`, check if a capacity signal arrived and yield a `provider_signal` (once):

```typescript
for await (const event of client.promptStream(sessionId, effectivePrompt)) {
  eventCount++;
  if (eventCount === 1) {
    const firstEventLatencyMs = Date.now() - promptStreamStartedAt;
    log.info({ catId: this.catId, sessionId, firstEventLatencyMs }, 'ACP first event received');
  }
  // Yield capacity warning (deduped, fresh signal only)
  if (capacitySignal && !capacityWarningYielded) {
    capacityWarningYielded = true;
    yield {
      type: 'provider_signal' as AgentMessageType,
      catId: this.catId,
      content: JSON.stringify({
        type: 'warning',
        message: `Gemini 服务端容量不足，正在重试 (${capacitySignal.message.slice(0, 100)})`,
      }),
      metadata,
      timestamp: Date.now(),
    };
  }
  const msg = transformAcpEvent(event, this.catId, metadata);
  if (msg) yield msg;
}
```

**Step 3: Handle zero-event stall with capacity signal**

For the case where Gemini stalls (zero events) but stderr fires 429, the `for-await` loop never enters. The capacity signal only gets classified post-mortem. To cover this case without the `Promise.race` complexity in this hotfix:

In the `catch` block, if `eventCount === 0 && capacitySignal && !capacityWarningYielded`, yield the warning before the error:

```typescript
} catch (err) {
  const waitedMs = promptStreamStartedAt ? Date.now() - promptStreamStartedAt : 0;
  // Zero-event stall with capacity signal: yield warning before error
  if (capacitySignal && !capacityWarningYielded) {
    capacityWarningYielded = true;
    yield {
      type: 'provider_signal' as AgentMessageType,
      catId: this.catId,
      content: JSON.stringify({
        type: 'warning',
        message: `Gemini 服务端容量不足，正在重试 (${capacitySignal.message.slice(0, 100)})`,
      }),
      metadata,
      timestamp: Date.now(),
    };
  }
  // ... existing error handling
```

**Why not `Promise.race` in this hotfix:** The zero-event + 429 case will still show the warning (just slightly later, at timeout+2s grace). The user sees "⚠️ Gemini 服务端容量不足" followed by the timeout error, which is much better than just "lease_timeout". Full `Promise.race` merge can be a follow-up if needed.

### Task 3: Tests (RED→GREEN)

**Files:**
- Test: `packages/api/test/acp/gemini-acp-adapter.test.js`

**Test 1: `capacity signal during active stream yields provider_signal warning`**
- Mock client: promptStream yields 2 events, onCapacity fires between them
- Assert: output contains a `provider_signal` with warning JSON before the text events
- Assert: only ONE provider_signal (dedup)

**Test 2: `capacity warning does not repeat on multiple stderr signals`**
- Mock client: fire onCapacity 3 times, promptStream yields events
- Assert: exactly ONE provider_signal in output

**Test 3: `capacity warning on zero-event timeout (catch path)`**
- Mock client: promptStream throws AcpTimeoutError, onCapacity fires during wait
- Assert: output contains provider_signal warning BEFORE the error message

**Test 4: `provider_signal does not replay recentCapacitySignal from previous invoke`**
- First invoke: fire capacity signal, complete successfully (clears signal)
- Second invoke: no new stderr, timeout
- Assert: second invoke has NO provider_signal warning

### Task 4: invoke-single-cat integration test

**Files:**
- Test: `packages/api/test/acp/gemini-acp-adapter.test.js` (or new file if needed)

**Test 5: `provider_signal does not reset invocation timeout`**
- This is harder to test in isolation. Can verify by checking that the `provider_signal` message type is correctly set, and rely on the type-level guard in invoke-single-cat.

### Task 5: Commit + quality gate

```bash
pnpm check && pnpm lint
node --test packages/api/test/acp/*.test.js
git commit -m "feat(F149): realtime capacity warning — provider_signal type + deduped 429 forwarding"
```

---

## Straight-Line Check

| Step | Stays in final system? | What can we demo/test? | Cost of removing? |
|------|----------------------|----------------------|------------------|
| Task 1: `provider_signal` type + invoke-single-cat guards | Yes — permanent type | Type check passes, invoke-single-cat skips it | Can't yield warnings without it |
| Task 2: GeminiAcpAdapter yield | Yes — permanent warning path | `node --test` with mock capacity signal | No user-visible warning without it |
| Task 3: Tests | Yes — regression prevention | All tests green | No safety net |
