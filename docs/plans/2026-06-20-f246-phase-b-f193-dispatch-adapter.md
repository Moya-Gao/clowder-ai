# F246 Phase B: F193 E3 Cross-Thread Dispatch Adapter

**Feature:** F246 — `docs/features/F246-approval-hub.md`
**Goal:** assign_work cross-thread dispatches require CVO approval through the Approval Hub; non-assign effect-classes auto-deliver without Hub involvement
**Acceptance Criteria:**
- AC-B1: F193 E3 `assign_work` 类卡片审批走底座 → Hub 可见
- AC-B2: F193 E3 `fyi`/`coordinate`/`investigate` 类不产生 ApprovalItem（有 fixture 测试证明）
- AC-B3: effect-class 由发送猫在 cross-post 时声明，不由底座推断
- AC-B4: 接收侧不变量 — non-assign effect-class 不授权 coding。Fixture: imperative wording + non-assign = no coding auth
**Architecture cell:** platform-infra (subcell: `approval-index`)
**Map delta:** none — extends existing Phase A Hub infrastructure
**Map delta why:** Adds one adapter + one store within the existing approval-index cell. No new cell needed.
**Architecture:** New `DispatchProposal` store holds assign_work proposals. `cross_post_message` gains `effectClass` param — `assign_work` creates a proposal (pending CVO approval) instead of auto-delivering. `F193ApprovalAdapter` maps proposals to ApprovalItems. Approval endpoint delivers the held message; rejection discards it. Receiving-side invariant injected via `extra.crossPost.effectClass` metadata.
**Tech Stack:** TypeScript, Redis (ZSet index), Fastify routes, Zustand store, React
**前端验证:** Yes — F193 dispatch card renders in Hub drawer with approve/reject buttons

---

## Stateful Object Gate

### Census — Lifecycle Objects

| # | Object | Lifecycle Owner | Store |
|---|--------|----------------|-------|
| 1 | **DispatchProposal** | DispatchProposal store (new) | Redis hash + ZSet user index |

### State × Event Transition Table

**DispatchProposal** — lifecycle owner: `RedisDispatchProposalStore`

| Current State | Event | Next State | Side Effect | Guard |
|---------------|-------|-----------|-------------|-------|
| ∅ | `create(assign_work_crosspost)` | `pending` | Store proposal; emit `proposal_created` socket; return proposalId to sender | effectClass === 'assign_work' |
| `pending` | `approve(userId)` | `approved` | Deliver held message to target thread; store `deliveredMessageId`; emit `proposal_updated` | userId === ownerUserId; CAS on status |
| `pending` | `reject(userId)` | `rejected` | Mark rejected; emit `proposal_updated`; do NOT deliver message | userId === ownerUserId; CAS on status |
| `pending` | [client reads with expiresAt < now] | `pending` (stale=true client-side) | Hub shows stale badge; no auto-reject (KD-5) | — |
| `approved` | any | `approved` (terminal) | no-op | — |
| `rejected` | any | `rejected` (terminal) | no-op | — |

**旁路 API 禁止**：只有 `approve`/`reject` 端点能变更状态。通用 REST PATCH / 通用 task update 不可修改 DispatchProposal。

### Invariant Checklist

| # | Invariant | Testable Via |
|---|-----------|-------------|
| INV-1 | Only ownerUserId (CVO) can approve/reject | Unit: non-owner userId → 403 |
| INV-2 | Only `pending` proposals accept approve/reject | Unit: approve on `approved` → 409 |
| INV-3 | `assign_work` cross-posts MUST create proposal (no bypass) | Integration: cross_post with effectClass=assign_work → proposal exists in store |
| INV-4 | Non-assign cross-posts MUST NOT create proposal | Fixture: cross_post with effectClass=fyi → no proposal in store; message delivered immediately |
| INV-5 | Approved proposal delivers exactly once | Unit: double approve → second is no-op; deliveredMessageId set once |
| INV-6 | Held message content immutable between creation and delivery | Unit: proposal.content === delivered message content |
| INV-7 | Non-assign effectClass → receiver NOT authorized to code | Fixture: imperative content + fyi effectClass → no ApprovalItem + SystemPromptBuilder injects non-coding constraint |
| INV-8 | No effectClass (legacy) → no proposal, no label injection | Integration: legacy cross_post (no effectClass param) → current behavior unchanged |

### Adversarial Scenarios

| Scenario | Expected Behavior | Test |
|----------|-------------------|------|
| Double approve | Second call no-op (CAS guard), return already-approved proposal | Unit |
| Approve + reject race | First CAS wins; loser gets 409 Conflict | Unit |
| Sender retries with same clientMessageId | Idempotent: returns existing proposalId, no duplicate | Unit |
| CVO approves stale proposal | Allowed — stale ≠ rejected (KD-5) | Unit |
| cross_post with unknown effectClass value | 400 validation error (Zod enum) | Unit |
| cross_post with effectClass but no targetCats and no @mention | Existing AC-A4 fail-closed takes precedence (400) | Unit |

---

## Tasks

### Task 1: Shared Types

**Files:**
- Modify: `packages/shared/src/types/approval-hub.ts`
- Create: `packages/shared/src/types/dispatch-proposal.ts`
- Modify: `packages/shared/src/types/index.ts` (barrel export)
- Test: `packages/shared/src/__tests__/dispatch-proposal-types.test.ts`

**Changes:**

1. `approval-hub.ts` — extend `ApprovalFeatureId`:
   ```typescript
   export type ApprovalFeatureId = 'F128' | 'F225' | 'F193';
   ```

2. `dispatch-proposal.ts` — new types:
   ```typescript
   /** F246 Phase B: Cross-thread dispatch effect-class (F193 E3 matrix). */
   export type EffectClass = 'fyi' | 'coordinate' | 'investigate' | 'assign_work';

   export type DispatchProposalStatus = 'pending' | 'approved' | 'rejected';

   /** F246 Phase B: assign_work cross-post held for CVO approval. */
   export interface DispatchProposal {
     proposalId: string;
     sourceThreadId: string;       // sender's thread
     targetThreadId: string;       // target thread for delivery
     senderCatId: string;          // cat that initiated
     ownerUserId: string;          // CVO user ID (Hub filtering)
     effectClass: 'assign_work';   // only assign_work creates proposals
     content: string;              // held message content (immutable)
     targetCats: string[];         // routing targets
     replyTo?: string;
     clientMessageId?: string;     // idempotency key
     status: DispatchProposalStatus;
     deliveredMessageId?: string;  // set after approval + delivery
     cardMessageId?: string;       // message ID of feedback card (jump-to)
     createdAt: number;
     decidedAt?: number;
     decidedBy?: string;
   }
   ```

3. `index.ts` — add barrel export for `dispatch-proposal.ts`

4. Type compilation test verifying shape compiles and featureId union includes 'F193'

### Task 2: DispatchProposal Store

**Files:**
- Create: `packages/api/src/domains/approval-hub/stores/ports/IDispatchProposalStore.ts`
- Create: `packages/api/src/domains/approval-hub/stores/redis/RedisDispatchProposalStore.ts`
- Test: `packages/api/test/approval-hub/redis-dispatch-proposal-store.test.js`

**Store interface:**
```typescript
export interface IDispatchProposalStore {
  create(proposal: Omit<DispatchProposal, 'status' | 'deliveredMessageId' | 'decidedAt' | 'decidedBy'>): Promise<DispatchProposal>;
  get(proposalId: string): Promise<DispatchProposal | null>;
  listPendingByUser(userId: string): Promise<DispatchProposal[]>;
  approve(proposalId: string, userId: string, deliveredMessageId: string): Promise<DispatchProposal | null>;
  reject(proposalId: string, userId: string): Promise<DispatchProposal | null>;
  findByClientMessageId(clientMessageId: string, sourceThreadId: string): Promise<DispatchProposal | null>;
}
```

**Redis key structure:**
- `dispatch-proposal:{proposalId}` → hash (proposal data)
- `dispatch-proposal-user-pending:{userId}` → sorted set (score=createdAt, member=proposalId)
- `dispatch-proposal-clientmsg:{sourceThreadId}:{clientMessageId}` → string (proposalId, for idempotency)

**Test matrix (redis-dispatch-proposal-store.test.js):**
- create → stores proposal with status=pending, adds to user index
- get → retrieves by proposalId
- listPendingByUser → returns only pending for userId; excludes approved/rejected
- approve → CAS pending→approved, sets deliveredMessageId/decidedAt/decidedBy, removes from pending index
- approve on non-pending → returns null (INV-2)
- reject → CAS pending→rejected, removes from pending index
- reject on non-pending → returns null (INV-2)
- findByClientMessageId → idempotency lookup
- double approve → second returns approved proposal without re-delivery (INV-5)
- approve + reject race → first wins

### Task 3: cross_post_message effectClass Extension

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts` (schema + handler)
- Modify: `packages/api/src/routes/callbacks.ts` (intercept assign_work)
- Test: `packages/api/test/approval-hub/dispatch-proposal-crosspost.test.js`

**Schema change** (`crossPostMessageInputSchema`):
```typescript
effectClass: z.enum(['fyi', 'coordinate', 'investigate', 'assign_work'])
  .optional()
  .describe(
    'F246 Phase B: Cross-thread dispatch effect-class. Determines delivery behavior: ' +
    'fyi/coordinate/investigate = auto-deliver (current behavior). ' +
    'assign_work = held for CVO approval in Approval Hub before delivery. ' +
    'Omit for backward-compatible auto-delivery.'
  ),
```

**Handler change** (callbacks.ts cross-post path):
When `effectClass === 'assign_work'` and `isCrossThread`:
1. Create DispatchProposal via store (content, targetCats, sourceThread, targetThread, etc.)
2. Do NOT deliver message to target thread yet
3. Emit `proposal_created` socket event to `ownerUserId`
4. Return success with `{ kind: 'dispatch_proposal_created', proposalId }` instead of normal message response
5. Optionally post a feedback card in sender's source thread ("Assignment pending CVO approval")

When `effectClass` is `fyi`/`coordinate`/`investigate` or omitted:
- Current behavior unchanged — auto-deliver
- Store `effectClass` in `extra.crossPost.effectClass` on the delivered message (if effectClass provided)

**Test matrix:**
- effectClass=assign_work + isCrossThread → proposal created, message NOT delivered
- effectClass=fyi + isCrossThread → message delivered immediately, no proposal
- effectClass=investigate → auto-deliver, no proposal
- effectClass=coordinate → auto-deliver, no proposal
- no effectClass → current behavior (auto-deliver, backward compat)
- effectClass=assign_work + NOT cross-thread (same thread) → 400 (assign_work only valid for cross-thread)
- effectClass=assign_work + missing routing (no targetCats, no @mention) → existing AC-A4 fail-closed first
- duplicate clientMessageId + assign_work → idempotent (return existing proposalId)
- effectClass stored in extra.crossPost for non-assign delivered messages

### Task 4: Dispatch Proposal Approve/Reject Endpoints

**Files:**
- Create: `packages/api/src/routes/dispatch-proposal-routes.ts`
- Modify: `packages/api/src/index.ts` (register routes)
- Test: `packages/api/test/approval-hub/dispatch-proposal-routes.test.js`

**Endpoints:**
```
POST /api/dispatch-proposals/:proposalId/approve
POST /api/dispatch-proposals/:proposalId/reject
```

**Approve flow:**
1. `resolveUserId(request)` → userId (401 if missing)
2. `store.get(proposalId)` → proposal (404 if missing)
3. Verify `userId === proposal.ownerUserId` (403 if mismatch, INV-1)
4. `store.approve(proposalId, userId, deliveredMessageId)` → updated proposal (409 if not pending, INV-2)
5. Deliver held message: reuse the cross_post_message delivery logic from callbacks.ts
   - Post to target thread with original content, targetCats, effectClass in extra
   - Store the deliveredMessageId on the proposal
6. Emit `proposal_updated` socket event
7. Return `{ proposal, deliveredMessageId }`

**Reject flow:**
1-3. Same as approve
4. `store.reject(proposalId, userId)` → updated proposal (409 if not pending)
5. Emit `proposal_updated` socket event
6. Return `{ proposal }`

**Test matrix:**
- approve pending → 200, proposal.status=approved, message delivered to target thread
- reject pending → 200, proposal.status=rejected, message NOT delivered
- approve already approved → 409
- approve already rejected → 409
- approve with wrong userId → 403
- approve non-existent → 404
- no userId → 401

### Task 5: F193ApprovalAdapter

**Files:**
- Create: `packages/api/src/domains/approval-hub/adapters/F193ApprovalAdapter.ts`
- Test: `packages/api/test/approval-hub/f193-approval-adapter.test.js`

**Adapter** (follows F128/F225 pattern):
```typescript
const F193_STALE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export class F193ApprovalAdapter implements IApprovalAdapter {
  readonly featureId = 'F193' as const;
  constructor(private readonly store: IDispatchProposalStore) {}

  listPending(userId: string): Promise<ApprovalItem[]> {
    return this.store.listPendingByUser(userId)
      .then(proposals => proposals.map(p => toItem(p)));
  }
}

function toItem(p: DispatchProposal): ApprovalItem {
  return {
    proposalId: p.proposalId,
    sourceFeatureId: 'F193',
    sourceThreadId: p.sourceThreadId,
    sourceMessageId: p.cardMessageId,
    requesterCatId: p.senderCatId,
    ownerUserId: p.ownerUserId,
    status: 'pending',
    summary: `Work assignment: ${p.content.slice(0, 80)}`,
    detail: {
      targetThreadId: p.targetThreadId,
      targetCats: p.targetCats,
      content: p.content,
      effectClass: p.effectClass,
    },
    inlineApprovable: true,  // assign_work has all needed context for inline approval
    expiresAt: p.createdAt + F193_STALE_MS,
    createdAt: p.createdAt,
  };
}
```

**Test matrix:**
- listPending returns mapped ApprovalItems for pending proposals
- empty store → empty array
- approved/rejected proposals excluded (store.listPendingByUser only returns pending)
- mapping: all fields correctly transferred from DispatchProposal to ApprovalItem
- inlineApprovable = true
- sourceFeatureId = 'F193'

### Task 6: Hub Integration (Registration + Frontend)

**Files:**
- Modify: `packages/api/src/index.ts` (register adapter + routes)
- Modify: `packages/web/src/components/ApprovalItemCard.tsx` (F193 card rendering + inline approve/reject)
- Modify: `packages/web/src/stores/approvalHubStore.ts` (add approve/reject actions)
- Test: `packages/api/test/approval-hub/approval-hub-routes.test.js` (extend existing)

**Backend registration** (index.ts):
```typescript
import { F193ApprovalAdapter } from './domains/approval-hub/adapters/F193ApprovalAdapter.js';
import { RedisDispatchProposalStore } from './domains/approval-hub/stores/redis/RedisDispatchProposalStore.js';
import { dispatchProposalRoutes } from './routes/dispatch-proposal-routes.js';

// Create store
const dispatchProposalStore = new RedisDispatchProposalStore(redis);

// Register adapter
await app.register(approvalHubRoutes, {
  adapters: [
    new F128ApprovalAdapter(proposalStore),
    new F225ApprovalAdapter(handoffProposalStore),
    new F193ApprovalAdapter(dispatchProposalStore),
  ],
});

// Register dispatch proposal routes
await app.register(dispatchProposalRoutes, { store: dispatchProposalStore });
```

**Frontend card** (ApprovalItemCard.tsx):
- Add F193 branch in featureBadge/featureColor (badge: 'Dispatch', color: purple variant)
- Add F193 detail rendering: target thread, target cats, content excerpt
- Add inline approve/reject buttons when `item.inlineApprovable === true && item.sourceFeatureId === 'F193'`
- Approve button calls `POST /api/dispatch-proposals/:proposalId/approve`
- Reject button calls `POST /api/dispatch-proposals/:proposalId/reject`
- After action: re-fetch pending items

**Store** (approvalHubStore.ts):
- Add `approveItem(proposalId: string, featureId: string): Promise<void>`
- Add `rejectItem(proposalId: string, featureId: string): Promise<void>`
- Both call feature-specific endpoints and re-fetch

**Existing test extension:**
- Hub aggregation includes F193 adapter
- F193 items appear alongside F128/F225 items
- Sort order (newest first) preserved across 3 adapters

### Task 7: Receiving-Side Invariant (effectClass Label)

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts` (extend StoredMessage.extra.crossPost)
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` (inject effectClass label)
- Test: `packages/api/test/system-prompt-builder-effect-class.test.js`

**Message extra extension:**
```typescript
crossPost?: {
  sourceThreadId: string;
  sourceInvocationId?: string;
  effectClass?: EffectClass;  // NEW — stored on delivered messages
};
```

**SystemPromptBuilder injection:**
When building invocation context, if the trigger message has `extra.crossPost.effectClass`:

For non-assign classes (`fyi`/`coordinate`/`investigate`):
```
[Cross-Thread Effect: {effectClass}]
This message was delivered as a {effectClass} notification. You may acknowledge, coordinate,
or investigate as appropriate. You are NOT authorized to open a worktree or write code
in response to this message — coding requires an approved assign_work dispatch or
direct CVO instruction.
```

For `assign_work` (only appears after CVO approval):
```
[Cross-Thread Effect: assign_work (CVO approved)]
This message was delivered as an approved work assignment. You are authorized to proceed
with the requested coding work.
```

**Fixture tests (AC-B4):**
- Message with effectClass=fyi, content="请修这个 bug" → SystemPromptBuilder injects "NOT authorized to code"
- Message with effectClass=assign_work → SystemPromptBuilder injects "authorized to proceed"
- Message without effectClass (legacy) → no effectClass label injected
- Message with effectClass=investigate + imperative wording → no coding auth (INV-7)

### Task 8: Fixture Integration Tests (Effect-Class Boundary)

**Files:**
- Create: `packages/api/test/approval-hub/effect-class-boundary.test.js`

**This is the AC-B2 / AC-B4 fixture battery — tests that prove the effect-class matrix works end-to-end:**

1. `fyi` cross-post → auto-deliver, no DispatchProposal in store, no ApprovalItem from F193Adapter
2. `coordinate` cross-post → same as fyi
3. `investigate` cross-post → same as fyi
4. `assign_work` cross-post → DispatchProposal created, ApprovalItem visible in Hub
5. Imperative wording + `fyi` effectClass → no proposal, no coding auth (fixture for AC-B4)
6. `assign_work` approved → message delivered with effectClass=assign_work in extra
7. Legacy cross-post (no effectClass) → auto-deliver, no proposal, no label
8. Mix: Hub shows F128 + F225 + F193 items together, sorted by createdAt

---

## Open Questions

None — all design decisions are determined by Phase A KDs + Phase B ACs. The effectClass enum values are fixed by the F193 E3 Effect-Class Matrix in the spec.

## Verification Commands

```bash
pnpm test                                  # all tests pass
pnpm lint                                  # 0 errors
pnpm check                                 # 0 errors (biome)
pnpm -r --if-present run build             # exit 0
pnpm --filter @cat-cafe/api test:redis     # Redis store tests
pnpm --filter @cat-cafe/shared run build   # shared types compile
```
