---
feature_ids: [F174]
topics: [auth, mcp, refresh, ttl]
doc_kind: plan
created: 2026-04-23
---

# F174 Phase C: Refresh Endpoint + 客户端自适应续期 — Implementation Plan

**Feature:** F174 — `docs/features/F174-callback-auth-lifecycle.md`
**Goal:** Add `POST /api/callbacks/refresh-token` so MCP clients can keep tokens alive proactively (heartbeat) without depending on incidental tool calls. Eliminates the "long thinking session → token natural expiry → next callback 401" failure mode that Phase B's persistence didn't address.
**Acceptance Criteria:** （来自 spec Phase C）
- AC-C1: `POST /api/callbacks/refresh-token` 端点落地，header 传 creds，fail-closed 401（reason 来自 A）
- AC-C2: 响应包含 `expiresAt` + `ttlRemainingMs`
- AC-C3: MCP 客户端按 `clamp(ttlRemainingMs/4, 5m, 30m)` + jitter 自适应续期
- AC-C4: rate limit：每 invocation 每 5min 最多 1 次 refresh（防滥用）
- AC-C5: refresh 失败时客户端不 crash，记录 warn 日志

**Architecture:** Server-side: thin endpoint that re-runs `registry.verify()` (which already slides TTL via Phase B Lua) and returns the new `expiresAt`. Client-side: background `setInterval` in MCP server entry, computes next refresh delay from server-returned `ttlRemainingMs`. Rate limit enforced via a Redis SETEX guard key (`auth:refresh-cooldown:{invocationId}`, 5min TTL) — atomic, restart-safe.

**Tech Stack:** TypeScript / Fastify (refresh endpoint reuses preHandler) / ioredis SET NX EX (cooldown) / node:test
**前端验证:** No (pure backend + MCP client background timer)

---

## Straight-Line Check (B definition)

**B 定义**：Long thinking session (no tool calls for >2h) no longer trips 401 on next callback. MCP client自动 ping refresh endpoint every ~30min (under default TTL) keeping token alive without猫 explicit action.

**不在本 Phase 做**：
- Not implementing degradation framework (Phase E)
- Not implementing telemetry counters (Phase D1)
- Not changing Phase B's storage model — refresh is a thin call site that piggybacks on existing `verify()` slide
- Not exposing refresh as an MCP tool (it's transparent — runs in MCP server background, not猫-callable)

**Terminal schema**:

```typescript
// packages/api/src/routes/callbacks.ts (or new callback-refresh-routes.ts)
// Request: POST /api/callbacks/refresh-token
//   Headers: X-Invocation-Id + X-Callback-Token (preHandler validates)
//   Body: empty
// Response 200:
//   { ok: true, expiresAt: number, ttlRemainingMs: number }
// Response 401:
//   { error: 'callback_auth_failed', reason: <AuthFailureReason>, message, hint }
// Response 429:
//   { error: 'refresh_rate_limited', retryAfterMs: number }
```

```typescript
// packages/mcp-server/src/refresh-loop.ts (new)
// Spawns a background timer that calls /api/callbacks/refresh-token
// using the same env-based credentials. Cancellable on process exit.
//
// Algorithm (KD-6, gpt52 proposal):
//   nextDelayMs = clamp(serverReportedTtlRemainingMs / 4, 5*60_000, 30*60_000)
//   nextDelayMs *= 0.85 + Math.random() * 0.3  // ±15% jitter
//
// Failures (rate limit, 401, network) just log warn and reschedule the timer.
// No user-facing fallback — refresh is best-effort; if it fails persistently,
// the next real verify() will surface the auth failure with structured reason.
```

**Three-question check on every step**：
- 输出留在最终系统？✅ endpoint + client timer are terminal artifacts
- demo/test 后？✅ unit + integration tests for endpoint; client timer mockable
- 删了这步成本？长 session 自然过期问题不解决，Phase B 收益打折

---

## Tasks

### Task 1: Refresh endpoint (server-side)

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts` — add new POST handler near `register-pr-tracking` (line ~1039)
- Modify: `packages/api/src/routes/callback-errors.ts` — add `refresh_rate_limited` error builder
- Test: `packages/api/test/callback-refresh-token.test.js` (new)

**Step 1.1: Failing test — endpoint contract**

```javascript
// packages/api/test/callback-refresh-token.test.js
import assert from 'node:assert/strict';
import { describe, test, beforeEach } from 'node:test';
import Fastify from 'fastify';

describe('POST /api/callbacks/refresh-token', () => {
  let app;
  let registry;

  beforeEach(async () => {
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
    );
    const { callbacksRoutes } = await import('../dist/routes/callbacks.js');
    registry = new InvocationRegistry();
    app = Fastify();
    await app.register(callbacksRoutes, { registry, /* other deps stubbed */ });
  });

  test('returns 200 + expiresAt + ttlRemainingMs on valid creds', async () => {
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', 'thread-1');
    const res = await app.inject({
      method: 'POST',
      url: '/api/callbacks/refresh-token',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.ok(typeof body.expiresAt === 'number');
    assert.ok(body.expiresAt > Date.now());
    assert.ok(typeof body.ttlRemainingMs === 'number');
    assert.ok(body.ttlRemainingMs > 0);
  });

  test('returns 401 with structured reason on bad token', async () => {
    const { invocationId } = await registry.create('user-1', 'opus', 'thread-1');
    const res = await app.inject({
      method: 'POST',
      url: '/api/callbacks/refresh-token',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': 'wrong' },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).reason, 'invalid_token');
  });

  test('refresh slides TTL forward (Phase B mechanism)', async () => {
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', 'thread-1');
    const before = (await registry.getLatestId('thread-1', 'opus')) === invocationId;
    assert.equal(before, true);

    // Wait, then refresh
    await new Promise((r) => setTimeout(r, 50));
    const res = await app.inject({
      method: 'POST',
      url: '/api/callbacks/refresh-token',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
    });
    assert.equal(res.statusCode, 200);
    // TTL slide is verified by Phase B Redis backend tests; here just confirm 200
  });

  test('AC-C4: rate-limited at >1 refresh per 5min per invocation', async () => {
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', 'thread-1');
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/callbacks/refresh-token',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
    });
    assert.equal(res1.statusCode, 200);
    // Immediate second refresh — should rate-limit
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/callbacks/refresh-token',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
    });
    assert.equal(res2.statusCode, 429);
    const body = JSON.parse(res2.body);
    assert.equal(body.error, 'refresh_rate_limited');
    assert.ok(typeof body.retryAfterMs === 'number');
  });
});
```

**Step 1.2: Run RED**

```bash
cd packages/api && pnpm run build && bash ./scripts/with-test-home.sh node --test --test-timeout=15000 test/callback-refresh-token.test.js
```

Expected: 4 FAIL (route handler doesn't exist).

**Step 1.3: Implement endpoint** in `callbacks.ts`:

```typescript
// after register-pr-tracking handler
const refreshCooldownMs = 5 * 60_000;
app.post('/api/callbacks/refresh-token', async (request, reply) => {
  const record = requireCallbackAuth(request, reply);
  if (!record) return; // preHandler already 401'd

  // Rate limit: per-invocation cooldown via best-effort lock
  // (Memory backend: simple Map; Redis backend: SET NX EX. We use the
  // registry's internal mechanism so it's restart-safe with Redis.)
  const cooldownClaimed = await registry.tryClaimRefreshCooldown(record.invocationId, refreshCooldownMs);
  if (!cooldownClaimed) {
    reply.status(429);
    return { error: 'refresh_rate_limited', retryAfterMs: refreshCooldownMs };
  }

  // requireCallbackAuth(via preHandler) already called registry.verify, which slid TTL.
  // We just compute remaining TTL from the (now-extended) record.
  const fresh = await registry.getRecord(record.invocationId);
  if (!fresh) {
    reply.status(401);
    return { error: 'callback_auth_failed', reason: 'unknown_invocation', message: 'Vanished mid-refresh', hint: '' };
  }
  const ttlRemainingMs = Math.max(0, fresh.expiresAt - Date.now());
  return { ok: true, expiresAt: fresh.expiresAt, ttlRemainingMs };
});
```

**Step 1.4: Add `tryClaimRefreshCooldown` to InvocationRegistry + backends**

```typescript
// IAuthInvocationBackend.ts
tryClaimRefreshCooldown(invocationId: string, cooldownMs: number): Promise<boolean>;

// MemoryAuthInvocationBackend.ts
private refreshCooldown = new Map<string, number>();
async tryClaimRefreshCooldown(id: string, cooldownMs: number): Promise<boolean> {
  const now = Date.now();
  const until = this.refreshCooldown.get(id);
  if (until && until > now) return false;
  this.refreshCooldown.set(id, now + cooldownMs);
  return true;
}

// RedisAuthInvocationBackend.ts — atomic SET NX
async tryClaimRefreshCooldown(id: string, cooldownMs: number): Promise<boolean> {
  const key = `auth:refresh-cooldown:${id}`;
  const result = await this.redis.set(key, '1', 'PX', cooldownMs, 'NX');
  return result === 'OK';
}

// InvocationRegistry.ts facade
async tryClaimRefreshCooldown(invocationId: string, cooldownMs: number): Promise<boolean> {
  return this.backend.tryClaimRefreshCooldown(invocationId, cooldownMs);
}
```

**Step 1.5: Verify GREEN + commit**

```bash
pnpm run build
bash ./scripts/with-test-home.sh node --test --test-timeout=15000 test/callback-refresh-token.test.js
git add ... && git commit -m "feat(F174-C): refresh-token endpoint + per-invocation cooldown"
```

---

### Task 2: MCP client refresh loop

**Files:**
- Create: `packages/mcp-server/src/refresh-loop.ts`
- Modify: `packages/mcp-server/src/index.ts` — start the loop on boot if callback config present
- Test: `packages/mcp-server/test/refresh-loop.test.ts` (new)

**Step 2.1: Failing test — adaptive interval algorithm**

```typescript
// packages/mcp-server/test/refresh-loop.test.ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('refresh loop adaptive scheduling', () => {
  test('AC-C3: clamp(ttlRemainingMs/4, 5min, 30min) + jitter ±15%', async () => {
    const { computeNextRefreshDelay } = await import('../dist/refresh-loop.js');

    // 2h TTL → /4 = 30min → clamped to 30min, ±15% = [25.5min, 34.5min]
    const d1 = computeNextRefreshDelay(2 * 60 * 60_000);
    assert.ok(d1 >= 25.5 * 60_000 && d1 <= 34.5 * 60_000, `2h TTL: got ${d1}ms`);

    // 10min TTL → /4 = 2.5min → clamped to 5min lower bound, ±15% = [4.25min, 5.75min]
    const d2 = computeNextRefreshDelay(10 * 60_000);
    assert.ok(d2 >= 4.25 * 60_000 && d2 <= 5.75 * 60_000, `10min TTL: got ${d2}ms`);

    // 4h TTL → /4 = 60min → clamped to 30min upper bound, ±15% = [25.5min, 34.5min]
    const d3 = computeNextRefreshDelay(4 * 60 * 60_000);
    assert.ok(d3 >= 25.5 * 60_000 && d3 <= 34.5 * 60_000, `4h TTL: got ${d3}ms`);
  });

  test('AC-C5: refresh failure does not throw, returns next-delay decision', async () => {
    const { handleRefreshFailure } = await import('../dist/refresh-loop.js');
    // Network error → reschedule with conservative delay
    const next = handleRefreshFailure(new Error('ECONNREFUSED'));
    assert.ok(next.shouldReschedule);
    assert.ok(next.delayMs >= 60_000); // at least 1min back-off
  });
});
```

**Step 2.2: Implement** `packages/mcp-server/src/refresh-loop.ts`:

```typescript
import { getCallbackConfig, callbackPost } from './tools/callback-tools.js';

const MIN_DELAY_MS = 5 * 60_000;
const MAX_DELAY_MS = 30 * 60_000;
const FALLBACK_DELAY_MS = 5 * 60_000; // initial / on-failure

export function computeNextRefreshDelay(ttlRemainingMs: number): number {
  const proportional = ttlRemainingMs / 4;
  const clamped = Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, proportional));
  const jitter = 0.85 + Math.random() * 0.3; // ±15%
  return Math.floor(clamped * jitter);
}

export function handleRefreshFailure(err: unknown): { shouldReschedule: boolean; delayMs: number } {
  // 401 (reason=expired/invalid_token/...) → don't bother — refresh won't help once we're already auth-dead.
  // Other errors (network / 5xx / 429) → conservative back-off, try again later.
  return { shouldReschedule: true, delayMs: FALLBACK_DELAY_MS };
}

export function startRefreshLoop(): { stop: () => void } {
  const config = getCallbackConfig();
  if (!config) {
    console.warn('[refresh-loop] no callback config — refresh loop disabled');
    return { stop: () => {} };
  }

  let timer: NodeJS.Timeout | null = null;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    const result = await callbackPost('/api/callbacks/refresh-token', {});
    let nextDelayMs = FALLBACK_DELAY_MS;
    if (!result.isError) {
      try {
        const body = JSON.parse(result.content[0].text);
        if (body?.ok && typeof body.ttlRemainingMs === 'number') {
          nextDelayMs = computeNextRefreshDelay(body.ttlRemainingMs);
        }
      } catch {
        /* malformed response — fall back to default */
      }
    } else {
      // 401, 429, network — log warn but keep trying
      console.warn('[refresh-loop] refresh failed:', result.content[0]?.text?.slice(0, 200));
    }
    if (!stopped) timer = setTimeout(tick, nextDelayMs);
  };

  // First tick after FALLBACK_DELAY_MS (let server settle)
  timer = setTimeout(tick, FALLBACK_DELAY_MS);

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
```

**Step 2.3: Wire into MCP server entry**

```typescript
// packages/mcp-server/src/index.ts (or wherever the tool server is bootstrapped)
import { startRefreshLoop } from './refresh-loop.js';

const refreshHandle = startRefreshLoop();
process.on('SIGTERM', () => refreshHandle.stop());
process.on('SIGINT', () => refreshHandle.stop());
```

**Step 2.4: Verify GREEN + commit**

---

### Task 3: Integration test — full chain

**Files:**
- Create: `packages/api/test/integration/refresh-token-chain.test.ts`

Cover end-to-end: registry.create → simulated time advance → manual `POST /refresh-token` → verify TTL extended + cooldown enforced. Keeps the implementation honest across both backends.

---

### Task 4: Spec sync (Phase C status)

After PR merge:
- F174 spec: Status row `Phase C: ✅ merged via PR #xxxx`
- AC-C1 ~ AC-C5 → `[x]`
- Timeline: add merge entry

---

## Risk

| 风险 | 缓解 |
|---|---|
| Refresh loop spams API on transient failures | FALLBACK_DELAY_MS = 5min minimum; rate-limit endpoint enforces server-side cap regardless |
| Cooldown 5min hard-coded — too aggressive for short TTLs | Cooldown is intentionally 1/最大 refresh interval (5min) so even worst-case spam == 1 req/5min/invocation. Acceptable. |
| Background timer prevents process exit | Use `timer.unref()` so it doesn't hold the event loop alive |
| Memory backend cooldown leaks (Map grows unbounded) | TTL-style cleanup in MemoryBackend's existing cleanup (cooldown entries auto-purge at expiry) |

## Commit cadence

3-4 commits expected:
1. `feat(F174-C): refresh-token endpoint + cooldown infrastructure`
2. `feat(F174-C): MCP client refresh loop with adaptive interval`
3. `test(F174-C): integration — full refresh chain + cooldown enforcement`
4. (optional) docs sync

## Definition of Done (Phase C)

- [ ] AC-C1 ~ AC-C5 全部打勾
- [ ] `pnpm gate` 全绿
- [ ] PR 跨家族 review (gpt52) + 云端 review pass
- [ ] PR merged + spec Phase C synced
- [ ] Worktree cleaned up

## Next

Phase C merged → 启动 Phase D1 (telemetry counters — `callback_auth_failures_total{tool, cat, reason}`). KD-11 顺序: A → B → **C → D1** → E → D2 → F.
