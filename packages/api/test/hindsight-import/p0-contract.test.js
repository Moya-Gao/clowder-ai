import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildP0DocumentId,
  validateP0Tags,
} from '../../dist/domains/cats/services/hindsight-import/p0-contract.js';

test('buildP0DocumentId derives stable ids for ADR paths', () => {
  assert.equal(
    buildP0DocumentId('docs/decisions/005-hindsight-integration-decisions.md'),
    'adr:005',
  );
});

test('buildP0DocumentId falls back to path-based id for non-ADR source', () => {
  assert.equal(buildP0DocumentId('docs/lessons-learned.md'), 'path:docs/lessons-learned.md');
});

test('validateP0Tags rejects missing required governance tags', () => {
  assert.throws(() => validateP0Tags(['project:cat-cafe']), /missing required tag prefix: kind:/);
});
