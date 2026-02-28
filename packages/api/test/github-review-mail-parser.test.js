// @ts-check
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseGithubReviewSubject,
  extractCatFromTitle,
  catTagToCatId,
  isGithubNotification,
} from '../dist/infrastructure/email/GithubReviewMailParser.js';

describe('parseGithubReviewSubject', () => {
  it('parses review with approval', () => {
    const subject = '[zts212653/cat-cafe] @codex-bot approved pull request #42: [布偶猫🐾] feat(audit): add timestamps';
    const result = parseGithubReviewSubject(subject);

    assert.ok(result);
    assert.strictEqual(result.prNumber, 42);
    assert.strictEqual(result.repository, 'zts212653/cat-cafe');
    assert.strictEqual(result.reviewType, 'approved');
    assert.strictEqual(result.reviewer, 'codex-bot');
    assert.strictEqual(result.title, '[布偶猫🐾] feat(audit): add timestamps');
  });

  it('parses review with changes requested', () => {
    const subject =
      '[zts212653/cat-cafe] @codex-bot requested changes on pull request #24: [缅因猫🐾] fix: typo';
    const result = parseGithubReviewSubject(subject);

    assert.ok(result);
    assert.strictEqual(result.prNumber, 24);
    assert.strictEqual(result.reviewType, 'changes_requested');
    assert.strictEqual(result.reviewer, 'codex-bot');
  });

  it('parses comment notification', () => {
    const subject = '[zts212653/cat-cafe] @user123 commented on pull request #99: [暹罗猫🐾] design: new UI';
    const result = parseGithubReviewSubject(subject);

    assert.ok(result);
    assert.strictEqual(result.prNumber, 99);
    assert.strictEqual(result.reviewType, 'commented');
    assert.strictEqual(result.reviewer, 'user123');
  });

  it('rejects generic Re: reply without pull request keyword', () => {
    const subject = 'Re: [owner/repo] Some PR Title (#123)';
    const result = parseGithubReviewSubject(subject);

    assert.strictEqual(result, null, 'Re: alone is not enough — could be issue reply');
  });

  it('parses reply to pull request notification', () => {
    const subject = 'Re: [owner/repo] @user commented on pull request #456: Some PR Title';
    const result = parseGithubReviewSubject(subject);

    assert.ok(result);
    assert.strictEqual(result.prNumber, 456);
    assert.strictEqual(result.repository, 'owner/repo');
  });

  it('returns null for non-PR email', () => {
    const subject = 'Regular email without PR number';
    const result = parseGithubReviewSubject(subject);

    assert.strictEqual(result, null);
  });

  it('returns null for missing repository', () => {
    const subject = 'Some subject with #123 but no repo brackets';
    const result = parseGithubReviewSubject(subject);

    assert.strictEqual(result, null);
  });

  // Cloud Codex P1-6: reject non-review GitHub traffic
  it('rejects issue notification', () => {
    const subject = '[owner/repo] Issue: flaky test (#123)';
    const result = parseGithubReviewSubject(subject);
    assert.strictEqual(result, null, 'should reject issue notification');
  });

  it('rejects PR opened notification (no review action)', () => {
    const subject = '[owner/repo] New feature (#42)';
    const result = parseGithubReviewSubject(subject);
    assert.strictEqual(result, null, 'should reject plain PR notification without review action');
  });

  it('rejects Re: reply to issue thread', () => {
    const subject = 'Re: [owner/repo] Issue: flaky test (#123)';
    const result = parseGithubReviewSubject(subject);
    assert.strictEqual(result, null, 'Re: issue reply must be rejected');
  });

  // Cloud Codex P2-1: PR number must come from (#N) at end or "pull request #N", not first #token
  it('extracts PR number from trailing (#N), not issue ref in title', () => {
    const subject = '[owner/repo] @user commented on pull request #42: fix #11 race condition';
    const result = parseGithubReviewSubject(subject);

    assert.ok(result);
    assert.strictEqual(result.prNumber, 42, 'should extract PR number 42 from "pull request #42", not 11 from "#11"');
  });

  it('extracts PR number from "pull request #N" over title refs', () => {
    const subject = '[owner/repo] @user commented on pull request #99: fix #7 race';
    const result = parseGithubReviewSubject(subject);

    assert.ok(result);
    assert.strictEqual(result.prNumber, 99, 'should extract 99 from "pull request #99", not 7 from "#7"');
  });
});

describe('extractCatFromTitle', () => {
  it('extracts 布偶猫', () => {
    assert.strictEqual(extractCatFromTitle('[布偶猫🐾] feat: something'), '布偶猫');
  });

  it('extracts 缅因猫', () => {
    assert.strictEqual(extractCatFromTitle('[缅因猫🐾] fix: bug'), '缅因猫');
  });

  it('extracts 暹罗猫', () => {
    assert.strictEqual(extractCatFromTitle('[暹罗猫🐾] design: UI'), '暹罗猫');
  });

  it('returns null for missing cat tag', () => {
    assert.strictEqual(extractCatFromTitle('feat: no cat here'), null);
  });

  it('returns null for incomplete tag', () => {
    assert.strictEqual(extractCatFromTitle('[布偶猫] missing emoji'), null);
  });

  // ── Nickname signature formats (CLAUDE.md 签名规范) ──

  it('extracts 布偶猫 from [宪宪/Opus-46🐾]', () => {
    assert.strictEqual(extractCatFromTitle('fix(F39): bugfix [宪宪/Opus-46🐾]'), '布偶猫');
  });

  it('extracts 布偶猫 from [宪宪/Opus-45🐾]', () => {
    assert.strictEqual(extractCatFromTitle('feat: something [宪宪/Opus-45🐾]'), '布偶猫');
  });

  it('extracts 布偶猫 from [宪宪/Sonnet🐾]', () => {
    assert.strictEqual(extractCatFromTitle('fix: thing [宪宪/Sonnet🐾]'), '布偶猫');
  });

  it('extracts 缅因猫 from [砚砚/Codex🐾]', () => {
    assert.strictEqual(extractCatFromTitle('review: code [砚砚/Codex🐾]'), '缅因猫');
  });

  it('extracts 缅因猫 from [砚砚/GPT-52🐾]', () => {
    assert.strictEqual(extractCatFromTitle('fix: test [砚砚/GPT-52🐾]'), '缅因猫');
  });

  it('extracts 缅因猫 from [Spark🐾]', () => {
    assert.strictEqual(extractCatFromTitle('feat: spark thing [Spark🐾]'), '缅因猫');
  });

  it('extracts 暹罗猫 from [烁烁🐾]', () => {
    assert.strictEqual(extractCatFromTitle('design: new UI [烁烁🐾]'), '暹罗猫');
  });
});

describe('catTagToCatId', () => {
  it('maps 布偶猫 to opus', () => {
    assert.strictEqual(catTagToCatId('布偶猫'), 'opus');
  });

  it('maps 缅因猫 to codex', () => {
    assert.strictEqual(catTagToCatId('缅因猫'), 'codex');
  });

  it('maps 暹罗猫 to gemini', () => {
    assert.strictEqual(catTagToCatId('暹罗猫'), 'gemini');
  });
});

describe('isGithubNotification', () => {
  it('recognizes notifications@github.com', () => {
    assert.strictEqual(isGithubNotification('notifications@github.com'), true);
  });

  it('recognizes noreply@github.com', () => {
    assert.strictEqual(isGithubNotification('noreply@github.com'), true);
  });

  it('rejects other emails', () => {
    assert.strictEqual(isGithubNotification('someone@example.com'), false);
  });

  it('handles email with name prefix', () => {
    assert.strictEqual(isGithubNotification('GitHub <notifications@github.com>'), true);
  });

  // Cloud Codex P2-2: reject spoofed sender addresses
  it('rejects spoofed sender with github domain as substring', () => {
    assert.strictEqual(isGithubNotification('attacker+notifications@github.com.evil'), false);
  });

  it('rejects similar but non-github domain', () => {
    assert.strictEqual(isGithubNotification('notifications@github.com.attacker.com'), false);
  });

  it('accepts bare notifications@ address', () => {
    assert.strictEqual(isGithubNotification('notifications@github.com'), true);
  });

  it('accepts bare noreply@ address', () => {
    assert.strictEqual(isGithubNotification('noreply@github.com'), true);
  });
});
