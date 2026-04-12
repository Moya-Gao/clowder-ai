# F160 Phase A: Protocol Closure — Implementation Plan

**Feature:** F160 — `docs/features/F160-task-board-upgrade.md`
**Goal:** 补齐 MCP 协议层，让猫猫能发现和创建 thread 级持久化任务（毛线球），不改 UI。
**Acceptance Criteria:**
- AC-A1: `cat_cafe_create_task` MCP tool 可用，创建的任务 `kind=work`，出现在 TaskPanel
- AC-A2: SystemPromptBuilder 包含毛线球能力描述，猫猫知道如何创建/查看/更新任务
- AC-A3: `cat_cafe_list_tasks` 在 MCP 中可用，支持 `threadId` + `kind` 过滤
- AC-A4: 回归测试：PR tracking 任务仍然不出现在毛线球（PR #958 守护）
**Architecture:** 新增 `POST /api/callbacks/create-task` 后端路由 + MCP tool 注册。复用现有 `ITaskStore.create()` + WebSocket `task_created` 广播。SystemPromptBuilder 的 `MCP_TOOLS_SECTION` 加入毛线球能力描述段。
**Tech Stack:** Fastify, Zod, node:test
**前端验证:** No — Phase A 纯后端/协议层

---

## Terminal Schema

无新类型。复用现有 `CreateTaskInput`（`@cat-cafe/shared`），MCP 入口强制 `kind: 'work'`。

### Task 1: 新增 `create-task` 回调路由（AC-A1）

**Files:**
- Modify: `packages/api/src/routes/callback-task-routes.ts:15-19` (add schema)
- Modify: `packages/api/src/routes/callback-task-routes.ts:28-136` (add route in register function)
- Test: `packages/api/test/integration/task-callback.test.js`

**Step 1: Write failing tests for create-task callback**

在 `task-callback.test.js` 末尾追加 5 个测试：

```javascript
test('MCP create-task succeeds with valid input', async () => {
  const app = await createApp();
  const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-1');

  const response = await app.inject({
    method: 'POST',
    url: '/api/callbacks/create-task',
    payload: {
      invocationId,
      callbackToken,
      title: 'Fix login bug',
      why: 'Users are getting 500 errors on login',
    },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.task.title, 'Fix login bug');
  assert.equal(body.task.kind, 'work');
  assert.equal(body.task.threadId, 'thread-1');
  assert.equal(body.task.createdBy, 'opus');
  assert.equal(body.task.status, 'todo');

  // Verify WebSocket broadcast
  const events = socketManager.getEvents();
  const createEvent = events.find((e) => e.event === 'task_created');
  assert.ok(createEvent, 'task_created event should be broadcast');
  assert.equal(createEvent.room, 'thread:thread-1');
});

test('MCP create-task rejects invalid credentials', async () => {
  const app = await createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/api/callbacks/create-task',
    payload: {
      invocationId: 'bad-id',
      callbackToken: 'bad-token',
      title: 'Some task',
    },
  });

  assert.equal(response.statusCode, 401);
});

test('MCP create-task enforces kind=work (rejects pr_tracking)', async () => {
  const app = await createApp();
  const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-1');

  const response = await app.inject({
    method: 'POST',
    url: '/api/callbacks/create-task',
    payload: {
      invocationId,
      callbackToken,
      title: 'PR #42',
      kind: 'pr_tracking',
    },
  });

  // kind field is not accepted in the schema — should be 400 or silently forced to 'work'
  // Spec says "强制 kind=work", so even if kind is passed it should be ignored
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().task.kind, 'work');
});

test('MCP create-task with ownerCatId', async () => {
  const app = await createApp();
  const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-1');

  const response = await app.inject({
    method: 'POST',
    url: '/api/callbacks/create-task',
    payload: {
      invocationId,
      callbackToken,
      title: 'Review docs',
      why: 'Needs fresh eyes',
      ownerCatId: 'codex',
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().task.ownerCatId, 'codex');
});

test('MCP create-task rejects empty title', async () => {
  const app = await createApp();
  const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'thread-1');

  const response = await app.inject({
    method: 'POST',
    url: '/api/callbacks/create-task',
    payload: {
      invocationId,
      callbackToken,
      title: '',
    },
  });

  assert.equal(response.statusCode, 400);
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/api && node --test test/integration/task-callback.test.js`
Expected: 5 new tests FAIL (route not found / 404)

**Step 3: Add create-task schema in callback-task-routes.ts**

After `listTasksQuerySchema` (line 26), add:

```typescript
const createTaskSchema = callbackAuthSchema.extend({
  title: z.string().min(1).max(200),
  why: z.string().max(1000).optional().default(''),
  ownerCatId: z.string().min(1).optional(),
});
```

**Step 4: Add create-task route in registerCallbackTaskRoutes**

Before the `app.get('/api/callbacks/list-tasks'` route (line 81), add:

```typescript
app.post('/api/callbacks/create-task', async (request, reply) => {
  const parsed = createTaskSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(400);
    return { error: 'Invalid request body', details: parsed.error.issues };
  }

  const { invocationId, callbackToken, title, why, ownerCatId } = parsed.data;
  const record = registry.verify(invocationId, callbackToken);
  if (!record) {
    reply.status(401);
    return EXPIRED_CREDENTIALS_ERROR;
  }

  // Validate ownerCatId if provided
  if (ownerCatId && !catRegistry.has(ownerCatId)) {
    reply.status(400);
    return { error: `Unknown catId: ${ownerCatId}` };
  }

  const task = await taskStore.create({
    threadId: record.threadId,
    title,
    why: why ?? '',
    createdBy: record.catId,
    kind: 'work',            // KD-4: forced to 'work', no pr_tracking via MCP
    subjectKey: null,         // work tasks don't need dedup key
    ownerCatId: (ownerCatId ?? null) as CatId | null,
    userId: record.userId,
  });

  socketManager.broadcastToRoom(`thread:${task.threadId}`, 'task_created', task);
  reply.status(201);
  return { status: 'ok', task };
});
```

**Step 5: Add CatId import**

Add `CatId` to the import from `@cat-cafe/shared`:

```typescript
import { catRegistry } from '@cat-cafe/shared';
// becomes:
import type { CatId } from '@cat-cafe/shared';
import { catRegistry } from '@cat-cafe/shared';
```

**Step 6: Run tests to verify they pass**

Run: `cd packages/api && node --test test/integration/task-callback.test.js`
Expected: All tests PASS (including 4 existing + 5 new)

**Step 7: Commit**

```
feat(F160): add create-task callback route [宪宪/Opus-46🐾]
```

---

### Task 2: 注册 MCP tool `cat_cafe_create_task`（AC-A1）

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:167-171` (add schema)
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:313-323` (add handler)
- Modify: `packages/mcp-server/src/tools/callback-tools.ts:822-831` (register in CALLBACK_TOOLS)

**Step 1: Add input schema**

After `updateTaskInputSchema` (line 171), add:

```typescript
export const createTaskInputSchema = {
  title: z.string().min(1).max(200).describe('Task title — what needs to be done'),
  why: z.string().max(1000).optional().describe('Why this task matters (context for whoever picks it up)'),
  ownerCatId: z.string().min(1).optional().describe('Cat ID to assign the task to (optional, defaults to unassigned)'),
};
```

**Step 2: Add handler**

After `handleUpdateTask` (line 323), add:

```typescript
export async function handleCreateTask(input: {
  title: string;
  why?: string | undefined;
  ownerCatId?: string | undefined;
}): Promise<ToolResult> {
  return callbackPost('/api/callbacks/create-task', {
    title: input.title,
    ...(input.why ? { why: input.why } : {}),
    ...(input.ownerCatId ? { ownerCatId: input.ownerCatId } : {}),
  });
}
```

**Step 3: Register in CALLBACK_TOOLS**

After the `cat_cafe_update_task` entry (line 831), add:

```typescript
{
  name: 'cat_cafe_create_task',
  description:
    'Create a new 🧶 毛线球 (yarn ball) task in the current thread. ' +
    'Use for persistent work items that need tracking across sessions — ' +
    'e.g. "fix login timeout", "update API docs", "review F160 spec". ' +
    'NOT for temporary execution steps (use PlanBoard/TodoWrite for those). ' +
    'TIP: Include a "why" to give context to whoever picks up the task.',
  inputSchema: createTaskInputSchema,
  handler: handleCreateTask,
},
```

**Step 4: Verify build**

Run: `cd packages/mcp-server && pnpm build`
Expected: Build succeeds

**Step 5: Commit**

```
feat(F160): register cat_cafe_create_task MCP tool [宪宪/Opus-46🐾]
```

---

### Task 3: SystemPromptBuilder 毛线球能力描述（AC-A2）

**Files:**
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts:203-230`
- Test: `packages/api/test/system-prompt-builder.test.js`

**Step 1: Write failing test**

Add test asserting the system prompt contains `cat_cafe_create_task` and the `🧶 毛线球` section header.

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/system-prompt-builder.test.js`

**Step 3: Update MCP_TOOLS_SECTION**

In the `协作工具` list (line 222), replace the single `cat_cafe_update_task` line with:

```
- cat_cafe_create_task: 创建🧶毛线球任务（当前 thread 持久化工作项）
- cat_cafe_list_tasks: 列出任务（支持 threadId/catId/status/kind 过滤）
- cat_cafe_update_task: 更新任务状态（todo/doing/blocked/done）
```

And add a new guidance block after the `协作工具` list, before the rich block section:

```

🧶 **毛线球（Thread Tasks）使用指南：**
- 铲屎官提了需要跟踪的事项 → create_task
- 多猫协作分工 → create_task + 指定 ownerCatId
- 长期追踪项 → create_task
- 临时执行步骤 → 不要用毛线球（那是猫猫祟祟 PlanBoard 的职责）
- 进入 thread 时 → list_tasks 看看有没有 blocked 任务需要关注
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/api && node --test test/system-prompt-builder.test.js`

**Step 5: Commit**

```
feat(F160): add 毛线球 capability description to SystemPromptBuilder [宪宪/Opus-46🐾]
```

---

### Task 4: 确认 list_tasks MCP 暴露完备（AC-A3）

**Files:**
- Read-only verification: `packages/mcp-server/src/tools/callback-tools.ts:193-201` (schema)
- Read-only verification: `packages/api/src/routes/callback-task-routes.ts:81-135` (route)

**Step 1: Verify list_tasks schema supports threadId + kind filter**

Already confirmed:
- `threadId: z.string().min(1).optional()` ✓
- `kind: z.enum(['work', 'pr_tracking']).optional()` ✓
- Handler correctly forwards all params ✓
- Backend route applies all filters ✓

**Result:** AC-A3 already satisfied. No code changes needed.

---

### Task 5: 回归守护测试（AC-A4）

**Files:**
- Modify: `packages/api/test/integration/task-callback.test.js`
- Read-only: `packages/web/src/hooks/__tests__/useChatSocketCallbacks-task-filter.test.ts`

**Step 1: Verify existing client-side guard**

`useChatSocketCallbacks-task-filter.test.ts` already has:
- `blocks pr_tracking task_created from entering taskStore` ✓
- `blocks pr_tracking task_updated from entering taskStore` ✓
- `allows work task_created for the active thread` ✓

**Step 2: Add server-side regression test**

In `task-callback.test.js`, the test "MCP create-task enforces kind=work (rejects pr_tracking)" from Task 1 already covers this.

**Result:** AC-A4 covered by Task 1's test + existing client-side tests. No additional work needed.

---

## Summary

| Task | AC | Files Changed | Tests |
|------|----|---------------|-------|
| 1. create-task callback route | AC-A1, AC-A4 | `callback-task-routes.ts` | 5 new integration tests |
| 2. MCP tool registration | AC-A1 | `callback-tools.ts` | Build verification |
| 3. SystemPromptBuilder | AC-A2 | `SystemPromptBuilder.ts` | Existing guardian test |
| 4. list_tasks verification | AC-A3 | None (already complete) | — |
| 5. Regression guard | AC-A4 | None (covered by Task 1) | — |

**Effective tasks: 3** (Tasks 4-5 are verification-only, no code changes).
**Estimated commits: 3** (one per code-changing task).
