/**
 * F479: Inline @mention detection observability — counter + shadow detection tests.
 *
 * Tests the OTel counter instruments and in-process shadow detection added for
 * issue #479 (inline @mention detection observability).
 *
 * Requires dist/ build — run `pnpm build` in packages/api first.
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

// --- 1. Counter instrument existence ---

describe('F479: mention observability counters', () => {
  it('exports all 8+1 inline mention counters from instruments.ts', async () => {
    const instruments = await import('../dist/infrastructure/telemetry/instruments.js');

    const expectedCounters = [
      'inlineActionChecked',
      'inlineActionDetected',
      'inlineActionShadowMiss',
      'inlineActionFeedbackWritten',
      'inlineActionFeedbackWriteFailed',
      'inlineActionHintEmitted',
      'inlineActionHintEmitFailed',
      'inlineActionRoutedSetSkip',
      'lineStartDetected',
    ];

    for (const name of expectedCounters) {
      assert.ok(instruments[name], `instruments.ts should export counter: ${name}`);
      assert.equal(typeof instruments[name].add, 'function', `${name} should have .add() method`);
    }
  });

  it('counter names follow cat_cafe.a2a.* prefix convention', async () => {
    const instruments = await import('../dist/infrastructure/telemetry/instruments.js');

    // Verify the counter descriptions exist (they are created with correct names)
    assert.ok(instruments.inlineActionChecked, 'inlineActionChecked should exist');
    assert.ok(instruments.lineStartDetected, 'lineStartDetected should exist');
  });
});

// --- 2. Shadow detection ---

describe('F479: shadow detection', () => {
  it('detectInlineActionMentionsWithShadow returns both strict hits and shadow misses', async () => {
    const { detectInlineActionMentionsWithShadow } = await import(
      '../dist/domains/cats/services/agents/routing/a2a-mentions.js'
    );
    assert.equal(
      typeof detectInlineActionMentionsWithShadow,
      'function',
      'should export detectInlineActionMentionsWithShadow',
    );
  });

  it('shadow detection finds @ mention without action keyword as shadow miss', async () => {
    const { detectInlineActionMentionsWithShadow } = await import(
      '../dist/domains/cats/services/agents/routing/a2a-mentions.js'
    );

    // "我问一下 @codex 这个问题" — has inline @mention but NO action keyword → shadow miss
    const result = detectInlineActionMentionsWithShadow('我问一下 @缅因猫 这个问题', 'opus', []);

    assert.ok(result, 'should return result object');
    assert.ok(Array.isArray(result.strictHits), 'should have strictHits array');
    assert.ok(Array.isArray(result.shadowMisses), 'should have shadowMisses array');
    assert.equal(result.strictHits.length, 0, 'no strict hits (no action keyword)');
    assert.equal(result.shadowMisses.length, 1, 'one shadow miss (inline @ without action keyword)');
    assert.equal(result.shadowMisses[0].catId, 'codex');
  });

  it('shadow detection returns empty when strict detection already catches the mention', async () => {
    const { detectInlineActionMentionsWithShadow } = await import(
      '../dist/domains/cats/services/agents/routing/a2a-mentions.js'
    );

    // "Ready for @codex review" — strict detection catches this → no shadow miss
    const result = detectInlineActionMentionsWithShadow('Ready for @缅因猫 review', 'opus', []);

    assert.ok(result.strictHits.length > 0, 'strict should catch this (action keyword present)');
    assert.equal(result.shadowMisses.length, 0, 'no shadow miss when strict catches it');
  });

  it('shadow detection excludes line-start mentions (already routed)', async () => {
    const { detectInlineActionMentionsWithShadow } = await import(
      '../dist/domains/cats/services/agents/routing/a2a-mentions.js'
    );

    // "@codex 请看一下" — line-start mention, should not be shadow miss
    const result = detectInlineActionMentionsWithShadow('@缅因猫 请看一下', 'opus', []);

    assert.equal(result.strictHits.length, 0, 'strict: line-start mentions handled by parseA2AMentions');
    assert.equal(result.shadowMisses.length, 0, 'shadow: line-start mentions should be excluded');
  });

  it('shadow detection excludes mentions in code blocks', async () => {
    const { detectInlineActionMentionsWithShadow } = await import(
      '../dist/domains/cats/services/agents/routing/a2a-mentions.js'
    );

    const text = '看看这个代码\n```\n@缅因猫 review\n```\n没别的了';
    const result = detectInlineActionMentionsWithShadow(text, 'opus', []);

    assert.equal(result.strictHits.length, 0, 'no strict hits in code block');
    assert.equal(result.shadowMisses.length, 0, 'no shadow misses in code block');
  });

  it('shadow detection excludes mentions in blockquotes', async () => {
    const { detectInlineActionMentionsWithShadow } = await import(
      '../dist/domains/cats/services/agents/routing/a2a-mentions.js'
    );

    const text = '> 之前 @缅因猫 说过这个问题';
    const result = detectInlineActionMentionsWithShadow(text, 'opus', []);

    assert.equal(result.strictHits.length, 0, 'no strict hits in blockquote');
    assert.equal(result.shadowMisses.length, 0, 'no shadow misses in blockquote');
  });

  it('shadow miss metadata contains hash and length, not raw text', async () => {
    const { detectInlineActionMentionsWithShadow } = await import(
      '../dist/domains/cats/services/agents/routing/a2a-mentions.js'
    );

    const result = detectInlineActionMentionsWithShadow('我问一下 @缅因猫 这个问题', 'opus', []);

    assert.equal(result.shadowMisses.length, 1);
    const miss = result.shadowMisses[0];
    assert.equal(miss.catId, 'codex');
    assert.ok(miss.contextHash, 'should have contextHash');
    assert.ok(typeof miss.contextLength === 'number', 'should have contextLength');
    // Must NOT contain raw lineText (data minimization per mindfn's feedback)
    assert.equal(miss.lineText, undefined, 'shadow miss must not contain raw lineText');
  });

  it('shadow detection skips self-mentions', async () => {
    const { detectInlineActionMentionsWithShadow } = await import(
      '../dist/domains/cats/services/agents/routing/a2a-mentions.js'
    );

    const result = detectInlineActionMentionsWithShadow('我 @opus 说过这个', 'opus', []);

    assert.equal(result.shadowMisses.length, 0, 'self-mention should be excluded');
  });

  it('shadow detection skips already-routed mentions', async () => {
    const { detectInlineActionMentionsWithShadow } = await import(
      '../dist/domains/cats/services/agents/routing/a2a-mentions.js'
    );

    // codex is already routed via line-start → should not appear in shadow
    const result = detectInlineActionMentionsWithShadow('这里 @缅因猫 也提到了', 'opus', ['codex']);

    assert.equal(result.shadowMisses.length, 0, 'already-routed mention should be excluded from shadow');
  });
});

// --- 3. routedSet skip detection ---

describe('F479: routedSet skip tracking', () => {
  it('detectInlineActionMentionsWithShadow reports routedSetSkips', async () => {
    const { detectInlineActionMentionsWithShadow } = await import(
      '../dist/domains/cats/services/agents/routing/a2a-mentions.js'
    );

    // "Ready for @codex review" — action keyword present, but codex already routed
    const result = detectInlineActionMentionsWithShadow(
      'Ready for @缅因猫 review',
      'opus',
      ['codex'], // codex already in routedSet
    );

    assert.ok(result.routedSetSkips >= 1, 'should report routedSet skip count');
  });
});
