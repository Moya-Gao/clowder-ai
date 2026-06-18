/**
 * F233 PR3 — production route wiring guards.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

describe('F233 PR3: production route wiring', () => {
  test('messagesRoutes receives ballCustody ingest for zombie reconciliation events', () => {
    const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    const start = source.indexOf('const messagesOpts = {');
    const end = source.indexOf('await app.register(messagesRoutes, messagesOpts);', start);

    assert.notEqual(start, -1, 'index.ts must define messagesOpts');
    assert.notEqual(end, -1, 'index.ts must register messagesRoutes with messagesOpts');

    const messagesOptsBlock = source.slice(start, end);
    assert.match(
      messagesOptsBlock,
      /ballCustodyIngest[\s\S]{0,120}\{\s*ballCustody:\s*ballCustodyIngest\s*\}/,
      'messagesOpts must pass ballCustodyIngest into messagesRoutes',
    );
  });
});
