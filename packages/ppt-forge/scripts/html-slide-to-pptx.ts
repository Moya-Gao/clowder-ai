#!/usr/bin/env tsx

/**
 * HTML Slide -> PPTX Converter
 *
 * Strategy: Screenshot-first + selective native overlays
 *
 *   Layer 0: Hi-res screenshot of the full HTML slide as background image
 *            (guarantees 100% visual parity with the HTML)
 *   Layer 1: Editable table overlay at the exact position
 *            (the most frequently edited element stays native/editable)
 *
 * This approach accepts that CSS layout (flexbox, grid, absolute positioning,
 * overflow clipping) cannot be faithfully reproduced by flat text box extraction.
 * Instead, we guarantee visual fidelity via screenshot and add editability
 * only where it matters most.
 *
 * Coordinate mapping: 1280px / 13.333" = 96 px/inch (LAYOUT_WIDE)
 *
 * Usage:
 *   tsx scripts/html-slide-to-pptx.ts [input.html] [output.pptx]
 */

import { resolve } from 'path';
import { chromium } from 'playwright';
import PptxGenJSDefault from 'pptxgenjs';
import { SCREENSHOT_SCALE } from '../src/compiler/types.js';

// Handle CJS/ESM interop (same pattern as compiled-builder.ts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PptxGenJS: any = (PptxGenJSDefault as any).default ?? PptxGenJSDefault;

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const VP_W = 1280;
const VP_H = 720;
const PX_PER_INCH = VP_W / SLIDE_W; // 96

// ── Table extraction script (browser-side, plain ES5) ──

const TABLE_EXTRACT_SCRIPT = `(() => {
  var slide = document.querySelector('.slide') || document.querySelector('.ppt-slide');
  if (!slide) return null;
  var sr = slide.getBoundingClientRect();
  var PX = sr.width / ${SLIDE_W};

  function hex(rgb) {
    if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return '';
    var m = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return '';
    return [m[1],m[2],m[3]].map(function(c){
      return parseInt(c).toString(16).padStart(2,'0').toUpperCase();
    }).join('');
  }

  var tableEl = document.querySelector('table');
  if (!tableEl) return null;

  var tRect = tableEl.getBoundingClientRect();
  var headers = [];
  var firstRow = tableEl.querySelector('tr');
  if (firstRow) {
    firstRow.querySelectorAll('th').forEach(function(th) {
      // Get only the main text, skip sub-labels
      var t = '';
      th.childNodes.forEach(function(n) {
        if (n.nodeType === 3) t += n.textContent;
        else if (n.nodeName === 'BR') t += '\\n';
        else if (n.tagName === 'SPAN') {} // skip dim/sub spans
        else t += n.textContent || '';
      });
      headers.push(t.trim());
    });
  }

  var rows = [];
  var allTrs = tableEl.querySelectorAll('tr');
  for (var i = 1; i < allTrs.length; i++) {
    var cells = [];
    allTrs[i].querySelectorAll('td').forEach(function(td) {
      var tdCs = getComputedStyle(td);
      cells.push({
        text: td.textContent.trim(),
        bgColor: hex(tdCs.backgroundColor),
        fontColor: hex(tdCs.color),
        bold: parseInt(tdCs.fontWeight, 10) >= 700
      });
    });
    if (cells.length) rows.push(cells);
  }

  return {
    rect: {
      x: (tRect.left - sr.left) / PX,
      y: (tRect.top - sr.top) / PX,
      w: tRect.width / PX,
      h: tRect.height / PX
    },
    headers: headers,
    rows: rows
  };
})()`;

// ── Types ──

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TableCell {
  text: string;
  bgColor: string;
  fontColor: string;
  bold: boolean;
}

interface ExtractedTable {
  rect: Rect;
  headers: string[];
  rows: TableCell[][];
}

// ── Main ──

async function main(): Promise<void> {
  const pkgRoot = resolve(import.meta.dirname ?? '.', '..');
  const htmlPath = resolve(pkgRoot, process.argv[2] ?? 'examples/d5-architecture-slice.html');
  const outputPath = resolve(pkgRoot, process.argv[3] ?? 'examples/d5-architecture-slice.pptx');

  console.log(`Input:  ${htmlPath}`);
  console.log(`Output: ${outputPath}`);

  // ── Step 1: Open in Playwright ──
  console.log('\n1. Launching Playwright...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: VP_W, height: VP_H },
    deviceScaleFactor: SCREENSHOT_SCALE, // 4x → 5120×2880, sharp on 5K/Retina
  });
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout: 15000 });

  // Support both .slide (legacy) and .ppt-slide (relay-claw convention)
  const slideEl = (await page.$('.slide')) ?? (await page.$('.ppt-slide'));
  if (!slideEl) {
    console.error('ERROR: No .slide or .ppt-slide element found in HTML');
    process.exit(1);
  }

  // ── Step 2: Extract table BEFORE hiding it ──
  console.log('2. Extracting table for editable overlay...');
  const table = (await page.evaluate(TABLE_EXTRACT_SCRIPT)) as ExtractedTable | null;
  if (table) {
    console.log(
      `   Table: ${table.headers.length} cols x ${table.rows.length} rows at (${table.rect.x.toFixed(2)}", ${table.rect.y.toFixed(2)}")`,
    );
  } else {
    console.log('   No table found');
  }

  // ── Step 3: Screenshot with table hidden (avoid overlay ghosting) ──
  // visibility:hidden keeps layout space but hides rendering,
  // so the native table overlay won't double-render on top of the screenshot
  console.log('3. Taking full-slide screenshot (table hidden)...');
  if (table) {
    await page.evaluate(() => {
      const t = document.querySelector('table');
      if (t) t.style.visibility = 'hidden';
    });
  }
  const screenshot = await slideEl.screenshot({ type: 'png' });
  const screenshotBase64 = screenshot.toString('base64');
  console.log(`   Screenshot: ${(screenshot.length / 1024).toFixed(0)}KB${table ? ' (table area blanked)' : ''}`);

  // ── Step 4: HTML reference screenshot (table restored, full visual truth) ──
  if (table) {
    await page.evaluate(() => {
      const t = document.querySelector('table');
      if (t) t.style.visibility = 'visible';
    });
  }
  const htmlScreenshotPath = outputPath.replace(/\.pptx$/, '-html-ref.png');
  await slideEl.screenshot({ path: htmlScreenshotPath, type: 'png' });
  console.log(`4. HTML reference saved: ${htmlScreenshotPath}`);

  await browser.close();

  // ── Step 5: Build PPTX ──
  console.log('5. Building PPTX...');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pres: any = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = 'D5 — Cat Cafe 双层架构：对等判断 + 结构化执行';
  pres.author = 'Cat Cafe PPT Forge';

  const slide = pres.addSlide();

  // Layer 0: Full-page screenshot as background (visual fidelity guarantee)
  slide.addImage({
    data: `image/png;base64,${screenshotBase64}`,
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
  });

  // Layer 1: Editable table overlay (most frequently edited content)
  if (table) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableRows: any[][] = [];

    // Header row
    if (table.headers.length) {
      tableRows.push(
        table.headers.map((h) => ({
          text: h,
          options: {
            bold: true,
            color: 'FFFFFF',
            fill: { color: 'C7020E' },
            fontSize: 6,
            fontFace: 'Microsoft YaHei',
          },
        })),
      );
    }

    // Data rows
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      tableRows.push(
        row.map((cell) => ({
          text: cell.text,
          options: {
            fontSize: 6,
            fontFace: 'Microsoft YaHei',
            color: cell.fontColor || '333333',
            ...(cell.bgColor ? { fill: { color: cell.bgColor } } : i % 2 === 1 ? { fill: { color: 'FAFAFA' } } : {}),
            ...(cell.bold ? { bold: true } : {}),
          },
        })),
      );
    }

    slide.addTable(tableRows, {
      x: table.rect.x,
      y: table.rect.y,
      w: table.rect.w,
      h: table.rect.h,
      fontSize: 6,
      fontFace: 'Microsoft YaHei',
      border: { type: 'solid', pt: 0.5, color: 'E0E0E0' },
      autoPage: false,
    });
  }

  // ── Step 6: Write PPTX ──
  await pres.writeFile({ fileName: outputPath });
  console.log(`\n Done!`);
  console.log(`   PPTX: ${outputPath}`);
  console.log(`   HTML ref: ${htmlScreenshotPath}`);
  console.log(`   Slide: ${SLIDE_W}" x ${SLIDE_H}" (LAYOUT_WIDE)`);
  console.log(`   Visual: screenshot background (100% HTML parity)`);
  console.log(`   Editable: ${table ? '1 table overlay' : 'none'}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
