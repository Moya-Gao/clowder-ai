import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDeck } from '../src/slide-builder.js';
import type { DeckBlueprint, ThemeTokens } from '../src/types.js';

function makeTheme(): ThemeTokens {
  return {
    version: '1.0',
    name: 'test',
    description: 'test theme',
    brand: {
      colors: {
        primary: 'CF0A2C',
        secondary: '333333',
        accent: 'E60012',
        background: 'FFFFFF',
        surface: 'F5F5F5',
        surfaceAlt: 'EEEEEE',
        white: 'FFFFFF',
        text: { primary: '333333', secondary: '666666', muted: '999999', onPrimary: 'FFFFFF' },
      },
      typography: {
        headingFont: 'Noto Sans SC',
        bodyFont: 'Noto Sans SC',
        monoFont: 'IBM Plex Mono',
        cjkFont: 'Noto Sans SC',
        headingWeight: '700',
        bodyWeight: '400',
        fallback: {
          headingFont: 'Microsoft YaHei',
          bodyFont: 'Microsoft YaHei',
          monoFont: 'Consolas',
          cjkFont: 'PingFang SC',
        },
      },
      spacing: { unit: 0.15, xs: 0.08, sm: 0.15, md: 0.3, lg: 0.5, xl: 0.8 },
    },
    slide: {
      cover: { bg: 'CF0A2C', titleColor: 'FFFFFF', titleFontSize: 32, subtitleColor: 'FFFFFF', subtitleFontSize: 16 },
      section: { bg: 'CF0A2C', labelColor: 'FFFFFF', labelFontSize: 12, titleColor: 'FFFFFF', titleFontSize: 28 },
      content: { bg: 'FFFFFF', titleColor: 'CF0A2C', titleFontSize: 20, bodyColor: '333333', bodyFontSize: 12 },
      kpi: {
        numberColor: 'CF0A2C',
        numberFontSize: 40,
        labelColor: '666666',
        labelFontSize: 11,
        trendUp: '4CAF50',
        trendDown: 'CF0A2C',
        trendFlat: '999999',
      },
      chart: {
        palette: ['CF0A2C', 'E60012', 'FF6B35'],
        gridColor: 'EEEEEE',
        gridSize: 0.5,
        axisLabelColor: '666666',
        axisLabelSize: 9,
        dataLabelColor: '333333',
        dataLabelSize: 9,
        bgColor: 'FFFFFF',
      },
      table: {
        headerBg: 'CF0A2C',
        headerColor: 'FFFFFF',
        rowBg: 'FFFFFF',
        rowAltBg: 'F5F5F5',
        rowColor: '333333',
        borderColor: 'DDDDDD',
      },
      diagram: {
        boxBg: 'F5F5F5',
        boxBorder: 'CF0A2C',
        boxBorderWidth: 1.5,
        labelColor: '333333',
        labelFontSize: 9,
        nestedBg: ['FFFFFF', 'F5F5F5', 'EEEEEE'],
        connectorColor: '999999',
        connectorWidth: 1,
      },
      closing: { bg: 'FFFFFF', titleColor: 'CF0A2C', titleFontSize: 24, bodyColor: '666666', bodyFontSize: 12 },
    },
    slideNumber: { color: '999999', fontSize: 8, position: { x: '95%', y: '95%' } },
  };
}

function makeBlueprint(): DeckBlueprint {
  return {
    version: '1.0',
    meta: {
      title: 'Test Deck',
      subtitle: 'Subtitle',
      author: 'Test',
      createdAt: '2026-03-27',
      researchRef: 'none',
      storylineRef: 'none',
      themeRef: 'huawei-like',
      framework: 'pyramid',
      targetAudience: 'corporate-executive',
    },
    sections: [{ sectionId: 's1', title: 'Section 1', slideIds: ['slide-1', 'slide-2', 'slide-3'] }],
    slides: [
      {
        slideId: 'slide-1',
        intent: 'cover',
        purpose: 'Cover slide',
        layoutId: 'layout-cover',
        elements: [
          { type: 'text', slotName: 'title', content: '企业 ICT 解决方案' },
          { type: 'text', slotName: 'subtitle', content: '2026 年度报告' },
        ],
        renderBudget: { maxWords: 20, minFontPt: 16, overflowPolicy: 'truncate' },
      },
      {
        slideId: 'slide-2',
        intent: 'content',
        purpose: 'KPI dashboard',
        layoutId: 'layout-kpi',
        elements: [
          { type: 'text', slotName: 'title', content: '关键指标' },
          { type: 'kpi', slotName: 'kpi-1', number: '98.5%', label: 'SLA', trend: 'up' as const },
          { type: 'kpi', slotName: 'kpi-2', number: '1,234', label: '用户数', trend: 'up' as const },
          { type: 'kpi', slotName: 'kpi-3', number: '45ms', label: '延迟', trend: 'down' as const },
        ],
        renderBudget: { maxWords: 30, minFontPt: 11, overflowPolicy: 'truncate' },
      },
      {
        slideId: 'slide-3',
        intent: 'data-insight',
        purpose: 'Chart slide',
        layoutId: 'layout-chart-insight',
        elements: [
          { type: 'text', slotName: 'title', content: '收入趋势' },
          {
            type: 'chart',
            slotName: 'chart',
            chartType: 'bar' as const,
            data: {
              chartProfile: 'categorical' as const,
              categories: ['Q1', 'Q2', 'Q3', 'Q4'],
              series: [{ name: '收入', values: [100, 200, 300, 400] }],
            },
          },
          { type: 'text', slotName: 'insight', content: '全年收入增长 **300%**' },
        ],
        renderBudget: { maxWords: 50, minFontPt: 10, overflowPolicy: 'shrink' },
      },
    ],
    assets: [],
  };
}

describe('buildDeck', () => {
  it('returns a pptxgenjs instance with correct slide count', async () => {
    const pres = buildDeck(makeBlueprint(), makeTheme());
    // pptxgenjs tracks slides internally
    assert.ok(pres, 'should return presentation object');
    // Access internal slides array
    const slides = (pres as unknown as { slides: unknown[] }).slides;
    assert.equal(slides.length, 3);
  });

  it('sets 16:9 layout', () => {
    const pres = buildDeck(makeBlueprint(), makeTheme());
    const layout = (pres as unknown as { layout: string }).layout;
    assert.equal(layout, 'LAYOUT_WIDE');
  });

  it('processes all element types without throwing', () => {
    assert.doesNotThrow(() => buildDeck(makeBlueprint(), makeTheme()));
  });

  it('rejects theme with # prefixed brand colors at build time (P2)', () => {
    const badTheme = makeTheme();
    badTheme.brand.colors.primary = '#CF0A2C';
    assert.throws(() => buildDeck(makeBlueprint(), badTheme), /must not start with #/);
  });

  it('rejects theme with # prefixed slide semantic colors (P2 residual)', () => {
    const badTheme = makeTheme();
    badTheme.slide.cover.bg = '#CF0A2C';
    assert.throws(() => buildDeck(makeBlueprint(), badTheme), /must not start with #/);
  });

  it('rejects theme with # prefixed table headerBg (P2 residual)', () => {
    const badTheme = makeTheme();
    badTheme.slide.table.headerBg = '#CF0A2C';
    assert.throws(() => buildDeck(makeBlueprint(), badTheme), /must not start with #/);
  });

  it('rejects theme with # in chart palette (P2 residual)', () => {
    const badTheme = makeTheme();
    badTheme.slide.chart.palette = ['#CF0A2C'];
    assert.throws(() => buildDeck(makeBlueprint(), badTheme), /must not start with #/);
  });

  it('throws on unsupported ImageElement instead of silent drop (P1-2)', () => {
    const bp = makeBlueprint();
    bp.slides[0].elements.push({
      type: 'image',
      slotName: 'title',
      src: 'logo.png',
      alt: 'Logo',
    } as never);
    assert.throws(() => buildDeck(bp, makeTheme()), /not supported.*Phase A/i);
  });
});
