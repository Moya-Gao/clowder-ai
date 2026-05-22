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
    const { invocationId, callbackToken } = registry.create(userId, catId, threadId);
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
    const first = registry.create('alice', 'opus', source.id);
    registry.create('alice', 'opus', source.id); // supersedes first

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
});
