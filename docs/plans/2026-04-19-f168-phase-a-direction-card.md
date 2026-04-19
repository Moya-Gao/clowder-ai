# F168 Phase A: 定方向卡片 + Inbox 首猫分拣 — Implementation Plan

**Feature:** F168 — `docs/features/F168-community-ops-board.md`
**Goal:** 铲屎官点"发送给系统猫"后，系统自动编排 triage：首猫评估 → 发 Direction Card → 双猫交叉 → 共识 → 路由到工作线程
**Acceptance Criteria:**
- AC-A1: 首猫 triage 后自动向 Inbox 发结构化定方向卡片（rich block）
- AC-A2: 定方向卡片包含：事项来源、关联 feat、5 问结果、猫建议、铲屎官决策点
- AC-A3: 首猫自动 @ 第二只猫交叉评估方向（非 bugfix 场景）
- AC-A4: 两猫意见汇总后，自动标记是否需要铲屎官拍板
- AC-A5: 已有 feat 事项自动路由到该 feat thread 并 @ 负责猫
- AC-A6: 全新事项经铲屎官 OK 后，首猫创建新 thread 并分配负责猫
**Architecture:** Dispatch → system message @cat → cat triages (skill-driven) → cat calls triage-complete API → orchestrator auto-triggers second cat via multi_mention (non-bugfix) → consensus → routing. Cat-side intelligence lives in `opensource-ops` skill, backend orchestrates the flow.
**Tech Stack:** TypeScript, Fastify, Zod, node:test
**前端验证:** No — Phase A is backend orchestration; UI dispatch button already exists from Phase C

**NOT building:** Auto-crawl/discovery (manual trigger only), intake hardening (Phase D), frontend UI changes (dispatch button exists), cat-side triage logic (already in opensource-ops skill)

---

## Straight-Line Check

**Finish line B:** 铲屎官在社区看板点"发送给系统猫" → 系统在社区 thread 发一条 triage 请求 @猫 → 猫 triage 完毕调 API 上报 → 系统自动 @ 第二只猫 → 双猫完毕 → 共识决定 → 路由到 feat thread 或新建 thread

**Terminal schema:**

```typescript
// packages/shared/src/types/community-issue.ts (extend existing)
interface TriageEntry {
  catId: string;
  verdict: Verdict;
  questions: QuestionResult[];
  reasonCode?: string;
  relatedFeature?: string;
  timestamp: number;
}
type Verdict = 'WELCOME' | 'NEEDS-DISCUSSION' | 'POLITELY-DECLINE';
type QuestionResult = { id: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5'; result: 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN' };

interface DirectionCardPayload {
  entries: TriageEntry[];
  consensus?: ConsensusResult;
}
interface ConsensusResult {
  verdict: Verdict;
  needsOwner: boolean;
  reasonCode?: string;
  resolvedAt: number;
}
```

**Dependency order:** Task 1 (types) → Task 2 (consensus logic) → Task 3 (orchestrator) → Task 4 (API) → Task 5 (dispatch integration)

---

## Task 1: Triage Entry Types

**Files:**
- Modify: `packages/shared/src/types/community-issue.ts`
- Modify: `packages/shared/src/types/index.ts` (re-export new types)

**Step 1: Write types**

Add to `packages/shared/src/types/community-issue.ts`:

```typescript
export type Verdict = 'WELCOME' | 'NEEDS-DISCUSSION' | 'POLITELY-DECLINE';
export type QuestionId = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5';
export type QuestionGrade = 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';

export interface QuestionResult {
  readonly id: QuestionId;
  readonly result: QuestionGrade;
}

export interface TriageEntry {
  readonly catId: string;
  readonly verdict: Verdict;
  readonly questions: readonly QuestionResult[];
  readonly reasonCode?: string;
  readonly relatedFeature?: string;
  readonly timestamp: number;
}

export interface ConsensusResult {
  readonly verdict: Verdict;
  readonly needsOwner: boolean;
  readonly reasonCode?: string;
  readonly resolvedAt: number;
}

export interface DirectionCardPayload {
  readonly entries: readonly TriageEntry[];
  readonly consensus?: ConsensusResult;
}
```

**Step 2: Re-export from index**

Add re-exports to `packages/shared/src/types/index.ts`.

**Step 3: Build shared package**

Run: `pnpm --filter @cat-cafe/shared build`
Expected: exit 0

**Step 4: Commit**

```bash
git add packages/shared/src/types/community-issue.ts packages/shared/src/types/index.ts
git commit -m "feat(F168): add triage entry + consensus types for Phase A"
```

---

## Task 2: Consensus Logic (Pure Function)

**Files:**
- Create: `packages/api/src/domains/community/resolveConsensus.ts`
- Create: `packages/api/test/community-consensus.test.js`

**Step 1: Write failing tests**

```javascript
// packages/api/test/community-consensus.test.js
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConsensus } from '../src/domains/community/resolveConsensus.js';

describe('resolveConsensus', () => {
  const makeEntry = (catId, verdict, reasonCode) => ({
    catId,
    verdict,
    questions: [
      { id: 'Q1', result: 'PASS' },
      { id: 'Q2', result: 'PASS' },
      { id: 'Q3', result: 'PASS' },
      { id: 'Q4', result: 'PASS' },
      { id: 'Q5', result: 'PASS' },
    ],
    reasonCode,
    timestamp: Date.now(),
  });

  test('both WELCOME → consensus WELCOME, needsOwner false', () => {
    const result = resolveConsensus([
      makeEntry('opus', 'WELCOME'),
      makeEntry('codex', 'WELCOME'),
    ]);
    assert.equal(result.verdict, 'WELCOME');
    assert.equal(result.needsOwner, false);
  });

  test('both POLITELY-DECLINE → consensus POLITELY-DECLINE, needsOwner false', () => {
    const result = resolveConsensus([
      makeEntry('opus', 'POLITELY-DECLINE', 'OUT_OF_SCOPE'),
      makeEntry('codex', 'POLITELY-DECLINE', 'OUT_OF_SCOPE'),
    ]);
    assert.equal(result.verdict, 'POLITELY-DECLINE');
    assert.equal(result.needsOwner, false);
  });

  test('WELCOME vs POLITELY-DECLINE → needsOwner true', () => {
    const result = resolveConsensus([
      makeEntry('opus', 'WELCOME'),
      makeEntry('codex', 'POLITELY-DECLINE', 'STACK_MISFIT'),
    ]);
    assert.equal(result.needsOwner, true);
  });

  test('WELCOME vs NEEDS-DISCUSSION → needsOwner true', () => {
    const result = resolveConsensus([
      makeEntry('opus', 'WELCOME'),
      makeEntry('codex', 'NEEDS-DISCUSSION'),
    ]);
    assert.equal(result.needsOwner, true);
  });

  test('both NEEDS-DISCUSSION → needsOwner true', () => {
    const result = resolveConsensus([
      makeEntry('opus', 'NEEDS-DISCUSSION'),
      makeEntry('codex', 'NEEDS-DISCUSSION'),
    ]);
    assert.equal(result.needsOwner, true);
    assert.equal(result.verdict, 'NEEDS-DISCUSSION');
  });

  test('single entry (bugfix shortcut) → uses that entry verdict, needsOwner false', () => {
    const result = resolveConsensus([makeEntry('opus', 'WELCOME')]);
    assert.equal(result.verdict, 'WELCOME');
    assert.equal(result.needsOwner, false);
  });

  test('single entry POLITELY-DECLINE → needsOwner false (bug = cat decides)', () => {
    const result = resolveConsensus([makeEntry('opus', 'POLITELY-DECLINE', 'DUPLICATE')]);
    assert.equal(result.verdict, 'POLITELY-DECLINE');
    assert.equal(result.needsOwner, false);
  });

  test('preserves reasonCode from DECLINE entries', () => {
    const result = resolveConsensus([
      makeEntry('opus', 'POLITELY-DECLINE', 'OUT_OF_SCOPE'),
      makeEntry('codex', 'POLITELY-DECLINE', 'STACK_MISFIT'),
    ]);
    assert.ok(result.reasonCode);
  });

  test('empty entries throws', () => {
    assert.throws(() => resolveConsensus([]), /at least one/);
  });
});
```

**Step 2: Run tests to verify failure**

Run: `node --test packages/api/test/community-consensus.test.js`
Expected: FAIL (module not found)

**Step 3: Implement resolveConsensus**

```typescript
// packages/api/src/domains/community/resolveConsensus.ts
import type { ConsensusResult, TriageEntry, Verdict } from '@cat-cafe/shared';

export function resolveConsensus(entries: readonly TriageEntry[]): ConsensusResult {
  if (entries.length === 0) throw new Error('resolveConsensus requires at least one entry');

  if (entries.length === 1) {
    return {
      verdict: entries[0].verdict,
      needsOwner: false,
      reasonCode: entries[0].reasonCode,
      resolvedAt: Date.now(),
    };
  }

  const [a, b] = entries;
  const same = a.verdict === b.verdict;

  if (same && a.verdict === 'WELCOME') {
    return { verdict: 'WELCOME', needsOwner: false, resolvedAt: Date.now() };
  }

  if (same && a.verdict === 'POLITELY-DECLINE') {
    return {
      verdict: 'POLITELY-DECLINE',
      needsOwner: false,
      reasonCode: a.reasonCode ?? b.reasonCode,
      resolvedAt: Date.now(),
    };
  }

  // Any disagreement or both NEEDS-DISCUSSION → escalate to owner
  const verdict: Verdict = entries.some((e) => e.verdict === 'POLITELY-DECLINE')
    ? 'NEEDS-DISCUSSION'
    : entries.some((e) => e.verdict === 'NEEDS-DISCUSSION')
      ? 'NEEDS-DISCUSSION'
      : 'NEEDS-DISCUSSION';

  return {
    verdict,
    needsOwner: true,
    reasonCode: entries.find((e) => e.reasonCode)?.reasonCode,
    resolvedAt: Date.now(),
  };
}
```

**Step 4: Run tests to verify pass**

Run: `node --test packages/api/test/community-consensus.test.js`
Expected: 9/9 pass

**Step 5: Commit**

```bash
git add packages/api/src/domains/community/resolveConsensus.ts packages/api/test/community-consensus.test.js
git commit -m "feat(F168): consensus logic for dual-cat triage (Phase A)"
```

---

## Task 3: Triage Orchestrator Service

**Files:**
- Create: `packages/api/src/domains/community/TriageOrchestrator.ts`
- Create: `packages/api/test/triage-orchestrator.test.js`

The orchestrator manages the flow: record entry → trigger second cat → resolve consensus → update issue → route.

**Step 1: Write failing tests**

```javascript
// packages/api/test/triage-orchestrator.test.js
import { describe, test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { TriageOrchestrator } from '../src/domains/community/TriageOrchestrator.js';

describe('TriageOrchestrator', () => {
  let orchestrator;
  let mockIssueStore;
  let mockMessageStore;
  let mockThreadStore;

  const baseIssue = {
    id: 'ci_1', repo: 'org/repo', issueNumber: 42,
    issueType: 'feature', title: 'Add SSO', state: 'discussing',
    replyState: 'unreplied', assignedThreadId: null,
    assignedCatId: null, linkedPrNumbers: [], directionCard: null,
    ownerDecision: null, relatedFeature: null,
    lastActivity: { at: Date.now(), event: 'dispatched' },
    createdAt: Date.now(), updatedAt: Date.now(),
  };

  const makeEntry = (catId, verdict) => ({
    catId, verdict,
    questions: [
      { id: 'Q1', result: 'PASS' }, { id: 'Q2', result: 'PASS' },
      { id: 'Q3', result: 'PASS' }, { id: 'Q4', result: 'PASS' },
      { id: 'Q5', result: 'PASS' },
    ],
    timestamp: Date.now(),
  });

  beforeEach(() => {
    mockIssueStore = {
      get: mock.fn(async () => ({ ...baseIssue })),
      update: mock.fn(async (id, patch) => ({ ...baseIssue, ...patch })),
    };
    mockMessageStore = {
      append: mock.fn(async (input) => ({ id: 'msg_1', ...input })),
    };
    mockThreadStore = {
      list: mock.fn(async () => []),
      create: mock.fn(async (userId, title) => ({
        id: 'thread_new', title, userId, createdAt: Date.now(),
      })),
      updatePreferredCats: mock.fn(async () => {}),
    };
    orchestrator = new TriageOrchestrator({
      communityIssueStore: mockIssueStore,
      messageStore: mockMessageStore,
      threadStore: mockThreadStore,
    });
  });

  test('recordTriageEntry stores first entry in directionCard', async () => {
    const entry = makeEntry('opus', 'WELCOME');
    const result = await orchestrator.recordTriageEntry('ci_1', entry);
    assert.equal(result.action, 'await-second-cat');
    const updateCall = mockIssueStore.update.mock.calls[0];
    const payload = updateCall.arguments[1].directionCard;
    assert.equal(payload.entries.length, 1);
    assert.equal(payload.entries[0].catId, 'opus');
  });

  test('recordTriageEntry for bugfix skips second cat', async () => {
    mockIssueStore.get = mock.fn(async () => ({
      ...baseIssue, issueType: 'bug',
    }));
    const entry = makeEntry('opus', 'WELCOME');
    const result = await orchestrator.recordTriageEntry('ci_1', entry);
    assert.equal(result.action, 'resolved');
    assert.ok(result.consensus);
    assert.equal(result.consensus.needsOwner, false);
  });

  test('recordTriageEntry for second cat resolves consensus', async () => {
    const firstEntry = makeEntry('opus', 'WELCOME');
    mockIssueStore.get = mock.fn(async () => ({
      ...baseIssue,
      directionCard: { entries: [firstEntry] },
    }));
    const secondEntry = makeEntry('codex', 'WELCOME');
    const result = await orchestrator.recordTriageEntry('ci_1', secondEntry);
    assert.equal(result.action, 'resolved');
    assert.equal(result.consensus.verdict, 'WELCOME');
    assert.equal(result.consensus.needsOwner, false);
  });

  test('disagreement sets needsOwner and state to pending-decision', async () => {
    const firstEntry = makeEntry('opus', 'WELCOME');
    mockIssueStore.get = mock.fn(async () => ({
      ...baseIssue,
      directionCard: { entries: [firstEntry] },
    }));
    const secondEntry = makeEntry('codex', 'POLITELY-DECLINE');
    secondEntry.reasonCode = 'STACK_MISFIT';
    const result = await orchestrator.recordTriageEntry('ci_1', secondEntry);
    assert.equal(result.consensus.needsOwner, true);
    const updateCall = mockIssueStore.update.mock.calls[0];
    assert.equal(updateCall.arguments[1].state, 'pending-decision');
  });

  test('routeAccepted with relatedFeature assigns to existing thread', async () => {
    mockThreadStore.list = mock.fn(async () => [
      { id: 'thread_f056', title: 'F056 thread', backlogItemId: 'F056' },
    ]);
    const result = await orchestrator.routeAccepted('ci_1', 'F056', 'user_1');
    const updateCall = mockIssueStore.update.mock.calls[0];
    assert.equal(updateCall.arguments[1].state, 'accepted');
  });

  test('routeAccepted without relatedFeature creates new thread', async () => {
    const result = await orchestrator.routeAccepted('ci_1', null, 'user_1');
    assert.equal(mockThreadStore.create.mock.callCount(), 1);
    const updateCall = mockIssueStore.update.mock.calls[0];
    assert.equal(updateCall.arguments[1].state, 'accepted');
    assert.ok(updateCall.arguments[1].assignedThreadId);
  });

  test('routeDeclined updates state to declined', async () => {
    await orchestrator.routeDeclined('ci_1');
    const updateCall = mockIssueStore.update.mock.calls[0];
    assert.equal(updateCall.arguments[1].state, 'declined');
  });
});
```

**Step 2: Run tests to verify failure**

Run: `node --test packages/api/test/triage-orchestrator.test.js`
Expected: FAIL (module not found)

**Step 3: Implement TriageOrchestrator**

```typescript
// packages/api/src/domains/community/TriageOrchestrator.ts
import type { ICommunityIssueStore } from '../cats/services/stores/ports/CommunityIssueStore.js';
import type { IMessageStore } from '../cats/services/stores/ports/MessageStore.js';
import type { IThreadStore } from '../cats/services/stores/ports/ThreadStore.js';
import type {
  ConsensusResult, DirectionCardPayload, TriageEntry,
} from '@cat-cafe/shared';
import { resolveConsensus } from './resolveConsensus.js';

interface TriageOrchestratorDeps {
  communityIssueStore: Pick<ICommunityIssueStore, 'get' | 'update'>;
  messageStore: Pick<IMessageStore, 'append'>;
  threadStore: Pick<IThreadStore, 'list' | 'create' | 'updatePreferredCats'>;
}

type TriageAction =
  | { action: 'await-second-cat'; issueId: string }
  | { action: 'resolved'; issueId: string; consensus: ConsensusResult }
  | { action: 'error'; reason: string };

export class TriageOrchestrator {
  constructor(private readonly deps: TriageOrchestratorDeps) {}

  async recordTriageEntry(issueId: string, entry: TriageEntry): Promise<TriageAction> {
    const issue = await this.deps.communityIssueStore.get(issueId);
    if (!issue) return { action: 'error', reason: 'Issue not found' };

    const existing: DirectionCardPayload = (issue.directionCard as DirectionCardPayload) ?? { entries: [] };
    const entries = [...existing.entries, entry];
    const isBugfix = issue.issueType === 'bug';
    const isSecondEntry = existing.entries.length >= 1;

    if (!isSecondEntry && !isBugfix) {
      await this.deps.communityIssueStore.update(issueId, {
        directionCard: { entries },
        lastActivity: { at: Date.now(), event: `triage-by-${entry.catId}` },
      });
      return { action: 'await-second-cat', issueId };
    }

    const consensus = resolveConsensus(entries);
    const newState = consensus.needsOwner ? 'pending-decision' as const : undefined;

    await this.deps.communityIssueStore.update(issueId, {
      directionCard: { entries, consensus },
      ...(newState && { state: newState }),
      ...(consensus.verdict === 'WELCOME' && !consensus.needsOwner && { state: 'accepted' as const }),
      ...(consensus.verdict === 'POLITELY-DECLINE' && !consensus.needsOwner && { state: 'declined' as const }),
      consensusState: consensus.needsOwner ? 'discussing' : 'consensus-reached',
      relatedFeature: entry.relatedFeature ?? issue.relatedFeature,
      lastActivity: { at: Date.now(), event: 'consensus-resolved' },
    });

    return { action: 'resolved', issueId, consensus };
  }

  async routeAccepted(issueId: string, relatedFeature: string | null, userId: string): Promise<void> {
    const issue = await this.deps.communityIssueStore.get(issueId);
    if (!issue) return;

    if (relatedFeature) {
      await this.deps.communityIssueStore.update(issueId, {
        state: 'accepted',
        relatedFeature,
        lastActivity: { at: Date.now(), event: `routed-to-${relatedFeature}` },
      });
      return;
    }

    const thread = await this.deps.threadStore.create(userId, `Community: ${issue.title}`);
    await this.deps.communityIssueStore.update(issueId, {
      state: 'accepted',
      assignedThreadId: thread.id,
      lastActivity: { at: Date.now(), event: `thread-created-${thread.id}` },
    });
  }

  async routeDeclined(issueId: string): Promise<void> {
    await this.deps.communityIssueStore.update(issueId, {
      state: 'declined',
      lastActivity: { at: Date.now(), event: 'declined' },
    });
  }
}
```

**Step 4: Run tests to verify pass**

Run: `node --test packages/api/test/triage-orchestrator.test.js`
Expected: all pass

**Step 5: Commit**

```bash
git add packages/api/src/domains/community/TriageOrchestrator.ts packages/api/test/triage-orchestrator.test.js
git commit -m "feat(F168): triage orchestrator — entry recording, consensus, routing"
```

---

## Task 4: API Endpoints (triage-complete + dispatch enhancement)

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts`
- Modify: `packages/api/test/community-issues-routes.test.js`

### 4a: POST /api/community-issues/:id/triage-complete

New endpoint: cat calls this after running 5-question triage, passing verdict + questions.

**Step 1: Write failing tests**

Add to `packages/api/test/community-issues-routes.test.js`:

```javascript
test('POST /api/community-issues/:id/triage-complete records first triage entry', async () => {
  const app = await createApp();
  const issue = await createIssue(app, { issueType: 'feature' });
  await app.inject({ method: 'POST', url: `/api/community-issues/${issue.id}/dispatch` });

  const res = await app.inject({
    method: 'POST',
    url: `/api/community-issues/${issue.id}/triage-complete`,
    payload: {
      catId: 'opus',
      verdict: 'WELCOME',
      questions: [
        { id: 'Q1', result: 'PASS' }, { id: 'Q2', result: 'PASS' },
        { id: 'Q3', result: 'PASS' }, { id: 'Q4', result: 'PASS' },
        { id: 'Q5', result: 'PASS' },
      ],
    },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.action, 'await-second-cat');
});

test('POST /api/community-issues/:id/triage-complete resolves bugfix immediately', async () => {
  const app = await createApp();
  const issue = await createIssue(app, { issueType: 'bug' });
  await app.inject({ method: 'POST', url: `/api/community-issues/${issue.id}/dispatch` });

  const res = await app.inject({
    method: 'POST',
    url: `/api/community-issues/${issue.id}/triage-complete`,
    payload: {
      catId: 'opus',
      verdict: 'WELCOME',
      questions: [
        { id: 'Q1', result: 'PASS' }, { id: 'Q2', result: 'PASS' },
        { id: 'Q3', result: 'PASS' }, { id: 'Q4', result: 'PASS' },
        { id: 'Q5', result: 'PASS' },
      ],
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().action, 'resolved');
});

test('POST /api/community-issues/:id/triage-complete second entry resolves consensus', async () => {
  const app = await createApp();
  const issue = await createIssue(app, { issueType: 'feature' });
  await app.inject({ method: 'POST', url: `/api/community-issues/${issue.id}/dispatch` });

  // First cat
  await app.inject({
    method: 'POST',
    url: `/api/community-issues/${issue.id}/triage-complete`,
    payload: {
      catId: 'opus', verdict: 'WELCOME',
      questions: [
        { id: 'Q1', result: 'PASS' }, { id: 'Q2', result: 'PASS' },
        { id: 'Q3', result: 'PASS' }, { id: 'Q4', result: 'PASS' },
        { id: 'Q5', result: 'PASS' },
      ],
    },
  });

  // Second cat
  const res = await app.inject({
    method: 'POST',
    url: `/api/community-issues/${issue.id}/triage-complete`,
    payload: {
      catId: 'codex', verdict: 'WELCOME',
      questions: [
        { id: 'Q1', result: 'PASS' }, { id: 'Q2', result: 'PASS' },
        { id: 'Q3', result: 'PASS' }, { id: 'Q4', result: 'PASS' },
        { id: 'Q5', result: 'PASS' },
      ],
    },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.action, 'resolved');
  assert.equal(body.consensus.verdict, 'WELCOME');
  assert.equal(body.consensus.needsOwner, false);
});

test('triage-complete rejects if issue not in discussing state', async () => {
  const app = await createApp();
  const issue = await createIssue(app);
  // Issue is still 'unreplied', not dispatched
  const res = await app.inject({
    method: 'POST',
    url: `/api/community-issues/${issue.id}/triage-complete`,
    payload: {
      catId: 'opus', verdict: 'WELCOME',
      questions: [
        { id: 'Q1', result: 'PASS' }, { id: 'Q2', result: 'PASS' },
        { id: 'Q3', result: 'PASS' }, { id: 'Q4', result: 'PASS' },
        { id: 'Q5', result: 'PASS' },
      ],
    },
  });
  assert.equal(res.statusCode, 409);
});

test('triage-complete validates payload schema', async () => {
  const app = await createApp();
  const issue = await createIssue(app);
  await app.inject({ method: 'POST', url: `/api/community-issues/${issue.id}/dispatch` });
  const res = await app.inject({
    method: 'POST',
    url: `/api/community-issues/${issue.id}/triage-complete`,
    payload: { catId: 'opus' }, // missing verdict + questions
  });
  assert.equal(res.statusCode, 400);
});
```

**Step 2: Run tests to verify failure**

Run: `node --test packages/api/test/community-issues-routes.test.js`
Expected: new tests FAIL (route not found)

**Step 3: Implement endpoint**

Add to `packages/api/src/routes/community-issues.ts`:

```typescript
// Schema for triage-complete
const triageCompleteSchema = z.object({
  catId: z.string().min(1),
  verdict: z.enum(['WELCOME', 'NEEDS-DISCUSSION', 'POLITELY-DECLINE']),
  questions: z.array(z.object({
    id: z.enum(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']),
    result: z.enum(['PASS', 'WARN', 'FAIL', 'UNKNOWN']),
  })).length(5),
  reasonCode: z.string().optional(),
  relatedFeature: z.string().nullable().optional(),
});

// Endpoint
app.post('/api/community-issues/:id/triage-complete', async (request, reply) => {
  const { id } = request.params as { id: string };
  const result = triageCompleteSchema.safeParse(request.body);
  if (!result.success) {
    reply.status(400);
    return { error: 'Invalid request body', details: result.error.issues };
  }

  const issue = await communityIssueStore.get(id);
  if (!issue) {
    reply.status(404);
    return { error: 'Community issue not found' };
  }
  if (issue.state !== 'discussing' && issue.state !== 'pending-decision') {
    reply.status(409);
    return { error: 'Issue not in triageable state', currentState: issue.state };
  }

  const entry = { ...result.data, timestamp: Date.now() };
  const orchestrator = new TriageOrchestrator({
    communityIssueStore, messageStore: opts.messageStore, threadStore: opts.threadStore,
  });
  const triageResult = await orchestrator.recordTriageEntry(id, entry);
  return triageResult;
});
```

**Note:** `CommunityIssuesRoutesOptions` needs new deps: `messageStore` and `threadStore`. Add to the interface.

### 4b: Enhanced dispatch endpoint

Enhance `POST /api/community-issues/:id/dispatch` to accept optional `threadId` and post a triage request message.

**Step 1: Write failing test**

```javascript
test('POST dispatch with threadId posts triage request message', async () => {
  const app = await createApp();
  const issue = await createIssue(app);
  const res = await app.inject({
    method: 'POST',
    url: `/api/community-issues/${issue.id}/dispatch`,
    payload: { threadId: 'thread_community' },
  });
  assert.equal(res.statusCode, 200);
  // Message store should have a triage request message
  assert.equal(mockMessageStore.append.mock.callCount(), 1);
  const msg = mockMessageStore.append.mock.calls[0].arguments[0];
  assert.ok(msg.content.includes(issue.title));
  assert.equal(msg.threadId, 'thread_community');
});
```

**Step 2-4: Implement + verify**

Enhance the dispatch endpoint to accept `{ threadId?: string }` body. When provided, post a system message:

```typescript
app.post('/api/community-issues/:id/dispatch', async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as { threadId?: string };
  const item = await communityIssueStore.get(id);
  if (!item) { reply.status(404); return { error: 'Community issue not found' }; }
  if (item.state !== 'unreplied') { reply.status(409); return { error: 'Issue already dispatched or assigned' }; }

  const updated = await communityIssueStore.update(id, { state: 'discussing' });

  if (body.threadId && opts.messageStore) {
    await opts.messageStore.append({
      userId: 'system',
      catId: null,
      content: `🔍 请 triage 社区事项: **${item.repo}#${item.issueNumber}** ${item.title}\n\n类型: ${item.issueType} | 来源: ${item.repo}\n\n请加载 opensource-ops skill，完成主人翁五问后调用 triage-complete API 上报结果。`,
      mentions: [],
      timestamp: Date.now(),
      threadId: body.threadId,
    });
  }

  return updated;
});
```

**Step 5: Commit**

```bash
git add packages/api/src/routes/community-issues.ts packages/api/test/community-issues-routes.test.js
git commit -m "feat(F168): triage-complete endpoint + dispatch message posting (Phase A)"
```

---

## Task 5: Route Options (owner decision + thread assignment)

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts`
- Modify: `packages/api/test/community-issues-routes.test.js`

### 5a: POST /api/community-issues/:id/resolve — owner decision endpoint

When consensus `needsOwner=true`, owner clicks accept/decline in the UI or replies in chat. This endpoint applies the decision.

**Step 1: Write failing tests**

```javascript
test('POST /api/community-issues/:id/resolve accepts and routes', async () => {
  const app = await createApp();
  const issue = await createIssue(app, { issueType: 'feature' });
  // Simulate triage flow → pending-decision
  await app.inject({ method: 'POST', url: `/api/community-issues/${issue.id}/dispatch` });
  await app.inject({
    method: 'POST',
    url: `/api/community-issues/${issue.id}/triage-complete`,
    payload: { catId: 'opus', verdict: 'WELCOME', questions: fivePassQuestions },
  });
  await app.inject({
    method: 'POST',
    url: `/api/community-issues/${issue.id}/triage-complete`,
    payload: { catId: 'codex', verdict: 'POLITELY-DECLINE', reasonCode: 'NOT_NOW', questions: fivePassQuestions },
  });

  // Owner resolves
  const res = await app.inject({
    method: 'POST',
    url: `/api/community-issues/${issue.id}/resolve`,
    payload: { decision: 'accepted' },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.state, 'accepted');
});

test('POST resolve with declined updates state', async () => {
  // ... similar flow, decision: 'declined'
});

test('POST resolve rejects if not pending-decision', async () => {
  const app = await createApp();
  const issue = await createIssue(app);
  const res = await app.inject({
    method: 'POST',
    url: `/api/community-issues/${issue.id}/resolve`,
    payload: { decision: 'accepted' },
  });
  assert.equal(res.statusCode, 409);
});
```

**Step 2-4: Implement + verify**

```typescript
const resolveSchema = z.object({
  decision: z.enum(['accepted', 'declined']),
  relatedFeature: z.string().nullable().optional(),
});

app.post('/api/community-issues/:id/resolve', async (request, reply) => {
  const { id } = request.params as { id: string };
  const result = resolveSchema.safeParse(request.body);
  if (!result.success) { reply.status(400); return { error: 'Invalid body', details: result.error.issues }; }

  const issue = await communityIssueStore.get(id);
  if (!issue) { reply.status(404); return { error: 'Community issue not found' }; }
  if (issue.state !== 'pending-decision') {
    reply.status(409);
    return { error: 'Issue not pending decision', currentState: issue.state };
  }

  const orchestrator = new TriageOrchestrator({
    communityIssueStore, messageStore: opts.messageStore, threadStore: opts.threadStore,
  });

  if (result.data.decision === 'accepted') {
    await orchestrator.routeAccepted(id, result.data.relatedFeature ?? issue.relatedFeature, 'system');
  } else {
    await orchestrator.routeDeclined(id);
  }

  const updated = await communityIssueStore.get(id);
  return updated;
});
```

**Step 5: Commit**

```bash
git add packages/api/src/routes/community-issues.ts packages/api/test/community-issues-routes.test.js
git commit -m "feat(F168): owner resolve endpoint for pending-decision issues (Phase A)"
```

---

## Task 6: Frontend Dispatch Integration

**Files:**
- Modify: `packages/web/src/components/CommunityPanel.tsx`

Minimal change: pass current threadId to the dispatch API call so the backend can post the triage request message.

**Step 1: Read current dispatch handler**

The existing `handleDispatch` in `CommunityPanel.tsx` calls `POST /api/community-issues/${id}/dispatch` without body.

**Step 2: Enhance to pass threadId**

```typescript
const handleDispatch = async (issueId: string) => {
  await fetch(`${apiUrl}/api/community-issues/${issueId}/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId: currentThreadId }),
  });
  refreshBoard();
};
```

Where `currentThreadId` comes from the chat store (already available in context).

**Step 3: Commit**

```bash
git add packages/web/src/components/CommunityPanel.tsx
git commit -m "feat(F168): pass threadId to dispatch for triage message posting"
```

---

## Summary: AC → Task Mapping

| AC | Task | Mechanism |
|---|---|---|
| AC-A1 | Cat-side (skill) + Task 4a | Cat posts Direction Card via `post_message`, calls `triage-complete` |
| AC-A2 | Template (`direction-card-template.md`) | Already defined, cat follows template |
| AC-A3 | Task 3 + Task 4a | Orchestrator returns `await-second-cat` → cat triggers `multi_mention` |
| AC-A4 | Task 2 + Task 3 | `resolveConsensus` + orchestrator auto-updates issue state |
| AC-A5 | Task 3 (`routeAccepted`) + Task 5 | Orchestrator assigns `relatedFeature` + thread routing |
| AC-A6 | Task 3 (`routeAccepted`) + Task 5 | Orchestrator creates new thread via `threadStore.create` |

## Test Count Estimate

| Test file | New tests |
|---|---|
| `community-consensus.test.js` | 9 |
| `triage-orchestrator.test.js` | 7 |
| `community-issues-routes.test.js` | ~8 |
| **Total** | ~24 |
