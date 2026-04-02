// @ts-check
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

const { formatContextBriefing, buildBriefingMessage } = await import(
  '../dist/domains/cats/services/agents/routing/format-briefing.js'
);

describe('F148 Phase E: formatContextBriefing (AC-E3 + AC-E4)', () => {
  test('returns summary with all counts (AC-E3)', () => {
    const coverageMap = {
      omitted: {
        count: 22,
        timeRange: { from: 1712000000000, to: 1712003600000 },
        participants: ['opus', 'codex'],
      },
      burst: { count: 8, timeRange: { from: 1712003600000, to: 1712004000000 } },
      anchorIds: ['a1', 'a2', 'a3'],
      threadMemory: { available: true, sessionsIncorporated: 5 },
      retrievalHints: ['search_evidence("redis")'],
    };
    const result = formatContextBriefing(coverageMap);
    // One-line summary must include key counts
    assert.ok(result.summary.includes('8'), 'summary should include burst count (看到)');
    assert.ok(result.summary.includes('22'), 'summary should include omitted count (省略)');
    assert.ok(result.summary.includes('3'), 'summary should include anchor count');
    assert.ok(result.summary.includes('5'), 'summary should include session count');
    // Rich block
    assert.equal(result.richBlock.type, 'context-briefing');
    assert.deepEqual(result.richBlock.coverageMap, coverageMap);
  });

  test('handles zero omitted gracefully', () => {
    const coverageMap = {
      omitted: { count: 0, timeRange: { from: 0, to: 0 }, participants: [] },
      burst: { count: 5, timeRange: { from: 1712003600000, to: 1712004000000 } },
      anchorIds: [],
      threadMemory: null,
      retrievalHints: [],
    };
    const result = formatContextBriefing(coverageMap);
    assert.ok(result.summary.includes('5'), 'burst count present');
    assert.ok(result.summary.includes('0'), 'omitted count present');
    assert.strictEqual(result.richBlock.threadMemorySummary, undefined);
  });

  test('includes threadMemorySummary when provided', () => {
    const coverageMap = {
      omitted: { count: 10, timeRange: { from: 1712000000000, to: 1712003600000 }, participants: ['opus'] },
      burst: { count: 4, timeRange: { from: 1712003600000, to: 1712004000000 } },
      anchorIds: ['a1'],
      threadMemory: { available: true, sessionsIncorporated: 3 },
      retrievalHints: [],
    };
    const threadMemorySummary = 'Session #1: Created routes.ts. Modified index.ts.';
    const result = formatContextBriefing(coverageMap, threadMemorySummary);
    assert.equal(result.richBlock.threadMemorySummary, threadMemorySummary);
  });

  test('includes anchorSummaries when provided', () => {
    const coverageMap = {
      omitted: { count: 15, timeRange: { from: 1712000000000, to: 1712003600000 }, participants: ['opus'] },
      burst: { count: 6, timeRange: { from: 1712003600000, to: 1712004000000 } },
      anchorIds: ['a1', 'a2'],
      threadMemory: null,
      retrievalHints: [],
    };
    const anchorSummaries = ['[Thread opener] discussed Redis config', '[Anchor] decided on cluster mode'];
    const result = formatContextBriefing(coverageMap, undefined, anchorSummaries);
    assert.deepEqual(result.richBlock.anchorSummaries, anchorSummaries);
  });

  test('summary includes evidence count from retrievalHints', () => {
    const coverageMap = {
      omitted: { count: 20, timeRange: { from: 1712000000000, to: 1712003600000 }, participants: [] },
      burst: { count: 4, timeRange: { from: 1712003600000, to: 1712004000000 } },
      anchorIds: [],
      threadMemory: null,
      retrievalHints: ['search_evidence("redis")', 'search_evidence("deploy")'],
    };
    const result = formatContextBriefing(coverageMap);
    assert.ok(result.summary.includes('2'), 'summary should include evidence/hint count');
  });
});

describe('F148 Phase E: buildBriefingMessage (AC-E1)', () => {
  const baseCoverageMap = {
    omitted: {
      count: 22,
      timeRange: { from: 1712000000000, to: 1712003600000 },
      participants: ['opus', 'codex'],
    },
    burst: { count: 8, timeRange: { from: 1712003600000, to: 1712004000000 } },
    anchorIds: ['a1', 'a2', 'a3'],
    threadMemory: { available: true, sessionsIncorporated: 5 },
    retrievalHints: ['search_evidence("redis")'],
  };

  test('returns AppendMessageInput with origin=briefing', () => {
    const msg = buildBriefingMessage(baseCoverageMap, 'thread-1');
    assert.equal(msg.origin, 'briefing', 'must have origin=briefing');
    assert.equal(msg.catId, null, 'briefing is system-generated, catId=null');
    assert.equal(msg.userId, 'system', 'userId should be system');
    assert.equal(msg.threadId, 'thread-1');
    assert.ok(msg.content.includes('看到'), 'content is the one-line summary');
    assert.ok(msg.content.includes('省略'), 'content includes omitted count');
  });

  test('has rich block with card kind', () => {
    const msg = buildBriefingMessage(baseCoverageMap, 'thread-1');
    assert.ok(msg.extra?.rich?.blocks?.length > 0, 'should have rich blocks');
    const card = msg.extra.rich.blocks[0];
    assert.equal(card.kind, 'card', 'rich block should be a card');
    assert.equal(card.tone, 'info', 'should use info tone');
    assert.ok(card.title.includes('看到'), 'card title should be the summary');
  });

  test('card bodyMarkdown includes expanded details when threadMemory provided', () => {
    const msg = buildBriefingMessage(baseCoverageMap, 'thread-1', {
      threadMemorySummary: 'Session #1: Created routes.ts.',
    });
    const card = msg.extra.rich.blocks[0];
    assert.ok(card.bodyMarkdown, 'should have bodyMarkdown');
    assert.ok(card.bodyMarkdown.includes('opus'), 'participants in body');
    assert.ok(card.bodyMarkdown.includes('Session #1'), 'threadMemory in body');
  });

  test('card fields include coverage data', () => {
    const msg = buildBriefingMessage(baseCoverageMap, 'thread-1');
    const card = msg.extra.rich.blocks[0];
    assert.ok(card.fields?.length > 0, 'should have fields');
    // Check key fields exist
    const labels = card.fields.map((f) => f.label);
    assert.ok(labels.some((l) => l.includes('参与者') || l.includes('Participants')));
  });
});
