/**
 * F144 Phase D — Density Analyzer
 *
 * Measures whitespace ratio and overflow from CompiledElement[].
 * Uses a grid-based area coverage algorithm (handles overlapping rects).
 *
 * Two-phase density control (AC-D2):
 *   Draft (640×360) forces tight packing → Final (1280×720) only enhances.
 *   Invariant: final.whitespaceRatio ≤ draft.whitespaceRatio + tolerance.
 *
 * Whitespace gate (AC-D3):
 *   Slide passes only if whitespaceRatio < threshold (default 0.30).
 */

import type { CompiledDeck, CompiledElement } from './types.js';

/** LAYOUT_WIDE slide dimensions in inches */
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

export interface DensityReport {
  /** 0.0 = fully packed, 1.0 = all whitespace */
  whitespaceRatio: number;
  /** Elements extending beyond slide bounds */
  overflowCount: number;
  /** Total extracted elements */
  elementCount: number;
}

export interface TwoPhaseResult {
  draft: DensityReport;
  final: DensityReport;
  /** true if final density ≥ draft density (within tolerance) */
  densityPreserved: boolean;
}

export interface DensityGateResult {
  passed: boolean;
  report: DensityReport;
  reason?: string;
}

// ── Grid-based coverage ──

const GRID = 100; // 100×100 grid ≈ 10,000 cells, fast enough
const SLIDE_AREA = SLIDE_W * SLIDE_H;
const DECORATIVE_ROOT_FILLS = new Set(['FAFAFA', 'F9FAFB', 'F5F5F5', 'FEF2F2', 'FFF7E6']);

function isDecorativeBackground(el: CompiledElement): boolean {
  if (el.role !== 'shape' || el.content.type !== 'shape') return false;
  if (el.style.borderColor || (el.content.line && el.content.line.width > 0)) return false;
  if (!DECORATIVE_ROOT_FILLS.has(el.content.fill)) return false;

  const area = el.rect.w * el.rect.h;
  return area >= SLIDE_AREA * 0.95;
}

function isBorderShell(el: CompiledElement): boolean {
  if (el.role !== 'shape' || el.content.type !== 'shape') return false;
  const hasBorder = Boolean(el.style.borderColor) || (el.content.line != null && el.content.line.width > 0);
  if (!hasBorder) return false;
  const fill = el.content.fill;
  if (fill && fill !== 'none' && !DECORATIVE_ROOT_FILLS.has(fill)) return false;
  const area = el.rect.w * el.rect.h;
  return area >= SLIDE_AREA * 0.95;
}

/**
 * Compute whitespace ratio using a low-res grid.
 * Each cell is marked if ANY element covers it. Handles overlap correctly.
 */
function computeCoverage(elements: CompiledElement[], slideW: number, slideH: number): number {
  const grid = new Uint8Array(GRID * GRID);
  const scaleX = GRID / slideW;
  const scaleY = GRID / slideH;

  for (const el of elements) {
    if (isDecorativeBackground(el) || isBorderShell(el)) continue;

    const x0 = Math.max(0, Math.floor(el.rect.x * scaleX));
    const y0 = Math.max(0, Math.floor(el.rect.y * scaleY));
    const x1 = Math.min(GRID, Math.ceil((el.rect.x + el.rect.w) * scaleX));
    const y1 = Math.min(GRID, Math.ceil((el.rect.y + el.rect.h) * scaleY));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        grid[y * GRID + x] = 1;
      }
    }
  }

  let filled = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]) filled++;
  }
  return filled / (GRID * GRID);
}

function countOverflows(elements: CompiledElement[], slideW: number, slideH: number): number {
  const tolerance = 0.01; // 0.01" tolerance for rounding
  let count = 0;
  for (const el of elements) {
    const overRight = el.rect.x + el.rect.w > slideW + tolerance;
    const overBottom = el.rect.y + el.rect.h > slideH + tolerance;
    const overLeft = el.rect.x < -tolerance;
    const overTop = el.rect.y < -tolerance;
    if (overRight || overBottom || overLeft || overTop) count++;
  }
  return count;
}

// ── Public API ──

/** Analyze density of a set of compiled elements against LAYOUT_WIDE dimensions. */
export function analyzeDensity(elements: CompiledElement[]): DensityReport {
  const coverage = computeCoverage(elements, SLIDE_W, SLIDE_H);
  return {
    whitespaceRatio: 1 - coverage,
    overflowCount: countOverflows(elements, SLIDE_W, SLIDE_H),
    elementCount: elements.length,
  };
}

/**
 * Compare draft vs final density.
 * Draft is at 640×360 (mapped to same inch dimensions via proportional PX_PER_INCH).
 * Final is at 1280×720.
 * @param tolerance Extra whitespace tolerance (default 0.05 = 5%)
 */
export function compareTwoPhase(
  draftElements: CompiledElement[],
  finalElements: CompiledElement[],
  tolerance = 0.05,
): TwoPhaseResult {
  const draft = analyzeDensity(draftElements);
  const final_ = analyzeDensity(finalElements);
  return {
    draft,
    final: final_,
    densityPreserved: final_.whitespaceRatio <= draft.whitespaceRatio + tolerance,
  };
}

/**
 * Gate check: whitespace must be below threshold, no overflows.
 * @param threshold Maximum allowed whitespace ratio (default 0.30 = 30%)
 */
export function densityGate(elements: CompiledElement[], threshold = 0.3): DensityGateResult {
  const report = analyzeDensity(elements);
  if (report.overflowCount > 0) {
    return {
      passed: false,
      report,
      reason: `${report.overflowCount} element(s) overflow slide bounds`,
    };
  }
  if (report.whitespaceRatio > threshold) {
    return {
      passed: false,
      report,
      reason: `whitespace ${(report.whitespaceRatio * 100).toFixed(1)}% exceeds ${(threshold * 100).toFixed(0)}% threshold`,
    };
  }
  return { passed: true, report };
}

// ── Deck-level gate (A8 gate chain) ──

export interface DeckGateResult {
  passed: boolean;
  slideResults: Array<{ slideId: string; gate: DensityGateResult }>;
  failedSlides: string[];
}

export interface TwoPhaseDeckResult {
  passed: boolean;
  slideResults: Array<{ slideId: string; comparison: TwoPhaseResult }>;
  failedSlides: string[];
  reason?: string;
}

/**
 * Compare draft vs final density for each paired slide.
 * Deck passes only if slide counts match AND ALL paired slides preserve density.
 */
export function gateTwoPhaseDeck(
  draftDeck: CompiledDeck,
  finalDeck: CompiledDeck,
  tolerance = 0.05,
): TwoPhaseDeckResult {
  if (draftDeck.slides.length !== finalDeck.slides.length) {
    return {
      passed: false,
      slideResults: [],
      failedSlides: [],
      reason: `slide count mismatch: draft=${draftDeck.slides.length} vs final=${finalDeck.slides.length}`,
    };
  }
  const slideResults: TwoPhaseDeckResult['slideResults'] = [];
  for (let i = 0; i < draftDeck.slides.length; i++) {
    const comparison = compareTwoPhase(draftDeck.slides[i].elements, finalDeck.slides[i].elements, tolerance);
    slideResults.push({ slideId: finalDeck.slides[i].slideId, comparison });
  }
  const failedSlides = slideResults.filter((r) => !r.comparison.densityPreserved).map((r) => r.slideId);
  return { passed: failedSlides.length === 0, slideResults, failedSlides };
}

/**
 * Run density gate on every slide in a compiled deck.
 * Deck passes only if ALL slides pass.
 */
export function gateCompiledDeck(deck: CompiledDeck, options?: { threshold?: number }): DeckGateResult {
  const threshold = options?.threshold ?? 0.3;
  const slideResults = deck.slides.map((slide) => ({
    slideId: slide.slideId,
    gate: densityGate(slide.elements, threshold),
  }));
  const failedSlides = slideResults.filter((r) => !r.gate.passed).map((r) => r.slideId);
  return {
    passed: failedSlides.length === 0,
    slideResults,
    failedSlides,
  };
}
