# F139 Phase 3A: Conversational Task Registration + Panel Final State

**Feature:** F139 — `docs/features/F139-unified-schedule-abstraction.md`
**Goal:** 用户在 thread 对话中告诉猫"每天九点发 anthropic 新闻"，猫帮注册成持久化定时任务；调度面板只管展示/管理，不再有假 NL 输入框；错误可追溯
**Acceptance Criteria:**
- AC-F1: 删除 NL 输入框，替换为"对话入口 CTA"
- AC-F2: Footer 改为当前健康摘要
- AC-F3: RunLedger 增加 `error_summary` 字段
- AC-F4: Task row 显示最近一次运行状态 + 可查运行历史
- AC-G1: 猫识别调度注册意图，命中受支持模板
- AC-G2: 生成 ScheduleRegistrationDraft，展示给用户确认
- AC-G3: 确认后持久化 + runtime load
- AC-G4: 动态任务与代码注册任务统一管理
- AC-G5: MVP 模板集 ≥3 个
**Architecture:** Template Registry（代码定义模板逻辑）+ DynamicTaskStore（SQLite 存用户实例配置）+ TaskRunnerV2 hydration。猫通过 MCP tool 注册任务，前端纯展示。
**Tech Stack:** SQLite, Fastify routes, React (SchedulePanel), MCP server tools
**前端验证:** Yes — SchedulePanel CTA + footer + task detail

---

## NOT Building

- 任意自然语言→任意 TaskSpec（LLM 是解析器，模板是约束）
- Pack marketplace / 第三方模板安装（Phase 3B）
- 电闸/备忘录权限分离（Phase 3B）
- NL 输入框修补（方向错误，直接删）

## Terminal Schema

```typescript
// --- New types (types.ts) ---

/** Template definition — code-defined, provides gate/execute factories */
interface TaskTemplate {
  templateId: string;
  label: string;
  category: DisplayCategory;
  description: string;
  subjectKind: SubjectKind;
  defaultTrigger: TriggerSpec;
  defaultActorRole: ActorRole;
  defaultCostTier: CostTier;
  paramSchema: Record<string, { type: 'string' | 'number'; required: boolean; description: string }>;
  createSpec: (instanceId: string, params: DynamicTaskParams) => TaskSpec_P1;
}

/** Dynamic task instance — user config, persisted in SQLite */
interface DynamicTaskDef {
  id: string;               // UUID
  templateId: string;
  trigger: TriggerSpec;      // JSON
  params: Record<string, unknown>;  // template-specific
  display: TaskDisplayMeta;
  deliveryThreadId: string | null;
  enabled: boolean;
  createdBy: string;         // cat ID
  createdAt: string;         // ISO8601
}

/** RunLedgerRow gets new field */
interface RunLedgerRow {
  // ... existing fields ...
  error_summary: string | null;  // NEW: human-readable failure reason
}

/** ScheduleTaskSummary gets new fields */
interface ScheduleTaskSummary {
  // ... existing fields ...
  source: 'builtin' | 'dynamic';  // NEW: distinguish code vs user-registered
  dynamicTaskId?: string;          // NEW: for CRUD operations
}
```

```sql
-- New table: dynamic_task_defs (SCHEMA_V8)
CREATE TABLE IF NOT EXISTS dynamic_task_defs (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  trigger_json TEXT NOT NULL,
  params_json TEXT NOT NULL,
  display_json TEXT NOT NULL,
  delivery_thread_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- New column on existing table
ALTER TABLE task_run_ledger ADD COLUMN error_summary TEXT;
```

---

## Task 1: Schema Migration V8

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts`
- Test: `packages/api/test/scheduler/dynamic-task-store.test.js`

**Step 1: Write failing test — dynamic_task_defs table exists after migration**
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { applyMigrations } from '../../src/domains/memory/schema.js';

test('SCHEMA_V8 creates dynamic_task_defs table', () => {
  const db = new Database(':memory:');
  applyMigrations(db);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dynamic_task_defs'").all();
  assert.equal(tables.length, 1);
  db.close();
});

test('SCHEMA_V8 adds error_summary column to task_run_ledger', () => {
  const db = new Database(':memory:');
  applyMigrations(db);
  const cols = db.prepare("PRAGMA table_info(task_run_ledger)").all();
  const errorSummary = cols.find(c => c.name === 'error_summary');
  assert.ok(errorSummary, 'error_summary column should exist');
  db.close();
});
```

**Step 2: Run test — expect FAIL**
```bash
cd packages/api && node --test test/scheduler/dynamic-task-store.test.js
```

**Step 3: Implement V8 migration**
In `schema.ts`: add `SCHEMA_V8`, bump `CURRENT_SCHEMA_VERSION` to 8, add migration block.

**Step 4: Run test — expect PASS**

**Step 5: Commit**
```bash
git commit -m "feat(F139): schema V8 — dynamic_task_defs table + error_summary column"
```

---

## Task 2: DynamicTaskStore — CRUD for dynamic tasks

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/DynamicTaskStore.ts`
- Test: `packages/api/test/scheduler/dynamic-task-store.test.js` (append)

**Step 1: Write failing tests — insert, getAll, getById, delete, toggle**
```javascript
test('DynamicTaskStore: insert + getAll round-trips', () => { /* ... */ });
test('DynamicTaskStore: delete removes row', () => { /* ... */ });
test('DynamicTaskStore: toggle flips enabled', () => { /* ... */ });
```

**Step 2: Run — expect FAIL**

**Step 3: Implement DynamicTaskStore class**
- `insert(def: DynamicTaskDef): void`
- `getAll(): DynamicTaskDef[]`
- `getById(id: string): DynamicTaskDef | null`
- `remove(id: string): boolean`
- `setEnabled(id: string, enabled: boolean): boolean`

JSON serialization for trigger/params/display fields.

**Step 4: Run — expect PASS**

**Step 5: Commit**

---

## Task 3: Template Registry + 3 MVP Templates

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/templates/registry.ts`
- Create: `packages/api/src/infrastructure/scheduler/templates/reminder.ts`
- Create: `packages/api/src/infrastructure/scheduler/templates/web-digest.ts`
- Create: `packages/api/src/infrastructure/scheduler/templates/repo-activity.ts`
- Test: `packages/api/test/scheduler/template-registry.test.js`

**Step 1: Write failing test — registry has 3 templates, each produces valid TaskSpec**
```javascript
test('TemplateRegistry lists 3 MVP templates', () => {
  const templates = templateRegistry.list();
  assert.ok(templates.length >= 3);
});
test('reminder template creates valid TaskSpec', () => {
  const spec = templateRegistry.get('reminder').createSpec('test-1', {
    trigger: { type: 'cron', expression: '0 9 * * *' },
    params: { message: '检查 backlog' },
    deliveryThreadId: 'thread-abc',
  });
  assert.equal(spec.id, 'dyn-test-1');
  assert.ok(spec.admission.gate);
  assert.ok(spec.run.execute);
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement templates**

Templates:
1. **reminder** — 定时提醒：gate 永远返回 run=true（时间到就触发），execute 向 deliveryThreadId post 一条消息
2. **web-digest** — 网页摘要：gate 检查上次摘要时间，execute 调 fetch + 投递到 thread
3. **repo-activity** — 仓库动态：gate 检查 GitHub API，execute 汇总新 issue/PR 投递到 thread

每个模板导出一个 `TaskTemplate` 对象。Registry 是一个 Map<templateId, TaskTemplate>。

**Step 4: Run — expect PASS**

**Step 5: Commit**

---

## Task 4: RunLedger error_summary — capture + expose

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/RunLedger.ts`
- Modify: `packages/api/src/infrastructure/scheduler/types.ts`
- Modify: `packages/api/src/infrastructure/scheduler/TaskRunnerV2.ts`
- Test: `packages/api/test/scheduler/display-contract.test.js` (append)

**Step 1: Write failing test — RUN_FAILED records error_summary**
```javascript
test('RUN_FAILED includes error_summary in ledger', async () => {
  runner.register({ /* task that throws */ });
  await runner.triggerNow('failing-task');
  const runs = runner.ledger.query('failing-task', 1);
  assert.ok(runs[0].error_summary);
  assert.match(runs[0].error_summary, /something broke/);
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**
- `RunLedgerRow`: add `error_summary: string | null`
- `RunLedger.record()`: include `error_summary` in INSERT
- `RunLedger.query()`: include `error_summary` in SELECT
- `TaskRunnerV2.executePipeline()`: catch block captures `err.message` (truncated to 500 chars) into error_summary

**Step 4: Run — expect PASS**

**Step 5: Commit**

---

## Task 5: Dynamic Task Hydration in TaskRunnerV2

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/TaskRunnerV2.ts`
- Test: `packages/api/test/scheduler/dynamic-hydration.test.js`

**Step 1: Write failing test — hydrate loads from store + registers**
```javascript
test('hydrateDynamic registers tasks from store', () => {
  store.insert({ templateId: 'reminder', ... });
  runner.hydrateDynamic(store, templateRegistry);
  const summaries = runner.getTaskSummaries();
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].source, 'dynamic');
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**
- `TaskRunnerV2.hydrateDynamic(store, registry)`: reads all enabled defs from store, resolves template, calls `template.createSpec()`, registers.
- `getTaskSummaries()`: adds `source: 'builtin' | 'dynamic'` + `dynamicTaskId` fields.

**Step 4: Run — expect PASS**

**Step 5: Commit**

---

## Task 6: API Endpoints — CRUD + run history + templates

**Files:**
- Modify: `packages/api/src/routes/schedule.ts`
- Test: `packages/api/test/scheduler/schedule-api.test.js`

**Step 1: Write failing tests**
```javascript
test('GET /api/schedule/templates returns template list', async () => { /* ... */ });
test('POST /api/schedule/tasks creates dynamic task', async () => { /* ... */ });
test('DELETE /api/schedule/tasks/:id removes task', async () => { /* ... */ });
test('PATCH /api/schedule/tasks/:id toggles enabled', async () => { /* ... */ });
test('GET /api/schedule/tasks/:id/runs returns history with error_summary', async () => { /* ... */ });
```

**Step 2: Run — expect FAIL**

**Step 3: Implement endpoints**
- `GET /api/schedule/templates` — returns registry.list() with paramSchema
- `POST /api/schedule/tasks` — validates template exists + params, inserts to store, registers in runner, returns task summary
- `DELETE /api/schedule/tasks/:id` — removes from store + unregisters from runner
- `PATCH /api/schedule/tasks/:id` — toggles enabled in store + runner
- `GET /api/schedule/tasks/:id/runs` — queries ledger with limit, returns rows including error_summary
- **Delete** `POST /api/schedule/nl-config` endpoint + `parseNlToTrigger` function

**Step 4: Run — expect PASS**

**Step 5: Commit**

---

## Task 7: MCP Tools — template discovery + task registration

**Files:**
- Modify: `packages/mcp-server/src/tools/callback-tools.ts`
- Modify: `packages/api/src/routes/callbacks.ts`

**Step 1: Write failing test (if MCP server has test infra, otherwise integration test)**

**Step 2: Implement MCP tools**

Tool 1: `cat_cafe_list_schedule_templates`
- No input
- Returns list of templates with paramSchema
- Cats call this to discover what's available

Tool 2: `cat_cafe_register_scheduled_task`
- Input: `{ templateId, trigger, params, deliveryThreadId? }`
- Calls `POST /api/schedule/tasks`
- Returns confirmation with task summary

Tool 3: `cat_cafe_remove_scheduled_task`
- Input: `{ taskId }`
- Calls `DELETE /api/schedule/tasks/:id`

**Step 3: Register in callbackTools array**

**Step 4: Commit**

---

## Task 8: Frontend — Delete NL input, add CTA

**Files:**
- Modify: `packages/web/src/components/workspace/SchedulePanel.tsx`

**Step 1: Delete NL input box + handleNlSubmit + nlInput state**

**Step 2: Add CTA section at bottom of panel**
```tsx
<div className="px-4 py-3 text-center text-sm text-stone-500 border-t border-stone-200">
  <p>想添加定时任务？</p>
  <p className="text-stone-400">在对话中告诉我，比如「每天九点帮我看看 Anthropic 新闻」</p>
</div>
```

No input, no submit, no API call. Pure guidance text.

**Step 3: Verify build**
```bash
pnpm --filter @cat-cafe/web build
```

**Step 4: Commit**

---

## Task 9: Frontend — Footer health summary

**Files:**
- Modify: `packages/web/src/components/workspace/SchedulePanel.tsx`

**Step 1: Replace footer logic**

Before:
```tsx
const totalFailed = tasks.reduce((sum, t) => sum + t.runStats.failed, 0);
// shows "3 failed" or "All healthy"
```

After — check if any task's **last run** was FAILED:
```tsx
const hasRecentFailure = tasks.some(t => t.lastRun?.outcome === 'RUN_FAILED');
// shows "Attention needed" (amber) or "All healthy" (green)
```

Footer format: `{tasks.length} tasks · {activeCount} active` + right-aligned health indicator.

**Step 2: Verify build**

**Step 3: Commit**

---

## Task 10: Frontend — Task row status + detail drawer

**Files:**
- Modify: `packages/web/src/components/workspace/SchedulePanel.tsx`

**Step 1: Add last-run status indicator to each task row**
- Green dot: last run delivered
- Red dot: last run failed (+ show error_summary on hover)
- Gray dot: idle / no runs yet

**Step 2: Add expandable detail section per task**
- Click task row → expand to show:
  - Last 5 runs (time + outcome + error_summary if failed)
  - For dynamic tasks: "删除" button (calls DELETE endpoint)

**Step 3: Update ScheduleTaskSummary type in frontend to include `source`, `dynamicTaskId`, `error_summary` in lastRun**

**Step 4: Verify build**

**Step 5: Commit**

---

## Task 11: Wire up startup hydration in index.ts

**Files:**
- Modify: `packages/api/src/index.ts`

**Step 1: After creating TaskRunnerV2, before start():**
```typescript
const dynamicTaskStore = new DynamicTaskStore(memoryDb);
taskRunnerV2.hydrateDynamic(dynamicTaskStore, templateRegistry);
```

**Step 2: Pass store + registry to schedule routes for CRUD**

**Step 3: Integration test — full startup with dynamic tasks**

**Step 4: Commit**

---

## Task 12: Final integration + gate check

**Step 1: Run full test suite**
```bash
pnpm gate
```

**Step 2: Fix any failures**

**Step 3: Final commit**

---

## AC Coverage Map

| AC | Task(s) | Verification |
|----|---------|-------------|
| F1: Delete NL input → CTA | Task 8 | Build passes, no input box in panel |
| F2: Footer health summary | Task 9 | "All healthy" / "Attention needed" based on last run |
| F3: error_summary in RunLedger | Task 1 (schema) + Task 4 (capture) | Test: RUN_FAILED stores error message |
| F4: Task row status + run history | Task 10 | Click task → see last N runs with errors |
| G1: Cat identifies schedule intent → template | Task 3 (registry) + Task 7 (MCP discovery) | Cat calls list_schedule_templates, matches user request |
| G2: ScheduleRegistrationDraft → confirm | Task 7 (MCP register tool) | Cat presents draft, user confirms |
| G3: Persist + runtime load | Task 2 (store) + Task 5 (hydration) + Task 6 (API) | POST creates task, survives restart |
| G4: Dynamic + builtin unified | Task 5 (source field) + Task 10 (UI) | Both types in same panel, dynamic deletable |
| G5: ≥3 templates | Task 3 | reminder + web-digest + repo-activity |
