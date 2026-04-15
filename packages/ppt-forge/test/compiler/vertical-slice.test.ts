/**
 * F144 AC-D5 — Vertical Slice: htmlToSlide end-to-end test
 *
 * Proves the full pipeline:
 *   AI-drawn HTML → flatExtract → densityGate → routeElements
 *     → buildCompiledDeck → .pptx buffer
 *
 * Acceptance:
 *   - density gate passes (whitespace < 30%)
 *   - PPTX buffer is non-trivial (>10 KB)
 *   - text elements are editable (extracted as native text, not images)
 *   - returns four-piece deliverable: html, screenshot, density report, pptx buffer
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { closeFlatBrowser } from '../../src/compiler/flat-dom-compiler.js';
import { closeScreenshotBrowser, htmlToSlide } from '../../src/compiler/vertical-slice.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_HTML = readFileSync(join(__dirname, '..', '..', 'examples', 'd5-architecture-slice.html'), 'utf-8');

describe('AC-D5: htmlToSlide vertical slice', () => {
  after(async () => {
    await closeFlatBrowser();
    await closeScreenshotBrowser();
  });

  it('produces a valid PPTX from high-density HTML input', async () => {
    const result = await htmlToSlide(EXAMPLE_HTML, {
      slideId: 'd5-test',
      intent: 'architecture overview',
      masterName: 'BLANK',
    });

    // Four-piece deliverable (AC-D5: HTML/截图/density/PPTX)
    assert.ok(result.html, 'should return original HTML');
    assert.ok(result.screenshot, 'should return screenshot buffer');
    assert.ok(result.screenshot.length > 5000, `screenshot too small: ${result.screenshot.length} bytes`);
    assert.ok(result.densityReport, 'should return density report');
    assert.ok(result.pptxBuffer, 'should return PPTX buffer');
    assert.ok(typeof result.elementCount === 'number', 'should return element count');

    // Density gate must pass (<30% whitespace)
    assert.ok(result.densityReport.passed, `density gate failed: ${result.densityReport.reason}`);
    assert.ok(
      result.densityReport.report.whitespaceRatio < 0.3,
      `whitespace ${(result.densityReport.report.whitespaceRatio * 100).toFixed(1)}% exceeds 30%`,
    );

    // PPTX is non-trivial
    assert.ok(result.pptxBuffer.length > 10_000, `PPTX too small: ${result.pptxBuffer.length} bytes`);

    // Extracted enough elements (high-density slide should have many)
    assert.ok(result.elementCount >= 30, `too few elements: ${result.elementCount}`);
  });

  it('includes text elements (not screenshot-based)', async () => {
    const result = await htmlToSlide(EXAMPLE_HTML, {
      slideId: 'd5-text-check',
      intent: 'architecture overview',
      masterName: 'BLANK',
    });

    assert.ok(result.textCount > 0, 'should extract text elements');
    assert.ok(result.textCount >= 20, `too few text elements: ${result.textCount}, expected 20+`);
  });

  it('rejects sparse HTML that fails density gate (砚砚 R1 P1)', async () => {
    const sparseHtml = `<html><body>
      <div class="ppt-slide" style="width:1280px;height:720px;background:#fff;position:relative;">
        <p style="font-size:14px;color:#333;">lone text</p>
      </div>
    </body></html>`;
    await assert.rejects(
      () =>
        htmlToSlide(sparseHtml, {
          slideId: 'sparse-test',
          intent: 'test',
          masterName: 'BLANK',
        }),
      /density gate failed/i,
    );
  });

  it('rejects empty HTML (no .ppt-slide container)', async () => {
    await assert.rejects(
      () =>
        htmlToSlide('<html><body>no slide</body></html>', {
          slideId: 'empty-test',
          intent: 'test',
          masterName: 'BLANK',
        }),
      /no elements extracted/i,
    );
  });
});
