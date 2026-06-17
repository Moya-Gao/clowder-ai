---
feature_ids: [F235]
related_features: [F222, F168]
topics: [community, publishing, rich-block, cat-initiated]
doc_kind: plan
created: 2026-06-17
---

# F235 Phase B: Generic Community Publisher Implementation Plan

**Feature:** F235 — `docs/features/F235-feedback-to-community-publisher.md`
**Goal:** 猫猫在对话中可以直接生成一张社区 issue 发布卡片，用户编辑后一键发布到目标仓库
**Acceptance Criteria:**
- AC-B1: 猫猫可主动生成 `community_issue_draft` rich block 卡片（运行时验证）
- AC-B2: 卡片支持选择目标仓库（至少 cat-cafe + cat-cafe-tutorials）
- AC-B3: submit 流程复用 Phase A 的脱敏→发布→回链管线
**Architecture cell:** community-ops
**Map delta:** none（Phase A 已扩展 community-ops cell 为双向）
**Map delta why:** 复用 Phase A 建好的 publish 管线，不新增 cell
**Architecture:** Cat creates a `community_issue_draft` rich block card via `cat_cafe_create_rich_block`. Frontend renders inline editor with repo picker. On submit, frontend calls a new generic draft creation API → existing sanitize → publish pipeline. Two new API routes (generic create + config); one new frontend component.
**Tech Stack:** Fastify routes, Zod, React, existing CommunityIssueDraftStore/Sanitizer/Publisher
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测卡片交互

---

## Straight-Line Check

**Finish line (B):** 用户对猫说"帮我提个 issue"→ 猫生成预填卡片 → 用户编辑标题/描述/选仓库 → 一键发布到 GitHub → 看到成功链接。

**NOT building:** OAuth 用户 token（仍用 bot token，KD-2）；猫自动触发（猫只能建议，发布必须用户二次确认，KD-5）；rich block 规则注册（用 generic card，不注册新 kind）。

**Terminal schema:** Phase A 的 `CommunityIssueDraft` interface 不变，只扩展 `sourceType` 联合类型。

## Stateful Object Gate

### Census

| Object | Lifecycle owner | New in Phase B? |
|--------|----------------|-----------------|
| `CommunityIssueDraft` | `CommunityIssueDraftStore` | No — Phase A built, reuse as-is |
| Frontend card UI state | Component local state | Yes — but pure derivation of draft status, no persistence |

**CommunityIssueDraft 状态机 — Phase A 已定义，Phase B 无修改：**

| 状态 | 事件 | 目标 | 守卫 |
|------|------|------|------|
| `draft` | publish | `published` | sanitizer.passed + GitHub API success |
| `draft` | cancel | `cancelled` | not currently publishing |
| `published` | — | terminal | — |
| `cancelled` | — | terminal | — |

**不变量（Phase A INV 全部继承）：**
- INV-1: `published`/`cancelled` 不可逆
- INV-2: 一个 sourceId 同时只有一个 non-cancelled draft
- INV-3: publish 前必须 re-sanitize

**Phase B 新增不变量：**
- INV-B1: `cat_initiated` drafts 的 sourceId 由前端生成（block message ID），保证幂等
- INV-B2: `targetRepo` 必须在 `repoAllowlist` 内（server-side 验证）

**对抗场景：** 全部复用 Phase A 已有测试（in-process debounce、409 recovery、store-after-GitHub-failure retry）。Phase B 新增：用户选了不在 allowlist 的 repo → server 400 拒绝。

---

## Task 1: Extend shared types — add `cat_initiated` source type

**Files:**
- Modify: `packages/shared/src/types/community-issue-draft.ts:24`

**Step 1: Write failing test**

```typescript
// packages/shared/src/types/__tests__/community-issue-draft.test.ts
it('accepts cat_initiated as sourceType', () => {
  const draft = createCommunityIssueDraft({
    sourceType: 'cat_initiated',
    sourceId: 'conv_test_123',
    title: 'Test issue',
    bodyMarkdown: 'Test body',
    targetRepo: 'clowder-ai/cat-cafe',
    labels: ['user-reported'],
    threadId: 'thread_test',
    userId: 'user_test',
  });
  expect(draft.sourceType).toBe('cat_initiated');
  expect(draft.status).toBe('draft');
});
```

**Step 2:** Run test → FAIL (TypeScript: `'cat_initiated'` not assignable to `CommunityIssueDraftSourceType`)

**Step 3:** Extend union type:

```typescript
// community-issue-draft.ts:24
export type CommunityIssueDraftSourceType = 'frustration_issue' | 'cat_initiated';
```

**Step 4:** Run test → PASS

**Step 5:** Rebuild shared: `pnpm --filter @cat-cafe/shared build`

**Step 6:** Commit: `feat(f235-b): extend CommunityIssueDraftSourceType with cat_initiated`

---

## Task 2: API — generic draft creation endpoint + config endpoint

**Files:**
- Modify: `packages/api/src/routes/community-issue-draft-routes.ts`
- Test: `packages/api/test/community/community-issue-draft-generic.test.js` (new)

### Step 1: Write failing tests for generic create

```javascript
// community-issue-draft-generic.test.js
describe('POST /api/community-issue-drafts (generic create)', () => {
  it('creates a cat_initiated draft with valid input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/community-issue-drafts',
      headers: { 'x-cat-cafe-user': 'user_test' },
      payload: {
        sourceType: 'cat_initiated',
        sourceId: 'conv_123',
        title: 'Bug: tool calls fail silently',
        bodyMarkdown: '## Problem\n\nTool calls return empty...',
        targetRepo: 'clowder-ai/cat-cafe',
        labels: ['bug'],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.draft.sourceType).toBe('cat_initiated');
    expect(body.draft.status).toBe('draft');
  });

  it('rejects repo not in allowlist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/community-issue-drafts',
      headers: { 'x-cat-cafe-user': 'user_test' },
      payload: {
        sourceType: 'cat_initiated',
        sourceId: 'conv_456',
        title: 'Test',
        bodyMarkdown: 'body',
        targetRepo: 'evil-org/evil-repo',
        labels: [],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('defaults to defaultRepo when targetRepo omitted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/community-issue-drafts',
      headers: { 'x-cat-cafe-user': 'user_test' },
      payload: {
        sourceType: 'cat_initiated',
        sourceId: 'conv_789',
        title: 'Test',
        bodyMarkdown: 'body',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).draft.targetRepo).toBe('clowder-ai/cat-cafe');
  });

  it('sanitizes content on creation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/community-issue-drafts',
      headers: { 'x-cat-cafe-user': 'user_test' },
      payload: {
        sourceType: 'cat_initiated',
        sourceId: 'conv_sanitize',
        title: 'Test with sk-abc123def secret',
        bodyMarkdown: 'body with /Users/lysander/path',
        targetRepo: 'clowder-ai/cat-cafe',
      },
    });
    expect(res.statusCode).toBe(200);
    const draft = JSON.parse(res.payload).draft;
    expect(draft.title).not.toContain('sk-abc123def');
    expect(draft.bodyMarkdown).not.toContain('/Users/lysander');
  });
});

describe('GET /api/community-issue-drafts/config', () => {
  it('returns defaultRepo and repos list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/community-issue-drafts/config',
      headers: { 'x-cat-cafe-user': 'user_test' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.defaultRepo).toBe('clowder-ai/cat-cafe');
    expect(body.repos).toContain('clowder-ai/cat-cafe');
  });
});
```

### Step 2: Run tests → FAIL (routes don't exist)

### Step 3: Implement routes

Add to `community-issue-draft-routes.ts`:

**Generic create schema:**
```typescript
const genericCreateBodySchema = z.object({
  sourceType: z.enum(['cat_initiated']),
  sourceId: z.string().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  bodyMarkdown: z.string().trim().min(1).max(10000),
  targetRepo: z.string().max(200).optional(),
  labels: z.array(z.string().max(50)).max(10).optional(),
});
```

**POST /api/community-issue-drafts** (generic create):
- Strict user auth
- Validate body
- `targetRepo` defaults to config.defaultRepo; reject if not in allowlist
- Sanitize title + body
- Create draft in store
- Return `{ draft }`

**GET /api/community-issue-drafts/config** (repo config):
- User auth (non-strict OK — read-only)
- Return `{ defaultRepo, repos: config.repoAllowlist }`

### Step 4: Run tests → PASS

### Step 5: Commit: `feat(f235-b): generic draft creation + config endpoints`

---

## Task 3: Frontend — CommunityIssueDraftCard with repo picker

**Files:**
- Create: `packages/web/src/components/rich/CommunityIssueDraftCard.tsx`
- Create: `packages/web/src/components/rich/__tests__/CommunityIssueDraftCard.test.tsx`
- Modify: `packages/web/src/components/rich/RichBlocks.tsx` (add routing)

### Card behavior

Cat creates a card with:
```json
{
  "kind": "card",
  "v": 1,
  "title": "Publish to Community",
  "bodyMarkdown": "**Bug: tool calls fail silently**\n\n...",
  "tone": "info",
  "meta": {
    "kind": "community_issue_draft",
    "proposedTitle": "Bug: tool calls fail silently",
    "proposedBody": "## Problem\n\nTool calls return empty...",
    "proposedRepo": "clowder-ai/cat-cafe",
    "proposedLabels": ["bug"]
  }
}
```

**States:** `editing` → `creating` → `publishing` → `published` | `error`

On mount:
1. Fetch repo config from `GET /api/community-issue-drafts/config`
2. Populate editable fields from meta (title, body, repo, labels)
3. Show repo picker dropdown with allowlist repos

On "Submit to GitHub":
1. `POST /api/community-issue-drafts` → creates draft (sanitized) → get draftId
2. `POST /api/community-issue-drafts/:draftId/publish` with user edits → publish
3. Show published state with GitHub link

On error at any step: show error message, stay in editing state for retry.

### Step 1: Write failing tests

```typescript
// CommunityIssueDraftCard.test.tsx
describe('CommunityIssueDraftCard', () => {
  it('renders editable title and body from meta', async () => { ... });
  it('fetches and renders repo picker with allowlist', async () => { ... });
  it('creates draft and publishes on submit', async () => { ... });
  it('shows error if publish fails', async () => { ... });
  it('shows published state with GitHub link', async () => { ... });
  it('defaults to proposedRepo in picker', async () => { ... });
});
```

### Step 2: Run tests → FAIL

### Step 3: Implement CommunityIssueDraftCard

~120 lines: editable title input + body textarea + repo `<select>` dropdown + "Submit to GitHub" / error display / published state. Two API calls on submit (create → publish), chained with error handling.

### Step 4: Run tests → PASS

### Step 5: Add routing in RichBlocks.tsx

```typescript
// In RichBlocks.tsx, after imports:
import { CommunityIssueDraftCard, isCommunityIssueDraftBlock } from './CommunityIssueDraftCard';

// In case 'card': block, after community_issue_preview check:
if (isCommunityIssueDraftBlock(block)) {
  return <CommunityIssueDraftCard block={block} />;
}
```

Detection function (no connector check — cat messages are inherently trusted source):
```typescript
export function isCommunityIssueDraftBlock(block: RichCardBlock): boolean {
  return (block.meta as { kind?: string } | undefined)?.kind === 'community_issue_draft';
}
```

### Step 6: Run full web tests → PASS

### Step 7: Commit: `feat(f235-b): CommunityIssueDraftCard with repo picker`

---

## Task 4: Wire up + update repo allowlist config

**Files:**
- Modify: `packages/api/src/index.ts` (~line 2520) — ensure `COMMUNITY_PUBLISH_REPO_ALLOWLIST` includes `clowder-ai/cat-cafe-tutorials`
- Modify: `.env.example` — document the allowlist env var

### Step 1: Verify `.env` or `.env.local` has tutorials repo in allowlist

```bash
# .env.local should have:
COMMUNITY_PUBLISH_REPO_ALLOWLIST=clowder-ai/cat-cafe,clowder-ai/cat-cafe-tutorials
```

### Step 2: Commit: `chore(f235-b): add cat-cafe-tutorials to publish repo allowlist`

---

## Task 5: End-to-end integration test

**Files:**
- Create: `packages/api/test/community/community-draft-e2e.test.js`

### Step 1: Write e2e test

```javascript
describe('F235 Phase B: cat-initiated draft → publish e2e', () => {
  it('generic create → get → publish → get shows published', async () => {
    // 1. Create draft
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/community-issue-drafts',
      headers: { 'x-cat-cafe-user': 'user_test' },
      payload: {
        sourceType: 'cat_initiated',
        sourceId: 'e2e_test_1',
        title: 'E2E: test issue',
        bodyMarkdown: '## Problem\n\nTest e2e flow',
        targetRepo: 'clowder-ai/cat-cafe',
        labels: ['test'],
      },
    });
    expect(createRes.statusCode).toBe(200);
    const { draftId } = JSON.parse(createRes.payload).draft;

    // 2. Get draft — verify content sanitized
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/community-issue-drafts/${draftId}`,
      headers: { 'x-cat-cafe-user': 'user_test' },
    });
    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.payload).draft.status).toBe('draft');

    // 3. Publish (mocked GitHub)
    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/community-issue-drafts/${draftId}/publish`,
      headers: { 'x-cat-cafe-user': 'user_test' },
      payload: { title: 'E2E: edited title' },
    });
    expect(pubRes.statusCode).toBe(200);
    expect(JSON.parse(pubRes.payload).draft.status).toBe('published');
    expect(JSON.parse(pubRes.payload).githubIssueUrl).toBeTruthy();

    // 4. Get again — published is terminal
    const finalRes = await app.inject({
      method: 'GET',
      url: `/api/community-issue-drafts/${draftId}`,
      headers: { 'x-cat-cafe-user': 'user_test' },
    });
    expect(JSON.parse(finalRes.payload).draft.status).toBe('published');
  });
});
```

### Step 2: Run → PASS (routes + store from Tasks 1-2)

### Step 3: Commit: `test(f235-b): e2e generic draft → publish flow`

---

## Open Questions

| # | 类型 | 问题 | 决策 |
|---|------|------|------|
| OQ-1 | 技术 | 前端 repo picker 需要获取 labels 选项吗？ | Phase B 只固定几个预设 label（bug/ux/feature-request），Phase C 可加动态 label API。YAGNI。 |
| OQ-2 | 技术 | `isCommunityIssueDraftBlock` 不检查 connector provenance 是否安全？ | 安全。猫创建的 card 来自 cat message（inherently trusted）。Phase A 的 connector 检查是因为 community-publisher 是外部系统生成的 card，需要验证来源。Phase B card 由猫直接在对话中生成。 |

---

## Verification Checklist

- [ ] `pnpm --filter @cat-cafe/shared build` passes
- [ ] `pnpm --filter @cat-cafe/api test` — all community draft tests green
- [ ] `pnpm --filter @cat-cafe/web test` — CommunityIssueDraftCard tests green
- [ ] `pnpm gate` — full green
- [ ] Manual: 在对话中猫猫生成 community_issue_draft 卡片 → 显示预览 → 选仓库 → 编辑 → submit → GitHub issue 创建成功
