---
feature_ids: [F091]
created: 2026-03-10
author: 布偶猫
---

# F091 Signal Study Mode — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Upgrade Signal from RSS reader to learning companion — article management, thread-study association, inline reading, podcast generation, multi-cat research.

**Architecture:** Four-layer dependency topology: (1) data model + API, (2) MCP tools, (3) system prompt injection + evidence pack, (4) frontend. Each layer builds on the previous. No throwaway scaffolding — every step produces final-form output.

**Tech Stack:** TypeScript, Fastify, Zod, React, Tailwind, react-markdown, Redis, MCP SDK, Qwen3-TTS.

**Spec:** `docs/features/F091-signal-study-mode.md` (24 requirements, 24 AC, 18 decisions)

---

## Layer 1: Data Model + Backend API

### Task 1.1: Extend SignalArticle shared types (R15, R20, R21)

**Files:**
- Modify: `packages/shared/src/types/signals.ts`
- Modify: `packages/shared/src/schemas/signals.schema.ts`

**Step 1: Add new fields to SignalArticle interface**

```typescript
// In signals.ts — add to SignalArticle interface:
readonly note?: string;           // R15: 铲屎官个人备注
readonly deletedAt?: string;       // R20: 软删除时间戳
readonly studyCount?: number;      // R4: study 计数（衍生值）
readonly lastStudiedAt?: string;   // R4: 最后学习时间
```

**Step 2: Add Zod schema fields**

```typescript
// In signals.schema.ts — add to SignalArticleInput:
note: z.string().optional(),
deletedAt: z.string().datetime().optional(),
studyCount: z.number().int().nonneg().optional(),
lastStudiedAt: z.string().datetime().optional(),
```

**Step 3: Add SignalArticleUpdateInput extension**

```typescript
// In signals.schema.ts — extend update input:
export const SignalArticleUpdateInputSchema = z.object({
  status: SignalArticleStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
  note: z.string().optional(),        // NEW
  deletedAt: z.string().datetime().optional(), // NEW
});
export type SignalArticleUpdateInput = z.infer<typeof SignalArticleUpdateInputSchema>;
```

**Step 4: Rebuild shared package**

Run: `pnpm --filter @cat-cafe/shared build`

**Step 5: Commit**

```
feat(F091): extend SignalArticle with note/deletedAt/studyCount fields
```

---

### Task 1.2: Extend backend PATCH endpoint (R15, R20)

**Files:**
- Modify: `packages/api/src/routes/signals.ts` (PATCH handler, ~line 200)
- Modify: `packages/api/src/domains/signals/services/article-query-service.ts` (updateArticle)
- Test: `test/signals/article-update.test.js` (new)

**Step 1: Write failing test — update note**

```javascript
test('PATCH /api/signals/articles/:id with note updates frontmatter', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/signals/articles/${testArticleId}`,
    headers: { 'x-cat-cafe-user': 'opus' },
    payload: { note: '下次和砚砚讨论' },
  });
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.strictEqual(body.note, '下次和砚砚讨论');
});
```

**Step 2: Run test — expect FAIL** (note field not accepted)

**Step 3: Update PATCH handler to accept note and deletedAt**

In `signals.ts` PATCH handler body schema, add `note` and `deletedAt` fields.
In `article-query-service.ts` `updateArticle()`, the `toUpdatedFrontmatter()` already preserves custom fields — just ensure `note` and `deletedAt` flow through.

**Step 4: Run test — expect PASS**

**Step 5: Write failing test — soft delete**

```javascript
test('PATCH with deletedAt soft-deletes article', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/signals/articles/${testArticleId}`,
    headers: { 'x-cat-cafe-user': 'opus' },
    payload: { deletedAt: new Date().toISOString() },
  });
  assert.strictEqual(res.statusCode, 200);
  // Verify article no longer appears in inbox
  const inbox = await app.inject({
    method: 'GET',
    url: '/api/signals/inbox',
    headers: { 'x-cat-cafe-user': 'opus' },
  });
  const articles = JSON.parse(inbox.payload);
  assert.ok(!articles.find(a => a.id === testArticleId));
});
```

**Step 6: Update listInbox to filter out deletedAt articles**

In `article-query-service.ts` `listInbox()`, after parsing frontmatter, skip articles where `frontmatter.deletedAt` is truthy.

**Step 7: Run tests — expect PASS**

**Step 8: Commit**

```
feat(F091): PATCH endpoint accepts note + deletedAt for soft-delete
```

---

### Task 1.3: Add DELETE endpoint (R14)

**Files:**
- Modify: `packages/api/src/routes/signals.ts`
- Test: `test/signals/article-delete.test.js` (new)

**Step 1: Write failing test**

```javascript
test('DELETE /api/signals/articles/:id soft-deletes', async () => {
  const res = await app.inject({
    method: 'DELETE',
    url: `/api/signals/articles/${testArticleId}`,
    headers: { 'x-cat-cafe-user': 'opus' },
  });
  assert.strictEqual(res.statusCode, 200);
});
```

**Step 2: Implement DELETE route**

Internally calls `updateArticle(id, { deletedAt: new Date().toISOString() })`. This is a convenience endpoint — same effect as PATCH with deletedAt.

**Step 3: Run test — expect PASS**

**Step 4: Add batch delete endpoint**

```
POST /api/signals/articles/batch-delete
Body: { ids: string[] }
```

Iterates and soft-deletes each. Returns `{ deleted: number }`.

**Step 5: Commit**

```
feat(F091): DELETE endpoint + batch-delete for article cleanup
```

---

### Task 1.4: Study sidecar model + meta.json (R8, Decision #16)

**Files:**
- Create: `packages/api/src/domains/signals/services/study-meta-service.ts`
- Create: `packages/shared/src/types/study.ts`
- Test: `test/signals/study-meta.test.js` (new)

**Step 1: Define StudyMeta types**

```typescript
// packages/shared/src/types/study.ts
export type ArtifactJobState = 'queued' | 'running' | 'ready' | 'failed';

export interface StudyArtifact {
  readonly id: string;
  readonly kind: 'note' | 'podcast' | 'research-report';
  readonly createdAt: string;
  readonly createdBy: string; // catId
  readonly state: ArtifactJobState; // R24
  readonly filePath: string; // relative to sidecar dir
  readonly metadata?: Record<string, unknown>;
}

export interface StudyThreadLink {
  readonly threadId: string;
  readonly linkedAt: string;
  readonly linkedBy: string;
  readonly stale?: boolean; // R22: thread deleted
}

export interface StudyMeta {
  readonly articleId: string;
  readonly threads: readonly StudyThreadLink[];
  readonly artifacts: readonly StudyArtifact[];
  readonly collections: readonly string[]; // R18: collection IDs
  readonly lastStudiedAt?: string;
}
```

**Step 2: Write failing test — read/write meta.json**

```javascript
test('StudyMetaService creates and reads sidecar meta.json', async () => {
  const svc = new StudyMetaService(signalPaths);
  await svc.ensureSidecar(articleId);
  const meta = await svc.readMeta(articleId);
  assert.strictEqual(meta.articleId, articleId);
  assert.deepStrictEqual(meta.threads, []);
});
```

**Step 3: Implement StudyMetaService**

```typescript
export class StudyMetaService {
  // Sidecar path: {libraryDir}/{sourceId}/{articleId}/meta.json
  // Adjacent to article markdown file

  async ensureSidecar(articleId: string): Promise<string>; // returns sidecar dir
  async readMeta(articleId: string): Promise<StudyMeta>;
  async writeMeta(articleId: string, meta: StudyMeta): Promise<void>;
  async linkThread(articleId: string, link: StudyThreadLink): Promise<StudyMeta>;
  async unlinkThread(articleId: string, threadId: string): Promise<StudyMeta>;
  async addArtifact(articleId: string, artifact: StudyArtifact): Promise<StudyMeta>;
  async updateArtifactState(articleId: string, artifactId: string, state: ArtifactJobState): Promise<StudyMeta>;
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```
feat(F091): StudyMeta sidecar model + meta.json read/write service
```

---

### Task 1.5: Thread-Signal link API (R11, R22)

**Files:**
- Modify: `packages/api/src/routes/signals.ts`
- Test: `test/signals/thread-link.test.js` (new)

**Step 1: Write failing tests for link/unlink**

```javascript
test('POST /api/signals/articles/:id/threads links a thread', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `/api/signals/articles/${articleId}/threads`,
    headers: { 'x-cat-cafe-user': 'opus' },
    payload: { threadId: 'thread_abc123' },
  });
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.ok(body.threads.some(t => t.threadId === 'thread_abc123'));
});

test('duplicate thread link is idempotent', async () => {
  // Link same thread twice → only one entry
  await app.inject({ method: 'POST', url: `...`, payload: { threadId: 'thread_abc123' } });
  await app.inject({ method: 'POST', url: `...`, payload: { threadId: 'thread_abc123' } });
  const meta = await studyMetaService.readMeta(articleId);
  const links = meta.threads.filter(t => t.threadId === 'thread_abc123');
  assert.strictEqual(links.length, 1);
});
```

**Step 2: Implement POST /api/signals/articles/:id/threads**

Uses `StudyMetaService.linkThread()`. Dedup by threadId.

**Step 3: Implement DELETE /api/signals/articles/:id/threads/:threadId**

Uses `StudyMetaService.unlinkThread()`.

**Step 4: Implement GET /api/signals/articles/:id/study**

Returns full `StudyMeta` for the article.

**Step 5: Run tests — expect PASS**

**Step 6: Commit**

```
feat(F091): thread-signal link API (link/unlink/get study meta)
```

---

### Task 1.6: Batch operations API (R16)

**Files:**
- Modify: `packages/api/src/routes/signals.ts`
- Test: `test/signals/batch-ops.test.js` (new)

**Step 1: Write failing test**

```javascript
test('POST /api/signals/articles/batch applies operations', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/signals/articles/batch',
    headers: { 'x-cat-cafe-user': 'opus' },
    payload: {
      ids: [id1, id2, id3],
      action: 'update',
      fields: { status: 'archived' },
    },
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.payload).updated, 3);
});
```

**Step 2: Implement batch endpoint**

```
POST /api/signals/articles/batch
Body: { ids: string[], action: 'update' | 'delete', fields?: SignalArticleUpdateInput }
```

- `action: 'update'` → PATCH each with fields
- `action: 'delete'` → soft-delete each

**Step 3: Run tests — expect PASS**

**Step 4: Commit**

```
feat(F091): batch operations endpoint (update/delete multiple articles)
```

---

## Layer 2: MCP Tools

### Task 2.1: signal_update_article MCP tool (Decision #15)

**Files:**
- Modify: `packages/mcp-server/src/tools/signals-tools.ts`
- Test: MCP tool integration test

**Step 1: Add tool definition to signalsTools array**

```typescript
{
  name: 'signal_update_article',
  description: 'Update article fields: status, tags, note, or soft-delete. Use for managing articles from chat.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Article ID' },
      status: { type: 'string', enum: ['inbox', 'read', 'archived', 'starred'] },
      tags: { type: 'array', items: { type: 'string' } },
      note: { type: 'string', description: '铲屎官个人备注' },
    },
    required: ['id'],
  },
}
```

**Step 2: Implement handler**

```typescript
async function handleSignalUpdateArticle(args: Record<string, unknown>) {
  const { id, ...fields } = args;
  const result = await apiJson(`/api/signals/articles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
  if (!result.ok) return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
  return { content: [{ type: 'text', text: `Updated article ${id}: ${JSON.stringify(fields)}` }] };
}
```

**Step 3: Commit**

```
feat(F091): signal_update_article MCP tool
```

---

### Task 2.2: signal_delete_article MCP tool (R14)

**Files:**
- Modify: `packages/mcp-server/src/tools/signals-tools.ts`

**Step 1: Add tool definition**

```typescript
{
  name: 'signal_delete_article',
  description: 'Soft-delete one or more articles. Use when 铲屎官 says "删掉这篇" or wants to clean up garbage.',
  inputSchema: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string' }, description: 'Article IDs to delete' },
    },
    required: ['ids'],
  },
}
```

**Step 2: Implement handler** — calls batch-delete endpoint

**Step 3: Commit**

```
feat(F091): signal_delete_article MCP tool
```

---

### Task 2.3: signal_link_thread MCP tool (R11)

**Files:**
- Modify: `packages/mcp-server/src/tools/signals-tools.ts`

**Step 1: Add tool definition**

```typescript
{
  name: 'signal_link_thread',
  description: 'Link a Signal article to a thread for Study association. Creates bidirectional thread-study relationship.',
  inputSchema: {
    type: 'object',
    properties: {
      articleId: { type: 'string' },
      threadId: { type: 'string' },
      action: { type: 'string', enum: ['link', 'unlink'], default: 'link' },
    },
    required: ['articleId', 'threadId'],
  },
}
```

**Step 2: Implement handler** — calls POST/DELETE thread-link endpoint

**Step 3: Commit**

```
feat(F091): signal_link_thread MCP tool
```

---

### Task 2.4: start_study + save_notes + list_studies + generate_podcast MCP tools (R7)

**Files:**
- Modify: `packages/mcp-server/src/tools/signals-tools.ts`

**Step 1: Add start_study tool**

```typescript
{
  name: 'signal_start_study',
  description: 'Start studying a Signal article. Links to current or new thread, injects article context.',
  inputSchema: {
    type: 'object',
    properties: {
      articleId: { type: 'string' },
      threadId: { type: 'string', description: 'Thread to link (omit for current thread)' },
    },
    required: ['articleId'],
  },
}
```

Handler: calls thread-link API + returns article content for context injection.

**Step 2: Add save_notes tool**

```typescript
{
  name: 'signal_save_notes',
  description: 'Archive study notes for an article. Notes include insights, reflections, open questions. Requires user confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      articleId: { type: 'string' },
      notes: { type: 'string', description: 'Markdown formatted study notes' },
      participants: { type: 'array', items: { type: 'string' }, description: 'Cat IDs who participated' },
    },
    required: ['articleId', 'notes'],
  },
}
```

Handler: creates `{sidecarDir}/notes/{timestamp}-{catId}.md`, adds artifact to meta.json.

**Step 3: Add list_studies tool**

```typescript
{
  name: 'signal_list_studies',
  description: 'List study artifacts (notes, podcasts, reports) for an article or across all articles.',
  inputSchema: {
    type: 'object',
    properties: {
      articleId: { type: 'string', description: 'Optional: filter by article' },
      kind: { type: 'string', enum: ['note', 'podcast', 'research-report'] },
      limit: { type: 'number', default: 20 },
    },
  },
}
```

**Step 4: Add generate_podcast tool**

```typescript
{
  name: 'signal_generate_podcast',
  description: 'Generate podcast from article study. Two modes: essence (2-3 min) or deep (10 min). Uses TTS with cat voice clones.',
  inputSchema: {
    type: 'object',
    properties: {
      articleId: { type: 'string' },
      mode: { type: 'string', enum: ['essence', 'deep'] },
      speakers: { type: 'array', items: { type: 'string' }, description: 'Cat IDs for voices (1-3)' },
    },
    required: ['articleId', 'mode'],
  },
}
```

Handler: generates script → TTS synthesis → stores audio + transcript in sidecar.

**Step 5: Commit**

```
feat(F091): 4 study MCP tools (start_study/save_notes/list_studies/generate_podcast)
```

---

## Layer 3: System Prompt + Evidence Pack

### Task 3.1: Article context injection (R2, R23)

**Files:**
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`
- Modify: `packages/shared/src/types/...` (InvocationContext)
- Test: `test/system-prompt-builder.test.js` (existing — run after!)

**Step 1: Add activeSignals to InvocationContext**

```typescript
// Add to InvocationContext interface:
activeSignals?: readonly { id: string; title: string; source: string; tier: number; url: string }[];
```

**Step 2: Add signal context section to buildInvocationContext()**

```typescript
// After active participants section:
if (ctx.activeSignals?.length) {
  parts.push('## 当前讨论的 Signal 文章');
  for (const s of ctx.activeSignals) {
    parts.push(`- **[${s.id}]** ${s.title} (T${s.tier}, ${s.source})`);
    parts.push(`  URL: ${s.url}`);
  }
}
```

**Step 3: Run guard test**

Run: `node --test test/system-prompt-builder.test.js`

If size guard fails → adjust threshold or compress format.

**Step 4: Commit**

```
feat(F091): inject Signal article context into system prompt
```

---

### Task 3.2: Evidence pack assembly (R23, Decision #17)

**Files:**
- Create: `packages/api/src/domains/signals/services/evidence-pack.ts`
- Test: `test/signals/evidence-pack.test.js` (new)

**Step 1: Define evidence pack interface**

```typescript
export interface EvidencePack {
  readonly articleContent: string;     // Full article markdown
  readonly articleNote?: string;       // 铲屎官 note
  readonly linkedThreads: readonly { threadId: string; summary?: string }[];
  readonly latestStudyNote?: string;   // Most recent study note content
}
```

**Step 2: Implement assembleEvidencePack()**

```typescript
export async function assembleEvidencePack(
  articleId: string,
  queryService: SignalArticleQueryService,
  studyMetaService: StudyMetaService,
): Promise<EvidencePack> {
  const article = await queryService.getArticleById(articleId);
  if (!article) throw new Error(`Article ${articleId} not found`);

  const meta = await studyMetaService.readMeta(articleId);
  const activeThreads = meta.threads.filter(t => !t.stale).slice(0, 3); // max 3

  const latestNote = meta.artifacts
    .filter(a => a.kind === 'note' && a.state === 'ready')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return {
    articleContent: article.content,
    articleNote: article.note,
    linkedThreads: activeThreads.map(t => ({ threadId: t.threadId })),
    latestStudyNote: latestNote ? await readFile(latestNote.filePath, 'utf-8') : undefined,
  };
}
```

**Step 3: Run tests — expect PASS**

**Step 4: Commit**

```
feat(F091): evidence pack assembly for "先搜后聊" pre-discussion context
```

---

## Layer 4: Frontend

### Task 4.1: Frontend API layer extensions (R14, R15, R16)

**Files:**
- Modify: `packages/web/src/utils/signals-api.ts`

**Step 1: Add new API functions**

```typescript
export async function deleteSignalArticle(articleId: string): Promise<void> { ... }
export async function batchDeleteSignalArticles(ids: string[]): Promise<{ deleted: number }> { ... }
export async function batchUpdateSignalArticles(ids: string[], fields: SignalArticleUpdateInput): Promise<{ updated: number }> { ... }
export async function fetchStudyMeta(articleId: string): Promise<StudyMeta> { ... }
export async function linkThread(articleId: string, threadId: string): Promise<StudyMeta> { ... }
```

**Step 2: Update SignalArticleUpdateInput type**

Add `note?: string` and `deletedAt?: string`.

**Step 3: Commit**

```
feat(F091): frontend API layer — delete, batch ops, study meta, thread link
```

---

### Task 4.2: Signal Inbox list redesign (R13, R17, AC-13)

**Files:**
- Modify: `packages/web/src/components/signals/SignalInboxView.tsx`
- Modify: `packages/web/src/components/signals/SignalArticleList.tsx`

**Step 1: Add source filter dropdown**

Above article list, add a `<select>` or combobox populated from `fetchSignalSources()`.
Filter articles by selected source client-side (current page) + pass to API on next fetch.

**Step 2: Add "已学习" tab**

Current tabs: 全部 / 未读 / 收藏. Add: 已学习 (filter by `studyCount > 0`).

**Step 3: Add study badge to list items**

In `SignalArticleList.tsx`, show green badge with study count when `article.studyCount > 0`.

**Step 4: Add unread dot indicator**

Articles with `status === 'inbox'` get a small dot indicator.

**Step 5: Commit**

```
feat(F091): Signal Inbox redesign — source filter, study badges, unread dots
```

---

### Task 4.3: Batch selection UI (R16)

**Files:**
- Modify: `packages/web/src/components/signals/SignalArticleList.tsx`
- Modify: `packages/web/src/components/signals/SignalInboxView.tsx`

**Step 1: Add selection mode**

Toggle "选择" mode → show checkboxes on each list item.
Track `selectedIds: Set<string>` in state.

**Step 2: Add batch action bar**

When `selectedIds.size > 0`, show floating action bar:
- 删除 (batch soft-delete)
- 标已读 (batch update status: 'read')
- 归档 (batch update status: 'archived')

**Step 3: Wire to batch API**

Call `batchDeleteSignalArticles()` or `batchUpdateSignalArticles()` → refresh list.

**Step 4: Commit**

```
feat(F091): batch selection UI + action bar for article management
```

---

### Task 4.4: Article detail — note editor + delete button (R14, R15)

**Files:**
- Modify: `packages/web/src/components/signals/SignalArticleDetail.tsx`

**Step 1: Add note field**

Below summary, add a collapsible "备注" textarea.
On blur/save, call `updateSignalArticle(id, { note })`.

**Step 2: Add delete button**

Add "删除" button (with confirmation dialog). Calls `deleteSignalArticle(id)`.

**Step 3: Show note icon in list**

In `SignalArticleList.tsx`, show a small icon when `article.note` is truthy. Tooltip shows note preview.

**Step 4: Commit**

```
feat(F091): article detail — note editor + delete with confirmation
```

---

### Task 4.5: Study fold area (R4, AC-4)

**Files:**
- Modify: `packages/web/src/components/signals/SignalArticleDetail.tsx`
- Create: `packages/web/src/components/signals/StudyFoldArea.tsx`

**Step 1: Create StudyFoldArea component**

```tsx
interface StudyFoldAreaProps {
  readonly articleId: string;
  readonly studyMeta: StudyMeta | null;
  readonly onStartStudy: () => void;
}
```

- Collapsible area with light gray background
- Shows: linked threads list, notes cards, podcast cards
- "开始学习" button (purple) + "在对话中讨论" button (gray)

**Step 2: Integrate into SignalArticleDetail**

After AI summary section, render `<StudyFoldArea>`.
Fetch `studyMeta` on article selection change.

**Step 3: Thread list with jump**

Each linked thread shows as a clickable row → navigates to `/thread/{threadId}`.

**Step 4: Commit**

```
feat(F091): Study fold area with thread links, notes, podcast cards
```

---

### Task 4.6: Inline markdown article reading (R12, AC-12)

**Files:**
- Modify: `packages/web/src/components/signals/SignalArticleDetail.tsx`
- Existing: `packages/web/src/components/MarkdownContent.tsx` (reuse)

**Step 1: Add "阅读原文" view mode**

Toggle between "摘要视图" and "原文视图".
In 原文视图, render full `article.content` via `<MarkdownContent content={article.content} />`.

**Step 2: Add navigation header**

"← 返回详情" link + "在浏览器打开" fallback button (opens `article.url`).

**Step 3: Article metadata bar**

Show Tier badge + source + date above the rendered markdown.

**Step 4: Commit**

```
feat(F091): inline markdown article reading (no browser jump)
```

---

### Task 4.7: Thread-Study association UI (R11, R22)

**Files:**
- Create: `packages/web/src/components/signals/ThreadStudyPicker.tsx`
- Modify: `packages/web/src/components/signals/StudyFoldArea.tsx`

**Step 1: Create ThreadStudyPicker modal**

When "开始学习" is clicked, show picker with three options:
1. "新开 Thread" → create thread + link
2. "关联已有 Thread" → thread search/select → link
3. "挂载 Thread" → thread search/select → link (mount existing)

Default: if article already has linked threads, show "继续最近 thread" as primary option.

**Step 2: Wire to API**

On selection, call `linkThread(articleId, threadId)` → navigate to thread.

**Step 3: Commit**

```
feat(F091): Thread-Study picker (new/associate/mount thread)
```

---

## Layer 5: Podcast + Multi-Cat Research

### Task 5.1: Podcast script generation (R5)

**Files:**
- Create: `packages/api/src/domains/signals/services/podcast-generator.ts`
- Test: `test/signals/podcast-generator.test.js` (new)

**Step 1: Define podcast script format**

```typescript
export interface PodcastSegment {
  readonly speaker: string; // catId
  readonly text: string;
  readonly durationEstimate: number; // seconds
}

export interface PodcastScript {
  readonly mode: 'essence' | 'deep';
  readonly segments: readonly PodcastSegment[];
  readonly totalDuration: number;
}
```

**Step 2: Implement generatePodcastScript()**

Takes article content + mode + speakers → produces structured script.
- Essence: 2-3 minutes, highlights only
- Deep: 10 minutes, analysis + discussion + questions

**Step 3: TTS synthesis loop**

For each segment, call TTS provider with speaker's voice clone.
Concatenate audio files → store in sidecar dir.

**Step 4: Update meta.json with podcast artifact**

State: queued → running → ready/failed.

**Step 5: Commit**

```
feat(F091): podcast generation pipeline (script + TTS + sidecar storage)
```

---

### Task 5.2: Podcast player frontend (AC-5)

**Files:**
- Create: `packages/web/src/components/signals/PodcastPlayer.tsx`
- Modify: `packages/web/src/components/signals/StudyFoldArea.tsx`

**Step 1: Build player component**

- Essence/Deep pill toggle
- Play/pause/seek controls + progress bar
- "正在说话" indicator: highlight current speaker
- Transcript preview below player

**Step 2: Integrate into StudyFoldArea**

Show podcast card in fold area. Click → expand player.

**Step 3: Commit**

```
feat(F091): podcast player component with dual mode + speaker indicator
```

---

### Task 5.3: Multi-cat research integration (R6)

**Files:**
- Modify: MCP tool handler for `signal_start_study`

**Step 1: Add research trigger**

In `signal_start_study`, if study needs multi-cat research:
- Use existing `cat_cafe_multi_mention` to dispatch to 2-3 cats
- Each cat gets article context + specific research question
- Results collected and stored as research-report artifact

**Step 2: Commit**

```
feat(F091): multi-cat research via F086 multi_mention integration
```

---

## Layer 6: Collections + Timeline

### Task 6.1: Study collections / 学习集 (R18, AC-18)

**Files:**
- Create: `packages/api/src/domains/signals/services/collection-service.ts`
- Modify: `packages/api/src/routes/signals.ts`

**Step 1: Define collection model**

```typescript
export interface StudyCollection {
  readonly id: string;
  readonly name: string;
  readonly articleIds: readonly string[];
  readonly createdAt: string;
}
```

Storage: `~/.cat-cafe/signals/collections/{id}.json`

**Step 2: CRUD endpoints**

```
POST   /api/signals/collections          — create
GET    /api/signals/collections          — list
GET    /api/signals/collections/:id      — get with articles
PATCH  /api/signals/collections/:id      — update (add/remove articles)
DELETE /api/signals/collections/:id      — delete
```

**Step 3: Frontend — collection picker in StudyFoldArea**

Show related articles in same collection.

**Step 4: Commit**

```
feat(F091): study collections (学习集) — group related articles
```

---

### Task 6.2: Learning timeline view (R19, AC-19)

**Files:**
- Create: `packages/web/src/components/signals/StudyTimeline.tsx`
- Modify: `packages/api/src/routes/signals.ts`

**Step 1: Timeline API endpoint**

```
GET /api/signals/timeline?since=2026-03-01&until=2026-03-10
```

Returns study events sorted by time: notes created, podcasts generated, threads linked, articles studied.

**Step 2: Timeline component**

Vertical timeline with date headers → event cards (icon + summary + link).

**Step 3: Commit**

```
feat(F091): learning timeline — "上周学了什么" review view
```

---

## Layer 7: Migration

### Task 7.1: Signal Hunter legacy migration (R9, AC-8)

**Files:**
- Create: `packages/api/src/domains/signals/services/migration.ts`

**Step 1: Scan for old study data**

Check if any legacy study format exists in `~/.cat-cafe/signals/`.

**Step 2: Migrate to sidecar format**

Convert legacy data → new `meta.json` + artifact files.

**Step 3: Commit**

```
feat(F091): migrate Signal Hunter legacy studies to sidecar format
```

---

## Shared package rebuild checkpoint

After completing Layer 1, run:
```bash
pnpm --filter @cat-cafe/shared build
```

After completing each layer, run:
```bash
pnpm check        # Biome lint
pnpm lint          # TypeScript check
```

---

## Summary

| Layer | Tasks | AC Coverage |
|-------|-------|-------------|
| 1. Data Model + API | 1.1-1.6 | AC-14,15,16,20,21,22,24 |
| 2. MCP Tools | 2.1-2.4 | AC-7 |
| 3. System Prompt | 3.1-3.2 | AC-2,23 |
| 4. Frontend | 4.1-4.7 | AC-1,4,9,11,12,13 |
| 5. Podcast + Research | 5.1-5.3 | AC-5,6 |
| 6. Collections + Timeline | 6.1-6.2 | AC-18,19 |
| 7. Migration | 7.1 | AC-8 |

Not covered in code (manual/process): AC-3 (user confirms notes), AC-10 (memory search usage), AC-17 (source filter — covered in 4.2).
