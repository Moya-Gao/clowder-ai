---
feature_ids: [F141]
related_features: [F140, F133, F139]
topics: [github, webhook, repo-inbox, connector, tdd]
doc_kind: plan
created: 2026-03-26
---

# F141 Phase A: GitHub Repo Inbox — Webhook Adapter + Repo Inbox 投递

**Feature:** F141 — `docs/features/F141-github-repo-inbox.md`
**Goal:** GitHub 仓库新事件（PR opened / Issue opened / PR ready_for_review）自动投递到 per-repo inbox thread，触发猫执行 triage
**Acceptance Criteria:**
- AC-A1: `pull_request.opened` 事件自动投递到 inbox thread
- AC-A2: `issues.opened` 事件自动投递
- AC-A3: `pull_request.ready_for_review` 事件自动投递
- AC-A4: `X-Hub-Signature-256` HMAC-SHA256 签名校验
- AC-A5: `X-GitHub-Delivery` delivery id 去重
- AC-A6: ConnectorSource `github-repo-event` 注册 + ConnectorBubble 渲染
- AC-A7: 投递走 `deliverConnectorMessage()` 统一消息管线
- AC-A8: GitHubWebhookAdapter 单元测试覆盖
- ~~AC-A9~~: ✅ done (Design Gate)
- ~~AC-A10~~: ✅ done (Design Gate)
**Architecture:** 复用通用 webhook 端点 `POST /api/connectors/:connectorId/webhook`，新增 `github-repo-event` handler。HMAC 签名需 raw body（Fastify 内容解析器 scoped 到 webhook plugin）。delivery id 去重用 Redis SET NX EX（claim/confirm/rollback）。投递到 per-repo inbox thread 后 `invokeTrigger.trigger()` 唤醒猫。
**Tech Stack:** Fastify, ioredis, node:crypto (HMAC-SHA256), node:test
**前端验证:** Yes — ConnectorBubble icon 分支（KD-19），reviewer 需确认气泡渲染

---

## Straight-Line Check

**Finish line:** GitHub webhook → Cat Café inbox thread → cat wakes up for triage. 全链路端到端。

**NOT building:**
- Phase B reconciliation（另开 plan）
- multi-cat routing（Phase A = 单点收件 `GITHUB_REPO_INBOX_CAT_ID`）
- 自然语言 triage 逻辑（Skill 层已有 SOP，不在代码里）

---

## Terminal Schema

```typescript
// packages/api/src/infrastructure/connectors/github-repo-event/types.ts

/** GitHub webhook event types we handle */
type RepoEventAction = 'pull_request.opened' | 'pull_request.ready_for_review' | 'issues.opened';

/** Normalized signal from a GitHub repo event */
interface RepoInboxSignal {
  readonly eventType: RepoEventAction;
  readonly repoFullName: string;        // "owner/repo"
  readonly subjectType: 'pr' | 'issue';
  readonly number: number;
  readonly title: string;
  readonly url: string;                  // GitHub HTML URL
  readonly authorLogin: string;
  readonly authorAssociation: string;    // OWNER / MEMBER / CONTRIBUTOR / NONE etc.
  readonly deliveryId: string;           // X-GitHub-Delivery
  readonly action: string;              // opened / ready_for_review
}

/** Config from env vars */
interface GitHubRepoInboxConfig {
  readonly webhookSecret: string;        // GITHUB_WEBHOOK_SECRET
  readonly repoAllowlist: string[];      // GITHUB_REPO_ALLOWLIST (comma-separated)
  readonly inboxCatId: string;           // GITHUB_REPO_INBOX_CAT_ID
  readonly defaultUserId: string;        // for thread creation
}
```

---

## Task 1: Register `github-repo-event` in Connector Registry

**Files:**
- Modify: `packages/shared/src/types/connector.ts:77-215` (CONNECTOR_DEFINITIONS array)
- Modify: `packages/api/src/config/env-registry.ts` (add 3 env vars)

**Step 1: Add ConnectorDefinition to shared registry**

In `CONNECTOR_DEFINITIONS` array, after `github-review-feedback` entry:

```typescript
{
  id: 'github-repo-event',
  displayName: 'Repo Inbox',
  icon: 'github',
  color: { primary: '#24292e', secondary: '#F6F8FA' },
  description: 'GitHub 仓库事件通知（新 PR / 新 Issue）',
  tailwindTheme: {
    avatar: 'bg-gray-100 ring-2 ring-gray-300',
    label: 'text-gray-800',
    labelLink: 'text-gray-800 hover:text-black',
    bubble: 'border border-gray-300 bg-gray-50',
  },
},
```

**Step 2: Add env vars to env-registry.ts**

Add a "GitHub Repo Inbox (F141)" section with:
- `GITHUB_WEBHOOK_SECRET` — HMAC-SHA256 shared secret
- `GITHUB_REPO_ALLOWLIST` — comma-separated `owner/repo` list
- `GITHUB_REPO_INBOX_CAT_ID` — cat ID to receive inbox events

**Step 3: Rebuild shared**

```bash
pnpm --filter @cat-cafe/shared build
```

**Step 4: Verify registration — run existing connector test**

```bash
node --test packages/api/test/connector-webhook-route.test.js
```

Expected: all existing tests still pass (no regression).

**Step 5: Commit**

```bash
git add packages/shared/src/types/connector.ts packages/api/src/config/env-registry.ts
git commit -m "feat(F141): register github-repo-event connector + env vars [布偶猫🐾]"
```

---

## Task 2: RepoInboxSignal Type + Handler Config

**Files:**
- Create: `packages/api/src/infrastructure/connectors/github-repo-event/types.ts`

**Step 1: Write type definitions**

```typescript
/**
 * F141: GitHub Repo Inbox — Types
 */

/** GitHub webhook event types we handle */
export type RepoEventAction =
  | 'pull_request.opened'
  | 'pull_request.ready_for_review'
  | 'issues.opened';

/** Normalized signal from a GitHub repo event */
export interface RepoInboxSignal {
  readonly eventType: RepoEventAction;
  readonly repoFullName: string;
  readonly subjectType: 'pr' | 'issue';
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly authorLogin: string;
  readonly authorAssociation: string;
  readonly deliveryId: string;
  readonly action: string;
}

/** Config from env vars (KD-18) */
export interface GitHubRepoInboxConfig {
  readonly webhookSecret: string;
  readonly repoAllowlist: string[];
  readonly inboxCatId: string;
  readonly defaultUserId: string;
}
```

**Step 2: Verify TypeScript compiles**

```bash
pnpm lint
```

**Step 3: Commit**

```bash
git add packages/api/src/infrastructure/connectors/github-repo-event/types.ts
git commit -m "feat(F141): define RepoInboxSignal + config types [布偶猫🐾]"
```

---

## Task 3: HMAC-SHA256 Signature Verification (TDD)

**Files:**
- Create: `packages/api/src/infrastructure/connectors/github-repo-event/verify-signature.ts`
- Test: `packages/api/test/github-repo-webhook.test.js`

**Step 1: Write failing tests**

```javascript
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

// Helper: generate valid HMAC signature
function sign(secret, body) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyGitHubSignature', () => {
  // Dynamic import — module doesn't exist yet
  let verifyGitHubSignature;
  it('load module', async () => {
    const mod = await import('../dist/infrastructure/connectors/github-repo-event/verify-signature.js');
    verifyGitHubSignature = mod.verifyGitHubSignature;
  });

  it('returns true for valid signature', () => {
    const secret = 'test-secret';
    const body = Buffer.from('{"action":"opened"}');
    const sig = sign(secret, body);
    assert.equal(verifyGitHubSignature(secret, body, sig), true);
  });

  it('returns false for invalid signature', () => {
    const body = Buffer.from('{"action":"opened"}');
    assert.equal(verifyGitHubSignature('secret', body, 'sha256=bad'), false);
  });

  it('returns false for missing signature', () => {
    const body = Buffer.from('{}');
    assert.equal(verifyGitHubSignature('secret', body, ''), false);
    assert.equal(verifyGitHubSignature('secret', body, undefined), false);
  });

  it('returns false for wrong prefix', () => {
    const body = Buffer.from('{}');
    const hex = createHmac('sha256', 'secret').update(body).digest('hex');
    assert.equal(verifyGitHubSignature('secret', body, 'sha1=' + hex), false);
  });
});
```

**Step 2: Run — verify failure**

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/github-repo-webhook.test.js
```

Expected: FAIL — module not found.

**Step 3: Write implementation**

```typescript
/**
 * F141: GitHub Webhook Signature Verification (KD-11)
 *
 * GitHub signs webhook payloads with HMAC-SHA256 over the raw body bytes.
 * We MUST verify against the raw body, not re-serialized JSON.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyGitHubSignature(
  secret: string,
  rawBody: Buffer,
  signature: string | undefined,
): boolean {
  if (!signature || !signature.startsWith('sha256=')) return false;

  const expected = Buffer.from(
    'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex'),
    'utf8',
  );
  const received = Buffer.from(signature, 'utf8');

  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
```

**Step 4: Build + run tests — verify pass**

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/github-repo-webhook.test.js
```

Expected: all 4 HMAC tests pass.

**Step 5: Commit**

```bash
git add packages/api/src/infrastructure/connectors/github-repo-event/verify-signature.ts \
       packages/api/test/github-repo-webhook.test.js
git commit -m "feat(F141): HMAC-SHA256 signature verification (KD-11) [布偶猫🐾]"
```

---

## Task 4: Redis Delivery ID Dedup (TDD, KD-13)

**Files:**
- Create: `packages/api/src/infrastructure/connectors/github-repo-event/RedisDeliveryDedup.ts`
- Modify: `packages/api/test/github-repo-webhook.test.js` (append tests)

**Step 1: Write failing tests**

```javascript
describe('RedisDeliveryDedup', () => {
  let RedisDeliveryDedup;

  it('load module', async () => {
    const mod = await import('../dist/infrastructure/connectors/github-repo-event/RedisDeliveryDedup.js');
    RedisDeliveryDedup = mod.RedisDeliveryDedup;
  });

  // Mock Redis: minimal Map-based mock for SET NX EX / DEL
  function createMockRedis() {
    const store = new Map();
    return {
      store,
      async set(key, value, ...args) {
        // SET key value EX ttl NX
        const nxIdx = args.indexOf('NX');
        if (nxIdx !== -1 && store.has(key)) return null;
        store.set(key, value);
        return 'OK';
      },
      async del(key) {
        return store.delete(key) ? 1 : 0;
      },
    };
  }

  it('claim succeeds for new delivery ID', async () => {
    const redis = createMockRedis();
    const dedup = new RedisDeliveryDedup(redis);
    assert.equal(await dedup.claim('delivery-001'), true);
  });

  it('claim fails for already-claimed delivery ID', async () => {
    const redis = createMockRedis();
    const dedup = new RedisDeliveryDedup(redis);
    await dedup.claim('delivery-001');
    assert.equal(await dedup.claim('delivery-001'), false);
  });

  it('confirm updates value from pending to confirmed', async () => {
    const redis = createMockRedis();
    const dedup = new RedisDeliveryDedup(redis);
    await dedup.claim('delivery-001');
    await dedup.confirm('delivery-001');
    assert.equal(redis.store.get('f141:delivery:delivery-001'), 'confirmed');
  });

  it('rollback removes pending claim so retry can succeed', async () => {
    const redis = createMockRedis();
    const dedup = new RedisDeliveryDedup(redis);
    await dedup.claim('delivery-001');
    await dedup.rollback('delivery-001');
    // After rollback, a new claim should succeed
    assert.equal(await dedup.claim('delivery-001'), true);
  });
});
```

**Step 2: Run — verify failure**

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/github-repo-webhook.test.js
```

**Step 3: Write implementation**

```typescript
/**
 * F141: Redis Delivery ID Dedup (KD-13)
 *
 * GitHub webhook delivery IDs are deduplicated with Redis SET NX EX.
 * Three-phase: claim (before processing) → confirm (after success) → rollback (on failure).
 *
 * Why not memory Map: if deliverConnectorMessage fails, a memory dedup would
 * poison the delivery ID and prevent GitHub's retry from succeeding.
 */

interface RedisLike {
  set(key: string, value: string, ...args: (string | number)[]): Promise<string | null>;
  del(key: string): Promise<number>;
}

const KEY_PREFIX = 'f141:delivery:';
const TTL_SECONDS = 86400; // 24h — GitHub retries within 3 days, 24h covers most retries

export class RedisDeliveryDedup {
  constructor(private readonly redis: RedisLike) {}

  /** Attempt to claim a delivery ID. Returns true if this is the first claim. */
  async claim(deliveryId: string): Promise<boolean> {
    const result = await this.redis.set(
      KEY_PREFIX + deliveryId,
      'pending',
      'EX', TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  /** Mark delivery as confirmed (processing succeeded). */
  async confirm(deliveryId: string): Promise<void> {
    await this.redis.set(KEY_PREFIX + deliveryId, 'confirmed', 'EX', TTL_SECONDS);
  }

  /** Rollback claim so GitHub can retry. */
  async rollback(deliveryId: string): Promise<void> {
    await this.redis.del(KEY_PREFIX + deliveryId);
  }
}
```

**Step 4: Build + run tests**

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/github-repo-webhook.test.js
```

Expected: all dedup tests pass.

**Step 5: Commit**

```bash
git add packages/api/src/infrastructure/connectors/github-repo-event/RedisDeliveryDedup.ts \
       packages/api/test/github-repo-webhook.test.js
git commit -m "feat(F141): Redis delivery ID dedup with claim/confirm/rollback (KD-13) [布偶猫🐾]"
```

---

## Task 5: Extend ConnectorWebhookHandler for rawBody (KD-11)

**Files:**
- Modify: `packages/api/src/routes/connector-webhooks.ts:14-17` (interface) + `:29-60` (plugin)

**Step 1: Extend interface — add rawBody parameter**

```typescript
export interface ConnectorWebhookHandler {
  readonly connectorId: string;
  handleWebhook(
    body: unknown,
    headers: Record<string, string>,
    rawBody?: Buffer,
  ): Promise<WebhookHandleResult>;
}
```

**Step 2: Add scoped content type parser for raw body capture**

Inside `connectorWebhookRoutes` plugin, before the route definition:

```typescript
// Capture raw body for HMAC verification (KD-11).
// Scoped to this plugin — does not affect other routes.
app.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (_req: FastifyRequest, body: Buffer, done: ContentTypeParserDoneFunction) => {
    ((_req as unknown) as { rawBody: Buffer }).rawBody = body;
    try {
      done(null, JSON.parse(body.toString()));
    } catch (err) {
      done(err as Error, undefined);
    }
  },
);
```

**Step 3: Pass rawBody to handler**

```typescript
const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody;
const result = await handler.handleWebhook(request.body, request.headers as Record<string, string>, rawBody);
```

**Step 4: Build + run existing webhook route tests**

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/connector-webhook-route.test.js
```

Expected: all 5 existing tests still pass (backward compatible — existing handlers ignore rawBody).

**Step 5: Commit**

```bash
git add packages/api/src/routes/connector-webhooks.ts
git commit -m "feat(F141): extend ConnectorWebhookHandler with rawBody for HMAC (KD-11) [布偶猫🐾]"
```

---

## Task 6: GitHubRepoWebhookHandler (TDD — Core Handler)

**Files:**
- Create: `packages/api/src/infrastructure/connectors/github-repo-event/GitHubRepoWebhookHandler.ts`
- Modify: `packages/api/test/github-repo-webhook.test.js` (append handler tests)

This is the core task. The handler:
1. Verifies HMAC signature (KD-11)
2. Filters by event type (only `pull_request` + `issues`)
3. Filters by action (only `opened` / `ready_for_review`)
4. Checks repo allowlist
5. Claims delivery ID via Redis dedup (KD-13)
6. Normalizes to `RepoInboxSignal`
7. Finds or creates per-repo inbox thread (KD-14, KD-20)
8. Delivers via `deliverConnectorMessage()` (KD-5, AC-A7)
9. Triggers cat via `invokeTrigger.trigger()` (KD-17)
10. Confirms delivery ID

**Step 1: Write failing tests**

```javascript
describe('GitHubRepoWebhookHandler', () => {
  let GitHubRepoWebhookHandler;

  it('load module', async () => {
    const mod = await import('../dist/infrastructure/connectors/github-repo-event/GitHubRepoWebhookHandler.js');
    GitHubRepoWebhookHandler = mod.GitHubRepoWebhookHandler;
  });

  const SECRET = 'test-secret-key';
  const CONFIG = {
    webhookSecret: SECRET,
    repoAllowlist: ['zts212653/clowder-ai'],
    inboxCatId: 'cat-maine-coon',
    defaultUserId: 'user-maintainer',
  };

  function makePayload(eventType, action, overrides = {}) {
    const isPR = eventType === 'pull_request';
    const subject = isPR
      ? { number: 42, title: 'Add feature X', html_url: 'https://github.com/zts212653/clowder-ai/pull/42',
          user: { login: 'contributor', id: 12345 }, author_association: 'NONE', draft: false }
      : { number: 7, title: 'Bug report', html_url: 'https://github.com/zts212653/clowder-ai/issues/7',
          user: { login: 'reporter', id: 67890 }, author_association: 'NONE' };
    return {
      action,
      repository: { full_name: 'zts212653/clowder-ai' },
      sender: { login: isPR ? 'contributor' : 'reporter', id: isPR ? 12345 : 67890 },
      [eventType]: subject,
      ...overrides,
    };
  }

  function makeHeaders(eventType, deliveryId, body) {
    const raw = Buffer.from(JSON.stringify(body));
    return {
      'x-github-event': eventType,
      'x-github-delivery': deliveryId,
      'x-hub-signature-256': sign(SECRET, raw),
    };
  }

  function createMockDeps() {
    const deliveredMessages = [];
    const triggeredCalls = [];
    const boundThreads = new Map();
    let threadCounter = 0;
    return {
      deliveredMessages,
      triggeredCalls,
      boundThreads,
      bindingStore: {
        async getByExternal(connectorId, externalChatId) {
          return boundThreads.get(`${connectorId}:${externalChatId}`) ?? null;
        },
        async bind(connectorId, externalChatId, threadId, userId) {
          const binding = { connectorId, externalChatId, threadId, userId, createdAt: Date.now() };
          boundThreads.set(`${connectorId}:${externalChatId}`, binding);
          return binding;
        },
      },
      threadStore: {
        async create(userId, title) {
          threadCounter++;
          return { id: `thread-${threadCounter}`, title, createdBy: userId, createdAt: Date.now() };
        },
      },
      deliverFn: async (_deps, input) => {
        deliveredMessages.push(input);
        return { messageId: 'msg-' + deliveredMessages.length, content: input.content };
      },
      invokeTrigger: {
        trigger(...args) { triggeredCalls.push(args); },
      },
      dedup: {
        claimed: new Set(),
        async claim(id) {
          if (this.claimed.has(id)) return false;
          this.claimed.add(id);
          return true;
        },
        async confirm() {},
        async rollback(id) { this.claimed.delete(id); },
      },
    };
  }

  it('processes pull_request.opened event (AC-A1)', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);
    const body = makePayload('pull_request', 'opened');
    const raw = Buffer.from(JSON.stringify(body));
    const headers = makeHeaders('pull_request', 'delivery-001', body);

    const result = await handler.handleWebhook(body, headers, raw);

    assert.equal(result.kind, 'processed');
    assert.equal(deps.deliveredMessages.length, 1);
    assert.ok(deps.deliveredMessages[0].content.includes('#42'));
    assert.equal(deps.triggeredCalls.length, 1);
  });

  it('processes issues.opened event (AC-A2)', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);
    const body = makePayload('issues', 'opened');
    const raw = Buffer.from(JSON.stringify(body));
    const headers = makeHeaders('issues', 'delivery-002', body);

    const result = await handler.handleWebhook(body, headers, raw);

    assert.equal(result.kind, 'processed');
    assert.equal(deps.deliveredMessages.length, 1);
    assert.ok(deps.deliveredMessages[0].content.includes('#7'));
  });

  it('processes pull_request.ready_for_review event (AC-A3)', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);
    const body = makePayload('pull_request', 'ready_for_review');
    const raw = Buffer.from(JSON.stringify(body));
    const headers = makeHeaders('pull_request', 'delivery-003', body);

    const result = await handler.handleWebhook(body, headers, raw);

    assert.equal(result.kind, 'processed');
    assert.ok(deps.deliveredMessages[0].content.includes('ready for review'));
  });

  it('rejects invalid HMAC signature (AC-A4)', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);
    const body = makePayload('pull_request', 'opened');
    const raw = Buffer.from(JSON.stringify(body));
    const headers = {
      'x-github-event': 'pull_request',
      'x-github-delivery': 'delivery-bad',
      'x-hub-signature-256': 'sha256=invalid',
    };

    const result = await handler.handleWebhook(body, headers, raw);

    assert.equal(result.kind, 'error');
    assert.equal(result.status, 403);
    assert.equal(deps.deliveredMessages.length, 0);
  });

  it('deduplicates by delivery ID (AC-A5)', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);
    const body = makePayload('pull_request', 'opened');
    const raw = Buffer.from(JSON.stringify(body));
    const headers = makeHeaders('pull_request', 'delivery-dup', body);

    await handler.handleWebhook(body, headers, raw);
    const result2 = await handler.handleWebhook(body, headers, raw);

    assert.equal(result2.kind, 'skipped');
    assert.ok(result2.reason.includes('duplicate'));
    assert.equal(deps.deliveredMessages.length, 1); // only first delivered
  });

  it('sets correct ConnectorSource (AC-A6)', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);
    const body = makePayload('pull_request', 'opened');
    const raw = Buffer.from(JSON.stringify(body));
    const headers = makeHeaders('pull_request', 'delivery-src', body);

    await handler.handleWebhook(body, headers, raw);

    const source = deps.deliveredMessages[0].source;
    assert.equal(source.connector, 'github-repo-event');
    assert.equal(source.label, 'Repo Inbox');
    assert.equal(source.icon, 'github');
    assert.equal(source.sender.name, 'contributor');
    assert.ok(source.url.includes('/pull/42'));
  });

  it('calls invokeTrigger.trigger after delivery (KD-17)', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);
    const body = makePayload('issues', 'opened');
    const raw = Buffer.from(JSON.stringify(body));
    const headers = makeHeaders('issues', 'delivery-trig', body);

    await handler.handleWebhook(body, headers, raw);

    assert.equal(deps.triggeredCalls.length, 1);
    const [threadId, catId] = deps.triggeredCalls[0];
    assert.ok(threadId.startsWith('thread-'));
    assert.equal(catId, 'cat-maine-coon');
  });

  it('skips unhandled event types', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);
    const headers = {
      'x-github-event': 'push',
      'x-github-delivery': 'delivery-push',
      'x-hub-signature-256': sign(SECRET, Buffer.from('{}')),
    };

    const result = await handler.handleWebhook({}, headers, Buffer.from('{}'));

    assert.equal(result.kind, 'skipped');
    assert.ok(result.reason.includes('push'));
  });

  it('skips repos not in allowlist', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);
    const body = {
      action: 'opened',
      repository: { full_name: 'stranger/repo' },
      sender: { login: 'x', id: 1 },
      pull_request: { number: 1, title: 'PR', html_url: 'https://github.com/stranger/repo/pull/1',
        user: { login: 'x', id: 1 }, author_association: 'NONE', draft: false },
    };
    const raw = Buffer.from(JSON.stringify(body));
    const headers = makeHeaders('pull_request', 'delivery-deny', body);

    const result = await handler.handleWebhook(body, headers, raw);

    assert.equal(result.kind, 'skipped');
    assert.ok(result.reason.includes('allowlist'));
  });

  it('skips draft PRs on opened (only ready_for_review matters for drafts)', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);
    const body = makePayload('pull_request', 'opened', {
      pull_request: {
        number: 99, title: 'Draft PR', html_url: 'https://github.com/zts212653/clowder-ai/pull/99',
        user: { login: 'dev', id: 111 }, author_association: 'NONE', draft: true,
      },
    });
    const raw = Buffer.from(JSON.stringify(body));
    const headers = makeHeaders('pull_request', 'delivery-draft', body);

    const result = await handler.handleWebhook(body, headers, raw);

    assert.equal(result.kind, 'skipped');
    assert.ok(result.reason.includes('draft'));
  });

  it('creates new inbox thread on first event for a repo (KD-14)', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);
    const body = makePayload('issues', 'opened');
    const raw = Buffer.from(JSON.stringify(body));
    const headers = makeHeaders('issues', 'delivery-new-thread', body);

    await handler.handleWebhook(body, headers, raw);

    // Thread was created and bound
    const binding = deps.boundThreads.get('github-repo-event:zts212653/clowder-ai');
    assert.ok(binding);
    assert.ok(binding.threadId.startsWith('thread-'));
  });

  it('reuses existing inbox thread for same repo', async () => {
    const deps = createMockDeps();
    const handler = new GitHubRepoWebhookHandler(CONFIG, deps);

    // First event creates thread
    const body1 = makePayload('issues', 'opened');
    const raw1 = Buffer.from(JSON.stringify(body1));
    await handler.handleWebhook(body1, makeHeaders('issues', 'd-1', body1), raw1);

    // Second event reuses it
    const body2 = makePayload('pull_request', 'opened');
    const raw2 = Buffer.from(JSON.stringify(body2));
    await handler.handleWebhook(body2, makeHeaders('pull_request', 'd-2', body2), raw2);

    assert.equal(deps.deliveredMessages[0].threadId, deps.deliveredMessages[1].threadId);
  });
});
```

**Step 2: Run — verify failures**

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/github-repo-webhook.test.js
```

**Step 3: Write handler implementation**

```typescript
/**
 * F141: GitHub Repo Webhook Handler
 *
 * Implements ConnectorWebhookHandler for github-repo-event.
 * Pipeline: HMAC → event filter → allowlist → dedup → normalize → bind thread → deliver → trigger
 */
import type { CatId, ConnectorSource } from '@cat-cafe/shared';
import type { WebhookHandleResult } from '../../../routes/connector-webhooks.js';
import type { IConnectorThreadBindingStore } from '../ConnectorThreadBindingStore.js';
import type {
  ConnectorDeliveryDeps,
  ConnectorDeliveryInput,
  ConnectorDeliveryResult,
} from '../../email/deliver-connector-message.js';
import type { RedisDeliveryDedup } from './RedisDeliveryDedup.js';
import type { GitHubRepoInboxConfig, RepoInboxSignal } from './types.js';
import { verifyGitHubSignature } from './verify-signature.js';

const CONNECTOR_ID = 'github-repo-event';

/** Events we handle: event header → allowed actions */
const ALLOWED_EVENTS: Record<string, readonly string[]> = {
  pull_request: ['opened', 'ready_for_review'],
  issues: ['opened'],
};

interface GitHubRepoHandlerDeps {
  readonly bindingStore: Pick<IConnectorThreadBindingStore, 'getByExternal' | 'bind'>;
  readonly threadStore: { create(userId: string, title?: string): Promise<{ id: string }> | { id: string } };
  readonly deliverFn: (deps: ConnectorDeliveryDeps, input: ConnectorDeliveryInput) => Promise<ConnectorDeliveryResult>;
  readonly invokeTrigger: {
    trigger(threadId: string, catId: CatId, userId: string, message: string, messageId: string): void;
  };
  readonly dedup: RedisDeliveryDedup;
  readonly deliveryDeps?: ConnectorDeliveryDeps;
}

export class GitHubRepoWebhookHandler {
  readonly connectorId = CONNECTOR_ID;

  constructor(
    private readonly config: GitHubRepoInboxConfig,
    private readonly deps: GitHubRepoHandlerDeps,
  ) {}

  async handleWebhook(
    body: unknown,
    headers: Record<string, string>,
    rawBody?: Buffer,
  ): Promise<WebhookHandleResult> {
    // 1. HMAC verification (KD-11)
    if (!rawBody || !verifyGitHubSignature(this.config.webhookSecret, rawBody, headers['x-hub-signature-256'])) {
      return { kind: 'error', status: 403, message: 'Invalid signature' };
    }

    // 2. Event type filter
    const eventType = headers['x-github-event'];
    const allowedActions = ALLOWED_EVENTS[eventType];
    if (!allowedActions) {
      return { kind: 'skipped', reason: `Unhandled event type: ${eventType}` };
    }

    const payload = body as Record<string, unknown>;
    const action = payload.action as string;
    if (!allowedActions.includes(action)) {
      return { kind: 'skipped', reason: `Unhandled action: ${eventType}.${action}` };
    }

    // 3. Repo allowlist
    const repo = (payload.repository as { full_name: string })?.full_name;
    if (!this.config.repoAllowlist.includes(repo)) {
      return { kind: 'skipped', reason: `Repo not in allowlist: ${repo}` };
    }

    // 4. Skip draft PRs on opened (they'll come back as ready_for_review)
    const subject = (payload[eventType] ?? payload.issue) as Record<string, unknown>;
    if (eventType === 'pull_request' && action === 'opened' && subject.draft) {
      return { kind: 'skipped', reason: 'Skipping draft PR opened event' };
    }

    // 5. Delivery ID dedup (KD-13)
    const deliveryId = headers['x-github-delivery'] ?? '';
    if (!(await this.deps.dedup.claim(deliveryId))) {
      return { kind: 'skipped', reason: `Duplicate delivery: ${deliveryId}` };
    }

    try {
      // 6. Normalize to RepoInboxSignal
      const signal = this.normalize(eventType, action, payload, subject, deliveryId);

      // 7. Find or create per-repo inbox thread (KD-14)
      const threadId = await this.ensureInboxThread(signal.repoFullName);

      // 8. Build message content
      const content = this.formatMessage(signal);

      // 9. Build ConnectorSource (KD-12)
      const source: ConnectorSource = {
        connector: CONNECTOR_ID,
        label: 'Repo Inbox',
        icon: 'github',
        url: signal.url,
        meta: {
          repoFullName: signal.repoFullName,
          subjectType: signal.subjectType,
          number: signal.number,
          action: signal.action,
          deliveryId: signal.deliveryId,
          authorAssociation: signal.authorAssociation,
        },
        sender: {
          id: String((payload.sender as { id: number }).id),
          name: signal.authorLogin,
        },
      };

      // 10. Deliver via unified pipeline (AC-A7)
      const delivered = await this.deps.deliverFn(
        this.deps.deliveryDeps ?? ({} as ConnectorDeliveryDeps),
        {
          threadId,
          userId: this.config.defaultUserId,
          catId: this.config.inboxCatId,
          content,
          source,
        },
      );

      // 11. Trigger cat execution (KD-17)
      this.deps.invokeTrigger.trigger(
        threadId,
        this.config.inboxCatId as CatId,
        this.config.defaultUserId,
        content,
        delivered.messageId,
      );

      // 12. Confirm dedup
      await this.deps.dedup.confirm(deliveryId);

      return { kind: 'processed', messageId: delivered.messageId };
    } catch (err) {
      // Rollback dedup so GitHub can retry
      await this.deps.dedup.rollback(deliveryId);
      throw err;
    }
  }

  private normalize(
    eventType: string,
    action: string,
    payload: Record<string, unknown>,
    subject: Record<string, unknown>,
    deliveryId: string,
  ): RepoInboxSignal {
    const repo = (payload.repository as { full_name: string }).full_name;
    const subjectType = eventType === 'pull_request' ? 'pr' : 'issue';
    return {
      eventType: `${eventType}.${action}` as RepoInboxSignal['eventType'],
      repoFullName: repo,
      subjectType,
      number: subject.number as number,
      title: subject.title as string,
      url: subject.html_url as string,
      authorLogin: (subject.user as { login: string }).login,
      authorAssociation: (subject.author_association as string) ?? 'NONE',
      deliveryId,
      action,
    };
  }

  private formatMessage(signal: RepoInboxSignal): string {
    const typeEmoji = signal.subjectType === 'pr' ? '🔀' : '🆕';
    const actionLabel = signal.action === 'ready_for_review' ? 'ready for review' : 'opened';
    return [
      `${typeEmoji} **${signal.subjectType === 'pr' ? 'PR' : 'Issue'} #${signal.number}** ${actionLabel}`,
      `**${signal.title}**`,
      `by \`${signal.authorLogin}\` (${signal.authorAssociation}) in \`${signal.repoFullName}\``,
      signal.url,
    ].join('\n');
  }

  /** KD-14 + KD-20: Find existing binding or create new inbox thread with compare-and-bind */
  private async ensureInboxThread(repoFullName: string): Promise<string> {
    // Check existing binding
    const existing = await this.deps.bindingStore.getByExternal(CONNECTOR_ID, repoFullName);
    if (existing) return existing.threadId;

    // Create new thread + bind atomically (KD-20: the Redis binding store's bind()
    // is atomic via Lua script, so concurrent calls get the same thread)
    const thread = await this.deps.threadStore.create(
      this.config.defaultUserId,
      `Repo Inbox · ${repoFullName}`,
    );
    const binding = await this.deps.bindingStore.bind(
      CONNECTOR_ID,
      repoFullName,
      thread.id,
      this.config.defaultUserId,
    );
    return binding.threadId;
  }
}
```

**Step 4: Build + run tests**

```bash
pnpm --filter @cat-cafe/api build && node --test packages/api/test/github-repo-webhook.test.js
```

Expected: all handler tests pass.

**Step 5: Commit**

```bash
git add packages/api/src/infrastructure/connectors/github-repo-event/GitHubRepoWebhookHandler.ts \
       packages/api/test/github-repo-webhook.test.js
git commit -m "feat(F141): GitHubRepoWebhookHandler — full delivery pipeline (AC-A1~A8) [布偶猫🐾]"
```

---

## Task 7: Register Handler in Gateway Bootstrap

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts`

**Step 1: Import handler + dedup**

```typescript
import { GitHubRepoWebhookHandler } from './github-repo-event/GitHubRepoWebhookHandler.js';
import { RedisDeliveryDedup } from './github-repo-event/RedisDeliveryDedup.js';
```

**Step 2: Register handler in startConnectorGateway**

After the Feishu webhook handler registration block, add:

```typescript
// ── F141: GitHub Repo Inbox webhook handler ──
const ghWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
const ghRepoAllowlist = process.env.GITHUB_REPO_ALLOWLIST;
const ghInboxCatId = process.env.GITHUB_REPO_INBOX_CAT_ID;

if (ghWebhookSecret && ghRepoAllowlist && ghInboxCatId && deps.redis) {
  const ghDedup = new RedisDeliveryDedup(deps.redis);
  const ghHandler = new GitHubRepoWebhookHandler(
    {
      webhookSecret: ghWebhookSecret,
      repoAllowlist: ghRepoAllowlist.split(',').map((r) => r.trim()),
      inboxCatId: ghInboxCatId,
      defaultUserId: deps.defaultUserId,
    },
    {
      bindingStore,
      threadStore: deps.threadStore,
      deliverFn: deliverConnectorMessage,
      invokeTrigger: deps.invokeTrigger,
      dedup: ghDedup,
      deliveryDeps: { messageStore: deps.messageStore, socketManager: deps.socketManager },
    },
  );
  webhookHandlers.set('github-repo-event', ghHandler);
  log.info('[F141] GitHub Repo Inbox webhook handler registered');
} else if (ghWebhookSecret || ghRepoAllowlist || ghInboxCatId) {
  log.warn('[F141] GitHub Repo Inbox partially configured — set all 3 env vars + Redis to enable');
}
```

**Step 3: Build + verify no type errors**

```bash
pnpm --filter @cat-cafe/api build && pnpm lint
```

**Step 4: Run full test suite**

```bash
node --test packages/api/test/connector-webhook-route.test.js && node --test packages/api/test/github-repo-webhook.test.js
```

**Step 5: Commit**

```bash
git add packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts
git commit -m "feat(F141): register GitHubRepoWebhookHandler in gateway bootstrap [布偶猫🐾]"
```

---

## Task 8: ConnectorBubble Icon Branch (KD-19, Frontend)

**Files:**
- Modify: `packages/web/src/components/ConnectorBubble.tsx:52-83` (ConnectorIcon switch)

**Step 1: Add icon branch**

In the `ConnectorIcon` switch statement, add a case for `github-repo-event`:

```typescript
case 'github-repo-event':
  return <GitHubIcon className={iconClasses} />;
```

This groups with the existing `github-review` and `github-ci` cases that already use `GitHubIcon`.

**Step 2: Verify build**

```bash
pnpm --filter @cat-cafe/web build
```

**Step 3: Commit**

```bash
git add packages/web/src/components/ConnectorBubble.tsx
git commit -m "feat(F141): ConnectorBubble icon branch for github-repo-event (KD-19) [布偶猫🐾]"
```

---

## Task 9: Quality Gate

**Step 1: Full build**

```bash
pnpm check && pnpm lint
```

**Step 2: Run all related tests**

```bash
node --test packages/api/test/github-repo-webhook.test.js && node --test packages/api/test/connector-webhook-route.test.js
```

**Step 3: Run `pnpm gate`**

```bash
pnpm gate
```

---

## AC Coverage Matrix

| AC | Task | Verification |
|----|------|-------------|
| AC-A1: PR opened | Task 6 test `processes pull_request.opened` | ✅ |
| AC-A2: Issues opened | Task 6 test `processes issues.opened` | ✅ |
| AC-A3: PR ready_for_review | Task 6 test `processes ready_for_review` | ✅ |
| AC-A4: HMAC verification | Task 3 (verify-signature) + Task 6 `rejects invalid HMAC` | ✅ |
| AC-A5: Delivery ID dedup | Task 4 (RedisDeliveryDedup) + Task 6 `deduplicates` | ✅ |
| AC-A6: ConnectorSource + Bubble | Task 1 (registry) + Task 6 `correct ConnectorSource` + Task 8 (icon) | ✅ |
| AC-A7: deliverConnectorMessage | Task 6 — handler calls deliverFn | ✅ |
| AC-A8: Unit tests | Task 3 + 4 + 6 — full test coverage | ✅ |
| AC-A9: Skill docs | ✅ Done in Design Gate | — |
| AC-A10: repo-inbox.md | ✅ Done in Design Gate | — |

## KD Coverage Matrix

| KD | Task | Note |
|----|------|------|
| KD-11 rawBody HMAC | Task 3 + 5 | verify-signature + content parser |
| KD-12 三处统一 ID | Task 1 + 6 | registry + handler `connectorId` |
| KD-13 Redis dedup | Task 4 + 6 | claim/confirm/rollback |
| KD-14 per-repo thread | Task 6 | `ensureInboxThread` |
| KD-15 transport vs business dedup | Task 4 | Redis key prefix `f141:delivery:` separate from business |
| KD-16 env cat ID | Task 1 + 7 | `GITHUB_REPO_INBOX_CAT_ID` |
| KD-17 invokeTrigger | Task 6 | test `calls invokeTrigger` |
| KD-18 env-registry | Task 1 | 3 env vars registered |
| KD-19 ConnectorBubble | Task 8 | icon branch |
| KD-20 compare-and-bind | Task 6 | Redis binding store atomic Lua |
