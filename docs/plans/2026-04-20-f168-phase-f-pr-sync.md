---
feature_ids: [F168]
topics: [community, github, sync, pull-request]
doc_kind: plan
created: 2026-04-20
---

# F168 Phase F: GitHub PR Sync Pipeline — Implementation Plan

**Feature:** F168 — `docs/features/F168-community-ops-board.md`
**Goal:** PR 区和 Issue 区一样从 GitHub 拉全量数据，显示回复状态和新动态
**Acceptance Criteria:**
- AC-F1: 同步按钮 → GitHub API → CommunityPrStore（增量去重）
- AC-F2: 回复状态检测 — open PR 查 reviews，有非 author review → replied
- AC-F3: 新动态检测 — replied + head SHA 变了 → has-new-activity
- AC-F4: 看板合并 CommunityPrStore + pr_tracking，去重
- AC-F5: 前端 PR 分组改为 unreplied/replied/has-new-activity/merged/closed
**Architecture:** Mirror Phase E issue sync pattern. New CommunityPrStore (in-memory + Redis). Two-pass sync: list PRs, then fetch reviews for open PRs. Board endpoint merges both data sources by PR number.
**Tech Stack:** Fastify, gh CLI, Redis (optional), React
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Terminal Schema

```typescript
interface CommunityPrItem {
  id: string;
  repo: string;
  prNumber: number;
  title: string;
  author: string;
  state: 'open' | 'merged' | 'closed';
  replyState: 'unreplied' | 'replied' | 'has-new-activity';
  headSha: string;
  lastReviewedSha: string | null;
  draft: boolean;
  updatedAt: number;
  createdAt: number;
}

interface GhPrFull {
  number: number;
  title: string;
  state: string;       // 'open' | 'closed'
  merged_at: string | null;
  user: string;
  head_sha: string;
  draft: boolean;
  labels: string[];
  updated_at: string;
}

interface GhPrReview {
  user: string;
  state: string;  // 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
  commit_id: string;
}
```

## What we're NOT building

- Automatic periodic PR sync (manual button only, KD-8)
- PR comment/review threading (just counts/state)
- CI/conflict data from GitHub (that's pr_tracking's job via F140)
- Redis store (in-memory only for MVP — same as issue store initially used)

---

### Task 1: CommunityPrStore — Interface + In-Memory Implementation

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/ports/CommunityPrStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/memory/InMemoryCommunityPrStore.ts`
- Test: `packages/api/test/community-pr-store.test.js`

**Step 1: Write the failing test**

```javascript
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let store;

beforeEach(async () => {
  const { InMemoryCommunityPrStore } = await import(
    '../dist/domains/cats/services/stores/memory/InMemoryCommunityPrStore.js'
  );
  store = new InMemoryCommunityPrStore();
});

describe('CommunityPrStore', () => {
  test('create + get round-trip', async () => {
    const item = await store.create({
      repo: 'org/repo',
      prNumber: 42,
      title: 'Add feature',
      author: 'alice',
      state: 'open',
      replyState: 'unreplied',
      headSha: 'abc123',
      draft: false,
    });
    assert.ok(item);
    assert.equal(item.prNumber, 42);
    const got = await store.get(item.id);
    assert.deepEqual(got, item);
  });

  test('create returns null on duplicate repo+prNumber', async () => {
    await store.create({
      repo: 'org/repo', prNumber: 1, title: 'PR 1',
      author: 'alice', state: 'open', replyState: 'unreplied',
      headSha: 'aaa', draft: false,
    });
    const dup = await store.create({
      repo: 'org/repo', prNumber: 1, title: 'PR 1 dup',
      author: 'alice', state: 'open', replyState: 'unreplied',
      headSha: 'aaa', draft: false,
    });
    assert.equal(dup, null);
  });

  test('getByRepoAndNumber', async () => {
    await store.create({
      repo: 'org/repo', prNumber: 10, title: 'PR 10',
      author: 'bob', state: 'open', replyState: 'unreplied',
      headSha: 'bbb', draft: false,
    });
    const found = await store.getByRepoAndNumber('org/repo', 10);
    assert.ok(found);
    assert.equal(found.prNumber, 10);
    const miss = await store.getByRepoAndNumber('org/repo', 999);
    assert.equal(miss, null);
  });

  test('listByRepo filters by repo', async () => {
    await store.create({
      repo: 'org/a', prNumber: 1, title: 'A PR',
      author: 'alice', state: 'open', replyState: 'unreplied',
      headSha: 'a1', draft: false,
    });
    await store.create({
      repo: 'org/b', prNumber: 2, title: 'B PR',
      author: 'bob', state: 'open', replyState: 'unreplied',
      headSha: 'b1', draft: false,
    });
    const list = await store.listByRepo('org/a');
    assert.equal(list.length, 1);
    assert.equal(list[0].repo, 'org/a');
  });

  test('update changes fields', async () => {
    const item = await store.create({
      repo: 'org/repo', prNumber: 5, title: 'Old title',
      author: 'alice', state: 'open', replyState: 'unreplied',
      headSha: 'old', draft: false,
    });
    const updated = await store.update(item.id, {
      replyState: 'replied',
      lastReviewedSha: 'old',
      headSha: 'new',
    });
    assert.equal(updated.replyState, 'replied');
    assert.equal(updated.lastReviewedSha, 'old');
    assert.equal(updated.headSha, 'new');
  });

  test('delete returns true/false', async () => {
    const item = await store.create({
      repo: 'org/repo', prNumber: 99, title: 'Del me',
      author: 'alice', state: 'open', replyState: 'unreplied',
      headSha: 'x', draft: false,
    });
    assert.equal(await store.delete(item.id), true);
    assert.equal(await store.delete(item.id), false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && npx tsc && node --test test/community-pr-store.test.js`
Expected: FAIL — module not found

**Step 3: Write the port interface**

```typescript
// packages/api/src/domains/cats/services/stores/ports/CommunityPrStore.ts
export interface CommunityPrItem {
  id: string;
  repo: string;
  prNumber: number;
  title: string;
  author: string;
  state: 'open' | 'merged' | 'closed';
  replyState: 'unreplied' | 'replied' | 'has-new-activity';
  headSha: string;
  lastReviewedSha: string | null;
  draft: boolean;
  updatedAt: number;
  createdAt: number;
}

export interface CreateCommunityPrInput {
  repo: string;
  prNumber: number;
  title: string;
  author: string;
  state: 'open' | 'merged' | 'closed';
  replyState: 'unreplied' | 'replied' | 'has-new-activity';
  headSha: string;
  draft: boolean;
}

export type UpdateCommunityPrInput = Partial<
  Pick<CommunityPrItem, 'title' | 'state' | 'replyState' | 'headSha' | 'lastReviewedSha' | 'draft'>
>;

export interface ICommunityPrStore {
  create(input: CreateCommunityPrInput): Promise<CommunityPrItem | null>;
  get(id: string): Promise<CommunityPrItem | null>;
  getByRepoAndNumber(repo: string, prNumber: number): Promise<CommunityPrItem | null>;
  listByRepo(repo: string): Promise<CommunityPrItem[]>;
  listAll(): Promise<CommunityPrItem[]>;
  update(id: string, input: UpdateCommunityPrInput): Promise<CommunityPrItem | null>;
  delete(id: string): Promise<boolean>;
}
```

**Step 4: Write the in-memory implementation**

```typescript
// packages/api/src/domains/cats/services/stores/memory/InMemoryCommunityPrStore.ts
import { randomUUID } from 'node:crypto';
import type {
  CommunityPrItem,
  CreateCommunityPrInput,
  ICommunityPrStore,
  UpdateCommunityPrInput,
} from '../ports/CommunityPrStore.js';

export class InMemoryCommunityPrStore implements ICommunityPrStore {
  private items = new Map<string, CommunityPrItem>();

  async create(input: CreateCommunityPrInput): Promise<CommunityPrItem | null> {
    for (const item of this.items.values()) {
      if (item.repo === input.repo && item.prNumber === input.prNumber) return null;
    }
    const now = Date.now();
    const item: CommunityPrItem = {
      id: randomUUID(),
      ...input,
      lastReviewedSha: null,
      updatedAt: now,
      createdAt: now,
    };
    this.items.set(item.id, item);
    return item;
  }

  async get(id: string): Promise<CommunityPrItem | null> {
    return this.items.get(id) ?? null;
  }

  async getByRepoAndNumber(repo: string, prNumber: number): Promise<CommunityPrItem | null> {
    for (const item of this.items.values()) {
      if (item.repo === repo && item.prNumber === prNumber) return item;
    }
    return null;
  }

  async listByRepo(repo: string): Promise<CommunityPrItem[]> {
    return [...this.items.values()]
      .filter((i) => i.repo === repo)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async listAll(): Promise<CommunityPrItem[]> {
    return [...this.items.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async update(id: string, input: UpdateCommunityPrInput): Promise<CommunityPrItem | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...input, updatedAt: Date.now() };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}
```

**Step 5: Run test to verify it passes**

Run: `cd packages/api && npx tsc && node --test test/community-pr-store.test.js`
Expected: 6 passed

**Step 6: Commit**

```bash
git add packages/api/src/domains/cats/services/stores/ports/CommunityPrStore.ts \
       packages/api/src/domains/cats/services/stores/memory/InMemoryCommunityPrStore.ts \
       packages/api/test/community-pr-store.test.js
git commit -m "feat(F168-F): CommunityPrStore interface + in-memory impl + 6 tests"
```

---

### Task 2: GitHubPrFetcher — PR state mapper + replyState logic

**Files:**
- Create: `packages/api/src/domains/community/GitHubPrFetcher.ts`
- Test: `packages/api/test/github-pr-fetcher.test.js`

**Step 1: Write the failing test**

```javascript
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('mapGitHubPr', () => {
  let mapGitHubPr;
  before(async () => {
    ({ mapGitHubPr } = await import('../dist/domains/community/GitHubPrFetcher.js'));
  });

  test('open PR with no reviews → unreplied', () => {
    const result = mapGitHubPr(
      { number: 1, title: 'T', state: 'open', merged_at: null, user: 'alice', head_sha: 'a1', draft: false, labels: [], updated_at: '' },
      [],
    );
    assert.equal(result.state, 'open');
    assert.equal(result.replyState, 'unreplied');
  });

  test('open PR with non-author review → replied', () => {
    const result = mapGitHubPr(
      { number: 2, title: 'T', state: 'open', merged_at: null, user: 'alice', head_sha: 'a2', draft: false, labels: [], updated_at: '' },
      [{ user: 'bob', state: 'APPROVED', commit_id: 'a2' }],
    );
    assert.equal(result.replyState, 'replied');
    assert.equal(result.lastReviewedSha, 'a2');
  });

  test('open PR with only author review → unreplied', () => {
    const result = mapGitHubPr(
      { number: 3, title: 'T', state: 'open', merged_at: null, user: 'alice', head_sha: 'a3', draft: false, labels: [], updated_at: '' },
      [{ user: 'alice', state: 'COMMENTED', commit_id: 'a3' }],
    );
    assert.equal(result.replyState, 'unreplied');
  });

  test('replied PR with new head SHA → has-new-activity', () => {
    const result = mapGitHubPr(
      { number: 4, title: 'T', state: 'open', merged_at: null, user: 'alice', head_sha: 'new-sha', draft: false, labels: [], updated_at: '' },
      [{ user: 'bob', state: 'CHANGES_REQUESTED', commit_id: 'old-sha' }],
    );
    assert.equal(result.replyState, 'has-new-activity');
    assert.equal(result.lastReviewedSha, 'old-sha');
  });

  test('closed PR with merged_at → merged', () => {
    const result = mapGitHubPr(
      { number: 5, title: 'T', state: 'closed', merged_at: '2026-01-01', user: 'alice', head_sha: 'a5', draft: false, labels: [], updated_at: '' },
      [],
    );
    assert.equal(result.state, 'merged');
  });

  test('closed PR without merged_at → closed', () => {
    const result = mapGitHubPr(
      { number: 6, title: 'T', state: 'closed', merged_at: null, user: 'alice', head_sha: 'a6', draft: false, labels: [], updated_at: '' },
      [],
    );
    assert.equal(result.state, 'closed');
  });

  test('closed/merged PR replyState defaults to replied', () => {
    const result = mapGitHubPr(
      { number: 7, title: 'T', state: 'closed', merged_at: '2026-01-01', user: 'alice', head_sha: 'a7', draft: false, labels: [], updated_at: '' },
      [],
    );
    assert.equal(result.replyState, 'replied');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && npx tsc && node --test test/github-pr-fetcher.test.js`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// packages/api/src/domains/community/GitHubPrFetcher.ts
export interface GhPrFull {
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  user: string;
  head_sha: string;
  draft: boolean;
  labels: string[];
  updated_at: string;
}

export interface GhPrReview {
  user: string;
  state: string;
  commit_id: string;
}

type PrState = 'open' | 'merged' | 'closed';
type PrReplyState = 'unreplied' | 'replied' | 'has-new-activity';

export function mapGitHubPr(
  pr: GhPrFull,
  reviews: GhPrReview[],
): { state: PrState; replyState: PrReplyState; lastReviewedSha: string | null } {
  const state: PrState = pr.state === 'closed' ? (pr.merged_at ? 'merged' : 'closed') : 'open';

  if (state !== 'open') {
    return { state, replyState: 'replied', lastReviewedSha: null };
  }

  const nonAuthorReviews = reviews.filter((r) => r.user !== pr.user);
  if (nonAuthorReviews.length === 0) {
    return { state, replyState: 'unreplied', lastReviewedSha: null };
  }

  const latestReview = nonAuthorReviews[nonAuthorReviews.length - 1];
  const lastReviewedSha = latestReview.commit_id;

  if (pr.head_sha !== lastReviewedSha) {
    return { state, replyState: 'has-new-activity', lastReviewedSha };
  }

  return { state, replyState: 'replied', lastReviewedSha };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && npx tsc && node --test test/github-pr-fetcher.test.js`
Expected: 7 passed

**Step 5: Commit**

```bash
git add packages/api/src/domains/community/GitHubPrFetcher.ts \
       packages/api/test/github-pr-fetcher.test.js
git commit -m "feat(F168-F): GitHubPrFetcher — PR state mapper + replyState logic, 7 tests"
```

---

### Task 3: Sync Endpoint — POST /api/community-issues/sync-prs

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts` (add sync-prs endpoint + extend options)
- Test: `packages/api/test/community-issues-routes.test.js` (add PR sync tests)

**Step 1: Write the failing tests**

Add to `community-issues-routes.test.js`:

```javascript
// PR sync tests — add after existing sync tests
test('POST /api/community-issues/sync-prs creates PR items', async () => {
  const app = await createApp({
    fetchPrs: async () => [
      { number: 100, title: 'Add feature', state: 'open', merged_at: null, user: 'alice', head_sha: 'abc', draft: false, labels: [], updated_at: '2026-01-01' },
    ],
    fetchPrReviews: async () => [],
  });
  const res = await app.inject({ method: 'POST', url: '/api/community-issues/sync-prs?repo=org/repo' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.created, 1);
  assert.equal(body.total, 1);
});

test('POST /api/community-issues/sync-prs detects replied state', async () => {
  const app = await createApp({
    fetchPrs: async () => [
      { number: 200, title: 'Reviewed PR', state: 'open', merged_at: null, user: 'alice', head_sha: 'sha1', draft: false, labels: [], updated_at: '2026-01-01' },
    ],
    fetchPrReviews: async (repo, prNumber) => [
      { user: 'bob', state: 'APPROVED', commit_id: 'sha1' },
    ],
  });
  const res = await app.inject({ method: 'POST', url: '/api/community-issues/sync-prs?repo=org/repo' });
  assert.equal(res.statusCode, 200);
  // Verify via board
  const board = (await app.inject({ method: 'GET', url: '/api/community-board?repo=org/repo' })).json();
  const pr = board.prItems.find((p) => p.prNumber === 200);
  assert.ok(pr, 'PR should appear in board');
  assert.equal(pr.replyState, 'replied');
});

test('POST /api/community-issues/sync-prs no duplicate on re-sync', async () => {
  const app = await createApp({
    fetchPrs: async () => [
      { number: 300, title: 'Same PR', state: 'open', merged_at: null, user: 'alice', head_sha: 'x', draft: false, labels: [], updated_at: '2026-01-01' },
    ],
    fetchPrReviews: async () => [],
  });
  await app.inject({ method: 'POST', url: '/api/community-issues/sync-prs?repo=org/repo' });
  const res = await app.inject({ method: 'POST', url: '/api/community-issues/sync-prs?repo=org/repo' });
  assert.equal(res.json().unchanged, 1);
  assert.equal(res.json().created, 0);
});

test('POST /api/community-issues/sync-prs missing repo returns 400', async () => {
  const app = await createApp({ fetchPrs: async () => [], fetchPrReviews: async () => [] });
  const res = await app.inject({ method: 'POST', url: '/api/community-issues/sync-prs' });
  assert.equal(res.statusCode, 400);
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @cat-cafe/api test`
Expected: 4 new tests FAIL

**Step 3: Implement sync-prs endpoint**

Modify `community-issues.ts`:
- Add `communityPrStore` and `fetchPrs`/`fetchPrReviews` to `CommunityIssuesRoutesOptions`
- Add `POST /api/community-issues/sync-prs` endpoint
- Update `GET /api/community-board` to merge CommunityPrStore data

```typescript
// Add to CommunityIssuesRoutesOptions:
communityPrStore?: ICommunityPrStore;
fetchPrs?: (repo: string) => Promise<GhPrFull[]>;
fetchPrReviews?: (repo: string, prNumber: number) => Promise<GhPrReview[]>;

// Sync endpoint:
app.post('/api/community-issues/sync-prs', async (request, reply) => {
  const { repo } = request.query as { repo?: string };
  if (!repo) { reply.status(400); return { error: 'Missing repo query parameter' }; }
  if (!opts.fetchPrs || !opts.communityPrStore) {
    reply.status(501);
    return { error: 'GitHub PR fetching not configured' };
  }

  const ghPrs = await opts.fetchPrs(repo);
  let created = 0, updated = 0, unchanged = 0;

  for (const pr of ghPrs) {
    const reviews = pr.state === 'open' && opts.fetchPrReviews
      ? await opts.fetchPrReviews(repo, pr.number)
      : [];
    const mapped = mapGitHubPr(pr, reviews);
    const existing = await opts.communityPrStore.getByRepoAndNumber(repo, pr.number);

    if (!existing) {
      await opts.communityPrStore.create({
        repo, prNumber: pr.number, title: pr.title, author: pr.user,
        state: mapped.state, replyState: mapped.replyState,
        headSha: pr.head_sha, draft: pr.draft,
      });
      if (mapped.lastReviewedSha) {
        const fresh = await opts.communityPrStore.getByRepoAndNumber(repo, pr.number);
        if (fresh) await opts.communityPrStore.update(fresh.id, { lastReviewedSha: mapped.lastReviewedSha });
      }
      created++;
    } else if (
      existing.state !== mapped.state ||
      existing.replyState !== mapped.replyState ||
      existing.title !== pr.title ||
      existing.headSha !== pr.head_sha
    ) {
      await opts.communityPrStore.update(existing.id, {
        state: mapped.state, replyState: mapped.replyState,
        title: pr.title, headSha: pr.head_sha,
        ...(mapped.lastReviewedSha ? { lastReviewedSha: mapped.lastReviewedSha } : {}),
      });
      updated++;
    } else {
      unchanged++;
    }
  }

  return { repo, created, updated, unchanged, total: ghPrs.length };
});
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @cat-cafe/api test`
Expected: All tests pass including 4 new

**Step 5: Commit**

```bash
git add packages/api/src/routes/community-issues.ts \
       packages/api/test/community-issues-routes.test.js
git commit -m "feat(F168-F): POST /api/community-issues/sync-prs endpoint + 4 tests"
```

---

### Task 4: Board Merge — Combine CommunityPrStore + pr_tracking

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts` (update GET /api/community-board)
- Test: `packages/api/test/community-issues-routes.test.js`

**Step 1: Write the failing test**

```javascript
test('GET /api/community-board merges CommunityPrStore with pr_tracking', async () => {
  const app = await createApp({
    fetchPrs: async () => [
      { number: 500, title: 'Community PR', state: 'open', merged_at: null, user: 'ext', head_sha: 'h1', draft: false, labels: [], updated_at: '2026-01-01' },
    ],
    fetchPrReviews: async () => [],
  });
  // Sync PRs first
  await app.inject({ method: 'POST', url: '/api/community-issues/sync-prs?repo=org/repo' });
  const board = (await app.inject({ method: 'GET', url: '/api/community-board?repo=org/repo' })).json();
  const communityPr = board.prItems.find((p) => p.prNumber === 500);
  assert.ok(communityPr, 'community PR should appear in board');
  assert.equal(communityPr.group, 'unreplied');
  assert.equal(communityPr.author, 'ext');
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL — prItems only contains pr_tracking items, not CommunityPrStore

**Step 3: Update board endpoint**

Update `GET /api/community-board` to merge both sources:

```typescript
// After existing pr_tracking projection...
const communityPrs = opts.communityPrStore ? await opts.communityPrStore.listByRepo(repo) : [];
const trackedPrNumbers = new Set(
  repoPrTasks.map((t) => {
    const match = t.subjectKey?.match(/#(\d+)$/);
    return match ? Number(match[1]) : null;
  }).filter(Boolean),
);

const communityPrItems = communityPrs
  .filter((p) => !trackedPrNumbers.has(p.prNumber))
  .map((p) => ({
    taskId: p.id,
    threadId: null,
    title: p.title,
    status: p.state,
    group: p.replyState === 'has-new-activity' ? 'has-new-activity' : p.replyState === 'replied' ? 'replied' : p.state === 'merged' ? 'merged' : p.state === 'closed' ? 'closed' : 'unreplied',
    prNumber: p.prNumber,
    author: p.author,
    replyState: p.replyState,
    updatedAt: p.updatedAt,
  }));

const prItems = [...trackedPrItems, ...communityPrItems];
return { repo, issues, prItems };
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @cat-cafe/api test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/routes/community-issues.ts \
       packages/api/test/community-issues-routes.test.js
git commit -m "feat(F168-F): board endpoint merges CommunityPrStore + pr_tracking (AC-F4)"
```

---

### Task 5: Frontend — Update PR sections + sync-prs call

**Files:**
- Modify: `packages/web/src/components/CommunityPanel.tsx`

**Step 1: Update PR_SECTIONS, colors, PrRow, handleSync**

```typescript
// New PR_SECTIONS (AC-F5):
const PR_SECTIONS = [
  { key: 'unreplied', label: 'PR 未回复' },
  { key: 'replied', label: 'PR 已回复' },
  { key: 'has-new-activity', label: '有新动态' },
  { key: 'in-review', label: '审核中' },
  { key: 'merged', label: '已合入' },
  { key: 'closed', label: '已关闭' },
] as const;

// New colors:
const PR_GROUP_COLORS: Record<string, string> = {
  unreplied: 'text-cafe-accent',
  replied: 'text-green-600',
  'has-new-activity': 'text-amber-600',
  'in-review': 'text-cafe-crosspost',
  merged: 'text-green-600',
  closed: 'text-gray-400',
};
```

Update `PrBoardItem` interface to include new fields:
```typescript
interface PrBoardItem {
  taskId: string;
  threadId: string | null;
  title: string;
  status: string;
  group: string;
  prNumber?: number;
  author?: string;
  replyState?: string;
  updatedAt: number;
}
```

Update `PrRow` to show PR number and author for community PRs:
```typescript
function PrRow({ item, onNavigate }) {
  // ... existing logic + add:
  <span className="text-cafe-muted text-[10px]">#{item.prNumber}</span>
  // ... and show author:
  {item.author && <span className="text-[10px] text-cafe-muted">@{item.author}</span>}
}
```

Update `handleSync` to also call sync-prs:
```typescript
const handleSync = useCallback(async () => {
  if (!repo) return;
  setLoading(true);
  try {
    await Promise.all([
      fetch(`/api/community-issues/sync?repo=${encodeURIComponent(repo)}`, { method: 'POST' }),
      fetch(`/api/community-issues/sync-prs?repo=${encodeURIComponent(repo)}`, { method: 'POST' }),
    ]);
    await fetchBoard();
  } catch { /* network error */ }
  finally { setLoading(false); }
}, [repo, fetchBoard]);
```

Update `collapsedPrs` default to collapse merged+closed:
```typescript
const [collapsedPrs, setCollapsedPrs] = useState<Record<string, boolean>>({
  merged: true,
  closed: true,
});
```

**Step 2: Run build to verify**

Run: `pnpm -r --if-present run build`
Expected: exit 0

**Step 3: Commit**

```bash
git add packages/web/src/components/CommunityPanel.tsx
git commit -m "feat(F168-F): frontend PR sections — unreplied/replied/new-activity/merged/closed (AC-F5)"
```

---

### Task 6: Production Wiring — fetchPrs + fetchPrReviews in index.ts

**Files:**
- Modify: `packages/api/src/index.ts`

**Step 1: Add production fetch functions and wire into routes**

```typescript
// After fetchIssuesForSync...
const fetchPrsForSync = async (repo: string) => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync('gh', [
    'api', `/repos/${repo}/pulls`, '--method', 'GET', '--jq',
    '.[] | {number, title, state, merged_at: .merged_at, user: .user.login, head_sha: .head.sha, draft, labels: [.labels[].name], updated_at: .updated_at}',
    '--paginate', '-f', 'state=all', '-f', 'per_page=100',
  ], { timeout: 60_000 });
  if (!stdout.trim()) return [];
  return stdout.trim().split('\n').map((line: string) => JSON.parse(line));
};

const fetchPrReviewsForSync = async (repo: string, prNumber: number) => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync('gh', [
    'api', `/repos/${repo}/pulls/${prNumber}/reviews`, '--method', 'GET', '--jq',
    '.[] | {user: .user.login, state, commit_id}',
  ], { timeout: 30_000 });
  if (!stdout.trim()) return [];
  return stdout.trim().split('\n').map((line: string) => JSON.parse(line));
};

// Create CommunityPrStore instance:
const { InMemoryCommunityPrStore } = await import(
  './domains/cats/services/stores/memory/InMemoryCommunityPrStore.js'
);
const communityPrStore = new InMemoryCommunityPrStore();

// Wire into routes:
await app.register(communityIssueRoutes, {
  communityIssueStore, taskStore, socketManager, registry,
  fetchIssues: fetchIssuesForSync,
  communityPrStore,
  fetchPrs: fetchPrsForSync,
  fetchPrReviews: fetchPrReviewsForSync,
});
```

**Step 2: Run full test suite**

Run: `pnpm test && pnpm lint && pnpm check && pnpm -r --if-present run build`
Expected: All pass

**Step 3: Commit**

```bash
git add packages/api/src/index.ts
git commit -m "feat(F168-F): wire fetchPrs + fetchPrReviews + CommunityPrStore into production"
```

---

## Summary

| Task | AC | Tests |
|------|-----|-------|
| 1. CommunityPrStore | AC-F1 (store) | 6 |
| 2. GitHubPrFetcher | AC-F2, AC-F3 | 7 |
| 3. Sync endpoint | AC-F1 (endpoint) | 4 |
| 4. Board merge | AC-F4 | 1 |
| 5. Frontend | AC-F5 | — (browser verification) |
| 6. Production wiring | AC-F1 (runtime) | — (integration) |
| **Total** | **AC-F1~F5** | **18** |
