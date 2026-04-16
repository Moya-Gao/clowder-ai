/**
 * Generate compressed "three days productization" showcase.
 * Orchestrates: slide specs → flat extract → density gate → screenshot → PPTX.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type Browser, chromium } from 'playwright';

import { buildCompiledDeck } from '../src/compiler/compiled-builder.js';
import { densityGate } from '../src/compiler/density-analyzer.js';
import { buildRoutedSlide, routeElements } from '../src/compiler/element-router.js';
import { closeFlatBrowser, flatExtract } from '../src/compiler/flat-dom-compiler.js';
import { inlineLocalAssetUrls } from '../src/compiler/html-asset-inliner.js';
import type { CompiledDeck } from '../src/compiler/types.js';
import { MASTER_NAMES } from '../src/master-builder.js';
import type { ThemeTokens } from '../src/types.js';

import { buildSlides } from './showcase-slides.js';

const DIR = import.meta.dirname;
const OUTPUT_DIR = '/tmp/ppt-forge-showcase-v2';
const DECK_DIR = resolve(OUTPUT_DIR, 'three-days-productization-compressed');
const THEME = JSON.parse(readFileSync(resolve(DIR, '../src/themes/huawei-like.json'), 'utf-8')) as ThemeTokens;

// ── Screenshot helpers ──

let screenshotBrowser: Browser | null = null;

async function getScreenshotBrowser(): Promise<Browser> {
  if (!screenshotBrowser) screenshotBrowser = await chromium.launch({ headless: true });
  return screenshotBrowser;
}

async function screenshot(html: string, outputPath: string): Promise<void> {
  const browser = await getScreenshotBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await page.setContent(inlineLocalAssetUrls(html), { waitUntil: 'networkidle' });
  await page.screenshot({ path: outputPath, type: 'png' });
  await page.close();
}

async function closeScreenshotBrowser(): Promise<void> {
  if (screenshotBrowser) {
    await screenshotBrowser.close();
    screenshotBrowser = null;
  }
}

// ── Main ──

async function main() {
  mkdirSync(DECK_DIR, { recursive: true });
  const slides = buildSlides();
  const compiledSlides = [];
  const slideReports = [];

  for (const slide of slides) {
    const htmlPath = resolve(DECK_DIR, `${slide.id}.html`);
    const pngPath = resolve(DECK_DIR, `${slide.id}.png`);
    writeFileSync(htmlPath, slide.html);

    const extracted = await flatExtract(slide.html);
    const gate = densityGate(extracted.elements);
    if (!gate.passed) {
      throw new Error(`${slide.id} failed density gate: ${gate.reason}`);
    }

    await screenshot(slide.html, pngPath);

    const routed = routeElements({ strategy: 'flat', flat: extracted });
    compiledSlides.push(
      buildRoutedSlide(
        routed,
        slide.id,
        slide.intent === 'cover' ? 'cover' : 'content',
        slide.intent === 'cover' ? MASTER_NAMES.COVER : MASTER_NAMES.CONTENT,
      ),
    );
    slideReports.push({
      slideId: slide.id,
      whitespace: gate.report.whitespaceRatio,
      elements: gate.report.elementCount,
      overflow: gate.report.overflowCount,
      htmlPath,
      pngPath,
    });
  }

  const deck: CompiledDeck = {
    slides: compiledSlides,
    fontsUsed: [...new Set(compiledSlides.flatMap((slide) => slide.fontsUsed))],
  };
  const pres = buildCompiledDeck(deck, THEME);
  const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
  const pptxPath = resolve(DECK_DIR, 'three-days-productization-compressed.pptx');
  writeFileSync(pptxPath, buffer);

  writeFileSync(resolve(DECK_DIR, 'report.json'), JSON.stringify(slideReports, null, 2));
  console.log(JSON.stringify({ pptxPath, slides: slideReports }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeFlatBrowser();
    await closeScreenshotBrowser();
  });
