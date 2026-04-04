/**
 * F144 Phase D — Flat DOM Compiler + Element Router tests
 *
 * Vertical slice #2: hybrid page with KPI (flat) + chart zone + table zone (semantic).
 * Proves: same slide mixes flat-extracted text with native chart/table API.
 */

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildCompiledDeck } from '../src/compiler/compiled-builder.js';
import { buildRoutedSlide, routeElements } from '../src/compiler/element-router.js';
import type { SemanticZone } from '../src/compiler/flat-dom-compiler.js';
import { closeFlatBrowser, flatExtract } from '../src/compiler/flat-dom-compiler.js';
import type { CompiledElement } from '../src/compiler/types.js';
import type { ThemeTokens } from '../src/types.js';

const theme: ThemeTokens = JSON.parse(
  readFileSync(new URL('../src/themes/huawei-like.json', import.meta.url), 'utf-8'),
);

const __dirname = dirname(fileURLToPath(import.meta.url));
const HYBRID_HTML = join(__dirname, '..', 'examples', 'spike-d2-hybrid.html');

describe('flat-dom-compiler', () => {
  after(async () => {
    await closeFlatBrowser();
  });

  it('extracts flat elements and identifies semantic zones', async () => {
    const html = readFileSync(HYBRID_HTML, 'utf-8');
    const result = await flatExtract(html);

    // Should have flat elements: backgrounds, KPI text, summary text
    assert.ok(result.elements.length >= 15, `expected ≥15 flat elements, got ${result.elements.length}`);

    // Should identify 2 semantic zones (chart + table)
    assert.equal(result.semanticZones.length, 2, 'should find 2 semantic zones');

    const chartZone = result.semanticZones.find((z) => z.mode === 'chart');
    const tableZone = result.semanticZones.find((z) => z.mode === 'table');
    assert.ok(chartZone, 'should find chart zone');
    assert.ok(tableZone, 'should find table zone');

    // Chart zone should carry data attributes
    assert.ok(chartZone.data['data-chart-type'], 'chart zone should have chart-type');
    assert.ok(chartZone.data['data-chart-data'], 'chart zone should have chart-data');

    // Table zone should carry data attributes
    assert.ok(tableZone.data['data-table-headers'], 'table zone should have headers');
    assert.ok(tableZone.data['data-table-rows'], 'table zone should have rows');

    // KPI values should be in flat elements
    const texts = result.elements.filter((e) => e.content.type === 'text');
    const kpiValue = texts.find((t) => {
      if (t.content.type !== 'text') return false;
      return t.content.runs.some((r) => r.text.includes('98.7%'));
    });
    assert.ok(kpiValue, 'KPI value 98.7% should be flat-extracted');

    console.log(`✅ Flat extract: ${result.elements.length} elements, ${result.semanticZones.length} semantic zones`);
  });
});

describe('element-router', () => {
  after(async () => {
    await closeFlatBrowser();
  });

  it('routes flat-only slide (no semantic zones)', async () => {
    const html = readFileSync(HYBRID_HTML, 'utf-8');
    const flat = await flatExtract(html);

    const routed = routeElements({ strategy: 'flat', flat });
    assert.equal(routed.elements.length, flat.elements.length, 'flat strategy returns all flat elements');
  });

  it('routes hybrid slide with semantic provider', async () => {
    const html = readFileSync(HYBRID_HTML, 'utf-8');
    const flat = await flatExtract(html);

    const provider = (zone: SemanticZone): CompiledElement[] => {
      if (zone.mode === 'chart') {
        const chartData = JSON.parse(zone.data['data-chart-data']);
        return [
          {
            role: 'chart',
            rect: zone.rect,
            content: {
              type: 'chart',
              chartType: zone.data['data-chart-type'] || 'bar',
              data: chartData,
            },
            style: {},
          },
        ];
      }
      if (zone.mode === 'table') {
        const headers = (zone.data['data-table-headers'] || '').split(',');
        const rows = JSON.parse(zone.data['data-table-rows'] || '[]');
        return [
          {
            role: 'table',
            rect: zone.rect,
            content: {
              type: 'table',
              headers,
              rows: rows.map((cells: string[]) => ({
                cells: cells.map((text: string) => ({ text })),
              })),
            },
            style: {},
          },
        ];
      }
      return [];
    };

    const routed = routeElements({ strategy: 'hybrid', flat, semanticProvider: provider });

    // Should have flat elements + chart + table
    const charts = routed.elements.filter((e) => e.role === 'chart');
    const tables = routed.elements.filter((e) => e.role === 'table');
    assert.equal(charts.length, 1, 'should have 1 chart from semantic provider');
    assert.equal(tables.length, 1, 'should have 1 table from semantic provider');
    assert.ok(routed.elements.length > flat.elements.length, 'hybrid should have more elements than flat alone');

    console.log(
      `✅ Hybrid route: ${routed.elements.length} total (${flat.elements.length} flat + ${charts.length} chart + ${tables.length} table)`,
    );
  });

  it('P1 regression: hybrid with semanticElements (no provider) merges correctly', async () => {
    const html = readFileSync(HYBRID_HTML, 'utf-8');
    const flat = await flatExtract(html);

    const semanticElements: CompiledElement[] = [
      {
        role: 'chart',
        rect: { x: 1, y: 1, w: 2, h: 2 },
        content: {
          type: 'chart',
          chartType: 'bar',
          data: { series: [{ name: 'S', values: [1, 2, 3] }], categories: ['A', 'B', 'C'] },
        },
        style: {},
      },
    ];

    const routed = routeElements({ strategy: 'hybrid', flat, semanticElements });
    const charts = routed.elements.filter((e) => e.role === 'chart');
    assert.equal(charts.length, 1, 'P1: hybrid without provider should still include semanticElements');
    assert.ok(routed.elements.length > flat.elements.length, 'P1: total should exceed flat count');
  });

  it('P2 regression: border-only shapes have no fill (transparent)', async () => {
    const html = `<!DOCTYPE html><html><head><style>
      * { margin:0; padding:0; box-sizing:border-box; }
      .ppt-slide { width:1280px; height:720px; background:#222222; }
      .border-only { width:200px; height:100px; border:1px solid #1677FF; margin:20px; }
    </style></head><body>
    <div class="ppt-slide"><div class="border-only"></div></div>
    </body></html>`;

    const result = await flatExtract(html);
    const borderShapes = result.elements.filter((e) => e.content.type === 'shape' && e.style.borderColor);
    assert.ok(borderShapes.length >= 1, 'should have at least 1 border shape');
    for (const s of borderShapes) {
      if (s.content.type === 'shape') {
        assert.equal(s.content.fill, '', 'P2: border shape fill must be empty (transparent), not FFFFFF');
      }
    }
  });

  it('produces valid .pptx from hybrid route', async () => {
    const html = readFileSync(HYBRID_HTML, 'utf-8');
    const flat = await flatExtract(html);

    const provider = (zone: SemanticZone): CompiledElement[] => {
      if (zone.mode === 'chart') {
        return [
          {
            role: 'chart',
            rect: zone.rect,
            content: {
              type: 'chart',
              chartType: zone.data['data-chart-type'] || 'bar',
              data: JSON.parse(zone.data['data-chart-data']),
            },
            style: {},
          },
        ];
      }
      if (zone.mode === 'table') {
        const headers = (zone.data['data-table-headers'] || '').split(',');
        const rows = JSON.parse(zone.data['data-table-rows'] || '[]');
        return [
          {
            role: 'table',
            rect: zone.rect,
            content: {
              type: 'table',
              headers,
              rows: rows.map((cells: string[]) => ({
                cells: cells.map((text: string) => ({ text })),
              })),
            },
            style: {},
          },
        ];
      }
      return [];
    };

    const routed = routeElements({ strategy: 'hybrid', flat, semanticProvider: provider });
    const slide = buildRoutedSlide(routed, 'hybrid-1', 'dashboard', 'MASTER_CONTENT', '华为 IT 架构运营指标总览');

    // Use compiled-builder to produce PPTX
    const deck = { slides: [slide], fontsUsed: slide.fontsUsed };
    const pres = buildCompiledDeck(deck, theme);

    const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
    const outPath = join(__dirname, '..', 'examples', 'spike-d2-hybrid-output.pptx');
    writeFileSync(outPath, buffer);

    assert.ok(buffer.length > 10000, `PPTX too small: ${buffer.length} bytes`);

    // Count element types
    const textCount = routed.elements.filter((e) => e.role === 'text').length;
    const shapeCount = routed.elements.filter((e) => e.role === 'shape').length;
    const chartCount = routed.elements.filter((e) => e.role === 'chart').length;
    const tableCount = routed.elements.filter((e) => e.role === 'table').length;

    console.log(`✅ Hybrid PPTX: ${outPath}`);
    console.log(
      `   ${routed.elements.length} elements: ${textCount} text, ${shapeCount} shape, ${chartCount} chart, ${tableCount} table`,
    );
    console.log(`   ${buffer.length} bytes`);
  });
});
