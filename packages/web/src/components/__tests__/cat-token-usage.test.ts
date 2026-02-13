/**
 * F8: CatTokenUsage component tests.
 * Verifies adaptive per-cat token usage display.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { CatTokenUsage } from '../CatTokenUsage';

function render(catId: string, usage: Parameters<typeof CatTokenUsage>[0]['usage']): string {
  return renderToStaticMarkup(React.createElement(CatTokenUsage, { catId, usage }));
}

describe('F8: CatTokenUsage', () => {
  it('renders nothing when usage has no token fields', () => {
    const html = render('opus', {});
    expect(html).toBe('');
  });

  it('renders full detail for opus-style usage (input/output/cache/cost)', () => {
    const html = render('opus', {
      inputTokens: 39270,
      outputTokens: 9938,
      cacheReadTokens: 33000,
      costUsd: 0.17,
    });

    expect(html).toContain('In:');
    expect(html).toContain('39.3k');
    expect(html).toContain('cached 84%');
    expect(html).toContain('Out:');
    expect(html).toContain('9.9k');
    expect(html).toContain('Cost:');
    expect(html).toContain('$0.17');
  });

  it('renders codex-style usage without cost', () => {
    const html = render('codex', {
      inputTokens: 2000,
      outputTokens: 800,
      cacheReadTokens: 1500,
    });

    expect(html).toContain('In:');
    expect(html).toContain('2.0k');
    expect(html).toContain('cached 75%');
    expect(html).toContain('Out:');
    expect(html).toContain('800');
    expect(html).not.toContain('Cost:');
  });

  it('renders gemini-style usage with totalTokens only', () => {
    const html = render('gemini', { totalTokens: 1500 });

    expect(html).toContain('Tokens:');
    expect(html).toContain('1.5k');
    expect(html).not.toContain('In:');
    expect(html).not.toContain('Out:');
  });

  it('shows turns only when > 1', () => {
    const html1 = render('opus', { inputTokens: 1000, numTurns: 1 });
    expect(html1).not.toContain('Turns:');

    const html2 = render('codex', { inputTokens: 1000, numTurns: 3 });
    expect(html2).toContain('Turns:');
    expect(html2).toContain('3');
  });

  it('shows time with API and total duration', () => {
    const html = render('opus', {
      inputTokens: 1000,
      durationApiMs: 3900,
      durationMs: 4900,
    });

    expect(html).toContain('Time:');
    expect(html).toContain('3.9s');
    expect(html).toContain('4.9s');
  });

  it('has correct data-testid attribute', () => {
    const html = render('opus', { inputTokens: 500 });
    expect(html).toContain('data-testid="token-usage-opus"');
  });
});
