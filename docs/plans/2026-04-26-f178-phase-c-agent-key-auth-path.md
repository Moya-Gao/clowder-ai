# F178 Phase C: MCP Write Tools — Agent-Key Auth Path (Allowlist MVP)

**Feature:** F178 — `docs/features/F178-persistent-mcp-agent-key-auth.md`
**Goal:** Let persistent agents (Bengal) use agent-key credentials to call the 4 allowlisted callback tools, without weakening invocation-token fail-closed security.
**Acceptance Criteria:**
- AC-C1: Only `post_message` / `cross_post_message` / `get_thread_context` / `list_threads` accept agent-key (KD-8 allowlist)
- AC-C2: Thread-targeted tools require explicit `threadId` for agent-key; `list_threads` is user-scoped discovery (no threadId)
- AC-C3: Dual-path preHandler via `CallbackPrincipal`, structured reason codes flow to client
- AC-C4: Bengal secret injection via `0600` sidecar file (not in `mcp_config.json`)
- AC-C5: `CAT_CAFE_READONLY=true` total switch preserved — F178 does not unlock file/shell mutators
- AC-C6: Existing invocation token path zero regression (F174 test suite green)
**Architecture:** Dual decoration — keep `request.callbackAuth` (InvocationRecord) for backward compat; add `request.callbackPrincipal` (CallbackPrincipal) on allowlisted routes. New `requireCallbackPrincipal()` helper returns principal or 401. Existing non-allowlist routes stay on `requireCallbackAuth()` — zero change.
**Tech Stack:** Fastify preHandler, CallbackPrincipal (shared), AgentKeyRegistry, Node crypto
**前端验证:** No (pure backend/MCP)

---

## 砚砚 Vision Guard Constraints (binding)

1. **KD-8 allowlist**: Only the 4 tools above — no task/backlog/file/shell mutators
2. **Invocation token primary**: Agent-key is fallback — never weakens fail-closed
3. **Thread-targeted guard**: `post_message` / `cross_post_message` / `get_thread_context` require explicit `threadId` for agent-key; `list_threads` is user-scoped
4. **`CAT_CAFE_READONLY=true` preserved**: Phase C does not unlock anything outside the allowlist

---

## Task 1: Instantiate AgentKeyRegistry in Server Init

**Files:**
- Modify: `packages/api/src/index.ts:387` (after InvocationRegistry instantiation)
- Modify: `packages/api/src/routes/callbacks.ts:60-84` (CallbackRoutesOptions)

**Step 1: Write the failing test**

```typescript
// packages/api/test/agent-key-server-init.test.js
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('AgentKeyRegistry server init', () => {
  it('should be instantiated and passed to callback routes', async () => {
    // Import AgentKeyRegistry to verify it's available
    const { AgentKeyRegistry } = await import(
      '../src/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const reg = new AgentKeyRegistry();
    assert.ok(reg, 'AgentKeyRegistry instantiates');
    const result = await reg.verify('nonexistent-secret');
    assert.equal(result.ok, false, 'verify returns fail for unknown secret');
  });
});
```

**Step 2: Run test to verify it passes** (this is a smoke test for import chain)

Run: `cd packages/api && node --test test/agent-key-server-init.test.js`
Expected: PASS

**Step 3: Add AgentKeyRegistry to server init + CallbackRoutesOptions**

In `packages/api/src/index.ts` after line 387 (after InvocationRegistry log):
```typescript
// F178 Phase C: AgentKeyRegistry for persistent agent-key auth
const { AgentKeyRegistry } = await import(
  './domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
);
const agentKeyRegistry = new AgentKeyRegistry();
app.log.info('[api] AgentKeyRegistry initialized (memory backend)');
```

In `packages/api/src/routes/callbacks.ts` CallbackRoutesOptions interface (~line 60):
```typescript
agentKeyRegistry?: import('../domains/cats/services/agents/agent-key/AgentKeyRegistry.js').AgentKeyRegistry;
```

Wire it through in `callbacksRoutes` destructuring (~line 320) and pass to preHandler registration.

**Step 4: Run existing tests to verify no regression**

Run: `cd packages/api && node --test test/agent-key-registry.test.js && node --test test/callback-principal-helpers.test.js`
Expected: All PASS

**Step 5: Commit**

```bash
git add packages/api/src/index.ts packages/api/src/routes/callbacks.ts packages/api/test/agent-key-server-init.test.js
git commit -m "feat(F178-C): instantiate AgentKeyRegistry in server init [宪宪/Opus-46🐾]"
```

---

## Task 2: Dual-Path preHandler — Agent-Key Extraction + CallbackPrincipal Decoration

**Files:**
- Modify: `packages/api/src/routes/callback-auth-prehandler.ts` (add agent-key path + callbackPrincipal decoration)
- Test: `packages/api/test/callback-auth-agent-key.test.js` (new)

**Step 1: Write the failing test**

```typescript
// packages/api/test/callback-auth-agent-key.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerCallbackAuthHook } from '../src/routes/callback-auth-prehandler.js';

// Stub invocation registry — always fails
const stubInvocationRegistry = {
  verify: async () => ({ ok: false, reason: 'unknown_invocation' }),
};

// Stub agent-key registry — recognizes 'valid-secret'
const stubAgentKeyRegistry = {
  verify: async (secret) => {
    if (secret === 'valid-secret') {
      return {
        ok: true,
        record: {
          agentKeyId: 'ak_test1',
          catId: 'bengal',
          userId: 'user1',
          secretHash: 'x',
          salt: 'y',
          scope: 'user-bound',
          issuedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        },
      };
    }
    return { ok: false, reason: 'agent_key_unknown' };
  },
};

describe('callback-auth-prehandler: agent-key path', () => {
  it('decorates callbackPrincipal with agent_key kind on valid x-agent-key-secret', async () => {
    const app = Fastify();
    registerCallbackAuthHook(app, stubInvocationRegistry, {
      agentKeyRegistry: stubAgentKeyRegistry,
    });
    app.get('/api/callbacks/test', async (request) => ({
      hasPrincipal: !!request.callbackPrincipal,
      kind: request.callbackPrincipal?.kind,
      catId: request.callbackPrincipal?.catId,
    }));
    const res = await app.inject({
      method: 'GET',
      url: '/api/callbacks/test',
      headers: { 'x-agent-key-secret': 'valid-secret' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.kind, 'agent_key');
    assert.equal(body.catId, 'bengal');
  });

  it('returns 401 on invalid agent-key secret', async () => {
    const app = Fastify();
    registerCallbackAuthHook(app, stubInvocationRegistry, {
      agentKeyRegistry: stubAgentKeyRegistry,
    });
    app.get('/api/callbacks/test', async () => ({ ok: true }));
    const res = await app.inject({
      method: 'GET',
      url: '/api/callbacks/test',
      headers: { 'x-agent-key-secret': 'bad-secret' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('invocation token takes precedence over agent-key', async () => {
    const app = Fastify();
    const invRegistry = {
      verify: async () => ({
        ok: true,
        record: {
          invocationId: 'inv1',
          threadId: 'th1',
          userId: 'user1',
          catId: 'opus',
          callbackToken: 'tok',
          isLatest: true,
          createdAt: Date.now(),
        },
      }),
    };
    registerCallbackAuthHook(app, invRegistry, {
      agentKeyRegistry: stubAgentKeyRegistry,
    });
    app.get('/api/callbacks/test', async (request) => ({
      hasCallbackAuth: !!request.callbackAuth,
      principalKind: request.callbackPrincipal?.kind,
    }));
    const res = await app.inject({
      method: 'GET',
      url: '/api/callbacks/test',
      headers: {
        'x-invocation-id': 'inv1',
        'x-callback-token': 'tok',
        'x-agent-key-secret': 'valid-secret',
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.hasCallbackAuth, true);
    assert.equal(body.principalKind, 'invocation');
  });

  it('no credentials at all = no-op (panel request)', async () => {
    const app = Fastify();
    registerCallbackAuthHook(app, stubInvocationRegistry, {
      agentKeyRegistry: stubAgentKeyRegistry,
    });
    app.get('/api/callbacks/test', async (request) => ({
      hasAuth: !!request.callbackAuth,
      hasPrincipal: !!request.callbackPrincipal,
    }));
    const res = await app.inject({ method: 'GET', url: '/api/callbacks/test' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.hasAuth, false);
    assert.equal(body.hasPrincipal, false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/callback-auth-agent-key.test.js`
Expected: FAIL — `callbackPrincipal` not decorated, `agentKeyRegistry` option not recognized

**Step 3: Implement dual-path in callback-auth-prehandler.ts**

Changes to `packages/api/src/routes/callback-auth-prehandler.ts`:

1. Add Fastify declaration for `callbackPrincipal`:
```typescript
declare module 'fastify' {
  interface FastifyRequest {
    callbackAuth?: InvocationRecord;
    callbackPrincipal?: CallbackPrincipal;
  }
}
```

2. Import `CallbackPrincipal` and `AgentKeyVerifyResult` from shared, and `derivePrincipal` from scope-helpers.

3. Add `agentKeyRegistry` option to `CallbackAuthHookOptions`:
```typescript
export interface CallbackAuthHookOptions {
  notifier?: Pick<CallbackAuthSystemMessageNotifier, 'notify'>;
  agentKeyRegistry?: { verify(secret: string): Promise<AgentKeyVerifyResult> };
}
```

4. In `registerCallbackAuthHook`, add `callbackPrincipal` decoration and agent-key fallback logic:
   - After invocation token succeeds: set `request.callbackPrincipal = derivePrincipal(result.record)`
   - After invocation token fails or absent: try `x-agent-key-secret` header
   - Agent-key verify success → set `request.callbackPrincipal` (kind: agent_key), do NOT set `request.callbackAuth`
   - Agent-key verify fail → 401 with agent-key reason code
   - Neither present → no-op (existing behavior)

5. Priority logic (fail-closed):
   - If invocation headers present → try invocation first (existing path)
   - If invocation succeeds → also derive callbackPrincipal from InvocationRecord → done
   - If invocation fails → 401 immediately (don't fall through to agent-key)
   - If no invocation headers but `x-agent-key-secret` present → try agent-key
   - If agent-key fails → 401
   - If nothing present → no-op

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/callback-auth-agent-key.test.js`
Expected: All 4 PASS

**Step 5: Run existing preHandler tests for regression**

Run: `cd packages/api && node --test test/callback-auth*.test.js`
Expected: All PASS (no regression)

**Step 6: Commit**

```bash
git add packages/api/src/routes/callback-auth-prehandler.ts packages/api/test/callback-auth-agent-key.test.js
git commit -m "feat(F178-C): dual-path preHandler — agent-key extraction + callbackPrincipal [宪宪/Opus-46🐾]"
```

---

## Task 3: `requireCallbackPrincipal()` Helper

**Files:**
- Modify: `packages/api/src/routes/callback-auth-prehandler.ts` (add helper)
- Test: `packages/api/test/callback-auth-agent-key.test.js` (extend)

**Step 1: Write the failing test**

```typescript
// Append to callback-auth-agent-key.test.js
import { requireCallbackPrincipal } from '../src/routes/callback-auth-prehandler.js';

describe('requireCallbackPrincipal', () => {
  it('returns principal when decorated', async () => {
    const app = Fastify();
    registerCallbackAuthHook(app, stubInvocationRegistry, {
      agentKeyRegistry: stubAgentKeyRegistry,
    });
    app.get('/api/callbacks/test-require', async (request, reply) => {
      const principal = requireCallbackPrincipal(request, reply);
      if (!principal) return;
      return { kind: principal.kind };
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/callbacks/test-require',
      headers: { 'x-agent-key-secret': 'valid-secret' },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { kind: 'agent_key' });
  });

  it('returns 401 when no principal', async () => {
    const app = Fastify();
    registerCallbackAuthHook(app, stubInvocationRegistry);
    app.get('/api/callbacks/test-require', async (request, reply) => {
      const principal = requireCallbackPrincipal(request, reply);
      if (!principal) return;
      return { kind: principal.kind };
    });
    const res = await app.inject({ method: 'GET', url: '/api/callbacks/test-require' });
    assert.equal(res.statusCode, 401);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/callback-auth-agent-key.test.js`
Expected: FAIL — `requireCallbackPrincipal` not exported

**Step 3: Implement requireCallbackPrincipal**

```typescript
export function requireCallbackPrincipal(
  request: FastifyRequest,
  reply: FastifyReply,
): CallbackPrincipal | null {
  if (request.callbackPrincipal) return request.callbackPrincipal;
  reply.status(401);
  recordCallbackAuthFailure({
    reason: 'unknown_invocation',
    tool: callbackToolFromUrl(request.url),
  });
  reply.send(makeCallbackAuthError('unknown_invocation'));
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/callback-auth-agent-key.test.js`
Expected: All PASS

**Step 5: Commit**

```bash
git add packages/api/src/routes/callback-auth-prehandler.ts packages/api/test/callback-auth-agent-key.test.js
git commit -m "feat(F178-C): requireCallbackPrincipal() guard helper [宪宪/Opus-46🐾]"
```

---

## Task 4: Upgrade Allowlisted Route Handlers

Upgrade the 3 route handlers to use `requireCallbackPrincipal` + `resolvePrincipalThread`. Non-allowlist routes stay on `requireCallbackAuth` — zero change.

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts:343` (post-message)
- Modify: `packages/api/src/routes/callbacks.ts:790` (thread-context)
- Modify: `packages/api/src/routes/callbacks.ts:971` (list-threads)
- Test: `packages/api/test/callback-routes-agent-key.test.js` (new)

### Sub-task 4a: post-message agent-key path

**Step 1: Write the failing test**

```typescript
// packages/api/test/callback-routes-agent-key.test.js
describe('post-message with agent-key auth', () => {
  it('requires threadId for agent-key principal', async () => {
    // POST /api/callbacks/post-message with x-agent-key-secret
    // body: { content: 'hello' } — NO threadId
    // Expected: 400 "threadId required for agent-key auth"
  });

  it('accepts agent-key with explicit threadId owned by user', async () => {
    // POST /api/callbacks/post-message with x-agent-key-secret
    // body: { content: 'hello', threadId: 'owned-thread' }
    // threadStore.get('owned-thread') → { createdBy: principal.userId }
    // Expected: 200
  });

  it('rejects agent-key with threadId not owned by user', async () => {
    // POST /api/callbacks/post-message with x-agent-key-secret
    // body: { content: 'hello', threadId: 'other-thread' }
    // threadStore.get('other-thread') → { createdBy: 'someone-else' }
    // Expected: 403
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/callback-routes-agent-key.test.js`
Expected: FAIL — routes don't support agent-key yet

**Step 3: Modify post-message handler**

Current flow (line 343-345):
```typescript
const record = requireCallbackAuth(request, reply);
if (!record) return;
const actor = deriveCallbackActor(record);
```

New flow:
```typescript
const principal = requireCallbackPrincipal(request, reply);
if (!principal) return;

// Backward compat: invocation path keeps existing CallbackActor flow
if (principal.kind === 'invocation') {
  // existing invocation flow unchanged — use request.callbackAuth
  const record = request.callbackAuth!;
  const actor = deriveCallbackActor(record);
  // ... rest of existing invocation handler (unchanged)
}

// Agent-key path: threadId required, user ownership checked
if (principal.kind === 'agent_key') {
  const threadResult = await resolvePrincipalThread(principal, parsed.data.threadId, {
    threadStore,
  });
  if (!threadResult.ok) {
    reply.status(threadResult.statusCode);
    return { error: threadResult.error };
  }
  // Agent-key doesn't have invocationId — skip stale guard, skip effectiveInvocationId
  // Use agentKeyId as message source identifier
  // ... minimal agent-key post path
}
```

Key differences for agent-key post-message:
- No stale invocation guard (agent-key is persistent, no invocationId)
- No `effectiveInvocationId` (no parent invocation)
- No `registry.isLatest()` check
- `threadId` must come from request body (not from record)
- Message tagged with `agentKeyId` in metadata for observability

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/callback-routes-agent-key.test.js`
Expected: post-message tests PASS

**Step 5: Commit**

```bash
git add packages/api/src/routes/callbacks.ts packages/api/test/callback-routes-agent-key.test.js
git commit -m "feat(F178-C): post-message agent-key path with thread guard [宪宪/Opus-46🐾]"
```

### Sub-task 4b: thread-context agent-key path

**Step 6: Write the failing test**

```typescript
describe('thread-context with agent-key auth', () => {
  it('requires threadId for agent-key principal', async () => {
    // GET /api/callbacks/thread-context with x-agent-key-secret
    // No threadId query param
    // Expected: 400
  });

  it('returns context for owned thread', async () => {
    // GET /api/callbacks/thread-context?threadId=owned-thread
    // with x-agent-key-secret
    // Expected: 200 with messages array
  });
});
```

**Step 7: Modify thread-context handler (line 790)**

Current: `requireCallbackAuth` → uses `record.threadId` as default.
New: `requireCallbackPrincipal` → for agent-key, `threadId` from query is mandatory; for invocation, existing behavior.

**Step 8: Run test, verify pass**

**Step 9: Commit**

```bash
git commit -m "feat(F178-C): thread-context agent-key path [宪宪/Opus-46🐾]"
```

### Sub-task 4c: list-threads agent-key path

**Step 10: Write the failing test**

```typescript
describe('list-threads with agent-key auth', () => {
  it('returns threads for agent-key user (no threadId required)', async () => {
    // GET /api/callbacks/list-threads with x-agent-key-secret
    // No threadId needed — user-scoped discovery
    // Expected: 200 with threads array
  });
});
```

**Step 11: Modify list-threads handler (line 971)**

Current: `requireCallbackAuth` → uses `record.userId`.
New: `requireCallbackPrincipal` → for both kinds, `principal.userId` is available. No threadId guard needed (user-scoped).

**Step 12: Run test, verify pass**

**Step 13: Run full regression**

Run: `cd packages/api && node --test test/callback*.test.js`
Expected: All PASS including F174 regression tests

**Step 14: Commit**

```bash
git commit -m "feat(F178-C): list-threads agent-key path (user-scoped, no threadId) [宪宪/Opus-46🐾]"
```

---

## Task 5: MCP Server Dual-Cred Config

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:43-66` (config + headers)
- Test: `packages/mcp-server/test/callback-tools-agent-key.test.js` (new)

**Step 1: Write the failing test**

```typescript
describe('getCallbackConfig with agent-key', () => {
  it('returns agent-key config when CAT_CAFE_AGENT_KEY_SECRET is set', () => {
    // Set env: CAT_CAFE_API_URL + CAT_CAFE_AGENT_KEY_SECRET (no invocation vars)
    // getCallbackConfig() should return config with agentKeySecret
  });

  it('prefers invocation creds over agent-key when both present', () => {
    // Set env: all 4 vars (invocation + agent-key)
    // buildAuthHeaders should return invocation headers, not agent-key
  });

  it('buildAuthHeaders sends x-agent-key-secret when no invocation creds', () => {
    // Set env: CAT_CAFE_API_URL + CAT_CAFE_AGENT_KEY_SECRET only
    // buildAuthHeaders should return { 'x-agent-key-secret': '...' }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/mcp-server && node --test test/callback-tools-agent-key.test.js`
Expected: FAIL — no agent-key support in config

**Step 3: Extend CallbackConfig and helpers**

```typescript
interface CallbackConfig {
  apiUrl: string;
  invocationId?: string;
  callbackToken?: string;
  agentKeySecret?: string;
}

export function getCallbackConfig(): CallbackConfig | null {
  const apiUrl = process.env['CAT_CAFE_API_URL'];
  if (!apiUrl) return null;

  const invocationId = process.env['CAT_CAFE_INVOCATION_ID'];
  const callbackToken = process.env['CAT_CAFE_CALLBACK_TOKEN'];
  const agentKeySecret = process.env['CAT_CAFE_AGENT_KEY_SECRET'];

  if (!invocationId && !callbackToken && !agentKeySecret) return null;

  return {
    apiUrl,
    ...(invocationId ? { invocationId } : {}),
    ...(callbackToken ? { callbackToken } : {}),
    ...(agentKeySecret ? { agentKeySecret } : {}),
  };
}

export function buildAuthHeaders(config: CallbackConfig): Record<string, string> {
  // Invocation creds take precedence (fail-closed: don't mix)
  if (config.invocationId && config.callbackToken) {
    return {
      'x-invocation-id': config.invocationId,
      'x-callback-token': config.callbackToken,
    };
  }
  if (config.agentKeySecret) {
    return { 'x-agent-key-secret': config.agentKeySecret };
  }
  return {};
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/mcp-server && node --test test/callback-tools-agent-key.test.js`
Expected: All PASS

**Step 5: Commit**

```bash
git add packages/mcp-server/src/tools/callback-tools.ts packages/mcp-server/test/callback-tools-agent-key.test.js
git commit -m "feat(F178-C): MCP client dual-cred config (invocation + agent-key) [宪宪/Opus-46🐾]"
```

---

## Task 6: Bengal Secret Sidecar Injection

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts` (sidecar file read)
- Test: `packages/mcp-server/test/callback-tools-agent-key.test.js` (extend)

**Step 1: Write the failing test**

```typescript
describe('agent-key secret sidecar', () => {
  it('reads secret from CAT_CAFE_AGENT_KEY_FILE when env var not set', () => {
    // Create temp file with 0600 perms, set CAT_CAFE_AGENT_KEY_FILE to its path
    // getCallbackConfig() should read secret from file
  });

  it('env var takes precedence over sidecar file', () => {
    // Set both CAT_CAFE_AGENT_KEY_SECRET env and CAT_CAFE_AGENT_KEY_FILE
    // env var wins
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Implement sidecar read**

In `getCallbackConfig()`:
```typescript
let agentKeySecret = process.env['CAT_CAFE_AGENT_KEY_SECRET'];
if (!agentKeySecret) {
  const keyFile = process.env['CAT_CAFE_AGENT_KEY_FILE'];
  if (keyFile) {
    try {
      agentKeySecret = readFileSync(keyFile, 'utf-8').trim();
    } catch {
      // sidecar missing = no agent-key (not an error)
    }
  }
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git commit -m "feat(F178-C): agent-key sidecar file read (0600) [宪宪/Opus-46🐾]"
```

---

## Task 7: READONLY Guard + Final Regression

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts` (ensure READONLY blocks agent-key writes)
- Test: `packages/api/test/callback-routes-agent-key.test.js` (extend)

**Step 1: Write the failing test**

```typescript
describe('READONLY guard', () => {
  it('blocks agent-key post-message when CAT_CAFE_READONLY=true', async () => {
    // Set env CAT_CAFE_READONLY=true
    // POST /api/callbacks/post-message with agent-key
    // Expected: 503 or existing READONLY response
  });
});
```

**Step 2: Verify READONLY guard covers new path**

The existing READONLY check in callbacks.ts should already cover write routes.
If not, add explicit check in agent-key post-message path.

**Step 3: Full regression suite**

Run: `cd packages/api && pnpm test`
Expected: All tests pass, including:
- agent-key-registry.test.js (21 tests)
- callback-principal-helpers.test.js (5 tests)
- callback-auth-agent-key.test.js (new, ~6 tests)
- callback-routes-agent-key.test.js (new, ~6 tests)
- All existing F174 callback auth tests

**Step 4: Commit**

```bash
git commit -m "feat(F178-C): READONLY guard + full regression green [宪宪/Opus-46🐾]"
```

---

## Summary

| Task | What | Key file(s) | Tests |
|------|------|-------------|-------|
| 1 | Instantiate AgentKeyRegistry in server | `index.ts`, `callbacks.ts` | smoke |
| 2 | Dual-path preHandler + callbackPrincipal | `callback-auth-prehandler.ts` | 4 new |
| 3 | `requireCallbackPrincipal()` helper | `callback-auth-prehandler.ts` | 2 new |
| 4 | Upgrade 3 routes (post-message, thread-context, list-threads) | `callbacks.ts` | ~6 new |
| 5 | MCP client dual-cred config | `callback-tools.ts` | 3 new |
| 6 | Sidecar file read | `callback-tools.ts` | 2 new |
| 7 | READONLY guard + regression | `callbacks.ts` | 1 new + full suite |

**Total new tests:** ~18
**Estimated time:** 45-60 minutes TDD

**NOT in scope (砚砚's constraints):**
- No task/backlog/file/shell mutators
- No weakening of invocation token fail-closed
- No READONLY unlock
- No Redis backend for AgentKeyRegistry (Phase B explicitly deferred)
