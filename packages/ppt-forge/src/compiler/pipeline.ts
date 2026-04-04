/**
 * F144 Phase B + D — Compiler Pipeline
 *
 * Orchestrates the full V2 pipeline:
 * Blueprint → HTML Template → Playwright Layout → DOM Compiler → [Density Gate] → pptxgenjs
 */

import type { DeckBlueprint, ThemeTokens } from '../types.js';
import { buildCompiledDeck } from './compiled-builder.js';
import type { DeckGateResult } from './density-analyzer.js';
import { gateCompiledDeck } from './density-analyzer.js';
import { compileDom } from './dom-compiler.js';
import { renderSlideToHtml } from './html-template.js';
import { closeBrowser, evaluateDeck } from './layout-evaluator.js';
import type { CompiledDeck } from './types.js';

export interface CompileOptions {
  /** Enable density gate with this whitespace threshold (0.0–1.0). Omit to skip gate. */
  densityThreshold?: number;
}

export interface CompileResult {
  presentation: ReturnType<typeof buildCompiledDeck>;
  densityGate: DeckGateResult;
}

/** Full V2 pipeline: Blueprint → HTML → Playwright → Compile → [Gate] → pptxgenjs */
export async function compileAndBuild(
  blueprint: DeckBlueprint,
  theme: ThemeTokens,
): Promise<ReturnType<typeof buildCompiledDeck>>;
export async function compileAndBuild(
  blueprint: DeckBlueprint,
  theme: ThemeTokens,
  options: CompileOptions,
): Promise<CompileResult>;
export async function compileAndBuild(
  blueprint: DeckBlueprint,
  theme: ThemeTokens,
  options?: CompileOptions,
): Promise<ReturnType<typeof buildCompiledDeck> | CompileResult> {
  // 1. Render each slide to HTML
  const slideHtmls = blueprint.slides.map((s) => renderSlideToHtml(s, theme));

  // 2. Evaluate layouts via Playwright (batched, single browser)
  const evaluatedSlides = await evaluateDeck(slideHtmls);

  // 3. Compile DOM → CompiledSlides
  const compiledSlides = evaluatedSlides.map((nodes, i) => compileDom(nodes, blueprint.slides[i]));

  // 4. Aggregate into CompiledDeck
  const allFonts = [...new Set(compiledSlides.flatMap((s) => s.fontsUsed))];
  const compiledDeck: CompiledDeck = {
    slides: compiledSlides,
    fontsUsed: allFonts,
  };

  // 5. Build pptxgenjs presentation
  const pres = buildCompiledDeck(compiledDeck, theme);
  pres.title = blueprint.meta.title;
  pres.author = blueprint.meta.author;
  pres.subject = blueprint.meta.subtitle ?? '';

  // 5.5 Density gate (A8) — when options is passed, always return CompileResult
  if (options) {
    const gateResult = gateCompiledDeck(compiledDeck, {
      threshold: options.densityThreshold ?? 0.3,
    });
    return { presentation: pres, densityGate: gateResult };
  }

  return pres;
}

export { closeBrowser };
