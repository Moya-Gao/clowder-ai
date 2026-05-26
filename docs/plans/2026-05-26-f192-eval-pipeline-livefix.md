# F192 Eval Pipeline Livefix — PR 1 of 3

**Feature:** F192 — `docs/features/F192-socio-technical-harness-eval.md`
**Goal:** Fix 4 CVO dogfood bugs (OQ-16/17/18/19) — make the eval pipeline actually work end-to-end
**Acceptance Criteria:**
- OQ-19: Eval domain threads appear in sidebar "系统" section alongside IM Hub threads
- OQ-16: Eval Hub shows ALL registered domains, not just those with verdicts; eval:memory visible with "待首次评估" placeholder
- OQ-17: Daily scheduled eval tasks auto-registered from domain registry YAML at startup
- OQ-18: Covered by OQ-17 — once scheduled eval runs, system threads won't be empty shells
**Architecture cell:** harness-eval
**Map delta:** none
**Map delta why:** Extending existing Thread interface + eval-hub read model, no new ownership boundaries
**Architecture:** Add `systemKind` field to Thread → sidebar filters on it → eval Hub loads all domains → scheduled task bootstrap wakes eval cats daily
**Tech Stack:** TypeScript, Redis (6398), Fastify, React, TaskRunnerV2
**前端验证:** Yes — sidebar "系统" section must show eval threads; Eval Hub must show eval:memory domain

---

## Finish Line

**B definition:** Eval Hub shows all registered domains (including eval:memory with no verdicts), eval domain threads appear in sidebar "系统" section, and daily eval tasks are registered at startup from YAML config.

**What we're NOT building:**
- NOT running the first actual eval (that requires eval cat invocation in the target thread — out of scope for this fix PR)
- NOT implementing E-sop or E-community
- NOT migrating legacy scheduled tasks (dry-run already done in E-scale)
- NOT changing verdict lifecycle or handoff packet schema

## Terminal Schema

```typescript
// Thread interface addition (ThreadStore.ts)
interface Thread {
  // ... existing fields ...
  systemKind?: 'connector_hub' | 'eval_domain';
}

// EvalHubSummary extension (eval-hub-read-model.ts)
interface EvalHubSummary {
  generatedAt: string;
  counts: {
    total: number;          // verdict count
    actionable: number;
    keepObserve: number;
    stale: number;
    registeredDomains: number;  // NEW
  };
  domains: EvalDomainSummary[];  // NEW: all registered domains
  items: EvalHubItem[];          // existing: only domains with verdicts
}

interface EvalDomainSummary {
  domainId: string;
  displayName: string;
  systemThreadId: string;
  frequency: string;
  evalCatHandle: string;
  hasVerdict: boolean;
  latestVerdictId?: string;
  latestVerdict?: EvalHubItem['verdict'];
}

// Frontend chat-types.ts addition
interface Thread {
  // ... existing fields ...
  systemKind?: 'connector_hub' | 'eval_domain';
}
```

---

## Task 1: Thread `systemKind` — backend interface + Redis serialization

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts`
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisThreadStore.ts`
- Test: `packages/api/src/domains/cats/services/stores/__tests__/thread-system-kind.test.js`

**Step 1: Write failing test**

```javascript
// thread-system-kind.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ThreadStore } from '../ports/ThreadStore.js';

describe('Thread systemKind', () => {
  it('updateSystemKind sets and persists on thread', () => {
    const store = new ThreadStore({ maxThreads: 100 });
    const thread = store.create('user1', 'Test Thread');
    assert.equal(thread.systemKind, undefined);

    store.updateSystemKind(thread.id, 'eval_domain');
    const updated = store.get(thread.id);
    assert.equal(updated.systemKind, 'eval_domain');
  });

  it('updateSystemKind(null) clears systemKind', () => {
    const store = new ThreadStore({ maxThreads: 100 });
    const thread = store.create('user1', 'Test Thread');
    store.updateSystemKind(thread.id, 'connector_hub');
    store.updateSystemKind(thread.id, null);
    const updated = store.get(thread.id);
    assert.equal(updated.systemKind, undefined);
  });
});
```

**Step 2: Run test — verify FAIL**

Run: `cd ../cat-cafe-f192-livefix && pnpm --filter @cat-cafe/api exec node --test src/domains/cats/services/stores/__tests__/thread-system-kind.test.js`
Expected: FAIL — `updateSystemKind is not a function`

**Step 3: Implement**

Add to `ThreadStore.ts` Thread interface (~line 158):
```typescript
/** F192 livefix: System thread kind — determines sidebar 系统 section visibility. */
systemKind?: 'connector_hub' | 'eval_domain';
```

Add to `IThreadStore` interface:
```typescript
updateSystemKind(threadId: string, kind: 'connector_hub' | 'eval_domain' | null): void | Promise<void>;
```

Add to `ThreadStore` class (in-memory implementation, similar to `updateConnectorHubState`):
```typescript
updateSystemKind(threadId: string, kind: 'connector_hub' | 'eval_domain' | null): void {
  const thread = this.get(threadId);
  if (!thread) return;
  if (kind === null) {
    delete thread.systemKind;
  } else {
    thread.systemKind = kind;
  }
}
```

Add to `RedisThreadStore` (similar to `updateConnectorHubState` at line 549):
```typescript
async updateSystemKind(threadId: string, kind: 'connector_hub' | 'eval_domain' | null): Promise<void> {
  const key = ThreadKeys.detail(threadId);
  if (kind === null) {
    await this.deleteDetailFields(key, 'systemKind');
  } else {
    await this.setDetailFields(key, 'systemKind', kind);
  }
}
```

Add Redis serialization (in `toRedisHash` ~line 940):
```typescript
if (thread.systemKind) {
  result.systemKind = thread.systemKind;
}
```

Add Redis deserialization (in `fromRedisHash` ~line 1042):
```typescript
if (data.systemKind && (data.systemKind === 'connector_hub' || data.systemKind === 'eval_domain')) {
  result.systemKind = data.systemKind;
}
```

**Step 4: Run test — verify PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(F192): add systemKind field to Thread interface

Thread.systemKind distinguishes system-managed threads (connector_hub for
IM Hub, eval_domain for eval domains) from regular threads. This replaces
the connectorHubState-only discriminator for sidebar system section visibility.

OQ-19 fix part 1/2: backend schema ready.

[宪宪/Opus🐾]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Sidebar filter + deletion protection — use `systemKind`

**Files:**
- Modify: `packages/web/src/stores/chat-types.ts` (~line 158)
- Modify: `packages/web/src/components/ThreadSidebar/thread-utils.ts` (~line 152)
- Modify: `packages/api/src/routes/threads.ts` (~line 560)
- Test: `packages/web/src/components/ThreadSidebar/__tests__/thread-utils.test.ts` (existing)

**Step 1: Write failing test**

Add to existing `thread-utils.test.ts`:
```typescript
it('groups eval_domain threads into system section', () => {
  const threads = [
    makeThread({ id: 'eval-thread', title: 'A2A Eval', systemKind: 'eval_domain' }),
    makeThread({ id: 'regular', title: 'Chat' }),
  ];
  const groups = sortAndGroupThreadsWithWorkspace(threads, config, new Set());
  const systemGroup = groups.find(g => g.type === 'system');
  assert(systemGroup, 'system group should exist');
  assert.equal(systemGroup.threads.length, 1);
  assert.equal(systemGroup.threads[0].id, 'eval-thread');
});
```

**Step 2: Run test — verify FAIL**

**Step 3: Implement**

In `chat-types.ts`, add to Thread interface (~line 161):
```typescript
/** F192 livefix: System thread kind for sidebar grouping. */
systemKind?: 'connector_hub' | 'eval_domain';
```

In `thread-utils.ts`, change line 153-154 from:
```typescript
.filter((t) => !!t.connectorHubState && t.id !== 'default' && !t.pinned)
```
to:
```typescript
.filter((t) => (!!t.systemKind || !!t.connectorHubState) && t.id !== 'default' && !t.pinned)
```

The `|| !!t.connectorHubState` is backwards-compatible: existing IM Hub threads without `systemKind` still show up.

In `threads.ts`, change deletion protection (~line 562) from:
```typescript
if (thread?.connectorHubState) {
```
to:
```typescript
if (thread?.connectorHubState || thread?.systemKind) {
```

**Step 4: Run test — verify PASS + run full `pnpm test`**

**Step 5: Commit**

```bash
git commit -m "feat(F192): sidebar system section recognizes systemKind

Sidebar filter upgraded from connectorHubState-only to systemKind OR
connectorHubState (backwards-compatible). Eval domain threads now appear
in the 系统 section. Deletion protection also extended.

OQ-19 fix part 2/2.

[宪宪/Opus🐾]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Set `systemKind` on thread creation — eval + IM Hub

**Files:**
- Modify: `packages/api/src/infrastructure/harness-eval/eval-hub-thread-ensure.ts`
- Modify: `packages/api/src/infrastructure/connectors/ConnectorRouter.ts` (~line 585)
- Test: `packages/api/src/infrastructure/harness-eval/eval-hub-thread-ensure.test.js` (existing)

**Step 1: Write failing test**

Add to existing `eval-hub-thread-ensure.test.js`:
```javascript
it('sets systemKind to eval_domain on newly created threads', async () => {
  const store = new ThreadStore({ maxThreads: 100 });
  store.ensureThread('test-thread-id', 'Test User');
  const results = await ensureEvalDomainThreads(store, [
    { domainId: 'eval:a2a', systemThreadId: 'test-thread-id', displayName: 'A2A Eval' },
  ]);
  const thread = store.get('test-thread-id');
  assert.equal(thread.systemKind, 'eval_domain');
});
```

**Step 2: Run test — verify FAIL**

**Step 3: Implement**

In `eval-hub-thread-ensure.ts`, after `ensureThread` call (line 36):
```typescript
await threadStore.ensureThread(domain.systemThreadId, domain.displayName);
await threadStore.updateSystemKind(domain.systemThreadId, 'eval_domain');
```

Also add healing for existing threads without systemKind (after line 43):
```typescript
const needsSystemKind = existing.systemKind !== 'eval_domain';
```
And in the healing block:
```typescript
if (needsSystemKind) {
  await threadStore.updateSystemKind(domain.systemThreadId, 'eval_domain');
}
```

In `ConnectorRouter.ts`, after `updateConnectorHubState` call (~line 585):
```typescript
await threadStore.updateSystemKind(hubThread.id, 'connector_hub');
```

**Step 4: Run test — verify PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F192): set systemKind on eval domain + IM Hub thread creation

ensureEvalDomainThreads() now sets systemKind='eval_domain' on creation
and heals existing threads missing it. ConnectorRouter sets
systemKind='connector_hub' on new IM Hub threads.

[宪宪/Opus🐾]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Hub read model — show all registered domains

**Files:**
- Modify: `packages/api/src/infrastructure/harness-eval/eval-hub-read-model.ts`
- Modify: `packages/api/src/routes/eval-hub.ts`
- Test: `packages/api/src/infrastructure/harness-eval/__tests__/eval-hub-read-model.test.js`

**Step 1: Write failing test**

```javascript
describe('loadEvalHubSummary domains field', () => {
  it('returns all registered domains including those without verdicts', () => {
    // Setup: harnessFeedbackRoot with 2 domain YAMLs but only 1 verdict
    const summary = loadEvalHubSummary({ harnessFeedbackRoot: fixtureRoot });
    assert(summary.domains, 'domains field must exist');
    assert.equal(summary.domains.length, 2); // eval:a2a + eval:memory
    const memoryDomain = summary.domains.find(d => d.domainId === 'eval:memory');
    assert(memoryDomain, 'eval:memory must appear');
    assert.equal(memoryDomain.hasVerdict, false);
    assert.equal(summary.counts.registeredDomains, 2);
  });
});
```

**Step 2: Run test — verify FAIL**

**Step 3: Implement**

Add `EvalDomainSummary` interface to `eval-hub-read-model.ts`:
```typescript
export interface EvalDomainSummary {
  domainId: string;
  displayName: string;
  systemThreadId: string;
  frequency: string;
  evalCatHandle: string;
  hasVerdict: boolean;
  latestVerdictId?: string;
  latestVerdict?: EvalHubItem['verdict'];
}
```

Add `registeredDomains` to `EvalHubSummary.counts` and add `domains` field.

In `loadEvalHubSummary()`, after building `items` (line 96), build domain summaries:
```typescript
const domainSummaries: EvalDomainSummary[] = [...domains.values()].map((domain) => {
  const domainVerdicts = items.filter((item) => item.domainId === domain.domainId);
  const latest = domainVerdicts[0]; // already sorted by date desc
  return {
    domainId: domain.domainId,
    displayName: domain.displayName,
    systemThreadId: domain.systemThreadId,
    frequency: domain.frequency,
    evalCatHandle: domain.evalCat.handle,
    hasVerdict: domainVerdicts.length > 0,
    ...(latest ? { latestVerdictId: latest.id, latestVerdict: latest.verdict } : {}),
  };
});
```

Update `eval-hub.ts` route: call `ensureEvalDomainThreads()` for ALL domains from registry (not just verdict items):
```typescript
const allDomains = summary.domains.map((d) => ({
  domainId: d.domainId,
  systemThreadId: d.systemThreadId,
  displayName: d.displayName,
}));
await ensureEvalDomainThreads(opts.threadStore, allDomains);
```

**Step 4: Run test — verify PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F192): Hub read model returns all registered domains

EvalHubSummary now includes a domains[] array with all registered eval
domains. Domains without verdicts show hasVerdict=false. Thread ensure
now runs for ALL domains, not just those with existing verdicts.

OQ-16 fix (backend).

[宪宪/Opus🐾]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Frontend — show all domains in Hub (including eval:memory)

**Files:**
- Modify: `packages/web/src/components/HubEvalTab.tsx`
- Test: `packages/web/src/components/__tests__/HubEvalTab.test.tsx` (existing)

**Step 1: Write failing test**

Add to existing test:
```typescript
it('renders domain cards for domains without verdicts', () => {
  // mock summary with domains[].hasVerdict=false
  // assert "待首次评估" placeholder renders
});
```

**Step 2: Run test — verify FAIL**

**Step 3: Implement**

Add `EvalDomainSummary` interface to `HubEvalTab.tsx`.

Add domain card component:
```tsx
function DomainCard({ domain }: { domain: EvalDomainSummary }) {
  return (
    <section className="rounded-lg bg-cafe-surface-elevated p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-cafe-muted">{domain.domainId}</div>
          <h3 className="mt-1 text-base font-semibold text-cafe">{domain.displayName}</h3>
          <p className="mt-1 text-xs text-cafe-muted">评估频率: {domain.frequency} · 评估猫: {domain.evalCatHandle}</p>
        </div>
        <span className="rounded-md bg-cafe-surface px-2.5 py-1 text-xs font-semibold text-cafe-muted">
          {domain.hasVerdict ? VERDICT_LABELS[domain.latestVerdict!] : '待首次评估'}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <a
          href={`/thread/${encodeURIComponent(domain.systemThreadId)}`}
          className="rounded-md border border-cafe px-3 py-1.5 text-xs font-medium text-cafe-secondary hover:text-cafe"
        >
          {domain.displayName} 工作线程
        </a>
        {domain.domainId === 'eval:memory' && (
          <a href="/memory/health" className="rounded-md border border-cafe px-3 py-1.5 text-xs font-medium text-cafe-secondary hover:text-cafe">
            记忆健康
          </a>
        )}
      </div>
    </section>
  );
}
```

Update empty state (line 101-106): instead of "还没有 live verdict", show domain list with placeholders.

Add domain overview section before verdict cards:
```tsx
{summary.domains && summary.domains.length > 0 && (
  <div className="space-y-3">
    <h2 className="text-sm font-semibold text-cafe">评估域总览</h2>
    {summary.domains.map((domain) => (
      <DomainCard key={domain.domainId} domain={domain} />
    ))}
  </div>
)}
```

Update counts section to include `registeredDomains`.

**Step 4: Run test — verify PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F192): Eval Hub shows all registered domains

Hub now displays a domain overview section showing all registered eval
domains. eval:memory appears with '待首次评估' status even without
verdicts. Each domain card has a link to its system thread and relevant
health surfaces.

OQ-16 fix (frontend).

[宪宪/Opus🐾]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Scheduled eval task registration at startup

**Files:**
- Create: `packages/api/src/infrastructure/scheduler/tasks/eval-domain-daily.ts`
- Modify: `packages/api/src/index.ts` (~line 947, before taskRunnerV2.start)
- Test: `packages/api/src/infrastructure/scheduler/tasks/__tests__/eval-domain-daily.test.js`

**Step 1: Write failing test**

```javascript
describe('createEvalDomainDailySpec', () => {
  it('returns a valid TaskSpec_P1 with daily cron trigger', () => {
    const spec = createEvalDomainDailySpec({
      harnessFeedbackRoot: '/tmp/test-feedback',
    });
    assert.equal(spec.id, 'eval-domain-daily');
    assert.deepEqual(spec.trigger, { type: 'cron', expression: '0 3 * * *' });
    assert.equal(typeof spec.admission.gate, 'function');
    assert.equal(typeof spec.run.execute, 'function');
  });

  it('gate returns work items for each registered domain', async () => {
    const spec = createEvalDomainDailySpec({
      harnessFeedbackRoot: fixtureRoot, // has eval-a2a.yaml + eval-memory.yaml
    });
    const result = await spec.admission.gate({} as GateCtx);
    assert.equal(result.run, true);
    assert.equal(result.workItems.length, 2);
  });
});
```

**Step 2: Run test — verify FAIL**

**Step 3: Implement**

```typescript
// eval-domain-daily.ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { TaskSpec_P1 } from '../types.js';
import { type EvalDomainRegistryEntry, parseEvalDomainRegistryFile } from '../../harness-eval/eval-domain-registry.js';
import { buildEvalCatInvocation } from '../../harness-eval/eval-cat-invocation.js';

interface EvalDomainDailyOpts {
  harnessFeedbackRoot: string;
}

export function createEvalDomainDailySpec(opts: EvalDomainDailyOpts): TaskSpec_P1 {
  return {
    id: 'eval-domain-daily',
    profile: 'awareness',
    trigger: { type: 'cron', expression: '0 3 * * *' }, // 03:00 UTC daily
    admission: {
      async gate() {
        const domains = loadRegisteredDomains(opts.harnessFeedbackRoot);
        if (domains.length === 0) return { run: false, workItems: [] };
        return {
          run: true,
          workItems: domains.map((d) => ({
            signal: d,
            subjectKey: d.domainId,
          })),
        };
      },
    },
    run: {
      overlap: 'skip',
      timeoutMs: 60_000,
      async execute(domain, _subjectKey, ctx) {
        const invocation = buildEvalCatInvocation({
          domain,
          trendRefs: [],
          verdictRefs: [],
          legacyCleanup: { status: 'not_checked' },
        });
        if (ctx.deliver) {
          const content = [
            `## Eval Domain: ${invocation.domainId}`,
            '',
            invocation.instructions,
            '',
            '```json',
            JSON.stringify(invocation.context, null, 2),
            '```',
          ].join('\n');
          const messageId = await ctx.deliver({
            threadId: invocation.targetThreadId,
            content,
            userId: 'scheduler',
          });
          if (ctx.invokeTrigger && messageId) {
            ctx.invokeTrigger.trigger(
              invocation.targetThreadId,
              invocation.evalCat.catId,
              'scheduler',
              `Daily eval: ${invocation.domainId}`,
              messageId,
            );
          }
        }
      },
    },
    state: { runLedger: 'sqlite' },
    outcome: { whenNoSignal: 'drop' },
    enabled: () => true,
    display: {
      label: '每日 Harness Eval',
      category: 'system',
      description: 'Daily harness eval — reads domain registry, triggers eval cat per domain',
      subjectKind: 'none',
    },
  };
}

function loadRegisteredDomains(harnessFeedbackRoot: string): EvalDomainRegistryEntry[] {
  const domainsDir = join(harnessFeedbackRoot, 'eval-domains');
  if (!existsSync(domainsDir)) return [];
  return readdirSync(domainsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.yaml'))
    .map((e) => parseEvalDomainRegistryFile(parseYaml(readFileSync(join(domainsDir, e.name), 'utf8'))));
}
```

Register in `index.ts` before `taskRunnerV2.start()`:
```typescript
const { createEvalDomainDailySpec } = await import(
  './infrastructure/scheduler/tasks/eval-domain-daily.js'
);
const evalDomainDailySpec = createEvalDomainDailySpec({
  harnessFeedbackRoot: join(findMonorepoRoot(), 'docs/harness-feedback'),
});
taskRunnerV2.register(evalDomainDailySpec);
app.log.info('[api] F192: eval-domain-daily task registered');
```

**Step 4: Run test — verify PASS + full `pnpm test`**

**Step 5: Commit**

```bash
git commit -m "feat(F192): register daily eval task from domain registry at startup

TaskSpec_P1 'eval-domain-daily' reads all eval-domains/*.yaml at gate
time, builds invocation packets via buildEvalCatInvocation(), and
delivers instructions to each domain's system thread + triggers the
assigned eval cat. Cron: 03:00 UTC daily.

OQ-17 fix: scheduled eval pipeline no longer dead.

[宪宪/Opus🐾]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Integration test + OQ status update

**Files:**
- Modify: `docs/features/F192-socio-technical-harness-eval.md` (OQ-16/17/18/19 status)
- Run: `pnpm test && pnpm lint && pnpm check && pnpm -r --if-present run build`

**Step 1: Run full test suite**

```bash
pnpm test
pnpm lint
pnpm check
pnpm -r --if-present run build
```

All must pass.

**Step 2: Update OQ status in F192 spec**

Change OQ-16/17/18/19 from `🔴 CVO dogfood 2026-05-26` to `✅ Fixed in eval-pipeline-livefix PR`.

**Step 3: Commit**

```bash
git commit -m "docs(F192): mark OQ-16/17/18/19 fixed in eval-pipeline-livefix

[宪宪/Opus🐾]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## PR Plan Summary

| Task | What | OQ | Commit boundary |
|------|------|----|-----------------|
| 1 | Thread `systemKind` backend | OQ-19 | ✓ |
| 2 | Sidebar filter + deletion protection | OQ-19 | ✓ |
| 3 | Set `systemKind` on eval + IM Hub creation | OQ-19 | ✓ |
| 4 | Hub read model all domains | OQ-16 | ✓ |
| 5 | Frontend domain overview | OQ-16 | ✓ |
| 6 | Scheduled eval task | OQ-17 + OQ-18 | ✓ |
| 7 | Integration verify + OQ close | all | ✓ |

**Total: 7 commits → 1 PR → reviewer @gpt52**

## Open Questions

### Technical (self-resolve during implementation)

- **TQ-1**: `ensureThread()` sets thread owner to a fixed userId — eval domain threads should probably use a system userId. Check what IM Hub uses.
- **TQ-2**: TaskRunnerV2 `execute` signature — confirm `signal` type flows correctly when workItems contain full `EvalDomainRegistryEntry` objects.
- **TQ-3**: IM Hub backwards compat — existing connector hub threads without `systemKind` must still appear in sidebar. Confirmed: `|| !!t.connectorHubState` fallback handles this.

### Value (none — all decisions already made by CVO)

CVO already approved the 3-PR plan and explicitly assigned reviewer @gpt52.
