/**
 * F144 AC-D5 — Vertical Slice Orchestrator
 *
 * Single entry-point that chains the full AI-direct HTML → PPTX pipeline:
 *   flatExtract → densityGate → routeElements → buildCompiledDeck → buffer
 *
 * Designed for the AI-direct path (KD-16/KD-17): AI draws HTML+Tailwind,
 * this function turns it into an editable PPTX with native shapes/text.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Browser, chromium } from 'playwright';

import type { ThemeTokens } from '../types.js';
import { buildCompiledDeck } from './compiled-builder.js';
import { type DensityGateResult, densityGate } from './density-analyzer.js';
import { buildRoutedSlide, routeElements } from './element-router.js';
import { flatExtract } from './flat-dom-compiler.js';
import { inlineLocalAssetUrls } from './html-asset-inliner.js';
import { type CompiledDeck, SCREENSHOT_SCALE } from './types.js';

// ── Default theme (huawei-like) ──

const THEMES_DIR = join(fileURLToPath(import.meta.url), '..', '..', 'themes');

function loadDefaultTheme(): ThemeTokens {
  const raw = readFileSync(join(THEMES_DIR, 'huawei-like.json'), 'utf-8');
  return JSON.parse(raw) as ThemeTokens;
}

// ── Public types ──

export interface HtmlToSlideOptions {
  slideId: string;
  intent: string;
  masterName: string;
  /** Override density threshold (default 0.30) */
  densityThreshold?: number;
  /** Override theme (default: huawei-like) */
  theme?: ThemeTokens;
}

export interface HtmlToSlideResult {
  /** Original HTML input (four-piece #1) */
  html: string;
  /** 4x Retina screenshot PNG buffer (four-piece #2) */
  screenshot: Buffer;
  /** Density gate result with pass/fail + report (four-piece #3) */
  densityReport: DensityGateResult;
  /** Generated PPTX as a Node buffer (four-piece #4) */
  pptxBuffer: Buffer;
  /** Total extracted elements */
  elementCount: number;
  /** Text elements extracted (proves editability, not screenshot) */
  textCount: number;
}

// ── Screenshot capture ──

let screenshotBrowser: Browser | null = null;

async function captureScreenshot(html: string): Promise<Buffer> {
  if (!screenshotBrowser) screenshotBrowser = await chromium.launch({ headless: true });
  const page = await screenshotBrowser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: SCREENSHOT_SCALE,
  });
  await page.setContent(inlineLocalAssetUrls(html), { waitUntil: 'networkidle' });
  const shot = await page.screenshot({ type: 'png', fullPage: false });
  await page.close();
  return Buffer.from(shot);
}

export async function closeScreenshotBrowser(): Promise<void> {
  if (screenshotBrowser) {
    await screenshotBrowser.close();
    screenshotBrowser = null;
  }
}

// ── Main orchestrator ──

export async function htmlToSlide(html: string, options: HtmlToSlideOptions): Promise<HtmlToSlideResult> {
  const { slideId, intent, masterName, densityThreshold, theme } = options;

  // Step 1: Flat extract — Playwright renders HTML, walks DOM
  const extracted = await flatExtract(html);

  if (extracted.elements.length === 0) {
    throw new Error('No elements extracted — does the HTML contain a .ppt-slide container?');
  }

  // Step 2: Density gate — fail fast before expensive screenshot (cloud P2)
  const gate = densityGate(extracted.elements, densityThreshold ?? 0.3);
  if (!gate.passed) {
    throw new Error(`Density gate failed: ${gate.reason}`);
  }

  // Step 3: Screenshot capture (4x Retina PNG) — only for passing slides
  const screenshot = await captureScreenshot(html);

  // Step 4: Route elements (flat strategy for AI-direct path)
  const routed = routeElements({ strategy: 'flat', flat: extracted });

  // Step 5: Build compiled slide + deck
  const slide = buildRoutedSlide(routed, slideId, intent, masterName);
  const deck: CompiledDeck = {
    slides: [slide],
    fontsUsed: routed.fontsUsed,
  };

  // Step 6: Build PPTX via pptxgenjs
  const resolvedTheme = theme ?? loadDefaultTheme();
  const pres = buildCompiledDeck(deck, resolvedTheme);
  const pptxBuffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;

  // Count text elements for editability proof
  const textCount = extracted.elements.filter((e) => e.content.type === 'text').length;

  return {
    html,
    screenshot,
    densityReport: gate,
    pptxBuffer,
    elementCount: extracted.elements.length,
    textCount,
  };
}
