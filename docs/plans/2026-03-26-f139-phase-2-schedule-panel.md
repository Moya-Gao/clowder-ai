# F139 Phase 2: Schedule Panel + Cron + Context + NL Config

**Feature:** F139 — `docs/features/F139-unified-schedule-abstraction.md`
**Goal:** 把 Phase 1a/1b 的纯后端调度引擎可视化 + 补全 cron/context/NL 三个维度
**Acceptance Criteria:**
- AC-C1: cron/event trigger 可用
- AC-C2: Context dimension（session × materialization）可配置
- AC-C3: Hub panel 展示任务列表 + 运行状态
- AC-C3b-1: 调度 API 返回 threadId（可空）用于每条任务实例展示
- AC-C3b-2: 调度面板支持 scope 切换（All / Current Thread / 指定 Thread）一键过滤
- AC-C3b-3: 无 thread 关联任务明确落在「No thread」分组，不丢失
- AC-C4: 自然语言→TaskSpec 转换可用
**Architecture:** 后端：扩展 TaskSpec trigger 类型 + 新增 `/api/schedule/*` API 暴露注册任务和 run ledger + Context 维度。前端：WorkspacePanel 新增 `schedule` mode，新建 `SchedulePanel` 组件（扁平列表 + 彩色标签 + scope filter + NL CTA），严格对照 UX V2 设计稿。
**Tech Stack:** TypeScript, Fastify, better-sqlite3, React, Tailwind, cron-parser (new dep)
**前端验证:** Yes — 砚砚必须对照 UX V2 设计稿 vs 实现截图（铲屎官明确要求）

---

## What We're NOT Building

- Pack marketplace / 第三方任务模板（Phase 3）
- Governance 电闸 / 备忘录分离（Phase 3）
- Anti-feedback-loop（Phase 3）
- Event trigger channel（OQ-1 仍 open，Phase 2 只做 cron + interval）
- 用户自定义任务的完整 CRUD（NL config 产出 TaskSpec 提案，实际注册是 Phase 3）

## Terminal Schema

```typescript
// ── Trigger 扩展 ──
type TriggerSpec =
  | { type: 'interval'; ms: number }
  | { type: 'cron'; expression: string; timezone?: string };

// ── Context dimension（Phase 2 新增）──
interface ContextSpec {
  session: 'new-thread' | 'same-thread';
  materialization: 'light' | 'full';
}

// ── TaskSpec_P2 = P1 + cron trigger + context ──
interface TaskSpec_P2<Signal = unknown> extends Omit<TaskSpec_P1<Signal>, 'trigger'> {
  trigger: TriggerSpec;
  context?: ContextSpec;
}

// ── Schedule API response ──
interface ScheduleTaskSummary {
  id: string;
  profile: TaskProfile;
  trigger: TriggerSpec;
  enabled: boolean;
  actor?: ActorSpec;
  context?: ContextSpec;
  lastRun: RunLedgerRow | null;
  runStats: { total: number; delivered: number; failed: number; skipped: number };
}

// ── Thread resolution for AC-C3b ──
// subjectKey format: "thread:{threadId}" → extract threadId
// Non-thread subjects (e.g. "repo:owner/name") → threadId = null
```

## API Endpoints (new)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/schedule/tasks` | 列出所有注册任务 + 最近一次 run + 统计 |
| GET | `/api/schedule/tasks/:id/runs` | 某任务的 run ledger 历史 |
| GET | `/api/schedule/tasks/:id/runs?threadId=xxx` | AC-C3b: 按 thread 过滤 runs |
| POST | `/api/schedule/tasks/:id/trigger` | 手动触发一次 |
| POST | `/api/schedule/nl-config` | AC-C4: 自然语言 → TaskSpec 提案 |

---

## Part 1: Backend — Cron Trigger + Context Dimension

### Task 1.1: Extend TriggerSpec type + add cron-parser dep

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/types.ts`
- Modify: `packages/api/package.json` (add cron-parser)

**Step 1: Write the failing test**

```typescript
// test/infrastructure/scheduler/cron-trigger.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('TriggerSpec cron type', () => {
  it('accepts cron expression', () => {
    const trigger = { type: 'cron' as const, expression: '0 9 * * *' };
    assert.equal(trigger.type, 'cron');
    assert.equal(trigger.expression, '0 9 * * *');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/infrastructure/scheduler/cron-trigger.test.ts`
Expected: FAIL (file doesn't exist yet)

**Step 3: Extend types + install dep**

Update `types.ts`:
```typescript
export type TriggerSpec =
  | { type: 'interval'; ms: number }
  | { type: 'cron'; expression: string; timezone?: string };

export interface ContextSpec {
  session: 'new-thread' | 'same-thread';
  materialization: 'light' | 'full';
}

// TaskSpec_P1 trigger field changes from fixed { type:'interval'; ms } to TriggerSpec
```

Install: `pnpm --filter @cat-cafe/api add cron-parser`

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/infrastructure/scheduler/cron-trigger.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/infrastructure/scheduler/types.ts packages/api/package.json packages/api/test/
git commit -m "feat(F139): extend TriggerSpec with cron + ContextSpec types [布偶猫🐾]"
```

### Task 1.2: Cron scheduling in TaskRunnerV2

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/TaskRunnerV2.ts`
- Create: `packages/api/test/infrastructure/scheduler/cron-scheduling.test.ts`

**Step 1: Write the failing test**

```typescript
describe('TaskRunnerV2 cron trigger', () => {
  it('schedules cron task and fires at correct time', async () => {
    // Use fake timers or verify that cron-triggered task gets registered
    // and executePipeline is called
  });

  it('calculates next run time from cron expression', () => {
    // Verify getNextCronMs helper returns correct milliseconds
  });
});
```

**Step 2: Implement cron scheduling logic**

Add to TaskRunnerV2:
- For `type: 'cron'`: use cron-parser to compute next run time, schedule via setTimeout chain (not setInterval)
- Helper: `getNextCronMs(expression, timezone?)` → ms until next occurrence
- After each cron fire, schedule the next one

**Step 3: Run tests, verify green**

**Step 4: Commit**

```bash
git commit -m "feat(F139): cron trigger scheduling in TaskRunnerV2 [布偶猫🐾]"
```

### Task 1.3: ContextSpec wiring

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/types.ts` (TaskSpec_P1 → accept ContextSpec)
- Modify: `packages/api/src/infrastructure/scheduler/TaskRunnerV2.ts` (pass context to execute)
- Create: `packages/api/test/infrastructure/scheduler/context-spec.test.ts`

**Step 1: Write failing test**

```typescript
describe('ContextSpec in TaskRunnerV2', () => {
  it('passes context to execute when specified', async () => {
    // Register task with context: { session: 'new-thread', materialization: 'light' }
    // Verify execute receives context in ExecuteContext
  });

  it('defaults to undefined context when not specified', async () => {
    // Existing tasks without context still work
  });
});
```

**Step 2: Extend ExecuteContext to carry context spec**

```typescript
export interface ExecuteContext {
  assignedCatId: string | null;
  context?: ContextSpec; // Phase 2: session × materialization
}
```

**Step 3: Run tests, verify green**

**Step 4: Commit**

```bash
git commit -m "feat(F139): wire ContextSpec through execute pipeline [布偶猫🐾]"
```

## Part 2: Backend — Schedule API

### Task 2.1: TaskRunnerV2 metadata exposure

**Files:**
- Modify: `packages/api/src/infrastructure/scheduler/TaskRunnerV2.ts`
- Modify: `packages/api/src/infrastructure/scheduler/RunLedger.ts`

**Step 1: Write failing test**

```typescript
describe('TaskRunnerV2.getTaskSummaries()', () => {
  it('returns task metadata + last run + stats', () => {
    // Register 2 tasks, run one, verify summary shape
  });
});

describe('RunLedger.stats()', () => {
  it('returns outcome counts per task', () => {
    // Insert 5 rows, verify { total: 5, delivered: 3, failed: 1, skipped: 1 }
  });
});
```

**Step 2: Implement**

Add to RunLedger:
```typescript
stats(taskId: string): { total: number; delivered: number; failed: number; skipped: number }
queryBySubject(taskId: string, subjectKey: string, limit: number): RunLedgerRow[]
```

Add to TaskRunnerV2:
```typescript
getTaskSummaries(): ScheduleTaskSummary[]
// Iterates registered tasks, queries ledger for last run + stats
```

**Step 3: Run tests, verify green**

**Step 4: Commit**

```bash
git commit -m "feat(F139): expose task summaries + ledger stats [布偶猫🐾]"
```

### Task 2.2: Schedule API routes

**Files:**
- Create: `packages/api/src/routes/schedule.ts`
- Modify: `packages/api/src/index.ts` (register routes)
- Create: `packages/api/test/routes/schedule.test.ts`

**Step 1: Write failing test**

```typescript
describe('GET /api/schedule/tasks', () => {
  it('returns registered tasks with summaries', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/schedule/tasks' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.tasks));
  });
});

describe('GET /api/schedule/tasks/:id/runs', () => {
  it('returns run history for task', async () => {
    // ...
  });

  it('filters by threadId when query param provided (AC-C3b-1)', async () => {
    // subjectKey="thread:abc" → threadId="abc"
  });
});

describe('POST /api/schedule/tasks/:id/trigger', () => {
  it('triggers task manually', async () => {
    // ...
  });
});
```

**Step 2: Implement routes**

```typescript
// packages/api/src/routes/schedule.ts
export const scheduleRoutes: FastifyPluginAsync<ScheduleRoutesOptions> = async (app, opts) => {
  // GET /api/schedule/tasks
  // GET /api/schedule/tasks/:id/runs?threadId=xxx
  // POST /api/schedule/tasks/:id/trigger
};
```

Thread ID extraction (AC-C3b-1):
```typescript
function extractThreadId(subjectKey: string): string | null {
  if (subjectKey.startsWith('thread:')) return subjectKey.slice(7);
  return null;
}
```

**Step 3: Run tests, verify green**

**Step 4: Commit**

```bash
git commit -m "feat(F139): schedule API routes (tasks + runs + trigger) [布偶猫🐾]"
```

## Part 3: Frontend — Schedule Panel

### Task 3.1: Extend workspace mode to include 'schedule'

**Files:**
- Modify: `packages/web/src/stores/chatStore.ts`
- Modify: `packages/web/src/components/WorkspacePanel.tsx`

**Step 1: Update chatStore type**

```typescript
// 'dev' | 'knowledge' → 'dev' | 'knowledge' | 'schedule'
workspaceMode: 'dev' | 'knowledge' | 'schedule';
```

**Step 2: Add schedule button to mode switcher**

Add third button in WorkspacePanel.tsx mode switcher (line ~652-676):
```tsx
<button
  type="button"
  onClick={() => setWorkspaceMode('schedule')}
  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
    workspaceMode === 'schedule'
      ? 'bg-cocreator-bg text-cocreator-dark border border-cocreator-light/60'
      : 'text-cocreator-dark/40 hover:text-cocreator-dark/60'
  }`}
>
  {/* SVG clock icon — KD-7: Tab 图标用 SVG 不用 emoji */}
  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0a8 8 0 110 16A8 8 0 018 0zm0 2a6 6 0 100 12A6 6 0 008 2zm.5 2v4.25l2.85 2.85a.5.5 0 01-.7.7L7.8 8.95A.5.5 0 017.5 8.6V4a.5.5 0 011 0z"/>
  </svg>
  调度
</button>
```

**Step 3: Route to SchedulePanel**

```tsx
{workspaceMode === 'knowledge' ? (
  <KnowledgeFeed />
) : workspaceMode === 'schedule' ? (
  <SchedulePanel />
) : (
  <>{/* existing dev mode content */}</>
)}
```

**Step 4: Commit**

```bash
git commit -m "feat(F139): add 'schedule' workspace mode [布偶猫🐾]"
```

### Task 3.2: SchedulePanel component — flat task list (AC-C3)

**Files:**
- Create: `packages/web/src/components/workspace/SchedulePanel.tsx`

**Step 1: Create component with data fetching**

Fetch `GET /api/schedule/tasks`, render flat list matching UX V2:
- Each row: task name + type tag (colored) + trigger info + last run status + time ago
- Color tags by task category:
  - PR tasks (review-feedback, conflict-check): `bg-blue-100 text-blue-700`
  - Repo tasks (cicd-check): `bg-emerald-100 text-emerald-700`
  - System tasks (summary-compact): `bg-amber-100 text-amber-700`
  - Custom tasks: `bg-purple-100 text-purple-700`
- Cat Café warm-tone palette: `#FDFAF6` bg, `#D4A574` accent, `#5C4B3A` text
- Footer: task count + recent runs stats

**Step 2: Verify renders correctly**

Run: `pnpm --filter @cat-cafe/web build` (type check)
Manual verify: dev server screenshot vs V2 design

**Step 3: Commit**

```bash
git commit -m "feat(F139): SchedulePanel component — flat task list + tags [布偶猫🐾]"
```

### Task 3.3: Scope filter (AC-C3b-2, AC-C3b-3)

**Files:**
- Modify: `packages/web/src/components/workspace/SchedulePanel.tsx`

**Step 1: Add scope toggle**

Three modes: `All` | `Current Thread` | specify thread
- `All`: show all tasks (default)
- `Current Thread`: filter by `chatStore.currentThreadId` — show only runs whose subjectKey maps to current thread
- Tasks with no thread association → always visible in a "No thread" section (AC-C3b-3)

```tsx
type ScopeFilter = 'all' | 'current-thread';
const [scope, setScope] = useState<ScopeFilter>('all');
const currentThreadId = useChatStore((s) => s.currentThreadId);
```

**Step 2: Filter logic**

```typescript
// Client-side: tasks already have lastRun.subject_key
// extractThreadId from subject_key, filter by scope
const filteredTasks = useMemo(() => {
  if (scope === 'all') return tasks;
  return tasks.filter(t => {
    const tid = extractThreadId(t.lastRun?.subject_key);
    return tid === currentThreadId || tid === null; // null = no thread, always show
  });
}, [tasks, scope, currentThreadId]);
```

**Step 3: Verify no-thread tasks visible in both scopes**

**Step 4: Commit**

```bash
git commit -m "feat(F139): scope filter — All / Current Thread + no-thread fallback [布偶猫🐾]"
```

### Task 3.4: NL config CTA (AC-C4)

**Files:**
- Modify: `packages/web/src/components/workspace/SchedulePanel.tsx`
- Create: `packages/api/src/routes/schedule.ts` (add NL endpoint)

**Step 1: Add NL CTA bar at bottom of schedule panel**

UX V2 design: warm-tone input bar with placeholder "告诉我你想自动化什么..."

```tsx
<div className="px-4 py-3 bg-[#F5EDE3] border-t border-[#E8DFD4]">
  <div className="flex items-center gap-2">
    <input
      placeholder="告诉我你想自动化什么..."
      className="flex-1 px-3 py-2 rounded-lg bg-white/80 text-sm text-[#5C4B3A] placeholder-[#9A866F] border border-[#E8DFD4] focus:border-[#D4A574] focus:outline-none"
      value={nlInput}
      onChange={(e) => setNlInput(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && handleNlSubmit()}
    />
    <button onClick={handleNlSubmit} className="px-3 py-2 rounded-lg bg-[#D4A574] text-white text-sm font-medium">
      配置
    </button>
  </div>
</div>
```

**Step 2: NL → TaskSpec API endpoint**

```typescript
// POST /api/schedule/nl-config
// Body: { prompt: string }
// Response: { proposal: { id, trigger, context, description }, confirmation: string }
// Phase 2: returns a proposal for user confirmation, does NOT auto-register
```

The backend parses natural language (regex patterns for common cases like "every day at 9am" → cron `0 9 * * *`, "every 30 minutes" → interval 1800000). Complex cases return a "needs clarification" response.

**Step 3: Commit**

```bash
git commit -m "feat(F139): NL config CTA + proposal endpoint [布偶猫🐾]"
```

## Part 4: Integration + Polish

### Task 4.1: Wire TaskRunnerV2 into schedule routes

**Files:**
- Modify: `packages/api/src/index.ts`

**Step 1: Pass TaskRunnerV2 instance to schedule routes**

The app startup already creates TaskRunnerV2 — pass it to scheduleRoutes options along with RunLedger.

**Step 2: Verify end-to-end**

Run: `pnpm --filter @cat-cafe/api test`
Run: `pnpm -r --if-present run build`

**Step 3: Commit**

```bash
git commit -m "feat(F139): wire schedule routes into app startup [布偶猫🐾]"
```

### Task 4.2: Existing task backwards compatibility

**Files:**
- Modify: existing TaskSpec consumers (SummaryCompactionTaskSpec, CiCdCheckTaskSpec, etc.)

**Step 1: Verify existing tasks still work with TriggerSpec union**

All existing tasks use `trigger: { type: 'interval', ms: N }` — this is already a valid TriggerSpec variant. Verify type-check passes.

**Step 2: Run full test suite**

Run: `pnpm --filter @cat-cafe/api test`
Expected: all existing tests pass

**Step 3: Commit (if any changes needed)**

```bash
git commit -m "fix(F139): ensure backwards compat with interval-only tasks [布偶猫🐾]"
```

### Task 4.3: Build + lint + type check

**Step 1: Full gate**

```bash
pnpm check          # Biome lint
pnpm lint           # TypeScript
pnpm -r --if-present run build
pnpm --filter @cat-cafe/api test
pnpm --filter @cat-cafe/web test
```

**Step 2: Fix any issues**

**Step 3: Final commit**

```bash
git commit -m "chore(F139): phase 2 lint + type fixes [布偶猫🐾]"
```

---

## Verification Checklist

- [ ] `pnpm --filter @cat-cafe/api test` — all pass
- [ ] `pnpm --filter @cat-cafe/web test` — all pass (if applicable)
- [ ] `pnpm -r --if-present run build` — success
- [ ] `pnpm check` — Biome clean
- [ ] `pnpm lint` — TypeScript clean
- [ ] Schedule panel renders flat task list matching UX V2
- [ ] Scope filter works (All / Current Thread)
- [ ] No-thread tasks visible in both scopes
- [ ] Cron expression tasks schedule correctly
- [ ] NL input produces reasonable TaskSpec proposals
- [ ] **Design fidelity**: 砚砚 compares implementation screenshot vs UX V2 design

## Design Reference

UX V2 设计稿: `designs/F-schedule-abstraction.pen` frame `zKz75` (y=1821)
铲屎官确认日期: 2026-03-26
关键设计元素:
- Tab bar: 开发 / 知识 / 调度（三个平齐 pill button）
- Scope filter: All / Current Thread（pill toggle）
- Task rows: 8 rows visible, each with colored type tag + name + trigger + status + time
- NL CTA: 底部暖色输入栏
- Footer: 任务统计
- Palette: #FDFAF6 bg, #D4A574 accent, #5C4B3A text, #F5EDE3 section bg, #E8DFD4 divider
