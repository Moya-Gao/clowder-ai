// @ts-check

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_HIERARCHICAL_CONTEXT } from '../dist/config/hierarchical-context-config.js';
import {
  buildTombstone,
  detectRecentBurst,
  formatTombstone,
  recallEvidence,
  scrubToolPayloads,
} from '../dist/domains/cats/services/agents/routing/context-transport.js';

// --- Test Helpers ---

let _msgSeq = 0;
/** Create a minimal StoredMessage for testing */
function makeMsg(overrides = {}) {
  const seq = _msgSeq++;
  return {
    id: `msg-${seq}`,
    threadId: 'thread-1',
    userId: 'user-1',
    catId: null,
    content: `Message ${seq}`,
    mentions: [],
    timestamp: Date.now() - (100 - seq) * 60_000, // each msg 1 minute apart
    ...overrides,
  };
}

function resetSeq() {
  _msgSeq = 0;
}

/** Create N messages spaced 1 minute apart from a base timestamp */
function makeMsgSequence(n, baseTimestamp = Date.now() - n * 60_000) {
  resetSeq();
  return Array.from({ length: n }, (_, i) => makeMsg({ timestamp: baseTimestamp + i * 60_000 }));
}

// --- detectRecentBurst Tests ---

describe('F148: detectRecentBurst', () => {
  const config = { ...DEFAULT_HIERARCHICAL_CONTEXT };

  it('all messages within 1 minute → all in burst (up to maxBurst)', () => {
    resetSeq();
    const base = Date.now();
    const msgs = Array.from(
      { length: 8 },
      (_, i) => makeMsg({ timestamp: base + i * 1000 }), // 1 second apart
    );

    const { burst, omitted } = detectRecentBurst(msgs, config);
    assert.equal(burst.length, 8);
    assert.equal(omitted.length, 0);
  });

  it('detects silence gap and splits burst', () => {
    resetSeq();
    const base = Date.now();
    // 15 msgs, 1 minute apart, then 20-minute gap, then 5 msgs
    const earlyMsgs = Array.from({ length: 15 }, (_, i) => makeMsg({ timestamp: base + i * 60_000 }));
    const lateMsgs = Array.from({ length: 5 }, (_, i) =>
      makeMsg({ timestamp: base + 15 * 60_000 + 20 * 60_000 + i * 60_000 }),
    );
    const all = [...earlyMsgs, ...lateMsgs];

    const { burst, omitted } = detectRecentBurst(all, config);
    assert.equal(burst.length, 5, 'burst should be the 5 msgs after the gap');
    assert.equal(omitted.length, 15);
  });

  it('guarantees minBurstMessages even when gap is found early', () => {
    resetSeq();
    const base = Date.now();
    // 10 msgs, then 20-minute gap, then only 2 msgs
    const earlyMsgs = Array.from({ length: 10 }, (_, i) => makeMsg({ timestamp: base + i * 60_000 }));
    const lateMsgs = Array.from({ length: 2 }, (_, i) =>
      makeMsg({ timestamp: base + 10 * 60_000 + 20 * 60_000 + i * 60_000 }),
    );
    const all = [...earlyMsgs, ...lateMsgs];

    const { burst, omitted } = detectRecentBurst(all, config);
    // Should get at least minBurstMessages (4), so extends past the gap
    assert.ok(
      burst.length >= config.minBurstMessages,
      `burst (${burst.length}) should be >= minBurstMessages (${config.minBurstMessages})`,
    );
  });

  it('caps at maxBurstMessages', () => {
    resetSeq();
    const base = Date.now();
    // 20 messages, all 1 second apart (no gap) → should cap at maxBurstMessages
    const msgs = Array.from({ length: 20 }, (_, i) => makeMsg({ timestamp: base + i * 1000 }));

    const smallConfig = { ...config, maxBurstMessages: 8 };
    const { burst, omitted } = detectRecentBurst(msgs, smallConfig);
    assert.equal(burst.length, 8, 'should cap at maxBurstMessages');
    assert.equal(omitted.length, 12);
  });

  it('does not split tool_use → tool_result pair at burst boundary', () => {
    resetSeq();
    const base = Date.now();
    // 10 msgs, all 1 second apart. Msg 2 (from tail) is tool_use, msg 1 is tool_result
    const msgs = Array.from({ length: 10 }, (_, i) => makeMsg({ timestamp: base + i * 1000 }));
    // Make msg[8] a tool_use (catId = cat) and msg[9] a tool_result
    msgs[8] = {
      ...msgs[8],
      catId: 'opus',
      toolEvents: [{ id: 'te-1', type: 'tool_use', label: 'search', timestamp: base + 8000 }],
    };
    msgs[9] = {
      ...msgs[9],
      catId: null,
      toolEvents: [{ id: 'te-2', type: 'tool_result', label: 'search', timestamp: base + 9000 }],
    };

    // Cap at 3, but the tool pair is at index 8-9 (positions 2-1 from tail)
    const smallConfig = { ...config, maxBurstMessages: 3 };
    const { burst } = detectRecentBurst(msgs, smallConfig);

    // Both tool_use and tool_result must be in burst
    const hasToolUse = burst.some((m) => m.toolEvents?.some((e) => e.type === 'tool_use'));
    const hasToolResult = burst.some((m) => m.toolEvents?.some((e) => e.type === 'tool_result'));
    assert.ok(hasToolUse && hasToolResult, 'tool_use→tool_result pair must not be split');
  });

  it('does not split user question → cat answer pair at burst boundary', () => {
    resetSeq();
    const base = Date.now();
    const msgs = Array.from({ length: 10 }, (_, i) => makeMsg({ timestamp: base + i * 1000 }));
    // Make msg[6] a user question, msg[7] a cat answer
    msgs[6] = { ...msgs[6], catId: null, content: 'What is Redis?' };
    msgs[7] = { ...msgs[7], catId: 'opus', content: 'Redis is...' };

    // Cap at 4: should include msg[6-9] (indices from tail: 3,2,1,0)
    // If cap were 3, would need to extend to include the Q→A pair
    const smallConfig = { ...config, maxBurstMessages: 3 };
    const { burst } = detectRecentBurst(msgs, smallConfig);

    // The last 3 are msg[7,8,9]. msg[7] is a cat answer to msg[6] (user question).
    // Semantic chain protection should pull in msg[6] too.
    const hasQuestion = burst.some((m) => m.content === 'What is Redis?');
    const hasAnswer = burst.some((m) => m.content === 'Redis is...');
    if (hasAnswer) {
      assert.ok(hasQuestion, 'if cat answer is in burst, the user question must also be included');
    }
  });

  it('returns all messages when count <= minBurstMessages', () => {
    resetSeq();
    const msgs = makeMsgSequence(3);
    const { burst, omitted } = detectRecentBurst(msgs, config);
    assert.equal(burst.length, 3);
    assert.equal(omitted.length, 0);
  });

  it('handles empty array', () => {
    const { burst, omitted } = detectRecentBurst([], config);
    assert.equal(burst.length, 0);
    assert.equal(omitted.length, 0);
  });
});

// --- buildTombstone Tests ---

describe('F148: buildTombstone', () => {
  const config = { ...DEFAULT_HIERARCHICAL_CONTEXT };

  it('returns correct count, time range, participants for omitted messages', () => {
    resetSeq();
    const base = Date.now() - 3600_000;
    const omitted = [
      makeMsg({ timestamp: base, userId: 'user-1', catId: null, content: 'hello' }),
      makeMsg({ timestamp: base + 60_000, userId: 'user-1', catId: 'opus', content: 'hi there' }),
      makeMsg({ timestamp: base + 120_000, userId: 'user-2', catId: null, content: 'Redis cluster setup' }),
      makeMsg({ timestamp: base + 180_000, userId: 'user-1', catId: 'codex', content: 'Redis config looks good' }),
    ];

    const tombstone = buildTombstone(omitted, 'Redis Migration Thread', config);
    assert.ok(tombstone !== null);
    assert.equal(tombstone.omittedCount, 4);
    assert.equal(tombstone.timeRange.from, base);
    assert.equal(tombstone.timeRange.to, base + 180_000);
    assert.ok(tombstone.participants.includes('opus'));
    assert.ok(tombstone.participants.includes('codex'));
  });

  it('extracts keywords from message content (top N by frequency)', () => {
    resetSeq();
    const base = Date.now();
    const omitted = Array.from({ length: 10 }, (_, i) =>
      makeMsg({
        timestamp: base + i * 60_000,
        content: i % 2 === 0 ? 'Redis cluster configuration needs review' : 'The Redis deployment pipeline is broken',
      }),
    );

    const tombstone = buildTombstone(omitted, 'Deployment', config);
    assert.ok(tombstone !== null);
    // "Redis" appears in all 10 messages → should be a keyword
    assert.ok(tombstone.keywords.length > 0);
    assert.ok(tombstone.keywords.length <= config.maxTombstoneKeywords);
    assert.ok(
      tombstone.keywords.some((k) => k.toLowerCase().includes('redis')),
      `keywords should include "redis", got: ${tombstone.keywords}`,
    );
  });

  it('retrieval hints include search_evidence suggestion', () => {
    resetSeq();
    const omitted = makeMsgSequence(5);
    const tombstone = buildTombstone(omitted, 'Test Thread', config);
    assert.ok(tombstone !== null);
    assert.ok(tombstone.retrievalHints.length > 0);
    assert.ok(
      tombstone.retrievalHints.some((h) => h.includes('search_evidence')),
      'should suggest search_evidence tool',
    );
  });

  it('returns null for empty omitted array', () => {
    const tombstone = buildTombstone([], 'Test', config);
    assert.equal(tombstone, null);
  });
});

// --- formatTombstone Tests ---

describe('F148: formatTombstone', () => {
  it('formats tombstone as compact context string', () => {
    const tombstone = {
      omittedCount: 50,
      timeRange: { from: Date.now() - 3600_000, to: Date.now() - 600_000 },
      participants: ['opus', 'codex'],
      keywords: ['Redis', 'migration'],
      retrievalHints: ['search_evidence("Redis migration")'],
    };

    const text = formatTombstone(tombstone);
    assert.ok(text.includes('50'));
    assert.ok(text.includes('opus'));
    assert.ok(text.includes('Redis'));
    assert.ok(text.includes('search_evidence'));
  });
});

// --- scrubToolPayloads Tests ---

describe('F148: scrubToolPayloads', () => {
  it('preserves last message tool content verbatim', () => {
    resetSeq();
    const base = Date.now();
    const msgs = [
      makeMsg({
        timestamp: base,
        catId: 'opus',
        content: 'Let me search...',
        toolEvents: [{ id: 'te-1', type: 'tool_use', label: 'search_evidence', timestamp: base }],
      }),
      makeMsg({
        timestamp: base + 1000,
        content: 'Tool result: {"rows": 45, "data": "very long payload..."}',
        toolEvents: [{ id: 'te-2', type: 'tool_result', label: 'search_evidence', timestamp: base + 1000 }],
      }),
    ];

    const scrubbed = scrubToolPayloads(msgs);
    // Last message should be unchanged
    assert.equal(scrubbed[scrubbed.length - 1].content, msgs[msgs.length - 1].content);
  });

  it('scrubs earlier messages with tool results', () => {
    resetSeq();
    const base = Date.now();
    const msgs = [
      makeMsg({
        timestamp: base,
        catId: 'opus',
        content: 'Searching...',
        toolEvents: [{ id: 'te-1', type: 'tool_use', label: 'search_evidence', timestamp: base }],
      }),
      makeMsg({
        timestamp: base + 1000,
        content: '{"result": "very long tool output that should be scrubbed"}',
        toolEvents: [{ id: 'te-2', type: 'tool_result', label: 'search_evidence', timestamp: base + 1000 }],
      }),
      makeMsg({ timestamp: base + 2000, catId: null, content: 'Thanks, what about Redis?' }),
      makeMsg({ timestamp: base + 3000, catId: 'opus', content: 'Redis is configured at...' }),
    ];

    const scrubbed = scrubToolPayloads(msgs);
    // Earlier tool_result (index 1) should be scrubbed
    assert.ok(scrubbed[1].content.includes('truncated'), `expected scrubbed content, got: ${scrubbed[1].content}`);
    // Non-tool messages should be unchanged
    assert.equal(scrubbed[2].content, msgs[2].content);
    assert.equal(scrubbed[3].content, msgs[3].content);
  });

  it('leaves non-tool messages untouched', () => {
    resetSeq();
    const msgs = makeMsgSequence(5);
    const scrubbed = scrubToolPayloads(msgs);
    for (let i = 0; i < msgs.length; i++) {
      assert.equal(scrubbed[i].content, msgs[i].content);
    }
  });

  it('handles empty array', () => {
    const scrubbed = scrubToolPayloads([]);
    assert.equal(scrubbed.length, 0);
  });
});

// --- recallEvidence Tests ---

describe('F148: recallEvidence', () => {
  const config = { ...DEFAULT_HIERARCHICAL_CONTEXT };

  /** Mock evidence store */
  function mockEvidenceStore(results) {
    return {
      search: async (query) =>
        results.map((r, i) => ({
          anchor: `ev-${i}`,
          kind: 'thread',
          status: 'active',
          title: r.title,
          summary: r.summary,
          keywords: [],
        })),
      upsert: async () => {},
      deleteByAnchor: async () => {},
      getByAnchor: async () => null,
      health: async () => true,
      initialize: async () => {},
    };
  }

  it('returns formatted evidence from store search', async () => {
    const store = mockEvidenceStore([
      { title: 'Redis Config Decision', summary: 'We decided to use cluster mode' },
      { title: 'Migration Plan', summary: 'Phase 1: data migration' },
    ]);

    resetSeq();
    const recentMsgs = makeMsgSequence(2);
    const results = await recallEvidence(store, 'Redis Thread', 'How do we handle Redis?', recentMsgs, config);
    assert.ok(results.length > 0);
    assert.ok(results.length <= config.maxEvidenceHits);
  });

  it('returns empty array when no evidenceStore', async () => {
    resetSeq();
    const results = await recallEvidence(undefined, 'Thread', 'test', makeMsgSequence(1), config);
    assert.deepEqual(results, []);
  });

  it('returns empty array on timeout (fail-open)', async () => {
    const slowStore = {
      search: async () => {
        await new Promise((r) => setTimeout(r, 2000)); // 2s delay
        return [{ anchor: 'x', kind: 'thread', status: 'active', title: 'X', summary: 'X', keywords: [] }];
      },
      upsert: async () => {},
      deleteByAnchor: async () => {},
      getByAnchor: async () => null,
      health: async () => true,
      initialize: async () => {},
    };

    resetSeq();
    const shortConfig = { ...config, evidenceRecallTimeoutMs: 50 }; // 50ms timeout
    const results = await recallEvidence(slowStore, 'Thread', 'test', makeMsgSequence(1), shortConfig);
    assert.deepEqual(results, []);
  });

  it('returns empty array on store error (fail-open)', async () => {
    const errorStore = {
      search: async () => {
        throw new Error('DB connection failed');
      },
      upsert: async () => {},
      deleteByAnchor: async () => {},
      getByAnchor: async () => null,
      health: async () => true,
      initialize: async () => {},
    };

    resetSeq();
    const results = await recallEvidence(errorStore, 'Thread', 'test', makeMsgSequence(1), config);
    assert.deepEqual(results, []);
  });
});
