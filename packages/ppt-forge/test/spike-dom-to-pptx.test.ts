/**
 * F144 Phase D Spike — dom-to-pptx vertical slice
 *
 * Proves: cat-drawn HTML → Playwright flat extract → pptxgenjs native shapes → .pptx
 * Acceptance: text editable, no screenshot, density preserved, PPT Online opens.
 */

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium } from 'playwright';
import PptxGenJSDefault from 'pptxgenjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PptxGenJS: any = (PptxGenJSDefault as any).default ?? PptxGenJSDefault;

const __dirname = dirname(fileURLToPath(import.meta.url));
/** LAYOUT_WIDE = 13.33" × 7.5". Viewport 1280×720 → 1280/13.33 = 96 px/inch. */
const _PX_PER_INCH = 96;

// ── Types ──────────────────────────────────────────────

interface ExtractedShape {
  type: 'shape';
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

interface ExtractedText {
  type: 'text';
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
}

type ExtractedElement = ExtractedShape | ExtractedText;

// ── Flat Extraction Script (browser-side) ──────────────

const FLAT_EXTRACT_SCRIPT = `
(() => {
  const PX = 96;
  const slide = document.querySelector('.ppt-slide');
  if (!slide) return [];
  const sr = slide.getBoundingClientRect();
  const out = [];

  function hex(rgb) {
    if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return '';
    const m = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return '';
    return [m[1],m[2],m[3]].map(function(c){ return parseInt(c).toString(16).padStart(2,'0').toUpperCase(); }).join('');
  }

  function isLeafText(el) {
    if (!el.textContent || !el.textContent.trim()) return false;
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].textContent && el.children[i].textContent.trim()) return false;
    }
    return true;
  }

  function walk(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    var cs = getComputedStyle(el);
    var bg = hex(cs.backgroundColor);

    // Emit non-white, non-empty backgrounds
    if (bg && bg !== 'FFFFFF' && bg !== 'F9FAFB') {
      out.push({
        type: 'shape',
        x: (rect.left - sr.left) / PX,
        y: (rect.top - sr.top) / PX,
        w: rect.width / PX,
        h: rect.height / PX,
        fill: bg,
      });
    }

    // Emit card left-border accent
    var blw = parseFloat(cs.borderLeftWidth) || 0;
    var blc = hex(cs.borderLeftColor);
    if (blw >= 3 && blc && blc !== 'E0E0E0') {
      out.push({
        type: 'shape',
        x: (rect.left - sr.left) / PX,
        y: (rect.top - sr.top) / PX,
        w: blw / PX,
        h: rect.height / PX,
        fill: blc,
      });
    }

    // Emit card outline (thin border)
    var bw = parseFloat(cs.borderWidth) || 0;
    var bc = hex(cs.borderColor);
    if (bw >= 0.5 && bw < 3 && bc && bc !== 'FFFFFF') {
      out.push({
        type: 'shape',
        x: (rect.left - sr.left) / PX,
        y: (rect.top - sr.top) / PX,
        w: rect.width / PX,
        h: rect.height / PX,
        fill: '',
        border: { color: bc, width: bw },
      });
    }

    // Emit leaf text
    if (isLeafText(el)) {
      out.push({
        type: 'text',
        x: (rect.left - sr.left) / PX,
        y: (rect.top - sr.top) / PX,
        w: rect.width / PX,
        h: rect.height / PX,
        text: el.textContent.trim(),
        fontSize: parseFloat(cs.fontSize),
        fontFamily: cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
        color: hex(cs.color) || '000000',
        bold: parseInt(cs.fontWeight, 10) >= 700,
      });
    }

    for (var i = 0; i < el.children.length; i++) {
      walk(el.children[i]);
    }
  }

  walk(slide);
  return out;
})()
`;

// ── Test Suite ──────────────────────────────────────────

describe('Phase D Spike: dom-to-pptx', () => {
  let browser: Browser;

  after(async () => {
    if (browser) await browser.close();
  });

  it('extracts visible elements from spike HTML', async () => {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const html = readFileSync(join(__dirname, '..', 'examples', 'spike-d1-arch-final.html'), 'utf-8');
    await page.setContent(html, { waitUntil: 'networkidle' });

    const elements = (await page.evaluate(FLAT_EXTRACT_SCRIPT)) as ExtractedElement[];
    await page.close();

    // Should have shapes (nav bars, card borders) + texts (title, bullets, descriptions)
    const shapes = elements.filter((e) => e.type === 'shape');
    const texts = elements.filter((e) => e.type === 'text') as ExtractedText[];

    assert.ok(shapes.length >= 2, `need nav bar shapes, got ${shapes.length}`);
    assert.ok(texts.length >= 40, `need 40+ text elements (titles+kpis+labels+descs+summaries), got ${texts.length}`);

    // Verify title
    const title = texts.find((t) => t.text.includes('两层架构'));
    assert.ok(title, 'should find slide title');
  });

  it('produces valid .pptx with native shapes', async () => {
    browser = browser || (await chromium.launch({ headless: true }));
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const html = readFileSync(join(__dirname, '..', 'examples', 'spike-d1-arch-final.html'), 'utf-8');
    await page.setContent(html, { waitUntil: 'networkidle' });

    const elements = (await page.evaluate(FLAT_EXTRACT_SCRIPT)) as ExtractedElement[];
    await page.close();

    // Build PPTX
    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_WIDE'; // 13.33" × 7.5"
    pres.author = 'Cat Café PPT Forge — Phase D Spike';

    const slide = pres.addSlide();

    for (const el of elements) {
      if (el.type === 'shape') {
        const opts: Record<string, unknown> = {
          x: el.x,
          y: el.y,
          w: el.w,
          h: el.h,
        };
        if (el.fill) opts.fill = { color: el.fill };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const border = (el as any).border;
        if (border) {
          opts.line = { color: border.color, width: border.width };
          if (!el.fill) opts.fill = { color: 'FFFFFF', type: 'none' };
        }
        slide.addShape('rect', opts);
      } else {
        const t = el as ExtractedText;
        slide.addText(
          [
            {
              text: t.text,
              options: {
                fontSize: t.fontSize * 0.75, // px to pt
                fontFace: t.fontFamily || 'Noto Sans SC',
                color: t.color,
                bold: t.bold,
              },
            },
          ],
          {
            x: t.x,
            y: t.y,
            w: t.w,
            h: t.h,
            valign: 'top',
            wrap: true,
            margin: 0,
          },
        );
      }
    }

    slide.addNotes('两层架构：对等判断 + 结构化执行 — 缺一不可\nPhase D Spike — 24 leaf architecture page');

    // Write to file
    const outPath = join(__dirname, '..', 'examples', 'spike-d1-output.pptx');
    const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
    writeFileSync(outPath, buffer);

    // Verify output
    assert.ok(buffer.length > 10000, `PPTX too small (${buffer.length} bytes), likely empty`);

    const textCount = elements.filter((e) => e.type === 'text').length;
    console.log(`✅ PPTX written: ${outPath}`);
    console.log(`   ${elements.length} elements (${textCount} text, ${elements.length - textCount} shapes)`);
    console.log(`   ${buffer.length} bytes`);
  });
});
