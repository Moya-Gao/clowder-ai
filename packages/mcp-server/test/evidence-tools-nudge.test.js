/**
 * search_evidence Payload Nudge Tests — F188 Phase F (AC-F3 + KD-7)
 *
 * Verifies deterministic nudge emission on no_match and low_hit, NO nudge
 * when high/mid doc anchors are present.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

describe('search_evidence nudge (AC-F3 + KD-7)', () => {
  let originalEnv;
  let originalFetch;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.CAT_CAFE_API_URL = 'http://127.0.0.1:3002';
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    globalThis.fetch = originalFetch;
  });

  test('no_match (zero results) emits navigation nudge with graph_resolve + list_recent', async () => {
    const { handleSearchEvidence } = await import('../dist/tools/evidence-tools.js');
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ degraded: false, results: [] }),
    });
    const result = await handleSearchEvidence({ query: 'nonsense gibberish' });
    const text = result.content[0].text;
    assert.ok(text.includes('No results found for: nonsense gibberish'));
    assert.ok(text.includes('Memory navigation'));
    assert.ok(text.includes('cat_cafe_graph_resolve'), 'nudge mentions graph_resolve');
    assert.ok(text.includes('cat_cafe_list_recent'), 'nudge mentions list_recent');
  });

  test('low_hit (no high/mid doc anchors) emits nudge despite having results', async () => {
    const { handleSearchEvidence } = await import('../dist/tools/evidence-tools.js');
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        degraded: false,
        results: [
          // Only low-confidence and non-doc sourceType — should trigger nudge
          { title: 'Random msg', anchor: 'thread-x:1', snippet: 'unrelated', confidence: 'low', sourceType: 'thread' },
        ],
      }),
    });
    const result = await handleSearchEvidence({ query: 'F186' });
    const text = result.content[0].text;
    assert.ok(text.includes('Memory navigation'), 'low-hit must emit nudge');
    assert.ok(text.includes('graph_resolve'));
  });

  test('high-confidence doc anchor present → NO nudge (would be noise)', async () => {
    const { handleSearchEvidence } = await import('../dist/tools/evidence-tools.js');
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        degraded: false,
        results: [
          {
            title: 'F102: Memory System',
            anchor: 'F102',
            snippet: 'core',
            confidence: 'high',
            sourceType: 'feature',
          },
        ],
      }),
    });
    const result = await handleSearchEvidence({ query: 'F102' });
    const text = result.content[0].text;
    assert.ok(!text.includes('Memory navigation —'), 'high-confidence hit must NOT emit nudge');
    // But the existing "高置信度文档命中" Read-reminder hook should still appear
    assert.ok(text.includes('高置信度文档命中'));
  });

  test('mid-confidence doc anchor → NO nudge (still relevant doc match)', async () => {
    const { handleSearchEvidence } = await import('../dist/tools/evidence-tools.js');
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        degraded: false,
        results: [
          {
            title: 'ADR-019',
            anchor: 'docs/decisions/019',
            snippet: 'related',
            confidence: 'mid',
            sourceType: 'decision',
          },
        ],
      }),
    });
    const result = await handleSearchEvidence({ query: 'hooks' });
    const text = result.content[0].text;
    assert.ok(!text.includes('Memory navigation —'), 'mid-confidence doc hit must NOT emit nudge');
  });

  test('mixed low-confidence non-doc results → emit nudge (low-hit)', async () => {
    const { handleSearchEvidence } = await import('../dist/tools/evidence-tools.js');
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        degraded: false,
        results: [
          { title: 'thread msg', anchor: 'tx:1', snippet: '...', confidence: 'low', sourceType: 'thread' },
          { title: 'session', anchor: 'sx:1', snippet: '...', confidence: 'mid', sourceType: 'discussion' },
        ],
      }),
    });
    const result = await handleSearchEvidence({ query: 'whatever' });
    const text = result.content[0].text;
    assert.ok(text.includes('Memory navigation'), 'no DOC sourceType in high/mid → nudge fires');
  });
});
