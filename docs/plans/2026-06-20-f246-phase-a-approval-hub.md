# F246 Approval Hub — Phase A Implementation Plan

**Feature:** F246 — `docs/features/F246-approval-hub.md`
**Goal:** CVO 审批散落各 thread，需要跨 thread 统一入口——Hub 通过 feature adapter 实时聚合 pending items，计数徽标 + 就地/跳转审批
**Acceptance Criteria:**
- AC-A1: F128 adapter → Hub 可见
- AC-A2: F225 adapter → Hub 可见
- AC-A3: Hub panel + 计数徽标
- AC-A4: F128 就地审批（全量 overrides: title/parentThreadId/preferredCats/initialMessage/projectPath/reportingMode）
- AC-A5: F225 跳转审批（需上下文）→ 跳到原 thread
- AC-A6: 过期标记 stale（纯投影，不自动 reject）
- AC-A7: ownerUserId 过滤（Hub 读写走 user auth）
- AC-A8: adapter internal-only（不暴露为 MCP/callback）
- AC-A9/A10: 无需 backfill（query aggregation 直读 canonical stores）
**Architecture cell:** platform-infra（subcell: approval-index）
**Map delta:** new cell required
**Map delta why:** F246 是新底座（approval-index cell），不属于现有 hub-action-surface（那个是 first-party 猫端 surface）或 identity-session cell；F246 是 CVO 审批聚合层
**Architecture:** Query aggregation — Hub 读取时通过 per-feature adapter 直查 canonical stores（`IProposalStore` / `ISessionHandoffProposalStore`），返回统一 `ApprovalItem[]` DTO。Approve/reject 由前端直调各 feature 现有 API 端点（`/api/proposals/:id/approve` / `/api/session-handoff/:id/approve`），复用已有 CAS/crash-recovery/side-effects，Hub backend 不重复审批逻辑。Badge count 是纯投影（`count(pending items)`），不独立存储。
**Tech Stack:** Fastify route / Zod / React / Zustand / WebSocket subscription
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测 Hub panel + inline approve

---

## Terminal Schema

### `ApprovalItem` (unified DTO, adapter output)

```typescript
// packages/shared/src/types/approval-hub.ts

export type ApprovalFeatureId = 'F128' | 'F225';

export type ApprovalItemStatus = 'pending' | 'stale';
// 只返回 pending/stale — approved/rejected 由 adapter 过滤掉（AC-A10）

export interface ApprovalItem {
  /** canonical proposal ID from the source store */
  proposalId: string;
  /** which feature this came from (router key for approve/reject) */
  sourceFeatureId: ApprovalFeatureId;
  /** thread where the proposal card lives */
  sourceThreadId: string;
  /** message ID of the proposal card (for jump-to) */
  sourceMessageId?: string;
  /** cat that created the proposal */
  requesterCatId: string;
  /** user who owns this approval (Hub filters by this) */
  ownerUserId: string;
  /** pending or stale (computed: expiresAt < now) */
  status: ApprovalItemStatus;
  /** human-readable summary */
  summary: string;
  /** detail fields for inline display */
  detail: Record<string, unknown>;
  /** whether this item supports inline approve in Hub */
  inlineApprovable: boolean;
  /** computed staleness threshold */
  expiresAt?: number;
  /** creation timestamp from canonical store */
  createdAt: number;
}
```

### `IApprovalAdapter` (per-feature adapter port)

```typescript
// packages/api/src/domains/approval-hub/ports/IApprovalAdapter.ts

export interface IApprovalAdapter {
  readonly featureId: ApprovalFeatureId;
  listPending(userId: string): Promise<ApprovalItem[]>;
}
```

### `ISessionHandoffProposalStore` extension

```typescript
// Added to existing interface:
listPendingByUser(userId: string, limit?: number):
  SessionHandoffProposal[] | Promise<SessionHandoffProposal[]>;
```

---

## Stateful Object Gate

### Census

| Object | Lifecycle? | New? | Gate verdict |
|--------|-----------|------|--------------|
| `ApprovalItem` | **No** — read-only DTO, computed at query time, discarded | New DTO | **No state machine needed** — pure projection from canonical stores |
| Badge count | **No** — derived value = `count(pending items)` | New derived | **Pure selector, zero storage** (派生值规则) |
| `ThreadProposal` | Yes — existing F128 CAS state machine | Existing, unmodified | Already has state×event table in F128 spec |
| `SessionHandoffProposal` | Yes — existing F225 commit-point state machine | Existing, unmodified | Already has state×event table in F225 spec |
| `stale` status on ApprovalItem | **No** — pure projection: `expiresAt < now` | New projection | **No store mutation** — computed client-side at render time |

**Verdict**: No new stateful lifecycle objects. All new entities are read-only projections or pure selectors. The only store modification is adding `listPendingByUser` (read-only query) to `ISessionHandoffProposalStore`, which doesn't change any state machine.

---

## Not Building

- Materialized CQRS index (v2+ when stores > 5)
- F193 E3 adapter (Phase B)
- Batch approve/reject (Phase C)
- Push notifications (separate concern)
- Independent Approval Hub storage/persistence

---

## Task 1: Shared Types — `ApprovalItem` + `ApprovalFeatureId`

**Files:**
- Create: `packages/shared/src/types/approval-hub.ts`
- Modify: `packages/shared/src/types/index.ts` (add re-export)
- Test: `packages/shared/src/types/__tests__/approval-hub.test.ts`

**Step 1: Write the test**

```typescript
// packages/shared/src/types/__tests__/approval-hub.test.ts
import { describe, expect, it } from 'vitest';
import type { ApprovalFeatureId, ApprovalItem, ApprovalItemStatus } from '../approval-hub.js';

describe('ApprovalItem type', () => {
  it('compiles with valid data', () => {
    const item: ApprovalItem = {
      proposalId: 'prop-1',
      sourceFeatureId: 'F128',
      sourceThreadId: 'thread-1',
      requesterCatId: 'opus',
      ownerUserId: 'user-1',
      status: 'pending',
      summary: 'New thread proposal: test',
      detail: { title: 'test' },
      inlineApprovable: true,
      createdAt: Date.now(),
    };
    expect(item.sourceFeatureId).toBe('F128');
  });

  it('status is pending or stale', () => {
    const statuses: ApprovalItemStatus[] = ['pending', 'stale'];
    expect(statuses).toHaveLength(2);
  });

  it('featureId is F128 or F225', () => {
    const ids: ApprovalFeatureId[] = ['F128', 'F225'];
    expect(ids).toHaveLength(2);
  });
});
```

**Step 2: Run test — expect FAIL (module not found)**

```bash
pnpm --filter @cat-cafe/shared exec vitest run src/types/__tests__/approval-hub.test.ts
```

**Step 3: Implement types**

```typescript
// packages/shared/src/types/approval-hub.ts
/**
 * F246: Approval Hub unified DTO.
 *
 * ApprovalItem is a read-only projection from canonical feature stores
 * (F128 ThreadProposal, F225 SessionHandoffProposal). No lifecycle, no
 * persistence — computed at Hub read-time via per-feature adapters and
 * discarded after response. (KD-3: v1 query aggregation)
 */

/** Features whose proposals can appear in the Approval Hub. v1 allowlist. */
export type ApprovalFeatureId = 'F128' | 'F225';

/**
 * Hub display status — a projection, not a canonical store status.
 * 'stale' is computed client-side: expiresAt < Date.now() → stale.
 * Approved/rejected items are excluded by adapter (AC-A10).
 */
export type ApprovalItemStatus = 'pending' | 'stale';

/** Unified DTO that all feature adapters produce. */
export interface ApprovalItem {
  proposalId: string;
  sourceFeatureId: ApprovalFeatureId;
  sourceThreadId: string;
  sourceMessageId?: string;
  requesterCatId: string;
  ownerUserId: string;
  status: ApprovalItemStatus;
  summary: string;
  /** Feature-specific detail fields for rendering. */
  detail: Record<string, unknown>;
  /** Hub can approve/reject inline (true for F128, false for F225). */
  inlineApprovable: boolean;
  /** Staleness threshold (ms epoch). undefined = never stale. */
  expiresAt?: number;
  createdAt: number;
}
```

Add re-export to `packages/shared/src/types/index.ts`:
```typescript
export type { ApprovalFeatureId, ApprovalItem, ApprovalItemStatus } from './approval-hub.js';
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add packages/shared/src/types/approval-hub.ts packages/shared/src/types/index.ts packages/shared/src/types/__tests__/approval-hub.test.ts
git commit -m "feat(F246): add ApprovalItem shared types for Approval Hub"
```

---

## Task 2: `ISessionHandoffProposalStore.listPendingByUser` — Store Extension

**Why**: F225 store has `listActiveBySession(sessionId)` and `getMostRecentByCatThread(userId,catId,threadId)` but no way to list all pending proposals for a user. F128's `IProposalStore` already has `listPending(userId)`. The F225 adapter needs an equivalent.

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/SessionHandoffProposalStore.ts` (interface + in-memory impl)
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisSessionHandoffProposalStore.ts` (Redis impl)
- Test: `packages/api/src/domains/cats/services/stores/__tests__/session-handoff-proposal-store.test.ts`

**Step 1: Write the failing test**

```typescript
// In existing test file, add:
describe('listPendingByUser', () => {
  it('returns only pending proposals for the given user', async () => {
    const store = createStore(); // factory for InMemory or Redis
    // Create 2 pending for user-1
    await store.create({ userId: 'user-1', sourceCatId: 'opus', sourceThreadId: 't1', sourceSessionId: 's1', note: { done: 'x', nextSteps: 'y' } });
    await store.create({ userId: 'user-1', sourceCatId: 'sonnet', sourceThreadId: 't2', sourceSessionId: 's2', note: { done: 'a', nextSteps: 'b' } });
    // Create 1 pending for user-2
    await store.create({ userId: 'user-2', sourceCatId: 'opus', sourceThreadId: 't3', sourceSessionId: 's3', note: { done: 'c', nextSteps: 'd' } });

    const result = await store.listPendingByUser('user-1');
    expect(result).toHaveLength(2);
    expect(result.every(p => p.userId === 'user-1')).toBe(true);
    expect(result.every(p => p.status === 'pending')).toBe(true);
  });

  it('excludes rejected/expired/approved proposals', async () => {
    const store = createStore();
    const p1 = await store.create({ userId: 'user-1', sourceCatId: 'opus', sourceThreadId: 't1', sourceSessionId: 's1', note: { done: 'x', nextSteps: 'y' } });
    const p2 = await store.create({ userId: 'user-1', sourceCatId: 'sonnet', sourceThreadId: 't2', sourceSessionId: 's2', note: { done: 'a', nextSteps: 'b' } });
    await store.markRejected(p1.proposalId);

    const result = await store.listPendingByUser('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].proposalId).toBe(p2.proposalId);
  });

  it('returns empty array when no pending proposals exist', async () => {
    const store = createStore();
    const result = await store.listPendingByUser('no-such-user');
    expect(result).toHaveLength(0);
  });

  it('sorts by createdAt descending (newest first)', async () => {
    const store = createStore();
    const p1 = await store.create({ userId: 'user-1', sourceCatId: 'opus', sourceThreadId: 't1', sourceSessionId: 's1', note: { done: 'x', nextSteps: 'y' } });
    const p2 = await store.create({ userId: 'user-1', sourceCatId: 'sonnet', sourceThreadId: 't2', sourceSessionId: 's2', note: { done: 'a', nextSteps: 'b' } });

    const result = await store.listPendingByUser('user-1');
    expect(result[0].createdAt).toBeGreaterThanOrEqual(result[1].createdAt);
  });
});
```

**Step 2: Run test — expect FAIL (`listPendingByUser` not found)**

**Step 3: Add to interface + in-memory impl**

Interface addition (port file):
```typescript
/** F246: list pending proposals for a user (approval hub aggregation). */
listPendingByUser(userId: string, limit?: number):
  SessionHandoffProposal[] | Promise<SessionHandoffProposal[]>;
```

In-memory implementation:
```typescript
listPendingByUser(userId: string, limit: number = 100): SessionHandoffProposal[] {
  const result: SessionHandoffProposal[] = [];
  for (const p of this.proposals.values()) {
    if (p.userId === userId && p.status === 'pending') {
      result.push(clone(p));
    }
  }
  result.sort((a, b) => b.createdAt - a.createdAt);
  return result.slice(0, Math.max(0, limit));
}
```

**Step 4: Redis implementation**

Add new key pattern to `RedisSessionHandoffProposalStore`:
```typescript
// New index: ZSet handoff-proposals:user:{userId} — all proposals for user (score=createdAt)
// New index: ZSet handoff-proposals:pending:{userId} — pending-only (zrem on claim/reject/expire)
const HandoffKeys = {
  // ...existing...
  userList: (userId: string) => `handoff-proposals:user:${userId}`,
  userPending: (userId: string) => `handoff-proposals:pending:${userId}`,
};
```

Update `create()` to ZADD to both new indices. Update `claimForApproval()`, `markRejected()`, `markExpired()`, `finalizeApproval()`, `delete()` to ZREM from pending index.

Redis `listPendingByUser`:
```typescript
async listPendingByUser(userId: string, limit: number = 100): Promise<SessionHandoffProposal[]> {
  const ids = await this.redis.zrevrange(HandoffKeys.userPending(userId), 0, limit - 1);
  if (ids.length === 0) return [];
  const proposals: SessionHandoffProposal[] = [];
  for (const id of ids) {
    const p = await this.get(id);
    if (p && p.status === 'pending') proposals.push(p);
  }
  return proposals;
}
```

**Step 5: Run tests — expect PASS (both in-memory and Redis)**

**Step 6: Commit**

```bash
git add packages/api/src/domains/cats/services/stores/ports/SessionHandoffProposalStore.ts \
  packages/api/src/domains/cats/services/stores/redis/RedisSessionHandoffProposalStore.ts \
  packages/api/src/domains/cats/services/stores/__tests__/session-handoff-proposal-store.test.ts
git commit -m "feat(F246): add listPendingByUser to SessionHandoffProposalStore"
```

---

## Task 3: Feature Adapters — F128 + F225

**Files:**
- Create: `packages/api/src/domains/approval-hub/ports/IApprovalAdapter.ts`
- Create: `packages/api/src/domains/approval-hub/adapters/F128ApprovalAdapter.ts`
- Create: `packages/api/src/domains/approval-hub/adapters/F225ApprovalAdapter.ts`
- Test: `packages/api/src/domains/approval-hub/adapters/__tests__/F128ApprovalAdapter.test.ts`
- Test: `packages/api/src/domains/approval-hub/adapters/__tests__/F225ApprovalAdapter.test.ts`

**Step 1: Write F128 adapter test**

```typescript
describe('F128ApprovalAdapter', () => {
  it('maps pending ThreadProposals to ApprovalItems', async () => {
    const proposalStore = new InMemoryProposalStore();
    proposalStore.create({
      sourceThreadId: 't-1', sourceInvocationId: 'inv-1', sourceCatId: 'opus',
      title: 'New investigation', reason: 'Need separate thread',
      parentThreadId: 't-parent', preferredCats: ['opus'], projectPath: '/p',
      createdBy: 'user-1',
    });

    const adapter = new F128ApprovalAdapter(proposalStore);
    const items = await adapter.listPending('user-1');

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceFeatureId: 'F128',
      ownerUserId: 'user-1',
      status: 'pending',
      inlineApprovable: true,
      summary: expect.stringContaining('New investigation'),
    });
    expect(items[0].detail).toMatchObject({
      title: 'New investigation',
      reason: 'Need separate thread',
      parentThreadId: 't-parent',
      preferredCats: ['opus'],
      projectPath: '/p',
    });
  });

  it('returns empty for user with no pending proposals', async () => {
    const proposalStore = new InMemoryProposalStore();
    const adapter = new F128ApprovalAdapter(proposalStore);
    expect(await adapter.listPending('nobody')).toEqual([]);
  });

  it('computes expiresAt as createdAt + 7 days', async () => {
    const proposalStore = new InMemoryProposalStore();
    const p = proposalStore.create({
      sourceThreadId: 't-1', sourceInvocationId: 'inv-1', sourceCatId: 'opus',
      title: 'Test', reason: 'r', parentThreadId: 'p', preferredCats: [],
      projectPath: '/p', createdBy: 'user-1',
    });

    const adapter = new F128ApprovalAdapter(proposalStore);
    const [item] = await adapter.listPending('user-1');
    expect(item.expiresAt).toBe(p.createdAt + 7 * 24 * 60 * 60 * 1000);
  });
});
```

**Step 2: Write F225 adapter test**

```typescript
describe('F225ApprovalAdapter', () => {
  it('maps pending SessionHandoffProposals to ApprovalItems', async () => {
    const store = new InMemorySessionHandoffProposalStore();
    store.create({
      userId: 'user-1', sourceCatId: 'opus', sourceThreadId: 't-1',
      sourceSessionId: 's-1',
      note: { done: 'Finished task A', nextSteps: 'Continue task B' },
    });

    const adapter = new F225ApprovalAdapter(store);
    const items = await adapter.listPending('user-1');

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceFeatureId: 'F225',
      ownerUserId: 'user-1',
      status: 'pending',
      inlineApprovable: false, // F225 needs context → jump only
      summary: expect.stringContaining('Session handoff'),
    });
  });

  it('computes expiresAt as createdAt + 24 hours', async () => {
    const store = new InMemorySessionHandoffProposalStore();
    const p = store.create({
      userId: 'user-1', sourceCatId: 'opus', sourceThreadId: 't-1',
      sourceSessionId: 's-1',
      note: { done: 'x', nextSteps: 'y' },
    });

    const adapter = new F225ApprovalAdapter(store);
    const [item] = await adapter.listPending('user-1');
    expect(item.expiresAt).toBe(p.createdAt + 24 * 60 * 60 * 1000);
  });
});
```

**Step 3: Implement interface**

```typescript
// packages/api/src/domains/approval-hub/ports/IApprovalAdapter.ts
import type { ApprovalFeatureId, ApprovalItem } from '@cat-cafe/shared';

export interface IApprovalAdapter {
  readonly featureId: ApprovalFeatureId;
  listPending(userId: string): Promise<ApprovalItem[]>;
}
```

**Step 4: Implement F128 adapter**

```typescript
// packages/api/src/domains/approval-hub/adapters/F128ApprovalAdapter.ts
import type { ApprovalItem } from '@cat-cafe/shared';
import type { IProposalStore } from '../../cats/services/stores/ports/ProposalStore.js';
import type { IApprovalAdapter } from '../ports/IApprovalAdapter.js';

const F128_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class F128ApprovalAdapter implements IApprovalAdapter {
  readonly featureId = 'F128' as const;

  constructor(private readonly proposalStore: IProposalStore) {}

  async listPending(userId: string): Promise<ApprovalItem[]> {
    const proposals = await this.proposalStore.listPending(userId);
    return proposals.map((p) => ({
      proposalId: p.proposalId,
      sourceFeatureId: 'F128' as const,
      sourceThreadId: p.sourceThreadId,
      sourceMessageId: p.cardMessageId,
      requesterCatId: p.sourceCatId,
      ownerUserId: p.createdBy,
      status: 'pending' as const, // stale computed client-side
      summary: `New thread: ${p.title}`,
      detail: {
        title: p.title,
        reason: p.reason,
        parentThreadId: p.parentThreadId,
        preferredCats: p.preferredCats,
        initialMessage: p.initialMessage,
        projectPath: p.projectPath,
        reportingMode: p.reportingMode,
      },
      inlineApprovable: true, // F128 supports full inline approve
      expiresAt: p.createdAt + F128_STALE_MS,
      createdAt: p.createdAt,
    }));
  }
}
```

**Step 5: Implement F225 adapter** (same pattern, `inlineApprovable: false`)

```typescript
// packages/api/src/domains/approval-hub/adapters/F225ApprovalAdapter.ts
import type { ApprovalItem } from '@cat-cafe/shared';
import type { ISessionHandoffProposalStore } from '../../cats/services/stores/ports/SessionHandoffProposalStore.js';
import type { IApprovalAdapter } from '../ports/IApprovalAdapter.js';

const F225_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

export class F225ApprovalAdapter implements IApprovalAdapter {
  readonly featureId = 'F225' as const;

  constructor(private readonly store: ISessionHandoffProposalStore) {}

  async listPending(userId: string): Promise<ApprovalItem[]> {
    const proposals = await this.store.listPendingByUser(userId);
    return proposals.map((p) => ({
      proposalId: p.proposalId,
      sourceFeatureId: 'F225' as const,
      sourceThreadId: p.sourceThreadId,
      requesterCatId: p.sourceCatId,
      ownerUserId: p.userId,
      status: 'pending' as const,
      summary: `Session handoff: ${p.sourceCatId} → ${p.note.done.slice(0, 60)}`,
      detail: {
        done: p.note.done,
        nextSteps: p.note.nextSteps,
        worktreeBranch: p.note.worktreeBranch,
        commits: p.note.commits,
        gotchas: p.note.gotchas,
        sourceSessionId: p.sourceSessionId,
      },
      inlineApprovable: false, // F225 needs session context → jump only
      expiresAt: p.createdAt + F225_STALE_MS,
      createdAt: p.createdAt,
    }));
  }
}
```

**Step 6: Run tests — expect PASS**

**Step 7: Commit**

```bash
git add packages/api/src/domains/approval-hub/
git commit -m "feat(F246): F128 + F225 approval adapters (query aggregation)"
```

---

## Task 4: ApprovalHub Aggregation Route

**Files:**
- Create: `packages/api/src/routes/approval-hub-routes.ts`
- Modify: `packages/api/src/index.ts` (register route)
- Test: `packages/api/src/routes/__tests__/approval-hub-routes.test.ts`

**Step 1: Write the test**

```typescript
describe('GET /api/approval-hub/pending', () => {
  it('returns aggregated pending items from F128 + F225 adapters', async () => {
    // Setup: create pending proposals in both stores
    // ...
    const res = await app.inject({ method: 'GET', url: '/api/approval-hub/pending', headers: { 'x-cat-cafe-user': 'user-1' } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items).toHaveLength(2); // one from each adapter
    expect(body.count).toBe(2);
    expect(body.items.every((i: any) => i.ownerUserId === 'user-1')).toBe(true);
  });

  it('returns 401 without user identity', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/approval-hub/pending' });
    expect(res.statusCode).toBe(401);
  });

  it('sorts by createdAt descending across features', async () => {
    // ...
  });
});
```

**Step 2: Implement route**

```typescript
// packages/api/src/routes/approval-hub-routes.ts
import type { FastifyPluginAsync } from 'fastify';
import type { IApprovalAdapter } from '../domains/approval-hub/ports/IApprovalAdapter.js';
import { resolveUserId } from '../utils/request-identity.js';

export interface ApprovalHubRoutesOptions {
  adapters: IApprovalAdapter[];
}

export const approvalHubRoutes: FastifyPluginAsync<ApprovalHubRoutesOptions> = async (app, opts) => {
  const { adapters } = opts;

  app.get('/api/approval-hub/pending', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const results = await Promise.all(adapters.map((a) => a.listPending(userId)));
    const items = results.flat().sort((a, b) => b.createdAt - a.createdAt);

    return { items, count: items.length };
  });
};
```

**Step 3: Register in `index.ts`**

```typescript
import { F128ApprovalAdapter } from './domains/approval-hub/adapters/F128ApprovalAdapter.js';
import { F225ApprovalAdapter } from './domains/approval-hub/adapters/F225ApprovalAdapter.js';
import { approvalHubRoutes } from './routes/approval-hub-routes.js';

// Near existing proposal route registration:
await app.register(approvalHubRoutes, {
  adapters: [
    new F128ApprovalAdapter(proposalStore),
    new F225ApprovalAdapter(handoffProposalStore),
  ],
});
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/routes/approval-hub-routes.ts packages/api/src/routes/__tests__/approval-hub-routes.test.ts packages/api/src/index.ts
git commit -m "feat(F246): approval hub aggregation route GET /api/approval-hub/pending"
```

---

## Task 5: Frontend — Approval Hub Store + Hook

**Files:**
- Create: `packages/web/src/stores/approvalHubStore.ts`
- Create: `packages/web/src/hooks/useApprovalHub.ts`
- Test: `packages/web/src/stores/__tests__/approvalHubStore.test.ts`

**Step 1: Write store test**

```typescript
describe('approvalHubStore', () => {
  it('fetches pending items and updates count', async () => {
    // Mock apiFetch
    const store = useApprovalHubStore.getState();
    await store.fetchPending();
    expect(store.items).toEqual(/* mocked items */);
    expect(store.count).toBe(/* mocked count */);
  });
});
```

**Step 2: Implement Zustand store**

```typescript
// packages/web/src/stores/approvalHubStore.ts
import type { ApprovalItem } from '@cat-cafe/shared';
import { create } from 'zustand';
import { apiFetch } from '@/utils/api-client';

interface ApprovalHubState {
  items: ApprovalItem[];
  count: number;
  isLoading: boolean;
  isOpen: boolean;
  error: string | null;
  fetchPending: () => Promise<void>;
  open: () => void;
  close: () => void;
}

export const useApprovalHubStore = create<ApprovalHubState>((set) => ({
  items: [],
  count: 0,
  isLoading: false,
  isOpen: false,
  error: null,

  fetchPending: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/api/approval-hub/pending');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      set({ items: data.items, count: data.count, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
```

**Step 3: Implement socket subscription hook**

```typescript
// packages/web/src/hooks/useApprovalHub.ts
import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useApprovalHubStore } from '@/stores/approvalHubStore';

/** Fetch pending approvals on mount + refetch on proposal_updated socket events. */
export function useApprovalHubSync() {
  const fetchPending = useApprovalHubStore((s) => s.fetchPending);
  const socket = useSocket();

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => { fetchPending(); };
    socket.on('proposal_updated', handler);
    socket.on('handoff_proposal_updated', handler);
    return () => {
      socket.off('proposal_updated', handler);
      socket.off('handoff_proposal_updated', handler);
    };
  }, [socket, fetchPending]);
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

---

## Task 6: Frontend — Approval Hub Drawer

**Files:**
- Create: `packages/web/src/components/ApprovalHubDrawer.tsx`
- Create: `packages/web/src/components/ApprovalItemCard.tsx`

**Design:**
- Drawer/panel slides in from right when Activity bar bell icon is clicked
- Header: "待审批" + count badge
- List of `ApprovalItemCard` components, sorted newest first
- Each card shows: summary, requester cat, feature badge (F128/F225), stale indicator, age
- F128 cards: expandable inline form (title, parentThreadId, preferredCats, initialMessage, projectPath, reportingMode) + Approve/Reject buttons → call `POST /api/proposals/:id/approve` / `POST /api/proposals/:id/reject`
- F225 cards: summary of handoff note + "跳转到 Thread" button → navigate to `/thread/:sourceThreadId`
- Stale indicator: if `expiresAt < Date.now()`, show orange "已过期" badge (AC-A6)
- Empty state: "没有待审批的项目"

**F128 inline approve — full overrides (AC-A4):**
The F128 inline approve form MUST support all override fields that the existing ProposalCard supports:
- `title` (text input)
- `parentThreadId` (select from user's threads)
- `preferredCats` (multi-select from known cats)
- `initialMessage` (textarea)
- `projectPath` (select from allowed paths)
- `reportingMode` (select: none/final-only/state-transitions/blocking-ack)

If any field cannot be rendered in the Hub drawer context (e.g., parentThreadId requires loading thread list), the card falls back to "跳转审批" instead of approve-only. This satisfies AC-A4's constraint: "如果 Hub inline 无法提供等价编辑体验，则该 proposal 强制跳转".

**Step 1-4: TDD cycle for ApprovalItemCard**

Test: renders F128 card with approve button, renders F225 card with jump button, stale items show stale badge.

**Step 5: Implement ApprovalHubDrawer** — uses `useApprovalHubStore` for data, maps items to cards, handles open/close.

**Step 6: Commit**

---

## Task 7: Frontend — Activity Bar Badge

**Files:**
- Modify: `packages/web/src/components/ActivityBar.tsx`

**Step 1: Add Approval Hub button to ActivityBar**

Between the PinnedSections and SettingsButton, add an ApprovalHubButton:

```typescript
function ApprovalHubButton() {
  const count = useApprovalHubStore((s) => s.count);
  const open = useApprovalHubStore((s) => s.open);

  return (
    <button
      type="button"
      onClick={open}
      className="relative flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-[var(--console-rail-item)]"
      title={count > 0 ? `${count} 项待审批` : '审批中心'}
    >
      <BellIcon className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-micro font-bold flex items-center justify-center"
          style={{ backgroundColor: 'var(--semantic-warning)', color: 'var(--cafe-accent-foreground)' }}>
          {count > 99 ? '99+' : String(count)}
        </span>
      )}
    </button>
  );
}
```

**Step 2: Mount `useApprovalHubSync()` in ActivityBar** to start socket subscription.

**Step 3: Mount `<ApprovalHubDrawer />` in AppShell** (root level, like ConciergeHost, so it survives route changes).

**Step 4: Commit**

```bash
git add packages/web/src/components/ActivityBar.tsx packages/web/src/components/AppShell.tsx \
  packages/web/src/components/ApprovalHubDrawer.tsx packages/web/src/components/ApprovalItemCard.tsx \
  packages/web/src/stores/approvalHubStore.ts packages/web/src/hooks/useApprovalHub.ts
git commit -m "feat(F246): Approval Hub drawer + Activity bar badge + real-time sync"
```

---

## Task 8: Architecture Ownership Cell

**Files:**
- Create: `docs/architecture/ownership/cells/approval-index.md`
- Modify: `docs/architecture/ownership/README.md` (add cell entry)

```markdown
---
cell_id: approval-index
title: Approval Index
summary: CVO approval aggregation layer — per-feature adapters query canonical stores, Hub UI renders unified pending list with badge + inline/jump approve.
canonical_features: [F246]
code_anchors:
  - packages/api/src/domains/approval-hub/
  - packages/api/src/routes/approval-hub-routes.ts
  - packages/shared/src/types/approval-hub.ts
  - packages/web/src/components/ApprovalHubDrawer.tsx
  - packages/web/src/stores/approvalHubStore.ts
doc_anchors:
  - docs/features/F246-approval-hub.md
  - docs/plans/2026-06-20-f246-phase-a-approval-hub.md
static_scan_hints: [approval hub, pending approval, approval adapter, approval item, inline approve]
cited_by:
  - {feature: F246, date: 2026-06-20, delta: new cell}
---
```

**Commit:**
```bash
git add docs/architecture/ownership/cells/approval-index.md docs/architecture/ownership/README.md
git commit -m "docs(F246): add approval-index architecture ownership cell"
```

---

## Open Questions

| OQ | 分类 | 内容 | 处理 |
|----|------|------|------|
| OQ-1 | 技术 | F225 `handoff_proposal_updated` socket event 是否已存在？如不存在需在 F225 approve/reject routes 添加 | 实现时 grep 确认，不存在则补 |
| OQ-2 | 技术 | `parentThreadId` select 在 drawer 内是否可行（需加载 thread list）？不行则 F128 该字段 fallback 到跳转 | 实现时尝试，fallback 路径已在 AC-A4 spec 定义 |
| OQ-3 | 技术 | Redis `listPendingByUser` 需要新 ZSet index；已有 proposals 需要 backfill 到新 index | 实现时判断是否有 existing data；v1 volume 极小，create 时写 index 即可；已有数据量不大可手动 backfill 或忽略（server restart 后新 create 的自然进入） |

所有 OQ 为技术 OQ，实现过程中自行解决，不升级 CVO。

---

## 下一步

计划写完并提交 → 加载 `worktree` → `tdd` → 实现。
