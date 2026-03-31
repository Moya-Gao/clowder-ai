/**
 * F102 Phase I — Passage Permanence Regression Test (AC-I6)
 *
 * End-to-end test validating the full permanence guarantee:
 * Redis messages can expire, but passages persist via no-delete + JSONL backfill.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('passage permanence (Phase I regression)', () => {
  let tmpDir;
  let docsDir;
  let store;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `f102-perm-${randomUUID().slice(0, 8)}`);
    docsDir = join(tmpDir, 'docs');
    mkdirSync(join(docsDir, 'features'), { recursive: true });

    const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');
    store = new SqliteEvidenceStore(':memory:');
    await store.initialize();
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rebuild recovers passages from JSONL when Redis messages expired', async () => {
    const { IndexBuilder } = await import('../../dist/domains/memory/IndexBuilder.js');

    const threadId = 'thread_e2e_perm';
    const catId = 'opus';
    const sessionId = 'sess_e2e';

    const mockThreads = [
      {
        id: threadId,
        title: 'E2E permanence test',
        participants: ['opus', 'user'],
        threadMemory: { summary: 'End-to-end permanence verification.' },
        lastActiveAt: Date.now(),
      },
    ];

    // 5 Redis messages
    const allMessages = [
      {
        id: 'e2e_001',
        content: 'User asked about Redis config',
        catId: undefined,
        threadId,
        timestamp: Date.now() - 5000,
      },
      {
        id: 'e2e_002',
        content: 'Opus explained keyPrefix behavior',
        catId: 'opus',
        threadId,
        timestamp: Date.now() - 4000,
      },
      {
        id: 'e2e_003',
        content: 'User confirmed understanding',
        catId: undefined,
        threadId,
        timestamp: Date.now() - 3000,
      },
      {
        id: 'e2e_004',
        content: 'Opus documented the lesson learned',
        catId: 'opus',
        threadId,
        timestamp: Date.now() - 2000,
      },
      {
        id: 'e2e_005',
        content: 'User thanked and closed thread',
        catId: undefined,
        threadId,
        timestamp: Date.now() - 1000,
      },
    ];

    // Matching JSONL transcript
    const transcriptDir = join(tmpDir, 'transcripts');
    const sessDir = join(transcriptDir, 'threads', threadId, catId, 'sessions', sessionId);
    mkdirSync(sessDir, { recursive: true });

    const events = [
      {
        v: 1,
        t: Date.now() - 4500,
        threadId,
        catId,
        sessionId,
        invocationId: 'inv_e2e_1',
        eventNo: 0,
        event: { type: 'text', content: 'keyPrefix does not apply inside eval scripts.' },
      },
      {
        v: 1,
        t: Date.now() - 2500,
        threadId,
        catId,
        sessionId,
        invocationId: 'inv_e2e_2',
        eventNo: 1,
        event: { type: 'text', content: 'Documented as lesson: always use KEYS prefix manually in eval.' },
      },
    ];
    writeFileSync(join(sessDir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    // First rebuild: all 5 messages + transcript
    let currentMessages = allMessages;
    const messageListFn = (tid) => (tid === threadId ? currentMessages : []);

    const builder = new IndexBuilder(store, docsDir, undefined, transcriptDir, () => mockThreads, messageListFn);
    await builder.rebuild();

    const db = store.getDb();
    const passagesAfterFirst = db
      .prepare('SELECT * FROM evidence_passages WHERE doc_anchor = ?')
      .all(`thread-${threadId}`);
    // 5 from Redis + 2 from JSONL = 7 passages
    assert.equal(passagesAfterFirst.length, 7, 'first rebuild: 5 Redis + 2 JSONL = 7 passages');

    // Simulate all Redis messages expired
    currentMessages = [];
    await builder.rebuild();

    const passagesAfterExpiry = db
      .prepare('SELECT * FROM evidence_passages WHERE doc_anchor = ?')
      .all(`thread-${threadId}`);
    assert.equal(passagesAfterExpiry.length, 7, 'after Redis expiry: all 7 passages still exist');

    // Verify Redis-sourced passages survive
    const redisPassages = passagesAfterExpiry.filter((p) => p.passage_id.startsWith('msg-'));
    assert.equal(redisPassages.length, 5, 'all 5 Redis-sourced passages persist');

    // Verify transcript-sourced passages survive
    const transcriptPassages = passagesAfterExpiry.filter((p) => p.passage_id.startsWith('transcript-'));
    assert.equal(transcriptPassages.length, 2, 'both transcript-sourced passages persist');
  });

  it('P1-fix: backfill skips events with missing t field without throwing', async () => {
    const { IndexBuilder } = await import('../../dist/domains/memory/IndexBuilder.js');

    const threadId = 'thread_no_t';
    const catId = 'opus';
    const sessionId = 'sess_no_t';

    const transcriptDir = join(tmpDir, 'transcripts');
    const sessDir = join(transcriptDir, 'threads', threadId, catId, 'sessions', sessionId);
    mkdirSync(sessDir, { recursive: true });

    const events = [
      {
        v: 1,
        threadId,
        catId,
        sessionId,
        invocationId: 'inv_bad',
        eventNo: 0,
        event: { type: 'text', content: 'Missing timestamp' },
      },
      {
        v: 1,
        t: Date.now() - 1000,
        threadId,
        catId,
        sessionId,
        invocationId: 'inv_good',
        eventNo: 1,
        event: { type: 'text', content: 'Valid event after bad one' },
      },
    ];
    writeFileSync(join(sessDir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const builder = new IndexBuilder(store, docsDir, undefined, transcriptDir);

    // Must not throw
    const added = builder.backfillPassagesFromTranscript(threadId);
    // Valid event should be inserted; bad one skipped
    assert.equal(added, 1, 'should skip event with missing t and insert valid one');

    const db = store.getDb();
    const passages = db
      .prepare('SELECT * FROM evidence_passages WHERE doc_anchor = ? ORDER BY position')
      .all(`thread-${threadId}`);
    assert.equal(passages.length, 1);
    assert.equal(passages[0].passage_id, 'transcript-inv_good');
  });

  it('hot path passage insertion is under 5ms', async () => {
    const db = store.getDb();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO evidence_passages
      (doc_anchor, passage_id, content, speaker, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const iterations = 100;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      stmt.run(`thread-bench`, `msg-bench-${i}`, `Benchmark message ${i}`, 'opus', i, new Date().toISOString());
    }
    const elapsed = performance.now() - start;
    const perMessage = elapsed / iterations;

    assert.ok(perMessage < 5, `per-message insertion should be under 5ms, got ${perMessage.toFixed(2)}ms`);
  });
});
