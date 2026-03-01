/**
 * GitHub Review mail body classification
 * - Distinguish reviewed vs commented vs environment/setup noise
 * - Extract reviewer label from body when subject lacks action keywords
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('GitHub review mail body classifier', () => {
  test('infers reviewType=reviewed from email body and extracts reviewer', async () => {
    const { inferReviewActionFromEmailSource } = await import(
      '../dist/infrastructure/email/GithubReviewMailParser.js'
    );

    const source = [
      'From: GitHub <notifications@github.com>',
      'Subject: Re: [zts212653/cat-cafe] fix(F045): hardDelete clears thinking (PR #97)',
      '',
      'chatgpt-codex-connector[bot] reviewed (zts212653/cat-cafe#97)',
      "Codex Review: Didn't find any major issues.",
    ].join('\n');

    const result = inferReviewActionFromEmailSource(source);
    assert.equal(result.reviewType, 'reviewed');
    assert.equal(result.reviewer, 'chatgpt-codex-connector[bot]');
  });

  test('infers reviewType=commented from email body', async () => {
    const { inferReviewActionFromEmailSource } = await import(
      '../dist/infrastructure/email/GithubReviewMailParser.js'
    );

    const source = [
      'From: GitHub <notifications@github.com>',
      'Subject: Re: [zts212653/cat-cafe] fix(F039): queue contentBlocks (PR #96)',
      '',
      'chatgpt-codex-connector[bot] left a comment (zts212653/cat-cafe#96)',
    ].join('\n');

    const result = inferReviewActionFromEmailSource(source);
    assert.equal(result.reviewType, 'commented');
    assert.equal(result.reviewer, 'chatgpt-codex-connector[bot]');
  });

  test('infers reviewType=approved from email body', async () => {
    const { inferReviewActionFromEmailSource } = await import(
      '../dist/infrastructure/email/GithubReviewMailParser.js'
    );

    const source = [
      'From: GitHub <notifications@github.com>',
      'Subject: Re: [zts212653/cat-cafe] docs(F048): ghost branch audit (PR #108)',
      '',
      'octocat approved (zts212653/cat-cafe#108)',
    ].join('\n');

    const result = inferReviewActionFromEmailSource(source);
    assert.equal(result.reviewType, 'approved');
    assert.equal(result.reviewer, 'octocat');
  });

  test('infers reviewType=changes_requested from email body', async () => {
    const { inferReviewActionFromEmailSource } = await import(
      '../dist/infrastructure/email/GithubReviewMailParser.js'
    );

    const source = [
      'From: GitHub <notifications@github.com>',
      'Subject: Re: [zts212653/cat-cafe] fix(F039): queue contentBlocks (PR #96)',
      '',
      'octocat requested changes (zts212653/cat-cafe#96)',
    ].join('\n');

    const result = inferReviewActionFromEmailSource(source);
    assert.equal(result.reviewType, 'changes_requested');
    assert.equal(result.reviewer, 'octocat');
  });

  test('detects Codex environment/setup guidance email as ignorable', async () => {
    const { inferReviewActionFromEmailSource } = await import(
      '../dist/infrastructure/email/GithubReviewMailParser.js'
    );

    const source = [
      'From: GitHub <notifications@github.com>',
      'Subject: Re: [zts212653/cat-cafe] fix(F039): queue contentBlocks (PR #96)',
      '',
      'To use Codex here, create an environment for this repo.',
    ].join('\n');

    const result = inferReviewActionFromEmailSource(source);
    assert.equal(result.ignorable, true);
  });
});
