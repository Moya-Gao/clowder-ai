import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

function stubStore(binding) {
  return {
    getByExternal: async () => binding ?? null,
    getByThread: async () => [],
    bind: async (cId, eCId, tId, uId) => ({
      connectorId: cId,
      externalChatId: eCId,
      threadId: tId,
      userId: uId,
      createdAt: Date.now(),
    }),
    remove: async () => true,
    listByUser: async () => [],
  };
}

function stubThreadStore(data) {
  const map = new Map();
  if (data && !Array.isArray(data)) map.set(data.id, data);
  if (Array.isArray(data)) for (const d of data) map.set(d.id, d);
  return {
    create: async (userId, title) => {
      const id = `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entry = { id, title, createdAt: Date.now() };
      map.set(id, entry);
      return entry;
    },
    get: async (id) => map.get(id) ?? null,
  };
}

describe('ConnectorCommandLayer', () => {
  let ConnectorCommandLayer;

  before(async () => {
    const mod = await import('../dist/infrastructure/connectors/ConnectorCommandLayer.js');
    ConnectorCommandLayer = mod.ConnectorCommandLayer;
  });

  it('returns not-command for regular messages', async () => {
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore(),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', 'hello world');
    assert.equal(result.kind, 'not-command');
  });

  it('returns not-command for unknown /slash commands', async () => {
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore(),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/unknown');
    assert.equal(result.kind, 'not-command');
  });

  it('/where returns current thread info when binding exists', async () => {
    const binding = {
      connectorId: 'feishu',
      externalChatId: 'chat1',
      threadId: 'thread-abc123def',
      userId: 'user1',
      createdAt: Date.now(),
    };
    const store = stubStore(binding);
    const threadStore = stubThreadStore({ id: 'thread-abc123def', title: '飞书测试' });
    const layer = new ConnectorCommandLayer({
      bindingStore: store,
      threadStore,
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/where');
    assert.equal(result.kind, 'where');
    assert.ok(result.response.includes('thread-a'));
    assert.ok(result.response.includes('飞书测试'));
    assert.ok(result.response.includes('cafe.example.com'));
  });

  it('/where returns helpful message when no binding exists', async () => {
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore(),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/where');
    assert.equal(result.kind, 'where');
    assert.ok(result.response.includes('没有'));
  });

  it('/where is case-insensitive on command name', async () => {
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore(),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/Where');
    assert.equal(result.kind, 'where');
  });

  it('/new creates a new thread and returns confirmation', async () => {
    const bindings = new Map();
    const store = {
      ...stubStore(),
      bind: async (cId, eCId, tId, uId) => {
        const b = { connectorId: cId, externalChatId: eCId, threadId: tId, userId: uId, createdAt: Date.now() };
        bindings.set(`${cId}:${eCId}`, b);
        return b;
      },
      getByExternal: async (cId, eCId) => bindings.get(`${cId}:${eCId}`) ?? null,
    };
    const layer = new ConnectorCommandLayer({
      bindingStore: store,
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/new 新话题');
    assert.equal(result.kind, 'new');
    assert.ok(result.newActiveThreadId);
    assert.ok(result.response.includes('新话题'));
    assert.ok(result.response.includes('cafe.example.com'));
  });

  it('/new without title still creates thread', async () => {
    const store = {
      ...stubStore(),
      bind: async (cId, eCId, tId, uId) => ({
        connectorId: cId,
        externalChatId: eCId,
        threadId: tId,
        userId: uId,
        createdAt: Date.now(),
      }),
    };
    const layer = new ConnectorCommandLayer({
      bindingStore: store,
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/new');
    assert.equal(result.kind, 'new');
    assert.ok(result.newActiveThreadId);
  });

  it('/threads lists recent threads with titles', async () => {
    const bindings = new Map();
    const store = {
      ...stubStore(),
      bind: async (cId, eCId, tId, uId) => {
        const b = { connectorId: cId, externalChatId: eCId, threadId: tId, userId: uId, createdAt: Date.now() };
        bindings.set(`${cId}:${eCId}`, b);
        return b;
      },
      listByUser: async () => [
        {
          connectorId: 'feishu',
          externalChatId: 'c1',
          threadId: 'thread-aaa111',
          userId: 'user1',
          createdAt: Date.now(),
        },
        {
          connectorId: 'feishu',
          externalChatId: 'c2',
          threadId: 'thread-bbb222',
          userId: 'user1',
          createdAt: Date.now(),
        },
      ],
    };
    const threadStore = stubThreadStore([
      { id: 'thread-aaa111', title: '飞书Bug' },
      { id: 'thread-bbb222', title: '新功能讨论' },
    ]);
    const layer = new ConnectorCommandLayer({
      bindingStore: store,
      threadStore,
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/threads');
    assert.equal(result.kind, 'threads');
    assert.ok(result.response.includes('飞书Bug'));
    assert.ok(result.response.includes('新功能讨论'));
    assert.ok(result.response.includes('/use'));
  });

  it('/threads returns helpful message when empty', async () => {
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore(),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/threads');
    assert.equal(result.kind, 'threads');
    assert.ok(result.response.includes('没有'));
  });

  it('/use switches to an existing thread by prefix', async () => {
    const bindings = new Map();
    const store = {
      ...stubStore(),
      bind: async (cId, eCId, tId, uId) => {
        const b = { connectorId: cId, externalChatId: eCId, threadId: tId, userId: uId, createdAt: Date.now() };
        bindings.set(`${cId}:${eCId}`, b);
        return b;
      },
      listByUser: async () => [
        {
          connectorId: 'feishu',
          externalChatId: 'c1',
          threadId: 'thread-target-xyz',
          userId: 'user1',
          createdAt: Date.now(),
        },
        {
          connectorId: 'feishu',
          externalChatId: 'c2',
          threadId: 'thread-other-abc',
          userId: 'user1',
          createdAt: Date.now(),
        },
      ],
    };
    const threadStore = stubThreadStore([{ id: 'thread-target-xyz', title: '目标Thread' }]);
    const layer = new ConnectorCommandLayer({
      bindingStore: store,
      threadStore,
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/use thread-ta');
    assert.equal(result.kind, 'use');
    assert.equal(result.newActiveThreadId, 'thread-target-xyz');
    assert.ok(result.response.includes('目标Thread'));
  });

  it('/use with no match returns error', async () => {
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore(),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/use nonexistent');
    assert.equal(result.kind, 'use');
    assert.ok(result.response.includes('找不到'));
  });

  it('/use with no argument returns usage hint', async () => {
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore(),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
    });
    const result = await layer.handle('feishu', 'chat1', 'user1', '/use');
    assert.equal(result.kind, 'use');
    assert.ok(result.response.includes('ID'));
  });
});
