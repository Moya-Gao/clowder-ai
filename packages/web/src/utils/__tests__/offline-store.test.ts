/* eslint-disable @typescript-eslint/no-explicit-any -- test stubs use partial objects */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  _resetDBForTest,
  clearAll,
  loadThreadMessages,
  loadThreads,
  saveThreadMessages,
  saveThreads,
} from '../offline-store';

describe('offline-store', () => {
  beforeEach(async () => {
    await clearAll();
  });

  afterAll(() => {
    _resetDBForTest();
  });

  describe('threads', () => {
    it('returns null when no threads saved', async () => {
      const result = await loadThreads();
      expect(result).toBeNull();
    });

    it('saves and loads threads', async () => {
      const threads = [{ id: 'thread_1', title: 'Test Thread', projectPath: 'default' }] as any[];
      await saveThreads(threads);
      const loaded = await loadThreads();
      expect(loaded).toHaveLength(1);
      expect(loaded![0].id).toBe('thread_1');
    });

    it('overwrites previous threads on re-save', async () => {
      await saveThreads([{ id: 't1' }] as any[]);
      await saveThreads([{ id: 't2' }, { id: 't3' }] as any[]);
      const loaded = await loadThreads();
      expect(loaded).toHaveLength(2);
      expect(loaded![0].id).toBe('t2');
    });
  });

  describe('thread messages', () => {
    it('returns null when no messages saved', async () => {
      const result = await loadThreadMessages('thread_1');
      expect(result).toBeNull();
    });

    it('saves and loads messages for a thread', async () => {
      const messages = [
        { id: 'msg_1', content: [{ type: 'text', text: 'hello' }] },
        { id: 'msg_2', content: [{ type: 'text', text: 'world' }] },
      ] as any[];
      await saveThreadMessages('thread_1', messages, true);
      const result = await loadThreadMessages('thread_1');
      expect(result).not.toBeNull();
      expect(result!.messages).toHaveLength(2);
      expect(result!.hasMore).toBe(true);
    });

    it('trims to last 50 messages', async () => {
      const messages = Array.from({ length: 80 }, (_, i) => ({
        id: `msg_${i}`,
        content: [{ type: 'text', text: `msg ${i}` }],
      })) as any[];
      await saveThreadMessages('thread_1', messages, true);
      const result = await loadThreadMessages('thread_1');
      expect(result!.messages).toHaveLength(50);
      expect(result!.messages[0].id).toBe('msg_30');
    });

    it('saving empty messages overwrites existing snapshot', async () => {
      await saveThreadMessages('t1', [{ id: 'm1' }] as any[], true);
      // Simulate thread cleared server-side: save empty array
      await saveThreadMessages('t1', [], false);
      const result = await loadThreadMessages('t1');
      expect(result).not.toBeNull();
      expect(result!.messages).toHaveLength(0);
      expect(result!.hasMore).toBe(false);
    });

    it('stores messages per-thread independently', async () => {
      await saveThreadMessages('t1', [{ id: 'm1' }] as any[], false);
      await saveThreadMessages('t2', [{ id: 'm2' }] as any[], true);
      const r1 = await loadThreadMessages('t1');
      const r2 = await loadThreadMessages('t2');
      expect(r1!.messages[0].id).toBe('m1');
      expect(r2!.messages[0].id).toBe('m2');
    });
  });

  describe('clearAll', () => {
    it('removes all cached data', async () => {
      await saveThreads([{ id: 't1' }] as any[]);
      await saveThreadMessages('t1', [{ id: 'm1' }] as any[], false);
      await clearAll();
      expect(await loadThreads()).toBeNull();
      expect(await loadThreadMessages('t1')).toBeNull();
    });
  });
});
