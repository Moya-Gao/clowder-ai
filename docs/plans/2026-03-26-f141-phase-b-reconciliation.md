# F141 Phase B: Reconciliation Scan — Implementation Plan

**Feature:** F141 — `docs/features/F141-github-repo-inbox.md`
**Goal:** 补偿扫描——webhook 漏掉的 open PR/Issue 通过定时 `gh api` 查询补发到 inbox thread
**Acceptance Criteria:**
- AC-B1: RepoScanTaskSpec 注册为 F139 TaskSpec_P1 consumer（profile=poller, actor=repo-watcher）
- AC-B2: gate 查 open PRs/Issues，过滤已通知对象，返回 typed signal
- AC-B3: webhook 丢失事件后，reconciliation 补发通知（与 Phase A 共用 deliverConnectorMessage）
- AC-B4: run ledger 记录每次扫描结果
**Architecture:** RepoScanTaskSpec follows the proven F139 consumer pattern (CiCdCheckTaskSpec/ConflictCheckTaskSpec). Gate queries `gh api` for open PRs/Issues per allowlisted repo, filters via Redis business dedup (KD-15: separate from transport dedup), returns WorkItem<RepoInboxSignal>[]. Execute reuses Phase A's deliverConnectorMessage + invokeTrigger pipeline.
**Tech Stack:** TypeScript, F139 TaskSpec_P1, `gh` CLI, Redis SET, deliverConnectorMessage
**NOT building:** Phase C (smart routing / auto-assignment), issue lifecycle tracking (OQ-2), multi-webhook-secret per repo

---

## Terminal Schema

```typescript
// ReconciliationDedup — business-level "already notified" (KD-15)
// Key: f141:notified:{repoFullName}#{type}-{number}  Value: 1  TTL: 7d
class ReconciliationDedup {
  isNotified(repo: string, type: 'pr'|'issue', number: number): Promise<boolean>;
  markNotified(repo: string, type: 'pr'|'issue', number: number): Promise<void>;
}

// RepoScanTaskSpec — TaskSpec_P1<RepoInboxSignal>
// id: 'repo-scan', profile: 'poller', trigger: interval 300_000
// gate: gh api → filter notified → WorkItem[]
// execute: deliverConnectorMessage → mark notified → trigger cat
```

---

## Task 1: ReconciliationDedup

**Files:**
- Create: `packages/api/src/infrastructure/connectors/github-repo-event/ReconciliationDedup.ts`
- Test: `packages/api/test/reconciliation-dedup.test.js`

### Step 1: Write failing tests

```javascript
// 4 tests: isNotified false when new, true after mark, different items independent, uses correct key prefix
```

### Step 2: Run tests — expect FAIL (module not found)

```bash
node --test packages/api/test/reconciliation-dedup.test.js
```

### Step 3: Implement ReconciliationDedup

```typescript
import type { RedisLike } from './RedisDeliveryDedup.js';

const KEY_PREFIX = 'f141:notified:';
const TTL_SECONDS = 604800; // 7 days

export class ReconciliationDedup {
  constructor(private readonly redis: RedisLike) {}

  private key(repo: string, type: 'pr' | 'issue', number: number): string {
    return `${KEY_PREFIX}${repo}#${type}-${number}`;
  }

  async isNotified(repo: string, type: 'pr' | 'issue', number: number): Promise<boolean> {
    // SET NX returns null if key exists → we check by trying to set
    // Actually: just use GET semantics via SET NX — if NX fails, key exists
    const result = await this.redis.set(this.key(repo, type, number), '1', 'EX', TTL_SECONDS, 'NX');
    if (result === 'OK') {
      // Key didn't exist — we just created it, roll back
      await this.redis.del(this.key(repo, type, number));
      return false;
    }
    return true;
  }

  async markNotified(repo: string, type: 'pr' | 'issue', number: number): Promise<void> {
    await this.redis.set(this.key(repo, type, number), '1', 'EX', TTL_SECONDS);
  }
}
```

> **Wait** — the `isNotified` above is ugly (SET NX + rollback). Better: extend RedisLike to include GET, or just use EXISTS semantics via SET NX probe. Actually the simplest: add `get` to RedisLike.

Revised approach — add `get` to a new `ReconciliationRedisLike` interface:

```typescript
export interface ReconciliationRedisLike {
  set(key: string, value: string, exToken: 'EX', ttl: number): Promise<string | null>;
  get(key: string): Promise<string | null>;
}

export class ReconciliationDedup {
  constructor(private readonly redis: ReconciliationRedisLike) {}

  async isNotified(repo: string, type: 'pr' | 'issue', number: number): Promise<boolean> {
    const result = await this.redis.get(this.key(repo, type, number));
    return result !== null;
  }

  async markNotified(repo: string, type: 'pr' | 'issue', number: number): Promise<void> {
    await this.redis.set(this.key(repo, type, number), '1', 'EX', TTL_SECONDS);
  }
}
```

### Step 4: Run tests — expect PASS

### Step 5: Commit

```
feat(F141): add ReconciliationDedup for business-level dedup (KD-15)
```

---

## Task 2: Wire Phase A to mark business dedup

Phase A webhook delivery must mark notified items so Phase B gate can skip them.

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/github-repo-event/GitHubRepoWebhookHandler.ts` — add optional `reconciliationDedup` to deps
- Modify: `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts` — pass reconciliationDedup
- Modify: `packages/api/test/github-repo-webhook.test.js` — add test for dedup marking

### Step 1: Write failing test

Add test: "marks reconciliation dedup after successful delivery"
- Mock reconciliationDedup with spy on `markNotified`
- Send valid webhook → assert `markNotified(repo, 'pr', number)` called

### Step 2: Run test — expect FAIL

### Step 3: Add reconciliationDedup to handler

In `GitHubRepoWebhookHandler`:
- Add `reconciliationDedup?: ReconciliationDedup` to `GitHubRepoHandlerDeps`
- After confirm (step 13), call `this.deps.reconciliationDedup?.markNotified(signal.repoFullName, signal.subjectType, signal.number)`
- Best-effort (swallow errors — same pattern as confirm)

In `connector-gateway-bootstrap.ts`:
- Create `ReconciliationDedup` instance alongside `RedisDeliveryDedup`
- Pass to handler deps

### Step 4: Run full test suite — expect PASS

```bash
node --test packages/api/test/github-repo-webhook.test.js
```

### Step 5: Commit

```
feat(F141): Phase A marks business dedup for Phase B reconciliation
```

---

## Task 3: RepoScanTaskSpec — gate

**Files:**
- Create: `packages/api/src/infrastructure/connectors/github-repo-event/RepoScanTaskSpec.ts`
- Test: `packages/api/test/repo-scan-task-spec.test.js`

### Step 1: Write failing tests for gate

```javascript
// Test 1: gate returns { run: false } when no repos in allowlist
// Test 2: gate returns workItems for unnotified open PRs
// Test 3: gate filters out already-notified items
// Test 4: gate filters out draft PRs
// Test 5: gate returns { run: false } when all items already notified
// Test 6: gate handles gh api failure gracefully (fail-open per repo)
```

### Step 2: Run tests — expect FAIL

### Step 3: Implement gate

```typescript
export interface RepoScanTaskSpecOptions {
  repoAllowlist: string[];
  inboxCatId: string;
  defaultUserId: string;
  reconciliationDedup: ReconciliationDedup;
  bindingStore: Pick<IConnectorThreadBindingStore, 'getByExternal'>;
  deliverFn: typeof deliverConnectorMessage;
  deliveryDeps: ConnectorDeliveryDeps;
  invokeTrigger: { trigger(...): void };
  fetchOpenPRs: (repo: string) => Promise<GhPrItem[]>;
  fetchOpenIssues: (repo: string) => Promise<GhIssueItem[]>;
  log: { info(...): void; warn(...): void };
  pollIntervalMs?: number;
}

export function createRepoScanTaskSpec(opts: RepoScanTaskSpecOptions): TaskSpec_P1<RepoInboxSignal> {
  return {
    id: 'repo-scan',
    profile: 'poller',
    trigger: { type: 'interval', ms: opts.pollIntervalMs ?? 300_000 },
    admission: {
      async gate() {
        if (opts.repoAllowlist.length === 0) {
          return { run: false, reason: 'no repos in allowlist' };
        }

        const workItems: { signal: RepoInboxSignal; subjectKey: string }[] = [];

        for (const repo of opts.repoAllowlist) {
          try {
            // Fetch open PRs
            const prs = await opts.fetchOpenPRs(repo);
            for (const pr of prs) {
              if (pr.draft) continue; // match Phase A: skip drafts
              if (await opts.reconciliationDedup.isNotified(repo, 'pr', pr.number)) continue;
              workItems.push({
                signal: {
                  eventType: 'pull_request.opened',
                  repoFullName: repo,
                  subjectType: 'pr',
                  number: pr.number,
                  title: pr.title,
                  url: pr.html_url,
                  authorLogin: pr.user,
                  authorAssociation: pr.author_association,
                  deliveryId: `reconciliation-pr-${repo}#${pr.number}`,
                  action: 'opened',
                },
                subjectKey: `repo-${repo}#pr-${pr.number}`,
              });
            }

            // Fetch open Issues (exclude PRs that show up in issues endpoint)
            const issues = await opts.fetchOpenIssues(repo);
            for (const issue of issues) {
              if (await opts.reconciliationDedup.isNotified(repo, 'issue', issue.number)) continue;
              workItems.push({
                signal: {
                  eventType: 'issues.opened',
                  repoFullName: repo,
                  subjectType: 'issue',
                  number: issue.number,
                  title: issue.title,
                  url: issue.html_url,
                  authorLogin: issue.user,
                  authorAssociation: issue.author_association,
                  deliveryId: `reconciliation-issue-${repo}#${issue.number}`,
                  action: 'opened',
                },
                subjectKey: `repo-${repo}#issue-${issue.number}`,
              });
            }
          } catch {
            // fail-open per repo — log and skip
            opts.log.warn(`[repo-scan] Failed to scan ${repo}, skipping`);
          }
        }

        if (workItems.length === 0) {
          return { run: false, reason: 'no unnotified items' };
        }
        return { run: true, workItems };
      },
    },
    // ... (execute in Task 4)
  };
}
```

### Step 4: Run tests — expect PASS

### Step 5: Commit

```
feat(F141): RepoScanTaskSpec gate — query open PRs/Issues + dedup filter
```

---

## Task 4: RepoScanTaskSpec — execute + registration

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/github-repo-event/RepoScanTaskSpec.ts` — add execute
- Modify: `packages/api/src/index.ts` — register
- Test: `packages/api/test/repo-scan-task-spec.test.js` — add execute tests

### Step 1: Write failing tests for execute

```javascript
// Test 1: execute delivers message to correct inbox thread
// Test 2: execute marks item as notified after delivery
// Test 3: execute triggers cat after delivery
// Test 4: execute skips delivery if no inbox thread (repo never had webhook event)
```

### Step 2: Run tests — expect FAIL

### Step 3: Implement execute

```typescript
run: {
  overlap: 'skip',
  timeoutMs: 30_000,
  async execute(signal: RepoInboxSignal, _subjectKey: string, _ctx: ExecuteContext) {
    // Find inbox thread (created by Phase A webhook)
    const binding = await opts.bindingStore.getByExternal('github-repo-event', signal.repoFullName);
    if (!binding) {
      opts.log.warn(`[repo-scan] No inbox thread for ${signal.repoFullName}, skipping`);
      return;
    }

    const content = formatReconciliationMessage(signal);
    const source: ConnectorSource = {
      connector: 'github-repo-event',
      label: 'Repo Inbox (reconciliation)',
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
      sender: { id: signal.authorLogin, name: signal.authorLogin },
    };

    const delivered = await opts.deliverFn(opts.deliveryDeps, {
      threadId: binding.threadId,
      userId: opts.defaultUserId,
      catId: opts.inboxCatId,
      content,
      source,
    });

    // Mark notified AFTER successful delivery
    await opts.reconciliationDedup.markNotified(signal.repoFullName, signal.subjectType, signal.number);

    // Trigger cat (best-effort)
    try {
      opts.invokeTrigger.trigger(
        binding.threadId,
        opts.inboxCatId as CatId,
        opts.defaultUserId,
        content,
        delivered.messageId,
      );
    } catch {
      opts.log.warn(`[repo-scan] trigger failed for ${signal.repoFullName}#${signal.number}`);
    }
  },
},
state: { runLedger: 'sqlite' },
outcome: { whenNoSignal: 'record' },
enabled: () => opts.repoAllowlist.length > 0,
actor: { role: 'repo-watcher', costTier: 'cheap' },
```

### Step 4: Register in index.ts

Following the existing pattern at lines 1310-1360:

```typescript
// F141 Phase B: Reconciliation scan
if (ghWebhookSecret && ghRepoAllowlist && ghInboxCatId) {
  const { createRepoScanTaskSpec } = await import(
    './infrastructure/connectors/github-repo-event/RepoScanTaskSpec.js'
  );
  const { ReconciliationDedup } = await import(
    './infrastructure/connectors/github-repo-event/ReconciliationDedup.js'
  );

  const reconciliationDedup = new ReconciliationDedup(deps.redis);
  const allowlist = ghRepoAllowlist.split(',').map(r => r.trim());

  const fetchOpenPRs = async (repo: string) => { /* gh api pattern */ };
  const fetchOpenIssues = async (repo: string) => { /* gh api pattern */ };

  taskRunnerV2.register(createRepoScanTaskSpec({
    repoAllowlist: allowlist,
    inboxCatId: ghInboxCatId,
    defaultUserId: effectiveUserId,
    reconciliationDedup,
    bindingStore,
    deliverFn: deliverConnectorMessage,
    deliveryDeps: { messageStore, socketManager },
    invokeTrigger,
    fetchOpenPRs,
    fetchOpenIssues,
    log: app.log,
  }));
}
```

### Step 5: Run full test suite

```bash
node --test packages/api/test/repo-scan-task-spec.test.js
node --test packages/api/test/reconciliation-dedup.test.js
node --test packages/api/test/github-repo-webhook.test.js
```

### Step 6: Commit

```
feat(F141): RepoScanTaskSpec execute + registration (Phase B complete)
```

---

## Task 5: Integration verification + spec update

**Files:**
- Modify: `docs/features/F141-github-repo-inbox.md` — check AC-B1~B4, update timeline
- Run: `pnpm lint && pnpm check && pnpm --filter @cat-cafe/api test:redis`

### Step 1: Type check

```bash
pnpm lint
```

### Step 2: Biome

```bash
pnpm check
```

### Step 3: Full test suite

```bash
pnpm --filter @cat-cafe/api test
```

### Step 4: Update spec

- Mark AC-B1~B4 as [x]
- Add timeline entry: "Phase B merged (PR #xxx)"
- Status: in-progress → done (if no Phase C planned)

### Step 5: Commit

```
docs(F141): mark Phase B complete
```

---

## AC Coverage Matrix

| AC | Task | Verification |
|----|------|-------------|
| AC-B1: TaskSpec_P1 consumer | Task 3-4 | RepoScanTaskSpec registered, profile=poller, actor=repo-watcher |
| AC-B2: gate filters | Task 3 | Tests: notified items skipped, drafts skipped, gh api failure = fail-open |
| AC-B3: reconciliation delivers | Task 4 | Tests: deliverConnectorMessage called with correct args |
| AC-B4: run ledger | Task 4 | TaskRunnerV2 auto-records per workItem (framework guarantee) |
