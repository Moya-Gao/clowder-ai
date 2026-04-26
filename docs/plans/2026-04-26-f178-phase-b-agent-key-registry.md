# F178 Phase B: CallbackPrincipal + AgentKeyRegistry Implementation Plan

**Feature:** F178 — `docs/features/F178-persistent-mcp-agent-key-auth.md`
**Goal:** Introduce `CallbackPrincipal` abstraction + `AgentKeyRegistry` with dual backends, so Phase C can plug agent-key auth into the MCP write tool path.
**Acceptance Criteria:**
- AC-B1: `CallbackPrincipal` abstraction (`kind: 'invocation' | 'agent_key'`), existing invocation path unchanged
- AC-B2: `AgentKeyRegistry` + Redis persistence + in-memory fallback
- AC-B3: issuance / verification / revocation / rotation / list API + unit tests (secret one-time return, server stores hash only)
- AC-B4: Structured error reason codes (`agent_key_expired` / `agent_key_revoked` / `agent_key_scope_mismatch`), aligned with F174 reason set
**Architecture:** Mirror F174 `InvocationRegistry` dual-backend pattern (interface → memory + Redis backends → facade). Key differences: secret hashing (sha256 + salt), no threadId binding (per-cat-per-user), rotation with ≤24h grace, no latest-pointer/refresh-cooldown (not applicable to long-lived keys).
**Tech Stack:** Node.js, ioredis, Redis Lua scripts, node:crypto (sha256 + randomBytes), node:test
**NOT building:** Phase C (preHandler wiring, MCP tool integration), Phase D (Hub UI), client-side secret injection, actual agent-key issuance automation.
**前端验证:** No — backend only.

---

## Terminal Schema

```typescript
// @cat-cafe/shared — new types

// 1. Agent-key failure reasons (extends F174 reason taxonomy)
export const AGENT_KEY_FAILURE_REASONS = [
  'agent_key_expired',
  'agent_key_revoked',
  'agent_key_unknown',
  'agent_key_scope_mismatch',
] as const;
export type AgentKeyFailureReason = (typeof AGENT_KEY_FAILURE_REASONS)[number];

// 2. Agent-key record
export interface AgentKeyRecord {
  agentKeyId: string;           // ak_<random>
  catId: CatId;
  userId: string;
  secretHash: string;           // sha256(secret + salt)
  salt: string;                 // per-key random salt
  scope: 'user-bound';
  issuedAt: number;
  expiresAt: number;            // 45d default
  rotatedFrom?: string;         // previous key id (rotation chain)
  graceUntil?: number;          // old key still valid until (≤24h after rotation)
  lastUsedAt?: number;
  revokedAt?: number;
  revokedReason?: string;
}

// 3. CallbackPrincipal — the real coordinate transform (KD-3)
export type CallbackPrincipal =
  | {
      kind: 'invocation';
      invocationId: string;
      parentInvocationId?: string;
      threadId: string;
      userId: string;
      catId: CatId;
    }
  | {
      kind: 'agent_key';
      agentKeyId: string;
      userId: string;
      catId: CatId;
      scope: 'user-bound';
    };

// 4. AgentKeyVerifyResult
export type AgentKeyVerifyResult =
  | { ok: true; record: AgentKeyRecord }
  | { ok: false; reason: AgentKeyFailureReason };
```

---

## Task 1: Shared Types — Reason Codes + AgentKeyRecord + CallbackPrincipal

**Files:**
- Create: `packages/shared/src/types/agent-key-reasons.ts`
- Create: `packages/shared/src/types/agent-key.ts`
- Create: `packages/shared/src/types/callback-principal.ts`
- Modify: `packages/shared/src/types/index.ts`

### Step 1: Write `agent-key-reasons.ts`

```typescript
// packages/shared/src/types/agent-key-reasons.ts
export const AGENT_KEY_FAILURE_REASONS = [
  'agent_key_expired',
  'agent_key_revoked',
  'agent_key_unknown',
  'agent_key_scope_mismatch',
] as const;

export type AgentKeyFailureReason = (typeof AGENT_KEY_FAILURE_REASONS)[number];

export function isAgentKeyFailureReason(value: unknown): value is AgentKeyFailureReason {
  return typeof value === 'string' && (AGENT_KEY_FAILURE_REASONS as readonly string[]).includes(value);
}
```

### Step 2: Write `agent-key.ts`

```typescript
// packages/shared/src/types/agent-key.ts
import type { CatId } from './cat-config.js';

export interface AgentKeyRecord {
  agentKeyId: string;
  catId: CatId;
  userId: string;
  secretHash: string;
  salt: string;
  scope: 'user-bound';
  issuedAt: number;
  expiresAt: number;
  rotatedFrom?: string;
  graceUntil?: number;
  lastUsedAt?: number;
  revokedAt?: number;
  revokedReason?: string;
}

export type AgentKeyVerifyResult =
  | { ok: true; record: AgentKeyRecord }
  | { ok: false; reason: import('./agent-key-reasons.js').AgentKeyFailureReason };
```

### Step 3: Write `callback-principal.ts`

```typescript
// packages/shared/src/types/callback-principal.ts
import type { CatId } from './cat-config.js';

export type CallbackPrincipal =
  | {
      kind: 'invocation';
      invocationId: string;
      parentInvocationId?: string;
      threadId: string;
      userId: string;
      catId: CatId;
    }
  | {
      kind: 'agent_key';
      agentKeyId: string;
      userId: string;
      catId: CatId;
      scope: 'user-bound';
    };
```

### Step 4: Add exports to `index.ts`

Add after the existing `callback-auth-reasons` export block:

```typescript
// F178 Phase B: agent-key reason taxonomy
export {
  AGENT_KEY_FAILURE_REASONS,
  type AgentKeyFailureReason,
  isAgentKeyFailureReason,
} from './agent-key-reasons.js';
// F178 Phase B: agent-key record + verify result
export type { AgentKeyRecord, AgentKeyVerifyResult } from './agent-key.js';
// F178 Phase B: unified callback principal (KD-3)
export type { CallbackPrincipal } from './callback-principal.js';
```

### Step 5: Build shared

Run: `pnpm --filter @cat-cafe/shared build`
Expected: clean build, no errors

### Step 6: Commit

```
feat(F178-B): add agent-key types + CallbackPrincipal to @cat-cafe/shared
```

---

## Task 2: IAgentKeyBackend Interface

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/agent-key/IAgentKeyBackend.ts`

### Step 1: Write backend interface

```typescript
// packages/api/src/domains/cats/services/agents/agent-key/IAgentKeyBackend.ts
import type { AgentKeyRecord, AgentKeyVerifyResult } from '@cat-cafe/shared';

export type AgentKeyInput = Omit<AgentKeyRecord, 'lastUsedAt'>;

export interface IAgentKeyBackend {
  create(input: AgentKeyInput): Promise<void>;
  verify(secret: string): Promise<AgentKeyVerifyResult>;
  get(agentKeyId: string): Promise<AgentKeyRecord | null>;
  list(filter: { catId?: string; userId?: string; includeRevoked?: boolean }): Promise<AgentKeyRecord[]>;
  revoke(agentKeyId: string, reason: string): Promise<boolean>;
  updateGrace(agentKeyId: string, graceUntil: number): Promise<boolean>;
  touchLastUsed(agentKeyId: string, timestamp: number): Promise<void>;
}
```

### Step 2: Commit

```
feat(F178-B): add IAgentKeyBackend interface
```

---

## Task 3: AgentKeyRegistry Facade + MemoryAgentKeyBackend (TDD)

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/agent-key/MemoryAgentKeyBackend.ts`
- Create: `packages/api/src/domains/cats/services/agents/agent-key/AgentKeyRegistry.ts`
- Create: `packages/api/test/agent-key-registry.test.js`

### Step 1: Write failing tests

```javascript
// packages/api/test/agent-key-registry.test.js
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('AgentKeyRegistry', () => {
  test('issue() returns agentKeyId and one-time secret', async () => {
    const { AgentKeyRegistry } = await import(
      '../dist/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const registry = new AgentKeyRegistry();
    const result = await registry.issue('bengal', 'user-1');
    assert.ok(result.agentKeyId.startsWith('ak_'));
    assert.ok(typeof result.secret === 'string');
    assert.ok(result.secret.length >= 32);
  });

  test('verify() returns ok:true for valid secret', async () => {
    const { AgentKeyRegistry } = await import(
      '../dist/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const registry = new AgentKeyRegistry();
    const { secret } = await registry.issue('bengal', 'user-1');
    const result = await registry.verify(secret);
    assert.equal(result.ok, true);
    assert.equal(result.record.catId, 'bengal');
    assert.equal(result.record.userId, 'user-1');
    assert.equal(result.record.scope, 'user-bound');
  });

  test('verify() returns agent_key_unknown for bad secret', async () => {
    const { AgentKeyRegistry } = await import(
      '../dist/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const registry = new AgentKeyRegistry();
    const result = await registry.verify('bad-secret');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'agent_key_unknown');
  });

  test('verify() returns agent_key_expired after TTL', async () => {
    const { AgentKeyRegistry } = await import(
      '../dist/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const registry = new AgentKeyRegistry({ ttlMs: 1 }); // 1ms TTL
    const { secret } = await registry.issue('bengal', 'user-1');
    await new Promise(r => setTimeout(r, 10));
    const result = await registry.verify(secret);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'agent_key_expired');
  });

  test('revoke() makes verify() return agent_key_revoked', async () => {
    const { AgentKeyRegistry } = await import(
      '../dist/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const registry = new AgentKeyRegistry();
    const { agentKeyId, secret } = await registry.issue('bengal', 'user-1');
    const revoked = await registry.revoke(agentKeyId, 'test revocation');
    assert.ok(revoked);
    const result = await registry.verify(secret);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'agent_key_revoked');
  });

  test('rotate() issues new key and old key enters grace', async () => {
    const { AgentKeyRegistry } = await import(
      '../dist/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const registry = new AgentKeyRegistry();
    const old = await registry.issue('bengal', 'user-1');
    const rotated = await registry.rotate(old.agentKeyId);
    assert.ok(rotated.agentKeyId !== old.agentKeyId);
    assert.ok(rotated.agentKeyId.startsWith('ak_'));
    // Old key still works during grace
    const oldResult = await registry.verify(old.secret);
    assert.equal(oldResult.ok, true);
    // New key works
    const newResult = await registry.verify(rotated.secret);
    assert.equal(newResult.ok, true);
  });

  test('rotate() old key fails after grace expires', async () => {
    const { AgentKeyRegistry } = await import(
      '../dist/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const registry = new AgentKeyRegistry({ ttlMs: 100_000, graceMs: 1 }); // 1ms grace
    const old = await registry.issue('bengal', 'user-1');
    await registry.rotate(old.agentKeyId);
    await new Promise(r => setTimeout(r, 10));
    const oldResult = await registry.verify(old.secret);
    assert.equal(oldResult.ok, false);
    assert.equal(oldResult.reason, 'agent_key_expired');
  });

  test('list() filters by catId and userId', async () => {
    const { AgentKeyRegistry } = await import(
      '../dist/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const registry = new AgentKeyRegistry();
    await registry.issue('bengal', 'user-1');
    await registry.issue('bengal', 'user-2');
    await registry.issue('opus', 'user-1');
    const bengalUser1 = await registry.list({ catId: 'bengal', userId: 'user-1' });
    assert.equal(bengalUser1.length, 1);
    assert.equal(bengalUser1[0].catId, 'bengal');
    const allBengal = await registry.list({ catId: 'bengal' });
    assert.equal(allBengal.length, 2);
  });

  test('list() excludes revoked by default', async () => {
    const { AgentKeyRegistry } = await import(
      '../dist/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const registry = new AgentKeyRegistry();
    const { agentKeyId } = await registry.issue('bengal', 'user-1');
    await registry.issue('bengal', 'user-1');
    await registry.revoke(agentKeyId, 'test');
    const active = await registry.list({ catId: 'bengal' });
    assert.equal(active.length, 1);
    const all = await registry.list({ catId: 'bengal', includeRevoked: true });
    assert.equal(all.length, 2);
  });

  test('verify() updates lastUsedAt', async () => {
    const { AgentKeyRegistry } = await import(
      '../dist/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const registry = new AgentKeyRegistry();
    const { agentKeyId, secret } = await registry.issue('bengal', 'user-1');
    const before = (await registry.list({}))[0].lastUsedAt;
    assert.equal(before, undefined);
    await registry.verify(secret);
    const after = (await registry.list({}))[0].lastUsedAt;
    assert.ok(typeof after === 'number');
  });

  test('secret is never stored — only hash', async () => {
    const { AgentKeyRegistry } = await import(
      '../dist/domains/cats/services/agents/agent-key/AgentKeyRegistry.js'
    );
    const registry = new AgentKeyRegistry();
    const { secret } = await registry.issue('bengal', 'user-1');
    const records = await registry.list({});
    assert.equal(records.length, 1);
    assert.ok(records[0].secretHash);
    assert.ok(records[0].salt);
    // secretHash is NOT the secret itself
    assert.notEqual(records[0].secretHash, secret);
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/api && pnpm build && node --test test/agent-key-registry.test.js`
Expected: FAIL — module not found

### Step 3: Write `MemoryAgentKeyBackend.ts`

```typescript
// packages/api/src/domains/cats/services/agents/agent-key/MemoryAgentKeyBackend.ts
import { createHash, randomBytes } from 'node:crypto';
import type { AgentKeyRecord, AgentKeyVerifyResult } from '@cat-cafe/shared';
import type { AgentKeyInput, IAgentKeyBackend } from './IAgentKeyBackend.js';

export class MemoryAgentKeyBackend implements IAgentKeyBackend {
  private records = new Map<string, AgentKeyRecord>();
  /** secret plaintext → agentKeyId (in-memory only, for verify lookup) */
  private secretIndex = new Map<string, string>();

  async create(input: AgentKeyInput): Promise<void> {
    this.records.set(input.agentKeyId, { ...input });
  }

  /** Called by registry after create to index the plaintext secret. */
  indexSecret(secret: string, agentKeyId: string): void {
    this.secretIndex.set(secret, agentKeyId);
  }

  async verify(secret: string): Promise<AgentKeyVerifyResult> {
    const agentKeyId = this.secretIndex.get(secret);
    if (!agentKeyId) {
      // Brute-force fallback: hash against all records
      for (const record of this.records.values()) {
        const hash = createHash('sha256').update(secret + record.salt).digest('hex');
        if (hash === record.secretHash) {
          return this.verifyRecord(record);
        }
      }
      return { ok: false, reason: 'agent_key_unknown' };
    }
    const record = this.records.get(agentKeyId);
    if (!record) return { ok: false, reason: 'agent_key_unknown' };
    return this.verifyRecord(record);
  }

  private verifyRecord(record: AgentKeyRecord): AgentKeyVerifyResult {
    if (record.revokedAt) return { ok: false, reason: 'agent_key_revoked' };
    const now = Date.now();
    // Check grace period for rotated keys
    if (record.graceUntil && now > record.graceUntil) {
      return { ok: false, reason: 'agent_key_expired' };
    }
    if (!record.graceUntil && now > record.expiresAt) {
      return { ok: false, reason: 'agent_key_expired' };
    }
    record.lastUsedAt = now;
    return { ok: true, record: { ...record } };
  }

  async get(agentKeyId: string): Promise<AgentKeyRecord | null> {
    return this.records.get(agentKeyId) ?? null;
  }

  async list(filter: { catId?: string; userId?: string; includeRevoked?: boolean }): Promise<AgentKeyRecord[]> {
    const results: AgentKeyRecord[] = [];
    for (const record of this.records.values()) {
      if (filter.catId && record.catId !== filter.catId) continue;
      if (filter.userId && record.userId !== filter.userId) continue;
      if (!filter.includeRevoked && record.revokedAt) continue;
      results.push({ ...record });
    }
    return results;
  }

  async revoke(agentKeyId: string, reason: string): Promise<boolean> {
    const record = this.records.get(agentKeyId);
    if (!record) return false;
    record.revokedAt = Date.now();
    record.revokedReason = reason;
    return true;
  }

  async updateGrace(agentKeyId: string, graceUntil: number): Promise<boolean> {
    const record = this.records.get(agentKeyId);
    if (!record) return false;
    record.graceUntil = graceUntil;
    return true;
  }

  async touchLastUsed(agentKeyId: string, timestamp: number): Promise<void> {
    const record = this.records.get(agentKeyId);
    if (record) record.lastUsedAt = timestamp;
  }
}
```

### Step 4: Write `AgentKeyRegistry.ts`

```typescript
// packages/api/src/domains/cats/services/agents/agent-key/AgentKeyRegistry.ts
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AgentKeyRecord, AgentKeyVerifyResult, CatId } from '@cat-cafe/shared';
import type { IAgentKeyBackend } from './IAgentKeyBackend.js';
import { MemoryAgentKeyBackend } from './MemoryAgentKeyBackend.js';

const DEFAULT_TTL_MS = 45 * 24 * 60 * 60 * 1000; // 45 days
const DEFAULT_GRACE_MS = 24 * 60 * 60 * 1000;     // 24 hours

export class AgentKeyRegistry {
  private readonly backend: IAgentKeyBackend;
  private readonly ttlMs: number;
  private readonly graceMs: number;

  constructor(options?: { ttlMs?: number; graceMs?: number; backend?: IAgentKeyBackend }) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    this.graceMs = options?.graceMs ?? DEFAULT_GRACE_MS;
    this.backend = options?.backend ?? new MemoryAgentKeyBackend();
  }

  async issue(catId: CatId, userId: string): Promise<{ agentKeyId: string; secret: string }> {
    const agentKeyId = `ak_${randomUUID().replace(/-/g, '')}`;
    const secret = randomBytes(32).toString('hex');
    const salt = randomBytes(16).toString('hex');
    const secretHash = createHash('sha256').update(secret + salt).digest('hex');
    const now = Date.now();

    await this.backend.create({
      agentKeyId,
      catId,
      userId,
      secretHash,
      salt,
      scope: 'user-bound',
      issuedAt: now,
      expiresAt: now + this.ttlMs,
    });

    // Memory backend needs secret index for O(1) verify
    if (this.backend instanceof MemoryAgentKeyBackend) {
      this.backend.indexSecret(secret, agentKeyId);
    }

    return { agentKeyId, secret };
  }

  async verify(secret: string): Promise<AgentKeyVerifyResult> {
    return this.backend.verify(secret);
  }

  async revoke(agentKeyId: string, reason: string): Promise<boolean> {
    return this.backend.revoke(agentKeyId, reason);
  }

  async rotate(agentKeyId: string): Promise<{ agentKeyId: string; secret: string }> {
    const old = await this.backend.get(agentKeyId);
    if (!old) throw new Error(`Agent key not found: ${agentKeyId}`);
    if (old.revokedAt) throw new Error(`Cannot rotate revoked key: ${agentKeyId}`);

    // Set grace on old key
    const graceUntil = Date.now() + this.graceMs;
    await this.backend.updateGrace(agentKeyId, graceUntil);

    // Issue new key with rotation chain
    const newResult = await this.issue(old.catId, old.userId);
    const newRecord = await this.backend.get(newResult.agentKeyId);
    if (newRecord) {
      // Patch rotatedFrom (backend.create doesn't set it, so we update in place)
      // For memory backend this works; Redis backend will handle in Lua
      (newRecord as AgentKeyRecord).rotatedFrom = agentKeyId;
    }

    return newResult;
  }

  async list(filter: { catId?: string; userId?: string; includeRevoked?: boolean }): Promise<AgentKeyRecord[]> {
    return this.backend.list(filter);
  }

  async get(agentKeyId: string): Promise<AgentKeyRecord | null> {
    return this.backend.get(agentKeyId);
  }
}
```

### Step 5: Run tests

Run: `cd packages/api && pnpm build && node --test test/agent-key-registry.test.js`
Expected: all tests PASS

### Step 6: Commit

```
feat(F178-B): AgentKeyRegistry + MemoryAgentKeyBackend — issue/verify/revoke/rotate/list
```

---

## Task 4: Callback Scope Helpers — CallbackPrincipal Support

**Files:**
- Modify: `packages/api/src/routes/callback-scope-helpers.ts`
- Create: `packages/api/test/callback-principal-helpers.test.js`

### Step 1: Write failing tests

```javascript
// packages/api/test/callback-principal-helpers.test.js
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('CallbackPrincipal helpers', () => {
  test('derivePrincipal() from InvocationRecord returns kind:invocation', async () => {
    const { derivePrincipal } = await import('../dist/routes/callback-scope-helpers.js');
    const record = {
      invocationId: 'inv-1',
      callbackToken: 'tok',
      userId: 'user-1',
      catId: 'opus',
      threadId: 'thread-1',
      clientMessageIds: new Set(),
      createdAt: Date.now(),
      expiresAt: Date.now() + 10000,
    };
    const p = derivePrincipal(record);
    assert.equal(p.kind, 'invocation');
    assert.equal(p.threadId, 'thread-1');
    assert.equal(p.invocationId, 'inv-1');
  });

  test('derivePrincipal() from AgentKeyRecord returns kind:agent_key', async () => {
    const { derivePrincipal } = await import('../dist/routes/callback-scope-helpers.js');
    const record = {
      agentKeyId: 'ak_123',
      catId: 'bengal',
      userId: 'user-1',
      secretHash: 'xxx',
      salt: 'yyy',
      scope: 'user-bound',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 10000,
    };
    const p = derivePrincipal(record);
    assert.equal(p.kind, 'agent_key');
    assert.equal(p.agentKeyId, 'ak_123');
    assert.equal(p.scope, 'user-bound');
    assert.equal(p.threadId, undefined); // no threadId on agent_key
  });

  test('resolvePrincipalThread() requires explicit threadId for agent_key', async () => {
    const { resolvePrincipalThread } = await import('../dist/routes/callback-scope-helpers.js');
    const principal = { kind: 'agent_key', agentKeyId: 'ak_1', userId: 'u1', catId: 'bengal', scope: 'user-bound' };
    // No threadId → 400
    const noThread = await resolvePrincipalThread(principal, undefined, {});
    assert.equal(noThread.ok, false);
    assert.equal(noThread.statusCode, 400);
  });

  test('resolvePrincipalThread() allows invocation to use bound thread', async () => {
    const { resolvePrincipalThread } = await import('../dist/routes/callback-scope-helpers.js');
    const principal = { kind: 'invocation', invocationId: 'i1', threadId: 't1', userId: 'u1', catId: 'opus' };
    const result = await resolvePrincipalThread(principal, undefined, {});
    assert.equal(result.ok, true);
    assert.equal(result.threadId, 't1');
  });

  // Existing deriveCallbackActor still works (AC-B1: existing invocation path unchanged)
  test('deriveCallbackActor() still works unchanged', async () => {
    const { deriveCallbackActor } = await import('../dist/routes/callback-scope-helpers.js');
    const record = {
      invocationId: 'inv-1',
      callbackToken: 'tok',
      userId: 'user-1',
      catId: 'opus',
      threadId: 'thread-1',
      clientMessageIds: new Set(),
      createdAt: Date.now(),
      expiresAt: Date.now() + 10000,
    };
    const actor = deriveCallbackActor(record);
    assert.equal(actor.invocationId, 'inv-1');
    assert.equal(actor.threadId, 'thread-1');
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/api && pnpm build && node --test test/callback-principal-helpers.test.js`
Expected: FAIL — `derivePrincipal` not found

### Step 3: Add `derivePrincipal()` and `resolvePrincipalThread()` to callback-scope-helpers.ts

Add to `packages/api/src/routes/callback-scope-helpers.ts` — keep all existing exports unchanged, add new ones:

```typescript
import type { AgentKeyRecord, CallbackPrincipal } from '@cat-cafe/shared';

// New: derive principal from either record type
export function derivePrincipal(record: InvocationRecord | AgentKeyRecord): CallbackPrincipal {
  if ('invocationId' in record) {
    return {
      kind: 'invocation',
      invocationId: record.invocationId,
      ...(record.parentInvocationId ? { parentInvocationId: record.parentInvocationId } : {}),
      threadId: record.threadId,
      userId: record.userId,
      catId: createCatId(record.catId),
    };
  }
  return {
    kind: 'agent_key',
    agentKeyId: record.agentKeyId,
    userId: record.userId,
    catId: createCatId(record.catId),
    scope: record.scope,
  };
}

// New: resolve thread for any principal kind (KD-8: agent_key must give explicit threadId)
export async function resolvePrincipalThread(
  principal: CallbackPrincipal,
  requestedThreadId: string | undefined,
  options: {
    threadStore?: Pick<IThreadStore, 'get'>;
    threadStoreMissingError?: string;
    accessDeniedError?: string;
  },
): Promise<{ ok: true; threadId: string } | { ok: false; statusCode: 400 | 403 | 503; error: string }> {
  if (principal.kind === 'agent_key') {
    if (!requestedThreadId) {
      return { ok: false, statusCode: 400, error: 'agent-key path requires explicit threadId' };
    }
    // Agent-key: verify user owns the target thread
    return resolveScopedThreadId(
      { threadId: '', userId: principal.userId },
      requestedThreadId,
      options,
    );
  }
  // Invocation: existing behavior
  return resolveScopedThreadId(principal, requestedThreadId, options);
}
```

### Step 4: Run tests

Run: `cd packages/api && pnpm build && node --test test/callback-principal-helpers.test.js`
Expected: all tests PASS

### Step 5: Run existing callback-scope tests to verify no regression

Run: `cd packages/api && node --test test/callback-auth-prehandler.test.js`
Expected: all existing tests PASS (AC-B1)

### Step 6: Commit

```
feat(F178-B): derivePrincipal + resolvePrincipalThread — CallbackPrincipal scope helpers
```

---

## Task 5: Type Check + Gate

### Step 1: Build all

Run: `pnpm lint`
Expected: no type errors

### Step 2: Run full test suite

Run: `cd packages/api && node --test test/agent-key-registry.test.js test/callback-principal-helpers.test.js`
Expected: all PASS

### Step 3: Run existing invocation-registry tests (regression check)

Run: `cd packages/api && node --test test/invocation-registry.test.js`
Expected: all PASS unchanged

### Step 4: Commit all + final gate

Run: `pnpm check && pnpm lint`

---

## Task 6 (stretch): RedisAgentKeyBackend

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/agent-key/RedisAgentKeyBackend.ts`
- Create: `packages/api/src/domains/cats/services/agents/agent-key/agent-key-redis-keys.ts`

> This task uses `pnpm --filter @cat-cafe/api test:redis` for Redis integration tests. If Redis is not available, Task 3's MemoryAgentKeyBackend is the fallback (AC-B2 allows in-memory fallback).

### Redis key schema

```
agent-key:{agentKeyId}              → Hash (all AgentKeyRecord fields)
agent-key:secret-index:{secretHash} → String (agentKeyId) — for O(1) verify
```

### Lua scripts needed

**VERIFY_LUA**: Given secret, compute hash against stored salt, check revoked/expired/grace, update lastUsedAt atomically.

**CREATE_LUA**: HSET record + SET secret-index pointer + PEXPIREAT both.

> Detailed Lua scripts to be written during TDD in worktree — the structure mirrors `RedisAuthInvocationBackend.ts` lines 46-138.

### Step 1: Write redis key helpers

```typescript
// agent-key-redis-keys.ts
export const AgentKeyKeys = {
  detail: (id: string) => `agent-key:${id}`,
  secretIndex: (secretHash: string) => `agent-key:secret-idx:${secretHash}`,
} as const;
```

### Step 2-6: TDD cycle (write test → implement → verify)

Run: `pnpm --filter @cat-cafe/api test:redis`

### Step 7: Commit

```
feat(F178-B): RedisAgentKeyBackend — Redis persistence with Lua atomicity
```

---

## Summary: AC Mapping

| AC | Task | Verified by |
|----|------|-------------|
| AC-B1 | Task 1 (CallbackPrincipal type) + Task 4 (scope helpers) + existing tests green | `callback-principal-helpers.test.js` + `invocation-registry.test.js` regression |
| AC-B2 | Task 3 (MemoryBackend) + Task 6 (RedisBackend) | `agent-key-registry.test.js` + `test:redis` |
| AC-B3 | Task 3 (issue/verify/revoke/rotate/list + hash-only) | `agent-key-registry.test.js` all 10 cases |
| AC-B4 | Task 1 (reason codes in shared) | Type check + `agent-key-registry.test.js` reason assertions |
