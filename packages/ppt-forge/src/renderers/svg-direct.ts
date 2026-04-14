/**
 * AI-Direct SVG Path — AC-C6.
 *
 * Accepts raw SVG strings (from AI models or external tools),
 * sanitizes them through the AC-C4 whitelist, validates dimensions,
 * and renders to a pptxgenjs slide.
 *
 * This is the "C2-Assist" channel: AI-generated SVG + machine validation.
 * The deterministic compiler (diagram-svg.ts) remains the primary path.
 */

import { sanitizeSvg } from './svg-sanitizer.js';
import { renderSvgToSlide } from './svg-to-shapes.js';

// ── Types ───────────────────────────────────────────────────

interface PptxSlide {
  addShape(name: string, opts: Record<string, unknown>): void;
  addText(text: unknown, opts: Record<string, unknown>): void;
}

export interface DirectSvgInput {
  /** Raw SVG string from AI or external tool */
  svg: string;
  /** Slide offset (inches). Dimensions come from the SVG viewBox, not here. */
  position: { x: number; y: number };
}

export interface DirectSvgResult {
  /** Whether rendering succeeded */
  ok: boolean;
  /** Error message if not ok */
  error?: string;
  /** Elements stripped by sanitizer (for human review gate) */
  stripped: string[];
  /** Whether the SVG was modified by sanitizer */
  sanitized: boolean;
}

// ── Validation ──────────────────────────────────────────────

const MAX_SVG_BYTES = 2 * 1024 * 1024; // 2MB (AC-C5 budget)
const SVG_ROOT_RE = /<svg\b[^>]*>/i;
/** Elements that svg-to-shapes can actually render to PPTX */
const RENDERABLE_RE = /<(?:rect|text)\s/gi;

function validateSvgStructure(svg: string): string | null {
  if (!svg.trim()) return 'SVG is empty';
  if (Buffer.byteLength(svg, 'utf-8') > MAX_SVG_BYTES) return `SVG exceeds ${MAX_SVG_BYTES} byte limit`;
  if (!SVG_ROOT_RE.test(svg)) return 'Missing <svg> root element';
  return null;
}

// ── Public API ──────────────────────────────────────────────

/**
 * Render an AI-generated SVG onto a slide with sanitization.
 *
 * Pipeline: validate → sanitize (AC-C4) → render (svg-to-shapes).
 * Returns a result with stripped elements for human review gate.
 */
export function renderDirectSvg(slide: PptxSlide, input: DirectSvgInput): DirectSvgResult {
  // Step 1: Structural validation
  const structError = validateSvgStructure(input.svg);
  if (structError) {
    return { ok: false, error: structError, stripped: [], sanitized: false };
  }

  // Step 2: Security sanitization (AC-C4 whitelist)
  let { svg: safeSvg, stripped, modified } = sanitizeSvg(input.svg);

  // Step 3: Check renderable element count (砚砚 R1 P1 — fail-closed on empty render)
  const renderableCount = (safeSvg.match(RENDERABLE_RE) ?? []).length;
  RENDERABLE_RE.lastIndex = 0; // reset stateful regex
  if (renderableCount === 0) {
    return { ok: false, error: 'No renderable elements (rect/text) found in SVG', stripped, sanitized: modified };
  }

  // Step 3.5: Flag allowed-but-unrenderable visual elements (砚砚 R2 P1)
  // Sanitizer says "safe", but svg-to-shapes silently drops these → report to review gate
  const unrenderable = safeSvg.match(/<(circle|ellipse|line|path|polygon|polyline)[\s/>]/gi);
  if (unrenderable) {
    for (const m of unrenderable) {
      const tag = m.slice(1).split(/[\s/>]/)[0].toLowerCase();
      if (!stripped.includes(tag)) stripped.push(tag);
    }
    modified = true;
  }

  // Step 4: Render sanitized SVG to slide
  renderSvgToSlide(slide as never, safeSvg, {
    x: input.position.x,
    y: input.position.y,
  });

  return { ok: true, stripped, sanitized: modified };
}
