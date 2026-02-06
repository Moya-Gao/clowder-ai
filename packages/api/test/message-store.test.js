/**
 * MessageStore Tests
 * 测试内存消息存储
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('MessageStore', () => {
  test('append() stores message and returns with id', async () => {
    const { MessageStore } = await import(
      '../dist/domains/cats/services/MessageStore.js'
    );

    const store = new MessageStore();
    const result = store.append({
      userId: 'user-1',
      catId: null,
      content: 'Hello',
      mentions: [],
      timestamp: Date.now(),
    });

    assert.ok(typeof result.id === 'string');
    assert.ok(result.id.length > 0);
    assert.equal(result.content, 'Hello');
    assert.equal(result.userId, 'user-1');
    assert.equal(store.size, 1);
  });

  test('getRecent() returns last N messages', async () => {
    const { MessageStore } = await import(
      '../dist/domains/cats/services/MessageStore.js'
    );

    const store = new MessageStore();

    for (let i = 0; i < 5; i++) {
      store.append({
        userId: 'user-1',
        catId: null,
        content: `Message ${i}`,
        mentions: [],
        timestamp: i,
      });
    }

    const recent = store.getRecent(3);
    assert.equal(recent.length, 3);
    assert.equal(recent[0].content, 'Message 2');
    assert.equal(recent[1].content, 'Message 3');
    assert.equal(recent[2].content, 'Message 4');
  });

  test('getMentionsFor() returns messages mentioning a specific cat', async () => {
    const { MessageStore } = await import(
      '../dist/domains/cats/services/MessageStore.js'
    );

    const store = new MessageStore();

    store.append({
      userId: 'user-1',
      catId: null,
      content: '@opus help',
      mentions: ['opus'],
      timestamp: 1,
    });
    store.append({
      userId: 'user-1',
      catId: null,
      content: '@codex review',
      mentions: ['codex'],
      timestamp: 2,
    });
    store.append({
      userId: 'user-1',
      catId: null,
      content: '@opus and @codex',
      mentions: ['opus', 'codex'],
      timestamp: 3,
    });

    const opusMentions = store.getMentionsFor('opus', 10);
    assert.equal(opusMentions.length, 2);
    assert.equal(opusMentions[0].content, '@opus help');
    assert.equal(opusMentions[1].content, '@opus and @codex');

    const codexMentions = store.getMentionsFor('codex', 10);
    assert.equal(codexMentions.length, 2);
  });

  test('truncates when exceeding maxMessages', async () => {
    const { MessageStore } = await import(
      '../dist/domains/cats/services/MessageStore.js'
    );

    const store = new MessageStore({ maxMessages: 5 });

    for (let i = 0; i < 8; i++) {
      store.append({
        userId: 'user-1',
        catId: null,
        content: `Message ${i}`,
        mentions: [],
        timestamp: i,
      });
    }

    assert.equal(store.size, 5);
    const recent = store.getRecent(10);
    assert.equal(recent[0].content, 'Message 3');
    assert.equal(recent[4].content, 'Message 7');
  });

  test('empty store returns empty arrays', async () => {
    const { MessageStore } = await import(
      '../dist/domains/cats/services/MessageStore.js'
    );

    const store = new MessageStore();
    assert.deepEqual(store.getRecent(), []);
    assert.deepEqual(store.getMentionsFor('opus'), []);
    assert.equal(store.size, 0);
  });
});
