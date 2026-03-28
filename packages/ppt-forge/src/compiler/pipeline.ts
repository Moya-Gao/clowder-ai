/**
 * F144 Phase B — Compiler Pipeline
 *
 * Orchestrates the full V2 pipeline:
 * Blueprint → HTML Template → Playwright Layout → DOM Compiler → pptxgenjs
 */

import { LAYOUT_CATALOG } from '../layouts.js';
import type { DeckBlueprint, ThemeTokens } from '../types.js';
import { buildCompiledDeck } from './compiled-builder.js';
import { compileDom } from './dom-compiler.js';
import { renderSlideToHtml } from './html-template.js';
import { closeBrowser, evaluateDeck } from './layout-evaluator.js';
import type { CompiledDeck } from './types.js';

/** Full V2 pipeline: Blueprint → HTML → Playwright → Compile → pptxgenjs */
export async function compileAndBuild(
  blueprint: DeckBlueprint,
  theme: ThemeTokens,
): Promise<ReturnType<typeof buildCompiledDeck>> {
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

  // Set metadata from blueprint
  pres.title = blueprint.meta.title;
  pres.author = blueprint.meta.author;
  pres.subject = blueprint.meta.subtitle ?? '';

  return pres;
}

export { closeBrowser };
