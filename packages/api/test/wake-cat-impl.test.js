import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createWakeCatFn } from '../dist/domains/cats/services/game/wakeCatImpl.js';

function createMockDeps() {
  const appendedMessages = [];
  const enqueuedEntries = [];
  const autoExecuteCalls = [];
  const backfillCalls = [];
  const appendMergedCalls = [];

  let enqueueResult = {
    outcome: 'enqueued',
    entry: { id: 'entry-1' },
    queuePosition: 1,
  };

  return {
    deps: {
      messageStore: {
        append(msg) {
          const stored = { ...msg, id: `msg-${appendedMessages.length + 1}` };
          appendedMessages.push(stored);
          return stored;
        },
      },
      threadStore: {
        async get(threadId) {
          return { threadId, createdBy: 'user-landy', title: 'Game Thread' };
        },
      },
      invocationQueue: {
        enqueue(input) {
          enqueuedEntries.push(input);
          return enqueueResult;
        },
        backfillMessageId(threadId, userId, entryId, messageId) {
          backfillCalls.push({ threadId, userId, entryId, messageId });
        },
        appendMergedMessageId(threadId, userId, entryId, messageId) {
          appendMergedCalls.push({ threadId, userId, entryId, messageId });
        },
      },
      queueProcessor: {
        async tryAutoExecute(threadId) {
          autoExecuteCalls.push(threadId);
        },
      },
      log: {
        info() {},
        warn() {},
        error() {},
      },
    },
    appendedMessages,
    enqueuedEntries,
    autoExecuteCalls,
    backfillCalls,
    appendMergedCalls,
    setEnqueueResult(result) {
      enqueueResult = result;
    },
  };
}

describe('createWakeCatFn', () => {
  it('posts briefing as whisper message with @mention', async () => {
    const { deps, appendedMessages } = createMockDeps();
    const wakeCat = createWakeCatFn(deps);

    await wakeCat({ threadId: 'thread-game-1', catId: 'opus', briefing: 'You are wolf.', timeoutMs: 45000 });

    assert.equal(appendedMessages.length, 1);
    const msg = appendedMessages[0];
    assert.equal(msg.content, 'You are wolf.');
    assert.equal(msg.threadId, 'thread-game-1');
    assert.deepEqual(msg.mentions, ['opus']);
    assert.equal(msg.visibility, 'whisper');
    assert.deepEqual(msg.whisperTo, ['opus']);
    assert.equal(msg.userId, 'system');
    assert.equal(msg.catId, null);
  });

  it('enqueues cat in InvocationQueue with correct params', async () => {
    const { deps, enqueuedEntries } = createMockDeps();
    const wakeCat = createWakeCatFn(deps);

    await wakeCat({ threadId: 'thread-game-1', catId: 'opus', briefing: 'You are wolf.', timeoutMs: 45000 });

    assert.equal(enqueuedEntries.length, 1);
    const entry = enqueuedEntries[0];
    assert.equal(entry.threadId, 'thread-game-1');
    assert.equal(entry.userId, 'user-landy');
    assert.equal(entry.content, 'You are wolf.');
    assert.equal(entry.source, 'agent');
    assert.deepEqual(entry.targetCats, ['opus']);
    assert.equal(entry.intent, 'execute');
    assert.equal(entry.autoExecute, true);
  });

  it('backfills messageId after enqueue', async () => {
    const { deps, backfillCalls } = createMockDeps();
    const wakeCat = createWakeCatFn(deps);

    await wakeCat({ threadId: 'thread-game-1', catId: 'opus', briefing: 'You are wolf.', timeoutMs: 45000 });

    assert.equal(backfillCalls.length, 1);
    assert.equal(backfillCalls[0].threadId, 'thread-game-1');
    assert.equal(backfillCalls[0].userId, 'user-landy');
    assert.equal(backfillCalls[0].entryId, 'entry-1');
    assert.equal(backfillCalls[0].messageId, 'msg-1');
  });

  it('uses appendMergedMessageId when queue merges entries', async () => {
    const { deps, appendMergedCalls, backfillCalls, setEnqueueResult } = createMockDeps();
    setEnqueueResult({ outcome: 'merged', entry: { id: 'entry-2' } });
    const wakeCat = createWakeCatFn(deps);

    await wakeCat({ threadId: 'thread-game-1', catId: 'codex', briefing: 'Seer briefing', timeoutMs: 30000 });

    assert.equal(backfillCalls.length, 0);
    assert.equal(appendMergedCalls.length, 1);
    assert.equal(appendMergedCalls[0].entryId, 'entry-2');
  });

  it('triggers auto-execute after enqueue', async () => {
    const { deps, autoExecuteCalls } = createMockDeps();
    const wakeCat = createWakeCatFn(deps);

    await wakeCat({ threadId: 'thread-game-1', catId: 'opus', briefing: 'You are wolf.', timeoutMs: 45000 });

    assert.equal(autoExecuteCalls.length, 1);
    assert.equal(autoExecuteCalls[0], 'thread-game-1');
  });

  it('handles queue full gracefully (no crash, no auto-execute)', async () => {
    const { deps, autoExecuteCalls, setEnqueueResult } = createMockDeps();
    setEnqueueResult({ outcome: 'full' });
    const wakeCat = createWakeCatFn(deps);

    await wakeCat({ threadId: 'thread-game-1', catId: 'opus', briefing: 'You are wolf.', timeoutMs: 45000 });

    assert.equal(autoExecuteCalls.length, 0);
  });

  it('resolves userId from thread owner', async () => {
    const lookups = [];
    const { deps, enqueuedEntries } = createMockDeps();
    deps.threadStore = {
      async get(threadId) {
        lookups.push(threadId);
        return { threadId, createdBy: 'custom-user-123' };
      },
    };
    const wakeCat = createWakeCatFn(deps);

    await wakeCat({ threadId: 'thread-x', catId: 'gemini', briefing: 'Guard briefing', timeoutMs: 20000 });

    assert.equal(lookups.length, 1);
    assert.equal(lookups[0], 'thread-x');
    assert.equal(enqueuedEntries[0].userId, 'custom-user-123');
  });

  it('falls back to default-user when thread not found', async () => {
    const { deps, enqueuedEntries } = createMockDeps();
    deps.threadStore = {
      async get() {
        return null;
      },
    };
    const wakeCat = createWakeCatFn(deps);

    await wakeCat({ threadId: 'missing-thread', catId: 'opus', briefing: 'Brief', timeoutMs: 10000 });

    assert.equal(enqueuedEntries[0].userId, 'default-user');
  });

  it('handles async messageStore.append', async () => {
    const { deps, backfillCalls } = createMockDeps();
    deps.messageStore = {
      async append(msg) {
        return { ...msg, id: 'async-msg-1' };
      },
    };
    const wakeCat = createWakeCatFn(deps);

    await wakeCat({ threadId: 'thread-game-1', catId: 'opus', briefing: 'Wolf brief', timeoutMs: 45000 });

    assert.equal(backfillCalls[0].messageId, 'async-msg-1');
  });
});
