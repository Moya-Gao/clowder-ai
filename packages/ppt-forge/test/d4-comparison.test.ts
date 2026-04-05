/**
 * F144 AC-D4 — End-to-end comparison: Phase D vs pptx-craft
 *
 * Same topic (华为 AI 差异化) → both approaches generate HTML slides
 * → flatExtract → density analysis → assert:
 *   1. Our information density ≥ pptx-craft (quantitative, via density analyzer)
 *   2. Data point density ≥ 2x (more text elements = more information per slide)
 *
 * NOTE on content accuracy (AC-D4 second dimension):
 * "Content accuracy > pptx-craft" is a qualitative claim grounded in research
 * methodology: our pipeline uses 3-model cross-validation (Claude+GPT+Gemini)
 * with delta memo convergence, vs pptx-craft's single-model deepresearch.
 * This cannot be automatically tested — it is documented in the feature spec.
 *
 * NOTE on baseline fairness (R1 P2):
 * The pptx-craft HTML is a hand-written simulation based on their documented
 * template structure (competitor-research/pptx-craft-technical-report.md §4.1/4.2),
 * NOT actual pptx-craft output. This comparison validates our density advantage
 * against their known approach, not against a specific run of their system.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, describe, it } from 'node:test';

import { analyzeDensity, densityGate } from '../src/compiler/density-analyzer.js';
import { closeFlatBrowser, flatExtract } from '../src/compiler/flat-dom-compiler.js';

// ── Fixture paths ──

const PHASE_D_HTML = readFileSync(new URL('../examples/d4-phase-d-huawei.html', import.meta.url), 'utf-8');
const PPTX_CRAFT_HTML = readFileSync(new URL('../examples/d4-pptx-craft-huawei.html', import.meta.url), 'utf-8');

describe('D4 comparison — Phase D vs pptx-craft (same topic: 华为 AI 差异化)', () => {
  after(async () => {
    await closeFlatBrowser();
  });

  it('Phase D slide has more elements than pptx-craft slide', async () => {
    const phaseD = await flatExtract(PHASE_D_HTML);
    const craft = await flatExtract(PPTX_CRAFT_HTML);

    console.log(`Phase D elements: ${phaseD.elements.length}`);
    console.log(`pptx-craft elements: ${craft.elements.length}`);

    assert.ok(
      phaseD.elements.length > craft.elements.length,
      `Phase D (${phaseD.elements.length}) should have more elements than pptx-craft (${craft.elements.length})`,
    );
  });

  it('Phase D has lower whitespace ratio than pptx-craft (AC-D4: density ≥)', async () => {
    const phaseD = await flatExtract(PHASE_D_HTML);
    const craft = await flatExtract(PPTX_CRAFT_HTML);

    const phaseDDensity = analyzeDensity(phaseD.elements);
    const craftDensity = analyzeDensity(craft.elements);

    console.log(
      `Phase D: ${(phaseDDensity.whitespaceRatio * 100).toFixed(1)}% whitespace, ${phaseDDensity.elementCount} elements`,
    );
    console.log(
      `pptx-craft: ${(craftDensity.whitespaceRatio * 100).toFixed(1)}% whitespace, ${craftDensity.elementCount} elements`,
    );
    console.log(
      `Density advantage: ${((craftDensity.whitespaceRatio - phaseDDensity.whitespaceRatio) * 100).toFixed(1)} percentage points less whitespace`,
    );

    assert.ok(
      phaseDDensity.whitespaceRatio < craftDensity.whitespaceRatio,
      `Phase D whitespace (${(phaseDDensity.whitespaceRatio * 100).toFixed(1)}%) should be less than pptx-craft (${(craftDensity.whitespaceRatio * 100).toFixed(1)}%)`,
    );
  });

  it('Phase D passes density gate (< 30% whitespace)', async () => {
    const phaseD = await flatExtract(PHASE_D_HTML);
    const gate = densityGate(phaseD.elements);

    console.log(
      `Phase D gate: ${gate.passed ? 'PASS' : 'FAIL'} — ${(gate.report.whitespaceRatio * 100).toFixed(1)}% whitespace, ${gate.report.overflowCount} overflows`,
    );

    assert.ok(gate.passed, `Phase D should pass density gate: ${gate.reason}`);
    assert.equal(gate.report.overflowCount, 0, 'No overflows');
  });

  it('pptx-craft fails density gate (> 30% whitespace)', async () => {
    const craft = await flatExtract(PPTX_CRAFT_HTML);
    const gate = densityGate(craft.elements);

    console.log(
      `pptx-craft gate: ${gate.passed ? 'PASS' : 'FAIL'} — ${(gate.report.whitespaceRatio * 100).toFixed(1)}% whitespace`,
    );

    assert.ok(!gate.passed, 'pptx-craft typical template should fail our 30% density gate');
  });

  it('Phase D has zero overflows', async () => {
    const phaseD = await flatExtract(PHASE_D_HTML);
    const report = analyzeDensity(phaseD.elements);
    assert.equal(report.overflowCount, 0, 'Phase D should have zero overflows');
  });

  it('data point density: Phase D carries ≥2x text elements per slide', async () => {
    const phaseD = await flatExtract(PHASE_D_HTML);
    const craft = await flatExtract(PPTX_CRAFT_HTML);

    // Text element count = proxy for data points per slide, NOT content accuracy.
    // Content accuracy is a qualitative dimension (see file header comment).
    const phaseDTexts = phaseD.elements.filter((e) => e.content.type === 'text');
    const craftTexts = craft.elements.filter((e) => e.content.type === 'text');

    console.log(`Phase D text elements: ${phaseDTexts.length}`);
    console.log(`pptx-craft text elements: ${craftTexts.length}`);

    assert.ok(
      phaseDTexts.length >= craftTexts.length * 2,
      `Phase D (${phaseDTexts.length} texts) should have ≥2x pptx-craft (${craftTexts.length} texts)`,
    );
  });
});
