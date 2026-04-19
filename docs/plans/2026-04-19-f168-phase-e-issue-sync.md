---
feature_ids: [F168]
topics: [community, github, sync]
doc_kind: plan
created: 2026-04-19
---

# F168 Phase E — GitHub Issue Sync Pipeline

**Feature:** F168 — `docs/features/F168-community-ops-board.md`
**Goal:** 点同步按钮 → GitHub issues 拉进 CommunityIssueStore → 看板显示真实分类计数
**Acceptance Criteria:**
- AC-E1: 同步按钮 → GitHub API → CommunityIssueStore（增量去重）
- AC-E2: Issue 状态自动映射（未回复/讨论中/待决策/已接受/已拒绝/已关闭）
- AC-E3: 同步结果实时反映到看板
- AC-E4: 已有条目不重复创建，只更新状态
**Architecture:** 新增 `POST /api/community-issues/sync` 端点，用 `gh api` CLI 拉 GitHub issues（复用现有 fetchGhApi 模式），映射状态后 upsert 到 CommunityIssueStore。前端同步按钮先调 sync 再刷 board。
**Tech Stack:** gh CLI, Fastify, CommunityIssueStore
**前端验证:** Yes — 同步后看板计数必须和 GitHub 一致

**NOT building:**
- 自动定时同步（KD-8: 初版手动触发）
- Webhook 驱动的实时更新
- Issue 评论内容展示

---

### Task 1: GitHub Issue Fetcher + State Mapper

**Files:**
- Create: `packages/api/src/domains/community/GitHubIssueFetcher.ts`
- Test: `packages/api/test/github-issue-fetcher.test.js`

**Step 1: Write failing test — state mapping logic**

```javascript
// State mapping rules:
// GitHub closed → 'closed'
// GitHub open + label 'accepted' → 'accepted'
// GitHub open + label 'needs-maintainer-decision' → 'pending-decision'
// GitHub open + comments > 0 → 'discussing'
// GitHub open + comments === 0 → 'unreplied'
// Label 'invalid'/'duplicate' → 'declined'

test('maps closed issue to closed state', () => { ... });
test('maps open issue with 0 comments to unreplied', () => { ... });
test('maps open issue with comments to discussing', () => { ... });
test('maps issue with accepted label to accepted', () => { ... });
test('maps issue with needs-maintainer-decision to pending-decision', () => { ... });
test('maps issue with invalid/duplicate label to declined', () => { ... });
```

**Step 2: Run test → RED**

```bash
NODE_ENV=test node --test packages/api/test/github-issue-fetcher.test.js
```

**Step 3: Implement mapGitHubIssue**

```typescript
// Pure function: GitHub issue JSON → { issueType, state }
export function mapGitHubIssue(gh: GhIssueFull): { issueType: IssueType; state: IssueState } {
  // label-based type: bug/enhancement/question/feature
  // state mapping: closed→closed, labels→accepted/declined/pending-decision, comments→discussing/unreplied
}
```

**Step 4: Run test → GREEN**

**Step 5: Commit**

```bash
git commit -m "feat(F168-E): GitHub issue state mapper with TDD"
```

---

### Task 2: Sync Endpoint — POST /api/community-issues/sync

**Files:**
- Modify: `packages/api/src/routes/community-issues.ts`
- Test: `packages/api/test/community-issues-routes.test.js`

**Step 1: Write failing test — sync creates issues from GitHub data**

```javascript
test('POST /api/community-issues/sync creates issues from fetched data', async () => {
  // Mock fetcher returns 2 issues
  // After sync, GET /api/community-board shows 2 issues
});

test('POST /api/community-issues/sync updates existing issues', async () => {
  // Create issue #1 with state unreplied
  // Mock fetcher returns #1 with comments > 0
  // After sync, issue #1 state = discussing
});

test('POST /api/community-issues/sync does not duplicate', async () => {
  // Sync twice with same data → still 2 issues, not 4
});
```

**Step 2: Run test → RED**

**Step 3: Implement sync endpoint**

```typescript
app.post('/api/community-issues/sync', async (request, reply) => {
  const { repo } = request.query as { repo?: string };
  if (!repo) { reply.status(400); return { error: 'Missing repo' }; }

  const ghIssues = await fetchIssues(repo); // gh api call
  let created = 0, updated = 0, unchanged = 0;

  for (const gh of ghIssues) {
    const mapped = mapGitHubIssue(gh);
    const existing = await communityIssueStore.getByRepoAndNumber(repo, gh.number);
    if (!existing) {
      await communityIssueStore.create({ repo, issueNumber: gh.number, issueType: mapped.issueType, title: gh.title });
      // update state from default 'unreplied' to mapped state
      created++;
    } else if (existing.state !== mapped.state || existing.title !== gh.title) {
      await communityIssueStore.update(existing.id, { state: mapped.state, title: gh.title });
      updated++;
    } else {
      unchanged++;
    }
  }

  return { repo, created, updated, unchanged, total: ghIssues.length };
});
```

**Step 4: Run test → GREEN**

**Step 5: Commit**

```bash
git commit -m "feat(F168-E): POST /api/community-issues/sync endpoint"
```

---

### Task 3: Wire fetchIssues in Production (index.ts)

**Files:**
- Modify: `packages/api/src/index.ts` (where communityIssueRoutes is registered)
- Modify: `packages/api/src/routes/community-issues.ts` (add fetchIssues to options)

**Step 1: Add fetchIssues to CommunityIssuesRoutesOptions**

```typescript
export interface CommunityIssuesRoutesOptions {
  // ... existing fields ...
  fetchIssues?: (repo: string) => Promise<GhIssueFull[]>;
}
```

**Step 2: Wire in index.ts using existing fetchGhApi pattern**

```typescript
// Reuse the same gh api pattern as fetchOpenIssues but include state=all + labels + comments count
const fetchAllIssues = async (repo: string): Promise<GhIssueFull[]> => {
  const stdout = await fetchGhApi([
    'api', `/repos/${repo}/issues`,
    '--jq', '.[] | select(.pull_request == null) | {number, title, state, labels: [.labels[].name], comments, user: .user.login, html_url}',
    '--paginate',
    '-f', 'state=all', '-f', 'per_page=100',
  ]);
  // parse JSONL
};
```

**Step 3: Pass fetchIssues into communityIssueRoutes registration**

**Step 4: Commit**

```bash
git commit -m "feat(F168-E): wire fetchIssues via gh CLI into community routes"
```

---

### Task 4: Frontend — Sync Button Calls POST then Refreshes

**Files:**
- Modify: `packages/web/src/components/CommunityPanel.tsx`

**Step 1: Update sync handler**

```typescript
// Before: onSync just calls fetchBoard (GET)
// After: onSync calls POST /api/community-issues/sync?repo=X first, then fetchBoard
const handleSync = async () => {
  setLoading(true);
  await fetch(`/api/community-issues/sync?repo=${repo}`, { method: 'POST' });
  await fetchBoard();
  setLoading(false);
};
```

**Step 2: Verify in browser — sync button now populates issues**

**Step 3: Commit**

```bash
git commit -m "feat(F168-E): sync button calls POST sync then refreshes board"
```

---

### Task 5: Full Integration Test + Quality Gate

**Step 1: Run full test suite**

```bash
NODE_ENV=test pnpm test
```

**Step 2: Build check**

```bash
pnpm lint && pnpm check && pnpm -r --if-present run build
```

**Step 3: Commit any fixes**
