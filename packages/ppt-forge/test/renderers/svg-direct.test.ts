/**
 * AC-C6: AI-direct SVG path tests.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderDirectSvg } from '../../src/renderers/svg-direct.js';

function mockSlide() {
  const shapes: Record<string, unknown>[] = [];
  const texts: Record<string, unknown>[] = [];
  return {
    addShape(_: string, opts: Record<string, unknown>) {
      shapes.push(opts);
    },
    addText(t: unknown, opts: Record<string, unknown>) {
      texts.push({ t, ...opts });
    },
    shapes,
    texts,
  };
}

const pos = { x: 0.5, y: 1.0 };

describe('AC-C6: AI-direct SVG path', () => {
  it('renders clean AI-generated SVG to slide', () => {
    const svg = `<svg viewBox="0 0 8 5">
<rect x="0" y="0" width="8" height="5" fill="#F5F5F5" stroke="#D4D4D4" stroke-width="0.02" />
<text x="4" y="2.5" font-size="0.2" fill="#333" text-anchor="middle">AI Generated</text>
</svg>`;
    const slide = mockSlide();
    const result = renderDirectSvg(slide, { svg, position: pos });

    assert.equal(result.ok, true);
    assert.equal(result.sanitized, false);
    assert.deepEqual(result.stripped, []);
    assert.ok(slide.shapes.length >= 1, 'should render shapes');
    assert.ok(slide.texts.length >= 1, 'should render texts');
  });

  it('sanitizes dangerous elements and still renders safe parts', () => {
    const svg = `<svg viewBox="0 0 8 5">
<script>alert('xss')</script>
<rect x="0" y="0" width="4" height="4" fill="#EEE" />
<foreignObject><div>Injected HTML</div></foreignObject>
</svg>`;
    const slide = mockSlide();
    const result = renderDirectSvg(slide, { svg, position: pos });

    assert.equal(result.ok, true);
    assert.equal(result.sanitized, true);
    assert.ok(result.stripped.includes('script'));
    assert.ok(result.stripped.includes('foreignobject'));
    assert.ok(slide.shapes.length >= 1, 'safe rect should still render');
  });

  it('rejects empty SVG', () => {
    const slide = mockSlide();
    const result = renderDirectSvg(slide, { svg: '', position: pos });
    assert.equal(result.ok, false);
    assert.ok(result.error?.includes('empty'));
  });

  it('rejects SVG without root element', () => {
    const slide = mockSlide();
    const result = renderDirectSvg(slide, { svg: '<rect x="0" y="0" />', position: pos });
    assert.equal(result.ok, false);
    assert.ok(result.error?.includes('<svg>'));
  });

  it('rejects oversized SVG (> 2MB)', () => {
    const bigSvg = `<svg viewBox="0 0 8 5">${'<rect x="0" y="0" width="1" height="1" fill="#EEE" />'.repeat(50000)}</svg>`;
    const slide = mockSlide();
    const result = renderDirectSvg(slide, { svg: bigSvg, position: pos });
    assert.equal(result.ok, false);
    assert.ok(result.error?.includes('limit'));
  });

  it('rejects SVG with zero renderable elements (砚砚 R1 P1)', () => {
    // circle is allowed by sanitizer but not parsed by svg-to-shapes
    const svg = `<svg viewBox="0 0 8 5"><circle cx="4" cy="2.5" r="2" fill="#EEE" /></svg>`;
    const slide = mockSlide();
    const result = renderDirectSvg(slide, { svg, position: { x: 0.5, y: 1.0 } });
    assert.equal(result.ok, false, 'should fail when nothing renderable');
    assert.ok(result.error?.includes('renderable'), `error should mention renderable, got: ${result.error}`);
  });

  it('position only needs x/y, not w/h (砚砚 R1 P2)', () => {
    const svg = `<svg viewBox="0 0 8 5"><rect x="0" y="0" width="4" height="4" fill="#EEE" /></svg>`;
    const slide = mockSlide();
    // Should compile without w/h in position
    const result = renderDirectSvg(slide, { svg, position: { x: 0.5, y: 1.0 } });
    assert.equal(result.ok, true);
  });

  it('detects self-closing unrenderable tags without attributes (cloud R1 P2)', () => {
    // <circle/> has no whitespace after tag name — must still be caught
    const svg = `<svg viewBox="0 0 8 5"><rect x="0" y="0" width="4" height="4" fill="#EEE" /><circle/></svg>`;
    const slide = mockSlide();
    const result = renderDirectSvg(slide, { svg, position: { x: 0.5, y: 1.0 } });

    assert.equal(result.sanitized, true, 'should flag sanitized for bare <circle/>');
    assert.ok(result.stripped.includes('circle'), `circle must appear in stripped, got: ${result.stripped}`);
  });

  it('flags allowed-but-unrenderable elements in stripped (砚砚 R2 P1)', () => {
    // circle passes sanitizer (safe) but svg-to-shapes can't render it
    const svg = `<svg viewBox="0 0 8 5"><rect x="0" y="0" width="4" height="4" fill="#EEE" /><circle cx="6" cy="2.5" r="1" fill="#CCC" /></svg>`;
    const slide = mockSlide();
    const result = renderDirectSvg(slide, { svg, position: { x: 0.5, y: 1.0 } });

    assert.equal(result.ok, true, 'rect is renderable so overall ok');
    assert.equal(result.sanitized, true, 'should flag sanitized when unrenderable elements present');
    assert.ok(result.stripped.includes('circle'), `circle must appear in stripped, got: ${result.stripped}`);
    assert.ok(slide.shapes.length >= 1, 'rect should still render');
  });

  it('reports stripped elements for human review gate', () => {
    const svg = `<svg viewBox="0 0 8 5">
<rect x="0" y="0" width="4" height="4" fill="#EEE" />
<filter id="f"><feGaussianBlur stdDeviation="5" /></filter>
<animate attributeName="x" from="0" to="10" dur="1s" />
</svg>`;
    const slide = mockSlide();
    const result = renderDirectSvg(slide, { svg, position: pos });

    assert.equal(result.ok, true);
    assert.equal(result.sanitized, true);
    // Human review gate can inspect stripped[] to decide if result is acceptable
    assert.ok(result.stripped.length >= 2, 'should report multiple stripped elements');
  });
});
