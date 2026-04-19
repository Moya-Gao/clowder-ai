# F168 Community Operations Board — Phase A-C Implementation Plan

**Feature:** F168 — `docs/features/F168-community-ops-board.md`
**Goal:** 把铲屎官从人肉编排器解放成决策者——社区 issue/PR 有台账、有状态、有看板、有结构化 triage 卡片
**Acceptance Criteria:** AC-A1~A6, AC-B1~B8, AC-C1~C10（完整列表见 spec）
**Architecture:** Issue 独立存储 `CommunityIssueStore`（Redis）；PR 投影自 `pr_tracking` TaskItem；Workspace "community" tab 聚合两个 read model；Direction Card 用现有 `RichCardBlock`
**Tech Stack:** TypeScript, Redis, Fastify, React + Zustand, Zod
**前端验证:** Yes — Phase C 涉及 Workspace tab，需 Playwright/Chrome 实测

**NOT building:** Phase D (intake guardian)、自动巡检、多租户

---

## Straight-Line Check

**Finish line B:** 铲屎官打开社区系统 thread → 右侧看板展示所有社区 issue（按状态分组）+ PR（投影 pr_tracking）→ 可手动同步 → 可跳转到工作线程 → 猫猫 triage 时自动发结构化 Direction Card + 双猫交叉

**Terminal schema:**

```typescript
// packages/shared/src/types/community-issue.ts
interface CommunityIssueItem { /* see spec §B.1 */ }
type IssueState = 'unreplied' | 'discussing' | 'pending-decision' | 'accepted' | 'declined' | 'closed';
type PrBoardGroup = 'in-review' | 're-review-needed' | 'has-conflict' | 'completed';

// packages/web/src/stores/chatStore.ts
type WorkspaceMode = 'dev' | 'recall' | 'schedule' | 'tasks' | 'community';
```

**Dependency order:** B (data layer) → A (skill, uses store to understand what to create) → C (UI, reads data)

---

## Phase B: 社区事务台账 + 生命周期跟踪

### Task 1: CommunityIssueItem 类型定义

**Files:**
- Create: `packages/shared/src/types/community-issue.ts`
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Write types**

```typescript
// packages/shared/src/types/community-issue.ts
export type IssueState = 'unreplied' | 'discussing' | 'pending-decision' | 'accepted' | 'declined' | 'closed';
export type IssueType = 'bug' | 'feature' | 'enhancement' | 'question';
export type ReplyState = 'unreplied' | 'replied';
export type ConsensusState = 'discussing' | 'consensus-reached' | 'stalled';
export type PrBoardGroup = 'in-review' | 're-review-needed' | 'has-conflict' | 'completed';

export interface CommunityIssueItem {
  readonly id: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly issueType: IssueType;
  readonly title: string;
  readonly state: IssueState;
  readonly replyState: ReplyState;
  readonly consensusState?: ConsensusState;
  readonly assignedThreadId: string | null;
  readonly assignedCatId: string | null;
  readonly linkedPrNumbers: readonly number[];
  readonly directionCard: Record<string, unknown> | null;
  readonly ownerDecision: 'accepted' | 'declined' | null;
  readonly relatedFeature: string | null;
  readonly lastActivity: { readonly at: number; readonly event: string };
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CreateCommunityIssueInput {
  readonly repo: string;
  readonly issueNumber: number;
  readonly issueType: IssueType;
  readonly title: string;
}

export interface UpdateCommunityIssueInput {
  readonly state?: IssueState;
  readonly replyState?: ReplyState;
  readonly consensusState?: ConsensusState;
  readonly issueType?: IssueType;
  readonly title?: string;
  readonly assignedThreadId?: string | null;
  readonly assignedCatId?: string | null;
  readonly linkedPrNumbers?: readonly number[];
  readonly directionCard?: Record<string, unknown> | null;
  readonly ownerDecision?: 'accepted' | 'declined' | null;
  readonly relatedFeature?: string | null;
  readonly lastActivity?: { readonly at: number; readonly event: string };
}
```

**Step 2: Export from shared types index**

Add to `packages/shared/src/types/index.ts`:
```typescript
// Community Issue types (F168)
export type {
  CommunityIssueItem,
  CreateCommunityIssueInput,
  UpdateCommunityIssueInput,
  IssueState,
  IssueType,
  ReplyState,
  ConsensusState,
  PrBoardGroup,
} from './community-issue.js';
```

**Step 3: Build shared**

Run: `pnpm --filter @cat-cafe/shared build`
Expected: PASS, no type errors

**Step 4: Commit**

```
feat(F168): add CommunityIssueItem types [宪宪/Opus-46🐾]
```

---

### Task 2: CommunityIssueStore interface + Redis implementation

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/ports/CommunityIssueStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/redis/RedisCommunityIssueStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/factories/CommunityIssueStoreFactory.ts`

**Step 1: Write the failing test**

Create: `packages/api/test/community-issue-store.test.ts`

```typescript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createCommunityIssueStore } from '../src/domains/cats/services/stores/factories/CommunityIssueStoreFactory.js';

describe('CommunityIssueStore', () => {
  const store = createCommunityIssueStore(); // in-memory fallback

  it('create + get round-trip', async () => {
    const item = await store.create({
      repo: 'zts212653/clowder-ai',
      issueNumber: 42,
      issueType: 'feature',
      title: 'Support dark mode',
    });
    assert.equal(item.repo, 'zts212653/clowder-ai');
    assert.equal(item.issueNumber, 42);
    assert.equal(item.state, 'unreplied');
    assert.equal(item.replyState, 'unreplied');

    const got = await store.get(item.id);
    assert.deepEqual(got, item);
  });

  it('list by repo', async () => {
    const items = await store.listByRepo('zts212653/clowder-ai');
    assert.ok(items.length >= 1);
    assert.ok(items.every(i => i.repo === 'zts212653/clowder-ai'));
  });

  it('update state', async () => {
    const items = await store.listByRepo('zts212653/clowder-ai');
    const item = items[0];
    const updated = await store.update(item.id, {
      state: 'discussing',
      replyState: 'replied',
    });
    assert.equal(updated?.state, 'discussing');
    assert.equal(updated?.replyState, 'replied');
  });

  it('getByRepoAndNumber dedup', async () => {
    const found = await store.getByRepoAndNumber('zts212653/clowder-ai', 42);
    assert.ok(found);
    assert.equal(found.issueNumber, 42);
  });

  it('delete', async () => {
    const items = await store.listByRepo('zts212653/clowder-ai');
    const deleted = await store.delete(items[0].id);
    assert.equal(deleted, true);
    const got = await store.get(items[0].id);
    assert.equal(got, null);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test packages/api/test/community-issue-store.test.ts`
Expected: FAIL — module not found

**Step 3: Write store interface**

```typescript
// packages/api/src/domains/cats/services/stores/ports/CommunityIssueStore.ts
import type {
  CommunityIssueItem,
  CreateCommunityIssueInput,
  UpdateCommunityIssueInput,
} from '@cat-cafe/shared';

export interface ICommunityIssueStore {
  create(input: CreateCommunityIssueInput): Promise<CommunityIssueItem>;
  get(id: string): Promise<CommunityIssueItem | null>;
  getByRepoAndNumber(repo: string, issueNumber: number): Promise<CommunityIssueItem | null>;
  listByRepo(repo: string): Promise<CommunityIssueItem[]>;
  listAll(): Promise<CommunityIssueItem[]>;
  update(id: string, input: UpdateCommunityIssueInput): Promise<CommunityIssueItem | null>;
  delete(id: string): Promise<boolean>;
}
```

**Step 4: Write in-memory implementation** (for tests + no-Redis fallback)

```typescript
// packages/api/src/domains/cats/services/stores/redis/RedisCommunityIssueStore.ts
// Full Redis implementation following RedisThreadStore pattern:
// - Keys: cat-cafe:community-issue:{id} (Hash), cat-cafe:community-issues:repo:{repo} (Sorted Set)
// - TTL=0 (persistent, 铁律 #5)
// - dedup via repo+issueNumber lookup set: cat-cafe:community-issue:lookup:{repo}:{number} → id
```

**Step 5: Write factory**

```typescript
// factories/CommunityIssueStoreFactory.ts
import type { RedisClient } from '../../../../../infrastructure/redis.js';
import { RedisCommunityIssueStore } from '../redis/RedisCommunityIssueStore.js';
import { InMemoryCommunityIssueStore } from '../redis/RedisCommunityIssueStore.js';

export function createCommunityIssueStore(redis?: RedisClient): ICommunityIssueStore {
  return redis
    ? new RedisCommunityIssueStore(redis)
    : new InMemoryCommunityIssueStore();
}
```

**Step 6: Run test, verify pass**

Run: `node --test packages/api/test/community-issue-store.test.ts`
Expected: PASS

**Step 7: Commit**

```
feat(F168): CommunityIssueStore — interface + Redis + in-memory impl [宪宪/Opus-46🐾]
```

---

### Task 3: derivePrGroup utility

**Files:**
- Create: `packages/api/src/domains/community/derivePrGroup.ts`
- Create: `packages/api/test/derive-pr-group.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { derivePrGroup } from '../src/domains/community/derivePrGroup.js';

describe('derivePrGroup', () => {
  it('completed when closedAt set', () => {
    assert.equal(derivePrGroup({ closedAt: Date.now() }), 'completed');
  });
  it('re-review-needed: new commit + CI pass', () => {
    assert.equal(derivePrGroup({
      ci: { headSha: 'abc', lastFingerprint: 'old:pass', lastBucket: 'pass' },
    }), 're-review-needed');
  });
  it('in-review: same commit', () => {
    assert.equal(derivePrGroup({
      ci: { headSha: 'abc', lastFingerprint: 'abc:pass', lastBucket: 'pass' },
    }), 'in-review');
  });
  it('has-conflict', () => {
    assert.equal(derivePrGroup({
      conflict: { mergeState: 'CONFLICTING' },
    }), 'has-conflict');
  });
  it('default in-review', () => {
    assert.equal(derivePrGroup({}), 'in-review');
  });
});
```

**Step 2: Implement** — copy `derivePrGroup` from spec pseudocode

**Step 3: Run test, verify pass**

Run: `node --test packages/api/test/derive-pr-group.test.ts`

**Step 4: Commit**

```
feat(F168): derivePrGroup — PR board grouping logic [宪宪/Opus-46🐾]
```

---

### Task 4: Community Board API routes

**Files:**
- Create: `packages/api/src/routes/community-issues.ts`
- Modify: `packages/api/src/routes/index.ts` (add export)
- Modify: `packages/api/src/index.ts` (register route + inject store)

**Step 1: Write route module**

Endpoints:
- `POST /api/community-issues` — create item (manual "发送给系统猫")
- `GET /api/community-issues?repo=xxx` — list by repo
- `GET /api/community-issues/:id` — get single
- `PATCH /api/community-issues/:id` — update state/fields
- `DELETE /api/community-issues/:id` — delete
- `GET /api/community-board?repo=xxx` — aggregated board view (issues + PR projections)
- `POST /api/community-board/sync` — manual sync trigger (fetches GitHub state)

Follow `tasks.ts` pattern: Zod schemas, FastifyPluginAsync, WebSocket broadcast on state changes.

**Step 2: Export from routes/index.ts**

```typescript
export { communityIssueRoutes } from './community-issues.js';
```

**Step 3: Register in main index.ts**

```typescript
const communityIssueStore = createCommunityIssueStore(redis);
// ...
await app.register(communityIssueRoutes, { communityIssueStore, taskStore, socketManager });
```

**Step 4: Write integration test**

Create: `packages/api/test/community-issues-routes.test.ts`

Test: POST create → GET list → PATCH update → GET board (verify PR projection) → DELETE

**Step 5: Run tests, verify pass**

Run: `node --test packages/api/test/community-issues-routes.test.ts`

**Step 6: Commit**

```
feat(F168): community issues API routes + board aggregation [宪宪/Opus-46🐾]
```

---

## Phase A: 定方向卡片 + Inbox 首猫分拣

### Task 5: Direction Card template

**Files:**
- Create: `cat-cafe-skills/refs/direction-card-template.md`
- Modify: `cat-cafe-skills/refs/repo-inbox.md` (Step 4 Route 里引用新模板)
- Modify: `cat-cafe-skills/opensource-ops/SKILL.md` (Scene A 引用新卡片)

**Step 1: Write Direction Card template**

```markdown
// cat-cafe-skills/refs/direction-card-template.md
# Direction Card 模板（F168 Phase A）

## 用法

triage 完成后，用 `cat_cafe_create_rich_block` 向 Inbox thread 发一张结构化 card：

​```json
{
  "kind": "card",
  "v": 1,
  "id": "direction-{repo}-{issueNumber}-{timestamp}",
  "title": "#{issueNumber} {issue 标题}",
  "tone": "info|warning|danger",
  "bodyMarkdown": "{一句话说明这是什么}",
  "fields": [
    { "label": "来源", "value": "{repo}#{issueNumber} {issue|PR}" },
    { "label": "类型", "value": "{bug|feature|enhancement}" },
    { "label": "关联 feat", "value": "{Fxxx 或 '无'}" },
    { "label": "Q1 愿景", "value": "PASS|WARN|FAIL" },
    { "label": "Q2 功能冲突", "value": "PASS|WARN|FAIL" },
    { "label": "Q3 需求度", "value": "PASS|WARN|FAIL" },
    { "label": "Q4 技术栈", "value": "PASS|WARN|FAIL" },
    { "label": "Q5 债务", "value": "PASS|WARN|FAIL" },
    { "label": "建议", "value": "WELCOME|NEEDS-DISCUSSION|POLITELY-DECLINE" },
    { "label": "需要铲屎官", "value": "{决策点描述 或 '猫自决'}" }
  ]
}
​```

## tone 映射

- WELCOME → `info`
- NEEDS-DISCUSSION → `warning`
- POLITELY-DECLINE → `danger`

## 双猫交叉

发完卡片后，如果不是明确 bugfix，用 `multi_mention` @ 第二只猫：
"请独立评估这个 issue 的方向，看完后在 Inbox 发你的 Direction Card。"
```

**Step 2: Update repo-inbox.md**

在 Step 4 Route 的 WELCOME 分支加：
```
→ 发 Direction Card（模板见 refs/direction-card-template.md）
→ 非 bugfix：multi_mention 第二只猫独立评估
→ 两猫卡片都到了 → 汇总 → 标记是否需要铲屎官拍板
```

**Step 3: Update SKILL.md Scene A**

在 Scene A Issue Triage 的 Step 2 后加 Direction Card 发送步骤。

**Step 4: Commit**

```
feat(F168): Direction Card template + repo-inbox/SKILL.md integration [宪宪/Opus-46🐾]
```

---

## Phase C: 管理视图（Workspace tab）

### Task 6: Extend WorkspaceMode + Thread metadata

**Files:**
- Modify: `packages/web/src/stores/chatStore.ts` (~line 642-644)
- Modify: `packages/shared/src/types/thread.ts` or `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts` (~line 91)
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisThreadStore.ts` (hydrate/serialize)

**Step 1: Extend WorkspaceMode**

In `chatStore.ts`, change:
```typescript
// Before
workspaceMode: 'dev' | 'recall' | 'schedule' | 'tasks';
// After
workspaceMode: 'dev' | 'recall' | 'schedule' | 'tasks' | 'community';
```

Update `setWorkspaceMode` signature to match.

**Step 2: Add preferredWorkspaceMode to Thread**

In ThreadStore.ts ports, add to `Thread` interface:
```typescript
preferredWorkspaceMode?: 'dev' | 'recall' | 'schedule' | 'tasks' | 'community';
```

Add hydration/serialization in RedisThreadStore.

**Step 3: Build shared + verify types**

Run: `pnpm --filter @cat-cafe/shared build && pnpm lint`
Expected: PASS

**Step 4: Commit**

```
feat(F168): extend WorkspaceMode + Thread.preferredWorkspaceMode [宪宪/Opus-46🐾]
```

---

### Task 7: CommunityPanel component

**Files:**
- Create: `packages/web/src/components/CommunityPanel.tsx`

**Step 1: Write CommunityPanel**

Structure (following existing panel patterns):
```tsx
// CommunityPanel.tsx
export function CommunityPanel() {
  // State: issues, prItems, loading, selectedRepo, collapsedGroups
  // Fetch: GET /api/community-board?repo={selectedRepo}
  // Auto-refresh: 5 min interval + manual sync button
  // Render: repo selector → Issue groups → PR groups
  // Each item row: clickable → navigate to thread
}
```

Key sections:
1. **Header**: repo dropdown + sync button
2. **Issues section**: grouped by state (unreplied → discussing → pending-decision → accepted → declined)
3. **PR section**: grouped by derivePrGroup (in-review → re-review-needed → has-conflict → completed)
4. **Each item row**: one-line summary, clickable to navigate to thread
5. **"发送给系统猫" button**: on unreplied issues, calls POST /api/community-issues/:id/dispatch

All icons use SVG (from café icon set), no emoji.

**Step 2: Commit**

```
feat(F168): CommunityPanel — community board Workspace component [宪宪/Opus-46🐾]
```

---

### Task 8: Wire CommunityPanel into WorkspacePanel + auto-switch

**Files:**
- Modify: `packages/web/src/components/WorkspacePanel.tsx` (~line 779, mode routing)
- Modify: `packages/web/src/hooks/useWorkspaceNavigate.ts` (add community support)

**Step 1: Add community branch to WorkspacePanel**

In the mode routing section (~line 779):
```tsx
{workspaceMode === 'community' ? (
  <CommunityPanel />
) : workspaceMode === 'recall' ? (
  // ... existing
```

Add "社区" tab button to the tab bar (~line 703).

**Step 2: Auto-switch on thread open**

When `currentThreadId` changes and the new thread has `preferredWorkspaceMode === 'community'`, auto-set `workspaceMode` to `'community'`.

**Step 3: Add navigate support**

In `useWorkspaceNavigate.ts`, add `'community'` to the action handler.

**Step 4: Test in browser**

1. Create a thread with `preferredWorkspaceMode: 'community'`
2. Open it → verify right panel auto-switches to "社区" tab
3. Verify board loads (may be empty initially)
4. Click an item → verify thread navigation works

**Step 5: Commit**

```
feat(F168): wire CommunityPanel into WorkspacePanel + auto-switch [宪宪/Opus-46🐾]
```

---

## Verification Checklist

After all tasks, verify against AC:

| AC | Task | Verify |
|----|------|--------|
| AC-B1 | Task 2 | `node --test` store tests pass, TTL=0 |
| AC-B2 | Task 2 | Store tests cover 6 states + replyState/consensusState |
| AC-B3 | Task 3+4 | Board endpoint returns PR projections from pr_tracking |
| AC-B4 | Task 2 | linkedPrNumbers field in store tests |
| AC-B5 | Task 4 | POST /api/community-issues creates item |
| AC-B6 | Task 3 | derivePrGroup correctly groups by CI/commit state |
| AC-B7 | Task 2+4 | repo param in all queries, not hardcoded |
| AC-B8 | Task 7 | Sync button + 5min auto-refresh in CommunityPanel |
| AC-A1 | Task 5 | Direction Card template exists, skill references it |
| AC-A2 | Task 5 | Card fields include all required info |
| AC-A3 | Task 5 | Skill instructs multi_mention for dual-cat review |
| AC-A4 | Task 5 | Skill describes verdict aggregation logic |
| AC-A5 | Task 5 | Skill describes feat thread routing |
| AC-A6 | Task 5 | Skill describes thread creation for new items |
| AC-C1 | Task 8 | Community system thread exists |
| AC-C2 | Task 6+8 | WorkspaceMode extended, CommunityPanel renders |
| AC-C3 | Task 6+8 | preferredWorkspaceMode auto-switches panel |
| AC-C4 | Task 7 | Issues + PRs displayed in separate sections |
| AC-C5 | Task 7 | Each item shows one-line summary |
| AC-C6 | Task 7+8 | Click item → navigate to thread |
| AC-C7 | Task 7 | Repo dropdown + state filter |
| AC-C8 | Task 7 | Sync button + auto-refresh |
| AC-C9 | Task 7 | SVG icons, no emoji |
| AC-C10 | Deferred | Pencil design — do before Task 7 implementation |

**Note:** AC-C10 (Pencil design) should be done before Task 7 implementation. Load `pencil-design` skill to create the .pen file for CommunityPanel before coding.
