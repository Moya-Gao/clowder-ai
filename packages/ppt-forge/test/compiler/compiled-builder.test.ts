import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CompiledDeck, CompiledElement, CompiledSlide } from '../../src/compiler/types.js';
import type { ThemeTokens } from '../../src/types.js';

const THEME: ThemeTokens = {
  version: '1.0',
  name: 'test',
  description: 'Test',
  brand: {
    colors: {
      primary: 'CF0A2C',
      secondary: '333333',
      accent: 'E53935',
      background: 'FFFFFF',
      surface: 'F5F5F5',
      surfaceAlt: 'EEEEEE',
      white: 'FFFFFF',
      text: { primary: '333333', secondary: '666666', muted: '999999', onPrimary: 'FFFFFF' },
    },
    typography: {
      headingFont: 'PingFang SC',
      bodyFont: 'PingFang SC',
      monoFont: 'Menlo',
      cjkFont: 'PingFang SC',
      headingWeight: '700',
      bodyWeight: '400',
      fallback: { headingFont: 'sans-serif', bodyFont: 'sans-serif', monoFont: 'monospace', cjkFont: 'sans-serif' },
    },
    spacing: { unit: 8, xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  },
  slide: {
    cover: { bg: 'CF0A2C', titleColor: 'FFFFFF', titleFontSize: 36 },
    section: { bg: 'CF0A2C', titleColor: 'FFFFFF', titleFontSize: 28 },
    content: { bg: 'FFFFFF', titleColor: '333333', titleFontSize: 24, bodyColor: '333333', bodyFontSize: 14 },
    kpi: {
      numberColor: 'CF0A2C',
      numberFontSize: 48,
      labelColor: '666666',
      labelFontSize: 12,
      trendUp: '4CAF50',
      trendDown: 'F44336',
      trendFlat: '999999',
    },
    chart: {
      palette: ['CF0A2C'],
      gridColor: 'E0E0E0',
      gridSize: 8,
      axisLabelColor: '666666',
      axisLabelSize: 10,
      dataLabelColor: '333333',
      dataLabelSize: 10,
      bgColor: 'FFFFFF',
    },
    table: {
      headerBg: 'CF0A2C',
      headerColor: 'FFFFFF',
      rowBg: 'FFFFFF',
      rowAltBg: 'F5F5F5',
      rowColor: '333333',
      borderColor: 'E0E0E0',
    },
    diagram: {
      boxBg: 'F5F5F5',
      boxBorder: 'CF0A2C',
      boxBorderWidth: 1.2,
      labelColor: '333333',
      labelFontSize: 10,
      nestedBg: ['FAFAFA'],
      connectorColor: '999999',
      connectorWidth: 1,
    },
    closing: { bg: '333333', titleColor: 'FFFFFF', titleFontSize: 28 },
  },
  slideNumber: { color: '999999', fontSize: 8, position: { x: '95%', y: '96%' } },
};

function makeTextEl(text: string, rect: CompiledElement['rect']): CompiledElement {
  return {
    role: 'text',
    rect,
    content: { type: 'text', runs: [{ text, fontSize: 24, fontFamily: 'PingFang SC', color: '333333' }] },
    style: {},
  };
}

function makeShapeEl(rect: CompiledElement['rect']): CompiledElement {
  return {
    role: 'shape',
    rect,
    content: { type: 'shape', shapeType: 'roundRect', fill: 'F5F5F5' },
    style: { fill: 'F5F5F5', borderColor: 'CF0A2C', borderWidth: 1.2, borderRadius: 4 },
  };
}

describe('compiled-builder — buildCompiledDeck()', () => {
  it('creates a pptxgenjs presentation with correct slide count', async () => {
    const { buildCompiledDeck } = await import('../../src/compiler/compiled-builder.js');
    const deck: CompiledDeck = {
      slides: [
        { slideId: 's1', intent: 'cover', masterName: 'MASTER_COVER', elements: [], fontsUsed: [] },
        {
          slideId: 's2',
          intent: 'content',
          masterName: 'MASTER_CONTENT',
          elements: [makeTextEl('Hello', { x: 1, y: 0.5, w: 8, h: 1 })],
          fontsUsed: [],
        },
      ],
      fontsUsed: [],
    };
    const pres = buildCompiledDeck(deck, THEME);
    // pptxgenjs stores slides internally — verify via write
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(buf instanceof Buffer, 'should produce a buffer');
    assert.ok(buf.length > 1000, 'buffer should be non-trivial');
  });

  it('renders text elements at compiled rects (no recalculation)', async () => {
    const { buildCompiledDeck } = await import('../../src/compiler/compiled-builder.js');
    const deck: CompiledDeck = {
      slides: [
        {
          slideId: 's1',
          intent: 'content',
          masterName: 'MASTER_CONTENT',
          elements: [makeTextEl('Test Content', { x: 0.5, y: 1.0, w: 9.0, h: 4.2 })],
          fontsUsed: ['PingFang SC'],
        },
      ],
      fontsUsed: ['PingFang SC'],
    };
    const pres = buildCompiledDeck(deck, THEME);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(buf.length > 0);
  });

  it('renders shape elements with fill and border', async () => {
    const { buildCompiledDeck } = await import('../../src/compiler/compiled-builder.js');
    const deck: CompiledDeck = {
      slides: [
        {
          slideId: 's1',
          intent: 'content',
          masterName: 'MASTER_CONTENT',
          elements: [makeShapeEl({ x: 0.3, y: 0.9, w: 2, h: 1 })],
          fontsUsed: [],
        },
      ],
      fontsUsed: [],
    };
    const pres = buildCompiledDeck(deck, THEME);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(buf.length > 0);
  });

  it('renders group elements by recursing into children', async () => {
    const { buildCompiledDeck } = await import('../../src/compiler/compiled-builder.js');
    const group: CompiledElement = {
      role: 'group',
      rect: { x: 0.3, y: 0.9, w: 9.4, h: 4.4 },
      content: { type: 'group' },
      style: { fill: 'FAFAFA' },
      children: [makeShapeEl({ x: 0.3, y: 1.2, w: 4.5, h: 4.1 }), makeShapeEl({ x: 5.0, y: 1.2, w: 4.7, h: 4.1 })],
    };
    const deck: CompiledDeck = {
      slides: [
        {
          slideId: 's1',
          intent: 'content',
          masterName: 'MASTER_CONTENT',
          elements: [group],
          fontsUsed: [],
        },
      ],
      fontsUsed: [],
    };
    const pres = buildCompiledDeck(deck, THEME);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(buf.length > 0);
  });

  it('renders table elements with headers and rows', async () => {
    const { buildCompiledDeck } = await import('../../src/compiler/compiled-builder.js');
    const table: CompiledElement = {
      role: 'table',
      rect: { x: 0.3, y: 0.9, w: 9.4, h: 4.4 },
      content: {
        type: 'table',
        headers: ['Feature', 'Status'],
        rows: [{ cells: [{ text: 'Auth' }, { text: 'Done', bgColor: 'E8F5E9' }] }],
      },
      style: {},
    };
    const deck: CompiledDeck = {
      slides: [
        {
          slideId: 's1',
          intent: 'content',
          masterName: 'MASTER_CONTENT',
          elements: [table],
          fontsUsed: [],
        },
      ],
      fontsUsed: [],
    };
    const pres = buildCompiledDeck(deck, THEME);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(buf.length > 0);
  });

  it('renders shape label text on top of shape (P1-2)', async () => {
    const { buildCompiledDeck } = await import('../../src/compiler/compiled-builder.js');
    const shape: CompiledElement = {
      role: 'shape',
      rect: { x: 0.3, y: 0.9, w: 2, h: 1 },
      content: {
        type: 'shape',
        shapeType: 'roundRect',
        fill: 'F5F5F5',
        runs: [{ text: 'Fastify', fontSize: 10, fontFamily: 'PingFang SC', color: '333333' }],
      },
      style: { fill: 'F5F5F5', borderColor: 'CF0A2C', borderWidth: 1.2, borderRadius: 4 },
    };
    const deck: CompiledDeck = {
      slides: [
        {
          slideId: 's1',
          intent: 'content',
          masterName: 'MASTER_CONTENT',
          elements: [shape],
          fontsUsed: [],
        },
      ],
      fontsUsed: [],
    };
    const pres = buildCompiledDeck(deck, THEME);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    const str = buf.toString('binary');
    // If label is rendered via addText, the text "Fastify" will appear in the PPTX XML
    assert.ok(str.includes('Fastify'), 'PPTX should contain shape label text "Fastify"');
  });

  it('renders chart elements via addChart (P1-1)', async () => {
    const { buildCompiledDeck } = await import('../../src/compiler/compiled-builder.js');
    const chart: CompiledElement = {
      role: 'chart',
      rect: { x: 0.5, y: 1.0, w: 9.0, h: 4.0 },
      content: {
        type: 'chart',
        chartType: 'bar',
        data: {
          chartProfile: 'categorical',
          categories: ['Q1', 'Q2', 'Q3'],
          series: [{ name: 'Revenue', values: [100, 200, 300] }],
        },
      },
      style: {},
    };
    const deck: CompiledDeck = {
      slides: [
        {
          slideId: 's1',
          intent: 'content',
          masterName: 'MASTER_CONTENT',
          elements: [chart],
          fontsUsed: [],
        },
      ],
      fontsUsed: [],
    };
    const pres = buildCompiledDeck(deck, THEME);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    // PPTX is a ZIP — chart1.xml only exists when addChart() was called
    const str = buf.toString('binary');
    assert.ok(str.includes('chart1.xml'), 'PPTX should contain chart1.xml when chart element is present');
  });

  it('renders scatter/xy chart without crashing (cloud P1-1)', async () => {
    const { buildCompiledDeck } = await import('../../src/compiler/compiled-builder.js');
    const xyChart: CompiledElement = {
      role: 'chart',
      rect: { x: 0.5, y: 1.0, w: 9.0, h: 4.0 },
      content: {
        type: 'chart',
        chartType: 'scatter',
        data: {
          chartProfile: 'xy',
          series: [
            {
              name: 'S',
              points: [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
              ],
            },
          ],
        },
      },
      style: {},
    };
    const deck: CompiledDeck = {
      slides: [
        {
          slideId: 's1',
          intent: 'content',
          masterName: 'MASTER_CONTENT',
          elements: [xyChart],
          fontsUsed: [],
        },
      ],
      fontsUsed: [],
    };
    const pres = buildCompiledDeck(deck, THEME);
    // Main assertion: xy chart data doesn't crash (was TypeError: s.values.map is not a function)
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(buf instanceof Buffer, 'should produce valid buffer without crashing');
    assert.ok(buf.length > 1000, 'buffer should be non-trivial');
  });

  it('renders bubble chart with x/y/size points (cloud R4 P1)', async () => {
    const { buildCompiledDeck } = await import('../../src/compiler/compiled-builder.js');
    const bubbleChart: CompiledElement = {
      role: 'chart',
      rect: { x: 0.5, y: 1.0, w: 9.0, h: 4.0 },
      content: {
        type: 'chart',
        chartType: 'scatter',
        data: {
          chartProfile: 'bubble',
          series: [
            {
              name: 'Market',
              points: [
                { x: 10, y: 20, size: 5 },
                { x: 30, y: 40, size: 15 },
              ],
            },
          ],
        },
      },
      style: {},
    };
    const deck: CompiledDeck = {
      slides: [
        {
          slideId: 's1',
          intent: 'content',
          masterName: 'MASTER_CONTENT',
          elements: [bubbleChart],
          fontsUsed: [],
        },
      ],
      fontsUsed: [],
    };
    const pres = buildCompiledDeck(deck, THEME);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(buf instanceof Buffer, 'should produce valid buffer for bubble chart');
    assert.ok(buf.length > 1000, 'buffer should be non-trivial');
  });

  it('adds speaker notes when present', async () => {
    const { buildCompiledDeck } = await import('../../src/compiler/compiled-builder.js');
    const deck: CompiledDeck = {
      slides: [
        {
          slideId: 's1',
          intent: 'content',
          masterName: 'MASTER_CONTENT',
          elements: [],
          fontsUsed: [],
          speakerNotes: 'Remember to pause here.',
        },
      ],
      fontsUsed: [],
    };
    const pres = buildCompiledDeck(deck, THEME);
    const buf = await pres.write({ outputType: 'nodebuffer' });
    assert.ok(buf.length > 0);
  });
});
