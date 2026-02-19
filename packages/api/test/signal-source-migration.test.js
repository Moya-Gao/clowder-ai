import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { mergeSources } = await import('../dist/scripts/migrate-signals/source-migration.js');

function createSource(id, url) {
  return {
    id,
    name: id,
    url,
    tier: 2,
    category: 'research',
    enabled: true,
    fetch: { method: 'rss' },
    schedule: { frequency: 'daily' },
  };
}

describe('mergeSources', () => {
  it('does not merge distinct urls that differ by query string', () => {
    const base = { version: 1, sources: [] };
    const incoming = [
      createSource('source-a', 'https://example.com/feed?tag=agent'),
      createSource('source-b', 'https://example.com/feed?tag=safety'),
    ];

    const result = mergeSources(base, incoming);

    assert.equal(result.config.sources.length, 2);
    assert.equal(result.idRemap.get('source-a'), 'source-a');
    assert.equal(result.idRemap.get('source-b'), 'source-b');
  });

  it('still merges exact duplicate urls', () => {
    const base = { version: 1, sources: [createSource('existing', 'https://example.com/feed?tag=agent')] };
    const incoming = [createSource('incoming', 'https://example.com/feed?tag=agent')];

    const result = mergeSources(base, incoming);

    assert.equal(result.config.sources.length, 1);
    assert.equal(result.idRemap.get('incoming'), 'existing');
  });
});
