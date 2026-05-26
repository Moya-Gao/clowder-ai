/**
 * F128 Proposal Flow Tests
 *
 * Covers AC-B7:
 *  - cat-auth propose happy path
 *  - stale invocation guard
 *  - cross-user parent ownership rejection
 *  - clientRequestId idempotency
 *  - user-auth approve happy path
 *  - double-approve idempotency
 *  - cross-user approve 403
 *  - approve-after-reject 409
 *  - reject happy path
 *  - reject-then-approve 409
 *  - edit-on-approve applied to created thread
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import Fastify from 'fastify';
import './helpers/setup-cat-registry.js';

describe('F128 propose / approve / reject flow', () => {
  let registry;
  let threadStore;
  let messageStore;
  let proposalStore;
  let socketEvents;
  let socketManager;

  beforeEach(async () => {
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
    );
    const { ThreadStore } = await import('../dist/domains/cats/services/stores/ports/ThreadStore.js');
    const { MessageStore } = await import('../dist/domains/cats/services/stores/ports/MessageStore.js');
    const { InMemoryProposalStore } = await import('../dist/domains/cats/services/stores/ports/ProposalStore.js');

    registry = new InvocationRegistry();
    threadStore = new ThreadStore();
    messageStore = new MessageStore();
    proposalStore = new InMemoryProposalStore();
    socketEvents = [];
    socketManager = {
      emitToUser(userId, event, data) {
        socketEvents.push({ kind: 'user', userId, event, data });
      },
      broadcastToRoom(room, event, data) {
        socketEvents.push({ kind: 'room', room, event, data });
      },
    };
  });

  async function createApp() {
    const { callbacksRoutes, proposalRoutes } = await import('../dist/routes/index.js');
    const app = Fastify();
    await app.register(callbacksRoutes, {
      registry,
      messageStore,
      socketManager,
      threadStore,
      proposalStore,
      evidenceStore: {
        ingestRaw() {},
        search() {
          return [];
        },
      },
      markerQueue: { enqueue() {} },
      reflectionService: { reflect() {} },
    });
    await app.register(proposalRoutes, { proposalStore, threadStore, messageStore, socketManager });
    return app;
  }

  async function propose(app, { userId, catId = 'opus', threadId, body = {} }) {
    const { invocationId, callbackToken } = await registry.create(userId, catId, threadId);
    return app.inject({
      method: 'POST',
      url: '/api/callbacks/propose-thread',
      payload: { invocationId, callbackToken, title: 'New thread', reason: 'Because', ...body },
    });
  }

  async function approve(app, userId, proposalId, body = {}) {
    return app.inject({
      method: 'POST',
      url: `/api/proposals/${proposalId}/approve`,
      headers: { 'x-cat-cafe-user': userId, 'content-type': 'application/json' },
      payload: body,
    });
  }

  async function reject(app, userId, proposalId, body = {}) {
    return app.inject({
      method: 'POST',
      url: `/api/proposals/${proposalId}/reject`,
      headers: { 'x-cat-cafe-user': userId, 'content-type': 'application/json' },
      payload: body,
    });
  }

  test('propose creates a pending proposal without creating a thread', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const before = threadStore.size;

    const res = await propose(app, { userId: 'alice', threadId: source.id });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'pending');
    assert.match(body.proposalId, /^proposal_/);
    assert.equal(threadStore.size, before, 'no new thread should be created on propose');
    const stored = await proposalStore.get(body.proposalId);
    assert.equal(stored.sourceThreadId, source.id);
    assert.equal(stored.parentThreadId, source.id);
  });

  test('propose returns stale_ignored when a newer invocation supersedes', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const first = await registry.create('alice', 'opus', source.id);
    await registry.create('alice', 'opus', source.id); // supersedes first

    const res = await app.inject({
      method: 'POST',
      url: '/api/callbacks/propose-thread',
      payload: {
        invocationId: first.invocationId,
        callbackToken: first.callbackToken,
        title: 't',
        reason: 'r',
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).status, 'stale_ignored');
  });

  test('propose rejects parentThreadId owned by another user (403)', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const foreign = await threadStore.create('bob', 'Foreign');

    const res = await propose(app, {
      userId: 'alice',
      threadId: source.id,
      body: { parentThreadId: foreign.id },
    });

    assert.equal(res.statusCode, 403);
  });

  test('propose is idempotent on clientRequestId', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');

    const first = await propose(app, {
      userId: 'alice',
      threadId: source.id,
      body: { clientRequestId: 'req-1' },
    });
    const second = await propose(app, {
      userId: 'alice',
      threadId: source.id,
      body: { clientRequestId: 'req-1' },
    });

    const firstId = JSON.parse(first.body).proposalId;
    const secondBody = JSON.parse(second.body);
    assert.equal(secondBody.proposalId, firstId);
    assert.equal(secondBody.deduped, true);
  });

  test('approve creates a new thread and marks proposal approved', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const proposalRes = await propose(app, { userId: 'alice', threadId: source.id });
    const { proposalId } = JSON.parse(proposalRes.body);

    const res = await approve(app, 'alice', proposalId);

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'approved');
    const newThread = await threadStore.get(body.threadId);
    assert.ok(newThread, 'thread should exist');
    assert.equal(newThread.title, 'New thread');
    assert.equal(newThread.parentThreadId, source.id);
    const proposal = await proposalStore.get(proposalId);
    assert.equal(proposal.status, 'approved');
    assert.equal(proposal.createdThreadId, body.threadId);
    assert.equal(proposal.approvedBy, 'alice');
  });

  test('double approve returns the same thread (idempotent)', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { proposalId } = JSON.parse((await propose(app, { userId: 'alice', threadId: source.id })).body);

    const first = JSON.parse((await approve(app, 'alice', proposalId)).body);
    const second = JSON.parse((await approve(app, 'alice', proposalId)).body);

    assert.equal(second.threadId, first.threadId);
    assert.equal(second.deduped, true);
  });

  test('approve by a different user returns 403', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { proposalId } = JSON.parse((await propose(app, { userId: 'alice', threadId: source.id })).body);

    const res = await approve(app, 'bob', proposalId);
    assert.equal(res.statusCode, 403);
  });

  test('approve after reject returns 409', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { proposalId } = JSON.parse((await propose(app, { userId: 'alice', threadId: source.id })).body);

    await reject(app, 'alice', proposalId);
    const res = await approve(app, 'alice', proposalId);
    assert.equal(res.statusCode, 409);
  });

  test('reject marks proposal rejected without creating a thread', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { proposalId } = JSON.parse((await propose(app, { userId: 'alice', threadId: source.id })).body);
    const sizeBefore = threadStore.size;

    const res = await reject(app, 'alice', proposalId, { rejectionReason: 'not now' });

    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).status, 'rejected');
    assert.equal(threadStore.size, sizeBefore);
    const proposal = await proposalStore.get(proposalId);
    assert.equal(proposal.status, 'rejected');
    assert.equal(proposal.rejectionReason, 'not now');
  });

  test('reject after approve returns 409', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { proposalId } = JSON.parse((await propose(app, { userId: 'alice', threadId: source.id })).body);
    await approve(app, 'alice', proposalId);

    const res = await reject(app, 'alice', proposalId);
    assert.equal(res.statusCode, 409);
  });

  test('approve writes audit metadata onto the created thread', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const proposalRes = await propose(app, { userId: 'alice', threadId: source.id });
    const { proposalId } = JSON.parse(proposalRes.body);

    const approveRes = await approve(app, 'alice', proposalId);
    const { threadId } = JSON.parse(approveRes.body);
    const thread = await threadStore.get(threadId);
    assert.equal(thread.createdFromProposalId, proposalId);
    assert.equal(thread.sourceThreadId, source.id);
    assert.equal(thread.approvedBy, 'alice');
    assert.ok(typeof thread.approvedAt === 'number' && thread.approvedAt > 0);
  });

  test('thread_created socket event emits the Thread itself (no envelope wrapper)', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const proposalRes = await propose(app, { userId: 'alice', threadId: source.id });
    const { proposalId } = JSON.parse(proposalRes.body);
    socketEvents.length = 0;

    await approve(app, 'alice', proposalId);
    const evt = socketEvents.find((e) => e.event === 'thread_created');
    assert.ok(evt, 'thread_created should be emitted');
    assert.ok(evt.data && typeof evt.data.id === 'string', 'payload must have id at top level (P1-1)');
    assert.equal(typeof evt.data.thread, 'undefined', 'payload must NOT be wrapped in {thread}');
  });

  test('concurrent approve + reject leaves no orphan thread', async () => {
    const { InMemoryProposalStore } = await import('../dist/domains/cats/services/stores/ports/ProposalStore.js');
    // Wrap store to inject a delay between claim and finalize so reject has a chance to interleave.
    class SlowApprovalStore extends InMemoryProposalStore {
      async claimForApproval(input) {
        const claimed = super.claimForApproval(input);
        await new Promise((r) => setTimeout(r, 30));
        return claimed;
      }
    }
    proposalStore = new SlowApprovalStore();
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const proposalRes = await propose(app, { userId: 'alice', threadId: source.id });
    const { proposalId } = JSON.parse(proposalRes.body);
    const threadsBefore = threadStore.size;

    const [approveRes, rejectRes] = await Promise.all([
      approve(app, 'alice', proposalId),
      // small delay to make sure approve claims first
      new Promise((r) => setTimeout(r, 5)).then(() => reject(app, 'alice', proposalId)),
    ]);

    // Exactly one transition wins. Approve claims first → reject must 409.
    assert.equal(approveRes.statusCode, 200);
    assert.equal(rejectRes.statusCode, 409);
    const proposal = await proposalStore.get(proposalId);
    assert.equal(proposal.status, 'approved');
    // No orphan: approve created 1 thread (source + new = +1).
    assert.equal(threadStore.size, threadsBefore + 1);
  });

  test('reject wins over approve when reject claims first (no orphan thread)', async () => {
    const { InMemoryProposalStore } = await import('../dist/domains/cats/services/stores/ports/ProposalStore.js');
    class SlowApprovalStore extends InMemoryProposalStore {
      async claimForApproval(input) {
        await new Promise((r) => setTimeout(r, 30));
        return super.claimForApproval(input);
      }
    }
    proposalStore = new SlowApprovalStore();
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { proposalId } = JSON.parse((await propose(app, { userId: 'alice', threadId: source.id })).body);
    const threadsBefore = threadStore.size;

    const [approveRes, rejectRes] = await Promise.all([
      approve(app, 'alice', proposalId),
      reject(app, 'alice', proposalId),
    ]);

    assert.equal(rejectRes.statusCode, 200);
    assert.equal(approveRes.statusCode, 409);
    assert.equal(threadStore.size, threadsBefore, 'reject must not create any thread');
    const proposal = await proposalStore.get(proposalId);
    assert.equal(proposal.status, 'rejected');
  });

  test('approving status with stale claim is auto-recovered on next approve', async () => {
    const { InMemoryProposalStore } = await import('../dist/domains/cats/services/stores/ports/ProposalStore.js');
    proposalStore = new InMemoryProposalStore();
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { proposalId } = JSON.parse((await propose(app, { userId: 'alice', threadId: source.id })).body);

    // Simulate process crash mid-approve: claim succeeds but finalize/rollback never runs.
    proposalStore.claimForApproval({ proposalId, approvedBy: 'alice' });
    let proposal = await proposalStore.get(proposalId);
    assert.equal(proposal.status, 'approving');
    assert.ok(proposal.claimedAt, 'claimedAt must be set after claim');
    // Backdate claimedAt by 60s to fall outside the 30s stale window.
    proposalStore.proposals.get(proposalId).claimedAt = Date.now() - 60_000;

    // First approve attempt detects the stale claim, rolls it back, and re-claims.
    const res = await approve(app, 'alice', proposalId);
    assert.equal(res.statusCode, 200, `expected stale-claim recovery to succeed, got ${res.statusCode}`);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'approved');
    proposal = await proposalStore.get(proposalId);
    assert.equal(proposal.status, 'approved');
    assert.ok(proposal.createdThreadId);
  });

  test('approve applies user overrides (title + initialMessage)', async () => {
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { proposalId } = JSON.parse(
      (
        await propose(app, {
          userId: 'alice',
          threadId: source.id,
          body: { title: 'orig title', initialMessage: 'orig msg' },
        })
      ).body,
    );

    const res = await approve(app, 'alice', proposalId, {
      title: 'edited title',
      initialMessage: 'edited msg',
    });
    assert.equal(res.statusCode, 200);
    const { threadId } = JSON.parse(res.body);
    const newThread = await threadStore.get(threadId);
    assert.equal(newThread.title, 'edited title');
    // edited initial message should have been posted as the first message
    const msgs = await messageStore.getByThread(threadId);
    const userMsg = msgs.find((m) => m.userId === 'alice' && m.catId === null);
    assert.ok(userMsg, 'expected user-authored initial message');
    assert.equal(userMsg.content, 'edited msg');
  });

  test('initialMessage append failure does NOT roll back the thread or proposal (best-effort warning)', async () => {
    const { MessageStore } = await import('../dist/domains/cats/services/stores/ports/MessageStore.js');
    // Wrap messageStore.append to throw on user-authored posts so we hit the side-effect path
    // AFTER thread creation + finalize. The proposal must stay approved; the thread must stay.
    class FailingMessageStore extends MessageStore {
      append(msg) {
        if (msg.catId === null && msg.userId === 'alice') {
          throw new Error('synthetic append failure');
        }
        return super.append(msg);
      }
    }
    messageStore = new FailingMessageStore();
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const proposalRes = await propose(app, {
      userId: 'alice',
      threadId: source.id,
      body: { initialMessage: 'will fail to post' },
    });
    const { proposalId } = JSON.parse(proposalRes.body);
    const threadsBefore = threadStore.size;

    const res = await approve(app, 'alice', proposalId);

    assert.equal(res.statusCode, 200, 'approve still returns 200 (thread created successfully)');
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'approved');
    assert.ok(Array.isArray(body.warnings), 'warnings array should be present');
    assert.ok(
      body.warnings.some((w) => w.includes('initialMessage')),
      `expected initialMessage warning, got ${JSON.stringify(body.warnings)}`,
    );
    const proposal = await proposalStore.get(proposalId);
    assert.equal(proposal.status, 'approved', 'proposal must NOT roll back to pending after thread creation');
    assert.equal(threadStore.size, threadsBefore + 1, 'thread must remain (only one new thread, not zero)');
  });

  test('self-heal works even when 60+ messages have accumulated after the marker failure', async () => {
    const { InMemoryProposalStore } = await import('../dist/domains/cats/services/stores/ports/ProposalStore.js');
    class FlakyMarkerStore extends InMemoryProposalStore {
      constructor() {
        super();
        this.failNext = true;
      }
      setCardMessageId(proposalId, cardMessageId) {
        if (this.failNext) {
          this.failNext = false;
          throw new Error('synthetic marker failure');
        }
        return super.setCardMessageId(proposalId, cardMessageId);
      }
    }
    proposalStore = new FlakyMarkerStore();
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { invocationId, callbackToken } = await registry.create('alice', 'opus', source.id);
    const payload = {
      invocationId,
      callbackToken,
      title: 'Old card retry',
      reason: 'Marker fails then thread fills up',
      clientRequestId: 'old-card-key',
    };
    const send = () => app.inject({ method: 'POST', url: '/api/callbacks/propose-thread', payload });

    // First request: marker write fails, but card is appended and the proposal exists.
    const first = await send();
    assert.equal(first.statusCode, 200);

    // Now flood the source thread with 60+ messages so the card sinks below the default
    // getByThread() window (~50). Without a wider self-heal scan, the retry below would 503.
    for (let i = 0; i < 60; i++) {
      await messageStore.append({
        userId: 'alice',
        catId: null,
        content: `filler ${i}`,
        mentions: [],
        timestamp: Date.now() + i,
        threadId: source.id,
      });
    }

    // Retry with the same clientRequestId must still self-heal, even though the card is now
    // far down the message history.
    const second = await send();
    assert.equal(second.statusCode, 200, `retry must self-heal old card, got ${second.statusCode}`);
    const secondBody = JSON.parse(second.body);
    assert.equal(secondBody.deduped, true);
    const healed = await proposalStore.get(secondBody.proposalId);
    assert.ok(healed.cardMessageId, 'marker must be backfilled by wide-window self-heal');
  });

  test('setCardMessageId failure: 200 with warning + retry self-heals via source thread scan', async () => {
    const { InMemoryProposalStore } = await import('../dist/domains/cats/services/stores/ports/ProposalStore.js');
    class FlakyMarkerStore extends InMemoryProposalStore {
      constructor() {
        super();
        this.failNext = true;
      }
      setCardMessageId(proposalId, cardMessageId) {
        if (this.failNext) {
          this.failNext = false;
          throw new Error('synthetic marker write failure');
        }
        return super.setCardMessageId(proposalId, cardMessageId);
      }
    }
    proposalStore = new FlakyMarkerStore();
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { invocationId, callbackToken } = await registry.create('alice', 'opus', source.id);
    const payload = {
      invocationId,
      callbackToken,
      title: 'Marker fail test',
      reason: 'Marker write throws',
      clientRequestId: 'marker-fail-key',
    };
    const send = () => app.inject({ method: 'POST', url: '/api/callbacks/propose-thread', payload });

    const first = await send();
    assert.equal(first.statusCode, 200, 'card-append-then-marker-fail must NOT 500 (card is already visible)');
    const firstBody = JSON.parse(first.body);
    assert.ok(Array.isArray(firstBody.warnings), 'warnings array should surface the marker failure');
    assert.ok(
      firstBody.warnings.some((w) => w.includes('setCardMessageId')),
      `expected setCardMessageId warning, got ${JSON.stringify(firstBody.warnings)}`,
    );
    // The proposal exists and the card is in the source thread, but the marker is still empty.
    const stored = await proposalStore.get(firstBody.proposalId);
    assert.ok(stored, 'proposal must be present');
    assert.equal(stored.cardMessageId, undefined, 'marker should be empty after the failed write');
    const sourceMessages = await messageStore.getByThread(source.id);
    assert.ok(
      sourceMessages.some((m) => String(m.content ?? '').startsWith('提议新建 thread')),
      'card message must already be in the source thread',
    );

    // Retry must self-heal via source thread scan, not stay stuck on 503.
    const second = await send();
    assert.equal(second.statusCode, 200, 'retry must self-heal, not stay 503');
    const secondBody = JSON.parse(second.body);
    assert.equal(secondBody.proposalId, firstBody.proposalId, 'retry must return the same proposalId');
    assert.equal(secondBody.deduped, true);
    // After the retry, the marker is backfilled.
    const healed = await proposalStore.get(firstBody.proposalId);
    assert.ok(healed.cardMessageId, 'cardMessageId should be backfilled by self-heal');
  });

  test('concurrent retry during in-flight card append returns 503 (not phantom 200 deduped)', async () => {
    const { MessageStore } = await import('../dist/domains/cats/services/stores/ports/MessageStore.js');
    // BlockingMessageStore lets the test gate exactly when the FIRST card append resolves.
    let releaseFirstAppend;
    const firstAppendBlocked = new Promise((resolve) => {
      releaseFirstAppend = resolve;
    });
    let firstAppendSeen = false;
    class BlockingMessageStore extends MessageStore {
      async append(msg) {
        if (!firstAppendSeen && String(msg.content ?? '').startsWith('提议新建 thread')) {
          firstAppendSeen = true;
          await firstAppendBlocked;
        }
        return super.append(msg);
      }
    }
    messageStore = new BlockingMessageStore();
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { invocationId, callbackToken } = await registry.create('alice', 'opus', source.id);
    const payload = {
      invocationId,
      callbackToken,
      title: 'In-flight test',
      reason: 'Card append blocks',
      clientRequestId: 'inflight-key',
    };
    const send = () => app.inject({ method: 'POST', url: '/api/callbacks/propose-thread', payload });

    // Kick off the first request — it will hang at messageStore.append.
    const firstPromise = send();
    // Yield to let first request reach the append await.
    await new Promise((r) => setTimeout(r, 10));

    // Now send the second request with the same clientRequestId. The first has a proposal
    // record + dedup key but no cardMessageId yet — fast path must NOT return 200 deduped.
    const second = await send();
    assert.equal(second.statusCode, 503, `expected 503 in-flight, got ${second.statusCode}: ${second.body}`);
    const body = JSON.parse(second.body);
    assert.equal(body.status, 'retryable');
    assert.notEqual(body.deduped, true, 'in-flight retry must not be marked deduped');

    // Now let the first request finish (successfully) and re-run a retry — it should succeed.
    releaseFirstAppend();
    const first = await firstPromise;
    assert.equal(first.statusCode, 200);
    const winningId = JSON.parse(first.body).proposalId;

    // A subsequent retry now sees cardMessageId set and gets a proper deduped success.
    const third = await send();
    assert.equal(third.statusCode, 200);
    const thirdBody = JSON.parse(third.body);
    assert.equal(thirdBody.proposalId, winningId);
    assert.equal(thirdBody.deduped, true);
  });

  test('card append failure cleans up proposal + releases dedup so retry creates a visible card', async () => {
    const { MessageStore } = await import('../dist/domains/cats/services/stores/ports/MessageStore.js');
    // Fail the first card append (the cat-authored "提议新建 thread" message), succeed after.
    class FailFirstAppendStore extends MessageStore {
      constructor() {
        super();
        this.failNext = true;
      }
      append(msg) {
        if (this.failNext && msg.content && String(msg.content).startsWith('提议新建 thread')) {
          this.failNext = false;
          throw new Error('synthetic card append failure');
        }
        return super.append(msg);
      }
    }
    messageStore = new FailFirstAppendStore();
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { invocationId, callbackToken } = await registry.create('alice', 'opus', source.id);
    const payload = {
      invocationId,
      callbackToken,
      title: 'Card retry test',
      reason: 'Verify card append cleanup',
      clientRequestId: 'card-retry-key',
    };

    const first = await app.inject({ method: 'POST', url: '/api/callbacks/propose-thread', payload });
    assert.notEqual(first.statusCode, 200, 'first attempt must surface the card append failure');
    // Cleanup must leave no phantom pending proposal behind.
    const pendingAfterFirst = await proposalStore.listPending('alice');
    assert.equal(pendingAfterFirst.length, 0, 'failed propose must not leave a phantom pending proposal');

    const second = await app.inject({ method: 'POST', url: '/api/callbacks/propose-thread', payload });
    assert.equal(second.statusCode, 200, 'second attempt should succeed');
    const body = JSON.parse(second.body);
    assert.notEqual(body.deduped, true, 'retry must not be silently absorbed by stale dedup key');
    assert.ok(body.proposalId, 'retry must return a real proposalId');
    const sourceMessages = await messageStore.getByThread(source.id);
    const cardMessage = sourceMessages.find((m) => String(m.content ?? '').startsWith('提议新建 thread'));
    assert.ok(cardMessage, 'retry must have appended a visible card message to the source thread');
  });

  test('reserve success + create failure releases dedup so retry can reclaim', async () => {
    const { InMemoryProposalStore } = await import('../dist/domains/cats/services/stores/ports/ProposalStore.js');
    // Fail the first create() call, succeed on subsequent ones.
    class FailFirstCreateStore extends InMemoryProposalStore {
      constructor() {
        super();
        this.createCalls = 0;
      }
      create(input) {
        this.createCalls += 1;
        if (this.createCalls === 1) throw new Error('synthetic create failure');
        return super.create(input);
      }
    }
    proposalStore = new FailFirstCreateStore();
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    const { invocationId, callbackToken } = await registry.create('alice', 'opus', source.id);
    const payload = {
      invocationId,
      callbackToken,
      title: 'Retry test',
      reason: 'Need to verify dedup release',
      clientRequestId: 'retry-key',
    };

    // First attempt: reserveDedup succeeds, create throws → expect failure response.
    const first = await app.inject({ method: 'POST', url: '/api/callbacks/propose-thread', payload });
    assert.notEqual(first.statusCode, 200, 'first attempt must surface the create failure');

    // dedup must be released, so a retry with the same key creates a real proposal.
    const second = await app.inject({ method: 'POST', url: '/api/callbacks/propose-thread', payload });
    assert.equal(second.statusCode, 200, 'second attempt should succeed');
    const body = JSON.parse(second.body);
    assert.notEqual(body.deduped, true, 'retry must not return a phantom deduped response');
    assert.ok(body.proposalId, 'retry must return a real proposalId');
    const stored = await proposalStore.get(body.proposalId);
    assert.ok(stored, 'retry must have actually created a proposal');
    assert.equal(stored.status, 'pending');
  });

  test('dedup race: loser leaves no orphan proposal in the pending list', async () => {
    const { InMemoryProposalStore } = await import('../dist/domains/cats/services/stores/ports/ProposalStore.js');
    // Inject delay in reserveDedup so two concurrent requests with same clientRequestId race.
    class SlowReserveStore extends InMemoryProposalStore {
      async reserveDedup(userId, clientRequestId, proposalId) {
        await new Promise((r) => setTimeout(r, 30));
        return super.reserveDedup(userId, clientRequestId, proposalId);
      }
    }
    proposalStore = new SlowReserveStore();
    const app = await createApp();
    const source = await threadStore.create('alice', 'Source');
    // Real concurrent-retry scenario: same invocation retried twice (e.g. callbackPost retry
    // after a network hiccup), same clientRequestId. Creating two separate invocations would
    // trip the stale_ignored guard before dedup is even evaluated.
    const { invocationId, callbackToken } = await registry.create('alice', 'opus', source.id);
    const send = () =>
      app.inject({
        method: 'POST',
        url: '/api/callbacks/propose-thread',
        payload: { invocationId, callbackToken, title: 'New thread', reason: 'Because', clientRequestId: 'race-key' },
      });

    const [first, second] = await Promise.all([send(), send()]);
    const firstBody = JSON.parse(first.body);
    const secondBody = JSON.parse(second.body);
    // Both responses converge on the same proposalId.
    assert.equal(secondBody.proposalId, firstBody.proposalId, 'both requests must see the same proposalId');

    // The pending list must contain exactly ONE proposal (no orphan from the loser).
    const pending = await proposalStore.listPending('alice');
    assert.equal(pending.length, 1, `expected 1 pending proposal, found ${pending.length}`);
    assert.equal(pending[0].proposalId, firstBody.proposalId);
  });
});
