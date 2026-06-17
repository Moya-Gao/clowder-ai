---
feature_ids: [F235]
topics: [community, publisher, frustration-issue, github]
doc_kind: plan
created: 2026-06-15
---

# F235 Phase A: FrustrationIssue → Community Publisher

**Feature:** F235 — `docs/features/F235-feedback-to-community-publisher.md`
**Goal:** FrustrationIssueCard confirmed 后新增"发布到社区"按钮，用户可预览编辑后一键发布到 GitHub issue
**Acceptance Criteria:**
- AC-A1: FrustrationIssueCard confirmed 后显示"发布到社区"按钮
- AC-A2: 点击后生成预览卡片，用户可编辑标题和描述
- AC-A3: 预览内容经过脱敏——不含 threadId / sessionId / Redis key / 内部 catId
- AC-A4: submit 后通过 GitHub API 在目标仓库创建 issue
- AC-A5: 创建成功后卡片更新为"已发布"状态并附 issue URL 链接
- AC-A6: GitHub API 失败时友好提示，不丢失 draft 数据
**Architecture cell:** community-ops
**Map delta:** update required（community-ops 从纯 inbound 扩展为双向，新增 outbound publisher 子域）
**Map delta why:** F235 在 community-ops cell 新增 outbound 方向（sanitizer + draft store + GitHub publisher），不需要新 cell
**Architecture:** FrustrationIssueCard confirmed → API creates sanitized draft → posts preview rich block as thread message → user edits + submits → API re-sanitizes + publishes to GitHub → updates card to "published" with link. All GitHub API via raw fetch with existing `GITHUB_TOKEN` env var. Preview card is a separate component (follows F128 propose_thread pattern: new message, not inline expansion).
**Tech Stack:** TypeScript, Fastify routes, Redis store, GitHub REST API (raw fetch), React rich block component
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测 publish 按钮 + 预览卡 + submit 流程

---

## NOT building (Phase A scope fence)

- OAuth user-initiated publishing (Phase B, KD-2)
- Repo picker UI (Phase A uses single default repo, KD-3)
- "猫猫主动整理" source adapter (Phase B)
- F168 inbound reconciliation with outbound issues (known gap, Phase B)

## Terminal Schema

### CommunityIssueDraft (new type)

```typescript
// packages/shared/src/types/community-issue-draft.ts
interface CommunityIssueDraft {
  draftId: string;              // cid_ prefix
  status: CommunityIssueDraftStatus; // draft | published | cancelled

  // Source tracking (generic pipeline, KD-6)
  sourceType: 'frustration_issue'; // extensible for Phase B
  sourceId: string;                // fi_xxx

  // Content (sanitized)
  title: string;
  bodyMarkdown: string;

  // Target
  targetRepo: string;              // e.g. 'clowder-ai/cat-cafe'
  labels: string[];

  // Result (after publish)
  githubIssueNumber?: number;
  githubIssueUrl?: string;

  // Thread context (for rich block rendering)
  threadId: string;
  userId: string;

  // Lifecycle
  createdAt: number;
  publishedAt?: number;
  cancelledAt?: number;
}
```

### CommunityIssueSanitizer (pure function)

```typescript
interface SanitizeResult {
  title: string;
  bodyMarkdown: string;
  redactedFields: string[];  // which fields were redacted (for UI warning)
  passed: boolean;           // false = fail-closed, content still contains forbidden patterns
}
```

### Config

```typescript
interface CommunityPublishConfig {
  defaultRepo: string;              // 'clowder-ai/cat-cafe'
  repoAllowlist: string[];          // Phase A: single item
  githubToken: string | undefined;  // from GITHUB_TOKEN env
}
```

## Stateful Object Gate

### Object 1: CommunityIssueDraft

**Lifecycle owner:** CommunityIssueDraftStore (API creates via source adapter, user triggers publish/cancel)

**State × Event Transition Table:**

| Current State | Event | Next State | Guard |
|---|---|---|---|
| (none) | createFromFrustrationIssue | draft | sourceId must reference confirmed FrustrationIssue |
| draft | publish | published | content must pass re-sanitize; GitHub API must succeed; must have githubIssueNumber |
| draft | cancel | cancelled | — |
| published | * | — | terminal, no further transitions |
| cancelled | * | — | terminal, no further transitions |

**旁路 API 禁止:** No generic restore/delete on published drafts. Published = immutable external side-effect.

**Invariant Checklist:**

| # | Invariant | Test Method |
|---|---|---|
| INV-1 | Only `draft` can transition to `published` or `cancelled` | Unit test: attempt publish on cancelled → 409 |
| INV-2 | Published draft MUST have `githubIssueNumber` + `githubIssueUrl` | Unit test: publish without URL → error |
| INV-3 | One FrustrationIssue maps to at most one non-cancelled draft | Unit test: create second draft for same sourceId → 409 |
| INV-4 | Sanitized content must not contain any forbidden pattern after publish | Unit test: inject threadId into title, re-sanitize catches it |
| INV-5 | `targetRepo` must be in allowlist | Unit test: unknown repo → 400 |
| INV-6 | Draft is persistent (TTL=0, Iron Law #5) | Redis store has no TTL on keys |

**Adversarial Scenarios:**

| Scenario | Expected Behavior | Test |
|---|---|---|
| GitHub API fails mid-publish | Draft stays in `draft`, no partial state. Error returned to user. | Mock GitHub 500 → assert draft still draft |
| User edits re-introduce forbidden content | Server re-sanitizes on publish (KD-4), rejects if fail-closed | Submit with threadId in body → 400 |
| Concurrent double-publish | First wins (idempotent GitHub create check), second gets 409 | Two parallel publish calls → one 200, one 409 |
| FrustrationIssue not confirmed | createFromFrustrationIssue rejects | Create draft for draft-status issue → 400 |

### Object 2: FrustrationIssue (extension)

No new lifecycle states. Add optional `communityIssueDraftId?: string` field set atomically when draft is created. Read-only from F222's perspective — F235 writes it.

---

## Tasks

### Task 1: Shared Types — CommunityIssueDraft

**Files:**
- Create: `packages/shared/src/types/community-issue-draft.ts`
- Modify: `packages/shared/src/types/index.ts` (re-export)

**Step 1:** Write `community-issue-draft.ts` with:
- `CommunityIssueDraftStatus` union type: `'draft' | 'published' | 'cancelled'`
- `CommunityIssueDraft` interface (see terminal schema above)
- `CreateCommunityIssueDraftInput` input type
- `generateCommunityIssueDraftId()` using existing `generateId('cid')`
- `createCommunityIssueDraft(input)` factory function

**Step 2:** Add re-export in `packages/shared/src/types/index.ts`

**Step 3:** `pnpm --filter @cat-cafe/shared build` to verify types compile

**Step 4:** Commit: `feat(shared): add CommunityIssueDraft types (F235)`

---

### Task 2: CommunityIssueSanitizer — Pure Function

**Files:**
- Create: `packages/api/src/domains/community/CommunityIssueSanitizer.ts`
- Create: `packages/api/test/community-issue-sanitizer.test.js`

**Core design:** Whitelist-based. Only explicitly allowed fields pass through. Forbidden patterns are detected and redacted. Fail-closed: if any forbidden pattern remains after redaction, `passed = false`.

**Forbidden patterns (KD-4):**
- `thread_[a-z0-9]+` (threadId)
- `usr_[a-z0-9]+` (userId)
- UUIDs that look like sessionId/invocationId
- `fi_[a-z0-9]+` (frustration issue IDs)
- `cid_[a-z0-9]+` (draft IDs)
- Redis key patterns: `frustration-issue:*`, `community-issue-draft:*`
- Absolute paths: `/Users/`, `/home/`, `/tmp/`
- API keys / tokens: `gh[pousr]_`, `github_pat_`, `sk-`
- Cat Cafe internal IDs: `catId` values from roster

**Step 1:** Write failing tests:
- `sanitize("Permission prompts too frequent", "thread_abc123 had 4 cancels")` → title clean, body redacted, `passed: true`
- `sanitize("title with thread_abc", "clean body")` → title redacted, `passed: true`
- `sanitize("all clean", "all clean")` → no redactions, `passed: true`
- Fail-closed: content with obfuscated internal IDs → `passed: false` (whitelist miss)

**Step 2:** Implement `sanitize(title, bodyMarkdown, options?)` function:
1. Run forbidden pattern regex scan on both title and body
2. Replace matches with `[redacted]`
3. Verify post-redaction content has no remaining forbidden patterns
4. Return `{ title, bodyMarkdown, redactedFields, passed }`

**Step 3:** Run tests green

**Step 4:** Commit: `feat(api): CommunityIssueSanitizer with whitelist + fail-closed (F235 KD-4)`

---

### Task 3: CommunityIssueDraftStore — Port + Redis

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/ports/CommunityIssueDraftStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/redis/RedisCommunityIssueDraftStore.ts`
- Create: `packages/api/test/stores/community-issue-draft-store.test.js`

**Redis key design:**
```
community-issue-draft:{draftId}                 → Hash (draft data)
community-issue-drafts:thread:{threadId}        → ZSet (score=createdAt)
community-issue-drafts:user:{userId}            → ZSet (score=createdAt)
community-issue-drafts:source:{sourceId}        → String (draftId, for idempotent lookup)
```

**Port interface:**
```typescript
interface ICommunityIssueDraftStore {
  create(input: CreateCommunityIssueDraftInput): Promise<CommunityIssueDraft>;
  getById(draftId: string): Promise<CommunityIssueDraft | null>;
  getBySourceId(sourceId: string): Promise<CommunityIssueDraft | null>;
  publish(draftId: string, result: { githubIssueNumber: number; githubIssueUrl: string }): Promise<CommunityIssueDraft>;
  cancel(draftId: string): Promise<CommunityIssueDraft>;
}
```

**Step 1:** Write failing tests (Redis-backed, using `pnpm --filter @cat-cafe/api test:redis`):
- Create → draftId starts with `cid_`, status = draft
- GetById → returns copy, null on miss
- GetBySourceId → returns draft for source, null on miss
- Publish → sets status=published, publishedAt, githubIssueNumber, githubIssueUrl
- Publish non-draft → throws (INV-1)
- Cancel → sets status=cancelled, cancelledAt
- Cancel non-draft → throws (INV-1)
- Create duplicate sourceId → throws (INV-3)
- TTL = 0 (INV-6)

**Step 2:** Implement port interface

**Step 3:** Implement Redis adapter (same hydration pattern as RedisFrustrationIssueStore)

**Step 4:** Run tests green

**Step 5:** Commit: `feat(api): CommunityIssueDraftStore port + Redis impl (F235)`

---

### Task 4: F222 Source Adapter + FrustrationIssue Extension

**Files:**
- Create: `packages/api/src/domains/community/FrustrationIssueSourceAdapter.ts`
- Create: `packages/api/test/frustration-issue-source-adapter.test.js`
- Modify: `packages/shared/src/types/frustration-issue.ts` (add `communityIssueDraftId?`)
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisFrustrationIssueStore.ts` (persist new field)

**Source adapter responsibility:**
1. Validate FrustrationIssue is `status=confirmed`
2. Extract user-facing content from issue context
3. Format into community issue template (title from signal, body from context + user description)
4. Run sanitizer
5. Create draft in CommunityIssueDraftStore
6. Update FrustrationIssue with `communityIssueDraftId`

**Template for GitHub issue body:**
```markdown
## Problem
{userDescription || auto-generated summary from signalType}

## Context
- Signal type: {signalType}
{signalDetail-based context, sanitized}

## Steps to Reproduce
{extracted from recent messages, sanitized}

---
*Reported via Cat Cafe*
```

**Step 1:** Write failing tests:
- Confirmed issue → creates draft with sanitized content
- Draft issue → throws "issue not confirmed"
- Already has draftId → throws "already has draft" (INV-3)
- Content with internal IDs → sanitized in output

**Step 2:** Implement adapter

**Step 3:** Add `communityIssueDraftId?: string` to FrustrationIssue type + Redis store serialization

**Step 4:** Run all tests green (including existing F222 tests — no regression)

**Step 5:** Commit: `feat(api): F222 source adapter for community publisher pipeline (F235 KD-6)`

---

### Task 5: GitHubIssuePublisher

**Files:**
- Create: `packages/api/src/domains/community/GitHubIssuePublisher.ts`
- Create: `packages/api/test/github-issue-publisher.test.js`

**Design:** Raw `fetch` to GitHub REST API (consistent with project patterns, no SDK). Uses existing `GITHUB_TOKEN` from env-registry.

**Interface:**
```typescript
interface PublishResult {
  issueNumber: number;
  issueUrl: string;
}

interface IGitHubIssuePublisher {
  publish(input: {
    repo: string;       // 'owner/repo'
    title: string;
    body: string;
    labels: string[];
  }): Promise<PublishResult>;
}
```

**Step 1:** Write failing tests (mock fetch):
- Success → returns `{ issueNumber, issueUrl }`
- 401 → throws with auth error message
- 403 → throws with permission error
- 422 → throws with validation error
- 500 → throws with server error
- Network error → throws
- Missing token → throws "GITHUB_TOKEN not configured"
- Repo not in allowlist → throws (defense in depth, even though route also checks)

**Step 2:** Implement publisher:
```typescript
const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ title, body, labels }),
});
```

**Step 3:** Run tests green

**Step 4:** Commit: `feat(api): GitHubIssuePublisher via REST API (F235 KD-2)`

---

### Task 6: API Routes — Draft + Publish

**Files:**
- Create: `packages/api/src/routes/community-issue-draft-routes.ts`
- Create: `packages/api/test/routes/community-issue-draft-routes.test.js`
- Modify: `packages/api/src/index.ts` (register routes + wire DI)

**Endpoints:**

```
POST /api/community-issue-drafts/from-frustration-issue/:issueId
  → Creates draft from confirmed FrustrationIssue
  → Posts preview rich block message to thread
  → Returns { draft, messageId }

GET  /api/community-issue-drafts/:draftId
  → Returns draft status + content

POST /api/community-issue-drafts/:draftId/publish
  → Body: { title?, bodyMarkdown? } (user edits)
  → Re-sanitizes (KD-4)
  → Publishes to GitHub
  → Updates draft to published
  → Updates preview card message
  → Returns { draft, githubIssueUrl }

POST /api/community-issue-drafts/:draftId/cancel
  → Cancels draft
  → Returns { draft }
```

**Auth:** All routes require `X-Cat-Cafe-User`. Ownership check: `draft.userId !== userId → 403`.

**Step 1:** Write route tests (with mocked stores + publisher)

**Step 2:** Implement routes

**Step 3:** Wire into `index.ts` DI (create stores, pass to routes)

**Step 4:** Run tests green

**Step 5:** Commit: `feat(api): community issue draft API routes (F235)`

---

### Task 7: Preview Card Rich Block Builder

**Files:**
- Create: `packages/api/src/domains/community/community-issue-preview-card-builder.ts`
- Create: `packages/api/test/community-issue-preview-card-builder.test.js`

**Rich block structure:**
```typescript
function buildCommunityIssuePreviewCard(draft: CommunityIssueDraft): RichCardBlock {
  return {
    id: `community-preview-${draft.draftId}`,
    kind: 'card',
    v: 1,
    title: 'Publish to Community',
    bodyMarkdown: buildPreviewBody(draft),
    tone: 'info',
    fields: [
      { label: 'Repository', value: draft.targetRepo },
      { label: 'Labels', value: draft.labels.join(', ') },
      { label: 'Status', value: draft.status },
    ],
    meta: {
      kind: 'community_issue_preview',
      draftId: draft.draftId,
      sourceType: draft.sourceType,
      sourceId: draft.sourceId,
    },
  };
}
```

**Step 1:** Write failing tests (card shape, meta fields, body content)

**Step 2:** Implement builder + published-state variant (collapsed with GitHub link)

**Step 3:** Run tests green

**Step 4:** Commit: `feat(api): community issue preview card builder (F235)`

---

### Task 8: Frontend — Publish Button on FrustrationIssueCard

**Files:**
- Modify: `packages/web/src/components/rich/FrustrationIssueCard.tsx`

**Changes:**
1. In the confirmed expanded view (after the resolved header, line ~214), add "Publish to Community" button
2. New state: `'creating_draft'` for loading state
3. Button click → `POST /api/community-issue-drafts/from-frustration-issue/:issueId`
4. Success → the preview card appears as a new message in the thread (via server-side message post)
5. Show "已生成预览" indicator after successful draft creation
6. If draft already exists (409) → show "已有预览" with link to scroll

**IssueStatus union extension:**
```typescript
type IssueStatus = ... | 'creating_draft' | 'draft_created';
```

**Step 1:** Write the publish button UI in confirmed expanded view

**Step 2:** Add `handleCreateDraft` handler with API call

**Step 3:** Handle loading/error/success states

**Step 4:** Manual test in browser (worktree dev server)

**Step 5:** Commit: `feat(web): publish-to-community button on FrustrationIssueCard (F235 AC-A1)`

---

### Task 9: Frontend — CommunityIssuePreviewCard

**Files:**
- Create: `packages/web/src/components/rich/CommunityIssuePreviewCard.tsx`
- Modify: `packages/web/src/components/rich/RichBlocks.tsx` (dispatch)

**Component states:**
```
draft → editing → publishing → published
                 → cancelling → cancelled
                 → error (recoverable → back to editing)
```

**UI (matching wireframe `docs/designs/F235-publish-to-community.html`):**
- Draft/editing: editable title input, description textarea, repo display, labels, sanitizer warning, Submit + Cancel buttons
- Publishing: loading spinner on Submit
- Published: collapsed row with "confirmed" + "published" badges + GitHub issue link
- Cancelled: collapsed row with "cancelled" badge
- Error: error message + retry

**Step 1:** Create `CommunityIssuePreviewCard.tsx`:
- Type guard: `isCommunityIssuePreviewBlock(block, messageSource)` — `meta.kind === 'community_issue_preview'`
- Status hydration on mount (GET /api/community-issue-drafts/:draftId)
- Editable fields (controlled inputs)
- Submit handler: POST /api/community-issue-drafts/:draftId/publish with { title, bodyMarkdown }
- Cancel handler: POST /api/community-issue-drafts/:draftId/cancel

**Step 2:** Add dispatch in `RichBlocks.tsx`:
```typescript
// After FrustrationIssueCard check, before CallbackAuthFailureBlock
if (isCommunityIssuePreviewBlock(block, messageSource)) {
  return <CommunityIssuePreviewCard block={block} messageId={messageId} />;
}
```

**Step 3:** Manual browser test (full flow: confirm issue → click publish → edit → submit → see published card)

**Step 4:** Commit: `feat(web): CommunityIssuePreviewCard for publish flow (F235 AC-A2/A5)`

---

### Task 10: Integration Wiring + Config

**Files:**
- Modify: `packages/api/src/index.ts` (wire all new services)
- Modify: `packages/api/src/config/env-registry.ts` (add COMMUNITY_PUBLISH_DEFAULT_REPO, COMMUNITY_PUBLISH_REPO_ALLOWLIST)

**Config env vars:**
- `COMMUNITY_PUBLISH_DEFAULT_REPO` — default: `'clowder-ai/cat-cafe'`
- `COMMUNITY_PUBLISH_REPO_ALLOWLIST` — default: `'clowder-ai/cat-cafe'` (comma-separated)
- `GITHUB_TOKEN` — existing, used by publisher

**Wiring in index.ts:**
1. Create `RedisCommunityIssueDraftStore` with same Redis client
2. Create `CommunityIssueSanitizer` (stateless)
3. Create `GitHubIssuePublisher` with token from env
4. Create `FrustrationIssueSourceAdapter` with deps
5. Register `communityIssueDraftRoutes` with Fastify

**Step 1:** Add env vars to env-registry

**Step 2:** Wire all services in index.ts

**Step 3:** Run full `pnpm test` — no regressions

**Step 4:** `pnpm gate` equivalent check (build + lint + check)

**Step 5:** Commit: `feat(api): wire F235 community publisher pipeline (F235 AC-A4)`

---

## Test Coverage Matrix

| Invariant | Test File | Test Name |
|---|---|---|
| INV-1: Only draft → published/cancelled | community-issue-draft-store.test.js | "publish non-draft throws" / "cancel non-draft throws" |
| INV-2: Published needs github URL | community-issue-draft-store.test.js | "publish without URL throws" |
| INV-3: One source → one draft | community-issue-draft-store.test.js | "duplicate sourceId throws" |
| INV-4: No forbidden patterns after publish | community-issue-sanitizer.test.js | "re-sanitize catches injected threadId" |
| INV-5: Repo in allowlist | community-issue-draft-routes.test.js | "unknown repo rejected" |
| INV-6: TTL=0 persistent | community-issue-draft-store.test.js | "no TTL on redis keys" |
| AC-A3: No internal IDs in preview | community-issue-sanitizer.test.js | "sanitize strips threadId/userId/catId" |
| AC-A4: GitHub issue created | github-issue-publisher.test.js | "creates issue successfully" |
| AC-A6: GitHub fail → no data loss | community-issue-draft-routes.test.js | "publish with GitHub 500 → draft stays draft" |

## Commit Sequence

1. `feat(shared): add CommunityIssueDraft types (F235)` — Task 1
2. `feat(api): CommunityIssueSanitizer with whitelist + fail-closed (F235 KD-4)` — Task 2
3. `feat(api): CommunityIssueDraftStore port + Redis impl (F235)` — Task 3
4. `feat(api): F222 source adapter for community publisher pipeline (F235 KD-6)` — Task 4
5. `feat(api): GitHubIssuePublisher via REST API (F235 KD-2)` — Task 5
6. `feat(api): community issue draft API routes (F235)` — Task 6
7. `feat(api): community issue preview card builder (F235)` — Task 7
8. `feat(web): publish-to-community button on FrustrationIssueCard (F235 AC-A1)` — Task 8
9. `feat(web): CommunityIssuePreviewCard for publish flow (F235 AC-A2/A5)` — Task 9
10. `feat(api): wire F235 community publisher pipeline (F235 AC-A4)` — Task 10

## Open Questions

- **技术 OQ-T1:** CommunityIssueStore (F168) 幂等回写时机——Phase A 先跳过 F168 projection 对接，只在 CommunityIssueDraftStore 记录 published 状态。Phase B 加 reconciliation。
  - 回滚成本：低（加一个 projection 写入不影响已发布的 GitHub issues）
  - 自决：Phase A 不做 F168 projection，降低 scope。
