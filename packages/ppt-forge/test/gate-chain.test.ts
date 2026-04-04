/**
 * A8: Gate chain — density gate wired into pipeline
 *
 * Tests gateCompiledDeck() and compileAndBuild() with density checking.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, describe, it } from 'node:test';
import type { DeckGateResult, TwoPhaseDeckResult } from '../src/compiler/density-analyzer.js';
import { gateCompiledDeck, gateTwoPhaseDeck } from '../src/compiler/density-analyzer.js';
import type { CompiledDeck, CompiledElement, CompiledSlide } from '../src/compiler/types.js';

// ── Helpers ──

function makeElement(x: number, y: number, w: number, h: number): CompiledElement {
  return {
    role: 'shape',
    rect: { x, y, w, h },
    content: { fill: 'CC0000' },
    style: {},
  };
}

function makeSlide(slideId: string, elements: CompiledElement[]): CompiledSlide {
  return { slideId, intent: 'content', masterName: 'MASTER_CONTENT', elements, fontsUsed: [] };
}

function makeDeck(slides: CompiledSlide[]): CompiledDeck {
  return { slides, fontsUsed: [] };
}

// ── gateCompiledDeck unit tests ──

describe('gateCompiledDeck', () => {
  it('passes when all slides are dense enough', () => {
    // Element covers most of the 13.333" × 7.5" slide
    const denseSlide = makeSlide('s1', [makeElement(0, 0, 13, 7)]);
    const deck = makeDeck([denseSlide]);
    const result: DeckGateResult = gateCompiledDeck(deck);
    assert.ok(result.passed, 'deck with dense slide should pass');
    assert.equal(result.failedSlides.length, 0);
    assert.equal(result.slideResults.length, 1);
    assert.ok(result.slideResults[0].gate.passed);
  });

  it('fails when any slide exceeds whitespace threshold', () => {
    // Dense slide + sparse slide (only tiny element)
    const dense = makeSlide('s1', [makeElement(0, 0, 13, 7)]);
    const sparse = makeSlide('s2', [makeElement(0, 0, 1, 1)]);
    const deck = makeDeck([dense, sparse]);
    const result = gateCompiledDeck(deck);
    assert.ok(!result.passed, 'deck with one sparse slide should fail');
    assert.deepEqual(result.failedSlides, ['s2']);
  });

  it('respects custom threshold', () => {
    // Element covers ~55% of slide (10×4.1=41 on 100 sq in) → ~45% whitespace
    const halfSlide = makeSlide('s1', [makeElement(0, 0, 10, 4.1)]);
    const deck = makeDeck([halfSlide]);

    const strictResult = gateCompiledDeck(deck, { threshold: 0.3 });
    assert.ok(!strictResult.passed, 'should fail at 30% threshold');

    const relaxedResult = gateCompiledDeck(deck, { threshold: 0.6 });
    assert.ok(relaxedResult.passed, 'should pass at 60% threshold');
  });

  it('detects overflow slides', () => {
    const overflowSlide = makeSlide('s1', [makeElement(-1, 0, 15, 8)]);
    const deck = makeDeck([overflowSlide]);
    const result = gateCompiledDeck(deck);
    assert.ok(!result.passed, 'overflow should fail');
    assert.deepEqual(result.failedSlides, ['s1']);
    assert.ok(result.slideResults[0].gate.report.overflowCount > 0);
  });

  it('returns empty results for empty deck', () => {
    const deck = makeDeck([]);
    const result = gateCompiledDeck(deck);
    assert.ok(result.passed, 'empty deck should pass vacuously');
    assert.equal(result.slideResults.length, 0);
    assert.equal(result.failedSlides.length, 0);
  });
});

// ── gateTwoPhaseDeck unit tests ──

describe('gateTwoPhaseDeck', () => {
  it('passes when final is at least as dense as draft', () => {
    // Draft: ~45% whitespace, Final: ~30% whitespace (denser)
    const draft = makeDeck([makeSlide('s1', [makeElement(0, 0, 10, 4.1)])]);
    const final_ = makeDeck([makeSlide('s1', [makeElement(0, 0, 13, 6)])]);
    const result: TwoPhaseDeckResult = gateTwoPhaseDeck(draft, final_);
    assert.ok(result.passed, 'final is denser → should pass');
    assert.equal(result.slideResults.length, 1);
    assert.ok(result.slideResults[0].comparison.densityPreserved);
  });

  it('fails when final loses density vs draft', () => {
    // Draft: ~3% whitespace (very dense), Final: ~90% (very sparse)
    const draft = makeDeck([makeSlide('s1', [makeElement(0, 0, 13, 7)])]);
    const final_ = makeDeck([makeSlide('s1', [makeElement(0, 0, 2, 1)])]);
    const result = gateTwoPhaseDeck(draft, final_);
    assert.ok(!result.passed, 'final lost density → should fail');
    assert.deepEqual(result.failedSlides, ['s1']);
  });

  it('P1 regression: mismatched slide counts must fail', () => {
    // Draft 2 slides, final 1 slide — missing slide should be caught
    const draft = makeDeck([makeSlide('s1', [makeElement(0, 0, 13, 7)]), makeSlide('s2', [makeElement(0, 0, 13, 7)])]);
    const final_ = makeDeck([makeSlide('s1', [makeElement(0, 0, 13, 7)])]);
    const result = gateTwoPhaseDeck(draft, final_);
    assert.ok(!result.passed, 'mismatched slide counts should fail');
    assert.ok(result.reason, 'should have a reason for failure');
  });
});

// ── compileAndBuild with density gate ──

const THEME = JSON.parse(readFileSync(new URL('../src/themes/huawei-like.json', import.meta.url), 'utf-8'));

describe('compileAndBuild with density gate (A8)', () => {
  after(async () => {
    const { closeBrowser } = await import('../src/compiler/layout-evaluator.js');
    await closeBrowser();
  });

  it('returns density gate results when densityThreshold is set', async () => {
    const { compileAndBuild } = await import('../src/compiler/pipeline.js');
    const blueprint = makeTestBlueprint();
    const result = await compileAndBuild(blueprint, THEME, { densityThreshold: 0.5 });

    // New return type includes densityGate
    assert.ok(result.presentation, 'should have presentation');
    assert.ok(result.densityGate, 'should have density gate results');
    assert.equal(typeof result.densityGate.passed, 'boolean');
    assert.ok(Array.isArray(result.densityGate.slideResults));
    assert.equal(result.densityGate.slideResults.length, blueprint.slides.length);
  });

  it('P1 regression: empty options {} still returns CompileResult', async () => {
    const { compileAndBuild } = await import('../src/compiler/pipeline.js');
    const blueprint = makeTestBlueprint();
    const result = await compileAndBuild(blueprint, THEME, {});

    // Must return CompileResult, not bare Presentation
    assert.ok(result.presentation, 'should have presentation property');
    assert.ok(result.densityGate, 'should have densityGate property');
    assert.equal(typeof result.densityGate.passed, 'boolean');
  });

  it('returns bare presentation when no options given (backward compat)', async () => {
    const { compileAndBuild } = await import('../src/compiler/pipeline.js');
    const blueprint = makeTestBlueprint();
    const pres = await compileAndBuild(blueprint, THEME);

    // Old signature: returns Presentation directly
    assert.ok(typeof pres.write === 'function', 'should return Presentation with write()');
  });
});

function makeTestBlueprint() {
  return {
    version: '1.0',
    meta: {
      title: 'Gate Test',
      subtitle: '',
      author: 'Cat Café',
      createdAt: '2026-04-04',
      researchRef: 'test',
      storylineRef: 'test',
      themeRef: 'huawei-like',
      framework: 'pyramid' as const,
      targetAudience: 'technical-deep-dive' as const,
    },
    sections: [{ sectionId: 'sec1', title: 'Main', slideIds: ['c1'] }],
    slides: [
      {
        slideId: 'c1',
        intent: 'content' as const,
        layoutId: 'layout-title-body',
        purpose: 'Test',
        elements: [
          { type: 'text' as const, slotName: 'title', content: 'Density Gate Test' },
          { type: 'text' as const, slotName: 'body', content: 'Testing the A8 gate chain integration.' },
        ],
        renderBudget: { maxWords: 100 },
      },
    ],
    assets: [],
  };
}
