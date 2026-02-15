/**
 * SessionBootstrap Tests — F24 Phase E
 * Tests for bootstrap context injection when a cat starts Session #2+.
 *
 * IMPORTANT: SessionChainStore uses 0-based seq (first session = seq 0).
 * Bootstrap displays 1-based for humans (seq 0 → "Session #1", seq 1 → "Session #2").
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionBootstrap } from '../dist/domains/cats/services/SessionBootstrap.js';

// --- Mock SessionChainStore ---

function createMockSessionChainStore(sessions = []) {
  return {
    getActive(catId, threadId) {
      return sessions.find(
        (s) => s.catId === catId && s.threadId === threadId && s.status === 'active',
      ) ?? null;
    },
    getChain(catId, threadId) {
      return sessions
        .filter((s) => s.catId === catId && s.threadId === threadId)
        .sort((a, b) => a.seq - b.seq);
    },
  };
}

// --- Mock TranscriptReader ---

function createMockTranscriptReader(digests = {}) {
  return {
    async readDigest(sessionId) {
      return digests[sessionId] ?? null;
    },
  };
}

describe('SessionBootstrap', () => {

  describe('buildSessionBootstrap', () => {
    it('returns null for first session (seq=0, no prior context)', async () => {
      const store = createMockSessionChainStore([
        { id: 'sess-0', catId: 'opus', threadId: 'thread-1', status: 'active', seq: 0 },
      ]);
      const reader = createMockTranscriptReader();

      const result = await buildSessionBootstrap(
        { sessionChainStore: store, transcriptReader: reader },
        'opus',
        'thread-1',
      );
      assert.equal(result, null);
    });

    it('returns null when no active session exists', async () => {
      const store = createMockSessionChainStore([
        { id: 'sess-0', catId: 'opus', threadId: 'thread-1', status: 'sealed', seq: 0 },
      ]);
      const reader = createMockTranscriptReader();

      const result = await buildSessionBootstrap(
        { sessionChainStore: store, transcriptReader: reader },
        'opus',
        'thread-1',
      );
      assert.equal(result, null);
    });

    it('returns bootstrap with identity for second session (seq=1 → display #2)', async () => {
      const store = createMockSessionChainStore([
        { id: 'sess-0', catId: 'opus', threadId: 'thread-1', status: 'sealed', seq: 0 },
        { id: 'sess-1', catId: 'opus', threadId: 'thread-1', status: 'active', seq: 1 },
      ]);
      const reader = createMockTranscriptReader();

      const result = await buildSessionBootstrap(
        { sessionChainStore: store, transcriptReader: reader },
        'opus',
        'thread-1',
      );

      assert.ok(result);
      assert.equal(result.sessionSeq, 1); // raw 0-based seq
      assert.ok(result.text.includes('Session #2')); // display is 1-based
      assert.ok(result.text.includes('1 previous session(s) are sealed'));
    });

    it('includes previous session digest when available', async () => {
      const store = createMockSessionChainStore([
        { id: 'sess-0', catId: 'opus', threadId: 'thread-1', status: 'sealed', seq: 0 },
        { id: 'sess-1', catId: 'opus', threadId: 'thread-1', status: 'active', seq: 1 },
      ]);
      const reader = createMockTranscriptReader({
        'sess-0': {
          v: 1,
          sessionId: 'sess-0',
          threadId: 'thread-1',
          catId: 'opus',
          seq: 0,
          time: { createdAt: 1000000, sealedAt: 1060000 },
          invocations: [{ toolNames: ['Write', 'Edit'] }],
          filesTouched: [
            { path: 'src/index.ts', ops: ['edit'] },
            { path: 'src/new.ts', ops: ['create'] },
          ],
          errors: [],
        },
      });

      const result = await buildSessionBootstrap(
        { sessionChainStore: store, transcriptReader: reader },
        'opus',
        'thread-1',
      );

      assert.ok(result);
      assert.equal(result.hasDigest, true);
      assert.ok(result.text.includes('[Previous Session Summary]'));
      assert.ok(result.text.includes('Write, Edit'));
      assert.ok(result.text.includes('src/index.ts'));
      assert.ok(result.text.includes('src/new.ts'));
    });

    it('includes MCP tool recall instructions', async () => {
      const store = createMockSessionChainStore([
        { id: 'sess-0', catId: 'opus', threadId: 'thread-1', status: 'sealed', seq: 0 },
        { id: 'sess-1', catId: 'opus', threadId: 'thread-1', status: 'active', seq: 1 },
      ]);
      const reader = createMockTranscriptReader();

      const result = await buildSessionBootstrap(
        { sessionChainStore: store, transcriptReader: reader },
        'opus',
        'thread-1',
      );

      assert.ok(result);
      assert.ok(result.text.includes('cat_cafe_session_search'));
      assert.ok(result.text.includes('cat_cafe_read_session_digest'));
      assert.ok(result.text.includes('cat_cafe_read_session_events'));
      assert.ok(result.text.includes('Do NOT guess'));
    });

    it('handles digest read failure gracefully (still returns identity + tools)', async () => {
      const store = createMockSessionChainStore([
        { id: 'sess-0', catId: 'opus', threadId: 'thread-1', status: 'sealed', seq: 0 },
        { id: 'sess-1', catId: 'opus', threadId: 'thread-1', status: 'active', seq: 1 },
      ]);
      const reader = {
        async readDigest() { throw new Error('disk error'); },
      };

      const result = await buildSessionBootstrap(
        { sessionChainStore: store, transcriptReader: reader },
        'opus',
        'thread-1',
      );

      assert.ok(result);
      assert.equal(result.hasDigest, false);
      assert.ok(result.text.includes('Session #2')); // seq=1 → display #2
      assert.ok(result.text.includes('cat_cafe_session_search')); // tools still present
    });

    it('correctly counts sealed sessions for Session #3+ (seq=2)', async () => {
      const store = createMockSessionChainStore([
        { id: 'sess-0', catId: 'opus', threadId: 'thread-1', status: 'sealed', seq: 0 },
        { id: 'sess-1', catId: 'opus', threadId: 'thread-1', status: 'sealed', seq: 1 },
        { id: 'sess-2', catId: 'opus', threadId: 'thread-1', status: 'active', seq: 2 },
      ]);
      const reader = createMockTranscriptReader();

      const result = await buildSessionBootstrap(
        { sessionChainStore: store, transcriptReader: reader },
        'opus',
        'thread-1',
      );

      assert.ok(result);
      assert.equal(result.sessionSeq, 2); // raw 0-based
      assert.ok(result.text.includes('Session #3')); // display 1-based
      assert.ok(result.text.includes('3 total sessions'));
      assert.ok(result.text.includes('2 previous session(s) are sealed'));
    });

    it('includes error count when digest has errors', async () => {
      const store = createMockSessionChainStore([
        { id: 'sess-0', catId: 'opus', threadId: 'thread-1', status: 'sealed', seq: 0 },
        { id: 'sess-1', catId: 'opus', threadId: 'thread-1', status: 'active', seq: 1 },
      ]);
      const reader = createMockTranscriptReader({
        'sess-0': {
          v: 1,
          sessionId: 'sess-0',
          threadId: 'thread-1',
          catId: 'opus',
          seq: 0,
          time: { createdAt: 1000000, sealedAt: 1300000 },
          invocations: [],
          filesTouched: [],
          errors: [
            { at: 1100000, message: 'Build failed: missing module' },
            { at: 1200000, message: 'Test assertion error' },
          ],
        },
      });

      const result = await buildSessionBootstrap(
        { sessionChainStore: store, transcriptReader: reader },
        'opus',
        'thread-1',
      );

      assert.ok(result);
      assert.ok(result.text.includes('Errors encountered: 2'));
      assert.ok(result.text.includes('Build failed'));
    });

    it('only reads digest from previous seq (seq-1), not older sessions', async () => {
      let readDigestCalls = [];
      const store = createMockSessionChainStore([
        { id: 'sess-0', catId: 'opus', threadId: 'thread-1', status: 'sealed', seq: 0 },
        { id: 'sess-1', catId: 'opus', threadId: 'thread-1', status: 'sealed', seq: 1 },
        { id: 'sess-2', catId: 'opus', threadId: 'thread-1', status: 'active', seq: 2 },
      ]);
      const reader = {
        async readDigest(sessionId) {
          readDigestCalls.push(sessionId);
          return null;
        },
      };

      await buildSessionBootstrap(
        { sessionChainStore: store, transcriptReader: reader },
        'opus',
        'thread-1',
      );

      // Should only read sess-1 digest (the one right before the active sess-2)
      assert.deepEqual(readDigestCalls, ['sess-1']);
    });
  });
});
