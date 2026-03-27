---
feature_ids: [F139]
doc_kind: plan
created: 2026-03-27
---

# F139 Phase 3B — Governance + Pack Implementation Plan

**Feature:** F139 — `docs/features/F139-unified-schedule-abstraction.md`
**Goal:** Scheduler governance (global kill switch + self-echo suppression) + Pack template install/uninstall
**Acceptance Criteria:**
- AC-D1: 电闸/备忘录分离权限模型
- AC-D2: anti-feedback-loop 防回声
- AC-D3: Pack 任务模板安装/卸载
**Architecture:** Two-layer control (global + per-task) stored in scheduler SQLite; emission tracking for echo suppression; declarative-only Pack templates with namespace isolation
**Tech Stack:** SQLite (better-sqlite3), Fastify routes, React (SchedulePanel), TypeScript
**前端验证:** Yes — global toggle UI in SchedulePanel

**NOT building:**
- Cross-task causal graph (D2 只做 self-echo suppression)
- Pack custom JS execute (声明式 only)
- Cascade uninstall (有活跃实例 → 阻止卸载)
- F136 hot reload integration (F136 完成后天然支持)

---

## Terminal Schema

```typescript
// scheduler_global_control (single row)
interface GlobalControl {
  enabled: boolean;          // 总电闸
  reason: string | null;     // "维护中" etc
  updatedBy: string;         // catId or 'user'
  updatedAt: string;         // ISO
}

// scheduler_task_overrides (per task)
interface TaskOverride {
  taskId: string;
  enabled: boolean;
  updatedBy: string;
  updatedAt: string;
}

// scheduler_emissions (D2 echo tracking)
interface SchedulerEmission {
  emissionId: string;        // uuid
  originTaskId: string;
  threadId: string;
  messageId: string;
  suppressionUntil: string;  // ISO — TTL-based expiry
  createdAt: string;
}

// Pack template definition (D3)
interface PackTemplateDef {
  packId: string;
  templateId: string;        // stored as pack:{packId}:{templateId}
  label: string;
  description: string;
  category: DisplayCategory;
  subjectKind: SubjectKind;
  defaultTrigger: TriggerSpec;
  paramSchema: Record<string, ParamDef>;
  builtinTemplateRef: string; // must reference an existing builtin executor
}
```

---

## File Size Budget

| File | Current | Delta | After | OK? |
|------|---------|-------|-------|-----|
| TaskRunnerV2.ts | 349 | +20 (global check) −100 (extract executePipeline) | ~270 | ✅ |
| schedule.ts | 281 | +60 (global control endpoints) | ~341 | ✅ |
| SchedulePanel.tsx | 315 | +30 (global toggle) | ~345 | ✅ |
| registry.ts | 28 | +40 (pack template methods) | ~68 | ✅ |
| NEW: ExecutePipeline.ts | 0 | +120 | ~120 | ✅ |
| NEW: GlobalControlStore.ts | 0 | +60 | ~60 | ✅ |
| NEW: EmissionStore.ts | 0 | +70 | ~70 | ✅ |

**Key extraction**: `executePipeline` method (lines 251-348) from TaskRunnerV2 → standalone module. TaskRunnerV2 is AT the 350 hard limit; any addition requires extraction first.

---

## Task 1: Schema V9 Migration

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts`
- Test: `packages/api/test/memory/schema-v2.test.js`

**Step 1: Write failing test**
```javascript
test('CURRENT_SCHEMA_VERSION is 9', () => {
  assert.equal(CURRENT_SCHEMA_VERSION, 9);
});
```

**Step 2: Implement V9 migration**
```sql
-- scheduler_global_control (single row, upsert pattern)
CREATE TABLE IF NOT EXISTS scheduler_global_control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO scheduler_global_control (id, enabled, updated_by, updated_at)
  VALUES (1, 1, 'system', datetime('now'));

-- scheduler_task_overrides
CREATE TABLE IF NOT EXISTS scheduler_task_overrides (
  task_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- scheduler_emissions (D2)
CREATE TABLE IF NOT EXISTS scheduler_emissions (
  emission_id TEXT PRIMARY KEY,
  origin_task_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  suppression_until TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emissions_thread ON scheduler_emissions(thread_id, suppression_until);

-- pack_template_defs (D3)
CREATE TABLE IF NOT EXISTS pack_template_defs (
  template_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  default_trigger_json TEXT NOT NULL,
  param_schema_json TEXT NOT NULL,
  builtin_template_ref TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pack_templates_pack ON pack_template_defs(pack_id);
```

**Step 3: Update version assertions** in `schema-v2.test.js` and `pack-knowledge-scope.test.js` (8 → 9)

**Step 4: Commit** `feat(F139): schema V9 — governance + emission + pack tables`

---

## Task 2: GlobalControlStore (AC-D1 data layer)

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/GlobalControlStore.ts`
- Test: `packages/api/test/scheduler/global-control-store.test.js`

**Step 1: Write failing test**
```javascript
test('getGlobalEnabled returns true by default', () => {
  const store = new GlobalControlStore(db);
  assert.equal(store.getGlobalEnabled(), true);
});
test('setGlobalEnabled toggles and records reason', () => {
  const store = new GlobalControlStore(db);
  store.setGlobalEnabled(false, 'maintenance', 'user');
  assert.equal(store.getGlobalEnabled(), false);
  const state = store.getGlobalState();
  assert.equal(state.reason, 'maintenance');
});
test('getTaskOverride returns null when no override', () => {
  assert.equal(store.getTaskOverride('unknown'), null);
});
test('setTaskOverride creates override', () => {
  store.setTaskOverride('task-1', false, 'opus');
  assert.equal(store.getTaskOverride('task-1').enabled, false);
});
```

**Step 2: Implement GlobalControlStore**
- `getGlobalEnabled(): boolean`
- `getGlobalState(): GlobalControl`
- `setGlobalEnabled(enabled, reason, updatedBy): void`
- `getTaskOverride(taskId): TaskOverride | null`
- `setTaskOverride(taskId, enabled, updatedBy): void`
- `removeTaskOverride(taskId): boolean`
- `listOverrides(): TaskOverride[]`

**Step 3: Commit** `feat(F139): GlobalControlStore — two-layer scheduler control`

---

## Task 3: Extract executePipeline from TaskRunnerV2

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/execute-pipeline.ts`
- Modify: `packages/api/src/infrastructure/scheduler/TaskRunnerV2.ts`
- Test: existing scheduler tests must stay green

**Why first:** TaskRunnerV2 is at 349 lines. Adding global check without extraction would exceed 350.

**Step 1: Extract** `executePipeline` (lines 251-348) + `withTimeout` (lines 230-248) into `execute-pipeline.ts` as a standalone async function that takes `{ task, ledger, logger, running, tickCounts, lastRunAt, actorResolver }`.

**Step 2: TaskRunnerV2 imports and delegates** — `executePipeline()` call becomes `await executeTaskPipeline({ ... })`.

**Step 3: Run all scheduler tests** — must pass unchanged.

**Step 4: Commit** `refactor(F139): extract executePipeline for file size budget`

---

## Task 4: Wire global control into pipeline (AC-D1 runtime)

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/execute-pipeline.ts`
- Modify: `packages/api/src/infrastructure/scheduler/TaskRunnerV2.ts`
- Test: `packages/api/test/scheduler/global-control.test.js`

**Step 1: Write failing tests**
```javascript
test('global disable skips scheduled tick, records SKIP_GLOBAL_PAUSE', async () => { ... });
test('global disable does NOT skip manual triggerNow', async () => { ... });
test('task override disable skips even when global enabled', async () => { ... });
```

**Step 2: Add to executePipeline**
- New parameter: `globalControlStore: GlobalControlStore`
- New parameter: `isManualTrigger: boolean` (default false)
- Before enabled check: query global state + task override
- Global off + not manual → record `SKIP_GLOBAL_PAUSE`, return
- Task override off → record `SKIP_TASK_OVERRIDE`, return

**Step 3: TaskRunnerV2 passes `isManualTrigger: true` in `triggerNow()`**

**Step 4: Commit** `feat(F139): global kill switch + task override in execution pipeline (AC-D1)`

---

## Task 5: Global control API endpoints (AC-D1 API)

**Files:**
- Modify: `packages/api/src/routes/schedule.ts`
- Test: `packages/api/test/schedule-route.test.js`

**Step 1: Write failing tests**
```javascript
test('GET /api/schedule/control returns global state', async () => { ... });
test('PATCH /api/schedule/control toggles global enabled', async () => { ... });
test('GET /api/schedule/tasks includes override state', async () => { ... });
```

**Step 2: Add endpoints**
- `GET /api/schedule/control` → `{ enabled, reason, updatedBy, updatedAt }`
- `PATCH /api/schedule/control` → `{ enabled, reason }` → updates global control

**Step 3: Extend existing `GET /api/schedule/tasks`** to include override status per task

**Step 4: Commit** `feat(F139): global control API endpoints (AC-D1)`

---

## Task 6: SchedulePanel global toggle (AC-D1 UI)

**Files:**
- Modify: `packages/web/src/components/workspace/SchedulePanel.tsx`
- Modify: `packages/web/src/components/workspace/schedule-helpers.ts`

**Step 1: Add state + fetch**
```typescript
const [globalEnabled, setGlobalEnabled] = useState(true);
// Fetch GET /api/schedule/control on mount
```

**Step 2: Render toggle** — above scope filter bar:
```tsx
<div className="flex items-center justify-between px-4 py-2 border-b border-[#E8DFD4]">
  <span className="text-sm font-medium">调度总开关</span>
  <button onClick={handleToggleGlobal} className={...}>
    {globalEnabled ? '运行中' : '已暂停'}
  </button>
</div>
```

**Step 3: When off**, show dimmed task list + banner "所有自动调度已暂停"

**Step 4: Commit** `feat(F139): SchedulePanel global toggle UI (AC-D1)`

---

## Task 7: EmissionStore + message tagging (AC-D2 data layer)

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/EmissionStore.ts`
- Modify: `packages/api/src/infrastructure/scheduler/execute-pipeline.ts`
- Test: `packages/api/test/scheduler/emission-store.test.js`

**Step 1: Write failing tests**
```javascript
test('recordEmission persists to SQLite', () => { ... });
test('hasActiveEmission returns true within TTL', () => { ... });
test('hasActiveEmission returns false after TTL expires', () => { ... });
test('cleanExpired removes old entries', () => { ... });
```

**Step 2: Implement EmissionStore**
- `recordEmission(originTaskId, threadId, messageId, suppressionMinutes): string`
- `hasActiveEmission(threadId, sinceMessageId?): { hit: boolean; originTaskId?: string }`
- `cleanExpired(): number`

**Step 3: Wire into executePipeline** — after successful execute that produces a message, call `emissionStore.recordEmission(task.id, threadId, messageId, 5)` (5 min default TTL)

**Step 4: Commit** `feat(F139): EmissionStore — scheduler emission tracking (AC-D2)`

---

## Task 8: Self-echo suppression in gate (AC-D2 runtime)

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/execute-pipeline.ts`
- Test: `packages/api/test/scheduler/echo-suppression.test.js`

**Step 1: Write failing tests**
```javascript
test('gate workItems from echoed thread are suppressed', async () => { ... });
test('gate workItems from unrelated thread are NOT suppressed', async () => { ... });
test('suppression expires after TTL', async () => { ... });
```

**Step 2: Add post-gate filter** — after `gate()` returns workItems, filter out items where:
- `item.subjectKey` references a thread with active emission from same task
- `emissionStore.hasActiveEmission(threadId)` returns hit

**Step 3: Record `SKIP_ECHO_SUPPRESSION` outcome** for filtered items

**Step 4: Commit** `feat(F139): self-echo suppression in gate pipeline (AC-D2)`

---

## Task 9: Pack template types + registry (AC-D3)

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/PackTemplateStore.ts`
- Modify: `packages/api/src/infrastructure/scheduler/templates/registry.ts`
- Modify: `packages/api/src/infrastructure/scheduler/templates/types.ts`
- Test: `packages/api/test/scheduler/pack-template.test.js`

**Step 1: Write failing tests**
```javascript
test('registerPackTemplate adds with pack: namespace prefix', () => {
  registry.registerPackTemplate('my-pack', packDef);
  const t = registry.get('pack:my-pack:reminder-v2');
  assert.ok(t);
  assert.equal(t.templateId, 'pack:my-pack:reminder-v2');
});
test('uninstallPack removes all templates for packId', () => { ... });
test('uninstallPack blocked when active instances exist', () => { ... });
test('pack template createSpec delegates to builtin executor', () => { ... });
```

**Step 2: Add PackTemplateDef type** to `types.ts`

**Step 3: Implement PackTemplateStore** — CRUD for `pack_template_defs` table

**Step 4: Extend TemplateRegistry**
- `registerPackTemplate(packId, def)` — validates `builtinTemplateRef` exists, prefixes ID with `pack:{packId}:`, stores in both Map and SQLite
- `uninstallPack(packId, dynamicTaskStore)` — checks for active instances → throws if any → removes all pack templates
- `listByPack(packId)` — list templates from a specific pack

**Step 5: Commit** `feat(F139): Pack template registry with namespace isolation (AC-D3)`

---

## Task 10: Pack template API + install/uninstall endpoints (AC-D3 API)

**Files:**
- Modify: `packages/api/src/routes/schedule.ts`
- Test: `packages/api/test/schedule-route.test.js`

**Step 1: Write failing tests**
```javascript
test('POST /api/schedule/packs/:packId/templates installs pack template', async () => { ... });
test('DELETE /api/schedule/packs/:packId removes all pack templates', async () => { ... });
test('DELETE blocked when active instances exist', async () => { ... });
test('GET /api/schedule/templates includes pack templates', async () => { ... });
```

**Step 2: Add endpoints**
- `POST /api/schedule/packs/:packId/templates` → body: `PackTemplateDef[]` → validates + installs
- `DELETE /api/schedule/packs/:packId` → uninstalls (blocked if active instances)
- Existing `GET /api/schedule/templates` already returns all from registry (includes pack templates automatically)

**Step 3: Commit** `feat(F139): Pack template install/uninstall API (AC-D3)`

---

## Task 11: Startup wiring + MCP tools

**Files:**
- Modify: `packages/api/src/index.ts` (~line 463)
- Modify: `packages/mcp-server/src/tools/schedule-tools.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`
- Test: `packages/mcp-server/test/schedule-tools.test.js`

**Step 1: Wire stores at startup**
```typescript
const globalControlStore = new GlobalControlStore(schedulerDb);
const emissionStore = new EmissionStore(schedulerDb);
const packTemplateStore = new PackTemplateStore(schedulerDb);
// Pass to route options + TaskRunnerV2
```

**Step 2: Add MCP tools**
- `cat_cafe_toggle_scheduler` — global on/off
- `cat_cafe_list_pack_templates` — list installed pack templates

**Step 3: Commit** `feat(F139): Phase 3B startup wiring + MCP tools`

---

## Task 12: Gate pass + cleanup

**Step 1:** `pnpm check:fix` (biome)
**Step 2:** `pnpm gate` — full build + test + lint
**Step 3:** Update feature index
**Step 4:** Commit all cleanup

---

## Commit Plan (12 commits)

| # | Message | AC |
|---|---------|-----|
| 1 | `feat(F139): schema V9 — governance + emission + pack tables` | D1/D2/D3 |
| 2 | `feat(F139): GlobalControlStore — two-layer scheduler control` | D1 |
| 3 | `refactor(F139): extract executePipeline for file size budget` | — |
| 4 | `feat(F139): global kill switch + task override in pipeline` | D1 |
| 5 | `feat(F139): global control API endpoints` | D1 |
| 6 | `feat(F139): SchedulePanel global toggle UI` | D1 |
| 7 | `feat(F139): EmissionStore — scheduler emission tracking` | D2 |
| 8 | `feat(F139): self-echo suppression in gate pipeline` | D2 |
| 9 | `feat(F139): Pack template registry with namespace isolation` | D3 |
| 10 | `feat(F139): Pack template install/uninstall API` | D3 |
| 11 | `feat(F139): Phase 3B startup wiring + MCP tools` | all |
| 12 | `chore(F139): Phase 3B gate cleanup` | — |
