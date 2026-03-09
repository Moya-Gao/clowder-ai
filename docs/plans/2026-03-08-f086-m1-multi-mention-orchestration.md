# F086 M1: Multi-Mention Orchestration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Let cats programmatically invoke up to 3 other cats in parallel via MCP, collect their responses, and route them back to the initiator — with state machine tracking, timeout, anti-cascade, and audit envelope.

**Architecture:** New `cat_cafe_multi_mention` MCP tool (collab server) → callback POST → `MultiMentionOrchestrator` (state machine + parallel dispatch + aggregation) → responses route back via `targetCats` field → initiator receives aggregated results. State machine is independent of route-serial/parallel — it manages its own lifecycle.

**Tech Stack:** TypeScript, Zod (schema), node:test + node:assert/strict + fast-check (testing), Redis (state persistence via existing stores)

---

## Terminal Schema

```typescript
// packages/shared/src/types/multi-mention.ts
export type MultiMentionStatus = 'pending' | 'running' | 'partial' | 'done' | 'timeout' | 'failed';

export interface MultiMentionRequest {
  id: string;                    // UUID
  threadId: string;
  initiator: CatId;
  callbackTo: CatId;
  targets: CatId[];              // ≤3
  question: string;
  context?: string;
  idempotencyKey?: string;
  timeoutMinutes: number;        // 3-20, default 8
  status: MultiMentionStatus;
  createdAt: number;
  // Audit envelope
  triggerType?: string;
  searchEvidenceRefs?: string[];
  overrideReason?: string;
}

export interface MultiMentionResponse {
  catId: CatId;
  content: string;
  timestamp: number;
  status: 'received' | 'timeout' | 'failed';
}

export interface MultiMentionResult {
  request: MultiMentionRequest;
  responses: MultiMentionResponse[];
}
```

## What We're NOT Building (M1 scope)

- ❌ Sequential mode (parallel only)
- ❌ Response summarization (raw text only)
- ❌ UI components (backend + MCP only)
- ❌ M2 trigger rules (separate milestone)
- ❌ M3 reflection capsules (separate milestone)

---

## Task 1: Multi-Mention State Machine Types + Transitions

**Files:**
- Create: `packages/shared/src/types/multi-mention.ts`
- Create: `packages/api/src/domains/cats/services/agents/routing/multi-mention-state-machine.ts`
- Test: `packages/api/test/multi-mention-state-machine.test.js`

**Step 1: Write failing test for state machine transitions**

```javascript
// packages/api/test/multi-mention-state-machine.test.js
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('MultiMentionStateMachine', () => {
  let mod;
  before(async () => {
    mod = await import('../dist/domains/cats/services/agents/routing/multi-mention-state-machine.js');
  });

  test('valid transitions from pending', () => {
    assert.ok(mod.isValidTransition('pending', 'running'));
    assert.ok(mod.isValidTransition('pending', 'failed'));
    assert.ok(!mod.isValidTransition('pending', 'done'));
    assert.ok(!mod.isValidTransition('pending', 'partial'));
  });

  test('valid transitions from running', () => {
    assert.ok(mod.isValidTransition('running', 'partial'));
    assert.ok(mod.isValidTransition('running', 'done'));
    assert.ok(mod.isValidTransition('running', 'timeout'));
    assert.ok(mod.isValidTransition('running', 'failed'));
    assert.ok(!mod.isValidTransition('running', 'pending'));
  });

  test('terminal states have no outbound transitions', () => {
    for (const terminal of ['done', 'failed']) {
      assert.deepEqual(mod.getAllowedTransitions(terminal), []);
    }
  });

  test('partial can go to done or timeout', () => {
    assert.ok(mod.isValidTransition('partial', 'done'));
    assert.ok(mod.isValidTransition('partial', 'timeout'));
    assert.ok(!mod.isValidTransition('partial', 'pending'));
  });

  test('timeout is terminal', () => {
    assert.deepEqual(mod.getAllowedTransitions('timeout'), []);
  });
});
```

**Step 2: Run test, verify it fails**

```bash
cd packages/api && pnpm build && node --test test/multi-mention-state-machine.test.js
```

Expected: FAIL — module not found

**Step 3: Create shared types**

```typescript
// packages/shared/src/types/multi-mention.ts
import type { CatId } from './ids.js';

export type MultiMentionStatus = 'pending' | 'running' | 'partial' | 'done' | 'timeout' | 'failed';

export const MULTI_MENTION_TERMINAL_STATES: ReadonlySet<MultiMentionStatus> = new Set(['done', 'timeout', 'failed']);
export const MAX_MULTI_MENTION_TARGETS = 3;
export const DEFAULT_TIMEOUT_MINUTES = 8;
export const MIN_TIMEOUT_MINUTES = 3;
export const MAX_TIMEOUT_MINUTES = 20;

export interface MultiMentionRequest {
  readonly id: string;
  readonly threadId: string;
  readonly initiator: CatId;
  readonly callbackTo: CatId;
  readonly targets: readonly CatId[];
  readonly question: string;
  readonly context?: string;
  readonly idempotencyKey?: string;
  readonly timeoutMinutes: number;
  status: MultiMentionStatus;
  readonly createdAt: number;
  // Audit envelope
  readonly triggerType?: string;
  readonly searchEvidenceRefs?: readonly string[];
  readonly overrideReason?: string;
}

export interface MultiMentionResponse {
  readonly catId: CatId;
  readonly content: string;
  readonly timestamp: number;
  readonly status: 'received' | 'timeout' | 'failed';
}

export interface MultiMentionResult {
  readonly request: MultiMentionRequest;
  readonly responses: readonly MultiMentionResponse[];
}
```

**Step 4: Implement state machine** (follow `invocation-state-machine.ts` pattern exactly)

```typescript
// packages/api/src/domains/cats/services/agents/routing/multi-mention-state-machine.ts
import type { MultiMentionStatus } from '@cat-cafe/shared';

const VALID_TRANSITIONS: ReadonlyMap<MultiMentionStatus, ReadonlySet<MultiMentionStatus>> = new Map([
  ['pending', new Set(['running', 'failed'])],
  ['running', new Set(['partial', 'done', 'timeout', 'failed'])],
  ['partial', new Set(['done', 'timeout'])],
  ['done', new Set()],
  ['timeout', new Set()],
  ['failed', new Set()],
]);

export function isValidTransition(from: MultiMentionStatus, to: MultiMentionStatus): boolean {
  return VALID_TRANSITIONS.get(from)?.has(to) ?? false;
}

export function getAllowedTransitions(from: MultiMentionStatus): MultiMentionStatus[] {
  return [...(VALID_TRANSITIONS.get(from) ?? [])];
}
```

**Step 5: Rebuild shared + api, run test**

```bash
pnpm --filter @cat-cafe/shared build && cd packages/api && pnpm build && node --test test/multi-mention-state-machine.test.js
```

Expected: PASS

**Step 6: Add fast-check property tests**

Add to same test file:
```javascript
import fc from 'fast-check';

test('random walk never reaches invalid state', () => {
  fc.assert(fc.property(
    fc.array(fc.constantFrom('pending','running','partial','done','timeout','failed'), { minLength: 1, maxLength: 20 }),
    (steps) => {
      let state = 'pending';
      for (const next of steps) {
        if (mod.isValidTransition(state, next)) state = next;
      }
      return mod.ALL_STATUSES.includes(state);
    }
  ), { seed: 20260308, numRuns: 500 });
});

test('terminal states absorb', () => {
  for (const terminal of mod.TERMINAL_STATES) {
    for (const any of mod.ALL_STATUSES) {
      assert.ok(!mod.isValidTransition(terminal, any));
    }
  }
});
```

**Step 7: Run tests, verify pass**

**Step 8: Commit**

```bash
git add packages/shared/src/types/multi-mention.ts packages/api/src/domains/cats/services/agents/routing/multi-mention-state-machine.ts packages/api/test/multi-mention-state-machine.test.js
git commit -m "feat(F086): add multi-mention state machine + types [布偶猫/宪宪]"
```

---

## Task 2: MultiMentionOrchestrator — Core State Management

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/routing/MultiMentionOrchestrator.ts`
- Test: `packages/api/test/multi-mention-orchestrator.test.js`

**Step 1: Write failing test for orchestrator lifecycle**

```javascript
// Test: create request → register → record response → check completion
describe('MultiMentionOrchestrator', () => {
  test('creates request and transitions to pending', () => {
    const req = orchestrator.create({ threadId, initiator, callbackTo, targets, question, timeoutMinutes: 8 });
    assert.equal(req.status, 'pending');
    assert.equal(req.targets.length, 2);
  });

  test('rejects targets > 3', () => {
    assert.throws(() => orchestrator.create({ targets: [a, b, c, d], ... }));
  });

  test('records response and transitions running → partial → done', () => {
    orchestrator.start(reqId);           // pending → running
    orchestrator.recordResponse(reqId, catA, 'answer A');  // running → partial (1/2)
    assert.equal(orchestrator.getStatus(reqId), 'partial');
    orchestrator.recordResponse(reqId, catB, 'answer B');  // partial → done (2/2)
    assert.equal(orchestrator.getStatus(reqId), 'done');
  });

  test('idempotency key deduplicates', () => {
    const r1 = orchestrator.create({ ..., idempotencyKey: 'key1' });
    const r2 = orchestrator.create({ ..., idempotencyKey: 'key1' });
    assert.equal(r1.id, r2.id);
  });

  test('getResult returns all responses', () => {
    const result = orchestrator.getResult(reqId);
    assert.equal(result.responses.length, 2);
  });
});
```

**Step 2: Run test, verify fail**

**Step 3: Implement orchestrator**

```typescript
// MultiMentionOrchestrator.ts
// In-memory Map<requestId, { request, responses }> for MVP
// Key methods:
//   create(params) → MultiMentionRequest
//   start(requestId) → void (pending → running)
//   recordResponse(requestId, catId, content) → MultiMentionStatus
//   handleTimeout(requestId) → void (running/partial → timeout, flush existing)
//   getStatus(requestId) → MultiMentionStatus
//   getResult(requestId) → MultiMentionResult
//   findByIdempotencyKey(threadId, key) → MultiMentionRequest | undefined
```

The orchestrator is a singleton per process (like WorklistRegistry). Thread-safe via single-threaded Node.js event loop.

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat(F086): add MultiMentionOrchestrator with lifecycle management [布偶猫/宪宪]"
```

---

## Task 3: MCP Tool Schema + Handler

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts` (add schema + handler)
- Test: `packages/mcp-server/test/callback-tools.test.js` (add multi_mention tests)

**Step 1: Write failing test**

```javascript
describe('cat_cafe_multi_mention', () => {
  test('calls /api/callbacks/multi-mention with correct payload', async () => {
    // Mock fetch to capture request
    const input = {
      targets: ['codex', 'gemini'],
      question: 'What do you think about this API design?',
      callbackTo: 'opus',
      timeoutMinutes: 8,
      searchEvidenceRefs: ['docs/features/F055.md'],
    };
    const result = await handleMultiMention(input);
    assert.ok(!result.isError);
    // Verify fetch was called with /api/callbacks/multi-mention
    assert.ok(lastFetchUrl.includes('/api/callbacks/multi-mention'));
  });

  test('rejects when missing searchEvidenceRefs and no overrideReason', async () => {
    const input = { targets: ['codex'], question: 'test', callbackTo: 'opus' };
    const result = await handleMultiMention(input);
    assert.ok(result.isError);
    assert.ok(result.content[0].text.includes('searchEvidenceRefs'));
  });
});
```

**Step 2: Run test, verify fail**

**Step 3: Implement schema + handler**

```typescript
// In callback-tools.ts

export const multiMentionInputSchema = {
  targets: z.array(z.string().min(1)).min(1).max(3).describe('Cat IDs to mention (max 3)'),
  question: z.string().min(1).max(5000).describe('Question or request for the target cats'),
  callbackTo: z.string().min(1).describe('Cat ID to route responses back to (required)'),
  context: z.string().max(5000).optional().describe('Additional context for the targets'),
  idempotencyKey: z.string().min(1).max(200).optional().describe('Idempotency key to prevent duplicate dispatches'),
  timeoutMinutes: z.number().int().min(3).max(20).optional().describe('Timeout in minutes (default 8, range 3-20)'),
  searchEvidenceRefs: z.array(z.string()).optional().describe('References to searches performed before calling (required unless overrideReason provided)'),
  overrideReason: z.string().min(1).max(500).optional().describe('Reason for skipping search evidence (required if searchEvidenceRefs omitted)'),
  triggerType: z.enum(['high-impact', 'cross-domain', 'uncertain', 'info-gap', 'recon']).optional().describe('Which meta-thinking trigger motivated this call'),
};

export async function handleMultiMention(input: {
  targets: string[];
  question: string;
  callbackTo: string;
  context?: string;
  idempotencyKey?: string;
  timeoutMinutes?: number;
  searchEvidenceRefs?: string[];
  overrideReason?: string;
  triggerType?: string;
}): Promise<ToolResult> {
  // Client-side validation: searchEvidenceRefs or overrideReason required
  if (!input.searchEvidenceRefs?.length && !input.overrideReason) {
    return errorResult(
      'multi_mention requires searchEvidenceRefs (what did you search first?) ' +
      'or overrideReason (why are you skipping search?). ' +
      'This enforces the "先搜后问" principle.'
    );
  }

  return await callbackPost('/api/callbacks/multi-mention', {
    targets: input.targets,
    question: input.question,
    callbackTo: input.callbackTo,
    ...(input.context ? { context: input.context } : {}),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    ...(input.timeoutMinutes !== undefined ? { timeoutMinutes: input.timeoutMinutes } : {}),
    ...(input.searchEvidenceRefs ? { searchEvidenceRefs: input.searchEvidenceRefs } : {}),
    ...(input.overrideReason ? { overrideReason: input.overrideReason } : {}),
    ...(input.triggerType ? { triggerType: input.triggerType } : {}),
  });
}

// Add to callbackTools array:
{
  name: 'cat_cafe_multi_mention',
  description: 'Invoke up to 3 cats in parallel to gather perspectives on a question. ' +
    'Responses are automatically routed back to callbackTo. ' +
    'Requires searchEvidenceRefs (what you searched first) or overrideReason.',
  inputSchema: multiMentionInputSchema,
  handler: handleMultiMention,
}
```

**Step 4: Run test, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat(F086): add cat_cafe_multi_mention MCP tool schema + handler [布偶猫/宪宪]"
```

---

## Task 4: Backend Callback Route

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts` (add `/api/callbacks/multi-mention` route)
- Test: `packages/api/test/multi-mention-route.test.js`

**Step 1: Write failing test**

```javascript
// Test the HTTP endpoint:
// - Valid request → 200 + requestId
// - targets > 3 → 400
// - missing callbackTo → 400
// - idempotency dedup → 200 + same requestId
// - invalid cat ID → 400
```

**Step 2: Run test, verify fail**

**Step 3: Implement route**

```typescript
// In callbacks.ts or new file callback-multi-mention-route.ts

const multiMentionSchema = callbackAuthSchema.extend({
  targets: z.array(z.string().min(1)).min(1).max(3),
  question: z.string().min(1).max(5000),
  callbackTo: z.string().min(1),
  context: z.string().max(5000).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  timeoutMinutes: z.number().int().min(3).max(20).optional(),
  searchEvidenceRefs: z.array(z.string()).optional(),
  overrideReason: z.string().min(1).max(500).optional(),
  triggerType: z.string().optional(),
});

server.post('/api/callbacks/multi-mention', async (request, reply) => {
  const body = multiMentionSchema.parse(request.body);

  // Validate all targets are registered cats
  for (const target of body.targets) {
    if (!catRegistry.has(target)) {
      return reply.status(400).send({ error: `Unknown cat: ${target}` });
    }
  }

  // Validate callbackTo is a registered cat
  if (!catRegistry.has(body.callbackTo)) {
    return reply.status(400).send({ error: `Unknown callbackTo cat: ${body.callbackTo}` });
  }

  // Create orchestration request
  const orchestrator = getMultiMentionOrchestrator();
  const request = orchestrator.create({
    threadId: body.threadId,  // from auth context
    initiator: body.catId,    // from auth (the calling cat)
    callbackTo: body.callbackTo,
    targets: body.targets,
    question: body.question,
    context: body.context,
    idempotencyKey: body.idempotencyKey,
    timeoutMinutes: body.timeoutMinutes ?? 8,
    triggerType: body.triggerType,
    searchEvidenceRefs: body.searchEvidenceRefs,
    overrideReason: body.overrideReason,
  });

  // Schedule timeout
  scheduleTimeout(request);

  // Dispatch to targets (parallel invocations)
  await dispatchToTargets(request);

  reply.send({ requestId: request.id, status: request.status });
});
```

**Key**: `dispatchToTargets()` is the core — it creates invocations for each target cat with the question as the message, injecting multi-mention context into their system prompt.

**Step 4: Run test, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat(F086): add /api/callbacks/multi-mention route + dispatch [布偶猫/宪宪]"
```

---

## Task 5: Target Dispatch + Response Callback

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/MultiMentionOrchestrator.ts`
- Create: `packages/api/src/routes/callback-multi-mention-response.ts` (response callback route)
- Test: `packages/api/test/multi-mention-dispatch.test.js`

**Step 1: Write failing test for dispatch + response flow**

```javascript
// End-to-end flow test:
// 1. Create multi-mention request with 2 targets
// 2. Verify 2 invocations are created (one per target)
// 3. Simulate cat A response → status becomes 'partial'
// 4. Simulate cat B response → status becomes 'done'
// 5. Verify aggregated result routed back to callbackTo
```

**Step 2: Run test, verify fail**

**Step 3: Implement dispatch**

The dispatch function needs to:
1. Create invocations for each target cat via `invokeSingleCat()`
2. Each invocation gets a special system prompt context: "你正在回答 {initiator} 的问题: {question}"
3. Set up response callback: when target cat's invocation completes, record response in orchestrator
4. The response callback is hooked into the existing invocation completion flow (invocation status → succeeded → extract response → `orchestrator.recordResponse()`)

**Step 4: Implement response aggregation**

When orchestrator transitions to `done` or `timeout`:
1. Build aggregated result (all responses)
2. Post a message to the thread as a connector message (like vote results)
3. Route via `targetCats: [callbackTo]` so the initiator gets notified

**Step 5: Run test, verify pass**

**Step 6: Commit**

```bash
git commit -m "feat(F086): implement target dispatch + response aggregation [布偶猫/宪宪]"
```

---

## Task 6: Anti-Cascade Guard

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/context/SystemPromptBuilder.ts`
- Modify: `packages/api/src/domains/cats/services/agents/routing/a2a-mentions.ts`
- Test: `packages/api/test/multi-mention-anti-cascade.test.js`

**Step 1: Write failing test**

```javascript
// Test 1: SystemPromptBuilder adds "禁止 @ 其他猫" when in multi-mention context
// Test 2: a2a-mentions parseA2AMentions returns empty when cat is in multi-mention response mode
```

**Step 2: Run test, verify fail**

**Step 3: Implement SystemPromptBuilder injection**

Add to `InvocationContext`:
```typescript
multiMentionContext?: {
  requestId: string;
  initiator: CatId;
  callbackTo: CatId;
  question: string;
};
```

In `buildInvocationContext()`, when `multiMentionContext` is present:
```typescript
if (context.multiMentionContext) {
  lines.push('');
  lines.push('## Multi-Mention Response Mode');
  lines.push(`你正在回答 ${context.multiMentionContext.initiator} 的问题。`);
  lines.push(`问题: ${context.multiMentionContext.question}`);
  lines.push('回答后会自动路由回发起者。');
  lines.push('⚠️ 禁止 @ 其他猫 — 你的回答不会触发 A2A 路由。');
}
```

**Step 4: Implement hard guard in a2a-mentions**

In `parseA2AMentions()`, add early return:
```typescript
// Check if this cat is responding to a multi-mention request
if (options?.isMultiMentionResponse) {
  return { mentions: [], suppressed: [] };
}
```

The `isMultiMentionResponse` flag is set by the routing layer when invoking multi-mention targets.

**Step 5: Run tests, verify pass**

**Step 6: Run SystemPromptBuilder guard test**

```bash
node --test test/system-prompt-builder.test.js
```

⚠️ **CRITICAL**: Check size guard! Adding text to system prompt may exceed the size limit. If it does, adjust the limit or trim other content.

**Step 7: Commit**

```bash
git commit -m "feat(F086): add anti-cascade guard (prompt injection + mention suppression) [布偶猫/宪宪]"
```

---

## Task 7: Timeout + Partial Failure Handling

**Files:**
- Modify: `MultiMentionOrchestrator.ts`
- Test: `packages/api/test/multi-mention-timeout.test.js`

**Step 1: Write failing test**

```javascript
// Test 1: After timeout, status transitions to 'timeout'
// Test 2: Partial responses are preserved after timeout
// Test 3: Late responses after timeout are ignored
// Test 4: Timeout fires at correct time (use fake timers)
```

**Step 2: Implement timeout mechanism**

```typescript
// In orchestrator:
scheduleTimeout(request: MultiMentionRequest): void {
  const ms = request.timeoutMinutes * 60_000;
  const timer = setTimeout(() => this.handleTimeout(request.id), ms);
  this.timers.set(request.id, timer);
}

handleTimeout(requestId: string): void {
  const entry = this.requests.get(requestId);
  if (!entry || TERMINAL_STATES.has(entry.request.status)) return;

  // Transition to timeout
  entry.request.status = 'timeout';

  // Flush existing responses to callbackTo
  this.flushResult(requestId);

  // Cleanup timer
  this.timers.delete(requestId);
}
```

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat(F086): add timeout + partial failure handling [布偶猫/宪宪]"
```

---

## Task 8: Audit Logging + Observability

**Files:**
- Modify: `MultiMentionOrchestrator.ts` (emit events)
- Test: `packages/api/test/multi-mention-audit.test.js`

**Step 1: Write failing test**

```javascript
// Test: State transitions emit audit events with envelope fields
// Test: Audit event includes initiator, callbackTo, triggerType, searchEvidenceRefs
```

**Step 2: Implement audit logging**

Use existing event emission pattern (like `A2A_HANDOFF` events). Emit on:
- `MULTI_MENTION_CREATED` — request created
- `MULTI_MENTION_DISPATCHED` — targets invoked
- `MULTI_MENTION_RESPONSE` — each response received
- `MULTI_MENTION_COMPLETED` — done/timeout/failed (includes aggregated result)

Each event includes the audit envelope: `initiator`, `callbackTo`, `idempotencyKey`, `triggerType`, `searchEvidenceRefs`, `overrideReason`.

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git commit -m "feat(F086): add multi-mention audit logging + observability events [布偶猫/宪宪]"
```

---

## Task 9: Integration Test — Full Round-Trip

**Files:**
- Create: `packages/api/test/multi-mention-integration.test.js`

**Step 1: Write integration test**

```javascript
describe('Multi-Mention Integration', () => {
  test('full round-trip: create → dispatch → respond → aggregate → route back', async () => {
    // 1. Cat opus calls multi_mention with targets [codex, gemini]
    // 2. Verify two invocations created
    // 3. Simulate codex response
    // 4. Status = partial
    // 5. Simulate gemini response
    // 6. Status = done
    // 7. Verify aggregated message posted to thread
    // 8. Verify targetCats = [opus] (routes back to initiator)
    // 9. Verify audit events emitted
  });

  test('timeout scenario: one cat responds, one times out', async () => {
    // 1. Create request with 2 targets, short timeout
    // 2. One cat responds
    // 3. Trigger timeout
    // 4. Status = timeout
    // 5. Verify partial result flushed to callbackTo
    // 6. Verify timeout cat marked as 'timeout' in responses
  });

  test('idempotency: duplicate request returns existing', async () => {
    // Same idempotencyKey → same requestId, no duplicate dispatch
  });

  test('anti-cascade: target cat mentions are suppressed', async () => {
    // Target cat response contains @opus → not parsed as A2A mention
  });
});
```

**Step 2: Run all tests**

```bash
cd packages/api && pnpm build && node --test test/multi-mention-*.test.js
```

**Step 3: Run full test suite**

```bash
pnpm test
```

**Step 4: Commit**

```bash
git commit -m "test(F086): add multi-mention integration tests [布偶猫/宪宪]"
```

---

## Task 10: Observability Metrics Baselines

**Files:**
- Modify: F086 spec (fill in metric thresholds)

After integration tests pass, document baseline thresholds for the AC metrics:
- **回流成功率**: ≥90% (done / total requests)
- **超时率**: ≤20% (timeout / total requests)
- **二次扩散拦截次数**: tracked, target = 0 escapes
- **平均回流延迟**: ≤ timeoutMinutes (measured from dispatch to done)

**Commit:**

```bash
git commit -m "docs(F086): fill M1 observability metric baselines [布偶猫/宪宪]"
```

---

## Execution Order Summary

| Task | What | Depends On | Est. Complexity |
|------|------|-----------|-----------------|
| 1 | State machine types + transitions | — | Low |
| 2 | Orchestrator core (create/start/record/result) | Task 1 | Medium |
| 3 | MCP tool schema + handler | — | Low |
| 4 | Backend callback route | Tasks 1, 2 | Medium |
| 5 | Target dispatch + response callback | Tasks 2, 4 | High |
| 6 | Anti-cascade guard | Task 5 | Low |
| 7 | Timeout + partial failure | Task 2 | Medium |
| 8 | Audit logging | Tasks 2, 5 | Low |
| 9 | Integration test | All above | Medium |
| 10 | Metric baselines | Task 9 | Low |

**Parallelizable**: Tasks 1+3 can run in parallel. Tasks 6+7+8 can run in parallel after Task 5.
