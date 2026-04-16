/**
 * F144 Phase B — Playwright Layout Evaluator
 *
 * Takes HTML string → launches headless Chromium → evaluates DOM
 * → extracts bounding rects + computed styles + text content
 * for all elements marked with data-ppt-role.
 *
 * Fixed viewport: 1280×720 px = 10" × 5.625" slide.
 */

import { type Browser, chromium } from 'playwright';

import { inlineLocalAssetUrls } from './html-asset-inliner.js';

export interface EvaluatedNode {
  role: string;
  slotName?: string;
  boxId?: string;
  rect: { x: number; y: number; w: number; h: number };
  computedStyle: {
    fontSize: number;
    fontFamily: string;
    color: string;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
  };
  textContent?: string;
  children: EvaluatedNode[];
  tableData?: {
    headers: string[];
    rows: { cells: (string | { text: string; bgColor?: string; fontColor?: string; bold?: boolean })[] }[];
  };
  chartData?: { chartType: string; data: unknown };
}

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser) {
    sharedBrowser = await chromium.launch({ headless: true });
  }
  return sharedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

/**
 * The extraction script as a string to avoid tsx/esbuild __name decoration
 * leaking into the browser context. This is pure browser-side JS.
 */
const EXTRACT_SCRIPT = `
(() => {
  function findRoleChildren(el, out) {
    if (el.hasAttribute && el.hasAttribute('data-ppt-role')) {
      out.push(el);
      return;
    }
    for (const child of el.children) {
      findRoleChildren(child, out);
    }
  }

  function extractNode(el) {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const role = el.getAttribute('data-ppt-role') || 'unknown';

    const childElements = [];
    for (const child of el.children) {
      findRoleChildren(child, childElements);
    }

    const node = {
      role: role,
      slotName: el.getAttribute('data-slot-name') || undefined,
      boxId: el.getAttribute('data-box-id') || undefined,
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      },
      computedStyle: {
        fontSize: parseFloat(cs.fontSize) || 0,
        fontFamily: cs.fontFamily,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderColor,
        borderWidth: parseFloat(cs.borderWidth) || 0,
        borderRadius: parseFloat(cs.borderRadius) || 0,
      },
      children: childElements.map(function(c) { return extractNode(c); }),
    };

    if (role === 'text' || role === 'shape') {
      node.textContent = (el.textContent || '').trim();
    }

    if (role === 'table') {
      const table = el.querySelector('table');
      if (table) {
        const headers = [];
        table.querySelectorAll('thead th').forEach(function(th) {
          headers.push((th.textContent || '').trim());
        });
        const rows = [];
        table.querySelectorAll('tbody tr').forEach(function(tr) {
          const cells = [];
          tr.querySelectorAll('td').forEach(function(td) {
            var tdCs = getComputedStyle(td);
            cells.push({
              text: (td.textContent || '').trim(),
              bgColor: tdCs.backgroundColor,
              fontColor: tdCs.color,
              bold: parseInt(tdCs.fontWeight, 10) >= 700 || tdCs.fontWeight === 'bold',
            });
          });
          rows.push({ cells: cells });
        });
        node.tableData = { headers: headers, rows: rows };
      }
    }

    if (role === 'chart') {
      const chartType = el.getAttribute('data-chart-type') || '';
      const dataStr = el.getAttribute('data-chart-data');
      var data = null;
      if (dataStr) {
        try { data = JSON.parse(dataStr); } catch(e) {}
      }
      node.chartData = { chartType: chartType, data: data };
    }

    return node;
  }

  const topLevel = [];
  document.querySelectorAll('[data-ppt-role]').forEach(function(el) {
    if (!el.parentElement || !el.parentElement.closest('[data-ppt-role]')) {
      topLevel.push(el);
    }
  });

  return topLevel.map(function(el) { return extractNode(el); });
})()
`;

/** Evaluate a single slide HTML and extract all data-ppt-role elements with their computed rects. */
export async function evaluateLayout(html: string): Promise<EvaluatedNode[]> {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(inlineLocalAssetUrls(html), { waitUntil: 'load' });
  const nodes = (await page.evaluate(EXTRACT_SCRIPT)) as EvaluatedNode[];
  await page.close();
  return nodes;
}

/** Evaluate multiple slide HTMLs, reusing a single browser instance. */
export async function evaluateDeck(slideHtmls: string[]): Promise<EvaluatedNode[][]> {
  const browser = await getBrowser();
  const results: EvaluatedNode[][] = [];
  for (const html of slideHtmls) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.setContent(inlineLocalAssetUrls(html), { waitUntil: 'load' });
    const nodes = (await page.evaluate(EXTRACT_SCRIPT)) as EvaluatedNode[];
    results.push(nodes);
    await page.close();
  }
  return results;
}
