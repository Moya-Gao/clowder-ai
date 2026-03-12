# F087 Phase B: Bootcamp Runtime Implementation Plan

**Feature:** F087 — `docs/features/F087-cvo-bootcamp.md`
**Goal:** 让 bootcamp-guide skill 真正跑起来——猫猫能更新训练营状态、调用环境检测、发送交互式选择卡片，用户从 Phase 0 走到 Phase 11。
**Acceptance Criteria:**
- AC-A2: 猫猫天团轮流自我介绍（multi_mention 已有，skill 已写行为）
- AC-A5: 用户走完 feat lifecycle（Phase 5-10 编排）
- AC-A6: ≥3 次 CVO 决策（skill 已有 🎯 标记点）
- AC-A11: TTS 推荐 Kokoro-82M（skill 已写逻辑）
- AC-A12: 训练营完成后线程保持可用（Phase 11 pinned）
**Architecture:** 两个新 MCP callback 工具 + 对应 API callback 路由 + skill 更新。猫猫通过 MCP 工具更新 bootcampState，前端 Interactive Rich Block 负责用户选择。
**Tech Stack:** Fastify callback routes, MCP server tools (Zod), ThreadStore
**前端验证:** No — Phase B 不改前端，所有交互复用 Phase A + F096 已有组件

---

## Why Phase B

Phase A 建了数据层（bootcampState schema/API/Redis）和前端入口。但猫猫**没有 MCP 工具**来更新训练营状态或调用环境检测——bootcamp-guide skill 说的 "PATCH bootcampState" 猫猫执行不了。Phase B 补上这个缺口。

## 核心问题

猫猫（Claude agent）通过 MCP 工具与后端交互。当前没有：
1. `cat_cafe_update_bootcamp_state` — 无法推进 phase
2. `cat_cafe_bootcamp_env_check` — 无法调用环境检测

Phase B = 这两个工具 + 对应的 callback 路由 + skill 更新。

## 不做什么

- **不改前端** — Interactive Rich Block 渲染已由 F096 完成
- **不做 F075 成就接入** — 等 Phase C
- **不做 Phase 5-10 自动编排** — 猫猫读 skill 自行判断，不需要服务端 orchestration
- **不做 phase transition validation** — 猫猫是自主 agent，不需要服务端强制顺序（过度工程）

---

## Task 1: Bootcamp State Callback Route

**Files:**
- Create: `packages/api/src/routes/callback-bootcamp-routes.ts`
- Modify: `packages/api/src/routes/callbacks.ts` (register)

### Step 1: Write the failing test

```typescript
// test/callback-bootcamp-state.test.js
// Test: POST /api/callbacks/update-bootcamp-state
// - 401 without valid invocation token
// - 200 updates phase + leadCat
// - 200 preserves existing fields when partially updating
// - 400 on invalid phase
```

**File:** `packages/api/test/callback-bootcamp-state.test.js`

### Step 2: Run test to verify it fails

Run: `cd packages/api && node --test test/callback-bootcamp-state.test.js`
Expected: FAIL — module not found

### Step 3: Write callback route

**File:** `packages/api/src/routes/callback-bootcamp-routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { catIdSchema } from '@cat-cafe/shared';
import type { InvocationRegistry } from '../domains/cats/services/agents/invocation/InvocationRegistry.js';
import type { IThreadStore, BootcampStateV1 } from '../domains/cats/services/stores/ports/ThreadStore.js';
import { callbackAuthSchema } from './callback-auth-schema.js';
import { EXPIRED_CREDENTIALS_ERROR } from './callback-errors.js';

const bootcampPhaseSchema = z.enum([
  'phase-0-select-cat', 'phase-1-intro', 'phase-2-env-check',
  'phase-3-config-help', 'phase-3.5-advanced', 'phase-4-task-select',
  'phase-5-kickoff', 'phase-6-design', 'phase-7-dev',
  'phase-8-review', 'phase-9-complete', 'phase-10-retro', 'phase-11-farewell',
]);

const updateBootcampStateCallbackSchema = callbackAuthSchema.extend({
  threadId: z.string().min(1),
  phase: bootcampPhaseSchema.optional(),
  leadCat: catIdSchema().optional(),
  selectedTaskId: z.string().max(50).optional(),
  envCheck: z.record(z.object({
    ok: z.boolean(),
    version: z.string().optional(),
    note: z.string().optional(),
  })).optional(),
  advancedFeatures: z.record(z.enum(['available', 'unavailable', 'skipped'])).optional(),
  completedAt: z.number().optional(),
});

export function registerCallbackBootcampRoutes(
  app: FastifyInstance,
  deps: { registry: InvocationRegistry; threadStore: IThreadStore },
): void {
  const { registry, threadStore } = deps;

  app.post('/api/callbacks/update-bootcamp-state', async (request, reply) => {
    const parsed = updateBootcampStateCallbackSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }

    const { invocationId, callbackToken, threadId, ...updates } = parsed.data;
    const record = registry.verify(invocationId, callbackToken);
    if (!record) {
      reply.status(401);
      return EXPIRED_CREDENTIALS_ERROR;
    }

    const thread = await threadStore.get(threadId);
    if (!thread) {
      reply.status(404);
      return { error: 'Thread not found' };
    }

    // Merge updates into existing bootcampState
    const existing = thread.bootcampState ?? { v: 1, phase: 'phase-0-select-cat', startedAt: Date.now() };
    const merged: BootcampStateV1 = {
      ...existing,
      ...(updates.phase !== undefined ? { phase: updates.phase } : {}),
      ...(updates.leadCat !== undefined ? { leadCat: updates.leadCat } : {}),
      ...(updates.selectedTaskId !== undefined ? { selectedTaskId: updates.selectedTaskId } : {}),
      ...(updates.envCheck !== undefined ? { envCheck: updates.envCheck } : {}),
      ...(updates.advancedFeatures !== undefined ? { advancedFeatures: updates.advancedFeatures } : {}),
      ...(updates.completedAt !== undefined ? { completedAt: updates.completedAt } : {}),
    };

    await threadStore.updateBootcampState(threadId, merged);
    const updated = await threadStore.get(threadId);
    return { bootcampState: updated?.bootcampState };
  });
}
```

### Step 4: Register in callbacks.ts

Add import + call `registerCallbackBootcampRoutes(app, { registry, threadStore })` alongside workflow-sop registration.

### Step 5: Run tests to verify they pass

Run: `cd packages/api && node --test test/callback-bootcamp-state.test.js`
Expected: PASS (4 tests)

### Step 6: Commit

```
feat(F087): bootcamp state callback route + tests
```

---

## Task 2: Bootcamp Env Check Callback Route

**Files:**
- Modify: `packages/api/src/routes/callback-bootcamp-routes.ts` (add endpoint)

### Step 1: Write the failing test

```typescript
// test/callback-bootcamp-env-check.test.js
// - 401 without valid invocation token
// - 200 returns env check results
// - Auto-stores results in thread bootcampState.envCheck
```

### Step 2: Write callback endpoint

Add `POST /api/callbacks/bootcamp-env-check` to `callback-bootcamp-routes.ts`:
- Validates auth
- Runs the same env check logic from `bootcamp.ts` (extract to shared helper)
- Auto-stores results in `thread.bootcampState.envCheck`
- Returns results

### Step 3: Extract env check logic to shared helper

Move the check logic from `packages/api/src/routes/bootcamp.ts` into a reusable function:
```typescript
// packages/api/src/domains/cats/services/bootcamp/env-check.ts
export async function runEnvironmentCheck(): Promise<EnvCheckResult> { ... }
```

Both `GET /api/bootcamp/env-check` and `POST /api/callbacks/bootcamp-env-check` call this.

### Step 4: Run tests

Run: `cd packages/api && node --test test/callback-bootcamp-env-check.test.js`
Expected: PASS

### Step 5: Commit

```
feat(F087): bootcamp env-check callback + shared helper
```

---

## Task 3: MCP Tool Definitions

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts` (add 2 tools)

### Step 1: Add `cat_cafe_update_bootcamp_state` tool

```typescript
export const updateBootcampStateInputSchema = {
  threadId: z.string().min(1).describe('Thread ID of the bootcamp thread'),
  phase: bootcampPhaseSchema.optional().describe('New bootcamp phase'),
  leadCat: z.string().optional().describe('Selected lead cat ID (e.g. "opus")'),
  selectedTaskId: z.string().max(50).optional().describe('Selected task ID (e.g. "Q1")'),
  envCheck: z.record(z.object({
    ok: z.boolean(),
    version: z.string().optional(),
    note: z.string().optional(),
  })).optional().describe('Environment check results'),
  advancedFeatures: z.record(z.enum(['available', 'unavailable', 'skipped']))
    .optional().describe('Advanced feature status (TTS/ASR/Pencil)'),
  completedAt: z.number().optional().describe('Timestamp when bootcamp was completed'),
};

export async function handleUpdateBootcampState(input: { ... }): Promise<ToolResult> {
  return callbackPost('/api/callbacks/update-bootcamp-state', { threadId: input.threadId, ... });
}
```

Register in `callbackTools` array.

### Step 2: Add `cat_cafe_bootcamp_env_check` tool

```typescript
export const bootcampEnvCheckInputSchema = {
  threadId: z.string().min(1).describe('Thread ID — results auto-stored in bootcampState.envCheck'),
};

export async function handleBootcampEnvCheck(input: { threadId: string }): Promise<ToolResult> {
  return callbackPost('/api/callbacks/bootcamp-env-check', { threadId: input.threadId });
}
```

Register in `callbackTools` array.

### Step 3: Commit

```
feat(F087): MCP tools for bootcamp state + env check
```

---

## Task 4: Update Bootcamp Guide Skill

**Files:**
- Modify: `cat-cafe-skills/bootcamp-guide/SKILL.md`

### Step 1: Update tool references

Replace generic "PATCH /api/threads/:id" with specific MCP tool calls:

```markdown
### Phase 0: 选引导猫
1. 用 `cat_cafe_create_rich_block` 发送引导猫选择卡片（bootcamp-blocks 中的 catSelectionBlock）
2. 用户选完后，用 `cat_cafe_update_bootcamp_state(threadId, phase='phase-1-intro', leadCat='...')`

### Phase 2: 环境检测
1. 用 `cat_cafe_bootcamp_env_check(threadId)` 运行环境检测
2. 用检测结果发 Rich Block checklist
```

### Step 2: Commit

```
docs(F087): update bootcamp-guide skill with MCP tool references
```

---

## Task 5: Integration Test — Full Bootcamp Flow

**Files:**
- Create: `packages/api/test/bootcamp-flow.test.js`

### Step 1: Write integration test

Test the happy path: create thread → update state through phases → verify state transitions.

```javascript
// 1. Create thread with bootcampState phase-0
// 2. POST /api/callbacks/update-bootcamp-state → phase-1-intro + leadCat
// 3. POST /api/callbacks/bootcamp-env-check → verify envCheck stored
// 4. POST /api/callbacks/update-bootcamp-state → phase-4-task-select + selectedTaskId
// 5. POST /api/callbacks/update-bootcamp-state → phase-11-farewell + completedAt
// 6. Verify final bootcampState has all fields
```

### Step 2: Run test

Run: `cd packages/api && node --test test/bootcamp-flow.test.js`
Expected: PASS

### Step 3: Commit

```
test(F087): bootcamp flow integration test
```

---

## Summary

| Task | Files | What |
|------|-------|------|
| 1 | callback-bootcamp-routes.ts, callbacks.ts | State transition callback API |
| 2 | callback-bootcamp-routes.ts, env-check.ts | Env check callback + shared helper |
| 3 | callback-tools.ts | 2 MCP tools |
| 4 | SKILL.md | Tool reference updates |
| 5 | bootcamp-flow.test.js | Integration test |

**Total new files:** 3 (callback route, env-check helper, integration test)
**Modified files:** 3 (callbacks.ts, callback-tools.ts, SKILL.md)
