---
feature_ids: [F128]
related_features: []
topics: [mcp, autonomy, proposal-flow]
doc_kind: spec
created: 2026-03-14
updated: 2026-05-22
---

# F128: Cat Thread Proposal (formerly "Cat-Initiated Thread Creation")

> **Status**: spec v2 | **Owner**: opus | **Priority**: P1
> **v1 archived**: direct-create semantics rejected by maintainer 2026-05-22 (#85, #82)

## Why

Cats cannot create threads programmatically. When a topic needs its own thread, the cat has to ask the owner to do it in the frontend, breaking autonomous workflow.

Encountered during #79: owner asked to "新开一个 thread" for the worktree location fix, but the cat had no API to do so.

## Product correction (2026-05-22, from #85 maintainer review)

Threads are user-visible persistent workspace structure. Cats must **not** silently create them. The accepted flow is **proposal-first**:

```
cat proposes thread (prefilled card) → user reviews / edits / approves → backend creates thread
```

Direct `cat_cafe_create_thread` semantics are rejected. The replacement is `cat_cafe_propose_thread`.

## What

### Three-layer split

| Slice | Scope | Sequence |
|-------|-------|---------|
| **PR-1** Backend proposal model | `RedisProposalStore`, `cat_cafe_propose_thread` MCP tool, `POST /api/callbacks/propose-thread` (cat auth), `POST /api/proposals/:id/approve` & `/reject` (user auth), audit fields, tests | first, mergeable alone |
| **PR-2** Proposal card UI | Rich `card` block rendered in source thread with prefilled editable fields + Approve/Edit/Reject buttons, frontend wiring to approval endpoints, status transitions (pending → created/rejected) | after PR-1 |
| **PR-3** Hierarchy sidebar (deferred) | `parentThreadId` rendering, tree connectors, collapse — kept from v1 design but pushed to follow-up; reconcile with F190 console restructure | optional follow-up |

PR-1 is the primary deliverable. PR-2 makes it usable. PR-3 is non-blocking.

## Backend design (PR-1)

### Proposal lifecycle

```
   propose (cat)            approve (user)            create (system)
   ──────────►   pending   ──────────────►   approved   ────────►  thread created
                    │
                    │ reject (user)
                    ▼
                rejected
```

### Data model — `Proposal`

```ts
interface ThreadProposal {
  proposalId: string;          // UUID
  status: 'pending' | 'approved' | 'rejected';

  // Source / lineage
  sourceThreadId: string;      // thread the cat was running in
  sourceInvocationId: string;  // for audit / traceability
  sourceCatId: CatId;          // cat that proposed

  // Prefilled fields (editable by user before approve)
  title: string;
  reason: string;              // why cat thinks a new thread is needed
  parentThreadId?: string;     // defaults to sourceThreadId, user can change
  preferredCats?: CatId[];
  initialMessage?: string;     // optional first message body for new thread
  projectPath: string;         // inherited from source thread

  // Audit
  createdBy: string;           // userId from invocation record
  createdAt: number;           // unix ms

  // Approval outcome
  approvedBy?: string;
  approvedAt?: number;
  createdThreadId?: string;    // backfilled when thread is created on approve

  // Rejection outcome
  rejectedBy?: string;
  rejectedAt?: number;
  rejectionReason?: string;
}
```

### Storage — `RedisProposalStore`

Following `RedisPendingRequestStore` / `RedisAuthorizationAuditStore` patterns:

| Key | Type | Purpose |
|-----|------|---------|
| `proposal:{proposalId}` | hash | proposal fields |
| `proposals:user:{userId}` | sorted set (score=createdAt) | user's proposals for dashboard |
| `proposals:pending:{userId}` | sorted set (score=createdAt) | fast filter for pending UI |
| `proposals:thread:{threadId}` | sorted set | proposals proposed in a thread (for card re-render lookup) |

Approve transitions `status: pending → approved` and moves out of `proposals:pending:{userId}`.

### Endpoints

#### Cat side — `POST /api/callbacks/propose-thread` (cat callback auth)

Body (Zod schema):
```ts
{
  invocationId: string;
  callbackToken: string;
  title: string;             // .trim().min(1).max(200)
  reason: string;            // .trim().min(1).max(1000)
  preferredCats?: CatId[];   // max 10
  initialMessage?: string;   // .max(4000)
  parentThreadId?: string;   // auto-inferred from record.threadId if omitted
  clientRequestId?: string;  // idempotency key
}
```

Behavior:
1. `registry.verify` + `registry.isLatest` guard (parity with `create_thread` v1)
2. Idempotency: if `clientRequestId` is seen, return cached `proposalId`
3. Auto-fill `sourceThreadId = record.threadId`, `parentThreadId = parentThreadId ?? sourceThreadId`, `projectPath = sourceThread.projectPath`
4. Ownership check: if `parentThreadId` explicitly provided, verify it belongs to `record.userId` (403 otherwise)
5. Create proposal row (status=pending)
6. Emit a `proposal_created` WebSocket event scoped to the user → frontend renders the card in `sourceThreadId`
7. Return `{ proposalId, status: 'pending' }`

**This route does NOT create a thread.**

#### User side — `POST /api/proposals/:proposalId/approve` (user auth via `resolveUserId`)

Body (optional edits):
```ts
{
  title?: string;
  parentThreadId?: string;
  preferredCats?: CatId[];
  initialMessage?: string;
}
```

Behavior:
1. Resolve `userId` from `X-Cat-Cafe-User` (user auth)
2. Load proposal; verify `proposal.createdBy === userId` (ownership; cross-user rejection)
3. Idempotency: if already `approved`, return cached `{ threadId: proposal.createdThreadId }`
4. If `rejected`, return 409 conflict
5. Apply user edits to in-memory copy (do not mutate proposal record's prefilled fields beyond `approvedBy/approvedAt`)
6. Validate `parentThreadId` ownership if provided/changed
7. Create thread via `threadStore.create(userId, finalTitle, projectPath, finalParentThreadId, finalPreferredCats)`
8. If `initialMessage` present, post it to the new thread as the user
9. Update proposal: `status=approved, approvedBy, approvedAt, createdThreadId`
10. Emit WebSocket events: `thread_created` (for sidebar) + `proposal_updated` (for card status flip)
11. Return `{ threadId, proposalId, status: 'approved' }`

#### User side — `POST /api/proposals/:proposalId/reject` (user auth)

Body: `{ rejectionReason?: string }`
- Same ownership check
- Idempotent: re-reject is no-op
- Cannot reject after approve (409)
- Update proposal `status=rejected, rejectedBy, rejectedAt, rejectionReason`
- Emit `proposal_updated`

### MCP tool — `cat_cafe_propose_thread`

Replaces `cat_cafe_create_thread` (deleted). Tool description (drafted, refine in implementation):

> Propose a new thread to the user. The user will see a card with your proposed title and reason and can approve, edit, or reject. The new thread is **not** created until the user approves. Use sparingly — only when a new dedicated thread is genuinely needed (e.g. owner explicitly asks "open a new thread", or a clearly separable long-running investigation). Returns `proposalId`. Wait for the user's decision before assuming the new thread exists.

### Reused infrastructure

| Reused | From | Why |
|--------|------|-----|
| `InvocationRegistry.verify` + `isLatest` | callback-auth | Standard cat-callback auth |
| `resolveUserId(request)` | request-identity | Standard user auth for approve/reject |
| Rich `card` block + `interactive.confirm` actions | chat-types.ts | Proposal card renders as existing block kind — no new frontend primitive |
| `emitToUser` socket pattern | callbacks.ts | Same as v1's `thread_created` broadcast, just different event names |
| `clientRequestId` idempotency cache | post-message route | Battle-tested dedup pattern |

### Code to delete from v1 worktree

| File | Action |
|------|--------|
| `callback-create-thread-routes.ts` | rename + rewrite to `callback-propose-thread-routes.ts` |
| `callback-tools.ts: cat_cafe_create_thread` | rename to `cat_cafe_propose_thread`, return shape changes |
| `callback-create-thread.test.js` | rewrite for propose semantics |
| Frontend hierarchy files (ThreadHierarchyToggle / thread-hierarchy / ThreadItem hierarchy bits / ThreadSidebar hierarchy bits) | drop from PR-1; defer to PR-3 (or discard if F190 supersedes) |
| `designs/F128-thread-hierarchy-sidebar.pen` | keep on disk but mark as PR-3 reference; PR-2 needs a new `F128-proposal-card.pen` |
| `thread-orchestration` skill | rewrite to propose-first flow; consider whether it still makes sense post-correction |

### Code to keep / extend

- `ThreadStore.parentThreadId` field + Redis secondary index for children + `getChildThreads()` — useful for hierarchy follow-up, no harm keeping
- `SystemPromptBuilder` MCP_TOOLS_SECTION entry — update wording for propose semantics
- `serializeThread` / `hydrateThread` parentThreadId persistence — keep

## Acceptance Criteria

### PR-1 (Backend)

- [ ] AC-1.1: `RedisProposalStore` implements create/get/listByUser/listPending/markApproved/markRejected with proper Redis indices
- [ ] AC-1.2: `POST /api/callbacks/propose-thread` creates proposal, does NOT create thread, returns `proposalId`, supports `clientRequestId` idempotency, enforces stale guard, validates parent ownership
- [ ] AC-1.3: `cat_cafe_propose_thread` MCP tool registered with strong description; old `cat_cafe_create_thread` removed
- [ ] AC-1.4: `POST /api/proposals/:id/approve` (user auth) creates thread, is idempotent on re-approve, rejects cross-user attempts (403), conflicts on already-rejected (409), applies user edits, posts initial message if provided, writes audit fields, emits both `thread_created` + `proposal_updated`
- [ ] AC-1.5: `POST /api/proposals/:id/reject` (user auth) is idempotent, conflicts on already-approved, writes audit, emits `proposal_updated`
- [ ] AC-1.6: `Proposal` schema in shared types matches the spec model above
- [ ] AC-1.7: Tests cover: cat auth happy path, stale guard, ownership rejection, idempotency, user approve happy path, double-approve idempotency, cross-user approve 403, approve-after-reject 409, reject happy path, reject-then-approve 409, edit-on-approve applied to created thread
- [ ] AC-1.8: All file sizes ≤ 350 lines (split routes if needed)
- [ ] AC-1.9: No `any` types

### PR-2 (Card UI) — separate spec when PR-1 lands

### PR-3 (Hierarchy sidebar) — deferred, separate spec; reconcile with F190 console first

## Risks

| Risk | Mitigation |
|------|-----------|
| Proposal spam if cat ignores tool description | Rate limit per (userId, sourceThreadId) at store level; status visible to user in dashboard |
| Approve race (two browser tabs) | Idempotency via `proposal.status` check + Redis WATCH/MULTI or single-route serialization |
| Initial message posting fails after thread created | Thread creation already committed; post failure surfaces in API response; user can retry |
| Frontend renders stale proposal status (cached card) | `proposal_updated` socket event triggers re-fetch; status read from store on click, not from cached block |
| F190 console restructure conflicts with eventual PR-3 hierarchy UI | PR-3 is explicitly deferred and will design against post-F190 sidebar |

## Out of scope

- Hierarchy sidebar UI (deferred to PR-3 or absorbed by F190 follow-up)
- Cat-side polling for proposal status (cat returns control to user after proposing; doesn't wait synchronously)
- Bulk approve/reject UI

## Timeline

| Date | Event |
|------|-------|
| 2026-03-14 | v1 kickoff (direct-create semantics) |
| 2026-03-14 ~ 03-31 | v1 implementation + maintainer reviews, blocked |
| 2026-05-22 | Maintainer correction: switch to proposal-first; spec rewritten as v2 |
| TBD | PR-1 (backend) |
| TBD | PR-2 (card UI) |

## References

- GitHub issue: #82
- v1 PR (to close after v2 lands): #85
- Maintainer correction comments: zts212653/clowder-ai#82#issuecomment-4516585087, zts212653/clowder-ai#85#issuecomment-4516589522
- Reuse references: `RedisPendingRequestStore`, `request_permission` flow, `InteractiveBlock` / `CardBlock` rich block primitives
