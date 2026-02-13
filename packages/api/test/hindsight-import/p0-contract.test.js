import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertUniqueP0DocumentIds,
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

test('assertUniqueP0DocumentIds rejects duplicate ADR ids', () => {
  assert.throws(
    () => assertUniqueP0DocumentIds([
      'docs/decisions/009-cat-cafe-skills-distribution.md',
      'docs/decisions/009-directory-hygiene-anti-rot.md',
    ]),
    /duplicate document_id adr:009/,
  );
});
