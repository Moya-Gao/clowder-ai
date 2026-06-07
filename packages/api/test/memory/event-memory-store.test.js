import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { EventMemoryStore } from '../../dist/domains/memory/EventMemoryStore.js';

/**
 * F227 PR-1 Task 2 — EventMemoryStore (memory cell, SQLite-backed).
 *
 * Tests run against a REAL SQLite engine (:memory:), not a JS in-memory mock —
 * so SQL filter / ordering / pagination behavior is exercised for real
 * (LL: in-memory-dense mocks hide index/pagination bugs).
 */

function baseRecord(overrides = {}) {
  return {
    type: 'scaffold',
    trigger: 'human_brake',
    cat: 'cat-opus',
    threadId: 'thread_a',
    messageId: 'msg_1',
    timestamp: 1000,
    summary: '脚手架',
    cognitiveTransition: 'user_brake',
    relatedHarness: null,
    confidence: 'high',
    ...overrides,
  };
}

describe('EventMemoryStore (F227 PR-1)', () => {
  /** @type {EventMemoryStore} */
  let store;

  beforeEach(async () => {
    store = new EventMemoryStore(':memory:');
    await store.initialize();
  });

  describe('markEvent + getEvent', () => {
    it('mints evt_ eventId and returns the stored record', () => {
      const stored = store.markEvent(baseRecord());
      assert.ok(stored.eventId.startsWith('evt_'), `expected evt_ prefix, got ${stored.eventId}`);
      assert.equal(stored.type, 'scaffold');
      assert.equal(stored.trigger, 'human_brake');
      assert.equal(stored.messageId, 'msg_1');
    });

    it('round-trips all fields via getEvent (deepEqual)', () => {
      const stored = store.markEvent(baseRecord({ relatedHarness: ['commit:abc', 'skill:tdd'] }));
      const got = store.getEvent(stored.eventId);
      assert.deepEqual(got, stored);
    });

    it('round-trips null nullable fields', () => {
      const stored = store.markEvent(baseRecord({ cognitiveTransition: null, relatedHarness: null }));
      const got = store.getEvent(stored.eventId);
      assert.equal(got.cognitiveTransition, null);
      assert.equal(got.relatedHarness, null);
    });

    it('mints unique eventIds', () => {
      const a = store.markEvent(baseRecord());
      const b = store.markEvent(baseRecord());
      assert.notEqual(a.eventId, b.eventId);
    });

    it('returns null for a missing eventId', () => {
      assert.equal(store.getEvent('evt_nope'), null);
    });
  });

  describe('listEvents — filter', () => {
    beforeEach(() => {
      store.markEvent(
        baseRecord({
          trigger: 'human_brake',
          cat: 'cat-opus',
          type: 'scaffold',
          threadId: 'thread_a',
          confidence: 'high',
          timestamp: 100,
        }),
      );
      store.markEvent(
        baseRecord({
          trigger: 'cat_brake',
          cat: 'cat-codex',
          type: 'detour',
          threadId: 'thread_a',
          confidence: 'low',
          timestamp: 200,
        }),
      );
      store.markEvent(
        baseRecord({
          trigger: 'lesson_settle',
          cat: 'cat-opus',
          type: 'lesson',
          threadId: 'thread_b',
          confidence: 'mid',
          timestamp: 300,
        }),
      );
    });

    it('filters by trigger', () => {
      const r = store.listEvents({ trigger: 'human_brake' });
      assert.equal(r.length, 1);
      assert.equal(r[0].trigger, 'human_brake');
    });

    it('filters by cat', () => {
      assert.equal(store.listEvents({ cat: 'cat-opus' }).length, 2);
    });

    it('filters by type', () => {
      assert.equal(store.listEvents({ type: 'detour' }).length, 1);
    });

    it('filters by threadId', () => {
      assert.equal(store.listEvents({ threadId: 'thread_a' }).length, 2);
    });

    it('filters by confidence', () => {
      assert.equal(store.listEvents({ confidence: 'low' }).length, 1);
    });

    it('combines filters with AND semantics', () => {
      assert.equal(store.listEvents({ cat: 'cat-opus', threadId: 'thread_a' }).length, 1);
    });

    it('filters by time window (since/until inclusive)', () => {
      const r = store.listEvents({ since: 150, until: 250 });
      assert.equal(r.length, 1);
      assert.equal(r[0].timestamp, 200);
    });

    it('returns all events when no filter', () => {
      assert.equal(store.listEvents().length, 3);
    });
  });

  describe('listEvents — order + pagination', () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        store.markEvent(baseRecord({ messageId: `msg_${i}`, timestamp: i * 100 }));
      }
    });

    it('returns newest first (timestamp DESC)', () => {
      const r = store.listEvents();
      assert.equal(r[0].timestamp, 500);
      assert.equal(r[4].timestamp, 100);
    });

    it('respects limit', () => {
      assert.equal(store.listEvents({ limit: 2 }).length, 2);
    });

    it('respects offset for stable paging', () => {
      const page1 = store.listEvents({ limit: 2, offset: 0 });
      const page2 = store.listEvents({ limit: 2, offset: 2 });
      assert.equal(page1[0].timestamp, 500);
      assert.equal(page1[1].timestamp, 400);
      assert.equal(page2[0].timestamp, 300);
      assert.equal(page2[1].timestamp, 200);
    });
  });

  describe('getByCoord (teleport reverse lookup)', () => {
    it('returns events at a (threadId, messageId) coordinate', () => {
      store.markEvent(baseRecord({ threadId: 'thread_a', messageId: 'msg_x' }));
      store.markEvent(baseRecord({ threadId: 'thread_a', messageId: 'msg_y' }));
      const r = store.getByCoord('thread_a', 'msg_x');
      assert.equal(r.length, 1);
      assert.equal(r[0].messageId, 'msg_x');
    });

    it('returns empty array for an unknown coordinate', () => {
      assert.deepEqual(store.getByCoord('thread_z', 'msg_none'), []);
    });
  });

  describe('health', () => {
    it('reports healthy after initialize', () => {
      assert.equal(store.health(), true);
    });
  });

  describe('markEvent guard (砚砚 non-blocking)', () => {
    it('throws on an invalid record (missing fields)', () => {
      assert.throws(() => store.markEvent({ type: 'x' }), /isEventMemoryRecord guard/);
    });

    it('throws on a bad enum value', () => {
      assert.throws(() => store.markEvent(baseRecord({ trigger: 'bogus' })), /isEventMemoryRecord guard/);
    });
  });

  describe('dead-letter (P1-3 — 最终不丢)', () => {
    it('appends a failed record and reads it back via listDeadLetter', () => {
      const rec = baseRecord();
      store.appendDeadLetter(rec, 'simulated write failure');
      const entries = store.listDeadLetter();
      assert.equal(entries.length, 1);
      assert.deepEqual(entries[0].record, rec);
      assert.equal(entries[0].error, 'simulated write failure');
      assert.ok(typeof entries[0].failedAt === 'number');
    });

    it('accumulates multiple dead-letters', () => {
      store.appendDeadLetter(baseRecord({ messageId: 'm1' }), 'e1');
      store.appendDeadLetter(baseRecord({ messageId: 'm2' }), 'e2');
      assert.equal(store.listDeadLetter().length, 2);
    });

    it('listDeadLetter is empty when nothing has failed', () => {
      assert.deepEqual(store.listDeadLetter(), []);
    });
  });
});
