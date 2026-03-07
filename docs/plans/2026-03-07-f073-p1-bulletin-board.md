---
feature_ids: [F073]
topics: [sop, mission-hub, bulletin-board]
doc_kind: plan
created: 2026-03-07
---

# F073 P1: Mission Hub 告示牌 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 让所有猫通过 MCP 工具读写 Feature 的 SOP 阶段，冷启动/压缩后可通过 resume capsule 快速恢复上下文。

**Architecture:** 在 Mission Hub 的 BacklogItem 旁边新增独立的 `WorkflowSop` Redis 存储（不嵌入 BacklogItem），通过新增 MCP 工具 `cat_cafe_update_workflow` 和扩展 `cat_cafe_get_thread_context` 实现跨猫读写。告示牌哲学：存信息，不控制流程。

**Tech Stack:** TypeScript, Redis (Hash), Fastify routes, MCP tools, Zod validation

**Finish Line:** 猫可以通过 MCP 更新 Feature SOP 阶段、持棒人、resume capsule，冷启动时 `get_thread_context` 自动返回关联 Feature 的恢复摘要。

**NOT building:** 状态机强制流转、handoff ack/timeout（P2）、硬门禁（P3）、sop.manifest.yaml（P4）。

---

## Terminal Schema

```typescript
// packages/shared/src/types/workflow-sop.ts

export type SopStage = 'kickoff' | 'impl' | 'quality_gate' | 'review' | 'merge' | 'completion';
export type CheckStatus = 'attested' | 'verified' | 'unknown';

export interface ResumeCapsule {
  readonly goal: string;
  readonly done: readonly string[];
  readonly currentFocus: string;
}

export interface SopChecks {
  readonly remoteMainSynced: CheckStatus;
  readonly qualityGatePassed: CheckStatus;
  readonly reviewApproved: CheckStatus;
  readonly visionGuardDone: CheckStatus;
}

export interface WorkflowSop {
  readonly featureId: string;        // e.g. "F073"
  readonly backlogItemId: string;    // links to BacklogItem
  readonly stage: SopStage;
  readonly batonHolder: string;      // unique handle: "opus", "codex", etc.
  readonly nextSkill: string | null; // suggested skill to load
  readonly resumeCapsule: ResumeCapsule;
  readonly checks: SopChecks;
  readonly version: number;          // CAS: compare-and-swap
  readonly updatedAt: number;
  readonly updatedBy: string;        // unique handle of last updater
}

export interface UpdateWorkflowSopInput {
  readonly stage?: SopStage;
  readonly batonHolder?: string;
  readonly nextSkill?: string | null;
  readonly resumeCapsule?: Partial<ResumeCapsule>;
  readonly checks?: Partial<SopChecks>;
  readonly expectedVersion?: number;  // CAS: reject if mismatch
}
```

---

## Task 1: Type definitions

**Files:**
- Create: `packages/shared/src/types/workflow-sop.ts`
- Modify: `packages/shared/src/types/index.ts` (add re-export)

**Step 1:** Create `workflow-sop.ts` with the types from Terminal Schema above.

**Step 2:** Add `export * from './workflow-sop.js';` to `packages/shared/src/types/index.ts`.

**Step 3:** Rebuild shared: `pnpm --filter @cat-cafe/shared build`

**Step 4:** Commit: `feat(F073-P1): add WorkflowSop types [布偶猫🐾]`

---

## Task 2: Redis store — WorkflowSopStore

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/redis-keys/workflow-sop-keys.ts`
- Create: `packages/api/src/domains/cats/services/stores/ports/WorkflowSopStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/redis/RedisWorkflowSopStore.ts`
- Create: `packages/api/test/workflow-sop-store.test.js`

**Redis key pattern:**
```
workflow:sop:{backlogItemId}   → Hash (all fields of WorkflowSop)
```

**Port interface:**
```typescript
export interface IWorkflowSopStore {
  get(backlogItemId: string): Promise<WorkflowSop | null>;
  upsert(backlogItemId: string, featureId: string, input: UpdateWorkflowSopInput, updatedBy: string): Promise<WorkflowSop>;
  delete(backlogItemId: string): Promise<boolean>;
}
```

**Key behaviors:**
- `upsert`: If not exists → create with defaults (stage=kickoff, version=1). If exists → merge partial update, increment version.
- CAS: If `expectedVersion` is provided and doesn't match → throw `VersionConflictError` (return current state for retry).
- Store as JSON string in single hash field (simple, avoids nested hash complexity).

**Step 1:** Write failing tests — create, get, upsert, CAS conflict, delete.
**Step 2:** Implement keys file.
**Step 3:** Implement port interface.
**Step 4:** Implement Redis store.
**Step 5:** Run tests to green.
**Step 6:** Commit: `feat(F073-P1): WorkflowSopStore — Redis persistence [布偶猫🐾]`

---

## Task 3: API routes — GET/PUT workflow SOP

**Files:**
- Create: `packages/api/src/routes/workflow-sop-routes.ts`
- Modify: `packages/api/src/routes/backlog.ts` (register sub-routes or import)
- Create: `packages/api/test/workflow-sop-routes.test.js`

**Endpoints:**

```
GET  /api/backlog/:itemId/workflow-sop
  → Returns WorkflowSop | 404

PUT  /api/backlog/:itemId/workflow-sop
  Body: UpdateWorkflowSopInput + { featureId: string, updatedBy: string }
  → Returns WorkflowSop | 409 (version conflict) | 404 (item not found)
```

**Key behaviors:**
- GET: Simple lookup, returns null → 404.
- PUT: Validates backlog item exists, then upserts workflow SOP. On version conflict → 409 with current state.
- No auth beyond existing backlog route auth (user-scoped).

**Step 1:** Write failing tests — get (not found), put (create), put (update), put (version conflict).
**Step 2:** Implement routes.
**Step 3:** Register in backlog route plugin.
**Step 4:** Run tests to green.
**Step 5:** Commit: `feat(F073-P1): workflow SOP API routes [布偶猫🐾]`

---

## Task 4: MCP tool — `cat_cafe_update_workflow`

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts` (add schema + handler)
- Modify: `packages/api/src/routes/callbacks.ts` (add callback route)
- Create: `packages/api/test/workflow-sop-callback.test.js`

**MCP Tool Definition:**
```typescript
{
  name: 'cat_cafe_update_workflow',
  description: 'Update the SOP workflow stage for a Feature (告示牌). ' +
    'Use to record current stage, baton holder, resume capsule, and checks. ' +
    'This is information sharing, not flow control — cats decide their own actions.',
  inputSchema: {
    backlogItemId: z.string().min(1),
    featureId: z.string().min(1),
    stage: z.enum(['kickoff','impl','quality_gate','review','merge','completion']).optional(),
    batonHolder: z.string().min(1).optional(),
    nextSkill: z.string().nullable().optional(),
    resumeCapsule: z.object({
      goal: z.string().optional(),
      done: z.array(z.string()).optional(),
      currentFocus: z.string().optional(),
    }).optional(),
    checks: z.object({
      remoteMainSynced: z.enum(['attested','verified','unknown']).optional(),
      qualityGatePassed: z.enum(['attested','verified','unknown']).optional(),
      reviewApproved: z.enum(['attested','verified','unknown']).optional(),
      visionGuardDone: z.enum(['attested','verified','unknown']).optional(),
    }).optional(),
    expectedVersion: z.number().int().optional(),
  },
}
```

**Callback route:** `PUT /api/callbacks/update-workflow-sop`
- Validates invocation token
- Extracts `updatedBy` from the cat's identity (invocation context)
- Calls `workflowSopStore.upsert()`

**Step 1:** Write failing tests.
**Step 2:** Implement callback route.
**Step 3:** Implement MCP handler + register tool.
**Step 4:** Run tests to green.
**Step 5:** Commit: `feat(F073-P1): cat_cafe_update_workflow MCP tool [布偶猫🐾]`

---

## Task 5: Extend `get_thread_context` with resume capsule

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts` (thread-context handler)
- Modify: `packages/api/test/thread-store.test.js` (or new test file)

**Behavior change:**
When `get_thread_context` is called, if the thread has a `backlogItemId`:
1. Look up the backlog item → get `backlogItemId`
2. Look up `WorkflowSop` for that item
3. If found, prepend a `[RESUME]` block to the response

**Response extension:**
```typescript
{
  threadId: string,
  messages: [...],
  // NEW: workflow SOP context (if available)
  workflowSop?: {
    featureId: string,
    stage: SopStage,
    batonHolder: string,
    nextSkill: string | null,
    resumeCapsule: ResumeCapsule,
    checks: SopChecks,
  }
}
```

**Key design:** The resume capsule is returned as structured data, not injected into messages. The cat's system prompt (or cold-start behavior) decides how to use it.

**Step 1:** Write failing test — thread with backlogItemId returns workflowSop.
**Step 2:** Write test — thread without backlogItemId returns no workflowSop.
**Step 3:** Implement: in thread-context handler, after fetching messages, look up workflow SOP.
**Step 4:** Run tests to green.
**Step 5:** Commit: `feat(F073-P1): get_thread_context returns resume capsule [布偶猫🐾]`

---

## Task 6: Integration test + docs

**Files:**
- Modify: `docs/features/F073-sop-auto-guardian.md` (mark P1 ACs)

**Step 1:** Run full test suite: `pnpm test` — verify no regressions.
**Step 2:** Run `pnpm check` (Biome) + `pnpm lint` (TypeScript).
**Step 3:** Update F073 spec: mark AC-5, AC-6, AC-7 status.
**Step 4:** Commit: `docs(F073-P1): mark P1 acceptance criteria [布偶猫🐾]`

---

## Verification Checklist

- [ ] `WorkflowSop` type exported from shared package
- [ ] Redis store with CAS (version conflict detection)
- [ ] API routes (GET/PUT) with proper error handling
- [ ] MCP tool `cat_cafe_update_workflow` registered and working
- [ ] `get_thread_context` returns `workflowSop` when thread has linked backlog item
- [ ] All tests pass, no regressions
- [ ] Biome + TypeScript clean
- [ ] 告示牌哲学：tool description says "information sharing, not flow control"
