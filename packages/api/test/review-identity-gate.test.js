import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('review-identity-gate', () => {
  async function getModule() {
    return import('../dist/domains/cats/services/collaboration/review-identity-gate.js');
  }

  it('requires identity gate for same-family review request', async () => {
    const { shouldRequireReviewIdentityGate } = await getModule();
    const required = shouldRequireReviewIdentityGate({
      fromCatId: 'codex',
      toCatId: 'gpt52',
      message: '@gpt52 请 review 这次改动',
    });
    assert.equal(required, true);
  });

  it('does not require identity gate for cross-family review request', async () => {
    const { shouldRequireReviewIdentityGate } = await getModule();
    const required = shouldRequireReviewIdentityGate({
      fromCatId: 'codex',
      toCatId: 'opus',
      message: '@opus 请 review 这次改动',
    });
    assert.equal(required, false);
  });

  it('does not require identity gate for non-review messages', async () => {
    const { shouldRequireReviewIdentityGate } = await getModule();
    const required = shouldRequireReviewIdentityGate({
      fromCatId: 'codex',
      toCatId: 'gpt52',
      message: '@gpt52 帮我看下这个架构方向',
    });
    assert.equal(required, false);
  });

  it('accepts valid identity handshake line', async () => {
    const { validateReviewIdentityHandshake } = await getModule();
    const result = validateReviewIdentityHandshake(
      'Identity Check: 我是 缅因猫/砚砚 (@gpt52, model=gpt-5.2)\n\n下面是 review 结论',
      'gpt52',
    );
    assert.equal(result.valid, true);
  });

  it('rejects response when handshake line is missing', async () => {
    const { validateReviewIdentityHandshake } = await getModule();
    const result = validateReviewIdentityHandshake('下面是 review 结论', 'gpt52');
    assert.equal(result.valid, false);
    assert.match(result.reason ?? '', /identity check/i);
  });

  it('rejects response when handshake handle mismatches reviewer', async () => {
    const { validateReviewIdentityHandshake } = await getModule();
    const result = validateReviewIdentityHandshake(
      'Identity Check: 我是 缅因猫/砚砚 (@codex, model=gpt-5.3-codex)\n\nreview',
      'gpt52',
    );
    assert.equal(result.valid, false);
    assert.match(result.reason ?? '', /@gpt52/i);
  });

  it('rejects response when handshake only contains prefixed handle token', async () => {
    const { validateReviewIdentityHandshake } = await getModule();
    const result = validateReviewIdentityHandshake(
      'Identity Check: 我是 缅因猫/砚砚 (@gpt52x, model=gpt-5.2)\n\nreview',
      'gpt52',
    );
    assert.equal(result.valid, false);
    assert.match(result.reason ?? '', /@gpt52/i);
  });
});
