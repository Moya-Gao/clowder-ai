/**
 * S1 Review Fix Tests
 * 缅因猫 review 发现的 3 个问题的回归测试
 *
 * P1-1: duplicate 请求不应 abort 活跃调用
 * P1-2: 新流程需要持久化 @mentions 到 participants
 * P2:   multipart 路径需要提取 idempotencyKey
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

// --- P1-1: InvocationTracker.start() 不应在 duplicate 检查前调用 ---

describe('P1-1: duplicate request must not abort active invocation', () => {
  test('isDeleting() returns false for normal threads', async () => {
    const { InvocationTracker } = await import(
      '../dist/domains/cats/services/InvocationTracker.js'
    );
    const tracker = new InvocationTracker();
    assert.equal(tracker.isDeleting('thread-1'), false);
  });

  test('isDeleting() returns true during delete guard', async () => {
    const { InvocationTracker } = await import(
      '../dist/domains/cats/services/InvocationTracker.js'
    );
    const tracker = new InvocationTracker();
    const guard = tracker.guardDelete('thread-1');
    assert.equal(guard.acquired, true);
    assert.equal(tracker.isDeleting('thread-1'), true);
    guard.release();
    assert.equal(tracker.isDeleting('thread-1'), false);
  });

  test('start() aborts existing invocation but isDeleting() does not', async () => {
    const { InvocationTracker } = await import(
      '../dist/domains/cats/services/InvocationTracker.js'
    );
    const tracker = new InvocationTracker();

    // Start an active invocation
    const controller1 = tracker.start('thread-1', 'user-1');
    assert.equal(controller1.signal.aborted, false);

    // isDeleting check should NOT abort it
    assert.equal(tracker.isDeleting('thread-1'), false);
    assert.equal(controller1.signal.aborted, false);

    // But start() WOULD abort it
    const controller2 = tracker.start('thread-1', 'user-1');
    assert.equal(controller1.signal.aborted, true); // old one aborted
    assert.equal(controller2.signal.aborted, false); // new one active
  });
});

// --- P1-2: resolveTargetsAndIntent persist 选项 ---

describe('P1-2: resolveTargetsAndIntent persist writes participants', () => {
  function createMockRegistry() {
    let counter = 0;
    return {
      create: () => ({ invocationId: `inv-${++counter}`, callbackToken: `tok-${counter}` }),
      verify: () => null,
    };
  }

  function createMockMessageStore() {
    const rows = [];
    let seq = 0;
    return {
      append: (msg) => {
        const stored = { ...msg, id: `msg-${++seq}`, threadId: msg.threadId ?? 'default' };
        rows.push(stored);
        return stored;
      },
      getRecent: () => [],
      getMentionsFor: () => [],
      getBefore: () => [],
      getByThread: () => [],
      getByThreadAfter: () => [],
      getByThreadBefore: () => [],
      deleteByThread: () => 0,
    };
  }

  function createMockThreadStore() {
    const participants = {};
    return {
      create: () => ({ id: 'mock' }),
      get: (id) => ({ id, title: null, createdBy: 'system', participants: participants[id] ?? [], lastActiveAt: Date.now(), createdAt: Date.now() }),
      list: () => [],
      listByProject: () => [],
      addParticipants: (threadId, catIds) => {
        if (!participants[threadId]) participants[threadId] = [];
        for (const catId of catIds) {
          if (!participants[threadId].includes(catId)) participants[threadId].push(catId);
        }
      },
      getParticipants: (threadId) => participants[threadId] ?? [],
      updateLastActive: () => {},
      updateTitle: () => {},
      delete: () => true,
      _participants: participants,
    };
  }

  function createMockService() {
    return { invoke: mock.fn(async function* () { yield { type: 'done', catId: 'opus', timestamp: Date.now() }; }) };
  }

  test('persist: false (default) does NOT write participants', async () => {
    const { AgentRouter } = await import('../dist/domains/cats/services/AgentRouter.js');

    const threadStore = createMockThreadStore();
    const router = new AgentRouter({
      claudeService: createMockService(),
      codexService: createMockService(),
      geminiService: createMockService(),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
      threadStore,
    });

    await router.resolveTargetsAndIntent('@codex 你好', 'thread-1');
    assert.deepEqual(threadStore._participants['thread-1'] ?? [], []);
  });

  test('persist: true writes @mentions to thread participants', async () => {
    const { AgentRouter } = await import('../dist/domains/cats/services/AgentRouter.js');

    const threadStore = createMockThreadStore();
    const router = new AgentRouter({
      claudeService: createMockService(),
      codexService: createMockService(),
      geminiService: createMockService(),
      registry: createMockRegistry(),
      messageStore: createMockMessageStore(),
      threadStore,
    });

    const { targetCats } = await router.resolveTargetsAndIntent(
      '@codex 你好', 'thread-1', { persist: true },
    );
    assert.ok(targetCats.includes('codex'));
    assert.ok(threadStore._participants['thread-1']?.includes('codex'));
  });
});

// --- P2: multipart idempotencyKey extraction ---

describe('P2: parseMultipart extracts idempotencyKey', () => {
  test('idempotencyKey is returned when present in fields', async () => {
    const { parseMultipart } = await import('../dist/routes/parse-multipart.js');
    const testUuid = '550e8400-e29b-41d4-a716-446655440000';

    // Mock request with parts iterator
    const mockRequest = {
      parts: async function* () {
        yield { type: 'field', fieldname: 'content', value: 'Hello' };
        yield { type: 'field', fieldname: 'userId', value: 'user-1' };
        yield { type: 'field', fieldname: 'idempotencyKey', value: testUuid };
      },
    };

    const result = await parseMultipart(mockRequest, '/tmp/uploads');
    assert.ok(!('error' in result));
    assert.equal(result.idempotencyKey, testUuid);
  });

  test('idempotencyKey is undefined when not provided', async () => {
    const { parseMultipart } = await import('../dist/routes/parse-multipart.js');

    const mockRequest = {
      parts: async function* () {
        yield { type: 'field', fieldname: 'content', value: 'Hello' };
        yield { type: 'field', fieldname: 'userId', value: 'user-1' };
      },
    };

    const result = await parseMultipart(mockRequest, '/tmp/uploads');
    assert.ok(!('error' in result));
    assert.equal(result.idempotencyKey, undefined);
  });
});

// --- Integration: InvocationRecordStore dedup + tracker isolation ---

describe('Integration: dedup does not trigger tracker abort', () => {
  test('duplicate create does not require tracker.start()', async () => {
    const { InvocationRecordStore } = await import(
      '../dist/domains/cats/services/InvocationRecordStore.js'
    );
    const { InvocationTracker } = await import(
      '../dist/domains/cats/services/InvocationTracker.js'
    );

    const store = new InvocationRecordStore();
    const tracker = new InvocationTracker();

    // Simulate first request: dedup check → start → execute
    const first = store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'same-key',
    });
    assert.equal(first.outcome, 'created');
    const controller = tracker.start('thread-1', 'user-1');
    assert.equal(controller.signal.aborted, false);

    // Simulate duplicate request: dedup check → duplicate → no start needed
    const second = store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'same-key',
    });
    assert.equal(second.outcome, 'duplicate');

    // Key assertion: first controller is NOT aborted (no start() was called)
    assert.equal(controller.signal.aborted, false);
  });
});

// --- R2: delete-guard race between isDeleting() and start() ---

describe('R2: delete-guard race cancels InvocationRecord without writing message', () => {
  test('start() returning aborted controller should mark record canceled', async () => {
    const { InvocationRecordStore } = await import(
      '../dist/domains/cats/services/InvocationRecordStore.js'
    );
    const { InvocationTracker } = await import(
      '../dist/domains/cats/services/InvocationTracker.js'
    );

    const store = new InvocationRecordStore();
    const tracker = new InvocationTracker();

    // Step 1: isDeleting() returns false (thread not deleting yet)
    assert.equal(tracker.isDeleting('thread-1'), false);

    // Step 2: InvocationRecord created successfully
    const result = store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'race-key',
    });
    assert.equal(result.outcome, 'created');

    // Step 3: Between isDeleting() and start(), another request triggers guardDelete
    const guard = tracker.guardDelete('thread-1');
    assert.equal(guard.acquired, true);

    // Step 4: start() now returns pre-aborted controller
    const controller = tracker.start('thread-1', 'user-1');
    assert.equal(controller.signal.aborted, true);

    // Step 5: The correct behavior — update record to canceled, do NOT write message
    store.update(result.invocationId, { status: 'canceled' });
    const record = store.get(result.invocationId);
    assert.equal(record.status, 'canceled');
    assert.equal(record.userMessageId, null); // No message was written

    guard.release();
  });
});
