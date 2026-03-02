# F042 Routing Policy (Intent/Scope) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Add thread-scoped routing policy so we can avoid/prefer specific cats per intent/scope (e.g. review avoid Opus due to budget, architecture prefer Opus), with a Hub UI switch and prompt pinned injection so it survives context compression.

**Architecture:** Store `routingPolicy` on `Thread` (Redis + in-memory stores), update via `PATCH /api/threads/:id`, enforce in `AgentRouter` target resolution (mentions > policy > preferredCats > participants > default), and inject a 1-line policy summary in `SystemPromptBuilder` per invocation. Add Hub UI to edit the policy for the current thread.

**Tech Stack:** TypeScript, Fastify + zod, RedisThreadStore, React (Next.js), Zustand chatStore.

---

## Policy Shape (v1)

- Scopes: `review`, `architecture` (extensible)
- Per-scope fields:
  - `avoidCats: CatId[]` (filtered out unless explicitly @mentioned)
  - `preferCats: CatId[]` (moved to front; may be injected if missing)
  - `reason?: string`
  - `expiresAt?: number` (epoch ms; optional, ignored when absent)

Draft TS shape (backend/web keep in sync):

```ts
type RoutingScope = 'review' | 'architecture';

type ThreadRoutingRule = {
  avoidCats?: string[];
  preferCats?: string[];
  reason?: string;
  expiresAt?: number;
};

type ThreadRoutingPolicyV1 = {
  v: 1;
  scopes?: Partial<Record<RoutingScope, ThreadRoutingRule>>;
};
```

## Scope inference (v1)

- `review` when message contains any of: `review`, `PR`, `LGTM`, `合入`, `merge`, `开 PR`, `云端 review`, `帮我看看`
- `architecture` when message contains any of: `架构`, `architecture`, `设计`, `tradeoff`, `方案`
- Otherwise: no scope → do not apply policy (mentions/preferredCats/participants/default only).

## Tasks

### Task 1: Persist routingPolicy on Thread (API + stores)

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts`
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisThreadStore.ts`
- Modify: `packages/api/src/routes/threads.ts`
- Test: `packages/api/test/redis-thread-store.test.js`

**Step 1: Write failing test (RedisThreadStore round-trip)**

Add a test asserting `routingPolicy` is stored and hydrated:

```js
it('stores and hydrates routingPolicy', async () => {
  const thread = await store.create('u1', 't1', 'default');
  await store.updateRoutingPolicy(thread.id, { v: 1, scopes: { review: { avoidCats: ['opus'] } } });
  const got = await store.get(thread.id);
  assert.deepEqual(got.routingPolicy, { v: 1, scopes: { review: { avoidCats: ['opus'] } } });
});
```

**Step 2: Implement minimal persistence**

- Extend `Thread` with `routingPolicy?: ThreadRoutingPolicyV1`
- Add `updateRoutingPolicy(threadId, policy)` to `IThreadStore` + both implementations
- Redis: store as JSON string in thread detail hash (`routingPolicy`)
- In-memory: store directly on thread object
- Threads route: extend `updateThreadSchema` with `routingPolicy`, call `threadStore.updateRoutingPolicy()`

**Step 3: Run targeted tests**

Run: `node --test packages/api/test/redis-thread-store.test.js` (requires REDIS_URL=6398)

---

### Task 2: Enforce policy in AgentRouter target resolution

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts`
- Test: `packages/api/test/agent-router.test.js`

**Step 1: Write failing tests**

1) Review scope avoids Opus when no mentions/participants:

```js
// thread.routingPolicy.scopes.review.avoidCats=['opus']
// message: "帮我 review 一下"
// expect: targetCats[0] !== 'opus'
```

2) Architecture scope prefers Opus:

```js
// message: "这个架构 tradeoff 怎么选"
// expect: targetCats includes 'opus' first (when valid service)
```

3) Explicit mention overrides policy:

```js
// message: "@opus 帮我 review"
// expect: targetCats === ['opus']
```

**Step 2: Implement**

- Add `inferRoutingScope(message)` and `applyRoutingPolicy(targets, policyRule)`
- Apply after base candidate list is computed (preferredCats/participants/default)
- Keep dedupe + validity guard (`Object.hasOwn(this.services, id)`)
- If avoid removes all candidates: pick deterministic fallback (first non-excluded service id, sorted)

---

### Task 3: Inject policy into prompt (survive compression)

**Files:**
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts`
- Test: `packages/api/test/system-prompt-builder.test.js`

**Step 1: Write failing test**

`buildInvocationContext()` should include a single-line policy summary when present:

```js
const ctx = buildInvocationContext({ ..., routingPolicy: { v:1, scopes:{ review:{ avoidCats:['opus'], reason:'budget' }}}});
assert.match(ctx, /Routing:.*review.*avoid.*@opus/);
```

**Step 2: Implement**

- Extend `InvocationContext` with `routingPolicy?: ThreadRoutingPolicyV1`
- In `buildInvocationContext`, append:
  - `Routing: review avoid @opus (budget); architecture prefer @opus`
  - Only include scopes present; avoid long lists
- route-serial/parallel: best-effort fetch thread once and pass `thread.routingPolicy`

---

### Task 4: Hub UI switch (thread-scoped)

**Files:**
- Create: `packages/web/src/components/HubRoutingPolicyTab.tsx`
- Modify: `packages/web/src/components/CatCafeHub.tsx`
- Modify: `packages/web/src/stores/chat-types.ts`

**Step 1: UI**

- Read current threadId from `useChatStore((s) => s.currentThreadId)`
- Fetch thread: `GET /api/threads/:id` → read `routingPolicy`
- Two controls:
  - Review: `Normal / Avoid @opus`
  - Architecture: `Normal / Prefer @opus`
- Save via `PATCH /api/threads/:id` with `routingPolicy` payload

---

### Task 5: Quality gate + Review (budget-aware)

**Steps:**
- Build: `pnpm --filter @cat-cafe/api build`
- Tests: targeted `node --test ...` for changed suites
- Request local review from `@gpt52` (验证 identity drift 是否还发生)
- Then `merge-gate` → PR → cloud `@codex review` → squash merge

