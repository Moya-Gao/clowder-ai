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

- **B 定义（一句话）**：给定一个含 P2 inline comment 的 PR signal，`buildReviewFeedbackContent(signal)` 返回的第一行是 `**Review 检测到 P2**`；给定一个含 `To use Codex here, create an environment...` 的 conversation comment 的 signal，该 comment 在 polling gate 被过滤不投递。
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

// setup-noise-filter.ts
export function isSetupNoiseComment(body: string): boolean;

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

Run: `pnpm --filter @cat-cafe/api test --test-name-pattern=severity-parser`
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

  // Badge can appear anywhere; check first (most specific)
  const badge = BADGE_REGEX.exec(body);
  if (badge) return badge[1] as Severity;

  // Bracket/colon prefixes must be on their own line — strip fenced/blockquote first
  const cleaned = stripNoise(body);

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

Run: `pnpm --filter @cat-cafe/api test --test-name-pattern=severity-parser`
Expected: ALL PASS

### Step 1.7: Commit

```bash
git add packages/api/src/infrastructure/email/severity-parser.ts \
        packages/api/test/severity-parser.test.js
git commit -m "feat(F140-E1): add strict severity parser with FP guards [宪宪/Opus-47🐾]"
```

---

## Task 2: Setup-Noise Filter — 从 email parser 抽出

**Files:**
- Create: `packages/api/src/infrastructure/email/setup-noise-filter.ts`
- Test: `packages/api/test/setup-noise-filter.test.js`
- Reference: `packages/api/src/infrastructure/email/GithubReviewMailParser.ts:48` (`inferReviewActionFromEmailSource`) — 复用其判定逻辑

### Step 2.1: 写失败测试 — 正例（应被过滤）

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isSetupNoiseComment } from '../dist/infrastructure/email/setup-noise-filter.js';

test('isSetupNoiseComment: Codex setup guidance → true', () => {
  const body = 'To use Codex here, create an environment for this repo';
  assert.equal(isSetupNoiseComment(body), true);
});

test('isSetupNoiseComment: 空 @codex review 触发 → true', () => {
  assert.equal(isSetupNoiseComment('@codex review'), true);
});

test('isSetupNoiseComment: 我们的 review trigger template (中) → true', () => {
  const body = '@codex review\n\n规则：任何 P1/P2 必须给可执行复现步骤';
  assert.equal(isSetupNoiseComment(body), true);
});

test('isSetupNoiseComment: 我们的 review trigger template (英) → true', () => {
  const body = '@codex review\nrules: any p1/p2 must include reproduction';
  assert.equal(isSetupNoiseComment(body), true);
});
```

### Step 2.2: 写失败测试 — 负例（应通过）

```js
test('isSetupNoiseComment: 正常 bot review body → false', () => {
  const body = '### 💡 Codex Review\n\nReviewed commit: abc123\n\nFound 2 issues.';
  assert.equal(isSetupNoiseComment(body), false);
});

test('isSetupNoiseComment: 人类 reviewer 评论 → false', () => {
  assert.equal(isSetupNoiseComment('This looks good to me, LGTM'), false);
});

test('isSetupNoiseComment: 含 P1 的真实 finding → false', () => {
  const body = '[P1] Fix the null check in line 42';
  assert.equal(isSetupNoiseComment(body), false);
});

test('isSetupNoiseComment: 空 body → false', () => {
  assert.equal(isSetupNoiseComment(''), false);
});
```

### Step 2.3: 跑测试确认失败

Run: `pnpm --filter @cat-cafe/api test --test-name-pattern=setup-noise-filter`
Expected: FAIL with "Cannot find module"

### Step 2.4: 写最小实现（逻辑搬自 `GithubReviewMailParser.inferReviewActionFromEmailSource`）

```ts
// packages/api/src/infrastructure/email/setup-noise-filter.ts

const SETUP_GUIDANCE_SENTENCE = /to use codex here,/i;
const SETUP_GUIDANCE_ANCHOR = /environment for this repo\b/i;
const CODEX_REVIEW_TRIGGER = /^\s*@codex\s+review\b/im;
const OUR_TRIGGER_TEMPLATE_CN = /规则：任何\s*P1\/P2\s*必须给可执行复现/i;
const OUR_TRIGGER_TEMPLATE_EN = /rules:\s*any\s*p1\/p2\s*must\s*include/i;
const CODEX_REVIEW_BODY_ANCHOR = /\bReviewed commit:/i; // real review has this

/**
 * Detect PR comments that are setup/trigger noise, not actionable review content.
 * Migrated from GithubReviewMailParser.inferReviewActionFromEmailSource (F140 Phase E.1).
 */
export function isSetupNoiseComment(body: string): boolean {
  if (!body) return false;

  // Codex setup guidance ("create an environment...")
  if (SETUP_GUIDANCE_SENTENCE.test(body) && SETUP_GUIDANCE_ANCHOR.test(body)) {
    return true;
  }

  // Our @codex review trigger template (empty or template-only, no review content)
  const hasTrigger = CODEX_REVIEW_TRIGGER.test(body);
  const hasTemplate = OUR_TRIGGER_TEMPLATE_CN.test(body) || OUR_TRIGGER_TEMPLATE_EN.test(body);
  const hasRealReview = CODEX_REVIEW_BODY_ANCHOR.test(body);

  if ((hasTrigger || hasTemplate) && !hasRealReview) {
    return true;
  }

  return false;
}
```

### Step 2.5: 跑测试确认通过

Run: `pnpm --filter @cat-cafe/api test --test-name-pattern=setup-noise-filter`
Expected: ALL PASS

### Step 2.6: Commit

```bash
git add packages/api/src/infrastructure/email/setup-noise-filter.ts \
        packages/api/test/setup-noise-filter.test.js
git commit -m "feat(F140-E1): extract setup-noise filter predicate [宪宪/Opus-47🐾]"
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

Run: `pnpm --filter @cat-cafe/api test --test-name-pattern=review-feedback-router`
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

Run: `pnpm --filter @cat-cafe/api test --test-name-pattern=review-feedback-router`
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
- Modify: `packages/api/src/index.ts:2167` 附近（compose 新 filter）
- Test: `packages/api/test/review-feedback-task-spec.test.js`（如已存在扩展；否则参考现有）

### Step 4.1: 写失败测试 — setup-noise comment 被 gate 过滤

```js
// review-feedback-task-spec.test.js（扩展或新增）
test('gate: setup-noise comment 被 isNoiseComment 过滤', async () => {
  // fixture: task registered, fetchComments returns 1 setup-noise + 1 real
  // expect: workItem only contains real comment
  // (按现有 test 骨架写 — 参考已有 review-feedback-task-spec 测试)
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

### Step 4.4: `index.ts` 注册时传入

```ts
// index.ts — 在 taskRunnerV2.register(createReviewFeedbackTaskSpec({...})) 里加
import { isSetupNoiseComment } from './infrastructure/email/setup-noise-filter.js';

// ...
isEchoComment: (c) => feedbackFilter.shouldSkipComment(c),
isEchoReview: (r) => feedbackFilter.shouldSkipReview(r),
isNoiseComment: (c) => isSetupNoiseComment(c.body), // 新增
```

### Step 4.5: 跑测试确认通过 + 跨文件回归

Run: `pnpm --filter @cat-cafe/api test:redis`
Expected: ALL PASS（review-feedback + severity + setup-noise + 现有 suite）

### Step 4.6: Commit

```bash
git add packages/api/src/infrastructure/email/ReviewFeedbackTaskSpec.ts \
        packages/api/src/index.ts \
        packages/api/test/review-feedback-task-spec.test.js
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
