/**
 * F144 Phase D — Element Router
 *
 * Three-layer routing for hybrid slides:
 *   1. slide.renderStrategy ('flat' | 'semantic' | 'hybrid')
 *   2. node-level data-ppt-mode override
 *   3. fallback heuristic (default: flat)
 *
 * Hybrid slides combine:
 *   - flat-extracted elements (narrative text, backgrounds, cards)
 *   - semantic elements (chart/table/kpi via pptxgenjs native API)
 *
 * The router merges both sources into a single CompiledElement[].
 */

import type { FlatExtractResult, SemanticZone } from './flat-dom-compiler.js';
import type { CompiledElement, CompiledSlide } from './types.js';

export type RenderStrategy = 'flat' | 'semantic' | 'hybrid';

/** Semantic content provider: given a zone, returns CompiledElement(s) to fill it. */
export type SemanticProvider = (zone: SemanticZone) => CompiledElement[];

export interface RouteInput {
  /** Slide-level strategy (from Blueprint or explicit override). */
  strategy: RenderStrategy;
  /** Flat extraction result (elements + semantic zones). */
  flat: FlatExtractResult;
  /** Semantic-path elements (from Phase B dom-compiler). Optional. */
  semanticElements?: CompiledElement[];
  /** Provider for filling semantic zones in hybrid mode. */
  semanticProvider?: SemanticProvider;
}

export interface RouteOutput {
  elements: CompiledElement[];
  fontsUsed: string[];
}

/** Collect all font families from a CompiledElement tree. */
function collectFonts(elements: CompiledElement[]): string[] {
  const fonts = new Set<string>();
  function walk(els: CompiledElement[]): void {
    for (const el of els) {
      if (el.content.type === 'text') {
        for (const run of el.content.runs) fonts.add(run.fontFamily);
      }
      if (el.children) walk(el.children);
    }
  }
  walk(elements);
  return [...fonts];
}

/** Fill semantic zones with provided content and merge into element list. */
function fillSemanticZones(
  baseElements: CompiledElement[],
  baseFonts: string[],
  zones: SemanticZone[],
  provider: SemanticProvider,
): RouteOutput {
  const elements = [...baseElements];
  const fontSet = new Set(baseFonts);
  for (const zone of zones) {
    const filled = provider(zone);
    elements.push(...filled);
    for (const f of collectFonts(filled)) fontSet.add(f);
  }
  return { elements, fontsUsed: [...fontSet] };
}

/**
 * Route a slide's elements through the appropriate extraction path.
 *
 * - 'flat': use all flat-extracted elements, ignore semantic zones
 * - 'semantic': use Phase B semantic elements only
 * - 'hybrid': flat elements + semantic provider fills zones
 */
export function routeElements(input: RouteInput): RouteOutput {
  const { strategy, flat, semanticElements, semanticProvider } = input;

  if (strategy === 'semantic') {
    return { elements: semanticElements ?? [], fontsUsed: collectFonts(semanticElements ?? []) };
  }

  if (strategy === 'flat') {
    return { elements: flat.elements, fontsUsed: flat.fontsUsed };
  }

  // hybrid: provider-based zone filling takes priority
  if (semanticProvider && flat.semanticZones.length > 0) {
    return fillSemanticZones(flat.elements, flat.fontsUsed, flat.semanticZones, semanticProvider);
  }

  // hybrid fallback: merge pre-built semantic elements directly
  if (semanticElements && semanticElements.length > 0) {
    const elements = [...flat.elements, ...semanticElements];
    const mergedFonts = new Set([...flat.fontsUsed, ...collectFonts(semanticElements)]);
    return { elements, fontsUsed: [...mergedFonts] };
  }

  return { elements: flat.elements, fontsUsed: flat.fontsUsed };
}

/** Build a CompiledSlide from routed elements. */
export function buildRoutedSlide(
  routed: RouteOutput,
  slideId: string,
  intent: string,
  masterName: string,
  speakerNotes?: string,
): CompiledSlide {
  return {
    slideId,
    intent,
    masterName,
    elements: routed.elements,
    fontsUsed: routed.fontsUsed,
    speakerNotes,
  };
}
