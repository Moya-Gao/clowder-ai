import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildDeck } from '../src/slide-builder.js';
import type { DeckBlueprint, ThemeTokens } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf-8'));
}

function loadTheme(): ThemeTokens {
  return JSON.parse(readFileSync(join(__dirname, '..', 'src', 'themes', 'huawei-like.json'), 'utf-8'));
}

describe('Integration: Huawei Demo 10-page PPT', () => {
  const blueprint = loadFixture<DeckBlueprint>('huawei-demo-blueprint.json');
  const theme = loadTheme();

  it('blueprint has 10 slides', () => {
    assert.equal(blueprint.slides.length, 10);
  });

  it('buildDeck succeeds without throwing', () => {
    assert.doesNotThrow(() => buildDeck(blueprint, theme));
  });

  it('produces correct slide count', () => {
    const pres = buildDeck(blueprint, theme);
    const slides = (pres as unknown as { slides: unknown[] }).slides;
    assert.equal(slides.length, 10);
  });

  it('covers all element types: text, kpi, chart, table', () => {
    const types = new Set(blueprint.slides.flatMap((s) => s.elements.map((e) => e.type)));
    assert.ok(types.has('text'));
    assert.ok(types.has('kpi'));
    assert.ok(types.has('chart'));
    assert.ok(types.has('table'));
  });

  it('dense-table slide has per-cell color coding', () => {
    const tableSlide = blueprint.slides.find((s) => s.slideId === 'slide-dense-table');
    assert.ok(tableSlide);
    const tableEl = tableSlide.elements.find((e) => e.type === 'table');
    assert.ok(tableEl && tableEl.type === 'table');
    // Check OceanStor row has red "回滚中" cell
    const rows = (tableEl as { rows: { cells: { text: string; bgColor?: string }[] }[] }).rows;
    const oceanStor = rows.find((r) => r.cells[0].text === 'OceanStor');
    assert.ok(oceanStor);
    const rollbackCell = oceanStor.cells.find((c) => c.text === '回滚中');
    assert.ok(rollbackCell);
    assert.equal(rollbackCell.bgColor, 'CF0A2C');
  });

  it('generates valid .pptx buffer', async () => {
    const pres = buildDeck(blueprint, theme);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(Buffer.isBuffer(buf));
    // PPTX is a ZIP — starts with PK signature
    assert.equal(buf[0], 0x50); // 'P'
    assert.equal(buf[1], 0x4b); // 'K'
    assert.ok(buf.length > 10000, `Expected >10KB, got ${buf.length}`);
  });

  it('writes to disk for manual inspection', async () => {
    const pres = buildDeck(blueprint, theme);
    const outDir = join(__dirname, '..', 'output');
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'huawei-demo.pptx');
    const buf = await pres.write({ outputType: 'nodebuffer' });
    writeFileSync(outPath, buf);
    assert.ok(existsSync(outPath));
    console.log(`  → Written to: ${outPath}`);
  });
});
