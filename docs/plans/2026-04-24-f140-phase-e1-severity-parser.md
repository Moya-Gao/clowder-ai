---
feature_ids: [F140]
topics: [github, review-feedback, severity-parser, setup-noise-filter]
doc_kind: plan
created: 2026-04-24
---

# F140 Phase E.1 Implementation Plan — Severity Parser + Setup-Noise Filter

**Feature:** F140 — `docs/features/F140-github-pr-automation.md`
**Goal:** 在 `ReviewFeedbackRouter.buildReviewFeedbackContent()` 生成的消息里加严格 severity 消息头（P0/P1/P2），并在 polling 侧过滤 setup-noise comment——为 E.2 下线 email 通道做能力前置。
**Acceptance Criteria:** 覆盖 F140 spec 的 AC-E1 ~ AC-E6（Phase E 前 6 条）。AC-E7~E10 在 E.2 / E.3 实现。
**Architecture:** 新增两个纯函数模块（`severity-parser.ts` + `setup-noise-filter.ts`），在 `ReviewFeedbackRouter.buildReviewFeedbackContent()` 入口处接入 severity header，在 `ReviewFeedbackTaskSpec` 的 gate 过滤链扩展 setup-noise。不动 Rule A/B 语义（那是 E.2 的事）。
**Tech Stack:** TypeScript、node:test、现有 `ReviewFeedbackRouter` / `ReviewFeedbackTaskSpec` 基座。
**前端验证:** No（纯后端，消息内容变化由 Alpha 场景自测）。

---

## Straight-Line Check

### Pin the Finish Line

- **B 定义（一句话）**：给定一个含 P2 inline comment 的 PR signal，`buildReviewFeedbackContent(signal)` 返回的第一行是 `**Review 检测到 P2**`；给定一个**由 Codex bot 发的**、只含 `To use Codex here, create an environment...` setup 句子（无 review 内容）的 conversation comment，在 polling gate 被过滤不投递——但**人类 reviewer 引用该句作为上下文时不吞**（关键负例，对应 `github-review-mail-body-classifier.test.js:72`）。
- **What we're NOT building in E.1**：
  - 不删除 Rule B（那是 E.2 — KD-15）
  - 不清理 `GITHUB_AUTHORITATIVE_REVIEW_LOGINS` env（E.2）
  - 不下线 `startGithubReviewWatcher()`（E.2）
  - 不删除 ReviewRouter / ReviewContentFetcher / GithubReviewMailParser（E.3）

### Terminal Schema（这些接口要进终态系统，不会重写）

```ts
// severity-parser.ts
export type Severity = 'P0' | 'P1' | 'P2';
export function parseSeverity(body: string): Severity | null;
export function getMaxSeverity(
  comments: readonly { body: string }[],
  decisions: readonly { body: string }[],
): Severity | null;

// setup-noise-filter.ts — context-aware + factory (砚砚 P1-1 修正：body-only 会误杀人类引用)
export interface SetupNoiseContext {
  readonly author: string;
  readonly body: string;
  readonly commentType: 'inline' | 'conversation';
}
export function createSetupNoiseFilter(
  botLogins: readonly string[],
): (c: SetupNoiseContext) => boolean;

// ReviewFeedbackTaskSpec.ts — 新增 option（向后兼容）
export interface ReviewFeedbackTaskSpecOptions {
  // ... existing
  readonly isNoiseComment?: (comment: PrFeedbackComment) => boolean; // 新增
}
```

### Three-Question Audit（每个 Task 内嵌）

所有 Task 产物都以纯函数 + 最小接线方式写入终态系统，无脚手架。

---

## Task 1: Severity Parser — 严格格式 + FP 护栏（纯函数模块）

**Files:**
- Create: `packages/api/src/infrastructure/email/severity-parser.ts`
- Test: `packages/api/test/severity-parser.test.js`

### Step 1.1: 写失败测试 — 正例集（三种格式 × 三种 severity）

```js
// packages/api/test/severity-parser.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSeverity, getMaxSeverity } from '../dist/infrastructure/email/severity-parser.js';

test('parseSeverity: shields.io badge — P1', () => {
  const body = '![P1 Badge](https://img.shields.io/badge/P1-yellow?style=flat) Skip...';
  assert.equal(parseSeverity(body), 'P1');
});

test('parseSeverity: shields.io badge — P0', () => {
  const body = '![P0 Badge](https://img.shields.io/badge/P0-red?style=flat) Critical...';
  assert.equal(parseSeverity(body), 'P0');
});

test('parseSeverity: 行首方括号 [P2]', () => {
  assert.equal(parseSeverity('[P2] Minor issue detected'), 'P2');
});

test('parseSeverity: 行首冒号 P1:', () => {
  assert.equal(parseSeverity('P1: This needs to be fixed'), 'P1');
});

test('parseSeverity: 行首粗体冒号 **P1**:', () => {
  assert.equal(parseSeverity('**P1**: this is a real issue'), 'P1');
});
```

### Step 1.2: 写失败测试 — 负例集（≥5 条，AC-E3）

```js
test('parseSeverity: 句内裸词 — I think this is P1 → null', () => {
  assert.equal(parseSeverity('I think this is P1 but not sure'), null);
});

test('parseSeverity: P100 → null（超界不吃）', () => {
  assert.equal(parseSeverity('P100 users affected'), null);
});

test('parseSeverity: MP3 → null（含 P 字母的其他 token）', () => {
  assert.equal(parseSeverity('Upload MP3 file here'), null);
});

test('parseSeverity: fenced code block 内的 P1: → null', () => {
  const body = 'Example:\n```\nP1: old finding\n```\nend';
  assert.equal(parseSeverity(body), null);
});

test('parseSeverity: blockquote > P1: → null（引用旧 finding）', () => {
  const body = '> P1: previously reported\n\nNow addressed';
  assert.equal(parseSeverity(body), null);
});

// 砚砚 GPT-5.5 P1-1 守护：badge 必须也被 strip 保护
test('parseSeverity: fenced code 内的 badge → null（老 bug 结构性复发守护）', () => {
  const body = 'Here is an example:\n```\n![P1 Badge](https://img.shields.io/badge/P1-yellow?style=flat) old\n```\nNo severity now.';
  assert.equal(parseSeverity(body), null);
});

test('parseSeverity: blockquote 内的 badge → null（引用旧 finding 不触发）', () => {
  const body = '> ![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat) previously addressed\n\nNow fixed';
  assert.equal(parseSeverity(body), null);
});

test('parseSeverity: P3 不识别（informational）→ null', () => {
  assert.equal(parseSeverity('[P3] FYI — consider naming'), null);
});

test('parseSeverity: 空 body → null', () => {
  assert.equal(parseSeverity(''), null);
});
```

### Step 1.3: 写失败测试 — getMaxSeverity 聚合

```js
test('getMaxSeverity: P2 + P0 + P1 → P0 (最高)', () => {
  const comments = [{ body: '[P2] a' }, { body: '[P1] b' }];
  const decisions = [{ body: '**P0**: critical' }];
  assert.equal(getMaxSeverity(comments, decisions), 'P0');
});

test('getMaxSeverity: all empty → null', () => {
  assert.equal(getMaxSeverity([], []), null);
});

test('getMaxSeverity: 无匹配 → null', () => {
  const comments = [{ body: 'looks good' }];
  assert.equal(getMaxSeverity(comments, []), null);
});
```

### Step 1.4: 跑测试确认失败

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern=severity-parser`
Expected: FAIL with "Cannot find module"

### Step 1.5: 写最小实现

```ts
// packages/api/src/infrastructure/email/severity-parser.ts
export type Severity = 'P0' | 'P1' | 'P2';

const SEVERITY_RANK: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };

// shields.io badge: ...img.shields.io/badge/P0-... / P1- / P2-
const BADGE_REGEX = /img\.shields\.io\/badge\/(P[0-2])-/;

// 行首方括号：^[P0-2]  (允许前导空白)
const BRACKET_REGEX = /^\s*\[(P[0-2])\](?=\s|$)/m;

// 行首冒号：^P0-2: 或 ^**P0-2**:
const COLON_REGEX = /^\s*(?:\*\*)?(P[0-2])(?:\*\*)?:/m;

/** Strip fenced code blocks + blockquote lines before severity match. */
function stripNoise(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, '') // fenced code
    .split('\n')
    .filter((line) => !/^\s*>/.test(line)) // blockquote lines
    .join('\n');
}

export function parseSeverity(body: string): Severity | null {
  if (!body) return null;

  // 砚砚 GPT-5.5 P1-1 修正：ALL three formats must match on cleaned body.
  // Original (broken) version scanned BADGE before stripNoise — this let
  // blockquote-quoted old findings (e.g. `> ![P2 Badge](...)`) and fenced
  // code samples trigger a new "Review 检测到 P2" header, reproducing the
  // exact "过期 P1/P2 冒出来" UX bug this feature exists to fix.
  const cleaned = stripNoise(body);

  const badge = BADGE_REGEX.exec(cleaned);
  if (badge) return badge[1] as Severity;

  const bracket = BRACKET_REGEX.exec(cleaned);
  if (bracket) return bracket[1] as Severity;

  const colon = COLON_REGEX.exec(cleaned);
  if (colon) return colon[1] as Severity;

  return null;
}

export function getMaxSeverity(
  comments: readonly { body: string }[],
  decisions: readonly { body: string }[],
): Severity | null {
  let max: Severity | null = null;
  const consider = (s: Severity | null) => {
    if (!s) return;
    if (!max || SEVERITY_RANK[s] < SEVERITY_RANK[max]) max = s;
  };
  for (const c of comments) consider(parseSeverity(c.body));
  for (const d of decisions) consider(parseSeverity(d.body));
  return max;
}
```

### Step 1.6: 跑测试确认通过

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern=severity-parser`
Expected: ALL PASS

### Step 1.7: Commit

```bash
git add packages/api/src/infrastructure/email/severity-parser.ts \
        packages/api/test/severity-parser.test.js
git commit -m "feat(F140-E1): add strict severity parser with FP guards [宪宪/Opus-47🐾]"
```

---

## Task 2: Setup-Noise Filter — context-aware，只收 bot conversation setup-only

**Files:**
- Create: `packages/api/src/infrastructure/email/setup-noise-filter.ts`
- Test: `packages/api/test/setup-noise-filter.test.js`
- Reference: `packages/api/src/infrastructure/email/GithubReviewMailParser.ts:101-104` (Rule 3) + `test/github-review-mail-body-classifier.test.js:72` (关键负例)

> **砚砚 P1-1 修正**：filter 不能 body-only——email classifier 明确规定只有 reviewer 是 Codex bot（或无 reviewer）时才算 setup noise，人类引用 setup 文案时 `ignorable=false`。polling 侧等价做法：用 `author` 判是不是 bot + `commentType` 限 conversation。
>
> **砚砚 P1-2 修正**：裸 `@codex review` 或我们的 trigger template 评论**不在 E.1 处理**——那些是 self-authored（铲屎官/猫发），由 Rule A（`shouldSkipComment` 的 self-authored skip）处理。E.1 的 setup-noise filter **只针对 bot 发的 setup-only conversation comment**。

### Step 2.1: 写失败测试 — 正例（bot conversation setup-only，应被过滤）

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSetupNoiseFilter } from '../dist/infrastructure/email/setup-noise-filter.js';

const BOTS = ['chatgpt-codex-connector[bot]'];

test('bot conversation setup-only → true', () => {
  const filter = createSetupNoiseFilter(BOTS);
  assert.equal(
    filter({
      author: 'chatgpt-codex-connector[bot]',
      body: 'To use Codex here, create an environment for this repo.',
      commentType: 'conversation',
    }),
    true,
  );
});

test('bot conversation setup-only (markdown link variant) → true', () => {
  const filter = createSetupNoiseFilter(BOTS);
  assert.equal(
    filter({
      author: 'chatgpt-codex-connector[bot]',
      body: 'To use Codex here, [create an environment for this repo](https://chatgpt.com/codex/settings/environments).',
      commentType: 'conversation',
    }),
    true,
  );
});
```

### Step 2.2: 写失败测试 — 负例（≥5 条，守护 P1-1 边界）

```js
test('human conversation quoting setup sentence → false（P1-1 关键负例）', () => {
  const filter = createSetupNoiseFilter(BOTS);
  assert.equal(
    filter({
      author: 'octocat',
      body: 'Quoting for context: To use Codex here, create an environment for this repo.',
      commentType: 'conversation',
    }),
    false,
  );
});

test('bot conversation with real review content (setup + codex review) → false', () => {
  const filter = createSetupNoiseFilter(BOTS);
  assert.equal(
    filter({
      author: 'chatgpt-codex-connector[bot]',
      body: 'Codex Review: Found 2 issues.\nReviewed commit: abc123\nTo use Codex here, create an environment for this repo.',
      commentType: 'conversation',
    }),
    false,
  );
});

test('bot inline comment (not conversation) → false（不触达 inline）', () => {
  const filter = createSetupNoiseFilter(BOTS);
  assert.equal(
    filter({
      author: 'chatgpt-codex-connector[bot]',
      body: 'To use Codex here, create an environment for this repo.',
      commentType: 'inline',
    }),
    false,
  );
});

test('non-bot author even if setup-only → false（author 不在 allowlist）', () => {
  const filter = createSetupNoiseFilter(BOTS);
  assert.equal(
    filter({
      author: 'some-other-bot[bot]',
      body: 'To use Codex here, create an environment for this repo.',
      commentType: 'conversation',
    }),
    false,
  );
});

test('normal human comment → false', () => {
  const filter = createSetupNoiseFilter(BOTS);
  assert.equal(
    filter({
      author: 'octocat',
      body: 'LGTM',
      commentType: 'conversation',
    }),
    false,
  );
});

test('empty body → false', () => {
  const filter = createSetupNoiseFilter(BOTS);
  assert.equal(
    filter({ author: 'chatgpt-codex-connector[bot]', body: '', commentType: 'conversation' }),
    false,
  );
});
```

### Step 2.3: 跑测试确认失败

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern=setup-noise-filter`
Expected: FAIL with "Cannot find module"

### Step 2.4: 写最小实现（复刻 `GithubReviewMailParser.ts:101-104` Rule 3）

```ts
// packages/api/src/infrastructure/email/setup-noise-filter.ts

export interface SetupNoiseContext {
  readonly author: string;
  readonly body: string;
  readonly commentType: 'inline' | 'conversation';
}

const SETUP_GUIDANCE_SENTENCE = /to use codex here,/i;
const SETUP_GUIDANCE_ANCHOR = /environment for this repo\b/i;
const CODEX_REVIEW_CONTENT = /\bcodex review\b/i;

/**
 * Factory: produce a predicate that identifies PR conversation comments posted
 * by authoritative bots that contain ONLY setup/environment guidance — no real
 * review content. Migrated from GithubReviewMailParser Rule 3 (email classifier).
 *
 * Scope narrowing (砚砚 P1-1):
 * - conversation only (inline already belongs to a review submission)
 * - bot author only (humans may legitimately quote setup sentence)
 * - setup-only only (setup sentence + NO 'codex review' content)
 */
export function createSetupNoiseFilter(
  botLogins: readonly string[],
): (c: SetupNoiseContext) => boolean {
  const bots = new Set(botLogins);
  return (c: SetupNoiseContext): boolean => {
    if (!c.body) return false;
    if (c.commentType !== 'conversation') return false;
    if (!bots.has(c.author)) return false;

    const hasSetupSentence =
      SETUP_GUIDANCE_SENTENCE.test(c.body) && SETUP_GUIDANCE_ANCHOR.test(c.body);
    if (!hasSetupSentence) return false;

    // Rule 3 anchor: setup + real review content → not noise (real review that
    // happens to include setup footer)
    const hasCodexReviewContent = CODEX_REVIEW_CONTENT.test(c.body);
    return !hasCodexReviewContent;
  };
}
```

### Step 2.5: 跑测试确认通过

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern=setup-noise-filter`
Expected: ALL PASS（正例 2 + 负例 6）

### Step 2.6: Commit

```bash
git add packages/api/src/infrastructure/email/setup-noise-filter.ts \
        packages/api/test/setup-noise-filter.test.js
git commit -m "feat(F140-E1): context-aware setup-noise filter (bot conversation only) [宪宪/Opus-47🐾]"
```

---

## Task 3: 接入 `buildReviewFeedbackContent` — severity header

**Files:**
- Modify: `packages/api/src/infrastructure/email/ReviewFeedbackRouter.ts:100` (buildReviewFeedbackContent)
- Test: `packages/api/test/review-feedback-router.test.js`（已有，扩展）

### Step 3.1: 写失败测试 — 3 条新用例

```js
// 在现有 review-feedback-router.test.js 里加
import { buildReviewFeedbackContent } from '../dist/infrastructure/email/ReviewFeedbackRouter.js';

test('buildReviewFeedbackContent: 含 P2 inline comment → header 显示 P2', () => {
  const signal = {
    repoFullName: 'owner/repo',
    prNumber: 42,
    newComments: [
      {
        id: 1,
        author: 'chatgpt-codex-connector[bot]',
        body: '![P2 Badge](https://img.shields.io/badge/P2-yellow) Minor issue',
        createdAt: '2026-04-24T00:00:00Z',
        commentType: 'inline',
        filePath: 'src/foo.ts',
        line: 10,
      },
    ],
    newDecisions: [],
  };
  const content = buildReviewFeedbackContent(signal);
  assert.match(content.split('\n')[0], /\*\*Review 检测到 P2\*\*/);
});

test('buildReviewFeedbackContent: 无 severity → 无 header（保持原样）', () => {
  const signal = {
    repoFullName: 'owner/repo',
    prNumber: 42,
    newComments: [
      { id: 1, author: 'bot', body: 'LGTM', createdAt: '2026-04-24T00:00:00Z', commentType: 'conversation' },
    ],
    newDecisions: [],
  };
  const content = buildReviewFeedbackContent(signal);
  assert.doesNotMatch(content, /Review 检测到/);
  assert.match(content.split('\n')[0], /📋 \*\*Review Feedback\*\*/);
});

test('buildReviewFeedbackContent: P0 + P2 → header P0（最高）', () => {
  const signal = {
    repoFullName: 'owner/repo',
    prNumber: 42,
    newComments: [
      { id: 1, author: 'bot', body: '[P2] a', createdAt: '2026-04-24T00:00:00Z', commentType: 'inline' },
    ],
    newDecisions: [
      { id: 1, author: 'bot', state: 'COMMENTED', body: '**P0**: critical', submittedAt: '2026-04-24T00:00:00Z' },
    ],
  };
  const content = buildReviewFeedbackContent(signal);
  assert.match(content.split('\n')[0], /\*\*Review 检测到 P0\*\*/);
});
```

### Step 3.2: 跑测试确认失败

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern=review-feedback-router`
Expected: FAIL — `Review 检测到` not present

### Step 3.3: 修改 `buildReviewFeedbackContent`

```ts
// packages/api/src/infrastructure/email/ReviewFeedbackRouter.ts
import { getMaxSeverity } from './severity-parser.js';

export function buildReviewFeedbackContent(signal: ReviewFeedbackSignal): string {
  const lines: string[] = [];

  // Phase E.1: severity header (prepended before existing content)
  const maxSev = getMaxSeverity(signal.newComments, signal.newDecisions);
  if (maxSev) {
    lines.push(`**Review 检测到 ${maxSev}**`, '');
  }

  lines.push(`📋 **Review Feedback** — PR #${signal.prNumber} (${signal.repoFullName})`);

  // ... rest unchanged (existing Decisions / Inline / Conversation sections)
}
```

### Step 3.4: 跑测试确认通过 + 现有 suite 不回归

Run: `pnpm --filter @cat-cafe/api test -- --test-name-pattern=review-feedback-router`
Expected: ALL PASS（新 3 条 + 现有用例）

### Step 3.5: Commit

```bash
git add packages/api/src/infrastructure/email/ReviewFeedbackRouter.ts \
        packages/api/test/review-feedback-router.test.js
git commit -m "feat(F140-E1): prepend severity header to review feedback messages [宪宪/Opus-47🐾]"
```

---

## Task 4: Polling 侧接入 setup-noise filter

**Files:**
- Modify: `packages/api/src/infrastructure/email/ReviewFeedbackTaskSpec.ts`（加 `isNoiseComment` option）
- Modify: `packages/api/src/index.ts:2167` 附近（compose 新 filter，注入 bot logins）
- Test: `packages/api/test/scheduler/review-feedback-spec.test.js`（已存在，扩展 — 砚砚 P2 修正：不是 `review-feedback-task-spec.test.js`）

### Step 4.1: 写失败测试 — setup-noise 被 gate 过滤 + 人类引用不被吞

> **砚砚 GPT-5.5 P2 修正**：E.1 不删 Rule B，Rule B 当前会过滤 authoritative bot 的 inline/review。fixture 里如果用"bot real inline"当 positive surviving case，会被 Rule B 吞，测不出 setup-noise filter 独立效果。Real surviving case 必须用 **human author**。

```js
// packages/api/test/scheduler/review-feedback-spec.test.js（扩展）
test('gate: bot setup-only conversation 被 isNoiseComment 过滤; human inline 保留', async () => {
  // fixture: fetchComments 返回:
  //   [0] bot(chatgpt-codex-connector[bot]) conversation: "To use Codex here..."
  //   [1] human(octocat) inline: "[P1] real finding on line 42"
  // expect: workItem 只含 [1]（human 不被 Rule B 过滤，bot setup-only 被 isNoiseComment 过滤）
});

test('gate: human conversation 引用 setup 文案 不被过滤（P1-1 守护）', async () => {
  // fixture: fetchComments 返回:
  //   [0] human(octocat) conversation: "quoting previous bot: To use Codex here, create an environment for this repo. FYI"
  // expect: workItem 含 [0]（author != bot → setup-noise filter 返回 false → 保留）
});

test('gate: 纯 bot setup-only（无其他），all skip → cursor advance', async () => {
  // fixture: fetchComments 返回 [bot setup-only conversation (id=10)]
  // expect: workItem 为空；automationState.review.lastCommentCursor === 10
  // （echo-skip / persistFirst policy — 确保 cursor 不停滞）
});
```

### Step 4.2: 跑测试确认失败

Expected: FAIL — setup-noise comment 出现在 workItem

### Step 4.3: 扩展 `ReviewFeedbackTaskSpec` 接口 + gate filter

```ts
// ReviewFeedbackTaskSpec.ts
export interface ReviewFeedbackTaskSpecOptions {
  // ...existing
  readonly isEchoComment?: (comment: PrFeedbackComment) => boolean;
  readonly isEchoReview?: (review: PrReviewDecision) => boolean;
  readonly isNoiseComment?: (comment: PrFeedbackComment) => boolean; // 新增
}

// In gate(), extend filter chain:
const commentFilter = opts.isEchoComment;
const noiseFilter = opts.isNoiseComment;
const reviewFilter = opts.isEchoReview;

const newComments = allNewComments.filter((c) => {
  if (commentFilter?.(c)) return false;
  if (noiseFilter?.(c)) return false;
  return true;
});
```

### Step 4.4: `index.ts` 注册时 compose setup-noise filter

```ts
// index.ts — 在 taskRunnerV2.register(createReviewFeedbackTaskSpec({...})) 里加
import { createSetupNoiseFilter } from './infrastructure/email/setup-noise-filter.js';

// AUTHORITATIVE_BOT_LOGINS 从 env `GITHUB_AUTHORITATIVE_REVIEW_LOGINS` 解析
// （注意：E.1 复用该 env，E.2 会改名/删除并迁移到专用"bot setup-noise allowlist" env）
const setupNoiseFilter = createSetupNoiseFilter(authoritativeBotLogins);

// ...
isEchoComment: (c) => feedbackFilter.shouldSkipComment(c),
isEchoReview: (r) => feedbackFilter.shouldSkipReview(r),
isNoiseComment: setupNoiseFilter, // 新增 — predicate 直接传，已 context-aware
```

### Step 4.5: 跑测试确认通过 + 跨文件回归

Run: `pnpm --filter @cat-cafe/api test:redis`
Expected: ALL PASS（review-feedback + severity + setup-noise + 现有 suite）

### Step 4.6: Commit

```bash
git add packages/api/src/infrastructure/email/ReviewFeedbackTaskSpec.ts \
        packages/api/src/index.ts \
        packages/api/test/scheduler/review-feedback-spec.test.js
git commit -m "feat(F140-E1): wire setup-noise filter into polling gate [宪宪/Opus-47🐾]"
```

---

## Task 5: 全量回归 + LSP 清零 + AC 打勾

### Step 5.1: 全量测试

Run: `pnpm --filter @cat-cafe/api test:redis` + `pnpm --filter @cat-cafe/api test:redis:repeat`
Expected: ALL PASS

### Step 5.2: LSP 无 error

检查 VSCode/IDE 诊断面板 — 所有 Edit 后的 `<new-diagnostics>` 已处理。

### Step 5.3: Biome

Run: `pnpm check`
Expected: clean（或 `pnpm check:fix`）

### Step 5.4: 更新 F140 spec — AC-E1~E6 打勾

Edit `docs/features/F140-github-pr-automation.md` 把 AC-E1~E6 改为 `[x]`，在 Timeline 加"Phase E.1 merged"记录（merge 后做）。

### Step 5.5: 预 commit gate

Run: `pnpm gate`（按 feedback_gate_before_merge 铁律）
Expected: PASS

---

## Task 6: Plan 复盘 + 跨猫 review 请求

完成本 plan 所有 Task 后 → 加载 `quality-gate` skill 自检 → 加载 `request-review` skill 发 review 请求给砚砚（gpt52/codex cross-family）→ 按 `receive-review` 处理反馈 → `merge-gate` 合入。

PR scope：E.1 单独一个 PR，不和 E.2/E.3 混。PR 标题：`feat(F140-E1): review feedback severity header + setup-noise filter`

---

## Non-Goals（E.1 不做）

| 放在哪 Phase | 事项 |
|-------------|------|
| 由 Rule A 处理 | **裸 `@codex review` 触发评论 / 我们自己的 trigger template**——这些是 self-authored，`shouldSkipComment` 的 Rule A 本身已覆盖，E.1 不在 setup-noise filter 里重复处理（砚砚 P1-2） |
| E.2 | 删除 Rule B（`createGitHubFeedbackFilter` 简化为 Rule A only）|
| E.2 | 清理 `GITHUB_AUTHORITATIVE_REVIEW_LOGINS` env + env-registry.ts 文案 |
| E.2 | 下线 `startGithubReviewWatcher()` 调用 + `.env.example` 撤 IMAP 字段 |
| E.2 | Alpha 3 场景证据门槛验证（bot-P2 / bot-pass / 人类-CHANGES）|
| E.3 | 删除 `GithubReviewWatcher` / `ReviewRouter` / `ReviewContentFetcher` / `GithubReviewMailParser` / `ProcessedEmailStore` + tests |

---

## Risk & Mitigation

| 风险 | 缓解 |
|------|------|
| Severity parser FP（误识别正常词如 "P100"） | AC-E3 要求 ≥5 条负例测试，Task 1.2 已覆盖 |
| Setup-noise filter 误杀人类引用 setup 文案的评论（砚砚 P1-1） | **API context-aware**：filter 接收 `author + commentType`，只吞 `commentType=conversation + author∈botLogins + setup-only`（无 `codex review` 内容）；Task 2.2 负例含人类引用 setup 文案必须 false |
| Setup-noise regex 漏识别新 bot 话术 | 保守策略：只吞明确匹配，未匹配时放行（nothing 消失）。后续 bot 话术变化由新增 regex 覆盖 |
| 现有 review-feedback-router.test.js 用例被新 header 破坏 | Task 3.1 测试写"无 severity → 无 header" 确认向后兼容 |
| polling gate filter chain 顺序导致 workItem 状态不一致 | `isEchoComment` 和 `isNoiseComment` 都是 skip 语义，OR 后顺序无关 |

## Links

- Spec: `docs/features/F140-github-pr-automation.md` (Phase E section)
- Design Gate discussion: 2026-04-24 thread（砚砚 GPT-5.4 三条修正）
- 相关代码:
  - `packages/api/src/infrastructure/email/ReviewFeedbackRouter.ts:100` — buildReviewFeedbackContent
  - `packages/api/src/infrastructure/email/ReviewFeedbackTaskSpec.ts:39-41` — TaskSpec options
  - `packages/api/src/infrastructure/email/GithubReviewMailParser.ts:48` — 搬迁源
  - `packages/api/src/infrastructure/email/github-feedback-filter.ts:42` — Rule A/B filter factory
  - `packages/api/src/index.ts:2167` — Polling 注册 compose 点
