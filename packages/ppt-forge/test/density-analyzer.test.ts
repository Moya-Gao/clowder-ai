/**
 * F144 Phase D — Density Analyzer tests
 *
 * D2: Two-phase density control (640×360 draft → 1280×720 final)
 * D3: Whitespace gate (<30%) + overflow detection
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, describe, it } from 'node:test';

import { analyzeDensity, compareTwoPhase, densityGate } from '../src/compiler/density-analyzer.js';
import { closeFlatBrowser, flatExtract } from '../src/compiler/flat-dom-compiler.js';
import type { CompiledElement } from '../src/compiler/types.js';

// ── Helpers ──

function makeElement(x: number, y: number, w: number, h: number): CompiledElement {
  return {
    role: 'shape',
    rect: { x, y, w, h },
    content: { type: 'shape', shapeType: 'rect', fill: 'CCCCCC' },
    style: {},
  };
}

// ── Unit tests (no Playwright) ──

describe('density-analyzer — analyzeDensity', () => {
  it('returns 0 whitespace for a full-slide element', () => {
    const els = [makeElement(0, 0, 13.333, 7.5)];
    const report = analyzeDensity(els);
    assert.ok(
      report.whitespaceRatio < 0.02,
      `expected ~0% whitespace, got ${(report.whitespaceRatio * 100).toFixed(1)}%`,
    );
    assert.equal(report.overflowCount, 0);
  });

  it('returns ~50% whitespace for half-slide element', () => {
    const els = [makeElement(0, 0, 13.333, 3.75)]; // top half
    const report = analyzeDensity(els);
    assert.ok(
      report.whitespaceRatio > 0.45 && report.whitespaceRatio < 0.55,
      `expected ~50%, got ${(report.whitespaceRatio * 100).toFixed(1)}%`,
    );
  });

  it('returns ~100% whitespace for no elements', () => {
    const report = analyzeDensity([]);
    assert.equal(report.whitespaceRatio, 1.0);
    assert.equal(report.elementCount, 0);
  });

  it('handles overlapping elements correctly', () => {
    // Two elements covering the same area — should not double-count
    const els = [makeElement(0, 0, 13.333, 7.5), makeElement(0, 0, 13.333, 7.5)];
    const report = analyzeDensity(els);
    assert.ok(report.whitespaceRatio < 0.02, 'overlap should not inflate coverage');
  });

  it('detects overflow elements', () => {
    const els = [makeElement(12, 6, 3, 3)]; // extends past 13.333" × 7.5"
    const report = analyzeDensity(els);
    assert.equal(report.overflowCount, 1);
  });
});

describe('density-analyzer — densityGate (D3)', () => {
  it('passes dense slide (< 30% whitespace)', () => {
    // Cover 80% of the slide
    const els = [makeElement(0, 0, 13.333, 6.0)];
    const result = densityGate(els);
    assert.ok(result.passed, `should pass, but got: ${result.reason}`);
  });

  it('fails sparse slide (> 30% whitespace)', () => {
    // Cover only 40% of the slide
    const els = [makeElement(0, 0, 13.333, 3.0)];
    const result = densityGate(els);
    assert.ok(!result.passed, 'should fail whitespace threshold');
    assert.ok(result.reason?.includes('exceeds'), result.reason);
  });

  it('fails on overflow', () => {
    const els = [makeElement(0, 0, 13.333, 7.5), makeElement(13, 7, 2, 2)];
    const result = densityGate(els);
    assert.ok(!result.passed, 'should fail on overflow');
    assert.ok(result.reason?.includes('overflow'), result.reason);
  });

  it('accepts custom threshold', () => {
    const els = [makeElement(0, 0, 13.333, 4.5)]; // ~40% whitespace
    const strict = densityGate(els, 0.3);
    const relaxed = densityGate(els, 0.5);
    assert.ok(!strict.passed, 'strict threshold should fail');
    assert.ok(relaxed.passed, 'relaxed threshold should pass');
  });

  it('ignores full-slide border shells from coverage (P1 — border bypass)', () => {
    // A border-only shell covering the full slide should be treated as decoration,
    // not as real content that inflates coverage.
    const bg: CompiledElement = {
      role: 'shape',
      rect: { x: 0, y: 0, w: 13.333, h: 7.5 },
      content: { type: 'shape', shapeType: 'rect', fill: 'FAFAFA' },
      style: {},
    };
    const borderShell: CompiledElement = {
      role: 'shape',
      rect: { x: 0, y: 0, w: 13.333, h: 7.5 },
      content: { type: 'shape', shapeType: 'rect', fill: '' },
      style: { borderColor: 'C7020E', borderWidth: 1 },
    };
    const topContent: CompiledElement = {
      role: 'shape',
      rect: { x: 0, y: 0, w: 13.333, h: 2.5 },
      content: { type: 'shape', shapeType: 'rect', fill: 'FFFFFF' },
      style: {},
    };
    const result = densityGate([bg, borderShell, topContent]);
    assert.ok(
      !result.passed,
      `border shell should not inflate coverage: whitespace=${(result.report.whitespaceRatio * 100).toFixed(1)}%`,
    );
  });

  it('ignores full-slide decorative background fills', () => {
    const rootBg = makeElement(0, 0, 13.333, 7.5);
    rootBg.content = { type: 'shape', shapeType: 'rect', fill: 'FAFAFA' };

    const contentBand = makeElement(0, 0, 13.333, 3.0);
    const result = densityGate([rootBg, contentBand]);

    assert.ok(!result.passed, 'root background should not make a sparse slide pass');
    assert.ok(result.reason?.includes('exceeds'), result.reason);
  });
});

describe('density-analyzer — compareTwoPhase (D2)', () => {
  it('passes when final is denser than draft', () => {
    const draft = [makeElement(0, 0, 13.333, 5.0)]; // ~33% whitespace
    const final = [makeElement(0, 0, 13.333, 7.5)]; // ~0% whitespace
    const result = compareTwoPhase(draft, final);
    assert.ok(result.densityPreserved, 'final is denser → should pass');
    assert.ok(result.final.whitespaceRatio < result.draft.whitespaceRatio);
  });

  it('fails when final is sparser than draft', () => {
    const draft = [makeElement(0, 0, 13.333, 7.5)]; // ~0% whitespace
    const final = [makeElement(0, 0, 13.333, 3.75)]; // ~50% whitespace
    const result = compareTwoPhase(draft, final);
    assert.ok(!result.densityPreserved, 'final lost density → should fail');
  });

  it('passes within tolerance', () => {
    const draft = [makeElement(0, 0, 13.333, 6.0)]; // ~20% whitespace
    const final = [makeElement(0, 0, 13.333, 5.7)]; // ~24% whitespace
    const result = compareTwoPhase(draft, final, 0.05);
    assert.ok(result.densityPreserved, 'within 5% tolerance → should pass');
  });
});

// ── Integration test: real HTML through flat extract ──

describe('density-analyzer — E2E with flat extract', () => {
  after(async () => {
    await closeFlatBrowser();
  });

  it('D2 E2E: compareTwoPhase returns valid structure for different-content HTMLs', async () => {
    const draftHtml = readFileSync(new URL('../examples/spike-d1-arch-draft.html', import.meta.url), 'utf-8');
    const finalHtml = readFileSync(new URL('../examples/spike-d1-arch-final.html', import.meta.url), 'utf-8');

    const draftResult = await flatExtract(draftHtml, { viewportWidth: 640, viewportHeight: 360 });
    const finalResult = await flatExtract(finalHtml);

    const comparison = compareTwoPhase(draftResult.elements, finalResult.elements);

    console.log(
      `Draft: ${(comparison.draft.whitespaceRatio * 100).toFixed(1)}% whitespace (${comparison.draft.elementCount} elements)`,
    );
    console.log(
      `Final: ${(comparison.final.whitespaceRatio * 100).toFixed(1)}% whitespace (${comparison.final.elementCount} elements)`,
    );

    // Both should have meaningful content
    assert.ok(draftResult.elements.length >= 10, `draft should have elements, got ${draftResult.elements.length}`);
    assert.ok(finalResult.elements.length >= 10, `final should have elements, got ${finalResult.elements.length}`);

    // D2 gate: different content → densityPreserved may be false, but structure must be valid
    assert.ok(comparison.draft.whitespaceRatio >= 0 && comparison.draft.whitespaceRatio <= 1);
    assert.ok(comparison.final.whitespaceRatio >= 0 && comparison.final.whitespaceRatio <= 1);
    assert.equal(typeof comparison.densityPreserved, 'boolean');
  });

  it('D2 E2E: 640×360 draft is denser than 1280×720 final for same HTML (D2 rationale)', async () => {
    const html = readFileSync(new URL('../examples/spike-d1-arch-final.html', import.meta.url), 'utf-8');

    const draft = await flatExtract(html, { viewportWidth: 640, viewportHeight: 360 });
    const final_ = await flatExtract(html, { viewportWidth: 1280, viewportHeight: 720 });

    const comparison = compareTwoPhase(draft.elements, final_.elements);

    console.log(`Same-HTML draft (640): ${(comparison.draft.whitespaceRatio * 100).toFixed(1)}% whitespace`);
    console.log(`Same-HTML final (1280): ${(comparison.final.whitespaceRatio * 100).toFixed(1)}% whitespace`);

    // D2 rationale: smaller viewport → CSS forces tighter packing → less whitespace
    assert.ok(
      comparison.draft.whitespaceRatio < comparison.final.whitespaceRatio,
      `draft should be denser: draft=${(comparison.draft.whitespaceRatio * 100).toFixed(1)}% vs final=${(comparison.final.whitespaceRatio * 100).toFixed(1)}%`,
    );
    // Without AI enhancement, same HTML at larger viewport loses density → gate fails
    assert.ok(
      !comparison.densityPreserved,
      'same HTML without AI enhancement should NOT preserve density (proves D2 gate catches regressions)',
    );
  });

  it('D3 E2E: hybrid flat-only has high whitespace (semantic zones unfilled) but no overflow', async () => {
    const html = readFileSync(new URL('../examples/spike-d2-hybrid.html', import.meta.url), 'utf-8');
    const result = await flatExtract(html);
    const gate = densityGate(result.elements);

    console.log(
      `Hybrid flat-only: ${(gate.report.whitespaceRatio * 100).toFixed(1)}% whitespace, ${gate.report.overflowCount} overflows`,
    );

    // Flat-only extraction skips semantic zones → high whitespace is expected
    assert.ok(!gate.passed, 'flat-only hybrid should NOT pass 30% gate (semantic zones are empty)');
    assert.equal(gate.report.overflowCount, 0, 'no overflows expected');
  });

  it('D6 E2E: top-loaded page with full-slide root background must fail density gate', async () => {
    const html = `
      <html><body>
        <div class="ppt-slide" style="width:1280px;height:720px;background:#fafafa;overflow:hidden;">
          <div style="height:280px;background:#fff;border-top:3px solid #C7020E;padding:24px;">
            <div style="font-size:28px;font-weight:700;">Top-loaded strategic page</div>
            <div style="margin-top:12px;font-size:16px;">All content sits in the upper band.</div>
          </div>
        </div>
      </body></html>
    `;

    const result = await flatExtract(html);
    const gate = densityGate(result.elements);

    assert.ok(!gate.passed, 'full-slide root background should not hide lower-half whitespace');
    assert.ok(
      gate.report.whitespaceRatio > 0.3,
      `expected sparse layout, got ${(gate.report.whitespaceRatio * 100).toFixed(1)}% whitespace`,
    );
  });
});
