---
feature_ids: [F174]
topics: [auth, mcp, infrastructure]
doc_kind: plan
created: 2026-04-23
---

# F174 Phase A: Structured Auth Failure Reasons — Implementation Plan

**Feature:** F174 — `docs/features/F174-callback-auth-lifecycle.md`
**Goal:** 把 callback auth 校验失败原因结构化（`AuthFailureReason` 枚举 + `VerifyResult` 类型），下游 Phase D（telemetry）和 Phase E（降级）能拿到准确 reason，不再靠 regex 字符串猜错误。
**Acceptance Criteria:**
- AC-A1: `AuthFailureReason` 类型 + `VerifyResult` 落地（`InvocationRegistry.ts`）
- AC-A2: `verify()` 返回 `VerifyResult`，所有调用点更新（含 preHandler、stale guard、claimClientMessageId）
- AC-A3: preHandler 401 响应 body 包含 `reason` 字段（`callback-auth-prehandler.ts`）
- AC-A4: `stale_invocation` 与 `expired` 在 reason 上明确分开
- AC-A5: 客户端 `callbackPost`/`callbackGet` 解析 `reason`，不再用 regex 字符串匹配
**Architecture:** 引入 discriminated union `VerifyResult = {ok:true,record} | {ok:false,reason}`；改 `verify()` 签名，preHandler 把 reason 写入 401 body；客户端 outbox / callback-tools 解析 reason 字段并保留兼容（旧响应没 reason 时回退到字符串识别一段时间）。
**Tech Stack:** TypeScript / Fastify (preHandler) / node:test
**前端验证:** No（纯后端 + MCP 客户端）

---

## Straight-Line Check (B definition)

**B 定义**：`InvocationRegistry.verify()` 返回 `VerifyResult` 而不是 `record | null`；preHandler 401 响应 body 含 `{ error, reason, hint }`；客户端 `callbackPost/Get` 不再 regex 字符串匹配 'expired' / 'invalid'，改用 `reason` 字段判定降级路径（降级 framework 本身不在本 Phase 落地，本 Phase 只把 reason 透传给上层调用方）。

**不在本 Phase 做**：
- 不实现降级 framework（那是 Phase E）
- 不上 Redis 持久化（那是 Phase B）
- 不做 dashboard / counters（那是 D1，可在本 Phase 后立刻接）
- 不改 MCP tool description（reason 是内部协议，对猫不可见）

**Terminal schema**（写好就不动）：
```typescript
// packages/api/src/domains/cats/services/agents/invocation/InvocationRegistry.ts
export type AuthFailureReason =
  | 'expired'           // TTL 到了
  | 'invalid_token'     // invocationId 存在但 callbackToken 不匹配
  | 'unknown_invocation'// invocationId 不存在（registry restart 或 LRU evict 后）
  | 'missing_creds';    // header/body 都没传（仅 preHandler 用）
// 注：'stale_invocation' 不在 verify() reason 集合里——stale 检测是 isLatest()
// 在调用方做的，由具体 route（post_message/schedule）emit。verify 本身不做 stale。

export type VerifyResult =
  | { ok: true; record: InvocationRecord }
  | { ok: false; reason: AuthFailureReason };
```

```typescript
// packages/api/src/routes/callback-errors.ts
export type CallbackAuthErrorReason =
  | 'expired' | 'invalid_token' | 'unknown_invocation' | 'missing_creds' | 'stale_invocation';

export interface CallbackAuthErrorBody {
  error: 'callback_auth_failed';
  reason: CallbackAuthErrorReason;
  message: string;  // 人话描述
  hint: string;     // 现有 hint 文案保留
}
```

**Three-question check on every step**：
- 输出留在最终系统？✅ 类型一旦定，下游 Phase B-F 都按这个建
- demo/test 后？✅ 每步都有可跑测试
- 删了这步成本？指数级影响 Phase D/E（regex 匹配会被永久埋藏）

---

## Tasks

### Task 1: Add `AuthFailureReason` + `VerifyResult` types to InvocationRegistry

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/InvocationRegistry.ts:14-35`（加类型导出）
- Modify: `packages/api/src/domains/cats/services/agents/invocation/InvocationRegistry.ts:110-132`（改 `verify()` 签名）
- Test: `packages/api/test/InvocationRegistry.test.ts`（如已存在则扩展，否则新建）

**Step 1.1: Write failing tests** — 新增 4 个测试覆盖 4 种 reason

```typescript
// packages/api/test/InvocationRegistry.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InvocationRegistry } from '../src/domains/cats/services/agents/invocation/InvocationRegistry.js';

test('verify() returns ok:true with record on valid creds', () => {
  const reg = new InvocationRegistry();
  const { invocationId, callbackToken } = reg.create('user-1', 'opus-47', 'thread-1');
  const result = reg.verify(invocationId, callbackToken);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.record.invocationId, invocationId);
});

test('verify() returns ok:false reason:unknown_invocation when invocationId not found', () => {
  const reg = new InvocationRegistry();
  const result = reg.verify('nonexistent-id', 'any-token');
  assert.deepEqual(result, { ok: false, reason: 'unknown_invocation' });
});

test('verify() returns ok:false reason:invalid_token when invocationId exists but token mismatches', () => {
  const reg = new InvocationRegistry();
  const { invocationId } = reg.create('user-1', 'opus-47', 'thread-1');
  const result = reg.verify(invocationId, 'wrong-token');
  assert.deepEqual(result, { ok: false, reason: 'invalid_token' });
});

test('verify() returns ok:false reason:expired after TTL elapses', async () => {
  const reg = new InvocationRegistry({ ttlMs: 10 });
  const { invocationId, callbackToken } = reg.create('user-1', 'opus-47', 'thread-1');
  await new Promise((r) => setTimeout(r, 20));
  const result = reg.verify(invocationId, callbackToken);
  assert.deepEqual(result, { ok: false, reason: 'expired' });
});
```

**Step 1.2: Run tests to verify they fail**

```bash
bash ./scripts/with-test-home.sh node --test --test-timeout=30000 packages/api/test/InvocationRegistry.test.ts
```

Expected: 4 FAIL（type error or `result.ok` is undefined — 当前 verify 返回 record|null）

**Step 1.3: Implement types + change verify() signature**

修改 `packages/api/src/domains/cats/services/agents/invocation/InvocationRegistry.ts`：

在 `InvocationRecord` 接口前加类型导出：
```typescript
export type AuthFailureReason =
  | 'expired'
  | 'invalid_token'
  | 'unknown_invocation'
  | 'missing_creds';

export type VerifyResult =
  | { ok: true; record: InvocationRecord }
  | { ok: false; reason: AuthFailureReason };
```

改 `verify()`（line 110-132）：
```typescript
verify(invocationId: string, callbackToken: string): VerifyResult {
  const record = this.records.get(invocationId);
  if (!record) return { ok: false, reason: 'unknown_invocation' };

  // Check token match
  if (record.callbackToken !== callbackToken) {
    return { ok: false, reason: 'invalid_token' };
  }

  // Check TTL
  if (Date.now() > record.expiresAt) {
    this.cleanupLatestPointer(invocationId);
    this.records.delete(invocationId);
    return { ok: false, reason: 'expired' };
  }

  // Sliding window: each successful verify extends the TTL
  record.expiresAt = Date.now() + this.ttlMs;

  // Refresh recency (LRU): delete + re-set moves to end of Map iteration order
  this.records.delete(invocationId);
  this.records.set(invocationId, record);

  return { ok: true, record };
}
```

**Step 1.4: Run tests to verify they pass**

```bash
bash ./scripts/with-test-home.sh node --test --test-timeout=30000 packages/api/test/InvocationRegistry.test.ts
```

Expected: 4 PASS

**Step 1.5: Run typecheck — see what callers break**

```bash
pnpm --filter @cat-cafe/api lint 2>&1 | grep -E "verify\(|VerifyResult|InvocationRecord" | head -20
```

Expected: 列出所有调用点（preHandler、可能的 routes）作为 Task 2 输入

**Step 1.6: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/invocation/InvocationRegistry.ts packages/api/test/InvocationRegistry.test.ts
git commit -m "feat(F174-A): VerifyResult discriminated union for InvocationRegistry [宪宪/Opus-47🐾]"
```

---

### Task 2: Update preHandler to emit `reason` in 401 response body

**Files:**
- Modify: `packages/api/src/routes/callback-errors.ts:1-6`（结构化 error body + 类型）
- Modify: `packages/api/src/routes/callback-auth-prehandler.ts:54-58`（接住 VerifyResult）
- Test: `packages/api/test/callback-auth-prehandler.test.js`（如已存在则扩展）

**Step 2.1: Write failing tests** — preHandler 不同失败场景返回的 401 body 应含正确 reason

```typescript
// packages/api/test/callback-auth-prehandler.test.js — 新增测试
test('preHandler returns 401 with reason:unknown_invocation when invocationId not in registry', async () => {
  const app = await buildAppWithRegistry();
  const response = await app.inject({
    method: 'POST',
    url: '/api/callbacks/post-message',
    headers: { 'x-invocation-id': 'nonexistent', 'x-callback-token': 'any' },
    payload: { content: 'hi' },
  });
  assert.equal(response.statusCode, 401);
  const body = JSON.parse(response.body);
  assert.equal(body.error, 'callback_auth_failed');
  assert.equal(body.reason, 'unknown_invocation');
});

test('preHandler returns 401 with reason:invalid_token when token mismatches', async () => {
  const app = await buildAppWithRegistry();
  const { invocationId } = registry.create('user-1', 'opus-47', 'thread-1');
  const response = await app.inject({
    method: 'POST',
    url: '/api/callbacks/post-message',
    headers: { 'x-invocation-id': invocationId, 'x-callback-token': 'wrong' },
    payload: { content: 'hi' },
  });
  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).reason, 'invalid_token');
});

test('preHandler returns 401 with reason:missing_creds when no header present', async () => {
  const app = await buildAppWithRegistry();
  const response = await app.inject({
    method: 'POST',
    url: '/api/callbacks/post-message',
    headers: { 'x-invocation-id': 'only-one' },  // missing token
    payload: { content: 'hi' },
  });
  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).reason, 'missing_creds');
});
```

**Step 2.2: Run tests to verify they fail**

```bash
bash ./scripts/with-test-home.sh node --test --test-timeout=30000 packages/api/test/callback-auth-prehandler.test.js
```

Expected: 3 FAIL（current body is `{error, hint}`, no reason field）

**Step 2.3: Update `callback-errors.ts` with structured types**

```typescript
// packages/api/src/routes/callback-errors.ts
export type CallbackAuthErrorReason =
  | 'expired'
  | 'invalid_token'
  | 'unknown_invocation'
  | 'missing_creds'
  | 'stale_invocation';

export interface CallbackAuthErrorBody {
  error: 'callback_auth_failed';
  reason: CallbackAuthErrorReason;
  message: string;
  hint: string;
}

const HINT =
  '如果只是想 @队友，直接在回复文本里另起一行、行首写 @猫名，并在同一段写明确动作请求（如：请确认/请处理/请决策，免费且永不过期）。Callback token 有生命周期限制（默认约2小时，成功校验会刷新），仅用于异步中途汇报。';

const MESSAGE_BY_REASON: Record<CallbackAuthErrorReason, string> = {
  expired: 'Callback credentials expired (TTL elapsed)',
  invalid_token: 'Callback token does not match invocation',
  unknown_invocation: 'Invocation id not found (registry may have restarted)',
  missing_creds: 'Callback credentials not provided in headers or body',
  stale_invocation: 'Invocation is no longer the latest for its thread/cat slot',
};

export function makeCallbackAuthError(reason: CallbackAuthErrorReason): CallbackAuthErrorBody {
  return {
    error: 'callback_auth_failed',
    reason,
    message: MESSAGE_BY_REASON[reason],
    hint: HINT,
  };
}

/** @deprecated use makeCallbackAuthError(reason). Kept for callers not yet migrated. */
export const EXPIRED_CREDENTIALS_ERROR = makeCallbackAuthError('expired');
```

**Step 2.4: Update preHandler to consume VerifyResult**

修改 `packages/api/src/routes/callback-auth-prehandler.ts`：

```typescript
// Replace import
import { makeCallbackAuthError } from './callback-errors.js';

// Replace lines 49-58 (the credentials-check + verify block):
if (!invocationId && !callbackToken) return;
if (!invocationId || !callbackToken) {
  reply.status(401).send(makeCallbackAuthError('missing_creds'));
  return;
}
const result = registry.verify(invocationId, callbackToken);
if (!result.ok) {
  reply.status(401).send(makeCallbackAuthError(result.reason));
  return;
}
const record = result.record;
```

**Step 2.5: Run tests to verify they pass**

```bash
bash ./scripts/with-test-home.sh node --test --test-timeout=30000 packages/api/test/callback-auth-prehandler.test.js
```

Expected: 3 new PASS + 现有测试不破

**Step 2.6: Commit**

```bash
git add packages/api/src/routes/callback-errors.ts packages/api/src/routes/callback-auth-prehandler.ts packages/api/test/callback-auth-prehandler.test.js
git commit -m "feat(F174-A): preHandler emits structured reason in 401 body [宪宪/Opus-47🐾]"
```

---

### Task 3: Migrate other callers of `EXPIRED_CREDENTIALS_ERROR` to `makeCallbackAuthError`

**Files (from Step 2 grep):**
- `packages/api/src/routes/callback-lark-action-routes.ts`
- `packages/api/src/routes/callback-wecom-action-routes.ts`
- 任何 Step 1.5 typecheck 列出的 `verify()` 调用点（除 preHandler 已处理）

**Step 3.1: Find all call sites**

```bash
grep -rn "EXPIRED_CREDENTIALS_ERROR\|registry\.verify\|InvocationRegistry" packages/api/src --include="*.ts" | grep -v "\.test\." | grep -v callback-errors | grep -v callback-auth-prehandler
```

**Step 3.2: For each caller, decide migration**

模式：
- 调用 `verify()` 后用 `if (!record)` → 改成 `if (!result.ok)` + 用 `makeCallbackAuthError(result.reason)`
- 引用 `EXPIRED_CREDENTIALS_ERROR` → 评估实际语义，多数情况是"expired"，少数可能要改成 `unknown_invocation`

**Step 3.3: Run full api typecheck + tests**

```bash
pnpm --filter @cat-cafe/api lint
bash ./scripts/with-test-home.sh node --test --test-timeout=60000 packages/api/test/
```

Expected: 全绿

**Step 3.4: Commit**

```bash
git add packages/api/src/routes/
git commit -m "feat(F174-A): migrate remaining callers to makeCallbackAuthError [宪宪/Opus-47🐾]"
```

---

### Task 4: Update MCP client `callbackPost`/`callbackGet` to parse `reason`

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:54-96`（callbackPost / callbackGet 解析 reason）
- Modify: `packages/mcp-server/src/tools/callback-outbox.ts`（sendCallbackRequest 透传 reason）
- Test: `packages/mcp-server/test/callback-tools.test.ts`（新增 reason 解析测试）

**Step 4.1: Write failing test** — callbackPost 收到 401+reason 时返回的 ToolResult 含 reason

```typescript
// packages/mcp-server/test/callback-tools.test.ts — 新增
test('callbackPost surfaces reason from 401 body', async () => {
  // mock fetch to return 401 with reason:unknown_invocation
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () =>
      JSON.stringify({ error: 'callback_auth_failed', reason: 'unknown_invocation', message: '...', hint: '...' }),
  } as any);

  process.env.CAT_CAFE_API_URL = 'http://localhost:3001';
  process.env.CAT_CAFE_INVOCATION_ID = 'test-id';
  process.env.CAT_CAFE_CALLBACK_TOKEN = 'test-token';

  const result = await callbackPost('/api/callbacks/post-message', { content: 'hi' });
  assert.equal(result.isError, true);
  // Expectation: error message includes structured reason marker
  assert.ok(result.content[0].text.includes('reason=unknown_invocation'));
});
```

**Step 4.2: Run test to verify it fails**

```bash
bash ./scripts/with-test-home.sh node --test --test-timeout=30000 packages/mcp-server/test/callback-tools.test.ts
```

Expected: FAIL（current error string is `Callback failed (401): {raw json}` — no reason marker）

**Step 4.3: Update `callbackPost`/`callbackGet` to extract reason**

在 `callback-tools.ts` 加一个解析函数（顶部 helpers 区）：

```typescript
type ParsedCallbackError = {
  status: number;
  reason?: string;  // 来自结构化响应
  rawText: string;
};

async function parseCallbackError(response: Response): Promise<ParsedCallbackError> {
  const rawText = await response.text();
  let reason: string | undefined;
  try {
    const body = JSON.parse(rawText);
    if (body && typeof body.reason === 'string') reason = body.reason;
  } catch {
    /* not JSON */
  }
  return { status: response.status, reason, rawText };
}

function formatCallbackError(parsed: ParsedCallbackError): string {
  const reasonTag = parsed.reason ? ` reason=${parsed.reason}` : '';
  return `Callback failed (${parsed.status})${reasonTag}: ${parsed.rawText}`;
}
```

修改 `callbackGet`（line 86-90）：
```typescript
const response = await fetch(url, { headers: buildAuthHeaders(config) });
if (!response.ok) {
  const parsed = await parseCallbackError(response);
  return errorResult(formatCallbackError(parsed));
}
```

修改 `callbackPost` 的 `sendCallbackRequest` 路径同理（看 outbox 实现，可能要在 outbox 内做或返回结构化 result）。

**关键注意**：sendCallbackRequest 走 outbox，错误格式可能由 outbox 控制。如果 outbox 当前丢弃 response body 只留 status，需要在 outbox 也加 reason 提取，或者把 reason 沿 outbox 链路透传。

**Step 4.4: Verify tests pass**

```bash
bash ./scripts/with-test-home.sh node --test --test-timeout=30000 packages/mcp-server/test/
```

**Step 4.5: Commit**

```bash
git add packages/mcp-server/src/tools/callback-tools.ts packages/mcp-server/src/tools/callback-outbox.ts packages/mcp-server/test/
git commit -m "feat(F174-A): MCP client parses structured reason from 401 body [宪宪/Opus-47🐾]"
```

---

### Task 5: Replace regex-based reason detection in callback-tools

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:268`（`lower.includes('invalid or expired callback credentials')`）
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:441`（rich block fallback hint）
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:260` 附近 401 检测

**Step 5.1: Find existing regex sites**

```bash
grep -nE "expired|invalid|/callback failed.*401/" packages/mcp-server/src/tools/callback-tools.ts
```

Confirmed sites: line 260 (status check), line 268 (string includes), line 441 (fallback message).

**Step 5.2: Write regression test** — 旧 regex 不再被命中（行为换证）

```typescript
// packages/mcp-server/test/callback-tools.test.ts
test('rich block fallback triggers on reason-based expired/unknown, not on regex match', async () => {
  // mock fetch to return 401 with reason:expired
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () =>
      JSON.stringify({ error: 'callback_auth_failed', reason: 'expired', message: 'x', hint: 'y' }),
  } as any);

  // ... call create_rich_block, assert fallback path taken
});

test('rich block fallback NOT triggered on reason:invalid_token (different code path)', async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () =>
      JSON.stringify({ error: 'callback_auth_failed', reason: 'invalid_token', message: 'x', hint: 'y' }),
  } as any);

  // assert different error surface (not the cc_rich fallback text)
});
```

**Step 5.3: Replace regex with reason check**

把 line 268 的 `lower.includes(...)` 之类改成：
```typescript
const parsed = await parseCallbackError(response);
if (parsed.status === 401 && (parsed.reason === 'expired' || parsed.reason === 'unknown_invocation')) {
  // trigger fallback path (Phase E will formalize this; Phase A only routes signal)
}
```

**关键约束**：本 Phase **不**实现降级 framework — 只是把"现有 cc_rich fallback"路径的触发条件从字符串改成 reason，行为不变。framework 化是 Phase E。

**Step 5.4: Verify tests pass + run full mcp-server suite**

```bash
bash ./scripts/with-test-home.sh node --test --test-timeout=60000 packages/mcp-server/test/
```

Expected: 全绿，新加 2 测试 PASS，已有测试不破

**Step 5.5: Commit**

```bash
git add packages/mcp-server/src/tools/callback-tools.ts packages/mcp-server/test/
git commit -m "feat(F174-A): replace regex-based 401 detection with structured reason [宪宪/Opus-47🐾]"
```

---

### Task 6: Integration test — full chain

**Files:**
- Test: `packages/api/test/integration/callback-auth-reason-chain.test.ts`（新建）

**Step 6.1: Write integration test** — 真实跑一次：注册 invocation → expire it → 调 callback route → preHandler 返 401+reason='expired' → 客户端解析正确

```typescript
test('full chain: expired token → preHandler returns reason=expired → client parses', async () => {
  const reg = new InvocationRegistry({ ttlMs: 50 });
  const app = await buildApp({ registry: reg });
  const { invocationId, callbackToken } = reg.create('user-1', 'opus-47', 'thread-1');

  await new Promise((r) => setTimeout(r, 100));  // let TTL expire

  const response = await app.inject({
    method: 'POST',
    url: '/api/callbacks/post-message',
    headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
    payload: { content: 'too late' },
  });
  assert.equal(response.statusCode, 401);
  const body = JSON.parse(response.body);
  assert.equal(body.error, 'callback_auth_failed');
  assert.equal(body.reason, 'expired');
  assert.match(body.message, /TTL elapsed/i);
});
```

**Step 6.2: Run + verify pass**

```bash
bash ./scripts/with-test-home.sh node --test --test-timeout=30000 packages/api/test/integration/callback-auth-reason-chain.test.ts
```

**Step 6.3: Commit**

```bash
git add packages/api/test/integration/callback-auth-reason-chain.test.ts
git commit -m "test(F174-A): integration test for full auth reason chain [宪宪/Opus-47🐾]"
```

---

### Task 7: Quality gate + PR prep

**Step 7.1: Run full check**

```bash
pnpm check
pnpm lint
pnpm --filter @cat-cafe/api test:redis  # 若 callback 相关 redis 测试存在
bash ./scripts/with-test-home.sh node --test --test-timeout=60000 packages/api/test/ packages/mcp-server/test/
```

Expected: 全绿（含原有 callback-auth tests 不破）

**Step 7.2: Update F174 spec — Phase A AC checkboxes**

打勾 AC-A1~A5（如全部完成），更新 Timeline 加 "2026-04-MM Phase A merged via PR #xxxx"。

**Step 7.3: Quality gate skill → request-review skill → merge-gate**

按 SOP 链条推进。

---

## Risk during Phase A

| 风险 | 缓解 |
|---|---|
| `verify()` 签名 breaking change → 漏改调用点 → typecheck 红 | Step 1.5 用 `pnpm lint` 主动暴露所有调用点；Task 2/3 系统迁移 |
| `EXPIRED_CREDENTIALS_ERROR` 被 string-compare 使用（非 typed） | grep 兜底（`grep -rn "EXPIRED_CREDENTIALS_ERROR"`）确保所有 import 处都迁移 |
| MCP outbox 路径改后 client → API 兼容性破裂 | 保留旧响应 fallback：客户端解析 reason 失败时回退到原有 regex 一段时间（在 outbox 加 deprecation log） |
| 改动跨 api + mcp-server 两个包 → CI build 顺序 | shared 类型只在 api 内（`AuthFailureReason` reason 字符串 client 直接用 string literal 解析），不引入新跨包 import |

## Commit cadence

每个 Task 一个 commit。预期 6-7 个 commit + 1 个 PR。

## Definition of Done (Phase A)

- [ ] AC-A1 ~ A5 全部打勾
- [ ] `pnpm check` + `pnpm lint` + 全测试集 全绿
- [ ] PR 通过跨家族 review（@codex 或 @gpt52，reason taxonomy 完整性是重点）
- [ ] PR merged，spec Phase A AC 同步打勾
- [ ] **Spec 顺手补**：reason taxonomy 是否完整（5 项足够 or 漏掉了？）—— 这是给 Phase D1 的输入

## Next

Phase A merged → 启 Phase B（Persistence — Redis 化 InvocationRegistry，参照 `RedisInvocationRecordStore.ts` Hash + Lua 范式）。
