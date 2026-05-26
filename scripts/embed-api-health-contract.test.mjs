import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

test('embed-api health exposes memory and request counters', () => {
  const source = readFileSync(resolve('scripts/embed-api.py'), 'utf8');

  assert.match(source, /_request_count/);
  assert.match(source, /_last_embed_ms/);
  assert.match(source, /max_rss_bytes/);
  assert.match(source, /uptime_seconds/);
});
