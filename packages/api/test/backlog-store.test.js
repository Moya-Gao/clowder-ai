import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('BacklogStore', () => {
  /** @type {import('../dist/domains/cats/services/stores/ports/BacklogStore.js').BacklogStore} */
  let store;
  let originalDateNow;
  let now;

  beforeEach(async () => {
    const { BacklogStore } = await import('../dist/domains/cats/services/stores/ports/BacklogStore.js');
    store = new BacklogStore();
    originalDateNow = Date.now;
    now = 1_700_000_000_000;
    Date.now = () => {
      now += 1;
      return now;
    };
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  test('create + listByUser returns newest first', () => {
    const first = store.create({
      userId: 'default-user',
      title: 'First',
      summary: 'first summary',
      priority: 'p2',
      tags: ['a'],
      createdBy: 'user',
    });
    const second = store.create({
      userId: 'default-user',
      title: 'Second',
      summary: 'second summary',
      priority: 'p1',
      tags: ['b'],
      createdBy: 'user',
    });

    const items = store.listByUser('default-user');
    assert.equal(items.length, 2);
    assert.equal(items[0].id, second.id);
    assert.equal(items[1].id, first.id);
  });

  test('refreshMetadata updates docs-derived fields and appends audit entry', () => {
    const created = store.create({
      userId: 'default-user',
      title: '[F049] Mission Hub',
      summary: '来源 docs/BACKLOG.md | 状态：spec',
      priority: 'p2',
      tags: ['source:docs-backlog', 'feature:f049', 'status:spec'],
      createdBy: 'user',
    });

    const refreshed = store.refreshMetadata(created.id, {
      title: '[F049] Mission Hub (updated)',
      summary: '来源 docs/BACKLOG.md | 状态：in-progress',
      priority: 'p1',
      tags: ['source:docs-backlog', 'feature:f049', 'status:in-progress'],
      refreshedBy: 'default-user',
    });

    assert.equal(refreshed?.title, '[F049] Mission Hub (updated)');
    assert.equal(refreshed?.priority, 'p1');
    assert.equal(refreshed?.tags.includes('status:in-progress'), true);
    assert.equal(refreshed?.audit.at(-1)?.action, 'refreshed');
    assert.equal(refreshed?.audit.at(-1)?.actor.kind, 'user');
    assert.equal(refreshed?.audit.at(-1)?.actor.id, 'default-user');
  });

  test('refreshMetadata is a no-op when metadata is unchanged', () => {
    const created = store.create({
      userId: 'default-user',
      title: '[F010] Mobile',
      summary: '来源 docs/BACKLOG.md | 状态：spec',
      priority: 'p2',
      tags: ['source:docs-backlog', 'feature:f010', 'status:spec'],
      createdBy: 'user',
    });

    const beforeAuditLength = created.audit.length;
    const beforeUpdatedAt = created.updatedAt;
    const refreshed = store.refreshMetadata(created.id, {
      title: '[F010] Mobile',
      summary: '来源 docs/BACKLOG.md | 状态：spec',
      priority: 'p2',
      tags: ['source:docs-backlog', 'feature:f010', 'status:spec'],
      refreshedBy: 'default-user',
    });

    assert.equal(refreshed?.audit.length, beforeAuditLength);
    assert.equal(refreshed?.updatedAt, beforeUpdatedAt);
  });

  test('suggestClaim transitions open -> suggested', () => {
    const created = store.create({
      userId: 'default-user',
      title: 'Refactor queue',
      summary: 'clear pause race',
      priority: 'p1',
      tags: ['queue'],
      createdBy: 'user',
    });

    const suggested = store.suggestClaim(created.id, {
      catId: 'codex',
      why: 'I already touched queue code path',
      plan: 'add guard + tests',
      requestedPhase: 'coding',
    });

    assert.equal(suggested?.status, 'suggested');
    assert.equal(suggested?.suggestion?.catId, 'codex');
    assert.equal(suggested?.suggestion?.requestedPhase, 'coding');
    assert.equal(suggested?.suggestion?.status, 'pending');
  });

  test('approve + markDispatched writes thread linkage', () => {
    const created = store.create({
      userId: 'default-user',
      title: 'Build mission control',
      summary: 'global dispatch center',
      priority: 'p0',
      tags: ['f049'],
      createdBy: 'user',
    });

    store.suggestClaim(created.id, {
      catId: 'opus',
      why: 'Can own architecture',
      plan: 'route + store + UI',
      requestedPhase: 'coding',
    });

    const approved = store.decideClaim(created.id, {
      decision: 'approve',
      decidedBy: 'default-user',
      note: 'go',
    });

    assert.equal(approved?.status, 'approved');
    assert.equal(approved?.suggestion?.status, 'approved');

    const dispatched = store.markDispatched(created.id, {
      threadId: 'thread-123',
      threadPhase: 'coding',
      dispatchedBy: 'default-user',
    });

    assert.equal(dispatched?.status, 'dispatched');
    assert.equal(dispatched?.dispatchedThreadId, 'thread-123');
    assert.equal(dispatched?.dispatchedThreadPhase, 'coding');
  });

  test('reject returns item to open state', () => {
    const created = store.create({
      userId: 'default-user',
      title: 'Research lock semantics',
      summary: 'compare lease patterns',
      priority: 'p2',
      tags: ['research'],
      createdBy: 'user',
    });

    store.suggestClaim(created.id, {
      catId: 'codex',
      why: 'Need to audit race windows',
      plan: 'collect docs',
      requestedPhase: 'research',
    });

    const rejected = store.decideClaim(created.id, {
      decision: 'reject',
      decidedBy: 'default-user',
      note: 'later',
    });

    assert.equal(rejected?.status, 'open');
    assert.equal(rejected?.suggestion?.status, 'rejected');
  });

  test('invalid transition throws deterministic error', () => {
    const created = store.create({
      userId: 'default-user',
      title: 'No suggestion yet',
      summary: 'cannot approve directly',
      priority: 'p3',
      tags: [],
      createdBy: 'user',
    });

    assert.throws(() => {
      store.decideClaim(created.id, {
        decision: 'approve',
        decidedBy: 'default-user',
      });
    }, /invalid backlog transition/i);
  });

  test('markDispatched is idempotent for same dispatched target', () => {
    const created = store.create({
      userId: 'default-user',
      title: 'Idempotent dispatch',
      summary: 'retry should not break state',
      priority: 'p1',
      tags: ['dispatch'],
      createdBy: 'user',
    });

    store.suggestClaim(created.id, {
      catId: 'codex',
      why: 'owns this stack',
      plan: 'dispatch safely',
      requestedPhase: 'coding',
    });
    store.decideClaim(created.id, {
      decision: 'approve',
      decidedBy: 'default-user',
    });

    const first = store.markDispatched(created.id, {
      threadId: 'thread-retry',
      threadPhase: 'coding',
      dispatchedBy: 'default-user',
    });
    assert.equal(first?.status, 'dispatched');

    const second = store.markDispatched(created.id, {
      threadId: 'thread-retry',
      threadPhase: 'coding',
      dispatchedBy: 'default-user',
    });
    assert.equal(second?.status, 'dispatched');
    assert.equal(second?.dispatchedThreadId, 'thread-retry');
    assert.equal(second?.audit.length, first?.audit.length);
  });

  test('eviction prioritizes dispatched items first', () => {
    const BacklogStoreClass = store.constructor;
    const smallStore = new BacklogStoreClass({ maxItems: 2 });

    const dispatchedCandidate = smallStore.create({
      userId: 'default-user',
      title: 'old dispatched',
      summary: 'should be evicted first',
      priority: 'p2',
      tags: [],
      createdBy: 'user',
    });
    smallStore.suggestClaim(dispatchedCandidate.id, {
      catId: 'codex',
      why: 'done',
      plan: 'already shipped',
      requestedPhase: 'coding',
    });
    smallStore.decideClaim(dispatchedCandidate.id, {
      decision: 'approve',
      decidedBy: 'default-user',
    });
    smallStore.markDispatched(dispatchedCandidate.id, {
      threadId: 'thread-old',
      threadPhase: 'coding',
      dispatchedBy: 'default-user',
    });

    const openCandidate = smallStore.create({
      userId: 'default-user',
      title: 'open should stay',
      summary: 'newer active task',
      priority: 'p1',
      tags: [],
      createdBy: 'user',
    });

    const third = smallStore.create({
      userId: 'default-user',
      title: 'new item',
      summary: 'triggers eviction',
      priority: 'p3',
      tags: [],
      createdBy: 'user',
    });

    const remaining = smallStore.listByUser('default-user').map((item) => item.id);
    assert.equal(remaining.includes(dispatchedCandidate.id), false);
    assert.equal(remaining.includes(openCandidate.id), true);
    assert.equal(remaining.includes(third.id), true);
  });
});
