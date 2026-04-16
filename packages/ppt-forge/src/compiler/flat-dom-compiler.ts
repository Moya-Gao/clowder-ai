/**
 * F144 Phase D — Flat DOM Compiler
 *
 * Walks ALL visible DOM elements (no data-ppt-role annotations needed).
 * Emits backgrounds, borders, and leaf text as CompiledElement[].
 * Elements with data-ppt-mode are recorded as SemanticZones for the
 * element-router to fill via chart/table/kpi native API.
 *
 * PX_PER_INCH = 96 for LAYOUT_WIDE (1280px / 13.33" = 96).
 */

import { type Browser, chromium } from 'playwright';

import { inlineLocalAssetUrls } from './html-asset-inliner.js';
import type { CompiledElement, CompiledSlide, CompiledStyle, TextRun } from './types.js';

export interface SemanticZone {
  mode: string;
  rect: { x: number; y: number; w: number; h: number };
  data: Record<string, string>;
}

export interface FlatExtractResult {
  elements: CompiledElement[];
  semanticZones: SemanticZone[];
  fontsUsed: string[];
}

// ── Browser-side extraction (plain ES5, no closures over Node) ──

const FLAT_EXTRACT_SCRIPT = `
(() => {
  var slide = document.querySelector('.ppt-slide');
  if (!slide) return { elements: [], zones: [] };
  var sr = slide.getBoundingClientRect();
  var PX = sr.width / 13.333;
  var elements = [];
  var zones = [];

  function hex(rgb) {
    if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return '';
    var m = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return '';
    return [m[1],m[2],m[3]].map(function(c){
      return parseInt(c).toString(16).padStart(2,'0').toUpperCase();
    }).join('');
  }

  function isLeafText(el) {
    if (!el.textContent || !el.textContent.trim()) return false;
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].textContent && el.children[i].textContent.trim()) return false;
    }
    return true;
  }

  function toRect(r) {
    return {
      x: (r.left - sr.left) / PX,
      y: (r.top - sr.top) / PX,
      w: r.width / PX,
      h: r.height / PX
    };
  }

  function walk(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    var mode = el.getAttribute && el.getAttribute('data-ppt-mode');
    if (mode) {
      var data = {};
      for (var j = 0; j < el.attributes.length; j++) {
        var a = el.attributes[j];
        if (a.name.startsWith('data-')) data[a.name] = a.value;
      }
      zones.push({ mode: mode, rect: toRect(rect), data: data });
      return;
    }

    var cs = getComputedStyle(el);
    var bg = hex(cs.backgroundColor);

    if (bg && bg !== 'FFFFFF' && bg !== 'F9FAFB') {
      elements.push({
        kind: 'bg', x: toRect(rect).x, y: toRect(rect).y,
        w: toRect(rect).w, h: toRect(rect).h, fill: bg
      });
    }

    var blw = parseFloat(cs.borderLeftWidth) || 0;
    var blc = hex(cs.borderLeftColor);
    if (blw >= 3 && blc && blc !== 'E0E0E0') {
      elements.push({
        kind: 'accent', x: toRect(rect).x, y: toRect(rect).y,
        w: blw / PX, h: toRect(rect).h, fill: blc
      });
    }

    var bw = parseFloat(cs.borderWidth) || 0;
    var bc = hex(cs.borderColor);
    if (bw >= 0.5 && bw < 3 && bc && bc !== 'FFFFFF') {
      elements.push({
        kind: 'border', x: toRect(rect).x, y: toRect(rect).y,
        w: toRect(rect).w, h: toRect(rect).h,
        borderColor: bc, borderWidth: bw
      });
    }

    if (isLeafText(el)) {
      elements.push({
        kind: 'text', x: toRect(rect).x, y: toRect(rect).y,
        w: toRect(rect).w, h: toRect(rect).h,
        text: el.textContent.trim(),
        fontSize: parseFloat(cs.fontSize),
        fontFamily: cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
        color: hex(cs.color) || '000000',
        bold: parseInt(cs.fontWeight, 10) >= 700
      });
    }

    for (var i = 0; i < el.children.length; i++) walk(el.children[i]);
  }

  walk(slide);
  return { elements: elements, zones: zones };
})()
`;

// ── Raw browser output types ──

interface RawElement {
  kind: 'bg' | 'accent' | 'border' | 'text';
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  borderColor?: string;
  borderWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
}

interface RawResult {
  elements: RawElement[];
  zones: SemanticZone[];
}

// ── Conversion: raw → CompiledElement ──

function rawToCompiled(raw: RawElement): CompiledElement {
  const rect = { x: raw.x, y: raw.y, w: raw.w, h: raw.h };
  const style: CompiledStyle = {};

  if (raw.kind === 'text') {
    const run: TextRun = {
      text: raw.text ?? '',
      fontSize: (raw.fontSize ?? 12) * 0.75, // px → pt (×72/96)
      fontFamily: raw.fontFamily ?? 'Noto Sans SC',
      color: raw.color ?? '000000',
      bold: raw.bold,
    };
    return { role: 'text', rect, content: { type: 'text', runs: [run] }, style };
  }

  if (raw.kind === 'border') {
    style.borderColor = raw.borderColor;
    style.borderWidth = raw.borderWidth;
    return {
      role: 'shape',
      rect,
      content: { type: 'shape', shapeType: 'rect', fill: '' },
      style,
    };
  }

  // bg or accent
  const fill = raw.fill ?? 'CCCCCC';
  return {
    role: 'shape',
    rect,
    content: { type: 'shape', shapeType: 'rect', fill },
    style,
  };
}

// ── Public API ──

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser) sharedBrowser = await chromium.launch({ headless: true });
  return sharedBrowser;
}

export async function closeFlatBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

export interface FlatExtractOptions {
  /** Viewport width (default 1280 for LAYOUT_WIDE final, use 640 for draft) */
  viewportWidth?: number;
  /** Viewport height (default 720 for LAYOUT_WIDE final, use 360 for draft) */
  viewportHeight?: number;
}

/** Extract a single slide HTML into CompiledElement[] + SemanticZone[]. */
export async function flatExtract(html: string, options?: FlatExtractOptions): Promise<FlatExtractResult> {
  const vw = options?.viewportWidth ?? 1280;
  const vh = options?.viewportHeight ?? 720;
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  await page.setContent(inlineLocalAssetUrls(html), { waitUntil: 'networkidle' });
  const raw = (await page.evaluate(FLAT_EXTRACT_SCRIPT)) as RawResult;
  await page.close();

  const elements = raw.elements.map(rawToCompiled);
  const fontsUsed = new Set<string>();
  for (const el of elements) {
    if (el.content.type === 'text') {
      for (const run of el.content.runs) fontsUsed.add(run.fontFamily);
    }
  }

  return { elements, semanticZones: raw.zones, fontsUsed: [...fontsUsed] };
}

/** Extract multiple slide HTMLs, reusing a single browser. */
export async function flatExtractDeck(slideHtmls: string[]): Promise<FlatExtractResult[]> {
  const results: FlatExtractResult[] = [];
  for (const html of slideHtmls) results.push(await flatExtract(html));
  return results;
}

/** Convenience: flat extract → CompiledSlide (for pure-flat pages, no hybrid). */
export function toCompiledSlide(
  result: FlatExtractResult,
  slideId: string,
  intent: string,
  masterName: string,
): CompiledSlide {
  return {
    slideId,
    intent,
    masterName,
    elements: result.elements,
    fontsUsed: result.fontsUsed,
  };
}
