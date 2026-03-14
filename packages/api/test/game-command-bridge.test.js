/**
 * Game Command Bridge Integration Test (F101)
 *
 * Verifies that /game commands in POST /api/messages are intercepted
 * and routed to GameOrchestrator instead of AI agents.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import Fastify from 'fastify';
import { messagesRoutes } from '../dist/routes/messages.js';

/** In-memory GameStore stub */
function createStubGameStore() {
  const games = new Map();
  const activeByThread = new Map();
  return {
    games,
    async createGame(runtime) {
      if (activeByThread.has(runtime.threadId)) {
        throw new Error(`Thread ${runtime.threadId} already has an active game`);
      }
      games.set(runtime.gameId, structuredClone(runtime));
      activeByThread.set(runtime.threadId, runtime.gameId);
      return structuredClone(runtime);
    },
    async getGame(gameId) {
      const g = games.get(gameId);
      return g ? structuredClone(g) : null;
    },
    async getActiveGame(threadId) {
      const id = activeByThread.get(threadId);
      if (!id) return null;
      return this.getGame(id);
    },
    async updateGame(gameId, runtime) {
      games.set(gameId, structuredClone(runtime));
    },
    async endGame(gameId, winner) {
      const g = games.get(gameId);
      if (g) {
        g.status = 'finished';
        g.winner = winner;
        activeByThread.delete(g.threadId);
      }
    },
  };
}

/** Stub message store — tracks appended messages */
function createStubMessageStore() {
  const messages = [];
  let idCounter = 0;
  return {
    messages,
    async append(msg) {
      const id = `msg-${++idCounter}`;
      const stored = { ...msg, id };
      messages.push(stored);
      return stored;
    },
    async getMessages() {
      return messages;
    },
  };
}

function createStubSocket() {
  const events = [];
  return {
    events,
    broadcastToRoom(room, event, data) {
      events.push({ room, event, data });
    },
    emitToUser(userId, event, data) {
      events.push({ userId, event, data });
    },
    broadcastAgentMessage() {},
  };
}

/** Minimal router stub — should NOT be called for /game commands */
function createStubRouter() {
  let routeCalled = false;
  return {
    get routeCalled() {
      return routeCalled;
    },
    async resolveTargetsAndIntent() {
      routeCalled = true;
      return { targetCats: ['opus'], intent: { intent: 'execute', promptTags: [] } };
    },
    async *routeExecution() {
      routeCalled = true;
    },
  };
}

function createStubRegistry() {
  return {
    get() {
      return undefined;
    },
  };
}

function createStubThreadStore() {
  return {
    async get(id) {
      return { id, title: 'Test Thread', deletedAt: null };
    },
    async updateTitle() {},
  };
}

describe('/game command bridge in POST /api/messages', () => {
  let app;
  let gameStore;
  let messageStore;
  let socketStub;
  let routerStub;

  before(async () => {
    app = Fastify();
    gameStore = createStubGameStore();
    messageStore = createStubMessageStore();
    socketStub = createStubSocket();
    routerStub = createStubRouter();

    await app.register(messagesRoutes, {
      registry: createStubRegistry(),
      messageStore,
      socketManager: socketStub,
      router: routerStub,
      threadStore: createStubThreadStore(),
      gameStore,
    });

    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('intercepts /game werewolf god-view voice and starts a game', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/messages',
      headers: { 'x-cat-cafe-user': 'lysander' },
      payload: {
        content: '/game werewolf god-view voice',
        threadId: 'thread-test-1',
      },
    });

    const body = res.json();
    assert.equal(body.status, 'game_started');
    assert.ok(body.gameId, 'should return gameId');
    assert.ok(body.userMessageId, 'should return userMessageId');

    // User message stored in chat history
    assert.equal(messageStore.messages.length, 1);
    assert.equal(messageStore.messages[0].content, '/game werewolf god-view voice');

    // Game created in store
    assert.equal(gameStore.games.size, 1);
    const game = [...gameStore.games.values()][0];
    assert.equal(game.threadId, 'thread-test-1');
    assert.equal(game.status, 'playing');
    assert.equal(game.config.voiceMode, true);
    assert.equal(game.config.humanRole, 'god-view');
    assert.equal(game.seats.length, 7);

    // All seats should have roles assigned (via WerewolfLobby)
    for (const seat of game.seats) {
      assert.ok(seat.role, `seat ${seat.seatId} should have a role assigned`);
    }

    // AI routing NOT invoked
    assert.equal(routerStub.routeCalled, false, 'AI router should not be called for /game commands');
  });

  it('passes normal messages through to AI routing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/messages',
      headers: { 'x-cat-cafe-user': 'lysander' },
      payload: {
        content: 'hello world',
        threadId: 'thread-test-2',
      },
    });

    // Should go through normal routing (may fail due to minimal stubs, but router should be called)
    assert.equal(routerStub.routeCalled, true, 'AI router should be called for normal messages');
  });

  it('broadcasts game:started and game:state_update WebSocket events', async () => {
    // Reset socket events
    socketStub.events.length = 0;

    const res = await app.inject({
      method: 'POST',
      url: '/api/messages',
      headers: { 'x-cat-cafe-user': 'lysander' },
      payload: {
        content: '/game werewolf player voice',
        threadId: 'thread-test-3',
      },
    });

    const body = res.json();
    assert.equal(body.status, 'game_started');

    // Should have game:started broadcast
    const startedEvents = socketStub.events.filter((e) => e.event === 'game:started');
    assert.equal(startedEvents.length, 1);
    assert.equal(startedEvents[0].room, 'thread:thread-test-3');

    // Should have game:state_update for each seat
    const stateEvents = socketStub.events.filter((e) => e.event === 'game:state_update');
    assert.equal(stateEvents.length, 7, 'should broadcast state to all 7 seats');
  });

  it('sets humanSeat=P1 for player mode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/messages',
      headers: { 'x-cat-cafe-user': 'lysander' },
      payload: {
        content: '/game werewolf player',
        threadId: 'thread-test-4',
      },
    });

    const body = res.json();
    assert.equal(body.status, 'game_started');

    const game = [...gameStore.games.values()].find((g) => g.threadId === 'thread-test-4');
    assert.equal(game.config.humanRole, 'player');
    assert.equal(game.config.humanSeat, 'P1');
    assert.equal(game.config.voiceMode, false);
    // P1 should be human
    assert.equal(game.seats[0].actorType, 'human');
    assert.equal(game.seats[0].actorId, 'lysander');
  });

  it('returns 409 when thread already has an active game', async () => {
    // First game — should succeed
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/messages',
      headers: { 'x-cat-cafe-user': 'lysander' },
      payload: {
        content: '/game werewolf player',
        threadId: 'thread-test-conflict',
      },
    });
    assert.equal(res1.json().status, 'game_started');

    // Second game on same thread — should get 409, not 500
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/messages',
      headers: { 'x-cat-cafe-user': 'lysander' },
      payload: {
        content: '/game werewolf god-view',
        threadId: 'thread-test-conflict',
      },
    });
    assert.equal(res2.statusCode, 409);
    const body = res2.json();
    assert.ok(body.error);
    assert.match(body.error, /active game/i);
  });
});
