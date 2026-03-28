import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SlideSpec, ThemeTokens } from '../../src/types.js';

// Minimal theme fixture (enough for HTML template tests)
const THEME: ThemeTokens = {
  version: '1.0',
  name: 'test-theme',
  description: 'Test theme for HTML template',
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
      palette: ['CF0A2C', '333333', '666666'],
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
      nestedBg: ['FAFAFA', 'F5F5F5', 'EEEEEE', 'E8E8E8'],
      connectorColor: '999999',
      connectorWidth: 1,
    },
    closing: { bg: '333333', titleColor: 'FFFFFF', titleFontSize: 28 },
  },
  slideNumber: { color: '999999', fontSize: 8, position: { x: '95%', y: '96%' } },
};

function makeSlide(overrides: Partial<SlideSpec> & { elements: SlideSpec['elements'] }): SlideSpec {
  return {
    slideId: 'test-slide',
    intent: 'content',
    layoutId: 'layout-title-body',
    purpose: 'test',
    elements: overrides.elements,
    renderBudget: { maxWords: 200 },
    ...overrides,
  };
}

describe('html-template — renderSlideToHtml()', () => {
  it('wraps slide in a 1280×720 container with data-slide-id', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeSlide({ slideId: 'slide-1', elements: [] });
    const html = renderSlideToHtml(slide, THEME);

    assert.ok(html.includes('data-slide-id="slide-1"'), 'should have data-slide-id');
    assert.ok(html.includes('1280px'), 'should set 1280px width');
    assert.ok(html.includes('720px'), 'should set 720px height');
  });

  it('renders text element with data-ppt-role="text"', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeSlide({
      elements: [{ type: 'text', slotName: 'body', content: 'Hello World', fontSize: 14 }],
    });
    const html = renderSlideToHtml(slide, THEME);

    assert.ok(html.includes('data-ppt-role="text"'), 'should have data-ppt-role="text"');
    assert.ok(html.includes('Hello World'), 'should contain text content');
    assert.ok(html.includes('data-slot-name="body"'), 'should have data-slot-name');
  });

  it('renders table element with <table> + data-ppt-role="table"', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeSlide({
      layoutId: 'layout-dense-table',
      elements: [
        {
          type: 'table',
          slotName: 'table',
          headers: ['Name', 'Status'],
          rows: [{ cells: [{ text: 'Auth' }, { text: 'Done', bgColor: 'E8F5E9' }] }],
        },
      ],
    });
    const html = renderSlideToHtml(slide, THEME);

    assert.ok(html.includes('data-ppt-role="table"'), 'should have data-ppt-role="table"');
    assert.ok(html.includes('<table'), 'should use real <table> element');
    assert.ok(html.includes('Auth'), 'should contain cell text');
    assert.ok(html.includes('E8F5E9'), 'should include cell bgColor');
  });

  it('renders chart element as placeholder with data-ppt-role="chart"', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeSlide({
      layoutId: 'layout-full-chart',
      elements: [
        {
          type: 'chart',
          slotName: 'chart',
          chartType: 'bar',
          data: { chartProfile: 'categorical', categories: ['A'], series: [{ name: 's', values: [1] }] },
        },
      ],
    });
    const html = renderSlideToHtml(slide, THEME);

    assert.ok(html.includes('data-ppt-role="chart"'), 'should have data-ppt-role="chart"');
    assert.ok(html.includes('data-chart-type="bar"'), 'should include chart type as data attr');
  });

  it('renders KPI element with data-ppt-role="group"', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeSlide({
      layoutId: 'layout-kpi',
      elements: [{ type: 'kpi', slotName: 'kpi-1', number: '94%', label: 'Review Pass Rate', trend: 'up' }],
    });
    const html = renderSlideToHtml(slide, THEME);

    assert.ok(html.includes('data-ppt-role="group"'), 'KPI should be a group');
    assert.ok(html.includes('94%'), 'should contain KPI number');
    assert.ok(html.includes('Review Pass Rate'), 'should contain KPI label');
  });

  it('applies theme CSS custom properties', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeSlide({ elements: [] });
    const html = renderSlideToHtml(slide, THEME);

    assert.ok(html.includes('--brand-primary'), 'should set --brand-primary CSS var');
    assert.ok(html.includes('CF0A2C'), 'should include primary color value');
  });

  it('throws on image elements instead of silent drop (cloud P1-3)', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeSlide({
      elements: [{ type: 'image' as any, slotName: 'body', src: 'https://example.com/img.png' }],
    });
    assert.throws(
      () => renderSlideToHtml(slide, THEME),
      /image.*not.*support|unsupported.*image/i,
      'V2 template should throw for unsupported image elements',
    );
  });

  it('positions elements using slot coordinates from layout catalog', async () => {
    const { renderSlideToHtml } = await import('../../src/compiler/html-template.js');
    const slide = makeSlide({
      elements: [{ type: 'text', slotName: 'title', content: 'Title Text' }],
    });
    const html = renderSlideToHtml(slide, THEME);

    // layout-title-body title slot: x=0.5, y=0.3, w=9, h=0.5
    // In px: x=64, y=38.4, w=1152, h=64
    assert.ok(html.includes('position: absolute'), 'should use absolute positioning');
    assert.ok(html.includes('Title Text'), 'should contain title text');
  });
});
