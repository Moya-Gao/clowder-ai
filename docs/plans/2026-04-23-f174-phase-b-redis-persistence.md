---
feature_ids: [F174]
topics: [auth, mcp, infrastructure, redis, persistence]
doc_kind: plan
created: 2026-04-23
---

# F174 Phase B: InvocationRegistry Redis Persistence — Implementation Plan

**Feature:** F174 — `docs/features/F174-callback-auth-lifecycle.md`
**Goal:** 把 `InvocationRegistry` 从纯内存 `Map<>` 迁到 Redis（参照 `RedisInvocationRecordStore` 的 Hash + Lua 范式），API 重启 / 部署 / 崩溃后活跃 invocation 仍可 verify — 直接消灭"砚砚撞 register_pr_tracking 401 / 铲屎官撞干活半小时 token 过期"的根因之一。
**Acceptance Criteria:** （来自 spec Phase B）
- AC-B1: `InvocationRegistry` 支持 Redis backend，schema 设计参考 `RedisInvocationRecordStore.ts` 的 Hash + Lua 模式
- AC-B2: `verify()` / `create()` / `isLatest()` / `claimClientMessageId()` 全部走 Redis，通过现有 `invocation-registry.test.js` + 新增集成测试
- AC-B3: API 进程重启后，活跃 invocation 仍可 `verify()` 成功（集成测试：启-停-启 + verify 流程）
- AC-B4: `CAT_CAFE_INVOCATION_REGISTRY=memory` 回退可用（回滚保险）
- AC-B5: Worktree 用 6398，main 用 6399，不误触圣域（Redis config test）
- AC-B6: 不引入 Streams 作真相源；如做 audit 是副写（本 Phase 不做 audit）

**Architecture:** Port-Adapter pattern — define `IAuthInvocationBackend`，抽 `MemoryAuthInvocationBackend`（保留现有逻辑）+ 新增 `RedisAuthInvocationBackend`。`InvocationRegistry` 公共 API 不变，构造时注入 backend。env var `CAT_CAFE_INVOCATION_REGISTRY=memory|redis` 在 `index.ts:330` factory 选择 — 默认 `redis`（如果 Redis client 可用），test fallback `memory`。
**Tech Stack:** TypeScript / ioredis（Hash + Lua + PEXPIREAT）/ node:test
**前端验证:** No（纯后端基础设施）

---

## Straight-Line Check (B definition)

**B 定义**：API 进程 cold restart 后 `verify(oldInvocationId, oldCallbackToken)` 仍返回 `{ok:true, record}`（在 TTL 内），证明 token 不再因为进程重启失效。

**不在本 Phase 做**：
- 不上 Streams audit（KD-5 明确反对作真相源；audit 留给 future）
- 不改 verify 公共签名（Phase A 已定 `VerifyResult`，B 只换 storage）
- 不改 reason taxonomy（Phase A 已定）
- 不实现 refresh endpoint（Phase C）
- 不实现降级 framework（Phase E）

**Terminal schema**（写好就不动）：
```typescript
// packages/api/src/domains/cats/services/agents/invocation/IAuthInvocationBackend.ts
export interface IAuthInvocationBackend {
  create(record: Omit<InvocationRecord, 'expiresAt'>, ttlMs: number): Promise<void>;
  verify(invocationId: string, callbackToken: string, ttlMs: number): Promise<VerifyResult>;
  getRecord(invocationId: string): Promise<InvocationRecord | null>;
  isLatest(invocationId: string): Promise<boolean>;
  getLatestId(threadId: string, catId: string): Promise<string | undefined>;
  claimClientMessageId(invocationId: string, clientMessageId: string): Promise<boolean>;
}
```

**Why async 全部 Promise**：Redis 必须 async；为统一 API，memory backend 也 wrap async（轻量代价）。consumer (preHandler/wecom/lark) **大改 await**，但每处都已经在 async handler 里，await 加得起。

**Three-question check on every step**：
- 输出留在最终系统？✅ Backend interface + Redis 实现都是终态
- demo/test 后？✅ 每步有可跑测试 + 集成测试覆盖 restart 场景
- 删了这步成本？指数级影响 — 不持久化就回到 Phase A 之前问题

### Async migration scope（决策）

`InvocationRegistry.verify()` 当前 sync。改 async 后所有 caller 要 await：
- `callback-auth-prehandler.ts:54` — preHandler 已经是 async fn ✅
- `callback-wecom-action-routes.ts:97` — handler 是 async ✅
- `callback-lark-action-routes.ts:114` — handler 是 async ✅
- `community-issues.ts:35` 接口签名 → 改为 `Promise<VerifyResult>`
- 测试 mock — 之前 sweep 28+ 处都返回 sync object；async 之后要 `async verify` 或返 Promise.resolve(...)

**重大 scope**: 28+ 测试 mock 文件再扫一遍。避免再次 patch dance — 这次一并改透。

---

## Tasks

### Task 1: Define `IAuthInvocationBackend` port + extract `MemoryAuthInvocationBackend`

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/invocation/IAuthInvocationBackend.ts`
- Create: `packages/api/src/domains/cats/services/agents/invocation/MemoryAuthInvocationBackend.ts`
- Modify: `packages/api/src/domains/cats/services/agents/invocation/InvocationRegistry.ts`（变 thin wrapper）

**Step 1.1: Write failing test for backend port contract**

新建 `packages/api/test/auth-invocation-backend-contract.test.js`：相同测试跑两个 backend 实例（memory + redis 后续接），保证行为一致。

```javascript
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

const backends = [
  ['memory', async () => {
    const { MemoryAuthInvocationBackend } = await import(
      '../dist/domains/cats/services/agents/invocation/MemoryAuthInvocationBackend.js'
    );
    return new MemoryAuthInvocationBackend({ maxRecords: 500 });
  }],
  // Redis backend appended in Task 3
];

for (const [name, makeBackend] of backends) {
  describe(`AuthInvocationBackend contract — ${name}`, () => {
    test('create + verify round-trip returns ok:true with record', async () => {
      const backend = await makeBackend();
      await backend.create({
        invocationId: 'inv-1', callbackToken: 'tok-1',
        userId: 'u-1', catId: 'opus', threadId: 't-1',
        clientMessageIds: new Set(), createdAt: Date.now(),
      }, 60_000);
      const result = await backend.verify('inv-1', 'tok-1', 60_000);
      assert.equal(result.ok, true);
      assert.equal(result.record.callbackToken, 'tok-1');
    });

    test('verify with wrong token returns reason:invalid_token', async () => {
      const backend = await makeBackend();
      await backend.create({
        invocationId: 'inv-2', callbackToken: 'tok-2',
        userId: 'u-1', catId: 'opus', threadId: 't-1',
        clientMessageIds: new Set(), createdAt: Date.now(),
      }, 60_000);
      const result = await backend.verify('inv-2', 'wrong', 60_000);
      assert.deepEqual(result, { ok: false, reason: 'invalid_token' });
    });

    test('verify with unknown id returns reason:unknown_invocation', async () => {
      const backend = await makeBackend();
      const result = await backend.verify('nonexistent', 'any', 60_000);
      assert.deepEqual(result, { ok: false, reason: 'unknown_invocation' });
    });

    test('verify after TTL expiry returns reason:expired', async () => {
      const backend = await makeBackend();
      await backend.create({
        invocationId: 'inv-3', callbackToken: 'tok-3',
        userId: 'u-1', catId: 'opus', threadId: 't-1',
        clientMessageIds: new Set(), createdAt: Date.now(),
      }, 10);
      await new Promise((r) => setTimeout(r, 30));
      const result = await backend.verify('inv-3', 'tok-3', 10);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'expired');
    });

    test('isLatest tracks latest invocation per thread+cat', async () => {
      const backend = await makeBackend();
      await backend.create({
        invocationId: 'old', callbackToken: 'tok-old',
        userId: 'u-1', catId: 'opus', threadId: 't-1',
        clientMessageIds: new Set(), createdAt: Date.now(),
      }, 60_000);
      await backend.create({
        invocationId: 'new', callbackToken: 'tok-new',
        userId: 'u-1', catId: 'opus', threadId: 't-1',
        clientMessageIds: new Set(), createdAt: Date.now(),
      }, 60_000);
      assert.equal(await backend.isLatest('old'), false);
      assert.equal(await backend.isLatest('new'), true);
    });

    test('claimClientMessageId dedupes per invocation', async () => {
      const backend = await makeBackend();
      await backend.create({
        invocationId: 'inv-c', callbackToken: 'tok-c',
        userId: 'u-1', catId: 'opus', threadId: 't-1',
        clientMessageIds: new Set(), createdAt: Date.now(),
      }, 60_000);
      assert.equal(await backend.claimClientMessageId('inv-c', 'msg-1'), true);
      assert.equal(await backend.claimClientMessageId('inv-c', 'msg-1'), false);
      assert.equal(await backend.claimClientMessageId('inv-c', 'msg-2'), true);
    });
  });
}
```

**Step 1.2: Run test to verify it fails**

```bash
cd packages/api && bash ./scripts/with-test-home.sh node --test --test-timeout=30000 test/auth-invocation-backend-contract.test.js
```

Expected: FAIL（MemoryAuthInvocationBackend module doesn't exist）

**Step 1.3: Implement `IAuthInvocationBackend` port**

```typescript
// packages/api/src/domains/cats/services/agents/invocation/IAuthInvocationBackend.ts
import type { InvocationRecord, VerifyResult } from './InvocationRegistry.js';

export interface IAuthInvocationBackend {
  create(record: Omit<InvocationRecord, 'expiresAt'>, ttlMs: number): Promise<void>;
  verify(invocationId: string, callbackToken: string, ttlMs: number): Promise<VerifyResult>;
  getRecord(invocationId: string): Promise<InvocationRecord | null>;
  isLatest(invocationId: string): Promise<boolean>;
  getLatestId(threadId: string, catId: string): Promise<string | undefined>;
  claimClientMessageId(invocationId: string, clientMessageId: string): Promise<boolean>;
}
```

**Step 1.4: Implement `MemoryAuthInvocationBackend`**

把现有 `InvocationRegistry` 的内部状态 + 方法搬过来，wrap async。保留 LRU/TTL/sliding window 行为完全等价。

**Step 1.5: Refactor `InvocationRegistry` to delegate**

```typescript
// InvocationRegistry.ts 变成 thin facade，保留公共 API 但 verify/create/isLatest 都 await backend。
// CAT_CAFE_MAX_CLIENT_MESSAGE_IDS 等常量沉到 MemoryBackend。
// verify 签名变 async — 这是 breaking change（async migration scope）。
```

**Step 1.6: Run contract test → MemoryBackend 全绿**

```bash
pnpm --filter @cat-cafe/api build
bash ./scripts/with-test-home.sh node --test --test-timeout=30000 test/auth-invocation-backend-contract.test.js
```

Expected: 6/6 PASS for memory.

**Step 1.7: Commit**

```bash
git commit -m "feat(F174-B): extract IAuthInvocationBackend + MemoryAuthInvocationBackend [宪宪/Opus-47🐾]"
```

---

### Task 2: Migrate `verify()` callers to async

**Files:**
- Modify: `packages/api/src/routes/callback-auth-prehandler.ts:54`（add `await`）
- Modify: `packages/api/src/routes/callback-wecom-action-routes.ts:97`（add `await`）
- Modify: `packages/api/src/routes/callback-lark-action-routes.ts:114`（add `await`）
- Modify: `packages/api/src/routes/community-issues.ts:35`（interface → `Promise<VerifyResult>`）
- Modify: 28+ test mock files — `verify(...) {...}` → `async verify(...) {...}` (or return `Promise.resolve(...)`)

**Step 2.1: Sweep test mocks** (one shot)

```bash
# Pattern: `verify(invocationId, callbackToken)` → `async verify(invocationId, callbackToken)`
# Pattern: `verify: () =>` / `verify: (...) =>` → `verify: async () =>` / `verify: async (...) =>`
# Verify by grep after change.
```

**Step 2.2: Update src callers**

Each: `const result = registry.verify(...)` → `const result = await registry.verify(...)`

**Step 2.3: Build + lint + run impacted tests**

```bash
pnpm --filter @cat-cafe/api lint  # tsc --noEmit catches missing await
pnpm --filter @cat-cafe/api build
bash ./scripts/with-test-home.sh node --test --test-timeout=30000 \
  test/invocation-registry.test.js test/callback-auth-prehandler.test.js \
  test/callback-thread-cats.test.js test/multi-mention-routes.test.js \
  test/community-issues-routes.test.js test/schedule-route.test.js \
  test/workflow-sop-callback.test.js test/integration/wiring.test.js \
  test/memory/callback-memory-di.test.js
```

Expected: 全绿（async 改完）

**Step 2.4: Commit**

```bash
git commit -m "refactor(F174-B): make verify() async + update callers [宪宪/Opus-47🐾]"
```

---

### Task 3: Implement `RedisAuthInvocationBackend`

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/invocation/RedisAuthInvocationBackend.ts`
- Modify: `packages/api/test/auth-invocation-backend-contract.test.js`（append redis backend variant）

**Schema**（参照 `RedisInvocationRecordStore` Hash + Lua 范式 + LL-016 keyPrefix gotcha）：

| Key | Type | Fields/Members | TTL |
|---|---|---|---|
| `auth:inv:{invocationId}` | Hash | callbackToken, userId, catId, threadId, parentInvocationId?, a2aTriggerMessageId?, createdAt, expiresAt | PEXPIREAT(expiresAt) |
| `auth:inv:{invocationId}:msgs` | Set | clientMessageId strings | PEXPIREAT(expiresAt)（同主 record） |
| `auth:latest:{threadId}:{catId}` | String | invocationId | PEXPIREAT(expiresAt) |

ioredis `keyPrefix` 自动加（已有 `cat-cafe:` prefix in client config）。**裸 key 传给 ioredis，不手动 prepend。**

**Step 3.1: Lua scripts**

```lua
-- VERIFY_AND_SLIDE_LUA
-- KEYS[1] = auth:inv:{invocationId}  (ioredis auto-prefixes)
-- ARGV[1] = expectedCallbackToken
-- ARGV[2] = nowMs (string)
-- ARGV[3] = newExpiresAtMs (string)
-- Returns: { 'ok', <hash flat list> } | { 'fail', '<reason>' }

local exists = redis.call('EXISTS', KEYS[1])
if exists == 0 then
  return {'fail', 'unknown_invocation'}
end

local stored = redis.call('HGET', KEYS[1], 'callbackToken')
if stored ~= ARGV[1] then
  return {'fail', 'invalid_token'}
end

local expiresAt = tonumber(redis.call('HGET', KEYS[1], 'expiresAt'))
if not expiresAt or tonumber(ARGV[2]) > expiresAt then
  redis.call('DEL', KEYS[1])  -- TTL 已超，主动清
  return {'fail', 'expired'}
end

-- Slide: update expiresAt + PEXPIREAT
redis.call('HSET', KEYS[1], 'expiresAt', ARGV[3])
redis.call('PEXPIREAT', KEYS[1], ARGV[3])

return {'ok', redis.call('HGETALL', KEYS[1])}
```

```lua
-- CREATE_LUA
-- KEYS[1] = auth:inv:{invocationId}
-- KEYS[2] = auth:latest:{threadId}:{catId}
-- ARGV[1..N] = field/value pairs
-- ARGV[N+1] = expiresAtMs
local n = #ARGV - 1
local fields = {}
for i = 1, n do fields[i] = ARGV[i] end
redis.call('HSET', KEYS[1], unpack(fields))
redis.call('PEXPIREAT', KEYS[1], ARGV[n + 1])
redis.call('SET', KEYS[2], ARGV[2])  -- ARGV[2] should be invocationId from fields
redis.call('PEXPIREAT', KEYS[2], ARGV[n + 1])
```

**Step 3.2: Implementation skeleton**

```typescript
// RedisAuthInvocationBackend.ts (~150 lines target)
const KEY_PREFIX = 'auth:';
const recordKey = (id: string) => `${KEY_PREFIX}inv:${id}`;
const msgsKey = (id: string) => `${KEY_PREFIX}inv:${id}:msgs`;
const latestKey = (threadId: string, catId: string) =>
  `${KEY_PREFIX}latest:${threadId}:${catId}`;

export class RedisAuthInvocationBackend implements IAuthInvocationBackend {
  constructor(private readonly redis: RedisClient) {}

  async create(record, ttlMs) {
    const expiresAt = Date.now() + ttlMs;
    const fields = [
      'invocationId', record.invocationId,
      'callbackToken', record.callbackToken,
      // ... including 'expiresAt'
    ];
    await this.redis.eval(CREATE_LUA, 2, recordKey(record.invocationId),
      latestKey(record.threadId, record.catId), ...fields, String(expiresAt));
  }

  async verify(invocationId, callbackToken, ttlMs) {
    const newExpiresAt = Date.now() + ttlMs;
    const result = await this.redis.eval(VERIFY_LUA, 1, recordKey(invocationId),
      callbackToken, String(Date.now()), String(newExpiresAt));
    if (result[0] === 'fail') return { ok: false, reason: result[1] };
    const record = parseHashArray(result[1]);
    return { ok: true, record };
  }

  async isLatest(invocationId) {
    const record = await this.getRecord(invocationId);
    if (!record) return false;
    const latest = await this.redis.get(latestKey(record.threadId, record.catId));
    return latest === invocationId;
  }

  async claimClientMessageId(invocationId, clientMessageId) {
    const added = await this.redis.sadd(msgsKey(invocationId), clientMessageId);
    return added === 1;
    // Note: bound check via SCARD — if > 1000, SPOP oldest. Phase B keeps it simple,
    // skip bound enforcement for now since Redis Sets don't have a natural "oldest" notion;
    // rely on TTL to bound memory.
  }

  // ... getRecord, getLatestId
}
```

**Step 3.3: Append redis backend to contract test**

```javascript
// auth-invocation-backend-contract.test.js
backends.push(['redis', async () => {
  const { RedisAuthInvocationBackend } = await import(
    '../dist/domains/cats/services/agents/invocation/RedisAuthInvocationBackend.js'
  );
  const { createRedisClient } = await import('@cat-cafe/shared/utils');
  const redis = createRedisClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6398' });
  // Cleanup before each test (test:redis sets up isolated Redis)
  await redis.flushdb();
  return new RedisAuthInvocationBackend(redis);
}]);
```

**Step 3.4: Run via test:redis** (the harness sets up isolated redis on a free port)

```bash
pnpm --filter @cat-cafe/api test:redis  # or specific:
bash ./scripts/with-test-home.sh bash ./scripts/run-isolated-redis-tests.sh test/auth-invocation-backend-contract.test.js
```

Expected: 12/12 PASS（6 memory + 6 redis）

**Step 3.5: Commit**

```bash
git commit -m "feat(F174-B): RedisAuthInvocationBackend with Hash + Lua atomic verify [宪宪/Opus-47🐾]"
```

---

### Task 4: Wire env-based factory + Restart Resilience integration test

**Files:**
- Modify: `packages/api/src/index.ts:329-333`（factory selects backend）
- Create: `packages/api/test/integration/auth-invocation-restart.test.js`

**Step 4.1: Factory update**

```typescript
// index.ts ~330
const backendKind = process.env.CAT_CAFE_INVOCATION_REGISTRY ?? 'redis';
const backend = backendKind === 'redis' && redis
  ? new RedisAuthInvocationBackend(redis)
  : new MemoryAuthInvocationBackend({ maxRecords: 500 });
const registry = new InvocationRegistry({ backend });
```

**Step 4.2: Restart resilience integration test**

```javascript
test('AC-B3: invocation token verifiable across simulated process restart', async () => {
  const { RedisAuthInvocationBackend } = await import('...');
  const redis1 = createRedisClient({ url: process.env.REDIS_URL });
  const backend1 = new RedisAuthInvocationBackend(redis1);
  await backend1.create({
    invocationId: 'survive-me', callbackToken: 'tok-survive',
    userId: 'u-1', catId: 'opus', threadId: 't-1',
    clientMessageIds: new Set(), createdAt: Date.now(),
  }, 60_000);
  await redis1.quit();  // simulate process exit

  // New process — fresh client, no in-process state
  const redis2 = createRedisClient({ url: process.env.REDIS_URL });
  const backend2 = new RedisAuthInvocationBackend(redis2);
  const result = await backend2.verify('survive-me', 'tok-survive', 60_000);
  assert.equal(result.ok, true, 'token must verify after process restart');
  assert.equal(result.record.userId, 'u-1');
  await redis2.quit();
});
```

**Step 4.3: AC-B5 Redis port config test**

```javascript
test('AC-B5: REDIS_URL points at 6398 in worktree, not 6399', () => {
  const url = process.env.REDIS_URL;
  if (!url) return; // skip if no env
  assert.ok(!url.includes(':6399'), 'worktree must not point at 圣域 6399');
  assert.ok(url.includes(':6398'), 'worktree must use isolated 6398');
});
```

**Step 4.4: Memory fallback test (AC-B4)**

```javascript
test('AC-B4: CAT_CAFE_INVOCATION_REGISTRY=memory uses memory backend', async () => {
  // Spin up a stub registry with env override; verify backend type
  process.env.CAT_CAFE_INVOCATION_REGISTRY = 'memory';
  // ... factory test or integration test
});
```

**Step 4.5: Run + commit**

```bash
pnpm --filter @cat-cafe/api test:redis
git commit -m "feat(F174-B): factory selects backend by env + restart resilience integration test [宪宪/Opus-47🐾]"
```

---

### Task 5: Quality gate + PR

**Step 5.1: pnpm gate**

```bash
cd /path/to/worktree && pnpm gate
```

Expected: 全绿（rebase + build + test + lint + check）

**Step 5.2: Spec sync — Phase B AC checkboxes**

Edit `docs/features/F174-callback-auth-lifecycle.md`:
- AC-B1~B6 → `[x]`
- Timeline: `2026-04-MM | Phase B merged via PR #xxxx`
- Status row updated if all sub-criteria done

**Step 5.3: PR + cross-family review + cloud review + merge**

按 merge-gate skill 走完整流程。Reviewer 候选：@gpt52（Phase A 已熟悉）or @codex 任选。

---

## Risk during Phase B

| 风险 | 缓解 |
|---|---|
| `verify()` 改 async breaks 28+ mocks again | Task 2 一次性 sweep；用 grep + `pnpm lint` 双重确认 |
| Lua script 语义跟 memory backend 偏差 | contract test 同时跑两个 backend，确保行为一致 |
| ioredis keyPrefix 双前缀 (LL-016 / `eee9ff4` 旧坑) | **裸 key 传给 ioredis**，不手动 prepend；verify 输出 keys 一致 |
| Lua TTL 边界（`> expiresAt` vs `>= expiresAt`）和 memory 不一致 | contract test "expired" case 双 backend 对比 |
| Redis client `flushdb()` 误清生产数据 | 测试 setup 必须 assert REDIS_URL 端口 == 6398（AC-B5 显式断言） |
| 新 backend 性能未测 | 设性能基线 < 5ms（来自 spec Risk 节）；如超标加 pipeline；本 Phase 不优化，只验功能 |
| `claimClientMessageId` Set 没有 1000 上限 | Phase B 暂依赖 TTL 自然清理；后续 Phase 加 SCARD/SPOP 如有压力 |

## Commit cadence

预期 4-5 commits：
1. `feat(F174-B): extract IAuthInvocationBackend + MemoryAuthInvocationBackend`
2. `refactor(F174-B): make verify() async + update callers`
3. `feat(F174-B): RedisAuthInvocationBackend with Hash + Lua atomic verify`
4. `feat(F174-B): factory selects backend by env + restart resilience test`
5. (optional) bug fixes / biome cleanup

## Definition of Done (Phase B)

- [ ] AC-B1 ~ B6 全部打勾
- [ ] `pnpm gate` 全绿
- [ ] PR 通过跨家族 review
- [ ] PR merged，spec Phase B AC 同步打勾
- [ ] 砚砚的 PR tracking 失败率应该立刻掉到接近 0（依赖 Phase D telemetry 验证，Phase B 至少证明机制不再丢 token）

## Next

Phase B merged → 启 Phase C（Refresh Endpoint — `POST /api/callbacks/refresh-token` + 客户端 `clamp(ttl/4, 5m, 30m) + jitter` 续期算法）。
