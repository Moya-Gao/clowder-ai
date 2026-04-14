/**
 * AC-C4: SVG Security Whitelist tests.
 *
 * Verifies that the sanitizer allows Phase C core subset elements
 * and strips everything dangerous.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSvgSafe, sanitizeSvg } from '../../src/renderers/svg-sanitizer.js';

// ── Safe SVG (should pass through unchanged) ────────────────

describe('AC-C4: SVG sanitizer — safe elements', () => {
  it('passes clean SVG from diagram-svg compiler unchanged', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9.4 4.4">
<rect x="0" y="0" width="9.4" height="4.4" fill="#F5F5F5" stroke="#D4D4D4" stroke-width="0.02" />
<text x="4.7" y="0.14" font-family="Noto Sans SC" font-size="0.125" fill="#333" font-weight="bold" text-anchor="middle">Root</text>
</svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, false, 'clean SVG should not be modified');
    assert.deepEqual(result.stripped, []);
    assert.ok(isSvgSafe(svg));
  });

  it('allows all Phase C core subset elements', () => {
    const svg = `<svg viewBox="0 0 10 10">
<g><rect x="0" y="0" width="1" height="1" /><circle cx="5" cy="5" r="2" />
<ellipse cx="3" cy="3" rx="2" ry="1" /><line x1="0" y1="0" x2="5" y2="5" />
<path d="M0 0 L5 5" /><polygon points="0,0 5,0 2.5,5" />
<polyline points="0,0 1,1 2,0" /><text x="0" y="1">Hi</text>
<text x="0" y="2"><tspan>Nested</tspan></text></g></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, false, 'all core elements should pass');
  });
});

// ── Dangerous elements (must be stripped) ────────────────────

describe('AC-C4: SVG sanitizer — blocked elements', () => {
  it('strips <script> tags', () => {
    const svg = `<svg viewBox="0 0 10 10"><script>alert('xss')</script><rect x="0" y="0" width="1" height="1" /></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(result.stripped.includes('script'));
    assert.ok(!result.svg.includes('<script'));
    assert.ok(result.svg.includes('<rect'));
  });

  it('strips <foreignObject>', () => {
    const svg = `<svg viewBox="0 0 10 10"><foreignObject x="0" y="0" width="100" height="100"><div>HTML inside SVG</div></foreignObject></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(result.stripped.includes('foreignobject'));
  });

  it('strips <filter> and <feGaussianBlur>', () => {
    const svg = `<svg viewBox="0 0 10 10"><filter id="blur"><feGaussianBlur stdDeviation="5" /></filter><rect filter="url(#blur)" /></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(result.stripped.includes('filter'));
  });

  it('strips <use> with external href', () => {
    const svg = `<svg viewBox="0 0 10 10"><use xlink:href="https://evil.com/sprite.svg#icon" /></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(!result.svg.includes('evil.com'));
  });

  it('strips <image> element', () => {
    const svg = `<svg viewBox="0 0 10 10"><image href="https://evil.com/img.png" width="100" height="100" /></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(result.stripped.includes('image'));
  });

  it('strips <animate> and <set> elements', () => {
    const svg = `<svg viewBox="0 0 10 10"><rect><animate attributeName="x" from="0" to="10" dur="1s" /><set attributeName="fill" to="red" /></rect></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(result.stripped.includes('animate'));
    assert.ok(result.stripped.includes('set'));
  });

  it('strips <style> blocks', () => {
    const svg = `<svg viewBox="0 0 10 10"><style>.evil { fill: red; }</style><rect class="evil" /></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(result.stripped.includes('style'));
    assert.ok(!result.svg.includes('<style'));
    assert.ok(result.svg.includes('<rect'));
  });
});

// ── Dangerous attributes ────────────────────────────────────

describe('AC-C4: SVG sanitizer — blocked attributes', () => {
  it('strips onclick handlers', () => {
    const svg = `<svg viewBox="0 0 10 10"><rect onclick="alert('xss')" x="0" y="0" width="1" height="1" /></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(!result.svg.includes('onclick'));
    assert.ok(result.svg.includes('<rect'));
  });

  it('strips onload handlers', () => {
    const svg = `<svg onload="fetch('evil')" viewBox="0 0 10 10"><rect /></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(!result.svg.includes('onload'));
  });

  it('strips external xlink:href but keeps element', () => {
    const svg = `<svg viewBox="0 0 10 10"><g xlink:href="https://evil.com/payload"><rect /></g></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(!result.svg.includes('evil.com'));
    assert.ok(result.svg.includes('<g'));
  });

  it('strips single-quoted external href (砚砚 R1 P1)', () => {
    const svg = `<svg viewBox="0 0 10 10"><text href='https://evil.com'>X</text></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true, 'single-quoted external href must be stripped');
    assert.ok(!result.svg.includes('evil.com'));
  });

  it('strips javascript: protocol href (砚砚 R1 P1)', () => {
    const svg = `<svg viewBox="0 0 10 10"><text href='javascript:alert(1)'>X</text></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true, 'javascript: href must be stripped');
    assert.ok(!result.svg.includes('javascript:'));
  });

  it('strips single-quoted xlink:href with data: (砚砚 R1 P1)', () => {
    const svg = `<svg viewBox="0 0 10 10"><text xlink:href='data:text/html,payload'>X</text></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true, 'single-quoted data: xlink:href must be stripped');
    assert.ok(!result.svg.includes('data:'));
  });

  it('strips data: URI hrefs', () => {
    const svg = `<svg viewBox="0 0 10 10"><text href="data:text/html,<script>alert(1)</script>">X</text></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(!result.svg.includes('data:text'));
  });
});

// ── Edge cases ──────────────────────────────────────────────

describe('AC-C4: SVG sanitizer — edge cases', () => {
  it('strips XML processing instructions', () => {
    const svg = `<?xml version="1.0"?><svg viewBox="0 0 10 10"><rect /></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(!result.svg.includes('<?xml'));
  });

  it('strips DOCTYPE', () => {
    const svg = `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg viewBox="0 0 10 10"><rect /></svg>`;
    const result = sanitizeSvg(svg);
    assert.equal(result.modified, true);
    assert.ok(!result.svg.includes('DOCTYPE'));
  });

  it('handles empty SVG', () => {
    const result = sanitizeSvg('');
    assert.equal(result.svg, '');
    assert.equal(result.modified, false);
  });

  it('handles SVG with only safe content and whitespace', () => {
    const svg = `  <svg viewBox="0 0 10 10">
  <rect x="0" y="0" width="10" height="10" />
</svg>  `;
    const result = sanitizeSvg(svg);
    // trim is applied but content is unchanged
    assert.deepEqual(result.stripped, []);
  });
});
