/**
 * Evidence Search Route Tests
 * Covers: normal return, default tagsMatch, degraded fallback, limit validation.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evidenceRoutes } from '../dist/routes/evidence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Create a mock HindsightClient */
function createMockClient(overrides = {}) {
  return {
    recall: async () => [],
    retain: async () => {},
    reflect: async () => '',
    ensureBank: async () => {},
    isHealthy: async () => true,
    ...overrides,
  };
}

describe('GET /api/evidence/search', () => {
  let app;

  async function setup(clientOverrides = {}, docsRoot) {
    app = Fastify();
    const hindsightClient = createMockClient(clientOverrides);
    await app.register(evidenceRoutes, {
      hindsightClient,
      sharedBank: 'cat-cafe-shared',
      ...(docsRoot ? { docsRoot } : {}),
    });
    await app.ready();
  }

  it('returns results from Hindsight', async () => {
    await setup({
      recall: async () => [
        {
          content: 'ADR-005 decided single bank strategy for Hindsight integration',
          metadata: { anchor: 'docs/decisions/005-hindsight.md', author: 'opus' },
          score: 0.92,
        },
        {
          content: 'Phase 4 completed with 460 tests',
          metadata: { anchor: 'docs/phases/phase-4.0-direction.md' },
          score: 0.75,
        },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=hindsight+bank',
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.degraded, false);
    assert.equal(body.results.length, 2);
    assert.equal(body.results[0].sourceType, 'decision');
    assert.equal(body.results[0].confidence, 'high');
    assert.equal(body.results[1].sourceType, 'phase');
    assert.equal(body.results[1].confidence, 'mid');
  });

  it('passes default tagsMatch=all_strict to Hindsight', async () => {
    let capturedOptions;
    await setup({
      recall: async (_bank, _query, options) => {
        capturedOptions = options;
        return [];
      },
    });

    await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=test',
    });

    assert.equal(capturedOptions.tagsMatch, 'all_strict');
    assert.deepEqual(capturedOptions.tags, ['project:cat-cafe']);
    assert.equal(capturedOptions.budget, 'mid');
    assert.equal(capturedOptions.limit, 5);
  });

  it('passes custom parameters to Hindsight', async () => {
    let capturedOptions;
    await setup({
      recall: async (_bank, _query, options) => {
        capturedOptions = options;
        return [];
      },
    });

    await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=test&limit=10&budget=high&tagsMatch=any',
    });

    assert.equal(capturedOptions.limit, 10);
    assert.equal(capturedOptions.budget, 'high');
    assert.equal(capturedOptions.tagsMatch, 'any');
  });

  it('splits comma-separated tags from query into strict tag array', async () => {
    let capturedOptions;
    await setup({
      recall: async (_bank, _query, options) => {
        capturedOptions = options;
        return [];
      },
    });

    await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=test&tags=project:cat-cafe,kind:decision',
    });

    assert.deepEqual(capturedOptions.tags, ['project:cat-cafe', 'kind:decision']);
    assert.equal(capturedOptions.tagsMatch, 'all_strict');
  });

  it('degrades when Hindsight is unavailable', async () => {
    // Use project docs/ as fallback
    const docsRoot = join(__dirname, '..', '..', '..', 'docs');
    await setup(
      { recall: async () => { throw new Error('ECONNREFUSED'); } },
      docsRoot,
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=phase',
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.degraded, true);
    assert.equal(body.degradeReason, 'hindsight_unavailable_fallback_docs_search');
    // Should find at least some docs with "phase" in them
    assert.ok(body.results.length > 0, 'degraded search should find docs');
  });

  it('returns 502 when Hindsight fails with non-availability error', async () => {
    await setup({
      recall: async () => {
        throw new Error('invalid response schema');
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=phase',
    });

    assert.equal(res.statusCode, 502);
    const body = res.json();
    assert.equal(body.error, 'Evidence search unavailable');
    assert.equal(body.degraded, false);
  });

  it('returns 400 for missing q parameter', async () => {
    await setup();

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search',
    });

    assert.equal(res.statusCode, 400);
  });

  it('returns 400 for limit out of range', async () => {
    await setup();

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=test&limit=50',
    });

    assert.equal(res.statusCode, 400);
  });

  it('returns 400 for limit=0', async () => {
    await setup();

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=test&limit=0',
    });

    assert.equal(res.statusCode, 400);
  });

  it('returns empty results for no matches', async () => {
    await setup({ recall: async () => [] });

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=nonexistent_topic_xyz',
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.degraded, false);
    assert.equal(body.results.length, 0);
  });

  it('respects limit parameter', async () => {
    await setup({
      recall: async (_b, _q, opts) => {
        // Return as many as limit allows
        return Array.from({ length: opts.limit }, (_, i) => ({
          content: `Memory ${i}`,
          score: 0.9 - i * 0.1,
        }));
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=test&limit=3',
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.results.length, 3);
  });

  it('degraded search classifies source types correctly', async () => {
    const docsRoot = join(__dirname, '..', '..', '..', 'docs');
    await setup(
      { recall: async () => { throw new Error('ECONNREFUSED'); } },
      docsRoot,
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=hindsight&limit=20',
    });

    const body = res.json();
    assert.equal(body.degraded, true);

    // Check source type classification
    for (const r of body.results) {
      assert.ok(
        ['decision', 'phase', 'discussion', 'commit'].includes(r.sourceType),
        `Invalid sourceType: ${r.sourceType}`,
      );
      if (r.anchor.includes('decisions')) assert.equal(r.sourceType, 'decision');
      if (r.anchor.includes('phases')) assert.equal(r.sourceType, 'phase');
    }
  });
});
